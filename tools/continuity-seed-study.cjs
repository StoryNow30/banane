#!/usr/bin/env node
'use strict';
/*
 * continuity-seed-study.cjs — le moteur retrouve-t-il le champignon s'il part
 * de la continuité de la voie plutôt que de la pose ESV ?
 *
 *   node tools/continuity-seed-study.cjs --input SESSION.json|DOSSIER[=libellé] [...]
 *        [--mode all|esv|operator|chain|relay] [--gap 3] [--json SORTIE]
 *
 * ÉTUDE HORS LIGNE, sans effet sur l'extension (cahier 4.8, amendement n°7).
 * Elle reproduit la logique de placement de l'opérateur (export Natif du 23/09,
 * partie 22) : prolonger les cuts précédents pour savoir OÙ chercher, puis
 * poser sur les points. Trois départs pour le même moteur 4.7.6 :
 *
 *   esv       la pose ESV de départ (témoin) ;
 *   operator  la droite des 2 derniers cuts validés par l'opérateur, à 3 numéros
 *             au plus (scénario Natif assisté) ;
 *   chain     la droite des 2 derniers cuts APPLIQUÉS PAR LE MOTEUR, sinon la
 *             pose ESV (scénario Pilote autonome, aucune position humaine) ;
 *             tout cut appliqué devient ancre — le chaînage que le §3.7 du n°3
 *             interdit, mesuré pour savoir pourquoi ;
 *   relay     Pilote relayé par l'opérateur : ancres = cuts appliqués depuis la
 *             pose ESV + cuts NON appliqués que l'opérateur corrige au fil du
 *             lot ; un cut résolu par continuité ne sert pas d'ancre (§3.7).
 *
 * Points : tous les nuages de la première visite du cut, qui approchent une
 * capture faite autour du départ ; le témoin reçoit exactement les mêmes. La
 * référence humaine n'est lue qu'au jugement, et seulement si elle est stricte
 * (une validation, état fraîchement observé). Aucune cible d'écartement : la
 * garde d'écartement du moteur reste la seule règle de paire.
 */
const fs=require('node:fs'),path=require('node:path');
const Segments=require('./merge-segments.cjs'),Shadow=require('../src/gcv1-shadow.js'),Gauge=require('../src/gauge.js');
const C=require('../vendor/capture-core.js'),N=require('./native-offline-evaluate.cjs'),K=require('../src/core.js');
const SIDES=['left','right'],WRONG_MM=10,MODES=['esv','operator','chain','relay'];
const JUDGED=new Set(['applied-right','applied-wrong','rail-abstained','gauge-rejected']);
/* Cuts exclus du bilan par l'opérateur le 23/09 : référence impossible à déduire. */
const EXCLUDED=new Set([9033,9241]);
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;

const validated=r=>r.operatorIntent==='VALIDATE'&&!!r.humanFinalReference?.state?.rails;
const strict=r=>validated(r)&&r.humanFinalReference.status==='candidate-observed'&&
  (r.operatorIntents||[]).length===1&&r.multiIntent!==true;
function fitAt(points){ // moindres carrés y = a + b·x, évalué en x = 0
  if(points.length===1)return points[0][1];
  let sx=0,sy=0,sxx=0,sxy=0;for(const [x,y] of points){sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}
  const n=points.length,d=n*sxx-sx*sx,b=Math.abs(d)>1e-12?(n*sxy-sx*sy)/d:0;return (sy-b*sx)/n;
}
function translated(rail,t){
  const r=JSON.parse(JSON.stringify(rail)),add=p=>[p[0]+t[0],p[1]+t[1],p[2]+t[2]];
  for(const k of ['railLocalToSceneRelative','profileLocalToSceneRelative'])r[k]=C.multiply(C.translation(t),r[k]);
  r.sceneRelativeToProfileLocal=C.inverse(r.profileLocalToSceneRelative);
  r.positionSceneRelative=add(r.positionSceneRelative);r.profileOriginSceneRelative=add(r.profileOriginSceneRelative);
  if(r.profileContours)r.profileContours=r.profileContours.map(k=>({...k,verticesSceneRelative:k.verticesSceneRelative.map(add)}));
  return r;
}
/* Départ d'un rail : la pose ESV, translatée dans son plan de profil jusqu'à la
 * droite des ancres (positions monde) si elles existent. */
function start(init,anchors,side){
  if(!anchors.length)return {t:[0,0,0]};
  const M=init.sceneRelativeToProfileLocal,o=C.point(M,init.positionSceneRelative);
  const q=anchors.map(a=>{const p=C.point(M,a.world[side]);return [p[0]-o[0],p[1]-o[1],p[2]-o[2]];});
  const lat=fitAt(q.map(p=>[p[0],p[1]])),vert=fitAt(q.map(p=>[p[0],p[2]]));
  const P=init.profileLocalToSceneRelative,a=C.point(P,o),b=C.point(P,[o[0],o[1]+lat,o[2]+vert]);
  return {t:[b[0]-a[0],b[1]-a[1],b[2]-a[2]]};
}
function studySession(session,label,{mode='operator',gap=3}={}){
  if(!MODES.includes(mode))throw Error('Mode inconnu : '+mode);
  const visits=(session.records||[]).filter(r=>r.visitRelation?.type==='first-observation'&&r.beforeEstablished?.rails&&
    !EXCLUDED.has(r.identity?.cut)).sort((a,b)=>a.identity.cut-b.identity.cut);
  const cloudsByVisit=new Map();
  for(const c of session.clouds||[])if(c.pointsSceneRelative)(cloudsByVisit.get(c.visitId)||cloudsByVisit.set(c.visitId,[]).get(c.visitId)).push(c);
  const anchors=[],rows=[];
  for(const record of visits){
    const cut=record.identity.cut,clouds=cloudsByVisit.get(record.visitId)||[];
    if(mode==='operator'&&!strict(record)){ // ancre seulement
      if(validated(record))anchors.push({cut,world:Object.fromEntries(SIDES.map(s=>[s,record.humanFinalReference.state.rails[s].positionSceneRelative]))});
      continue;}
    const near=mode==='esv'?[]:anchors.filter(a=>a.cut<cut&&cut-a.cut<=gap).slice(-2);
    const rails={};let ok=true;
    for(const side of SIDES){
      const init=record.beforeEstablished.rails[side],contours=clouds.find(c=>c.side===side&&c.rail?.profileContours?.length)?.rail?.profileContours;
      if(!contours){ok=false;break;}
      rails[side]=translated({...init,profileContours:contours},start(init,near,side).t);
    }
    if(!ok)continue;
    const points=[],visible=[];
    for(const c of clouds)for(let k=0;k<c.pointsSceneRelative.length;k++){points.push(c.pointsSceneRelative[k]);visible.push(c.visibleByClipBoxes?.[k]!==false);}
    const science=Shadow.scientificProposeBoth({format:'continuity-seed-study',identity:record.identity,rails,pointsSceneRelative:points,visibleByClipBoxes:visible,sourceChunkIds:[]});
    const applied=SIDES.every(s=>science.rails[s]?.ok&&science.rails[s].next.status==='candidate');
    const poses=applied?K.expectedPoses({rails},Object.fromEntries(SIDES.map(s=>[s,{delta:science.rails[s].next.delta}]))):null;
    const row={cut,seeded:near.length>0,anchors:near.map(a=>a.cut),applied,gaugeRejected:!!science.summary.pairGaugeRejected,
      gaugeMm:r1(science.pairGauge?.predictedMm),rails:{}};
    // Jugement : la référence humaine n'est lue qu'ici.
    if(strict(record)){
      const human=record.humanFinalReference.state.rails;row.humanGaugeMm=r1(Gauge.gaugeMmOf(human,C));
      for(const s of SIDES){
        const startErr=N.humanDelta(rails[s],human[s]);row.rails[s]={startLateralMm:r1(-startErr[1]*1000),status:science.rails[s]?.ok?science.rails[s].next.status:'frame-failed',
          motif:science.rails[s]?.ok&&science.rails[s].next.status!=='candidate'?science.rails[s].next.motif:null};
        if(poses){const d=N.humanDelta(poses[s],human[s]);row.rails[s].lateralErrorMm=r1(-d[1]*1000);row.rails[s].verticalErrorMm=r1(-d[2]*1000);}
      }
      if(poses)row.worstLateralMm=Math.max(...SIDES.map(s=>Math.abs(row.rails[s].lateralErrorMm)));
    }
    row.outcome=!strict(record)?(applied?'applied-unreferenced':'not-applied-unreferenced')
      :applied?(row.worstLateralMm>WRONG_MM?'applied-wrong':'applied-right'):row.gaugeRejected?'gauge-rejected':'rail-abstained';
    rows.push(row);
    // Ancres : l'opérateur (mode operator) ou le moteur lui-même (mode chain).
    if(mode==='operator')anchors.push({cut,world:Object.fromEntries(SIDES.map(s=>[s,record.humanFinalReference.state.rails[s].positionSceneRelative]))});
    else if(mode==='chain'&&poses)anchors.push({cut,world:Object.fromEntries(SIDES.map(s=>[s,poses[s].positionSceneRelative]))});
    else if(mode==='relay'){
      if(poses&&!near.length)anchors.push({cut,world:Object.fromEntries(SIDES.map(s=>[s,poses[s].positionSceneRelative]))});
      else if(!poses&&validated(record)){row.operatorAnchor=true;anchors.push({cut,world:Object.fromEntries(SIDES.map(s=>[s,record.humanFinalReference.state.rails[s].positionSceneRelative]))});}
    }
  }
  const count=o=>rows.filter(r=>r.outcome===o).length;
  const starts=rows.flatMap(r=>SIDES.map(s=>r.rails[s]?.startLateralMm).filter(Number.isFinite).map(Math.abs)).sort((a,b)=>a-b);
  return {label,mode,gap,summary:{judged:rows.filter(r=>JUDGED.has(r.outcome)).length,
    appliedRight:count('applied-right'),appliedWrong:count('applied-wrong'),railAbstained:count('rail-abstained'),gaugeRejected:count('gauge-rejected'),
    appliedUnreferenced:count('applied-unreferenced'),seeded:rows.filter(r=>r.seeded).length,operatorAnchors:rows.filter(r=>r.operatorAnchor).length,
    startLateralMedianMm:r1(starts[starts.length>>1]),startLateralP90Mm:r1(starts[Math.floor(starts.length*.9)]),
    wrong:rows.filter(r=>r.outcome==='applied-wrong').map(r=>({cut:r.cut,worstLateralMm:r1(r.worstLateralMm),anchors:r.anchors}))},rows};
}
function run(argv=process.argv.slice(2)){
  const inputs=[],opt={mode:'all',gap:3};let out=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--input'){const [file,label]=argv[++i].split('=');inputs.push({file,label:label||path.basename(file)});}
    else if(argv[i]==='--mode')opt.mode=argv[++i];else if(argv[i]==='--gap')opt.gap=+argv[++i];
    else if(argv[i]==='--json')out=argv[++i];else throw Error('Argument inconnu : '+argv[i]);
  }
  if(!inputs.length){console.error('Usage : --input SESSION.json|DOSSIER[=libellé] [...] [--mode all|esv|operator|chain|relay] [--gap 3] [--json SORTIE]');process.exit(1);}
  const modes=opt.mode==='all'?MODES:[opt.mode];
  const report={format:'banane-continuity-seed-study-v1',engine:'gcv1-shadow 4.7.6',wrongMm:WRONG_MM,gap:opt.gap,excludedCuts:[...EXCLUDED],modes:{}};
  for(const {file,label} of inputs){
    const session=Segments.loadSession(file); // relue une fois pour tous les départs
    for(const mode of modes){
      const s=studySession(session,label,{mode,gap:opt.gap}),m=s.summary;(report.modes[mode]||(report.modes[mode]=[])).push(s);
      console.log(`${label} [${mode}] : justes ${m.appliedRight} · faux ${m.appliedWrong} · abstention ${m.railAbstained} · écartement ${m.gaugeRejected} · sans réf. appliqués ${m.appliedUnreferenced} · départ latéral médian ${m.startLateralMedianMm} mm, p90 ${m.startLateralP90Mm}${mode==='relay'?` · corrections opérateur servant d'ancre ${m.operatorAnchors}`:''}`);
      if(m.wrong.length)console.log('   faux : '+m.wrong.map(w=>`${w.cut} (${w.worstLateralMm} mm${w.anchors.length?', ancres '+w.anchors.join('+'):', départ ESV'})`).join(' · '));
    }
  }
  if(out)fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  return report;
}
if(require.main===module)run();
module.exports={studySession,fitAt,run};
