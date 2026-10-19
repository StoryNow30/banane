'use strict';
/* V1 (test 2) : la mesure ne doit ni bloquer ni faire échouer un export. Relevé
 * mineur de la relecture : `await timing.flush()` n'était pas gardé, donc une
 * exception ou une Promise jamais réglée de la mesure empêchait journal et
 * bilan. Désormais : borne de temps déclarée (1 s au plus) et export déclaré
 * incomplet, jamais présenté comme complet. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{measure}=require('../tools/perf-phases.cjs');
const ACTIONS=['journal-meta','dataset-meta','journal','dataset'];
async function lot(){const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');e.s.batch={id:'garde',state:'STOPPED',scope:{part:23,start:100,end:101}};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);r.batch.closed=true;await Promise.allSettled([...r.pending]);
 await b.store.putRecord({recordId:'metier',status:'preserved'});return b;}
for(const [nom,flush,statut] of [
 ['exception synchrone',()=>{throw Error('mesure en panne');},'flush-error'],
 ['rejet de la Promise',()=>Promise.reject(Error('mesure rejetée')),'flush-error'],
 ['Promise jamais réglée',()=>new Promise(()=>{}),'timeout']])
test('mesure : '+nom+' — les quatre exports aboutissent, déclarés incomplets, rien de métier touché',async()=>{
 const b=await lot(),r=b.get('timing');r.hardLimitMs=40;r.flush=flush;
 const records=normalize(b.store.records),commands=normalize(b.commands),rails=normalize(b.adapter.rails),t0=Date.now();
 for(const action of ACTIONS){
  const out=await b.api(action),t=out.v1TimingExport;
  assert.equal(out.format.startsWith('banane-test-'),true,action+' : export produit');
  assert.equal(t.status,statut);assert.equal(t.flushComplete,false);assert.equal(t.schema,1);assert.equal(t.lots.length,0);assert.ok(t.maxWaitMs<=1000);
  if(statut==='flush-error')assert.match(t.error,/mesure/);
  if(out.records)assert.deepEqual(normalize(out.records),records,'enregistrements métier conservés');
  if(out.events)assert.equal(measure(out,{tous:true}).lots[0].coverage.exportTiming.complete,false);
 }
 assert.ok(Date.now()-t0<4000,'borne tenue (4 exports)');
 assert.deepEqual(normalize(b.commands),commands);assert.deepEqual(normalize(b.adapter.rails),rails);assert.deepEqual(normalize(b.store.records),records);
});
test('borne de production : 1 s au plus, même si une valeur supérieure est fournie ; mesure saine inchangée',async()=>{
 const b=await lot(),r=b.get('timing');r.flush=()=>new Promise(()=>{});r.hardLimitMs=60000;const t0=Date.now();
 const out=await b.api('journal-meta');assert.equal(out.v1TimingExport.status,'timeout');assert.ok(Date.now()-t0>=900&&Date.now()-t0<3500);
 const sain=await (await lot()).api('journal-meta');assert.equal(sain.v1TimingExport.status,'flushed');assert.equal(sain.v1TimingExport.lots[0].complete,true);
});
test('mesure absente (module non chargé) : exports comme avant, sans métadonnée de mesure',async()=>{
 const b=production({enabled:false});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 for(const action of ACTIONS)assert.equal('v1TimingExport' in await b.api(action),false);
});
