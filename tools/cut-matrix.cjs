#!/usr/bin/env node
'use strict';
/*
 * cut-matrix.cjs — la matrice cut par cut d'une session Natif (D-038, chantier 3).
 *
 *   node tools/cut-matrix.cjs --input SESSION.json|DOSSIER[=libellé] [...] [--json SORTIE] [--csv SORTIE]
 *
 * Une ligne par cut DISTINCT (première visite ; les revisites sont comptées, pas
 * rejouées). Pour chaque côté, deux lectures de l'entrée moteur :
 *   - `bench`  : l'entrée du banc historique (instantané qualifié autour de la
 *     pose ESV, `tools/placement-lab.cjs`) et, si elle manque, sa raison ;
 *   - `pose`   : ce que la capture contient à la pose ESV avant le premier geste
 *     (`src/continuity-observer.js`) : captures, points visibles prouvés,
 *     doublons retirés, contours.
 * L'écart entre les deux mesure ce que le filtre de qualification retire au
 * banc alors que les points existent (chantier 3). Puis le résultat du moteur
 * 4.7.8 depuis la pose ESV sur l'entrée `pose`, la référence humaine aux règles
 * du banc, et l'erreur latérale ET verticale (faux au-delà de 10 mm, D-038).
 * Les cuts 9033 et 9241 sont exclus (demande de l'opérateur) et le relevé le dit.
 */
const fs=require('node:fs'),path=require('node:path');
const Segments=require('./merge-segments.cjs'),Lab=require('./placement-lab.cjs');
const O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js'),C=require('../vendor/capture-core.js');
const SIDES=['left','right'],WRONG_MM=10,EXCLUDED=new Set([9033,9241]);
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;

function observationsByVisit(session){
  const map=new Map();
  for(const e of session.events||[])if(e.visitId&&['native-visit-started','native-state-observed'].includes(e.type)){
    const rows=map.get(e.visitId)||[];rows.push({type:e.type,eventSeq:e.eventSeq,state:e.type==='native-visit-started'?e.initialObserved:e.state});map.set(e.visitId,rows);}
  for(const rows of map.values())rows.sort((a,b)=>a.eventSeq-b.eventSeq);
  return map;
}
function matrix(session,label){
  const records=(session.records||[]).slice().sort((a,b)=>a.visitIndex-b.visitIndex);
  const clouds=new Map((session.clouds||[]).map(c=>[c.chunkId||c.captureId,c]));
  const chunksByVisit=new Map();for(const c of session.clouds||[])if(c.pointsSceneRelative)(chunksByVisit.get(c.visitId)||chunksByVisit.set(c.visitId,[]).get(c.visitId)).push(c);
  const observations=observationsByVisit(session),visitsByCut=new Map();
  for(const r of records){const k=`${r.identity?.part}|${r.identity?.cut}`;visitsByCut.set(k,(visitsByCut.get(k)||0)+1);}
  const rows=[],seen=new Set();
  for(const record of records){
    const id=record.identity||{},key=`${id.part}|${id.cut}`;
    if(seen.has(key))continue;seen.add(key);
    const row={part:id.part??null,cut:id.cut??null,visits:visitsByCut.get(key),excluded:EXCLUDED.has(id.cut)||undefined,sides:{}};
    if(row.excluded||!record.beforeEstablished?.rails){row.outcome=row.excluded?'excluded-by-operator':'no-initial-pose';rows.push(row);continue;}
    // Entrée du banc historique.
    let prepared=null;try{prepared=Lab.prepareVisit(record,clouds,observations.get(record.visitId)||[]);}catch{/* rapporté plus bas */}
    // Entrée à la pose ESV, avant le premier geste.
    const chunks=chunksByVisit.get(record.visitId)||[],input=O.gatherInput(record,chunks);
    for(const side of SIDES){
      const bench=prepared?.rails?.[side],sideChunks=chunks.filter(c=>c.side===side);
      row.sides[side]={
        bench:bench?.status==='ready'?{status:'ready',points:bench.points}:{status:'excluded',reasons:bench?.reasons||['prepare-failed']},
        pose:{captures:new Set(sideChunks.map(c=>c.captureId)).size,chunks:sideChunks.length,capture:input.captureIds?.[side]||null,contours:!!input.contours?.[side]},
      };
    }
    row.pose={points:input.points.length,duplicatesRemoved:input.duplicatesRemoved,cutoffAt:input.cutoffAt};
    row.benchInput=SIDES.every(s=>row.sides[s].bench.status==='ready');
    row.poseInput=SIDES.every(s=>row.sides[s].pose.contours)&&input.points.length>0;
    if(row.poseInput){
      const esv=O.proposeFrom(Shadow,record,input,O.startRails(record,input,null).rails);
      row.engine=esv.applicable?'applied':esv.gaugeRejected?'gauge-rejected':'abstained';
      row.motifs=SIDES.map(s=>esv.rails[s].motif).filter(Boolean);
      // Jugement : la référence humaine n'est lue qu'ici, aux règles du banc.
      const through=chunks.filter(c=>input.chunkIds.includes(c.chunkId)).map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
      const refs=Object.fromEntries(SIDES.map(s=>[s,Lab.referenceFor(record,s,record.beforeEstablished.rails[s],through)]));
      row.referenced=SIDES.every(s=>refs[s].status==='candidate');
      if(!row.referenced)row.referenceReasons=SIDES.filter(s=>refs[s].status!=='candidate').map(s=>s+':'+refs[s].reason);
      if(row.referenced&&esv.applicable){
        const err={};for(const s of SIDES){const m=record.beforeEstablished.rails[s].sceneRelativeToProfileLocal,a=C.point(m,esv.rails[s].positionSceneRelative),h=C.point(m,refs[s].finalRail.positionSceneRelative);
          err[s]={lateralMm:r1((a[1]-h[1])*1000),verticalMm:r1((a[2]-h[2])*1000)};}
        row.errors=err;row.worstMm=Math.max(...SIDES.flatMap(s=>[Math.abs(err[s].lateralMm),Math.abs(err[s].verticalMm)]));
        row.outcome=row.worstMm>WRONG_MM?'applied-wrong':'applied-right';
      }else row.outcome=esv.applicable?'applied-unreferenced':row.engine;
    }else row.outcome='no-input';
    if(record.continuityObservation)row.continuity=record.continuityObservation.status;
    rows.push(row);
  }
  const counted=rows.filter(r=>!r.excluded),n=counted.length,c=f=>counted.filter(f).length;
  const reasons={};for(const r of counted)for(const s of SIDES){const b=r.sides[s]?.bench;if(b?.status==='excluded')for(const x of b.reasons)reasons[x]=(reasons[x]||0)+1;}
  return {label,summary:{distinctCuts:n,excludedByOperator:rows.length-n,revisitedCuts:c(r=>r.visits>1),
    benchInput:c(r=>r.benchInput),poseInput:c(r=>r.poseInput),
    recoveredByPoseInput:c(r=>!r.benchInput&&r.poseInput),
    benchExclusionReasonsBySide:reasons,
    applied:c(r=>r.engine==='applied'),appliedRight:c(r=>r.outcome==='applied-right'),appliedWrong:c(r=>r.outcome==='applied-wrong'),
    coverageAllDistinctCuts:r1(100*c(r=>r.engine==='applied')/n)},rows};
}
function toCsv(reports){
  const head=['session','partie','cut','visites','entrée banc','entrée pose ESV','raisons banc gauche','raisons banc droite','moteur','motifs','issue','pire erreur mm'];
  const lines=[head.join(';')];
  for(const r of reports)for(const row of r.rows)lines.push([r.label,row.part,row.cut,row.visits,row.benchInput?'oui':'non',row.poseInput?'oui':'non',
    (row.sides?.left?.bench?.reasons||[]).join(' '),(row.sides?.right?.bench?.reasons||[]).join(' '),row.engine||'',(row.motifs||[]).join(' '),row.outcome,row.worstMm??''].join(';'));
  return lines.join('\n')+'\n';
}
function run(argv=process.argv.slice(2)){
  const inputs=[];let json=null,csv=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--input'){const [file,label]=argv[++i].split('=');inputs.push({file,label:label||path.basename(file)});}
    else if(argv[i]==='--json')json=argv[++i];else if(argv[i]==='--csv')csv=argv[++i];else throw Error('Argument inconnu : '+argv[i]);
  }
  if(!inputs.length){console.error('Usage : --input SESSION.json|DOSSIER[=libellé] [...] [--json SORTIE] [--csv SORTIE]');process.exit(1);}
  const reports=inputs.map(({file,label})=>{const r=matrix(Segments.loadSession(file),label),m=r.summary;
    console.log(`${label} : ${m.distinctCuts} cuts distincts · entrée banc ${m.benchInput} · entrée pose ESV ${m.poseInput} (dont ${m.recoveredByPoseInput} que le banc retirait) · appliqués ${m.applied} (${m.coverageAllDistinctCuts} %) · justes ${m.appliedRight} · faux ${m.appliedWrong}`);
    console.log('   raisons d’exclusion du banc, par côté : '+JSON.stringify(m.benchExclusionReasonsBySide));
    return r;});
  const report={format:'banane-cut-matrix-v1',engine:'gcv1-shadow 4.7.8',wrongMm:WRONG_MM,criterion:'latéral OU vertical',excludedCuts:[...EXCLUDED],reports};
  if(json)fs.writeFileSync(json,JSON.stringify(report,null,1)+'\n');
  if(csv)fs.writeFileSync(csv,toCsv(reports));
  return report;
}
if(require.main===module)run();
module.exports={matrix,toCsv,run};
