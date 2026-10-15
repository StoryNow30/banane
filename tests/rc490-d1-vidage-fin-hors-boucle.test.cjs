'use strict';
/* D1 (relecture finale de la 4.9.0) — vidage du cache bloqué après une fin de lot HORS de la boucle du moteur.
 * Le vidage attend la clôture de la mesure V1 du lot (`timing.batch.closed`), qui ne venait que du jalon `batch-state`
 * (sortie de la boucle) ou d'« Arrêter » hors tâche. « Clôturer le résultat incertain », la fin de partie après un
 * différé (`finApresDiffere`, KI-067) et le SKIP explicite du dernier cut mettent le lot en STOPPED / COMPLETED sans ce
 * jalon : le vidage restait refusé indéfiniment (« la clôture de la mesure V1 du lot n’est pas terminée »), « Arrêter »
 * étant caché sur un lot clos. Correctif : la mesure V1 est close ici, comme pour « Arrêter » hors tâche, avec l'état
 * réel du lot (jalon `batch` « end »). Service worker RÉEL en VM, moteur réel, ESV simulé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs');
const {dernierDiffere}=require('./helpers/fin-partie.cjs');
const V1=/clôture de la mesure V1/;
const finV1=(store,id)=>store.events.filter(e=>e.type==='phase-timing'&&e.kind==='batch'&&e.point==='end'&&e.batchId===id);

test('D1 « Clôturer le résultat incertain » (navigation différée) : mesure V1 close, vidage permis',async()=>{
 const local=memoire(),b=production({local});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');
 e.s.batch={id:'lot-A',state:'RUNNING',step:'capture',startedAt:new Date(Date.now()-60000).toISOString(),scope:{part:13,start:0,end:999999},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[]};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);
 e.s.batch.state='PAUSED_DEFER_NAVIGATION_UNCERTAIN';await e.event('batch-state',{state:e.s.batch.state});
 e.s.deferIntent={phase:'COMMAND_INVOKED',identity:b.adapter.identity,operationId:'op1',batchId:'lot-A'};
 await b.api('close-uncertain');
 assert.equal(e.s.batch.state,'STOPPED');
 assert.equal(r.batch.closed,true,'mesure V1 close');
 await new Promise(x=>setTimeout(x,20));
 const fins=finV1(b.store,'lot-A');assert.equal(fins.length,1,'un seul jalon de fin');assert.equal(fins[0].state,'STOPPED');assert.equal(fins[0].knownBoundary,true);
 const info=await b.api('export-cache-info');
 assert.doesNotMatch(String(info.refus),V1);assert.equal(info.refus,null,'vidage permis');
 await b.settle();
});

test('D1 fin de partie après un différé (KI-067, « Reprendre » sur la partie suivante) : mesure V1 close, vidage permis',async()=>{
 const {r}=await dernierDiffere({globals:{BananePhaseTiming:require('../src/perf-phase.js'),BananeExportCache:require('../src/export-cache.js')}},{total:101});
 const timing=r.b.fonction('timing');assert.ok(timing?.batch,'mesure V1 installée');assert.equal(timing.batch.closed,false,'pause : mesure ouverte');
 Object.assign(r.b.adapter.identity,{pageId:'apres-F5',part:24,cut:1});
 const view=await r.b.api('resume');
 assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd.reason,'navigation-other-part-after-defer');
 assert.equal(timing.batch.closed,true,'mesure V1 close');
 await new Promise(x=>setTimeout(x,20));
 const fins=finV1(r.b.store,view.batch.id);assert.equal(fins.length,1);assert.equal(fins[0].state,'STOPPED');
 /* La grâce de l'observateur (5 s après la fin) court encore : on la fait vieillir. */
 const f=r.b.fonction('obsFins').get(view.batch.id);if(f)f.at-=6000;
 const sae=view.batch.stoppedAtEnd;sae.at=new Date(Date.parse(sae.at)-6000).toISOString();r.b.fonction('engine').s.batch.stoppedAtEnd.at=sae.at;
 const info=await r.b.api('export-cache-info');
 assert.doesNotMatch(String(info.refus),V1);assert.equal(info.refus,null,'vidage permis');
});

test('D1 SKIP explicite du dernier cut (COMPLETED hors boucle) : mesure V1 close, vidage permis après la grâce',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');e.s.settings.minConfidence=100;
 await b.api('start',{part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'pause'});
 assert.equal((await b.settle()).batch.state,'PAUSED');assert.equal(r.batch.closed,false);
 await b.api('explicit-skip');await b.settle();
 const id=e.s.batch.id;assert.ok(['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(e.s.batch.state),e.s.batch.state);
 assert.equal(r.batch.closed,true,'mesure V1 close');
 await new Promise(x=>setTimeout(x,20));
 const fins=finV1(b.store,id);assert.equal(fins.length,1);assert.equal(fins[0].state,e.s.batch.state);
 b.get('obsFins').get(id).at-=6000;
 const info=await b.api('export-cache-info');
 assert.doesNotMatch(String(info.refus),V1);assert.equal(info.refus,null,'vidage permis');
});

test('D1 témoin : fin dans la boucle (jalon batch-state) : un seul jalon de fin, comme avant',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
 const v=await b.settle();assert.ok(['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','STOPPED'].includes(v.batch.state),v.batch.state);
 assert.equal(r.batch.closed,true);await new Promise(x=>setTimeout(x,20));
 assert.equal(finV1(b.store,e.s.batch.id).length,1,'pas de second jalon de fin');
});
