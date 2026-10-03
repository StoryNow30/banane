'use strict';
// V1 measurements use only correlated SW monotonic records. Legacy D5 is
// retained by perf-lot, but is never used to fill a missing V1 marker.
const IDS=['navigation-capture','analyse-gcv1','decision-lot','pose','capture-apres-pose','validation','cut-suivant'];
const LABELS=['Navigation → capture reçue','Analyse : capture → proposition','Décision : proposition → observation','Pose : décision → relecture','Après pose : lecture state','Validation : après → acceptation locale','Passage suivant'];
const FIELDS=['pageId','part','cut','shape','frameId','projectId'];
const identityKey=x=>JSON.stringify(FIELDS.map(k=>x?.[k]??null));
const finite=Number.isFinite,at=e=>finite(e?.atMs)?e.atMs:e?.ms;
const validSpan=e=>finite(e.fromMs)&&finite(e.toMs)&&e.toMs>=e.fromMs;
function stats(values){const a=values.filter(finite).sort((a,b)=>a-b);if(!a.length)return {n:0,median:null,p90:null,max:null,total:null};
 const q=p=>a[Math.floor(p*(a.length-1)+.5)];return {n:a.length,median:q(.5),p90:q(.9),max:a.at(-1),total:a.reduce((a,b)=>a+b,0)};}
function union(intervals){const a=intervals.filter(([x,y])=>finite(x)&&finite(y)&&y>=x).sort((a,b)=>a[0]-b[0]);let sum=0,start=null,end=null;
 for(const [x,y] of a){if(start===null){start=x;end=y;}else if(x<=end)end=Math.max(end,y);else{sum+=end-start;start=x;end=y;}}return start===null?0:sum+end-start;}
function inspectVisit(events){const opens=events.filter(e=>e.kind==='visit'&&e.point==='open'),open=opens[0],ctx=events[0];
 const points=name=>events.filter(e=>e.kind==='point'&&e.point===name);
 const one=name=>{const a=points(name);return a.length===1?a[0]:null;};
 const capture=one('capture-received'),captureId=capture?.captureId;
 const point=name=>{const e=one(name);return e&&(!captureId||e.captureId===captureId)?e:null;};
 const c=point('capture-received'),p=point('proposed'),d=point('decision'),pose=point('pose-readback'),after=point('after-read'),accepted=point('accepted'),next=one('next-observed');
 const deferred=points('deferred').length>0,manual=points('manual-takeover').length>0,terminal=points('last-unvalidated').length>0,inPlace=points('in-place').length>0;
 const spans=events.filter(e=>e.kind==='span'),afterSpans=spans.filter(e=>e.label==='after-state-read');
 const phases=IDS.map((id,i)=>({id,label:LABELS[i],status:'missing',ms:null,reason:'expected-marker-absent'}));
 function measure(i,start,end){const e=phases[i];if(!finite(start)||!finite(end))return;
  if(end<start){e.status='overlap';e.reason='end-before-start';e.overlapMs=start-end;}else{e.status='measured';e.ms=end-start;e.reason=null;}}
 function na(i,reason){if(phases[i].status==='missing'){phases[i].status='inapplicable';phases[i].reason=reason;}}
 const valid=opens.length===1&&ctx?.identity?.pageId&&ctx.identity.frameId&&ctx.identity.shape&&Number.isInteger(ctx.identity.part)&&Number.isInteger(ctx.identity.cut);
 if(valid){
  measure(0,open.navigationMs,at(c));if(open.navigationMs===null&&['already-visible','recapture'].includes(open.navigationReason))na(0,open.navigationReason);
  measure(1,at(c),at(p));measure(2,at(p),at(d));measure(3,at(d),at(pose));
  if(afterSpans.length===1&&after&&afterSpans[0].captureId===after.captureId)measure(4,afterSpans[0].fromMs,afterSpans[0].toMs);
  measure(5,at(after),at(accepted));measure(6,at(accepted),at(next));
  if(deferred&&!pose)for(let i=3;i<7;i++)na(i,'deferred-without-apply');
  if(manual&&!pose)for(let i=3;i<7;i++)na(i,'manual-takeover-without-automatic-apply');
  if(terminal&&pose&&!accepted)for(let i=4;i<7;i++)na(i,'last-cut-left-unvalidated');
  if(inPlace&&!next)na(6,'validation-in-place');
 }else for(const phase of phases)phase.reason='missing-or-conflicting-visit-context';
 const a=finite(at(c))&&finite(at(p))&&at(p)>=at(c)?[at(c),at(p)]:null;
 const v46=spans.filter(s=>['v46-pair-complete','v46-scientific'].includes(s.label)&&s.analysisId&&s.analysisId===p?.analysisId);
 const invalidCalls=v46.filter(s=>!validSpan(s)).length,intervals=v46.filter(validSpan).map(s=>[s.fromMs,s.toMs]);
 const inside=a&&intervals.length&&!invalidCalls?union(intervals.map(([x,y])=>[Math.max(x,a[0]),Math.min(y,a[1])])):null;
 const total=intervals.length&&!invalidCalls?union(intervals):null;
 const cycle=valid&&finite(open.navigationMs)&&next&&at(next)>=open.navigationMs?at(next)-open.navigationMs:null;
 return {sessionId:ctx.sessionId,batchId:ctx.batchId,clockId:ctx.clockId,visitId:ctx.visitId,identity:ctx.identity,phases,
  cycleMs:cycle,activeCycleMs:finite(cycle)&&cycle<=60000?cycle:null,slowCycleMs:finite(cycle)&&cycle>60000?cycle:null,
  nextOverlapMs:phases[6].overlapMs??null,v46:{calls:v46.length,invalidCalls,unionMs:total,insideAnalysisMs:inside,
   outsideAnalysisMs:a&&total!==null?total-inside:null},validContext:!!valid};
}
function measure(data,{tous=false,batchId=data.state?.batch?.id??null,sessionId=data.state?.sessionId??data.sessionId??null}={}){
 const raw=(data.events||[]).filter(e=>e.type==='phase-timing'&&e.schema===1&&e.clockId&&e.sessionId&&e.batchId&&finite(e.ms));
 const selected=raw.filter(e=>(tous||!batchId||e.batchId===batchId)&&(!sessionId||e.sessionId===sessionId));
 if(!selected.length)return {available:false,reason:'Aucun jalon V1 corrélé ; ancien journal ou événements absents. Mesures V1 non mesurées.',lots:[],visits:[]};
 const seen=new Map(),events=[],conflicts=[];
 for(const e of selected){if(!e.eventId){events.push(e);continue;}const prev=seen.get(e.eventId);
  if(prev){if(JSON.stringify(prev)!==JSON.stringify(e))conflicts.push(e.eventId);continue;}seen.set(e.eventId,e);events.push(e);}
 const batches=new Map(),groups=new Map();
 for(const e of events){const bkey=JSON.stringify([e.sessionId,e.batchId]);if(!batches.has(bkey))batches.set(bkey,[]);batches.get(bkey).push(e);
  if(e.visitId){const vkey=JSON.stringify([e.sessionId,e.batchId,e.clockId,e.visitId,identityKey(e.identity)]);if(!groups.has(vkey))groups.set(vkey,[]);groups.get(vkey).push(e);}}
 const visits=[...groups.values()].map(inspectVisit),lots=[];
 for(const es of batches.values()){
  const first=es[0],vs=visits.filter(v=>v.sessionId===first.sessionId&&v.batchId===first.batchId),clocks=[...new Set(es.map(e=>e.clockId))];
  const start=es.filter(e=>e.kind==='batch'&&e.point==='start'&&e.knownBoundary),end=es.filter(e=>e.kind==='batch'&&e.point==='end'&&e.knownBoundary);
  const totalMs=start.length===1&&end.length===1&&start[0].clockId===end[0].clockId&&end[0].ms>=start[0].ms?end[0].ms-start[0].ms:null;
  const health=clocks.map(clock=>es.filter(e=>e.kind==='health'&&e.clockId===clock).sort((a,b)=>a.batchSeq-b.batchSeq).at(-1));
  const lost=health.reduce((n,e)=>n+(e?.lost||0),0),expectedVisits=health.every(Boolean)?health.reduce((n,e)=>n+e.visits,0):null;
  const seqGaps=clocks.reduce((n,clock)=>{const a=[...new Set(es.filter(e=>e.clockId===clock).map(e=>e.batchSeq).filter(Number.isInteger))].sort((a,b)=>a-b);
   return n+(a.length?a.at(-1)-a.length:1);},0);
  const missing=vs.flatMap(v=>v.phases.filter(p=>p.status==='missing').map(p=>({visitId:v.visitId,identity:v.identity,phase:p.id,reason:p.reason})));
  const overlap=vs.flatMap(v=>v.phases.filter(p=>p.status==='overlap').map(p=>({visitId:v.visitId,identity:v.identity,phase:p.id,overlapMs:p.overlapMs})));
  const sequence=data.state?.batch?.id===first.batchId?(data.state.batch.sequence||[]):[];
  const absentSequence=sequence.filter(s=>s.identity&&!vs.some(v=>identityKey(v.identity)===identityKey(s.identity))).map(s=>s.identity);
  const finalHealth=health.every((h,i)=>h?.finalSnapshot===true&&h.requestsPending===0&&h.batchSeq===es.reduce((max,e)=>e.clockId===clocks[i]?Math.max(max,e.batchSeq||0):max,0));
  const exportMeta=data.v1TimingExport;
  const exportTiming=exportMeta?{status:exportMeta.status,flushComplete:exportMeta.flushComplete,
   complete:exportMeta.schema===1&&exportMeta.status==='flushed'&&exportMeta.flushComplete===true&&exportMeta.pendingWrites===0&&clocks.every((clock,i)=>{
    const row=exportMeta.lots?.find(r=>r.sessionId===first.sessionId&&r.batchId===first.batchId&&r.clockId===clock);
    return row?.complete===true&&row.healthStored===true&&row.healthState==='stored'&&row.pendingWrites===0&&row.requestsPending===0&&row.lost===0&&row.healthSeq===health[i]?.batchSeq;
   })}:null;
  const scopeComplete=vs.every(v=>!!v.identity?.projectId);
  const coverage={visits:vs.length,expectedVisits,missing,overlap,lost,seqGaps,absentSequence,finalHealth,scopeComplete,exportTiming,
   complete:!!(totalMs!==null&&finalHealth&&scopeComplete&&expectedVisits===vs.length&&!missing.length&&!overlap.length&&!lost&&!seqGaps&&!absentSequence.length&&!conflicts.length&&(!exportTiming||exportTiming.complete))};
  const silences=[];
  for(const clock of clocks){const timeline=es.filter(e=>e.clockId===clock&&e.kind!=='health').map(e=>e.ms).sort((a,b)=>a-b);
   for(let i=1;i<timeline.length;i++)if(timeline[i]-timeline[i-1]>60000)silences.push({clockId:clock,fromMs:timeline[i-1],toMs:timeline[i],ms:timeline[i]-timeline[i-1]});}
  const cuts=new Set(vs.map(v=>identityKey(v.identity))),controls=es.filter(e=>e.kind==='control'),causes={operator:0,protection:0,'adapter-unresponsive':0,'esv-silent':0,guard:0,permanent:0,unknown:0};
  for(const e of controls){if(e.repeated||e.name==='pause'&&!e.wasRunning)continue;if(['halt','pause','stop'].includes(e.name))causes[e.cause in causes?e.cause:'unknown']++;}
  const stops=Object.values(causes).reduce((a,b)=>a+b,0);
  lots.push({sessionId:first.sessionId,batchId:first.batchId,clocks,coverage,totalMs,cycleMs:stats(vs.map(v=>v.activeCycleMs)),
   excludedCycles:stats(vs.map(v=>v.slowCycleMs)),silences:{count:silences.length,totalMs:silences.reduce((n,e)=>n+e.ms,0),rows:silences},
   stops:{distinctCuts:cuts.size,count:stops,per100:cuts.size?100*stops/cuts.size:null,causes,interventions:controls.map(e=>({name:e.name,cause:e.cause,ms:e.ms,clockId:e.clockId,identity:e.identity}))},
   instrumentation:{eventCount:es.length,utf8Bytes:Buffer.byteLength(JSON.stringify(es),'utf8'),lost,
    localMs:health.reduce((n,h)=>n+(h?.instrumentationMs||0),0),maxEventBytes:es.reduce((max,e)=>Math.max(max,Buffer.byteLength(JSON.stringify(e),'utf8')),0),
    asynchronousStoreCostMs:null,healthPresent:health.every(Boolean)}});
 }
 const cohort=visits.filter(v=>v.phases.every(p=>p.status==='measured')&&finite(v.activeCycleMs));
 const etapes=IDS.map((id,i)=>({id,label:LABELS[i],ms:stats(visits.map(v=>v.phases[i].ms)),
  missing:visits.filter(v=>v.phases[i].status==='missing').length,inapplicable:visits.filter(v=>v.phases[i].status==='inapplicable').length,overlap:visits.filter(v=>v.phases[i].status==='overlap').length}));
 const sumMedians=cohort.length?IDS.reduce((n,_,i)=>n+stats(cohort.map(v=>v.phases[i].ms)).median,0):null;
 const summed=stats(cohort.map(v=>v.phases.reduce((n,p)=>n+p.ms,0))),cycles=stats(cohort.map(v=>v.cycleMs));
 const v46=events.filter(e=>e.kind==='span'&&['v46-pair-complete','v46-scientific','facade-total','science-public-total','observe-lot','command-lot'].includes(e.label));
 const categories=[...new Set(v46.map(e=>e.label+':'+(e.inputKind||'unattributed')))].map(name=>{const a=v46.filter(e=>e.label+':'+(e.inputKind||'unattributed')===name);
  return {name,calls:a.length,invalid:a.filter(e=>!validSpan(e)).length,success:a.filter(e=>e.success===true).length,exceptions:a.filter(e=>e.success===false).length,ms:stats(a.filter(validSpan).map(e=>e.toMs-e.fromMs))};});
 return {available:true,quantiles:'floor(p*(n-1)+0.5)',silenceThresholdMs:60000,scopeLimited:visits.some(v=>!v.identity?.projectId),conflictingEventIds:conflicts,
  lots,visits,etapes,cohort:{n:cohort.length,sumMediansMs:sumMedians,medianSumMs:summed.median,medianCycleMs:cycles.median,
   residualMs:cohort.length?cycles.median-summed.median:null},v46:{categories,insideAnalysisMs:stats(visits.map(v=>v.v46.insideAnalysisMs)),outsideAnalysisMs:stats(visits.map(v=>v.v46.outsideAnalysisMs))}};
}
function toMarkdown(m){if(!m.available)return '\n## V1\n\n'+m.reason+'\n';const n=x=>finite(x)?String(Math.round(x*100)/100):'non mesuré';
 const lines=['','## V1 — horloge SW et visites corrélées','',m.scopeLimited?'Projet absent sur certaines visites : portée limitée.':'Projet identifié.','',
  '| Phase | n | Médiane ms | P90 ms | Max ms | Manquantes | Inapplicables | Chevauchements |','|---|---:|---:|---:|---:|---:|---:|---:|'];
 for(const p of m.etapes)lines.push(`| ${p.label} | ${p.ms.n} | ${n(p.ms.median)} | ${n(p.ms.p90)} | ${n(p.ms.max)} | ${p.missing} | ${p.inapplicable} | ${p.overlap} |`);
 for(const l of m.lots){lines.push('',`Lot ${l.batchId} / session ${l.sessionId} : ${l.coverage.visits} visites ; attendues ${n(l.coverage.expectedVisits)} ; ${l.coverage.missing.length} phases manquantes, ${l.coverage.overlap.length} chevauchements, ${l.coverage.lost} événements perdus. Couverture complète démontrée : ${l.coverage.complete?'oui':'non'}.`,
  `Durée totale : ${n(l.totalMs)} ms ; cycle actif n=${l.cycleMs.n}, médiane/P90/max ${n(l.cycleMs.median)}/${n(l.cycleMs.p90)}/${n(l.cycleMs.max)} ms. Cycles >60 s exclus : ${l.excludedCycles.n}, total ${n(l.excludedCycles.total)} ms ; silences : ${l.silences.count}, ${n(l.silences.totalMs)} ms.`,
  `Arrêts : ${l.stops.count} / ${l.stops.distinctCuts} coupes distinctes = ${n(l.stops.per100)} pour 100 ; causes ${JSON.stringify(l.stops.causes)}.`,
  `Instrumentation : ${l.instrumentation.eventCount} événements, ${l.instrumentation.utf8Bytes} octets UTF-8, coût local ${n(l.instrumentation.localMs)} ms ; stockage asynchrone non isolé.`);}
 lines.push('',`Même cohorte de sept phases mesurées : n=${m.cohort.n} ; somme des médianes ${n(m.cohort.sumMediansMs)} ms ; médiane des sommes ${n(m.cohort.medianSumMs)} ms ; cycle médian ${n(m.cohort.medianCycleMs)} ms ; résidu ${n(m.cohort.residualMs)} ms.`,
  '','V4.6 : spans imbriqués ; union temporelle, jamais ajoutés une seconde fois au cycle.','', '| Catégorie | Appels | Invalides | Succès | Exceptions | Médiane ms | P90 ms | Max ms |','|---|---:|---:|---:|---:|---:|---:|---:|---:|');
 for(const c of m.v46.categories)lines.push(`| ${c.name} | ${c.calls} | ${c.invalid} | ${c.success} | ${c.exceptions} | ${n(c.ms.median)} | ${n(c.ms.p90)} | ${n(c.ms.max)} |`);
 lines.push('','Les mesures de ce fichier ne certifient pas la porte terrain sur plusieurs lots, ni un acquittement serveur.');return lines.join('\n')+'\n';
}
module.exports={measure,toMarkdown,inspectVisit,stats,union,IDS};
