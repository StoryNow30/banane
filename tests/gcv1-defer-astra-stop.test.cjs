/* BANANE 4.7 — REPRODUCTIONS DU RED-TEAM ASTRA (D1–D4).
 *
 * Chaque essai marqué REPRODUCTION échoue sur 091462f et passe avec le
 * correctif. Les essais marqués CONTRAT sont neufs : ils épinglent le mécanisme
 * choisi pour D1, qui n'existait pas dans la base.
 *
 * Les reprises utilisent `restartFromImage` : une photographie SIMULTANÉE de
 * l'état, du journal, des enregistrements et des nuages réellement persistés à
 * la frontière simulée. Aucun fait postérieur n'y figure, et aucune variable du
 * runtime interrompu ne survit.
 *
 * Ce que ces essais ne démontrent pas : le comportement d'ESV. Une doublure ne
 * prouve pas ce que fait la page réelle.

 * Ce fichier porte : D1 (STOP et dispatch) et D2 (borne contre STOP/PAUSE). Le banc de `tools/verify.cjs` applique un budget de
 * temps PAR FICHIER ; la série Astra est donc répartie, sans qu'aucun essai ne
 * soit retiré ni allégé.
 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {K,GCV1,MemoryStore,SimulatedESV,EngineWith,candidate,unresolved,scope,byCut,pilot,counts,
 CrashStore,restartFromImage,runCapturingCrash}=require('./helpers/defer.cjs');
const {page}=require('./helpers/page.cjs');

const toujours=byCut({default:unresolved()});
const finalEvents=(store,operationId=null)=>store.events.filter(e=>e.type==='defer-finalized'
 &&(!operationId||e.operationId===operationId));
const eventIds=events=>new Set(events.map(e=>e.eventId));

/* ============================ D1 — STOP ET DISPATCH ============================ */

/* T1 — REPRODUCTION. Sur 091462f, le moteur contrôlait `RUNNING` puis laissait
 * DEUX `await` — l'écriture du marqueur et sa journalisation — avant d'appeler
 * l'adaptateur. Un STOP traité dans cette fenêtre marquait le lot STOPPED et la
 * navigation partait quand même. */
test('T1 · D1 · un STOP pendant l’écriture du marqueur empêche tout dispatch',async()=>{
 const Engine=EngineWith(toujours),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);
 // La fenêtre exacte reproduite par Astra : l'écriture du marqueur d'émission possible.
 store.onSetState=async s=>{if(s.deferIntent?.phase==='COMMAND_MAY_HAVE_BEEN_SENT'&&engine.s.batch?.state==='RUNNING')await engine.stop();};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 assert.equal(counts(adapter).nextWithoutDecision,0,'aucune transmission de navigation');
 assert.equal(engine.s.batch.deferred.length,0);
 assert.equal(engine.s.batch.state,'STOPPED','l’arrêt opérateur est conservé');
 assert.equal(engine.s.deferIntent,null);
 const abandon=store.events.find(e=>e.type==='defer-navigation-not-dispatched');
 assert.ok(abandon,'la non-émission est prouvée et journalisée');
 assert.equal(abandon.frontier,'after-emission-marker');
 assert.equal(abandon.authorization,'REVOKED_BEFORE_DISPATCH');
 assert.equal(abandon.commandInvoked,false);assert.equal(abandon.dispatched,false);
 assert.equal(abandon.resent,false);
});

/* T2a — CONTRAT. La page refuse le clic quand l'annulation de CETTE opération
 * lui est déjà connue, quel que soit l'ordre d'arrivée des deux messages. */
test('T2a · D1 · une annulation connue de la page avant le clic donne zéro clic ESV',async()=>{
 const f=page(),before=await f.call('state');
 let clics=0;f.nodes.get('O2N3DCutNextInvalid3DRail').click=()=>{clics++;};
 // L'annulation arrive AVANT la requête : l'ordre inverse du cas nominal.
 await f.call('cancel',{operationId:'op-annulee',reason:'stop'});
 const evidence=await f.call('nextWithoutDecision',before.identity,{part:23},'op-annulee');
 assert.equal(clics,0,'aucun clic ESV');
 assert.equal(evidence.commandInvoked,false,'non-émission prouvée par la page');
 assert.equal(evidence.refusal.code,'CANCELLED_BEFORE_COMMAND');
 assert.equal(evidence.navigationObserved,false);
});

/* T2b — CONTRAT. Une requête ultérieure ne réinitialise pas l'annulation d'une
 * opération : sur 091462f, `cancelled=false` en tête de chaque entrée effaçait
 * l'annulation et le clic repartait. */
test('T2b · D1 · une requête postérieure ne réautorise pas une opération annulée',async()=>{
 const f=page(),before=await f.call('state');
 let clics=0;f.nodes.get('O2N3DCutNextInvalid3DRail').click=()=>{clics++;};
 await f.call('cancel',{operationId:'op-A',reason:'stop'});
 // Une autre opération passe entre-temps et remet le drapeau global à faux.
 await f.call('nextWithoutDecision',before.identity,{part:23},'op-B');
 clics=0;
 const rejouee=await f.call('nextWithoutDecision',before.identity,{part:23},'op-A');
 assert.equal(clics,0,'l’opération annulée reste annulée');
 assert.equal(rejouee.refusal.code,'CANCELLED_BEFORE_COMMAND');
 assert.equal(rejouee.commandInvoked,false);
});

/* T2c — CONTRAT. Un message dupliqué ou rejoué ne produit pas un second clic.
 * L'appel refusé ne prétend pas pour autant que l'opération n'a rien émis :
 * elle l'a peut-être déjà fait, d'où `unknown`. */
test('T2c · D1 · une requête dupliquée pour la même opération ne clique pas deux fois',async()=>{
 const f=page(),before=await f.call('state');
 let clics=0;const noeud=f.nodes.get('O2N3DCutNextInvalid3DRail'),clic=noeud.click;
 noeud.click=function(){clics++;return clic.call(this);};
 await f.call('nextWithoutDecision',before.identity,{part:23},'op-unique');
 const doublon=await f.call('nextWithoutDecision',before.identity,{part:23},'op-unique');
 assert.equal(clics,1,'au plus une invocation par opération');
 assert.equal(doublon.refusal.code,'OPERATION_ALREADY_INVOKED');
 assert.equal(doublon.commandInvoked,'unknown','cet appel n’a pas cliqué ; l’opération a pu agir');
 assert.equal(doublon.operationAlreadyInvoked,true);
});

/* T2d — CONTRAT. L'ordre inverse : la requête est déjà partie quand STOP est
 * demandé, et l'annulation n'atteint jamais la page. Aucune non-émission n'est
 * alors affirmée ; l'émission reste possible et rien n'est renvoyé. */
test('T2d · D1 · une requête déjà en transit ne permet aucune preuve de non-émission',async()=>{
 const Engine=EngineWith(toujours),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);
 const natif=adapter.nextWithoutDecision.bind(adapter);
 // STOP demandé APRÈS le dispatch : la page n'en saura rien avant d'agir.
 adapter.nextWithoutDecision=async(...args)=>{const evidence=await natif(...args);await engine.stop();return evidence;};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope({end:102}));await engine.task;
 assert.equal(counts(adapter).nextWithoutDecision,1);
 const intention=store.state.deferIntent;
 assert.equal(engine.s.batch.deferred.length,1,'la navigation acquise est conservée');
 assert.equal(engine.s.batch.state,'STOPPED','l’arrêt opérateur n’est pas écrasé');
 assert.equal(intention,null,'la finalisation durable a nettoyé son intention');
 assert.equal(store.events.some(e=>e.type==='defer-navigation-not-dispatched'),false,
  'aucune non-émission n’est affirmée pour une commande déjà partie');
 const revocation=store.events.find(e=>e.type==='defer-authorization-revoked');
 assert.equal(revocation.scope,'AFTER_DISPATCH','la révocation est enregistrée comme tardive');
});

/* T3 — REPRODUCTION/CONTRAT. STOP alors que l'action a pu partir et n'a produit
 * aucune progression : l'état reste incertain, la commande n'est pas renvoyée,
 * et un redémarrage ne la rejoue pas. */
test('T3 · D1 · un STOP après une action possible conserve l’incertitude sans renvoi',async()=>{
 const Engine=EngineWith(toujours),adapter=new SimulatedESV(),store=new CrashStore();
 const engine=new Engine(adapter,store);
 const natif=adapter.nextWithoutDecision.bind(adapter);
 adapter.nextWithoutDecision=async(...args)=>{await engine.stop();adapter.deferOutcome='no-navigation';return natif(...args);};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 assert.equal(engine.s.batch.state,'STOPPED');
 assert.equal(engine.s.batch.deferred.length,0);
 assert.ok(engine.s.deferIntent,'l’intention est conservée jusqu’à résolution');
 assert.equal(engine.s.deferIntent.commandInvoked,true);
 await assert.rejects(()=>engine.resume(),/Navigation différée non résolue/);
 const repris=restartFromImage(store.image(),{esvCut:100});
 await repris.engine.init();
 assert.equal(repris.engine.s.batch.deferred.length,0);
 assert.equal(counts(repris.adapter).nextWithoutDecision,0,'aucun rejeu après redémarrage');
});

/* ======================== D2 — BORNE CONTRE STOP ET PAUSE ======================== */

/* T4 — REPRODUCTION. Sur 091462f, la clôture de borne écrasait STOPPED par
 * FINISHED_WITH_UNCONFIRMED_ACTIONS. */
test('T4 · D2 · borne atteinte + STOP : le deferred est gardé, l’état reste STOPPED',async()=>{
 const Engine=EngineWith(toujours),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);
 const natif=adapter.nextWithoutDecision.bind(adapter);
 adapter.nextWithoutDecision=async(...args)=>{const e=await natif(...args);await engine.stop();return e;};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope({start:100,end:100}));await engine.task;
 assert.deepEqual(engine.s.batch.deferred.map(d=>d.cut),[100],'le résultat acquis est conservé');
 assert.equal(engine.s.batch.deferred[0].nextIdentity.cut,101);
 assert.equal(engine.s.batch.state,'STOPPED','la décision opérateur prime sur la clôture automatique');
 assert.ok(engine.s.batch.boundaryReachedWhileHalted,'la borne atteinte est consignée, pas appliquée');
 assert.equal(engine.s.batch.boundaryReachedWhileHalted.end,100);
 assert.equal(engine.closureSummary().deferred,1);
});

/* T5 — REPRODUCTION. Même scénario avec PAUSE. */
test('T5 · D2 · borne atteinte + PAUSE : le deferred est gardé, l’état reste PAUSED',async()=>{
 const Engine=EngineWith(toujours),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);
 const natif=adapter.nextWithoutDecision.bind(adapter);
 adapter.nextWithoutDecision=async(...args)=>{const e=await natif(...args);await engine.pause();return e;};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope({start:100,end:100}));await engine.task;
 assert.deepEqual(engine.s.batch.deferred.map(d=>d.cut),[100]);
 assert.equal(engine.s.batch.state,'PAUSED');
 assert.ok(engine.s.batch.boundaryReachedWhileHalted);
 // Une reprise explicite constate la borne et clôture normalement.
 await engine.resume();await engine.task;
 assert.equal(engine.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
 assert.equal(engine.s.batch.deferred.length,1,'toujours un seul deferred');
 assert.equal(counts(adapter).nextWithoutDecision,1,'aucune seconde navigation à la reprise');
});

