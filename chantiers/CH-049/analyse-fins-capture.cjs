#!/usr/bin/env node
'use strict';
/* CH-049-A — causes des fins de capture anormales d'un export Écho (v2 allégé).
 * Lecture seule, hors ligne. Usage : node analyse-fins-capture.cjs <export-seg*.json>…
 * Pour chaque capture : code de fin, durée, position de la fin dans la visite (avant/après la fin de visite,
 * délai au dernier geste de l'opérateur), taille de la lecture. Rend un tableau JSON agrégé. */
const fs=require('fs');
const q=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const out={};
for(const file of process.argv.slice(2)){
 const j=JSON.parse(fs.readFileSync(file,'utf8'));
 const visits=new Map(j.session.visits.map(v=>[v.visitId,v]));
 const rec=new Map(j.records.map(r=>[r.visitId,r]));
 const ops=new Map();
 for(const e of j.events)if(e.type==='native-operator-event'||e.type==='native-operator-gesture'){
  const t=Date.parse(e.observedAt||e.event?.observedAt||e.timestamp);(ops.get(e.visitId)||ops.set(e.visitId,[]).get(e.visitId)).push(t);}
 const ends=new Map();for(const e of j.events)if(e.type==='native-visit-ended')ends.set(e.visitId,Date.parse(e.endedAt));
 const ready=new Map();for(const e of j.events)if(e.type==='native-capture-ready')ready.set(e.cloud.captureId,e);
 const rows=[];
 for(const r of j.records)for(const c of Object.values(r.geometryCaptures||{})){
  const ev=ready.get(c.captureId);const term=c.termination?.code||ev?.cloud?.termination?.code||'NONE';
  const v=visits.get(c.visitId);const vs=Date.parse(v.startedAt),ve=ends.get(c.visitId)||Date.parse(v.endedAt);
  const cs=Date.parse(c.startedAt),ce=Date.parse(c.completedAt||ev?.timestamp);
  const to=c.termination?Date.parse(c.termination.observedAt):null;
  const o=(ops.get(c.visitId)||[]).filter(t=>t<=ce).sort((a,b)=>a-b);
  rows.push({term,reason:c.termination?.reason||null,status:c.status,durCapMs:ce-cs,startAfterVisitMs:cs-vs,visitMs:ve-vs,
   endVsVisitEndMs:(to??ce)-ve,lastOpBeforeEndMs:o.length?(to??ce)-o[o.length-1]:null,nOpsBefore:o.length,
   pointsRead:c.trace?.pointsRead??null,relation:r.visitRelation?.type,leave:r.leaveReason});
 }
 for(const t of [...new Set(rows.map(r=>r.term))]){
  const R=rows.filter(r=>r.term===t),k=file+' | '+t;
  out[k]={n:R.length,
   durCap_ms:{p50:q(R.map(r=>r.durCapMs),.5),p90:q(R.map(r=>r.durCapMs),.9)},
   visit_ms:{p50:q(R.map(r=>r.visitMs),.5),p90:q(R.map(r=>r.visitMs),.9)},
   finApresFinVisite:R.filter(r=>r.endVsVisitEndMs>=-50).length,
   finDansLes300msAvantFinVisite:R.filter(r=>r.endVsVisitEndMs<-50&&r.endVsVisitEndMs>=-300).length,
   finApresGesteMoinsDe300ms:R.filter(r=>r.lastOpBeforeEndMs!==null&&r.lastOpBeforeEndMs<300).length,
   sansGesteAvant:R.filter(r=>r.nOpsBefore===0).length,
   pointsRead_p50:q(R.map(r=>r.pointsRead).filter(x=>x!==null),.5),
   raisons:R.reduce((a,r)=>{const x=r.reason||'-';a[x]=(a[x]||0)+1;return a},{}),
   leave:R.reduce((a,r)=>{const x=r.leave||'-';a[x]=(a[x]||0)+1;return a},{})};
 }
}
console.log(JSON.stringify(out,null,1));
