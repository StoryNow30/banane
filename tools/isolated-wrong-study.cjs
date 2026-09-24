#!/usr/bin/env node
'use strict';
/* Étude hors ligne des faux isolés. Les références ne jugent qu'après le
 * calcul du moteur ; aucun déplacement, validation ni SKIP.
 * node --max-old-space-size=8000 tools/isolated-wrong-study.cjs
 *   --input DOSSIER=LIBELLE --baseline RELEVE_LOT.json --json SORTIE.json
 * node tools/isolated-wrong-study.cjs --combine SORTIE.json [...]
 *   --json audit/chantiers/faux-isoles.json
 */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const Segments=require('./merge-segments.cjs'),Lab=require('./placement-lab.cjs');
const O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const Lot=require('../src/lot-decision.js'),Gauge=require('../src/gauge.js');
const Convention=require('../src/placement-convention.js'),C=require('../vendor/capture-core.js');
const PS=require('./pair-search.cjs'),Candidate=require('../src/geometry-candidate-v1.js');
const SIDES=['left','right'],EXCLUDED=new Set([9033,9241]);
const round=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
const APPLIED=new Set(['first-pass','second-pass-window','second-pass-choice']);
const RULES=[
 {id:'s1-et-calage-hors-domaine-paire',test:r=>['left','right'].some(s=>r.rails[s].s1Changed)&&
  ['left','right'].some(s=>r.rails[s].calibration.reason==='shift-out-of-domain')},
 {id:'s1-hors-domaine',test:r=>['left','right'].some(s=>r.rails[s].s1Changed&&r.rails[s].calibration.reason==='shift-out-of-domain')},
 {id:'calage-hors-domaine',test:r=>['left','right'].some(s=>r.rails[s].calibration.reason==='shift-out-of-domain')},
 {id:'s1-tout',test:r=>['left','right'].some(s=>r.rails[s].s1Changed)},
 {id:'flanc-partiel',test:r=>['left','right'].some(s=>r.rails[s].partialFlankUsed)},
 {id:'depart-isole',test:r=>r.stage==='first-pass'&&r.deviationToAnchorsMm===null},
 {id:'translation-esv-100mm',test:r=>['left','right'].some(s=>Math.abs(r.rails[s].fromEsv.lateralMm)>100)}
];
function score(rows,rule){
 const hits=rows.filter(r=>APPLIED.has(r.stage)&&rule.test(r));
 return {rule:rule.id,stopped:hits.length,wrongStopped:hits.filter(r=>r.referenced&&r.wrong).length,
  rightLost:hits.filter(r=>r.referenced&&!r.wrong).length,
  unjudgedStopped:hits.filter(r=>!r.referenced).length,
  wrongCuts:hits.filter(r=>r.referenced&&r.wrong).map(r=>r.cut),
  rightCuts:hits.filter(r=>r.referenced&&!r.wrong).map(r=>r.cut)};
}
function baselineRun(file,label){
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 const run=report.runs.find(r=>r.label===label&&r.variant==='B'&&r.chain==='guarded'&&r.sides==='both'&&r.chooseMm===15);
 assert(run,'reproduction B/guarded/both/15 absente : '+label);
 return run;
}
function sceneDelta(original,position){
 const M=original.sceneRelativeToProfileLocal,a=C.point(M,original.positionSceneRelative),b=C.point(M,position);
 return {lateralMm:round((b[1]-a[1])*1000),verticalMm:round((b[2]-a[2])*1000)};
}
function selected(capture,science,side,row){
 const r=science.rails[side],chosen=row.chosen?.[side];
 if(!chosen)return {delta:r.next.status==='candidate'?r.next.delta:r.pairGauge?.publishedBeforeGate?.delta,
  calibration:r.conventionCalibration,chosen:null};
 const pick=require('./lot-choice-study.cjs').chooseRail(capture,side,science,15);
 assert(pick.ok&&pick.rankByLoss===chosen.rankByLoss,'choix divergeant : '+row.cut+'/'+side);
 const minima=PS.localMinima(Lot.gridOf(capture,side,r.frame.uSeed),Candidate.DEFAULTS.alternativeSeparation);
 const raw=minima[chosen.rankByLoss];assert(raw,'minimum absent : '+row.cut+'/'+side);
 return {delta:pick.delta,calibration:Convention.calibrate(capture,side,[0,r.frame.sign*raw.u,raw.z]),chosen};
}
function analyse(session,run,label){
 const first=(session.records||[]).filter(r=>r.visitRelation?.type==='first-observation'&&r.beforeEstablished?.rails);
 const records=new Map(first.filter(r=>!EXCLUDED.has(r.identity?.cut)).map(r=>[r.identity.cut,r]));
 assert.equal(records.size,run.summary.cuts,'nombre de cuts distincts');
 const chunks=new Map();for(const c of session.clouds||[])if(c.pointsSceneRelative){
  if(!chunks.has(c.visitId))chunks.set(c.visitId,[]);
  chunks.get(c.visitId).push(c);
 }
 const inputCache=new Map(),positions=new Map(),analysed=new Map(),applied=run.rows.filter(r=>APPLIED.has(r.stage));
 function evaluate(row){
  const record=records.get(row.cut);assert(record,'cut absent : '+row.cut);
  let input=inputCache.get(row.cut);if(!input){input=O.gatherInput(record,chunks.get(record.visitId)||[]);inputCache.set(row.cut,input);}
  assert(input.points.length&&SIDES.every(s=>input.contours[s]),'entrée manquante : '+row.cut);
  const anchors=(row.anchors||[]).map(cut=>({positions:positions.get(cut)}));
  const rails=O.startRails(record,input,anchors.length?anchors:null).rails;
  const capture={format:'banane-isolated-wrong-input-v1',identity:record.identity,rails,
   pointsSceneRelative:input.points,visibleByClipBoxes:input.visible,sourceChunkIds:input.chunkIds};
  const science=Shadow.scientificProposeBoth(capture),picked={},pos={};
  for(const s of SIDES){
   picked[s]=selected(capture,science,s,row);
   assert(picked[s].delta,'delta manquant : '+row.cut+'/'+s);
   pos[s]=Lot.positionOf(rails[s],picked[s].delta);
  }
  const pair=Gauge.assessPair(rails,Object.fromEntries(SIDES.map(s=>[s,picked[s].delta])),C);
  assert(pair.admissible,'paire hors contrat : '+row.cut);
  const prior=record.beforeEstablished.rails,dev=anchors.length?Lot.deviationMm(prior,anchors,pos):row.guardMm??null;
  // Frontière anti-fuite : toute référence humaine est lue après la proposition.
  const through=(chunks.get(record.visitId)||[]).filter(c=>input.chunkIds.includes(c.chunkId))
   .map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
  const refs=Object.fromEntries(SIDES.map(s=>[s,Lab.referenceFor(record,s,prior[s],through)]));
  const referenced=SIDES.every(s=>refs[s].status==='candidate');
  assert.equal(referenced,!!row.referenced,'référence diverge : '+row.cut);
  const worst=referenced?Math.max(...SIDES.flatMap(s=>{
   const M=prior[s].sceneRelativeToProfileLocal,a=C.point(M,pos[s]),b=C.point(M,refs[s].finalRail.positionSceneRelative);
   return [Math.abs(a[1]-b[1]),Math.abs(a[2]-b[2])].map(v=>v*1000);
  })):null;
  if(referenced)assert.equal(Math.round(worst*10)/10,row.worstMm,'erreur diverge : '+row.cut);
  const details=Object.fromEntries(SIDES.map(s=>{
   const r=science.rails[s],cal=picked[s].calibration||{},chosen=picked[s].chosen;
   return [s,{publicationPath:chosen?'CHOIX_LOT':r.s1Changed?'S1':'A_STAR',
    s1Changed:!!r.s1Changed,partialFlankUsed:!!r.partialFlankUsed,
    bestSecondLossRatio:round(r.astar?.lossRatio),chosenBestLossRatio:chosen?.lossRatio??null,
    topPoints:chosen?.top??r.next.topRows??null,facePoints:chosen?.face??r.next.faceCount??null,
    calibration:{applied:!!cal.applied,reason:cal.reason??null,topN:cal.topN??null,faceN:cal.faceN??null,
     duMm:round(cal.duMm),dzMm:round(cal.dzMm)},
    density:{localPoints:r.frame?.pointsLocal??null,inputPoints:input.points.length},
    visibility:{visible:input.visible.filter(v=>v===true).length,unknown:input.visible.filter(v=>v==null).length},
    fromEsv:sceneDelta(prior[s],pos[s]),chosen:chosen??null,
    candidateStatus:{astar:r.astar?.status??null,astarMotif:r.astar?.motif??null,next:r.next.status,nextMotif:r.next.motif??null}}];
  }));
  analysed.set(row.cut,{cut:row.cut,stage:row.stage,anchors:row.anchors||[],referenced,wrong:referenced?worst>10:null,
   worstMm:row.worstMm??null,rawWorstMm:round(worst),gaugeMm:round(pair.predictedMm),
   deviationToAnchorsMm:round(dev),rails:details});
  positions.set(row.cut,pos);
 }
 for(const row of applied.filter(r=>r.stage==='first-pass'))evaluate(row);
 let pending=applied.filter(r=>r.stage!=='first-pass');
 while(pending.length){
  const ready=pending.filter(r=>(r.anchors||[]).every(cut=>positions.has(cut)));
  assert(ready.length,'ancres introuvables : '+pending.map(r=>r.cut).join(','));
  for(const row of ready)evaluate(row);
  pending=pending.filter(r=>!ready.includes(r));
 }
 const rows=run.rows.map(r=>analysed.get(r.cut)||{cut:r.cut,stage:r.stage,referenced:!!r.referenced,wrong:null,reason:r.reason||null});
 assert.deepEqual(rows.filter(r=>r.wrong).map(r=>r.cut),run.summary.wrongCuts.map(r=>r.cut),'liste des faux');
 return {label,totals:{cuts:run.summary.cuts,judged:run.summary.judged,applied:applied.length,
  right:run.summary.lot.right,wrong:run.summary.lot.wrong,excluded:first.filter(r=>EXCLUDED.has(r.identity?.cut)).map(r=>r.identity.cut)},
  wrongCuts:run.summary.wrongCuts,ruleScores:RULES.map(rule=>score(rows,rule)),rows};
}
function main(args=process.argv.slice(2)){
 const opt=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;},out=opt('--json');
 assert(out,'--json SORTIE obligatoire');
 let sessions;
 if(args.includes('--combine')){
  sessions=args.slice(args.indexOf('--combine')+1,args.indexOf('--json')).flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')).sessions)
   .map(s=>({...s,ruleScores:RULES.map(rule=>score(s.rows,rule))}));
 }else{
  const [dir,label]=(opt('--input')||'').split('='),baseline=opt('--baseline');
  assert(dir&&label&&baseline,'--input DOSSIER=LIBELLÉ et --baseline nécessaires');
  sessions=[analyse(Segments.loadSession(dir),baselineRun(baseline,label),label)];
 }
 const rows=sessions.flatMap(s=>s.rows);
 const result={format:'banane-isolated-wrong-study-v1',origin:'lot-choice B/guarded/both/15',
  excludedCuts:[...EXCLUDED],wrongDefinition:'erreur brute latérale OU verticale > 10 mm',
  totals:{cuts:sessions.reduce((n,s)=>n+s.totals.cuts,0),judged:sessions.reduce((n,s)=>n+s.totals.judged,0),
   right:sessions.reduce((n,s)=>n+s.totals.right,0),wrong:sessions.reduce((n,s)=>n+s.totals.wrong,0)},
  ruleScores:RULES.map(rule=>score(rows,rule)),sessions};
 fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');
 console.log(JSON.stringify({totals:result.totals,rules:result.ruleScores.map(r=>[r.rule,r.wrongStopped,r.rightLost])}));
}
if(require.main===module)main();
module.exports={RULES,score,baselineRun,APPLIED,analyse,sceneDelta};
