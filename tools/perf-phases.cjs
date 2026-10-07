'use strict';
/* V1 — analyse des jalons `phase-timing` (schéma 1) d'un export Ariane.
 *
 * Seuls des jalons corrélés comptent : même session, même lot, même horloge du
 * service worker, même visite et même identité de coupe. L'ancienne mesure D5
 * (perf-lot) n'est jamais utilisée pour combler un jalon V1 absent. Une durée
 * non calculable reste `null` (« non mesuré ») : jamais zéro, jamais devinée.
 *
 * Étapes : sélection et dédoublonnage → regroupement par lot et par visite →
 * phases d'une visite → bilan d'un lot (couverture, santé, silences, arrêts,
 * instrumentation) → bilan d'ensemble (étapes, cohorte, V4.6).
 */
const PHASES=[
 ['navigation-capture','Navigation → capture reçue'],
 ['analyse-gcv1','Analyse : capture → proposition'],
 ['decision-lot','Décision : proposition → observation'],
 ['pose','Pose : décision → relecture'],
 ['capture-apres-pose','Après pose : lecture state'],
 ['validation','Validation : après → acceptation locale'],
 ['cut-suivant','Passage suivant'],
];
const IDS=PHASES.map(([id])=>id);
const SILENCE_MS=60000,ACTIVE_CYCLE_MS=60000;
const V46_CALLS=['v46-pair-complete','v46-scientific'];
const V46_CATEGORIES=[...V46_CALLS,'facade-total','science-public-total','observe-lot','command-lot'];
const STOP_NAMES=['halt','pause','stop'];
const FIELDS=['pageId','part','cut','shape','frameId','projectId'];

/* ---------------------------------------------------------------- outils */
const identityKey=x=>JSON.stringify(FIELDS.map(k=>x?.[k]??null));
const finite=Number.isFinite;
/* Instant d'un jalon : `atMs` (réception de la commande) sinon `ms` (émission). */
const at=e=>finite(e?.atMs)?e.atMs:e?.ms;
const validSpan=e=>finite(e.fromMs)&&finite(e.toMs)&&e.toMs>=e.fromMs;
const bytes=x=>Buffer.byteLength(JSON.stringify(x),'utf8');
function groupBy(items,keyOf){const groups=new Map();
 for(const item of items){const k=keyOf(item);let g=groups.get(k);if(!g)groups.set(k,g=[]);g.push(item);}return groups;}
/* Quantile au rang le plus proche : floor(p*(n-1)+0.5). */
function stats(values){const a=values.filter(finite).sort((a,b)=>a-b);if(!a.length)return {n:0,median:null,p90:null,max:null,total:null};
 const q=p=>a[Math.floor(p*(a.length-1)+.5)];return {n:a.length,median:q(.5),p90:q(.9),max:a.at(-1),total:a.reduce((a,b)=>a+b,0)};}
/* Durée couverte par des intervalles (temps commun compté une fois). */
function union(intervals){const a=intervals.filter(([x,y])=>finite(x)&&finite(y)&&y>=x).sort((a,b)=>a[0]-b[0]);let sum=0,start=null,end=null;
 for(const [x,y] of a){if(start===null){start=x;end=y;}else if(x<=end)end=Math.max(end,y);else{sum+=end-start;start=x;end=y;}}
 return start===null?0:sum+end-start;}

/* ------------------------------------------------------- phases d'une visite */
function inspectVisit(events){
 const ctx=events[0],opens=events.filter(e=>e.kind==='visit'&&e.point==='open'),open=opens[0];
 const points=name=>events.filter(e=>e.kind==='point'&&e.point===name);
 const one=name=>{const a=points(name);return a.length===1?a[0]:null;};
 // Un jalon dupliqué n'est pas choisi ; une autre capture que celle reçue non plus.
 const captureId=one('capture-received')?.captureId;
 const point=name=>{const e=one(name);return e&&(!captureId||e.captureId===captureId)?e:null;};
 const c=point('capture-received'),p=point('proposed'),d=point('decision'),pose=point('pose-readback'),after=point('after-read'),accepted=point('accepted'),next=one('next-observed');
 const has=name=>points(name).length>0;
 const deferred=has('deferred'),manual=has('manual-takeover'),terminal=has('last-unvalidated'),inPlace=has('in-place');
 const spans=events.filter(e=>e.kind==='span'),afterSpans=spans.filter(e=>e.label==='after-state-read');
 const phases=PHASES.map(([id,label])=>({id,label,status:'missing',ms:null,reason:'expected-marker-absent'}));
 /* Bornes propres ; fin avant début = chevauchement publié, jamais une durée. */
 function measure(i,start,end){const e=phases[i];if(!finite(start)||!finite(end))return;
  e.startMs=start;e.endMs=end;
  if(end<start){e.status='overlap';e.reason='end-before-start';e.overlapMs=start-end;}else{e.status='measured';e.ms=end-start;e.reason=null;}}
 function inapplicable(from,to,reason){for(let i=from;i<=to;i++)if(phases[i].status==='missing'){phases[i].status='inapplicable';phases[i].reason=reason;}}
 const id=ctx?.identity;
 const valid=opens.length===1&&id?.pageId&&id.frameId&&id.shape&&Number.isInteger(id.part)&&Number.isInteger(id.cut);
 if(valid){
  measure(0,open.navigationMs,at(c));
  if(open.navigationMs===null&&['already-visible','recapture'].includes(open.navigationReason))inapplicable(0,0,open.navigationReason);
  measure(1,at(c),at(p));measure(2,at(p),at(d));measure(3,at(d),at(pose));
  if(afterSpans.length===1&&after&&afterSpans[0].captureId===after.captureId)measure(4,afterSpans[0].fromMs,afterSpans[0].toMs);
  measure(5,at(after),at(accepted));measure(6,at(accepted),at(next));
  if(deferred&&!pose)inapplicable(3,6,'deferred-without-apply');
  if(manual&&!pose)inapplicable(3,6,'manual-takeover-without-automatic-apply');
  if(terminal&&pose&&!accepted)inapplicable(4,6,'last-cut-left-unvalidated');
  if(inPlace&&!next)inapplicable(6,6,'validation-in-place');
 }else for(const phase of phases)phase.reason='missing-or-conflicting-visit-context';
 const cycle=valid&&finite(open.navigationMs)&&next&&at(next)>=open.navigationMs?at(next)-open.navigationMs:null;
 const out={sessionId:ctx.sessionId,batchId:ctx.batchId,clockId:ctx.clockId,visitId:ctx.visitId,identity:ctx.identity,phases,
  cycleMs:cycle,activeCycleMs:finite(cycle)&&cycle<=ACTIVE_CYCLE_MS?cycle:null,slowCycleMs:finite(cycle)&&cycle>ACTIVE_CYCLE_MS?cycle:null,
  nextOverlapMs:phases[6].overlapMs??null,v46:v46OfVisit(spans,c,p),validContext:!!valid,
  chronology:null,attribution:null};
 if(valid){const x={c,p,d,pose,after,accepted,next,extra:points('capture-stored').concat(points('after-stored'))};
  out.chronology=chronologyOf(open,x);
  out.attribution=attributionOf(open,phases,spans,out.chronology,{accepted:!!accepted,deferred,manual,inPlace,pose:!!pose});}
 else out.attribution={status:'non mesuré',reason:'missing-or-conflicting-visit-context',outcome:null,cycleMs:null,attributedMs:null,unexplainedMs:null};
 return out;
}
/* Correction proposée (2) : chronologie concurrente (D-073). Jalons dans
 * l'ordre réel ; décalage signé navigation suivante − acceptation durable
 * (négatif : la navigation arrive d'abord) ; fin de visite : fenêtres
 * après → acceptation et après → navigation, réunies (union) et communes
 * (intersection), jamais additionnées. Un jalon absent laisse null.
 * Un ordre impossible (ex. acceptation avant la lecture après pose, horloge
 * non monotone) est une anomalie publiée : la visite sort des statistiques de
 * signe et de l'attribution du temps. */
const span=(a,b)=>finite(a)&&finite(b)&&b>=a?[a,b]:null;
const length=w=>w?w[1]-w[0]:null;
/* Rang attendu : `accepted` et `next-observed` partagent le rang 6 (l'un ou l'autre d'abord est permis). */
const RANK={navigation:0,'capture-received':1,proposed:2,decision:3,'pose-readback':4,'after-read':5,accepted:6,'next-observed':6};
function anomaliesOf(pairs){const p=pairs.filter(([,v])=>finite(v)),out=[];
 for(const [a,x] of p)for(const [b,y] of p)if(RANK[a]<RANK[b]&&y<x)out.push({before:a,after:b,byMs:x-y});
 return out;}
function chronologyOf(open,x){
 const nav=open.navigationMs,after=at(x.after),accepted=at(x.accepted),next=at(x.next);
 const core=[['navigation',nav],['capture-received',at(x.c)],['proposed',at(x.p)],['decision',at(x.d)],['pose-readback',at(x.pose)],['after-read',after],['accepted',accepted],['next-observed',next]];
 // Jalons annexes (capture-stored, after-stored) : listés, hors contrôle d'ordre.
 const extra=(x.extra||[]).map(e=>[e.point,at(e)]);
 const milestones=core.concat(extra).filter(([,ms])=>finite(ms)).map(([point,ms])=>({point,ms,relMs:finite(nav)?ms-nav:null})).sort((a,b)=>a.ms-b.ms);
 const anomalies=anomaliesOf(core);
 const toAccepted=span(after,accepted),toNext=span(after,next),both=toAccepted&&toNext;
 return {milestones,anomalies,coherent:!anomalies.length,nextMinusAcceptedMs:finite(accepted)&&finite(next)?next-accepted:null,untilNextMs:length(span(nav,next)),untilAcceptedMs:length(span(nav,accepted)),
  end:{from:'after-read',acceptanceMs:length(toAccepted),navigationMs:length(toNext),unionMs:both?union([toAccepted,toNext]):null,
   intersectionMs:both?Math.max(0,Math.min(toAccepted[1],toNext[1])-Math.max(toAccepted[0],toNext[0])):null}};
}
/* Correction proposée (2), D-073 « chaque seconde » : le cycle [navigation,
 * navigation suivante] est découpé en segments ; chaque segment appartient à la
 * première étape qui le couvre (sept phases dans l'ordre, puis spans annexes :
 * after-state-read non retenu comme phase, command:*, analysis-envelope…) ou,
 * faute d'étape, au reste « non expliqué ». Attribué + non expliqué = cycle
 * (vérifié à part par somme des trous). Le temps des phases au-delà de la
 * navigation suivante n'est pas du temps du cycle : publié à part. Durée du
 * cycle inconnue, ordre impossible ou contexte invalide : « non mesuré ». */
const STAGE_IDS=[...IDS,'annexes'];
function attributionOf(open,phases,spans,chrono,flags){
 const outcome=flags.accepted?'validée':flags.inPlace&&!flags.pose&&!flags.accepted?'sur place':flags.deferred&&!flags.pose?'reportée sans pose':flags.manual?'reprise manuelle':'autre';
 const base={outcome,cycleMs:null,attributedMs:null,unexplainedMs:null};
 const nav=open.navigationMs,next=chrono.milestones.find(m=>m.point==='next-observed')?.ms;
 if(!chrono.coherent)return {...base,status:'ordre impossible',reason:chrono.anomalies.map(a=>`${a.before}>${a.after}`).join(','),anomalies:chrono.anomalies};
 if(!finite(nav)||!finite(next)||next<nav)return {...base,status:'non mesuré',reason:!finite(nav)?'navigation-absente':!finite(next)?'navigation-suivante-absente':'navigation-suivante-avant-navigation'};
 const lo=nav,hi=next,clip=([x,y])=>[Math.max(x,lo),Math.min(y,hi)];
 const raw=phases.map(p=>p.status==='measured'&&finite(p.startMs)&&finite(p.endMs)?[p.startMs,p.endMs]:null);
 const annex=spans.filter(s=>validSpan(s)&&!(s.label==='after-state-read'&&raw[4])).map(s=>({label:s.label,iv:[s.fromMs,s.toMs]}));
 const stages=[...raw,...annex.map(a=>a.iv)],owner=[...raw.map((_,i)=>i),...annex.map(()=>7)];
 const clipped=stages.map(iv=>iv&&clip(iv)).map(iv=>iv&&iv[1]>iv[0]?iv:null);
 const cuts=[...new Set([lo,hi,...clipped.flatMap(iv=>iv||[])])].sort((a,b)=>a-b),owned=new Array(8).fill(0),gaps=[];
 for(let i=1;i<cuts.length;i++){const a=cuts[i-1],b=cuts[i],k=clipped.findIndex(iv=>iv&&iv[0]<=a&&iv[1]>=b);
  if(k>=0)owned[owner[k]]+=b-a;else if(gaps.length&&gaps.at(-1).toMs===a)gaps.at(-1).toMs=b;else gaps.push({fromMs:a,toMs:b});}
 // Bornes nommées : jalons du cycle et bords des spans (début / fin), pour dire où est le trou.
 const edges=chrono.milestones.filter(m=>m.point in RANK).map(m=>({point:m.point,ms:m.ms}))
  .concat(annex.flatMap(a=>[{point:'début '+a.label,ms:a.iv[0]},{point:'fin '+a.label,ms:a.iv[1]}]),raw[4]?[{point:'début after-state-read',ms:raw[4][0]},{point:'fin after-state-read',ms:raw[4][1]}]:[])
  .sort((a,b)=>a.ms-b.ms);
 for(const g of gaps){g.ms=g.toMs-g.fromMs;g.relFromMs=g.fromMs-nav;g.after=edges.filter(m=>m.ms<=g.fromMs).at(-1)?.point??'navigation';g.before=edges.find(m=>m.ms>=g.toMs)?.point??'next-observed';}
 const cycle=hi-lo,unexplained=gaps.reduce((n,g)=>n+g.ms,0),attributed=owned.reduce((n,x)=>n+x,0);
 const ph=clipped.slice(0,7).filter(Boolean),sumClipped=ph.reduce((n,iv)=>n+iv[1]-iv[0],0);
 const beyond=raw.filter(Boolean).reduce((n,iv)=>n+(iv[1]-iv[0])-(()=>{const c=clip(iv);return c[1]>c[0]?c[1]-c[0]:0;})(),0);
 return {...base,status:'mesurée',reason:null,cycleMs:cycle,attributedMs:attributed,unexplainedMs:unexplained,reconciled:Math.abs(attributed+unexplained-cycle)<1e-3,
  ownedMs:Object.fromEntries(STAGE_IDS.map((id,i)=>[id,owned[i]])),gaps,phaseOverlapMs:sumClipped-union(ph),beyondCycleMs:beyond,annexLabels:[...new Set(annex.map(a=>a.label))].sort()};
}
/* Appels V4.6 de l'analyse de la visite : spans imbriqués réunis en temps
 * (union), découpés à la fenêtre capture → proposition ; jamais additionnés. */
function v46OfVisit(spans,c,p){
 const window=finite(at(c))&&finite(at(p))&&at(p)>=at(c)?[at(c),at(p)]:null;
 const calls=spans.filter(s=>V46_CALLS.includes(s.label)&&s.analysisId&&s.analysisId===p?.analysisId);
 const invalidCalls=calls.filter(s=>!validSpan(s)).length,intervals=calls.filter(validSpan).map(s=>[s.fromMs,s.toMs]);
 const usable=intervals.length&&!invalidCalls;
 const inside=window&&usable?union(intervals.map(([x,y])=>[Math.max(x,window[0]),Math.min(y,window[1])])):null;
 const total=usable?union(intervals):null;
 return {calls:calls.length,invalidCalls,unionMs:total,insideAnalysisMs:inside,outsideAnalysisMs:window&&total!==null?total-inside:null};
}

/* --------------------------------------------------------- bilan d'un lot */
function inspectLot(es,vs,data,exportMeta,conflicts){
 const first=es[0],byClock=groupBy(es,e=>e.clockId),clocks=[...byClock.keys()];
 const boundary=point=>es.filter(e=>e.kind==='batch'&&e.point===point&&e.knownBoundary);
 const start=boundary('start'),end=boundary('end');
 const totalMs=start.length===1&&end.length===1&&start[0].clockId===end[0].clockId&&end[0].ms>=start[0].ms?end[0].ms-start[0].ms:null;
 // Dernière santé de chaque horloge.
 const health=clocks.map(clock=>byClock.get(clock).filter(e=>e.kind==='health').sort((a,b)=>a.batchSeq-b.batchSeq).at(-1));
 const lost=health.reduce((n,e)=>n+(e?.lost||0),0),expectedVisits=health.every(Boolean)?health.reduce((n,e)=>n+e.visits,0):null;
 const seqGaps=clocks.reduce((n,clock)=>{const a=[...new Set(byClock.get(clock).map(e=>e.batchSeq).filter(Number.isInteger))].sort((a,b)=>a-b);
  return n+(a.length?a.at(-1)-a.length:1);},0);
 const missing=vs.flatMap(v=>v.phases.filter(p=>p.status==='missing').map(p=>({visitId:v.visitId,identity:v.identity,phase:p.id,reason:p.reason})));
 const overlap=vs.flatMap(v=>v.phases.filter(p=>p.status==='overlap').map(p=>({visitId:v.visitId,identity:v.identity,phase:p.id,overlapMs:p.overlapMs})));
 const sequence=data.state?.batch?.id===first.batchId?(data.state.batch.sequence||[]):[];
 const visited=new Set(vs.map(v=>identityKey(v.identity)));
 const absentSequence=sequence.filter(s=>s.identity&&!visited.has(identityKey(s.identity))).map(s=>s.identity);
 // Santé finale : instantané final, aucune commande en cours, dernier numéro de l'horloge.
 const finalHealth=health.every((h,i)=>h?.finalSnapshot===true&&h.requestsPending===0&&h.batchSeq===byClock.get(clocks[i]).reduce((max,e)=>Math.max(max,e.batchSeq||0),0));
 const exportTiming=exportMeta?{status:exportMeta.status,flushComplete:exportMeta.flushComplete,
  complete:exportMeta.schema===1&&exportMeta.status==='flushed'&&exportMeta.flushComplete===true&&exportMeta.pendingWrites===0&&clocks.every((clock,i)=>{
   const row=exportMeta.lots?.find(r=>r.sessionId===first.sessionId&&r.batchId===first.batchId&&r.clockId===clock);
   return row?.complete===true&&row.healthStored===true&&row.healthState==='stored'&&row.pendingWrites===0&&row.requestsPending===0&&row.lost===0&&row.healthSeq===health[i]?.batchSeq;
  })}:null;
 const scopeComplete=vs.every(v=>!!v.identity?.projectId);
 const coverage={visits:vs.length,expectedVisits,missing,overlap,lost,seqGaps,absentSequence,finalHealth,scopeComplete,exportTiming,
  complete:!!(totalMs!==null&&finalHealth&&scopeComplete&&expectedVisits===vs.length&&!missing.length&&!overlap.length&&!lost&&!seqGaps&&!absentSequence.length&&!conflicts.length&&(!exportTiming||exportTiming.complete))};
 // Silences : écart strict > 60 s entre deux jalons de la même horloge (santés exclues).
 const silences=[];
 for(const clock of clocks){const timeline=byClock.get(clock).filter(e=>e.kind!=='health').map(e=>e.ms).sort((a,b)=>a-b);
  for(let i=1;i<timeline.length;i++)if(timeline[i]-timeline[i-1]>SILENCE_MS)silences.push({clockId:clock,fromMs:timeline[i-1],toMs:timeline[i],ms:timeline[i]-timeline[i-1]});}
 const sizes=es.map(bytes);
 return {sessionId:first.sessionId,batchId:first.batchId,clocks,coverage,totalMs,cycleMs:stats(vs.map(v=>v.activeCycleMs)),
  excludedCycles:stats(vs.map(v=>v.slowCycleMs)),silences:{count:silences.length,totalMs:silences.reduce((n,e)=>n+e.ms,0),rows:silences},
  stops:stopsOf(es,vs),executions:executionsOf(es,vs),attribution:attributionTotals(vs),
  instrumentation:{eventCount:es.length,utf8Bytes:sizes.reduce((n,x)=>n+x,0)+Math.max(0,es.length-1)+2,lost,  // = octets de JSON.stringify(es)
   localMs:health.reduce((n,h)=>n+(h?.instrumentationMs||0),0),maxEventBytes:sizes.reduce((max,x)=>Math.max(max,x),0),
   asynchronousStoreCostMs:null,healthPresent:health.every(Boolean)}};
}
/* Correction proposée (3) : exécutions successives d'un même lot. Ouvrent :
 * start, restored, reopened, resumed. Ferment : end (fin connue), suspended
 * (ERROR, fin inconnue) ; journaux antérieurs sans « suspended » : un arrêt
 * `halt` en ERROR en tient lieu. `replaced` dit seulement que le suivi a changé
 * de lot. Aucune fin n'est inventée : une exécution sans borne reste ouverte et
 * la vie complète du lot n'est mesurée que si la dernière fin est connue. */
const OPENS=['start','restored','reopened','resumed'];
function executionsOf(es,vs){
 const clocks=[...new Set(es.map(e=>e.clockId))],order=e=>[clocks.indexOf(e.clockId),Number.isInteger(e.batchSeq)?e.batchSeq:e.ms];
 const sorted=es.slice().sort((a,b)=>{const x=order(a),y=order(b);return x[0]-y[0]||x[1]-y[1];});
 const explicit=sorted.some(e=>e.kind==='batch'&&e.point==='suspended');
 const rows=[];let cur=null,replaced=null;
 const mark=e=>({point:e.kind==='control'?'halt':e.point,ms:e.ms,clockId:e.clockId,...(e.state!==undefined?{state:e.state}:{}),knownBoundary:e.kind==='batch'&&e.point==='end'&&e.knownBoundary===true});
 for(const e of sorted){
  if(e.kind==='batch'&&OPENS.includes(e.point)){cur={segment:Number.isInteger(e.segment)?e.segment:rows.length+1,from:{point:e.point,ms:e.ms,clockId:e.clockId},to:null,durationMs:null};rows.push(cur);continue;}
  if(e.kind==='batch'&&e.point==='replaced'){replaced={ms:e.ms,clockId:e.clockId,byBatchId:e.byBatchId??null,lastState:e.lastState??null,closedAtReplacement:e.closedAtReplacement??null};continue;}
  const closes=e.kind==='batch'&&(e.point==='end'||e.point==='suspended')||!explicit&&e.kind==='control'&&e.name==='halt'&&e.state==='ERROR';
  if(!closes)continue;
  if(!cur||cur.to){cur={segment:rows.length+1,from:null,to:null,durationMs:null};rows.push(cur);}
  cur.to=mark(e);if(cur.from&&cur.from.clockId===e.clockId&&e.ms>=cur.from.ms)cur.durationMs=e.ms-cur.from.ms;
 }
 const last=rows.at(-1),sameClock=rows.every(r=>r.from&&r.to&&r.from.clockId===rows[0].from.clockId&&r.to.clockId===rows[0].from.clockId);
 const lifetimeReason=!rows.length?'no-boundary':rows.some(r=>!r.from)?'start-unknown':!last.to||last.to.point!=='end'||!last.to.knownBoundary?'end-unknown':!sameClock?'clock-changed':null;
 const lifetimeMs=lifetimeReason===null&&last.to.ms>=rows[0].from.ms?last.to.ms-rows[0].from.ms:null;
 const executionMs=lifetimeMs!==null&&rows.every(r=>finite(r.durationMs))?rows.reduce((n,r)=>n+r.durationMs,0):null;
 // Visites ouvertes hors d'une exécution : gardées dans la couverture, seulement nommées.
 const opens=new Map(es.filter(e=>e.kind==='visit'&&e.point==='open').map(e=>[e.visitId,e]));
 const inside=e=>rows.some(r=>r.from&&r.from.clockId===e.clockId&&e.ms>=r.from.ms&&(!r.to||e.ms<=r.to.ms));
 const visitsOutsideExecution=vs.flatMap(v=>{const o=opens.get(v.visitId);if(!o)return [];
  const reason=o.lotSuspended?'lot-suspended':rows.length&&!inside(o)?'between-executions':null;return reason?[{visitId:v.visitId,identity:v.identity,reason}]:[];});
 return {rows:rows.map(({segment,from,to,durationMs})=>({segment,from,to,durationMs})),replaced,lifetimeMs,lifetimeReason,executionMs,visitsOutsideExecution};
}
/* Arrêts pour 100 coupes distinctes : une interruption répétée ou une pause
 * hors exécution ne compte pas deux fois. */
function stopsOf(es,vs){
 const cuts=new Set(vs.map(v=>identityKey(v.identity))),controls=es.filter(e=>e.kind==='control');
 const causes={operator:0,protection:0,'adapter-unresponsive':0,'esv-silent':0,guard:0,permanent:0,unknown:0};
 for(const e of controls){if(e.repeated||e.name==='pause'&&!e.wasRunning)continue;if(STOP_NAMES.includes(e.name))causes[e.cause in causes?e.cause:'unknown']++;}
 const count=Object.values(causes).reduce((a,b)=>a+b,0);
 return {distinctCuts:cuts.size,count,per100:cuts.size?100*count/cuts.size:null,causes,
  interventions:controls.map(e=>({name:e.name,cause:e.cause,ms:e.ms,clockId:e.clockId,identity:e.identity}))};
}

/* --------------------------------------------------------- dictionnaires */
/* Les bilans v4 rangent identités, rails… dans `dictionaries` et les référencent
 * par {"__ref":"identities:N"}. Développe ces références (copie) ; une référence
 * sans entrée est comptée et laissée telle quelle : l'identité reste alors
 * incertaine et la visite est signalée « contexte invalide », jamais devinée. */
function resolveRefs(value,dictionaries){
 const stat={resolved:0,unresolved:0},cache=new Map();
 const walk=(v,depth)=>{
  if(Array.isArray(v))return v.map(x=>walk(x,depth));
  if(v&&typeof v==='object'){
   if(typeof v.__ref==='string'&&Object.keys(v).length===1){
    const [name,i]=v.__ref.split(':'),table=dictionaries?.[name],entry=table?.[Number(i)];
    if(entry===undefined||depth>8){stat.unresolved++;return v;}
    if(!cache.has(v.__ref))cache.set(v.__ref,walk(entry,depth+1));stat.resolved++;return cache.get(v.__ref);}
   const o={};for(const k of Object.keys(v))o[k]=walk(v[k],depth);return o;}
  return v;};
 return {value:walk(value,0),stat};
}

/* --------------------------------------------------------- sélection */
function select(data,{tous,batchId,sessionId}){
 const raw=(data.events||[]).filter(e=>e.type==='phase-timing'&&e.schema===1&&e.clockId&&e.sessionId&&e.batchId&&finite(e.ms));
 const selected=raw.filter(e=>(tous||!batchId||e.batchId===batchId)&&(!sessionId||e.sessionId===sessionId));
 // Doublon identique écarté ; même identifiant au contenu différent = conflit publié.
 const seen=new Map(),events=[],conflicts=[];
 for(const e of selected){if(!e.eventId){events.push(e);continue;}const prev=seen.get(e.eventId);
  if(prev){if(JSON.stringify(prev)!==JSON.stringify(e))conflicts.push(e.eventId);continue;}seen.set(e.eventId,e);events.push(e);}
 return {events,conflicts};
}

/* --------------------------------------------------------- bilan d'ensemble */
function measure(data,{tous=false,batchId=data.state?.batch?.id??null,sessionId=data.state?.sessionId??data.sessionId??null}={}){
 let refs={resolved:0,unresolved:0};
 if(data.dictionaries){const pt=(data.events||[]).filter(e=>e?.type==='phase-timing');
  if(JSON.stringify(pt).includes('"__ref"')){const r=resolveRefs(pt,data.dictionaries);refs=r.stat;data={...data,events:r.value};}}
 const {events,conflicts}=select(data,{tous,batchId,sessionId});
 if(!events.length)return {available:false,reason:'Aucun jalon V1 corrélé ; ancien journal ou événements absents. Mesures V1 non mesurées.',lots:[],visits:[]};
 const lotKey=x=>JSON.stringify([x.sessionId,x.batchId]);
 const groups=groupBy(events.filter(e=>e.visitId),e=>JSON.stringify([e.sessionId,e.batchId,e.clockId,e.visitId,identityKey(e.identity)]));
 const visits=[...groups.values()].map(inspectVisit),visitsByLot=groupBy(visits,lotKey);
 const lots=[...groupBy(events,lotKey)].map(([k,es])=>inspectLot(es,visitsByLot.get(k)||[],data,data.v1TimingExport,conflicts));
 // Même cohorte : sept phases mesurées et cycle actif ; les médianes ne s'additionnent pas.
 const cohort=visits.filter(v=>v.phases.every(p=>p.status==='measured')&&finite(v.activeCycleMs));
 const count=(i,status)=>visits.filter(v=>v.phases[i].status===status).length;
 const etapes=PHASES.map(([id,label],i)=>({id,label,ms:stats(visits.map(v=>v.phases[i].ms)),missing:count(i,'missing'),inapplicable:count(i,'inapplicable'),overlap:count(i,'overlap')}));
 const sumMedians=cohort.length?IDS.reduce((n,_,i)=>n+stats(cohort.map(v=>v.phases[i].ms)).median,0):null;
 const summed=stats(cohort.map(v=>v.phases.reduce((n,p)=>n+p.ms,0))),cycles=stats(cohort.map(v=>v.cycleMs));
 return {available:true,quantiles:'floor(p*(n-1)+0.5)',silenceThresholdMs:SILENCE_MS,scopeLimited:visits.some(v=>!v.identity?.projectId),conflictingEventIds:conflicts,
  lots,visits,etapes,cohort:{n:cohort.length,sumMediansMs:sumMedians,medianSumMs:summed.median,medianCycleMs:cycles.median,
   residualMs:cohort.length?cycles.median-summed.median:null},
  refs,concurrence:concurrenceOf(visits),attribution:attributionTotals(visits),coupes:visits.map(v=>({...coupeRow(v),
   execution:lots.flatMap(l=>l.executions.visitsOutsideExecution).find(o=>o.visitId===v.visitId)?.reason??null})),
  v46:{categories:v46Categories(events),insideAnalysisMs:stats(visits.map(v=>v.v46.insideAnalysisMs)),outsideAnalysisMs:stats(visits.map(v=>v.v46.outsideAnalysisMs))}};
}
/* Correction proposée (2) : synthèse de la chronologie concurrente. Les
 * médianes de lignes différentes ne s'additionnent pas. */
function concurrenceOf(visits){const all=visits.map(v=>v.chronology).filter(Boolean),c=all.filter(x=>x.coherent),both=c.filter(x=>finite(x.nextMinusAcceptedMs));
 const bad=visits.filter(v=>v.chronology&&!v.chronology.coherent);
 return {visits:both.length,navigationBeforeAcceptance:both.filter(x=>x.nextMinusAcceptedMs<0).length,signedDeltaMs:stats(both.map(x=>x.nextMinusAcceptedMs)),
  untilNextMs:stats(c.map(x=>x.untilNextMs)),untilAcceptedMs:stats(c.map(x=>x.untilAcceptedMs)),endUnionMs:stats(c.map(x=>x.end.unionMs)),endIntersectionMs:stats(c.map(x=>x.end.intersectionMs)),
  anomalies:{visits:bad.length,rows:bad.map(v=>({batchId:v.batchId,part:v.identity?.part??null,cut:v.identity?.cut??null,visitId:v.visitId,anomalies:v.chronology.anomalies}))}};}
/* Bilan du temps attribué (D-073) d'un ensemble de visites : le total n'additionne
 * que des cycles mesurés ; un cycle non mesuré est compté à part, jamais à zéro. */
function attributionTotals(visits){
 const a=visits.map(v=>v.attribution).filter(Boolean),m=a.filter(x=>x.status==='mesurée');
 const sum=(list,k)=>list.reduce((n,x)=>n+x[k],0),part=(u,c)=>c>0?u/c:null;
 const group=list=>({cycles:list.length,cycleMs:sum(list,'cycleMs'),attributedMs:sum(list,'attributedMs'),unexplainedMs:sum(list,'unexplainedMs'),
  unexplainedShare:part(sum(list,'unexplainedMs'),sum(list,'cycleMs')),phaseOverlapMs:sum(list,'phaseOverlapMs'),beyondCycleMs:sum(list,'beyondCycleMs')});
 const byOutcome={};for(const o of [...new Set(m.map(x=>x.outcome))].sort())byOutcome[o]=group(m.filter(x=>x.outcome===o));
 const stages=Object.fromEntries(STAGE_IDS.map(id=>[id,sum(m.map(x=>x.ownedMs),id)]));
 const gapKinds=new Map();for(const x of m)for(const g of x.gaps){const k=g.after+' → '+g.before,e=gapKinds.get(k)||{between:k,count:0,ms:0};e.count++;e.ms+=g.ms;gapKinds.set(k,e);}
 return {visits:a.length,measuredCycles:m.length,notMeasured:a.filter(x=>x.status==='non mesuré').length,impossibleOrder:a.filter(x=>x.status==='ordre impossible').length,
  notReconciled:m.filter(x=>!x.reconciled).length,...group(m),ownedMsByStage:stages,byOutcome,gaps:[...gapKinds.values()].sort((x,y)=>y.ms-x.ms)};
}
/* Une ligne par coupe visitée : jalons triés, durées par étape (propres, sans double compte),
 * chevauchements, reste non expliqué. */
function coupeRow(v){const c=v.chronology,a=v.attribution;
 return {batchId:v.batchId,visitId:v.visitId,part:v.identity?.part??null,cut:v.identity?.cut??null,shape:v.identity?.shape??null,
  outcome:a?.outcome??null,status:a?.status??'non mesuré',reason:a?.reason??null,cycleMs:a?.cycleMs??null,
  milestones:c?c.milestones:null,anomalies:c?c.anomalies:null,
  phaseMs:Object.fromEntries(v.phases.map(p=>[p.id,p.status==='measured'?p.ms:null])),phaseStatus:Object.fromEntries(v.phases.map(p=>[p.id,p.status])),
  ownedMs:a?.ownedMs??null,attributedMs:a?.attributedMs??null,unexplainedMs:a?.unexplainedMs??null,gaps:a?.gaps??null,
  overlap:c&&a?{nextMinusAcceptedMs:c.nextMinusAcceptedMs,phaseOverlapMs:a.phaseOverlapMs??null,beyondCycleMs:a.beyondCycleMs??null,endUnionMs:c.end.unionMs,endIntersectionMs:c.end.intersectionMs}:null,
  annexLabels:a?.annexLabels??null};}
/* Appels par catégorie « libellé:provenance » ; durée seulement si le span est valide. */
function v46Categories(events){
 const spans=events.filter(e=>e.kind==='span'&&V46_CATEGORIES.includes(e.label));
 return [...groupBy(spans,e=>e.label+':'+(e.inputKind||'unattributed'))].map(([name,a])=>({name,calls:a.length,invalid:a.filter(e=>!validSpan(e)).length,
  success:a.filter(e=>e.success===true).length,exceptions:a.filter(e=>e.success===false).length,ms:stats(a.filter(validSpan).map(e=>e.toMs-e.fromMs))}));
}

/* --------------------------------------------------------- restitution */
function toMarkdown(m,{coupes=true,batchId=null}={}){if(!m.available)return '\n## V1\n\n'+m.reason+'\n';
 const n=x=>finite(x)?String(Math.round(x*100)/100):'non mesuré';
 const lines=['','## V1 — horloge SW et visites corrélées','',m.scopeLimited?'Projet absent sur certaines visites : portée limitée.':'Projet identifié.','',
  '| Phase | n | Médiane ms | P90 ms | Max ms | Manquantes | Inapplicables | Chevauchements |','|---|---:|---:|---:|---:|---:|---:|---:|'];
 for(const p of m.etapes)lines.push(`| ${p.label} | ${p.ms.n} | ${n(p.ms.median)} | ${n(p.ms.p90)} | ${n(p.ms.max)} | ${p.missing} | ${p.inapplicable} | ${p.overlap} |`);
 for(const l of m.lots){const c=l.coverage;lines.push('',
  `Lot ${l.batchId} / session ${l.sessionId} : ${c.visits} visites ; attendues ${n(c.expectedVisits)} ; ${c.missing.length} phases manquantes, ${c.overlap.length} chevauchements, ${c.lost} événements perdus. Couverture complète démontrée : ${c.complete?'oui':'non'}.`,
  `Durée totale : ${n(l.totalMs)} ms ; cycle actif n=${l.cycleMs.n}, médiane/P90/max ${n(l.cycleMs.median)}/${n(l.cycleMs.p90)}/${n(l.cycleMs.max)} ms. Cycles >60 s exclus : ${l.excludedCycles.n}, total ${n(l.excludedCycles.total)} ms ; silences : ${l.silences.count}, ${n(l.silences.totalMs)} ms.`,
  `Arrêts : ${l.stops.count} / ${l.stops.distinctCuts} coupes distinctes = ${n(l.stops.per100)} pour 100 ; causes ${JSON.stringify(l.stops.causes)}.`,
  executionsLine(l.executions,n),
  `Instrumentation : ${l.instrumentation.eventCount} événements, ${l.instrumentation.utf8Bytes} octets UTF-8, coût local ${n(l.instrumentation.localMs)} ms ; stockage asynchrone non isolé.`);}
 lines.push('',`Même cohorte de sept phases mesurées : n=${m.cohort.n} ; somme des médianes ${n(m.cohort.sumMediansMs)} ms ; médiane des sommes ${n(m.cohort.medianSumMs)} ms ; cycle médian ${n(m.cohort.medianCycleMs)} ms ; résidu ${n(m.cohort.residualMs)} ms.`,
  ...concurrenceLines(m.concurrence,n),
  ...attributionLines(m,n,{coupes,batchId}),
  '','V4.6 : spans imbriqués ; union temporelle, jamais ajoutés une seconde fois au cycle.','',
  '| Catégorie | Appels | Invalides | Succès | Exceptions | Médiane ms | P90 ms | Max ms |','|---|---:|---:|---:|---:|---:|---:|---:|---:|');
 for(const c of m.v46.categories)lines.push(`| ${c.name} | ${c.calls} | ${c.invalid} | ${c.success} | ${c.exceptions} | ${n(c.ms.median)} | ${n(c.ms.p90)} | ${n(c.ms.max)} |`);
 lines.push('','Les mesures de ce fichier ne certifient pas la porte terrain sur plusieurs lots, ni un acquittement serveur.');
 return lines.join('\n')+'\n';
}
const sec=x=>finite(x)?(Math.round(x/100)/10).toFixed(1).replace('.',',')+' s':'non mesuré';
const pct=x=>finite(x)?(Math.round(x*1000)/10).toFixed(1).replace('.',',')+' %':'non mesuré';
function totalsLine(label,t){return `${label} : ${t.cycles} cycle(s), ${sec(t.cycleMs)} ; attribué ${sec(t.attributedMs)} ; non expliqué ${sec(t.unexplainedMs)} (${pct(t.unexplainedShare)}) ; recouvrement entre étapes écarté ${sec(t.phaseOverlapMs)}, au-delà de la navigation suivante ${sec(t.beyondCycleMs)}.`;}
function attributionLines(m,n,{coupes,batchId}){const out=['','Temps attribué (D-073, chaque seconde d’un cycle navigation → navigation suivante) : chaque seconde est donnée à une étape (première étape qui la couvre, sans double compte) ou marquée « non expliquée ». Attribué + non expliqué = durée du cycle.',''];
 const partOf=l=>{const r=m.coupes.find(x=>x.batchId===l.batchId&&x.part!==null);return r?` (partie ${r.part})`:'';};
 const scope=batchId?m.lots.filter(l=>l.batchId===batchId):null,visits=batchId?m.coupes.filter(r=>r.batchId===batchId):m.coupes;
 const block=(label,t)=>{out.push(totalsLine(label,t));for(const [o,g] of Object.entries(t.byOutcome))out.push(`- ${o} : ${totalsLine('cycles',g).slice(9)}`);
  out.push(`Non mesurés (cycle inconnu ou contexte invalide) : ${t.notMeasured} ; ordre impossible : ${t.impossibleOrder} ; sommes non réconciliées : ${t.notReconciled}.`);
  if(t.gaps.length)out.push('Trous (non expliqués) par intervalle de jalons : '+t.gaps.slice(0,6).map(g=>`${g.between} ${sec(g.ms)} (${g.count})`).join(' ; ')+'.');};
 if(scope)for(const l of scope)block(`Lot ${l.batchId}${partOf(l)}`,l.attribution);
 else{block('Ensemble',m.attribution);for(const l of m.lots)block(`Lot ${l.batchId}${partOf(l)}`,l.attribution);}
 const bad=(batchId?m.concurrence.anomalies.rows.filter(r=>r.batchId===batchId):m.concurrence.anomalies.rows);
 if(bad.length)out.push('',`Anomalies d’ordre (visites exclues des statistiques de signe et d’attribution) : ${bad.map(r=>`coupe ${r.cut} (${r.anomalies.map(a=>a.before+' après '+a.after).join(', ')})`).join(' ; ')}.`);
 if(m.refs&&(m.refs.resolved||m.refs.unresolved))out.push('',`Références de dictionnaire : ${m.refs.resolved} développées, ${m.refs.unresolved} non résolues (identité alors incertaine).`);
 if(coupes){out.push('','Chronologie par coupe (ms depuis la navigation ; étapes = temps propre de l’étape, sans double compte ; « nm » = non mesuré) :','',
  '| Partie | Coupe | Issue | Cycle ms | Jalons triés (ms) | Étapes (ms) | Chevauchement ms | Non expliqué ms | Trous |','|---|---:|---|---:|---|---|---|---:|---|');
  const short={'navigation-capture':'nav','analyse-gcv1':'analyse','decision-lot':'décision',pose:'pose','capture-apres-pose':'après','validation':'valid','cut-suivant':'suivant',annexes:'annexes'};
  for(const r of visits){const j=r.milestones?r.milestones.map(x=>`${x.point} ${n(x.relMs)}`).join(', '):'non mesuré';
   const e=r.ownedMs?Object.entries(r.ownedMs).map(([k,v])=>`${short[k]} ${n(v)}`).join(', '):'nm';
   const o=r.overlap?`décalage ${n(r.overlap.nextMinusAcceptedMs)} ; entre étapes ${n(r.overlap.phaseOverlapMs)} ; hors cycle ${n(r.overlap.beyondCycleMs)} ; fin union ${n(r.overlap.endUnionMs)} / commun ${n(r.overlap.endIntersectionMs)}`:'non mesuré';
   const g=r.gaps?(r.gaps.length?r.gaps.map(x=>`${x.after}→${x.before} ${n(x.ms)}`).join(' ; '):'aucun'):'non mesuré';
   const st=r.status==='mesurée'?'':` [${r.status}${r.reason?' : '+r.reason:''}]`;
   out.push(`| ${r.part??'?'} | ${r.cut??'?'} | ${(r.outcome??'?')+(r.execution?' ('+r.execution+')':'')}${st} | ${n(r.cycleMs)} | ${j} | ${e} | ${o} | ${n(r.unexplainedMs)} | ${g} |`);}}
 return out;}
function concurrenceLines(c,n){if(!c)return [];const row=(label,s)=>`| ${label} | ${s.n} | ${n(s.median)} | ${n(s.p90)} | ${n(s.max)} |`;
 return ['','Chronologie concurrente (D-073) : acceptation durable et navigation suivante avancent en même temps ; durées réunies, jamais additionnées.','',
  '| Mesure | n | Médiane ms | P90 ms | Max ms |','|---|---:|---:|---:|---:|',
  row('Navigation suivante − acceptation (signé)',c.signedDeltaMs),row('Navigation → navigation suivante',c.untilNextMs),row('Navigation → acceptation durable',c.untilAcceptedMs),
  row('Après pose lue → les deux faits (union)',c.endUnionMs),row('Après pose lue → temps commun (intersection)',c.endIntersectionMs),
  '',`Navigation suivante avant l’acceptation durable : ${c.navigationBeforeAcceptance} visite(s) sur ${c.visits}. Visites à ordre impossible exclues : ${c.anomalies.visits}.`];}
function executionsLine(x,n){if(!x)return 'Exécutions : non mesurées.';
 const rows=x.rows.map(r=>`${r.segment}) ${r.from?.point??'début inconnu'} → ${r.to?`${r.to.point}${r.to.state?' '+r.to.state:''}${r.to.knownBoundary?'':' (fin non connue)'}`:'ouverte'} : ${n(r.durationMs)} ms`);
 const reasons={'end-unknown':'fin inconnue','start-unknown':'début inconnu','clock-changed':'horloge changée','no-boundary':'aucune borne'};
 return `Exécutions : ${rows.join(' ; ')||'aucune borne'}.${x.replaced?` Remplacé par un autre lot (dernier état ${x.replaced.lastState??'inconnu'}${x.replaced.closedAtReplacement?', fin connue avant':', aucune fin connue'}).`:''}`+
  ` Vie complète ${x.lifetimeMs===null?`non mesurée (${reasons[x.lifetimeReason]})`:`${n(x.lifetimeMs)} ms, dont exécution ${n(x.executionMs)} ms`}.`+
  (x.visitsOutsideExecution.length?` Visites hors exécution : ${x.visitsOutsideExecution.length} (coupes ${x.visitsOutsideExecution.map(v=>v.identity?.cut).join(', ')}), gardées dans la couverture.`:'');}
module.exports={measure,toMarkdown,inspectVisit,stats,union,IDS,resolveRefs};
