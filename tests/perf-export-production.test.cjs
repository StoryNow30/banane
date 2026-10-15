'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs');
test('quatre exports réels : statut hors canal bloqué, métier conservé, aucune commande ESV supplémentaire',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');e.s.batch={id:'export-fixture',state:'RUNNING',scope:{part:23,start:100,end:100}};r.flushTimeoutMs=25;
 const put=b.store.putEvent.bind(b.store);b.store.putEvent=x=>x.type==='phase-timing'?new Promise(()=>{}):put(x);
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);r.batch.closed=true;
 const record={recordId:'business-fixture',status:'preserved'};await b.store.putRecord(record);
 const commands=normalize(b.commands),records=normalize(b.store.records),poses=normalize(b.adapter.rails);
 for(const action of ['journal-meta','dataset-meta','journal','dataset']){
  const out=await b.api(action);assert.equal(out.v1TimingExport.status,'timeout');assert.equal(out.v1TimingExport.flushComplete,false);
  assert.ok(out.v1TimingExport.pendingWrites>0);assert.equal(out.v1TimingExport.lots[0].healthStored,false);
  if(out.records)assert.deepEqual(normalize(out.records),records);
 }
 assert.deepEqual(normalize(b.commands),commands);assert.deepEqual(normalize(b.adapter.rails),poses);assert.deepEqual(normalize(b.store.records),records);
 assert.ok(r.pending.size>0);assert.equal(r.flushWaiters.size,0);
});
