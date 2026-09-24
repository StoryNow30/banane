#!/usr/bin/env node
'use strict';
/* Relecture : instrumentation des sorties seulement, aucun changement de
 * décision. Usage : node --max-old-space-size=12000 tools/relecture-478.cjs
 * DOSSIER LABEL SORTIE. Les références ne servent qu'au jugement. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const Seg=require('./merge-segments.cjs'),O=require('../src/continuity-observer.js'),L=require('../src/lot-decision.js');
const Shadow=require('../src/gcv1-shadow.js'),Lab=require('./placement-lab.cjs'),C=require('../vendor/capture-core.js');
const sides=['left','right'],excluded=new Set([9033,9241]);
const sourcePath=path.join(__dirname,'lot-choice-study.cjs');
let source=fs.readFileSync(sourcePath,'utf8');
source=source.replace('if(row.referenced){',`if(row.referenced){
 row.auditRaw=i.final.positions?worst(i.final.positions):null;
 row.auditEsvRaw=i.esv.applicable?worst(Object.fromEntries(SIDES.map(s=>[s,i.esv.rails[s].positionSceneRelative]))):null;`);
source=source.replace('rows.push(row);','row.auditFinal=i.final; rows.push(row);');
const instrumented=new Module(sourcePath,module);instrumented.filename=sourcePath;instrumented.paths=module.paths;instrumented._compile(source,sourcePath);
const [input,label,out]=process.argv.slice(2);
console.log(label,'fusion en cours');
const session=Seg.loadSession(input),report={label,node:process.version,merge:session.mergeTrace,variants:[],runtime:[]};
const first=(session.records||[]).filter(r=>r.visitRelation?.type==='first-observation'&&r.beforeEstablished?.rails&&!excluded.has(r.identity?.cut)).sort((a,b)=>a.visitIndex-b.visitIndex);
const records=session.records||[];
report.population={records:records.length,distinct:new Set(records.map(r=>r.identity.part+'|'+r.identity.cut)).size,excludedRecords:records.filter(r=>excluded.has(r.identity.cut)).length,study:first.length,duplicateFirst:first.length-new Set(first.map(r=>r.identity.part+'|'+r.identity.cut)).size,noInitialPose:records.filter(r=>!r.beforeEstablished?.rails).length};
console.log(label,'fusion terminée',JSON.stringify(report.population),'manquants',session.mergeTrace?.missingCloudIds);
for(const sideMode of ['both','previous']){
 const t=Date.now(),r=instrumented.exports.studySession(session,label,{chooseMm:15,variant:'B',chain:'guarded',sides:sideMode});
 const stored=require('../audit/lot-choice-2026-09-23.json').runs.find(s=>s.sides===sideMode&&s.variant==='B'&&s.chain==='guarded'&&s.chooseMm===15&&s.summary.cuts===r.summary.cuts);
 r.audit={elapsedMs:Date.now()-t,storedSummaryEqual:JSON.stringify(stored?.summary)===JSON.stringify(r.summary),rawWrong:r.rows.filter(x=>x.auditRaw>10).map(x=>x.cut),roundedWrong:r.rows.filter(x=>x.worstMm>10).map(x=>x.cut),baselineRawWrong:r.rows.filter(x=>x.auditEsvRaw>10).map(x=>x.cut),baselineChanged:r.rows.filter(x=>x.esvWorstMm!=null&&Math.abs(x.esvWorstMm-Math.round(x.auditEsvRaw*10)/10)>1e-8).map(x=>x.cut)};
 report.variants.push(r);console.log(label,sideMode,JSON.stringify(r.summary),JSON.stringify(r.audit));fs.writeFileSync(out,JSON.stringify(report,null,2));
}
const chunks=new Map();for(const c of session.clouds||[])if(c.pointsSceneRelative)(chunks.get(c.visitId)||chunks.set(c.visitId,[]).get(c.visitId)).push(c);
const anchors=[];
for(const record of first){
 const inp=O.gatherInput(record,chunks.get(record.visitId)||[]),row={cut:record.identity.cut,frameMismatch:inp.frameMismatch,duplicatesRemoved:inp.duplicatesRemoved};
 if(!sides.every(s=>inp.contours[s])||!inp.points.length){row.decision={stage:'no-input'};report.runtime.push(row);continue;}
 const rails=O.startRails(record,inp,null).rails,cap={identity:record.identity,rails,pointsSceneRelative:inp.points,visibleByClipBoxes:inp.visible};
 const t0=performance.now(),sci=Shadow.scientificProposeBoth(cap),t1=performance.now();
 const d=L.decideCut({capture:cap,science:sci,anchors,Shadow});row.baseMs=t1-t0;row.decisionMs=performance.now()-t1;row.decision=d;
 if(d.anchor){anchors.push({identity:record.identity,positions:d.positions,stage:d.stage});if(anchors.length>40)anchors.shift();}
 const through=(chunks.get(record.visitId)||[]).filter(c=>inp.chunkIds.includes(c.chunkId)).map(c=>c.acquisition?.endedAt||c.capturedAt).filter(Boolean).sort().at(-1)||null;
 const refs=Object.fromEntries(sides.map(s=>[s,Lab.referenceFor(record,s,record.beforeEstablished.rails[s],through)]));row.referenced=sides.every(s=>refs[s].status==='candidate');
 if(row.referenced&&d.positions){row.errors=Object.fromEntries(sides.map(s=>{const M=rails[s].sceneRelativeToProfileLocal,a=C.point(M,d.positions[s]),h=C.point(M,refs[s].finalRail.positionSceneRelative);return [s,{lateralMm:(a[1]-h[1])*1000,verticalMm:(a[2]-h[2])*1000}];}));row.worstRaw=Math.max(...Object.values(row.errors).flatMap(e=>[Math.abs(e.lateralMm),Math.abs(e.verticalMm)]));}
 report.runtime.push(row);if(report.runtime.length%50===0)console.log(label,'embarqué',report.runtime.length+'/'+first.length);
}
const previous=report.variants.find(r=>r.sides==='previous'),stage=s=>s.replace('second-pass-','').replace('guard-deferred','deferred');
report.parity=report.runtime.map(r=>{const s=previous.rows.find(x=>x.cut===r.cut),p=s.auditFinal.positions,q=r.decision.positions;let maxPositionDifferenceMm=null;if(p&&q)maxPositionDifferenceMm=Math.max(...sides.flatMap(k=>p[k].map((x,i)=>Math.abs(x-q[k][i])*1000)));return {cut:r.cut,study:stage(s.stage),runtime:r.decision.stage,stageEqual:stage(s.stage)===r.decision.stage,maxPositionDifferenceMm};});
const dist=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return {n:a.length,median:a[Math.floor(a.length*.5)],p90:a[Math.floor(a.length*.9)],max:a.at(-1)};};
report.timing={base:dist(report.runtime.map(r=>r.baseMs)),added:dist(report.runtime.map(r=>r.decisionMs)),total:dist(report.runtime.map(r=>r.baseMs+r.decisionMs))};
report.summary={stageParity:report.parity.filter(x=>x.stageEqual).length,total:report.parity.length,positionParity:report.parity.filter(x=>x.maxPositionDifferenceMm!=null&&x.maxPositionDifferenceMm<1e-6).length,stageDifferences:report.parity.filter(x=>!x.stageEqual),positionDifferences:report.parity.filter(x=>x.maxPositionDifferenceMm>1e-6),runtimeWrong:report.runtime.filter(x=>x.worstRaw>10).map(x=>({cut:x.cut,stage:x.decision.stage,worstMm:x.worstRaw,anchors:x.decision.anchorsUsed}))};
fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(label,'FINAL',JSON.stringify(report.summary),JSON.stringify(report.timing));
