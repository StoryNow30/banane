const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js');const {MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
/* Lot V4.6.0, revue Astra — récupération MV3 et lot actif.
 *
 * Le service worker MV3 peut mourir à tout moment. `Engine.init()` reconstruit
 * alors l'état du lot depuis les événements journalisés. Le point sensible :
 * ce qui vaut ACCEPTATION pour le lot. Fichier séparé du reste du lot V4.6.0,
 * le banc bornant chaque fichier à 10 s. */
async function app(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}
const scope=(extra={})=>({part:23,start:100,end:100,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true,...extra});
// Un lot déjà en cours de validation, tel qu'il est persisté quand le worker meurt.
const enValidation=(adapter,sc)=>({id:'test',state:'RUNNING',step:'validate',scope:{...sc,pageId:adapter.identity.pageId},
  processed:[],skipped:[],paused:[],interrupted:[],sequence:[],activeIdentity:K.clone(adapter.identity)});

test('a restart after an accepted validation credits the cut once and never resends the command',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';await e.analyze();
 const sc=scope();e.s.batch=enValidation(adapter,sc);await e.apply();await e.validateAndNext(sc);
 assert.ok(store.events.some(x=>x.type==='validation-accepted'),'l’acceptation est journalisée');
 const redemarre=new Engine(adapter,store);await redemarre.init();
 assert.equal(redemarre.s.batch.step,'capture');
 assert.equal(redemarre.s.batch.processed.length,1);
 assert.equal(redemarre.s.batch.processed[0].recovered,true);
 assert.equal(redemarre.s.batch.processed[0].cut,100);
 assert.equal(redemarre.s.batch.lastCompletedIdentity.cut,100);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
});

test('a restart after 497 to next non-validated 499 credits 497 once and never invents 498',async()=>{
 const {adapter,store,engine:e}=await app();adapter.identity.cut=497;e.s.mode='automatic-test';await e.analyze();
 const sc=scope({start:497,end:499});e.s.batch=enValidation(adapter,sc);await e.apply();
 adapter.validateAndNext=async()=>{adapter.calls.push('validate');adapter.identity.cut=499;const next=K.completeIdentity(adapter.identity);
  return {operatorDecision:'VALIDATE',decisionCommand:{id:'O2N3DCutValidate3DRail'},navigationSemantics:'VALIDATE_NEXT_NON_VALIDATED_CUT',
   commandSent:true,afterObserved:false,afterStateStatus:'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',serverConfirmed:false,
   navigationObserved:true,nextIdentity:next,navigationAfter:{identity:next}};};
 await e.validateAndNext(sc);const restarted=new Engine(adapter,store);await restarted.init();
 assert.deepEqual(restarted.s.batch.processed.map(x=>x.cut),[497]);assert.equal(restarted.s.batch.processed.some(x=>x.cut===498),false);
 assert.equal(restarted.s.batch.processed[0].evidence.validationProof,'navigation-only');
 assert.equal(adapter.calls.filter(x=>x==='validate').length,1);assert.equal(adapter.calls.includes('skip'),false);
});

/* LE DÉFAUT SIGNALÉ PAR LA REVUE. `validation-observation` est journalisé AVANT
 * les contrôles d'acceptation : s'en servir au redémarrage créditait une
 * navigation inattendue que le moteur venait de refuser. Ici la navigation
 * saute de 100 à 105 — refusée en marche, elle doit le rester après un
 * redémarrage. Ni crédit, ni renvoi de la commande native. */
test('a restart after a refused validation credits nothing and never resends the command',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';await e.analyze();
 const sc=scope(),depart=K.clone(adapter.identity);e.s.batch=enValidation(adapter,sc);await e.apply();
 adapter.validateAndNext=async()=>{adapter.calls.push('validate');await adapter.next();
   return {commandSent:true,afterObserved:false,afterStateStatus:'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',serverConfirmed:false,
     navigationObserved:true,nextIdentity:{...depart,cut:105},navigationAfter:{identity:{...depart,cut:105}}};};
 await assert.rejects(()=>e.validateAndNext(sc),/AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED/);
 // L'état persisté au moment où le worker meurt : une observation, aucune acceptation.
 assert.ok(store.events.some(x=>x.type==='validation-observation'));
 assert.equal(store.events.some(x=>x.type==='validation-accepted'),false);
 const redemarre=new Engine(adapter,store);await redemarre.init();
 assert.equal(redemarre.s.batch.processed.length,0,'une observation ne vaut pas acceptation');
 assert.equal(redemarre.s.batch.state,'PAUSED_AFTER_STATE_MISSING');
 assert.equal(redemarre.s.batch.error.code,'VALIDATION_NOT_ACCEPTED_BEFORE_RESTART');
 assert.equal(redemarre.s.batch.interrupted.at(-1).status,'VALIDATION_NOT_ACCEPTED_BEFORE_RESTART');
 assert.ok(store.events.some(x=>x.type==='batch-validation-not-accepted-on-restart'&&x.counted===false&&x.resent===false));
 // La commande native est irréversible : elle ne se répète pas.
 await assert.rejects(()=>redemarre.resume(),/État final manquant/);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
 assert.equal(redemarre.closureSummary().completed,0);
});

/* Le journal des interruptions était écrasé par un booléen à chaque
 * redémarrage : `closureSummary` lisait alors 0 interruption sur un lot qui en
 * comptait. Le drapeau a son propre champ. */
test('a restart keeps the interruption log instead of overwriting it with a flag',async()=>{
 const {adapter,store,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';
 await e.startBatch(scope());await e.task;
 assert.equal(e.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 await e.retryPaused();await e.task;
 assert.equal(e.s.batch.interrupted.length,1);
 e.s.batch.state='PAUSED';await e.save();
 const redemarre=new Engine(adapter,store);await redemarre.init();
 assert.ok(Array.isArray(redemarre.s.batch.interrupted),'interrupted reste une liste');
 assert.equal(redemarre.s.batch.interrupted.length,1);
 assert.equal(redemarre.s.batch.interruptedByRestart,true);
 assert.equal(redemarre.closureSummary().interrupted,1);
});

/* MANUAL_TAKEOVER est un LOT ACTIF. Le cut est rendu à l'opérateur, mais le lot
 * garde son contexte et reprendra. Rien ne doit le remplacer — et la garantie
 * est dans le moteur, pas dans l'interface : masquer un bouton n'empêche rien.
 * Seuls « Repris manuellement » et « Arrêter » en sortent. */
test('manual takeover is an active batch that no new batch, capture or assisted analysis may replace',async()=>{
 const {adapter,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';
 await e.startBatch(scope({end:101}));await e.task;
 await e.manualTakeover();
 assert.equal(e.s.batch.state,'MANUAL_TAKEOVER');assert.equal(e.batchHoldsContext(),true);
 const contexte=K.clone(e.s.batch);
 /* Le mode est remis à automatic-test pour que le REFUS vienne bien de la garde
  * de contexte, et pas du contrôle de mode qui la suit. */
 e.s.mode='automatic-test';
 await assert.rejects(()=>e.startBatch(scope({end:101})),/Reprise manuelle en cours/);
 await assert.rejects(()=>e.analyze(),/Reprise manuelle en cours/);
 await assert.rejects(()=>e.begin(),/Reprise manuelle en cours/);
 assert.deepEqual(K.clone(e.s.batch),contexte,'le contexte du lot est intact');
 assert.equal(adapter.calls.includes('validate'),false);assert.equal(adapter.calls.includes('skip'),false);
 // Arrêter reste offert et libère le contexte : c'est la sortie sans déclaration.
 await e.stop();assert.equal(e.s.batch.state,'STOPPED');assert.equal(e.batchHoldsContext(),false);
 await e.startBatch(scope({end:101}));assert.equal(e.s.batch.state,'RUNNING');await e.task;
});
