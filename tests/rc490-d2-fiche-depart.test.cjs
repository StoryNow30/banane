'use strict';
/* D2 (relecture finale de la 4.9.0) — fiche de départ fausse possible. Au départ d'une séance, ESV pose aussi la question
 * « y a-t-il des invalides ? » (`projects/undefined/rails?status=invalid&top=1`, une ligne au plus) : son résumé de liste
 * (`listKey` 'undefined') devenait une fiche 0 / 1 / 1. Les fiches étaient écrites sans verrou (lire, modifier, écrire),
 * en parallèle : cette fausse fiche pouvait ÉCRASER la vraie (7 602 / 137 / 7 739). Correctif : ces résumés sont ignorés
 * (`listKey` 'undefined' ou absent, liste de moins de 2 lignes) et les écritures des fiches sont mises en file. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production,memoire}=require('./helpers/perf-production.cjs');
const EC=require('../src/export-cache.js');
const resume=(o={})=>({seq:1,kind:'list-summary',listKey:'traj__liste',pages:10,okPages:10,rows:7739,chars:11000000,counts:{valid:7602,invalid:137,skipped:0},
 firstStartedEpochMs:Date.now()-300,lastEndedEpochMs:Date.now()-100,durationMs:200,beforeSession:true,...o});
const question=(o={})=>resume({seq:2,listKey:'undefined',pages:1,okPages:1,rows:1,chars:500,counts:{valid:0,invalid:1,skipped:0},...o});

test('D2 fiche : résumé de la question « invalides ? » (listKey undefined ou absent, moins de 2 lignes) : aucune fiche',()=>{
 const ok={kind:'list-summary',listKey:'traj__liste',rows:7739,counts:{valid:7602,invalid:137,skipped:0}};
 assert.ok(EC.ficheDepart(ok,{}),'la vraie liste donne une fiche');
 assert.equal(EC.ficheDepart({...ok,listKey:'undefined'},{}),null,'listKey « undefined »');
 assert.equal(EC.ficheDepart({...ok,listKey:null},{}),null,'listKey absent (null)');
 const {listKey,...sans}=ok;assert.equal(EC.ficheDepart(sans,{}),null,'listKey absent');
 assert.equal(EC.ficheDepart({...ok,rows:1,counts:{valid:0,invalid:1,skipped:0}},{}),null,'une seule ligne');
 assert.ok(EC.ficheDepart({...ok,rows:2,counts:{valid:1,invalid:1,skipped:0}},{}),'deux lignes : une fiche');
});

test('D2 écritures en parallèle : aucune fiche perdue (écritures en file)',async()=>{
 const local=memoire(),f=n=>({at:'2026-10-15T08:00:00.000Z',batchId:'b'+n,partie:n,version:'4.9.0',valides:10+n,invalides:2,ignores:0,total:12+n});
 await Promise.all([EC.noterDepart(local,f(1)),EC.noterDepart(local,f(2)),EC.noterDepart(local,f(3))]);
 deq((local.m.banane3FichesDepart||[]).map(x=>x.batchId),['b1','b2','b3']);
});

test('D2 service worker : résumé de la liste puis question « invalides ? » au même départ : la vraie fiche seule',async()=>{
 const local=memoire(),b=production({local});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');
 e.s.batch={id:'lot-A',state:'RUNNING',step:'capture',startedAt:new Date(Date.now()-60000).toISOString(),scope:{part:13,start:0,end:999999},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[]};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);
 b.raw({kind:'esv-observation',observer:'o1',entries:[resume({seq:1}),question()]});
 await new Promise(x=>setTimeout(x,20));
 const l=local.m.banane3FichesDepart||[];
 deq(l.map(x=>[x.batchId,x.partie,x.valides,x.invalides,x.total]),[['lot-A',13,7602,137,7739]]);
 await b.settle();
});
