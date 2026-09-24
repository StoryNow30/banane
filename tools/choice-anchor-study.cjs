#!/usr/bin/env node
'use strict';
/*
 * choice-anchor-study.cjs — la décision sur le lot, étape par étape et selon le
 * nombre d'appuis, jugée sur tout ce qui a été relu (étude hors ligne, 24/09).
 *
 *   node tools/choice-anchor-study.cjs SORTIE.json \
 *        --natif SESSION|DOSSIER=libellé [...] \
 *        --lot DOSSIER=libellé[@RELECTURE] [...]
 *
 * Motif : lot 2 de la partie 31 (4.7.9), cut 7026, CHOIX à 20 mm du rail droit
 * validé, prédiction tirée d'un SEUL appui (7023). La question : les choix et
 * les reprises depuis la voie à un seul appui sont-ils moins sûrs ?
 *
 * Banc Natif : un seul passage dans l'ordre des visites, appuis = cuts retenus
 * par la décision elle-même (comme `observeLot` et `tools/deferred-diagnosis.cjs`),
 * jugement contre la référence stricte (`referenceFor`). Lots Pilote : rejeu de
 * `tools/acceptance-report.cjs` (décision rejouée, jugement de l'outil
 * d'acceptation, D-040 compris). Faux : latéral OU vertical > 10 mm (D-038).
 * Aucune pose humaine n'entre dans une décision ; aucun écartement n'est une
 * cible (admissibilité [1405, 1470] mm seulement).
 *
 * Un CHOIX ne devient jamais appui (`anchor:false`) : écarter un choix ne
 * change donc pas les décisions suivantes, et les règles « choix » ci-dessous
 * se mesurent exactement par filtre. Ce n'est pas le cas d'une reprise depuis
 * la voie (« window »), qui peut devenir appui : elle est décrite, pas filtrée.
 */
const B=require('node:path').resolve(__dirname,'..')+'/';
const fs=require('node:fs');
const SIDES=['left','right'],WRONG_MM=10,EXCLUDED=new Set([9033,9241]),r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;

function localOf(C,rail,pos){const M=rail.sceneRelativeToProfileLocal,a=C.point(M,pos),o=C.point(M,rail.positionSceneRelative);return [a[0]-o[0],a[1]-o[1],a[2]-o[2]];}
/* Garde de paire proposée par le chantier 2 (`audit/chantiers/faux-isoles.md`,
 * branche chantier-48/faux-isoles) : un rail publié par S1 ET un calage de
 * convention « shift-out-of-domain » sur l'un des deux rails. */
const pairFlag=science=>SIDES.some(s=>science?.rails?.[s]?.next?.changed===true)&&SIDES.some(s=>science?.rails?.[s]?.conventionCalibration?.reason==='shift-out-of-domain');
/* Simulation exacte : un premier passage ainsi signalé est différé (jamais
 * appui), comme la garde de continuité sans reprise. */
const guarded=L=>({...L,decideCut:args=>{const d=L.decideCut(args);
  return d.stage==='first-pass'&&pairFlag(args.science)?{version:d.version,stage:'deferred',reason:'pair-guard',anchorsUsed:d.anchorsUsed,anchor:false}:d;}});
const describe=d=>({stage:d.stage,anchors:(d.anchorsUsed||[]).length,anchorsUsed:d.anchorsUsed||[],
  chosenMaxFromPredictionMm:d.chosen?Math.max(...Object.values(d.chosen).map(c=>c.fromPredictionMm)):null,
  chosenSides:d.chosen?Object.keys(d.chosen):[],fromPredictionMm:d.fromPredictionMm??null,guardMm:d.guardMm??null,gaugeMm:d.gaugeMm??null});

function runNatif(file,label,{pairGuard=false}={}){
  const Segments=require(B+'tools/merge-segments.cjs'),Lab=require(B+'tools/placement-lab.cjs');
  const O=require(B+'src/continuity-observer.js'),Shadow=require(B+'src/gcv1-shadow.js'),L0=require(B+'src/lot-decision.js'),C=require(B+'vendor/capture-core.js');
  const L=pairGuard?guarded(L0):L0;
  const s=Segments.loadSession(file),records=(s.records||[]).slice().sort((a,b)=>a.visitIndex-b.visitIndex);
  const chunksByVisit=new Map();for(const c of s.clouds||[])if(c.pointsSceneRelative)(chunksByVisit.get(c.visitId)||chunksByVisit.set(c.visitId,[]).get(c.visitId)).push(c);
  const anchors=[],rows=[],seen=new Set();
  for(const record of records){
    const id=record.identity||{},key=id.part+'|'+id.cut;if(seen.has(key))continue;seen.add(key);
    if(EXCLUDED.has(id.cut)||!record.beforeEstablished?.rails)continue;
    const chunks=chunksByVisit.get(record.visitId)||[],input=O.gatherInput(record,chunks);
    if(!SIDES.every(x=>input.contours[x])||!input.points.length)continue;
    const rails=O.startRails(record,input,null).rails;
    const capture={identity:id,rails,pointsSceneRelative:input.points,visibleByClipBoxes:input.visible};
    const science=Shadow.scientificProposeBoth(capture),d=L.decideCut({capture,science,anchors,Shadow});
    if(d.anchor)anchors.push({identity:id,positions:d.positions});
    if(!d.positions)continue;
    const row={source:label,kind:'natif',cut:id.cut,...describe(d),pairFlag:pairFlag(science),judged:false};
    const through=chunks.filter(c=>input.chunkIds.includes(c.chunkId)).map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
    const refs=Object.fromEntries(SIDES.map(x=>[x,Lab.referenceFor(record,x,record.beforeEstablished.rails[x],through)]));
    if(SIDES.every(x=>refs[x].status==='candidate')){
      row.errors=Object.fromEntries(SIDES.map(x=>{const a=localOf(C,rails[x],d.positions[x]),t=localOf(C,rails[x],refs[x].finalRail.positionSceneRelative);
        return [x,{lateralMm:r1((a[1]-t[1])*1000),verticalMm:r1((a[2]-t[2])*1000)}];}));
      row.worstMm=Math.max(...SIDES.flatMap(x=>[Math.abs(row.errors[x].lateralMm),Math.abs(row.errors[x].verticalMm)]));
      row.judged=true;row.wrong=row.worstMm>WRONG_MM;}
    rows.push(row);
  }
  return rows;
}

function runLot(dir,label,relecture,{pairGuard=false}={}){
  const A=require(B+'tools/acceptance-report.cjs'),L0=require(B+'src/lot-decision.js'),L=pairGuard?guarded(L0):L0;
  const seen=new Map(),flags=new Map();
  const deps={L:{...L,decideCut:args=>{const d=L.decideCut(args);seen.set(args.capture.identity.cut,d);flags.set(args.capture.identity.cut,pairFlag(args.science));return d;}}};
  const r=A.report([A.loadLot(dir,label,relecture||null)],{replay:true,preferReplay:true,replayDeps:deps});
  const rows=[];
  for(const x of r.lots[0].rows){if(x.excluded||!x.lot?.wouldApply)continue;const d=seen.get(x.cut);if(!d)continue;
    const judged=!!x.lot.errors;rows.push({source:label,kind:'pilote',cut:x.cut,...describe(d),pairFlag:flags.get(x.cut)===true,judged,
      errors:x.lot.errors||null,worstMm:x.lot.worstMm??null,wrong:judged?!!x.lot.wrong:undefined,pilot:x.outcome});}
  return rows;
}

function tally(rows){
  const out={};
  for(const x of rows){const k=x.stage+' · '+(x.anchors>=2?'2 appuis':x.anchors===1?'1 appui':'0 appui');
    const t=out[k]||(out[k]={decisions:0,judged:0,wrong:0,wrongCuts:[]});t.decisions++;if(x.judged){t.judged++;if(x.wrong){t.wrong++;t.wrongCuts.push(x.source+':'+x.cut+' ('+x.worstMm+' mm)');}}}
  return out;
}
/* Règles « choix » : un choix qui ne les satisfait pas est différé. Exact, puisqu'un choix n'est jamais appui. */
const RULES={
  'actuelle':()=>true,
  'choix : 2 appuis au moins':x=>x.stage!=='choice'||x.anchors>=2,
  'choix : à 10 mm de la prédiction au plus':x=>x.stage!=='choice'||x.chosenMaxFromPredictionMm<=10,
};
function rules(rows){
  return Object.fromEntries(Object.entries(RULES).map(([name,keep])=>{const k=rows.filter(keep),j=k.filter(x=>x.judged);
    const lost=rows.filter(x=>!keep(x));
    return [name,{applied:k.length,judged:j.length,wrong:j.filter(x=>x.wrong).length,
      removed:lost.length,removedJudgedRight:lost.filter(x=>x.judged&&!x.wrong).map(x=>x.source+':'+x.cut),removedWrong:lost.filter(x=>x.wrong).map(x=>x.source+':'+x.cut),
      removedUnjudged:lost.filter(x=>!x.judged).map(x=>x.source+':'+x.cut)}];}));
}

function run(argv=process.argv.slice(2)){
  const out=argv[0],rows=[],pairGuard=argv.includes('--garde-paire');if(!out||out.startsWith('--'))throw Error('Usage : SORTIE.json [--garde-paire] --natif F=libellé [...] --lot DOSSIER=libellé[@RELECTURE] [...]');
  for(let i=1;i<argv.length;i++){const t=Date.now();
    if(argv[i]==='--garde-paire')continue;
    if(argv[i]==='--natif'){const [f,l]=argv[++i].split('=');rows.push(...runNatif(f,l||f,{pairGuard}));console.log('natif',l,Math.round((Date.now()-t)/1000)+' s');}
    else if(argv[i]==='--lot'){const [f,rest]=argv[++i].split('='),[l,rel]=(rest||f).split('@');rows.push(...runLot(f,l,rel,{pairGuard}));console.log('lot',l,Math.round((Date.now()-t)/1000)+' s');}
    else throw Error('Argument inconnu : '+argv[i]);}
  const groups={natif:rows.filter(x=>x.kind==='natif'),pilote:rows.filter(x=>x.kind==='pilote')};
  const result={format:'banane-choice-anchor-study-v1',wrongMm:WRONG_MM,pairGuard,
    byStageAndAnchors:{natif:tally(groups.natif),pilote:tally(groups.pilote),tout:tally(rows)},
    rules:{natif:rules(groups.natif),pilote:rules(groups.pilote),tout:rules(rows)},rows};
  fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');
  for(const [g,t] of Object.entries(result.byStageAndAnchors)){console.log('\n'+g);for(const [k,v] of Object.entries(t).sort())console.log(`  ${k.padEnd(24)} ${String(v.decisions).padStart(4)} décidés · ${v.wrong} faux / ${v.judged} jugés ${v.wrongCuts.join(', ')}`);}
  for(const [g,t] of Object.entries(result.rules)){console.log('\nrègles, '+g);for(const [k,v] of Object.entries(t))console.log(`  ${k.padEnd(42)} ${v.applied} appliqués · ${v.wrong} faux / ${v.judged} jugés · écartés ${v.removed} (justes ${v.removedJudgedRight.length}, faux ${v.removedWrong.length}, non jugés ${v.removedUnjudged.length})`);}
  return result;
}
if(require.main===module)try{run();}catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={runNatif,runLot,tally,rules,RULES,pairFlag,guarded,run};
