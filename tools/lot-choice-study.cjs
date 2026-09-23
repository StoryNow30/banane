#!/usr/bin/env node
'use strict';
/*
 * lot-choice-study.cjs — décider sur le lot : choisir, parmi les positions que
 * le moteur calcule déjà, celle que la voie prédit.
 *
 *   node tools/lot-choice-study.cjs --input SESSION.json|DOSSIER[=libellé] [...]
 *        [--choose-mm 15] [--variant A|B] [--chain none|guarded] [--sides both|previous] [--json SORTIE]
 *
 * ÉTUDE HORS LIGNE, chantier n°1 du plan de mi-parcours (23/09, D-037). Aucune
 * position humaine n'entre dans le calcul : c'est le Pilote seul, sur un lot.
 *
 *   1. Premier passage : moteur 4.7.7 depuis la pose ESV, sur tous les cuts.
 *   2. Garde : un cut appliqué qui s'écarte de plus de 30 mm de la droite de
 *      ses voisins appliqués (±3 numéros, deux côtés) est retiré.
 *   3. Second passage, pour chaque cut non appliqué ayant des voisins retenus :
 *      a. moteur depuis la position prédite par la voie (fenêtre déplacée) ;
 *         accepté si la paire est publiée à 30 mm au plus de la prédiction ;
 *      b. sinon, CHOIX : pour chaque rail en cause, parmi les minima locaux de
 *         la grille du moteur, celui qui est le plus proche latéralement de la
 *         position prédite, s'il est seul à moins de `choose-mm` et s'il a au
 *         moins 15 points de dessus et 3 de flanc sous le gabarit ; calage de
 *         convention appliqué ; paire publiée seulement si son écartement est
 *         dans le contrat. Variante A : seulement les rails ambigus, refusés
 *         par l'écartement ou publiés loin de la prédiction. Variante B : aussi
 *         les rails en abstention faute de flanc, de dessus, de pente ou de
 *         fenêtre.
 *
 * Aucune cible d'écartement : l'écartement n'intervient qu'en admissibilité
 * (contrat [1405, 1470] mm). Le critère de choix est la POSITION du champignon
 * prédite par la voie, jamais un écartement. Même entrée que la 4.7.7
 * (src/continuity-observer.js). Jugement aux règles du banc (referenceFor) ;
 * faux si l'erreur latérale OU verticale dépasse 10 mm (D-038).
 */
const fs=require('node:fs'),path=require('node:path');
const Segments=require('./merge-segments.cjs'),Lab=require('./placement-lab.cjs'),PS=require('./pair-search.cjs');
const O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js'),Candidate=require('../src/geometry-candidate-v1.js');
const Convention=require('../src/placement-convention.js'),Gauge=require('../src/gauge.js'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'],GAP=3,GUARD_MM=30,WRONG_MM=10,MIN_TOP=15,MIN_FACE=3,MAX_DZ_MM=20;
const EXCLUDED=new Set([9033,9241]);
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const QUALITY_MOTIFS=new Set(['flank','minTop','slope','window']);

function captureOf(record,input,rails){
  return {format:'banane-lot-choice-input-v1',identity:record.identity,rails,pointsSceneRelative:input.points,visibleByClipBoxes:input.visible,sourceChunkIds:input.chunkIds};
}
function gridOf(capture,side,uSeed){
  let grid=null;
  Candidate.propose(capture,side,{lab:{uSeeds:[uSeed],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true,onCoarse(cells){grid=cells;}}});
  return grid||[];
}
/* Le choix d'un rail : le minimum qualifié le plus proche de la prédiction
 * (origine du rail amorcé), s'il est seul dans le rayon. */
function chooseRail(capture,side,science,chooseMm){
  const rail=science.rails[side];if(!rail?.ok)return {ok:false,reason:'frame'};
  const sign=rail.frame.sign,minima=PS.localMinima(gridOf(capture,side,rail.frame.uSeed),Candidate.DEFAULTS.alternativeSeparation);
  const qualified=minima.map(m=>{const delta=[0,sign*m.u,m.z],band=Convention.bandOffsets(capture,side,delta);
    return {m,delta,lateralMm:Math.abs(m.u)*1000,verticalMm:Math.abs(m.z)*1000,top:band.ok?band.top.length:0,face:band.ok?band.face.length:0};})
    .filter(c=>c.top>=MIN_TOP&&c.face>=MIN_FACE&&c.verticalMm<=MAX_DZ_MM).sort((a,b)=>a.lateralMm-b.lateralMm);
  const near=qualified.filter(c=>c.lateralMm<=chooseMm);
  if(!near.length)return {ok:false,reason:'no-qualified-minimum-near-prediction',minima:minima.length};
  if(near.length>1)return {ok:false,reason:'several-minima-near-prediction'};
  const pick=near[0],cal=Convention.calibrate(capture,side,pick.delta);
  return {ok:true,delta:cal.applied?cal.delta:pick.delta,fromPredictionMm:r1(pick.lateralMm),top:pick.top,face:pick.face,
    lossRatio:minima.length?r1(pick.m.loss/minima[0].loss):null,rankByLoss:minima.indexOf(pick.m)};
}
const FIRST_PASS=new WeakMap();
function studySession(session,label,{chooseMm=15,variant='A',chain='none',sides='both'}={}){
  const records=(session.records||[]).filter(r=>r.visitRelation?.type==='first-observation'&&r.beforeEstablished?.rails&&!EXCLUDED.has(r.identity?.cut))
    .sort((a,b)=>a.visitIndex-b.visitIndex);
  const chunks=new Map();for(const c of session.clouds||[])if(c.pointsSceneRelative)(chunks.get(c.visitId)||chunks.set(c.visitId,[]).get(c.visitId)).push(c);
  if(!FIRST_PASS.has(session))FIRST_PASS.set(session,records.map(record=>{const input=O.gatherInput(record,chunks.get(record.visitId)||[]);
    if(!SIDES.every(s=>input.contours[s])||!input.points.length)return {record,input:null};
    const start=O.startRails(record,input,null),esv=O.proposeFrom(Shadow,record,input,start.rails);return {record,input,esv};}));
  const items=FIRST_PASS.get(session).map(i=>({record:i.record,input:i.input,esv:i.esv}));
  const same=(a,b)=>a.part===b.part&&(a.frameId??null)===(b.frameId??null);
  const neighbours=(item,pool)=>pool.filter(o=>o!==item&&same(o.record.identity,item.record.identity)&&o.record.identity.cut!==item.record.identity.cut&&
    (sides!=='previous'||o.record.visitIndex<item.record.visitIndex)&&
    Math.abs(o.record.identity.cut-item.record.identity.cut)<=GAP).sort((a,b)=>Math.abs(a.record.identity.cut-item.record.identity.cut)-Math.abs(b.record.identity.cut-item.record.identity.cut)).slice(0,2);
  const lateralFrom=(item,anchors,pos)=>Math.max(...SIDES.map(s=>{const init=item.record.beforeEstablished.rails[s],M=init.sceneRelativeToProfileLocal,o=C.point(M,init.positionSceneRelative);
    const p=O.predict(init,anchors,s),q=C.point(M,pos[s]);return Math.abs((q[1]-o[1]-p.lateral)*1000);}));
  // 1–2. Premier passage et garde.
  const applied=items.filter(i=>i.esv?.applicable);
  for(const i of applied)i.positions=Object.fromEntries(SIDES.map(s=>[s,i.esv.rails[s].positionSceneRelative]));
  let anchorsPool;
  if(sides==='previous'){
    /* Un seul passage : chaque cut n'est jugé qu'avec les cuts DÉJÀ passés du
     * lot ; l'ensemble d'ancres grandit dans l'ordre des visites. */
    anchorsPool=[];
    for(const i of items.slice().sort((a,b)=>a.record.visitIndex-b.record.visitIndex)){
      if(!i.esv?.applicable)continue;
      const nb=neighbours(i,anchorsPool);i.guardMm=nb.length?r1(lateralFrom(i,nb.map(n=>({positions:n.positions})),i.positions)):null;
      i.kept=i.guardMm===null||i.guardMm<=GUARD_MM;if(i.kept)anchorsPool.push(i);
    }
  }else{
    for(const i of applied){const nb=neighbours(i,applied);i.guardMm=nb.length?r1(lateralFrom(i,nb.map(n=>({positions:n.positions})),i.positions)):null;i.kept=i.guardMm===null||i.guardMm<=GUARD_MM;}
    anchorsPool=applied.filter(i=>i.kept);
  }
  // 3. Second passage. Chaînage gardé (option) : un cut que le moteur, parti de
  // la voie, publie à 10 mm au plus de la prédiction devient à son tour une
  // ancre, et le passage recommence jusqu'à ce que rien ne change.
  for(const i of items){if(!i.esv)i.final={stage:'no-input'};else if(i.esv.applicable&&i.kept)i.final={stage:'first-pass',positions:i.positions};}
  for(let round=0;round<(chain==='guarded'?20:1);round++){
  let added=0;
  for(const i of items){
    if(i.final?.stage==='no-input'||i.final?.stage==='first-pass'||i.final?.stage==='second-pass-window'||i.final?.stage==='second-pass-choice')continue;
    const nb=neighbours(i,anchorsPool);
    if(!nb.length){i.final={stage:i.esv.applicable?'guard-deferred':'deferred',reason:'no-anchor'};continue;}
    const anchors=nb.map(n=>({visitId:n.record.visitId,visitIndex:n.record.visitIndex,part:n.record.identity.part,cut:n.record.identity.cut,positions:n.positions}));
    const {rails}=O.startRails(i.record,i.input,anchors),capture=captureOf(i.record,i.input,rails);
    const science=Shadow.scientificProposeBoth(capture),window=O.proposeFrom(Shadow,i.record,i.input,rails);
    const windowDev=window.applicable?Math.max(...SIDES.map(s=>Math.abs(window.rails[s].fromPredictionLateralMm))):null;
    if(window.applicable&&windowDev<=GUARD_MM){i.final={stage:'second-pass-window',positions:Object.fromEntries(SIDES.map(s=>[s,window.rails[s].positionSceneRelative])),anchors:anchors.map(a=>a.cut),fromPredictionMm:r1(windowDev),round};
      if(chain==='guarded'&&windowDev<=10){i.positions=i.final.positions;anchorsPool.push(i);added++;}continue;}
    // 3b. Choix par la voie.
    const deltas={},chosen={},why=[];
    for(const s of SIDES){
      const r=science.rails[s];if(!r?.ok){why.push(s+':frame');continue;}
      const next=r.next,beforeGate=r.pairGauge?.rejected?r.pairGauge.publishedBeforeGate?.delta:null;
      const own=next.status==='candidate'?next.delta:beforeGate;
      if(own&&Math.abs(own[1])*1000<=chooseMm){deltas[s]=own;continue;}                 // le moteur tombe déjà sur la voie
      const eligible=own||next.motif==='ambiguity'||next.motif==='gauge-out-of-contract'||(variant==='B'&&QUALITY_MOTIFS.has(next.motif));
      if(!eligible){why.push(s+':'+(next.motif||next.status));continue;}
      const pick=chooseRail(capture,s,science,chooseMm);
      if(!pick.ok){why.push(s+':'+pick.reason);continue;}
      deltas[s]=pick.delta;chosen[s]=pick;
    }
    if(!SIDES.every(s=>deltas[s])){i.final={stage:'deferred',reason:why.join(' '),anchors:anchors.map(a=>a.cut)};continue;}
    const pair=Gauge.assessPair(rails,deltas,C);
    if(!pair.admissible){i.final={stage:'deferred',reason:'gauge-'+pair.gaugeClass,gaugeMm:r1(pair.predictedMm),anchors:anchors.map(a=>a.cut)};continue;}
    const positions=Object.fromEntries(SIDES.map(s=>{const P=rails[s].profileLocalToSceneRelative,w=C.point(P,deltas[s]),o=C.point(P,[0,0,0]);
      return [s,rails[s].positionSceneRelative.map((v,k)=>v+w[k]-o[k])];}));
    i.final={stage:'second-pass-choice',positions,chosen:Object.fromEntries(Object.entries(chosen).map(([s,c])=>[s,{fromPredictionMm:c.fromPredictionMm,top:c.top,face:c.face,lossRatio:c.lossRatio,rankByLoss:c.rankByLoss}])),
      gaugeMm:r1(pair.predictedMm),anchors:anchors.map(a=>a.cut),round};
  }
  if(!added)break;
  }
  // Jugement : la référence humaine n'est lue qu'ici.
  const rows=[];
  for(const i of items){
    const row={cut:i.record.identity.cut,stage:i.final.stage,esv:i.esv?(i.esv.applicable?'applied':i.esv.gaugeRejected?'gauge-rejected':'abstained'):'no-input',...(i.final.reason?{reason:i.final.reason}:{}),
      ...(i.final.chosen?{chosen:i.final.chosen}:{}),...(i.final.anchors?{anchors:i.final.anchors}:{}),...(i.guardMm!=null?{guardMm:i.guardMm}:{})};
    if(i.input){
      const through=(chunks.get(i.record.visitId)||[]).filter(c=>i.input.chunkIds.includes(c.chunkId)).map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
      const refs=Object.fromEntries(SIDES.map(s=>[s,Lab.referenceFor(i.record,s,i.record.beforeEstablished.rails[s],through)]));
      row.referenced=SIDES.every(s=>refs[s].status==='candidate');
      /* D-038 : faux si l'erreur LATÉRALE OU VERTICALE dépasse 10 mm (valeurs brutes). */
      const worst=pos=>Math.max(...SIDES.map(s=>{const m=i.record.beforeEstablished.rails[s].sceneRelativeToProfileLocal,a=C.point(m,pos[s]),h=C.point(m,refs[s].finalRail.positionSceneRelative);
        return Math.max(Math.abs(a[1]-h[1]),Math.abs(a[2]-h[2]))*1000;}));
      if(row.referenced){
        if(i.esv.applicable)row.esvWorstMm=r1(worst(i.positions));
        if(i.final.positions)row.worstMm=r1(worst(i.final.positions));
      }
    }
    rows.push(row);
  }
  const judged=rows.filter(r=>r.referenced),isApplied=r=>r.worstMm!=null;
  const count=(f)=>judged.filter(f).length;
  const summary={cuts:rows.length,judged:judged.length,
    esvOnly:{right:count(r=>r.esvWorstMm!=null&&r.esvWorstMm<=WRONG_MM),wrong:count(r=>r.esvWorstMm!=null&&r.esvWorstMm>WRONG_MM)},
    lot:{right:count(r=>isApplied(r)&&r.worstMm<=WRONG_MM),wrong:count(r=>isApplied(r)&&r.worstMm>WRONG_MM)},
    byStage:{},wrongCuts:judged.filter(r=>isApplied(r)&&r.worstMm>WRONG_MM).map(r=>({cut:r.cut,stage:r.stage,worstMm:r.worstMm,anchors:r.anchors||null}))};
  for(const r of judged){const k=r.stage;summary.byStage[k]=summary.byStage[k]||{cuts:0,right:0,wrong:0};summary.byStage[k].cuts++;
    if(isApplied(r)){if(r.worstMm<=WRONG_MM)summary.byStage[k].right++;else summary.byStage[k].wrong++;}}
  const allCuts=rows.length,appliedAll=rows.filter(r=>['first-pass','second-pass-window','second-pass-choice'].includes(r.stage)).length;
  summary.coverageAllCuts={applied:appliedAll,cuts:allCuts,rate:r1(100*appliedAll/allCuts)};
  summary.coverageEsvAllCuts={applied:rows.filter(r=>r.esv==='applied').length,cuts:allCuts,rate:r1(100*rows.filter(r=>r.esv==='applied').length/allCuts)};
  return {label,chooseMm,variant,chain,sides,summary,rows};
}
function run(argv=process.argv.slice(2)){
  const inputs=[],opt={chooseMm:15,variant:'A',chain:'none',sides:'both'};let out=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--input'){const [file,label]=argv[++i].split('=');inputs.push({file,label:label||path.basename(file)});}
    else if(argv[i]==='--choose-mm')opt.chooseMm=argv[++i];else if(argv[i]==='--chain')opt.chain=argv[++i];else if(argv[i]==='--sides')opt.sides=argv[++i];else if(argv[i]==='--variant')opt.variant=argv[++i];
    else if(argv[i]==='--json')out=argv[++i];else throw Error('Argument inconnu : '+argv[i]);
  }
  if(!inputs.length){console.error('Usage : --input SESSION.json|DOSSIER[=libellé] [...] [--choose-mm 15] [--variant A|B] [--json SORTIE]');process.exit(1);}
  const variants=opt.variant.split(','),radii=String(opt.chooseMm).split(',').map(Number);
  const report={format:'banane-lot-choice-study-v1',engine:'gcv1-shadow 4.7.7',wrongMm:WRONG_MM,guardMm:GUARD_MM,excludedCuts:[...EXCLUDED],runs:[]};
  for(const {file,label} of inputs){
    const session=Segments.loadSession(file);
    for(const sides of opt.sides.split(','))for(const chain of opt.chain.split(','))for(const variant of variants)for(const chooseMm of radii){
      const s=studySession(session,label,{chooseMm,variant,chain,sides}),m=s.summary;report.runs.push(s);
      console.log(`${label} [${sides==='previous'?'un passage':'deux passages'}, ${variant}, ${chooseMm} mm, chaînage ${chain}] : jugés ${m.judged} · pose ESV seule ${m.esvOnly.right} justes / ${m.esvOnly.wrong} faux · lot ${m.lot.right} / ${m.lot.wrong} · couverture tous cuts ${m.coverageEsvAllCuts.rate} % → ${m.coverageAllCuts.rate} % · ${JSON.stringify(m.byStage)}`);
      if(m.wrongCuts.length)console.log('   faux : '+m.wrongCuts.map(w=>`${w.cut} (${w.stage}, ${w.worstMm} mm)`).join(' · '));
    }
  }
  if(out)fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  return report;
}
if(require.main===module)run();
module.exports={studySession,chooseRail,run};
