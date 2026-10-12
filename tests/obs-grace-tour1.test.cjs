'use strict';
/* Relecture du test 3, corrections du tour 1 sur la grâce de réception de l'observateur passif (background.js,
 * src/bridge.js). Service worker RÉEL en VM, moteur réel, ESV simulé (même harnais que obs-grace-fin-lot). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production}=require('./helpers/perf-production.cjs');
const write=(o={})=>({seq:1,kind:'write',via:'xhr',urlClass:'rail-pair-write',method:'PUT',status:204,outcome:'done',attempt:1,railPairId:'traj__00+1.5/2.5',bodyKeys:12,
 body:{a:1.5},startedEpochMs:Date.now()-400,endedEpochMs:Date.now()-250,durationMs:150,...o});
const send=(b,entries,observer='obs-1')=>b.raw({kind:'esv-observation',observer,entries}).out;
const stored=b=>b.store.events.filter(e=>e.type==='esv-observation');
const writes=b=>stored(b).filter(e=>e.kind==='write');
const REFUS={accept:false,reason:'no-session'};
async function lotOuvert(id='lot-A',opts={}){const b=production(opts);await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');
 e.s.batch={id,state:'RUNNING',step:'capture',startedAt:new Date(Date.now()-60000).toISOString(),scope:{part:23,start:100,end:101},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[]};
 r.syncBatch(true);r.ensureVisit(b.adapter.identity);return {b,e,r};}
const vieillir=(b,id,ms)=>{const f=b.get('obsFins').get(id);assert.ok(f,'fin relevée pour '+id);f.at-=ms;};

/* OBS-1 : « SKIP explicite » du dernier cut d'un lot borné clôt le lot (COMPLETED / FINISHED_WITH_UNCONFIRMED_ACTIONS) HORS
 * de la boucle du moteur (engine.skipPaused, scope.end) : sans jalon batch-state, aucune fin n'était relevée, et l'écriture
 * SKIP relayée ~250 ms plus tard était refusée. */
test('OBS-1 SKIP explicite qui clôt le lot : fin relevée, l’écriture SKIP arrivée juste après est rangée avec le lot',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine');e.s.settings.minConfidence=100;   // faible confiance forcée : pause au cut 100 (= scope.end)
 await b.api('start',{part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'pause'});
 assert.equal((await b.settle()).batch.state,'PAUSED','lot en pause sur son dernier cut');
 await b.api('explicit-skip');await b.settle();
 const id=e.s.batch.id;assert.ok(['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS'].includes(e.s.batch.state),e.s.batch.state);
 const f=b.get('obsFins').get(id);assert.ok(f,'fin relevée au SKIP explicite');assert.equal(f.cause,'fin-naturelle');
 const r=send(b,[write({seq:1})]);assert.equal(r.accept,true,'écriture SKIP rangée');assert.equal(r.stored,1);
 assert.equal(writes(b)[0].batchId,id);
 vieillir(b,id,5500);deq(send(b,[write({seq:2})]),REFUS,'après 5 s : rien');
});
test('OBS-1 témoin : SKIP explicite qui ne clôt pas le lot (cut avant la borne) : aucune fin relevée',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine');e.s.settings.minConfidence=100;
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'pause'});
 assert.equal((await b.settle()).batch.state,'PAUSED');
 await b.api('explicit-skip');
 assert.equal(b.get('obsFins').has(e.s.batch.id),false,'lot pas clos par le SKIP : pas de fin');
 await b.settle();
});

/* OBS-4 : après « Arrêter » pendant une action, la grâce suivait la tâche du moteur sans borne (mesuré : acceptée 10 min
 * après l'arrêt). Plafond : 120 s après l'arrêt ; ensuite, seuls les 5 s après la sortie de la boucle comptent. */
test('OBS-4 arrêt pendant une action sans fin : accepté jusqu’à 120 s après l’arrêt, refusé au-delà',async()=>{
 const {b,e}=await lotOuvert();e.task=new Promise(()=>{});await b.api('stop');
 vieillir(b,'lot-A',60000);assert.equal(send(b,[write({seq:1})]).accept,true,'60 s : action en cours, accepté');
 vieillir(b,'lot-A',61000);deq(send(b,[write({seq:2})]),REFUS,'121 s : au-delà du plafond, refusé');
 assert.equal((await b.api('export-cache-info')).refus!==null,true,'le vidage reste refusé tant que l’action tourne (« Ariane travaille encore »)');
 e.task=null;
});
