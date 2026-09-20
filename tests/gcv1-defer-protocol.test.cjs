/* BANANE 4.7 — DIFFÉRER UN UNRESOLVED GCV1.
 *
 * Ce que ces essais démontrent : qu'un cut réellement non résolu par GCV1 peut
 * être quitté par une NAVIGATION SANS DÉCISION, qu'il est enregistré une fois,
 * et que rien d'autre ne l'est. Ce qu'ils ne démontrent PAS : le comportement
 * d'ESV lui-même. Une doublure ESV ne prouve pas ce qu'ESV fait, et aucun essai
 * de ce banc n'exécute le raccourci clavier réel.
 *
 * L'équivalence Maj+Z ↔ O2N3DCutNextInvalid3DRail, elle, ne dépend plus de ce
 * banc : elle a été établie le 20/09/2026 par inspection du JavaScript ESV
 * chargé dans Edge (voir `shortcutEquivalence` dans src/adapter-page.js et
 * D-4.7b de DECISIONS.md). Ce qui reste à vérifier sur le terrain est le
 * déroulé complet du report en session réelle — procédure dans CHANGELOG.md.
 *
 * Le banc est découpé en trois fichiers pour tenir le budget de temps par
 * fichier de tools/verify.cjs ; le harnais commun est dans tests/helpers/defer.cjs.
 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {G,K,GCV1,MemoryStore,SimulatedESV,EngineWith,candidate,unresolved,scope,byCut,pilot,counts,restartFrom}=require('./helpers/defer.cjs');

/* ------------------------------------------------------------ Identités, bornes */

test('549 vers 552 ne crée que 549 differed ; 550 et 551 n’entrent nulle part',async()=>{
 const {engine,adapter}=await pilot(byCut({549:unresolved(),default:candidate()}),{start:549,end:552},({adapter})=>{adapter.deferJump=3;});
 const b=engine.s.batch;
 assert.deepEqual(b.deferred.map(x=>x.cut),[549]);
 assert.equal(b.deferred[0].nextIdentity.cut,552);
 const touches=[...b.processed,...b.skipped,...b.deferred,...(b.manuallyCompleted||[])].map(x=>x.cut);
 assert.equal(touches.includes(550),false);assert.equal(touches.includes(551),false);
 assert.equal(b.processed[0].cut,552,'le lot reprend sur la cible réellement observée');
});

test('600 différé au-delà de la borne termine le lot sans toucher 604',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{start:600,end:600},({adapter})=>{adapter.deferJump=4;});
 assert.deepEqual(engine.s.batch.deferred.map(x=>x.cut),[600]);
 assert.equal(engine.s.batch.deferred[0].nextIdentity.cut,604);
 assert.equal(engine.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
 assert.deepEqual(counts(adapter),{apply:0,validate:0,skip:0,nextWithoutDecision:1,capture:1});
 assert.equal(engine.closureSummary().deferred,1);
});

test('une cible au-delà de la borne termine le lot même quand la source y est encore',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{start:599,end:600},({adapter})=>{adapter.deferJump=5;});
 assert.deepEqual(engine.s.batch.deferred.map(x=>x.cut),[599]);
 assert.equal(engine.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
 assert.equal(counts(adapter).capture,1,'le cut 604 n’est ni capturé ni analysé');
});

test('page ou part différente, retour arrière, cut identique et identité incomplète sont refusés',async()=>{
 const cas=[
  ['PART_CHANGED',i=>({...i,part:i.part+1,cut:i.cut+1})],
  ['PAGE_CHANGED',i=>({...i,pageId:'autre-page',cut:i.cut+1})],
  ['BACKWARD_MOVE',i=>({...i,cut:i.cut-1})],
  ['NO_FORWARD_MOVE',i=>({...i})],
  ['NEXT_IDENTITY_INCOMPLETE',i=>({pageId:i.pageId,cut:i.cut+1})],
 ];
 for(const [attendu,muter] of cas){
  const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{
   const natif=adapter.nextWithoutDecision.bind(adapter);
   adapter.nextWithoutDecision=async(identity,s,op)=>{const e=await natif(identity,s,op);
    const cible=muter(K.completeIdentity(identity));
    return {...e,nextIdentity:cible,navigationAfter:{identity:cible}};};
  });
  assert.equal(engine.s.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN',attendu);
  assert.equal(engine.s.batch.error.code,'DEFER_TRANSITION_REFUSED',attendu);
  assert.equal(engine.s.batch.deferred.length,0,attendu);
  assert.equal(engine.s.batch.interrupted.at(-1).transition,attendu);
  assert.equal(counts(adapter).nextWithoutDecision,1,attendu+' : aucune seconde navigation');
 }
});

/* -------------------------------------------------------------- Pas de progression */

test('une commande de navigation indisponible ne diffère rien et ne se replie sur aucune décision',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{adapter.deferOutcome='unavailable';});
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL','la non-émission est PROUVÉE : retour à la pause historique');
 assert.equal(engine.s.batch.error.code,'DEFER_NAVIGATION_NOT_EMITTED');
 assert.deepEqual(counts(adapter),{apply:0,validate:0,skip:0,nextWithoutDecision:1,capture:1});
 assert.equal(engine.s.batch.deferred.length,0);
 assert.deepEqual(engine.s.batch.paused[0].actions,['RETRY','MANUAL_TAKEOVER','EXPLICIT_SKIP','STOP']);
 assert.equal(engine.s.batch.paused[0].deferAttempt.commandInvoked,false);
 assert.equal(engine.s.deferIntent,null,'aucune incertitude conservée quand la non-émission est prouvée');
});

test('une absence de progression après commande reste incertaine, sans deferred ni renvoi',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{adapter.deferOutcome='no-navigation';});
 assert.equal(engine.s.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');
 assert.equal(engine.s.batch.error.code,'DEFER_NO_PROGRESS');
 assert.equal(engine.s.batch.deferred.length,0);assert.equal(engine.closureSummary().deferred,0);
 assert.equal(counts(adapter).nextWithoutDecision,1);
 assert.equal(engine.s.deferIntent.phase,'COMMAND_MAY_HAVE_BEEN_SENT');
 assert.equal(engine.s.deferIntent.commandInvoked,true);
 await assert.rejects(()=>engine.resume(),/Navigation différée incertaine/);
 assert.equal(counts(adapter).nextWithoutDecision,1,'la reprise ne renvoie rien');
});

test('une erreur de transport laisse l’émission INCONNUE, jamais un faux négatif',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{adapter.deferOutcome='throw';});
 assert.equal(engine.s.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');
 assert.equal(engine.s.deferIntent.commandInvoked,'unknown');
 assert.equal(engine.s.batch.deferred.length,0);
 assert.equal(counts(adapter).nextWithoutDecision,1);
});

test('une incertitude de navigation se clôture explicitement et bloque le cut',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{adapter.deferOutcome='no-navigation';});
 const cut=engine.s.batch.activeIdentity;
 await engine.closeUncertain();
 assert.equal(engine.s.deferIntent,null);assert.equal(engine.s.batch.state,'STOPPED');
 assert.ok(engine.s.blockedTargets.includes(K.key(cut)));
 assert.equal(engine.s.batch.interrupted.at(-1).status,'DEFER_NAVIGATION_CLOSED_BY_OPERATOR');
 assert.equal(counts(adapter).nextWithoutDecision,1);
});

/* ------------------------------------------------------------------- Stockage */

test('un échec d’écriture AVANT le marqueur d’émission n’envoie aucune commande',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 store.onSetState=s=>{if(s.deferIntent?.phase==='PREPARED'){store.onSetState=null;throw Error('stockage indisponible');}};
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 assert.equal(engine.s.batch.state,'ERROR');assert.match(engine.s.batch.error.message,/stockage indisponible/);
 assert.deepEqual(counts(adapter),{apply:0,validate:0,skip:0,nextWithoutDecision:0,capture:1});
 assert.equal(engine.s.batch.deferred.length,0);
});

test('un échec d’écriture APRÈS une émission possible ne répète rien et n’enchaîne pas',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 store.onSetState=s=>{if(s.deferIntent?.phase==='COMMAND_MAY_HAVE_BEEN_SENT'&&s.deferIntent.evidence){
  store.onSetState=null;throw Error('stockage indisponible après émission');}};
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope({end:102}));await engine.task;
 assert.equal(counts(adapter).nextWithoutDecision,1,'aucune répétition de la commande');
 assert.equal(engine.s.batch.deferred.length,0,'aucun deferred sans checkpoint cohérent');
 assert.equal(counts(adapter).capture,1,'le lot n’enchaîne pas sur un cut suivant');
 const repris=restartFrom(store.state,store,Engine,adapter);
 await repris.engine.init();
 assert.equal(repris.engine.s.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');
 assert.equal(counts(adapter).nextWithoutDecision,1,'le redémarrage ne renvoie pas la commande');
});

/* --------------------------------------------------------------------- Crashs */

test('redémarrage APRÈS le marqueur mais AVANT l’appel : incertain, jamais renvoyé',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 let avantAppel=null;
 const natif=adapter.nextWithoutDecision.bind(adapter);
 adapter.nextWithoutDecision=async(...args)=>{avantAppel=avantAppel??K.clone(store.state);return natif(...args);};
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 assert.equal(avantAppel.deferIntent.phase,'COMMAND_MAY_HAVE_BEEN_SENT','le marqueur est écrit AVANT l’appel');
 const appelsAvant=counts(adapter).nextWithoutDecision;
 const repris=restartFrom(avantAppel,store,Engine,adapter);await repris.engine.init();
 assert.equal(repris.engine.s.batch.state,'PAUSED_DEFER_NAVIGATION_UNCERTAIN');
 assert.equal(repris.engine.s.batch.deferred.length,0);
 assert.equal(repris.engine.s.batch.interrupted.at(-1).status,'DEFER_NAVIGATION_UNCERTAIN');
 assert.equal(repris.engine.s.batch.interrupted.at(-1).commandInvoked,'unknown');
 assert.equal(counts(adapter).nextWithoutDecision,appelsAvant,'aucun renvoi automatique de la navigation');
 await assert.rejects(()=>repris.engine.resume(),/Navigation différée incertaine/);
});

test('redémarrage sur un état PRÉPARÉ : l’invariant prouve la non-émission, le cut est réévalué',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 let prepare=null;store.onSetState=s=>{if(s.deferIntent?.phase==='PREPARED')prepare=prepare??K.clone(s);};
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 const appels=counts(adapter).nextWithoutDecision;
 const repris=restartFrom(prepare,store,Engine,adapter);await repris.engine.init();
 assert.equal(repris.engine.s.deferIntent,null);
 assert.equal(repris.engine.s.batch.state,'PAUSED','remise en pause de redémarrage, sans état incertain');
 assert.equal(repris.engine.s.batch.interrupted.at(-1).status,'DEFER_INTENT_NOT_EMITTED');
 assert.equal(repris.engine.s.batch.interrupted.at(-1).commandInvoked,false);
 assert.equal(counts(adapter).nextWithoutDecision,appels);
});

test('redémarrage entre observation durable et finalisation : écritures locales complétées, rien commandé',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 let observe=null;store.onSetState=s=>{if(s.deferIntent?.phase==='OBSERVED')observe=observe??K.clone(s);};
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 const appels=counts(adapter).nextWithoutDecision;
 const repris=restartFrom(observe,store,Engine,adapter);await repris.engine.init();
 assert.equal(repris.engine.s.deferIntent,null,'l’intention n’est effacée qu’après une finalisation durable');
 assert.equal(repris.engine.s.batch.deferred.length,1);
 assert.equal(repris.engine.s.batch.deferred[0].recovered,true);
 assert.equal(repris.engine.s.batch.deferred[0].cut,100);
 assert.equal(repris.engine.s.batch.activeIdentity.cut,101,'le checkpoint de reprise est la cible acceptée');
 assert.equal(repris.engine.s.batch.step,'capture');
 assert.equal(counts(adapter).nextWithoutDecision,appels,'aucune commande ESV pendant la récupération');
 assert.equal(repris.store.records.filter(r=>r.format==='banane-deferred-unresolved-v1').length,1);
});

test('redémarrage APRÈS finalisation : une seule entrée, aucun rejeu',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 const appels=counts(adapter).nextWithoutDecision,fige=K.clone(store.state);
 for(let i=0;i<3;i++){const repris=restartFrom(fige,store,Engine,adapter);await repris.engine.init();
  assert.equal(repris.engine.s.batch.deferred.length,1);
  assert.equal(repris.engine.s.deferIntent,null);
  assert.equal(counts(adapter).nextWithoutDecision,appels);}
});

/* ---------------------------------------------------------------- Idempotence */

test('une observation acceptée finalisée deux fois ne crée ni seconde entrée ni second enregistrement',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 let observe=null;store.onSetState=s=>{if(s.deferIntent?.phase==='OBSERVED')observe=observe??K.clone(s);};
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 const repris=restartFrom(observe,store,Engine,adapter);await repris.engine.init();
 // Rejouer la même observation : l'opération est la clé de déduplication.
 repris.engine.s.deferIntent=K.clone(observe.deferIntent);
 await repris.engine.finalizeDefer(repris.engine.s.batch,{recovered:true});
 assert.equal(repris.engine.s.batch.deferred.length,1);
 assert.equal(repris.store.records.filter(r=>r.format==='banane-deferred-unresolved-v1').length,1);
 assert.equal(repris.engine.s.records.filter(r=>r.format==='banane-deferred-unresolved-v1').length,1);
});

test('une seconde opération sur le même cut est refusée, et une intention en cours interdit toute autre',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{adapter.deferOutcome='no-navigation';});
 const b=engine.s.batch;
 await assert.rejects(()=>engine.deferUnresolved({identity:b.activeIdentity},b,{eligible:true,unresolvedRails:['left']}),
  /navigation différée est déjà en cours/);
 assert.equal(counts(adapter).nextWithoutDecision,1);
 await assert.rejects(()=>engine.startBatch(scope()),/Navigation différée non résolue/);
});

/* Les entrées concurrentes réelles sont celles offertes par l'interface :
 * relancer un lot, cliquer plusieurs fois sur Reprendre. Elles sont refusées
 * tant qu'une action est en cours, puis après la clôture du lot. */
test('un second lancement et des reprises répétées n’émettent qu’une seule navigation',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 const lot=engine.startBatch(scope());
 await assert.rejects(()=>engine.startBatch(scope()),/opération est déjà en cours/);
 await assert.rejects(()=>engine.resume(),/action en cours|Aucun lot à reprendre/);
 await lot;await engine.task;
 assert.equal(counts(adapter).nextWithoutDecision,1);
 assert.equal(engine.s.batch.deferred.length,1);
 for(let i=0;i<3;i++)await engine.resume().catch(()=>{});
 await engine.task;
 assert.equal(engine.s.batch.deferred.filter(d=>d.cut===100).length,1);
 assert.equal(counts(adapter).nextWithoutDecision,1);
});

test('revenir sur un cut déjà différé arrête la boucle au lieu de le rejouer',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{end:120},({adapter})=>{
  const natif=adapter.nextWithoutDecision.bind(adapter);
  let premier=true;
  adapter.nextWithoutDecision=async(...args)=>{const e=await natif(...args);
   if(premier){premier=false;adapter.identity.cut=100;}// ESV ramène l'opérateur sur le cut différé
   return e;};
 });
 assert.equal(engine.s.batch.deferred.length,1);
 assert.match(engine.s.notice,/déjà traité/);
 assert.equal(counts(adapter).nextWithoutDecision,1);
});

/* --------------------------------------------------- Intervention opérateur */

test('un arrêt pendant la préparation empêche l’émission ; il ne l’annule jamais après coup',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);
 store.onSetState=async s=>{if(s.deferIntent?.phase==='PREPARED'&&engine.s.batch?.state==='RUNNING')await engine.stop();};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 assert.equal(counts(adapter).nextWithoutDecision,0,'aucune commande après un arrêt encore révocable');
 assert.equal(engine.s.batch.deferred.length,0);
 assert.equal(engine.s.deferIntent,null);
 assert.ok(store.events.some(e=>e.type==='defer-intent-abandoned-before-emission'));
});

test('un arrêt pendant l’attente conserve le résultat incertain et ne redémarre pas le lot',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);
 const natif=adapter.nextWithoutDecision.bind(adapter);
 adapter.nextWithoutDecision=async(...args)=>{await engine.stop();adapter.deferOutcome='no-navigation';return natif(...args);};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 assert.equal(engine.s.batch.state,'STOPPED','un arrêt explicite reste la décision la plus forte');
 assert.equal(engine.s.batch.deferred.length,0);
 assert.ok(engine.s.deferIntent,'l’intention n’est pas effacée avant résolution');
 await assert.rejects(()=>engine.resume(),/Navigation différée non résolue/);
 assert.equal(counts(adapter).nextWithoutDecision,1);
});

test('un arrêt ne rouvre pas les actions ESV quand la non-émission est prouvée',async()=>{
 const Engine=EngineWith(byCut({default:unresolved()})),adapter=new SimulatedESV(),store=new MemoryStore();
 const engine=new Engine(adapter,store);
 const natif=adapter.nextWithoutDecision.bind(adapter);
 adapter.nextWithoutDecision=async(...args)=>{await engine.stop();adapter.deferOutcome='unavailable';return natif(...args);};
 await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope());await engine.task;
 assert.equal(engine.s.batch.state,'STOPPED');
 assert.equal(engine.s.batch.paused.length,0,'aucune pause à actions après un arrêt explicite');
 assert.equal(engine.pausedProposalAction(engine.s.batch),false);
 assert.equal(engine.s.batch.interrupted.at(-1).status,'DEFER_NAVIGATION_NOT_EMITTED');
 assert.equal(engine.s.batch.deferred.length,0);
 assert.equal(engine.s.deferIntent,null,'la non-émission prouvée ne laisse aucune incertitude');
});

test('une cible changée à la main avant l’action est refusée sans commande',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{adapter.deferOutcome='target-mismatch';});
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 assert.equal(engine.s.batch.error.code,'DEFER_NAVIGATION_NOT_EMITTED');
 assert.equal(engine.s.batch.paused[0].deferAttempt.refusal.code,'TARGET_MISMATCH_BEFORE_COMMAND');
 assert.equal(engine.s.batch.deferred.length,0);
});

test('après un échec de navigation prouvé, les quatre actions de l’opérateur restent offertes',async()=>{
 const {engine,adapter}=await pilot(byCut({default:unresolved()}),{end:101},({adapter})=>{adapter.deferOutcome='unavailable';});
 assert.equal(engine.pausedProposalAction(engine.s.batch),true);
 await engine.manualTakeover();
 assert.equal(engine.s.batch.state,'MANUAL_TAKEOVER');
 assert.equal(counts(adapter).nextWithoutDecision,1);
 assert.equal(adapter.calls.includes('validate'),false);assert.equal(adapter.calls.includes('skip'),false);
});
