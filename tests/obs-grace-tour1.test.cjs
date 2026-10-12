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

/* OBS-2 : pendant la grâce, TOUT ce que la page relaie est rangé, y compris une écriture COMMENCÉE après la fin du lot
 * (mesuré : 629 ms après « Arrêter »). Un filtre sur la date de début perdrait de vraies écritures (vrai lot : le PUT
 * commence après l'acceptation 63 fois sur 208, jusqu'à +1,5 s) : on marque `recuEnGrace:true` et l'écart début de la
 * requête − fin du lot, pour séparer ces entrées à l'analyse. */
test('OBS-2 entrée rangée pendant la grâce : recuEnGrace et écart début − fin du lot ; rien de tel lot ouvert',async()=>{
 const {b}=await lotOuvert();
 send(b,[write({seq:1})]);assert.equal(stored(b)[0].recuEnGrace,undefined,'lot ouvert : pas de marque');
 await b.api('stop');const fin=b.get('obsFins').get('lot-A').at;
 send(b,[write({seq:2,startedEpochMs:fin+629,endedEpochMs:fin+700}),write({seq:3,startedEpochMs:fin-300,endedEpochMs:fin+50}),
  {seq:4,kind:'observer',version:1,world:'MAIN',installedBeforePageScripts:true,readyState:'complete',scriptsAtInstall:0,enabled:true,afterDenial:false,dropped:0,ignored:0}]);
 const of=seq=>stored(b).find(x=>x.observer.seq===seq);
 assert.equal(of(2).recuEnGrace,true);assert.equal(of(2).debutMoinsFinLotMs,629,'commencée 629 ms APRÈS la fin du lot');
 assert.equal(of(3).recuEnGrace,true);assert.equal(of(3).debutMoinsFinLotMs,-300,'commencée avant la fin');
 assert.equal(of(4).recuEnGrace,true);assert.equal(of(4).debutMoinsFinLotMs,null,'sans date de début : écart non mesuré');
});
test('OBS-2 nouveau lot pendant la grâce : seules les entrées rangées avec l’ANCIEN lot sont marquées, écart à SA fin',async()=>{
 const {b,e}=await lotOuvert('lot-A');await b.api('stop');const finA=b.get('obsFins').get('lot-A').at;await new Promise(r=>setTimeout(r,5));
 await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt'});
 const B=e.s.batch.id,debutB=Date.parse(e.s.batch.startedAt);
 send(b,[write({seq:2,startedEpochMs:debutB-3,endedEpochMs:debutB+60}),write({seq:3,startedEpochMs:debutB+5,endedEpochMs:debutB+50})]);
 const of=seq=>stored(b).find(x=>x.observer.seq===seq);
 assert.equal(of(2).batchId,'lot-A');assert.equal(of(2).recuEnGrace,true);assert.equal(of(2).debutMoinsFinLotMs,debutB-3-finA);
 assert.equal(of(3).batchId,B);assert.equal(of(3).recuEnGrace,undefined,'lot B ouvert : pas de marque');
 await b.settle();
});
test('OBS-2 lecture hors ligne : perf-phases compte les écritures reçues pendant la grâce et celles commencées après la fin',()=>{
 const V1=require('../tools/perf-phases.cjs'),{journal}=require('./helpers/perf-phases.cjs');
 const w=(id,o)=>({type:'esv-observation',schema:1,eventId:id,kind:'write',timeOrigin:1000,ms:600,sessionId:'S',batchId:'B',observer:{id:'o',seq:1},status:204,outcome:'done',attempt:1,
  railPairId:'r',bodyKeys:1,body:{a:1},startedEpochMs:2450,endedEpochMs:2600,durationMs:150,...o});
 const j=journal();j.events.push(w('w1',{}),w('w2',{recuEnGrace:true,debutMoinsFinLotMs:-120}),w('w3',{recuEnGrace:true,debutMoinsFinLotMs:629}));
 const m=V1.measure(j,{tous:true});assert.equal(m.observations.writes.inGrace,2);assert.equal(m.observations.writes.startedAfterEnd,1);
 assert.match(V1.toMarkdown(m),/dont 2 reçue\(s\) pendant la grâce de fin de lot, 1 commencée\(s\) après la fin du lot/);
});
