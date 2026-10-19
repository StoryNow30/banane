'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Recorder}=require('../src/perf-phase.js'),{journal,id}=require('./helpers/perf-phases.cjs'),{measure}=require('../tools/perf-phases.cjs');
function fixture(write,{budget=25,closed=true}={}){
 const events=[],engine={s:{mode:'automatic-test',sessionId:'S',batch:{id:'B',state:'RUNNING',scope:{part:23,start:100,end:100}}}};
 const r=new Recorder(engine,{putEvent:e=>write?write(e,events):events.push(e)},{flushTimeoutMs:budget});r.syncBatch(true);r.ensureVisit(id(100));
 if(closed)r.event('batch-state',{state:'COMPLETED'});return {r,events};
}
test('flush normal : santé effectivement stockée, attente et Promises libérées',async()=>{
 const {r,events}=fixture();const m=await r.flush();assert.equal(m.status,'flushed');assert.equal(m.flushComplete,true);assert.equal(m.pendingWrites,0);
 assert.equal(m.lots[0].complete,true);assert.equal(m.lots[0].healthState,'stored');assert.equal(events.at(-1).finalSnapshot,true);assert.equal(r.flushWaiters.size,0);
});
test('rejet de mesure : perte explicite, jamais réussite de sauvegarde',async()=>{
 const {r}=fixture(()=>Promise.reject(Error('disk')));const m=await r.flush();assert.equal(m.flushComplete,false);assert.ok(m.lots[0].lost>0);
 assert.equal(m.lots[0].healthState,'rejected');assert.equal(m.lots[0].complete,false);assert.equal(m.pendingWrites,0);
});
test('mesure lente puis santé terminées dans le même budget',async()=>{
 const {r,events}=fixture((e,a)=>new Promise(resolve=>setTimeout(()=>{a.push(e);resolve();},5)),{budget:100});
 const m=await r.flush();assert.equal(m.flushComplete,true);assert.equal(m.lots[0].complete,true);assert.equal(m.pendingWrites,0);assert.equal(events.at(-1).finalSnapshot,true);
});
test('mesure bloquée : attente bornée, mesures toujours pendantes, pas de faux statut santé',async()=>{
 const {r}=fixture(()=>new Promise(()=>{}));const before=r.pending.size,m=await r.flush();
 assert.equal(m.status,'timeout');assert.equal(m.flushComplete,false);assert.equal(m.pendingWrites,before);assert.equal(r.pending.size,before);
 assert.equal(m.lots[0].lost,0);assert.equal(m.lots[0].healthState,'not-attempted');assert.equal(m.lots[0].complete,false);assert.equal(r.flushWaiters.size,0);
 await r.flush();assert.equal(r.flushWaiters.size,0);assert.equal(r.pending.size,before);
});
test('écriture finit après expiration : métadonnées anciennes restent incomplètes, prochain flush peut réussir',async()=>{
 const releases=[],{r}=fixture((e,a)=>e.kind==='health'?a.push(e):new Promise(resolve=>releases.push(()=>{a.push(e);resolve();})));
 const first=await r.flush();assert.equal(first.status,'timeout');for(const release of releases)release();
 const second=await r.flush();assert.equal(second.flushComplete,true);assert.equal(second.lots[0].complete,true);assert.equal(first.flushComplete,false);assert.ok(first.pendingWrites>0);
});
test('santé elle-même bloquée : statut hors journal, même avec une ancienne santé finale enregistrée',async()=>{
 let block=false;const {r}=fixture((e,a)=>block&&e.kind==='health'?new Promise(()=>{}):a.push(e));assert.equal((await r.flush()).flushComplete,true);
 block=true;const m=await r.flush();assert.equal(m.status,'timeout');assert.equal(m.lots[0].healthStored,false);assert.equal(m.lots[0].healthState,'pending');assert.equal(m.lots[0].complete,false);
});
test('santé rejetée et export du lot ouvert : aucun instantané complet revendiqué',async()=>{
 const rejected=fixture((e,a)=>e.kind==='health'?Promise.reject(Error('health disk')):a.push(e));const m=await rejected.r.flush();
 assert.equal(m.status,'health-incomplete');assert.equal(m.lots[0].healthStored,false);assert.equal(m.lots[0].complete,false);
 const open=fixture(null,{closed:false});const partial=await open.r.flush();assert.equal(partial.flushComplete,true);assert.equal(partial.lots[0].complete,false);
});
test('budget technique 250 ms en production, plafonné ; un budget invalide ne crée pas une attente infinie',()=>{
 const e={s:{}},s={putEvent(){}};for(const x of [undefined,Infinity,0,-1,999])assert.equal(new Recorder(e,s,{flushTimeoutMs:x}).flushTimeoutMs,250);
});
function metadata(j){const h=j.events.at(-1);return {schema:1,status:'flushed',flushComplete:true,pendingWrites:0,lots:[{sessionId:'S',batchId:'B',clockId:'clock',complete:true,pendingWrites:0,requestsPending:0,lost:0,healthStored:true,healthState:'stored',healthSeq:h.batchSeq}]};}
test('analyse : métadonnées de flush incomplètes interdisent le vert même si le journal précédent semble complet',()=>{
 const j=journal();assert.equal(measure(j).lots[0].coverage.complete,true);j.v1TimingExport=metadata(j);assert.equal(measure(j).lots[0].coverage.complete,true);
 for(const change of [{flushComplete:false,status:'timeout'},{pendingWrites:1},{schema:99},{status:'timeout'},{status:'health-incomplete'},{status:'measurements-lost'}]){
  j.v1TimingExport={...metadata(j),...change};assert.equal(measure(j).lots[0].coverage.complete,false);
 }
});
test('analyse : santé non stockée, ancien état ou mauvais lot/horloge ne comblent pas une lacune',()=>{
 const j=journal();for(const change of [{healthStored:false},{healthState:'pending'},{lost:1},{requestsPending:1},{healthSeq:1},{clockId:'old'},{batchId:'old'},{complete:false}]){
  const m=metadata(j);m.lots[0]={...m.lots[0],...change};j.v1TimingExport=m;assert.equal(measure(j).lots[0].coverage.complete,false);
 }
});
