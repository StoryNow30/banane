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
const {page}=require('./helpers/page.cjs');

/* ------------------------------------------------ Adaptateur réel et bridge */

test('la primitive réelle clique la commande ESV observée, sans VALIDATE ni SKIP',async()=>{
 const f=page(),before=await f.call('state');
 const evidence=await f.call('nextWithoutDecision',before.identity,{part:23,start:100,end:102},'op-1');
 assert.equal(evidence.command.id,'O2N3DCutNextInvalid3DRail');
 assert.equal(evidence.commandInvoked,true);assert.equal(evidence.navigationObserved,true);
 assert.equal(evidence.nextIdentity.cut,101);assert.equal(evidence.nextIdentityComplete,true);
 assert.equal(evidence.operationId,'op-1');
 assert.equal(evidence.operatorDecision,null);
 assert.equal(evidence.bananeValidated,false);assert.equal(evidence.validationCommandSent,false);assert.equal(evidence.skipCommandSent,false);
 // Aucun raccourci clavier relayé : la primitive n'invente pas de décision.
 assert.equal(f.keyboard.length,0);
 assert.equal(evidence.correlation.esvEchoesOperationId,false);
 assert.equal(evidence.correlation.targetVerifiedInPageBeforeCommand,true);
});

/* Garde de non-régression de la MÉTADONNÉE, pas du raccourci lui-même : rien
 * ici n'exécute ESV. L'équivalence Maj+Z ↔ O2N3DCutNextInvalid3DRail a été
 * établie le 20/09/2026 par inspection du JavaScript ESV chargé dans Edge ; cet
 * essai vérifie que la preuve la porte, et qu'elle continue de dire d'où elle
 * vient et ce qu'elle ne garantit pas. */
test('la preuve porte l’équivalence Maj+Z établie, sa source et sa limite de stabilité',async()=>{
 const f=page(),before=await f.call('state');
 const {shortcutEquivalence:eq}=await f.call('nextWithoutDecision',before.identity,{part:23},'op-eq');
 assert.equal(eq.claimedShortcut,'Maj+Z');
 assert.equal(eq.established,true);
 // Les deux chemins observés convergent sur la même fonction native ESV.
 assert.match(eq.basis,/buttonNextInvalidCut\(\)/);
 assert.match(eq.basis,/loadNextInvalidCut\("positive"\)/);
 assert.match(eq.basis,/O2N3DCutNextInvalid3DRail/);
 assert.equal(eq.observedPath.at(-1),'loadNextInvalidCut("positive")');
 assert.equal(eq.buttonPath.at(-1),'loadNextInvalidCut("positive")');
 assert.match(eq.verification,/2026-09-20/);
 // Ni VALIDATE ni SKIP : les chemins décisionnels observés restent distincts.
 assert.match(eq.decisionPathsObservedSeparate.validate,/railPairUpdated.*valid/);
 assert.match(eq.decisionPathsObservedSeparate.skip,/railPairUpdated.*skipped/);
 // Observation du code chargé, pas contrat public : la limite reste écrite.
 assert.match(eq.source,/non documentation fournisseur/);
 assert.match(eq.stability,/susceptibles de changer/);
});

test('la primitive réelle refuse une cible différente avant toute émission',async()=>{
 const f=page(),before=await f.call('state');
 f.nodes.get('O2N3DCutDescription').textContent='Cut 777 of part 23';
 const evidence=await f.call('nextWithoutDecision',before.identity,{part:23},'op-2');
 assert.equal(evidence.commandInvoked,false);
 assert.equal(evidence.refusal.code,'TARGET_MISMATCH_BEFORE_COMMAND');
 assert.equal(evidence.navigationObserved,false);
});

test('la primitive réelle rend une commande absente sans fabriquer de requête',async()=>{
 const f=page(),before=await f.call('state');f.nodes.delete('O2N3DCutNextInvalid3DRail');
 const evidence=await f.call('nextWithoutDecision',before.identity,{part:23},'op-3');
 assert.equal(evidence.commandInvoked,false);assert.equal(evidence.commandSent,false);
 assert.equal(evidence.refusal.code,'NAVIGATION_COMMAND_UNAVAILABLE');
 assert.equal(f.keyboard.length,0);
});

test('la primitive réelle borne l’attente quand le cut ne change pas, sans seconde action',async()=>{
 const f=page(),before=await f.call('state');
 let clics=0;f.nodes.get('O2N3DCutNextInvalid3DRail').click=()=>{clics++;};
 const evidence=await f.call('nextWithoutDecision',before.identity,{part:23},'op-4');
 assert.equal(clics,1,'une seule action, jamais une seconde après le délai');
 assert.equal(evidence.commandInvoked,true);
 assert.equal(evidence.navigationObserved,false);
 assert.equal(evidence.refusal.code,'NO_NAVIGATION_OBSERVED');
});

test('la source de la primitive n’appelle ni apply, ni VALIDATE, ni SKIP, ni raccourci clavier',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/adapter-page.js'),'utf8');
 const body=source.slice(source.indexOf('async function nextWithoutDecision'),source.indexOf('async function decisionAndNext'));
 assert.doesNotMatch(body,/nativeDecision|validateAndNext|skipAndNext|selectors\.validate|KeyboardEvent|clickPosition|apply\(/);
 assert.match(body,/selectors\.next/);
});

test('le bridge n’émet la navigation qu’une fois et ignore une réponse tardive',()=>{
 const {bridge}=require('./helpers/bridge.cjs');
 const f=bridge(),c=f.command('nextWithoutDecision');
 f.deliver(c,{kind:'banane3:progress',stage:'defer-before-command',detail:{}});
 f.timeout(c);
 assert.equal(f.sent.filter(x=>x.action==='nextWithoutDecision').length,1,'aucun renvoi après une réponse perdue');
 assert.equal(f.sent.filter(x=>x.action==='cancel').length,1);
 f.deliver(c,{kind:'banane3:result',result:{navigationObserved:true}});
 assert.equal(c.replies.length,1,'une réponse tardive ne produit pas un second résultat');
});

/* ------------------------------------------------------- Export et résumé */

test('l’export GCV1 expose un différé confirmé, sa provenance et la décision scientifique conservée',async()=>{
 const Export=require('../src/gcv1-export.js');
 const {engine,store}=await pilot(byCut({default:unresolved(['right'])}));
 const proposal=store.events.find(e=>e.type==='proposed').proposal;
 // Observation shadow telle que background.js la journalise, pour que l'export
 // relie la science au résultat opérationnel sans inventer d'association.
 await engine.event('gcv1-shadow-observed',{identity:engine.s.batch.deferred[0].identity,
  sessionId:engine.s.sessionId,batchId:engine.s.batch.id,lidarCaptureId:engine.s.batch.deferred[0].lidarCaptureId,
  proposalId:proposal.id,shadow:{format:'banane-gcv1-shadow-v1',contract:{id:'GEOMETRY_CANDIDATE_V1'},
   selection:{selector:'active-pilot-test',requestedEngine:GCV1,selectedEngine:GCV1,fallback:false},
   rails:{left:{next:{status:'candidate',motif:'candidate'}},right:{next:{status:'unresolved',motif:'ambiguity',reason:'ambigu'}}}}});
 const diagnostic=Export.buildDiagnostic({version:'4.6.0',sessionId:engine.s.sessionId,state:engine.view(),events:store.events});
 const observation=diagnostic.observations.at(-1),defer=observation.runtime.deferral;
 assert.equal(defer.status,'DEFERRED_UNRESOLVED');assert.equal(defer.confirmed,true);
 assert.equal(defer.identity.cut,100);assert.equal(defer.nextIdentity.cut,101);
 assert.equal(defer.proposalId,proposal.id);
 assert.equal(defer.lidarCaptureId,engine.s.batch.deferred[0].lidarCaptureId);
 assert.equal(defer.lidarCaptureStatus,'persisted-on-intent');
 assert.deepEqual(defer.unresolvedRails,['right']);
 assert.equal(defer.navigationWithoutDecision.bananeValidated,false);
 assert.equal(defer.navigationWithoutDecision.validationCommandSent,false);
 assert.equal(defer.navigationWithoutDecision.skipCommandSent,false);
 assert.equal(defer.uncertainty,null);
 // La décision scientifique n'est pas requalifiée par l'issue du pilote.
 assert.equal(observation.runtime.abstention.status,'GCV1_UNRESOLVED');
 assert.deepEqual(observation.runtime.abstention.rails.map(r=>r.side),['right']);
 assert.equal(observation.runtime.validationAccepted,null);
});

test('l’export distingue un différé confirmé d’une intention incertaine',async()=>{
 const Export=require('../src/gcv1-export.js');
 const {engine,store}=await pilot(byCut({default:unresolved()}),{},({adapter})=>{adapter.deferOutcome='no-navigation';});
 const proposal=store.events.find(e=>e.type==='proposed').proposal;
 await engine.event('gcv1-shadow-observed',{identity:engine.s.batch.activeIdentity,sessionId:engine.s.sessionId,
  batchId:engine.s.batch.id,proposalId:proposal.id,shadow:{format:'banane-gcv1-shadow-v1',
   selection:{selector:'active-pilot-test',selectedEngine:GCV1,fallback:false},
   rails:{left:{next:{status:'unresolved',motif:'ambiguity'}},right:{next:{status:'unresolved',motif:'ambiguity'}}}}});
 const diagnostic=Export.buildDiagnostic({version:'4.6.0',sessionId:engine.s.sessionId,state:engine.view(),events:store.events});
 const defer=diagnostic.observations.at(-1).runtime.deferral;
 assert.equal(defer.status,'DEFER_NOT_CONFIRMED');assert.equal(defer.confirmed,false);
 assert.equal(defer.nextIdentity,null);assert.ok(defer.uncertainty);
 assert.equal(defer.navigationWithoutDecision.commandInvoked,true);
});

test('un export antérieur à 4.7 reste lisible, avec deferral absent',()=>{
 const Export=require('../src/gcv1-export.js');
 const ancien=[{eventId:'e1',type:'gcv1-shadow-observed',identity:{pageId:'p',part:23,cut:9,shape:'U50',frameId:'f'},
  batchId:'b1',proposalId:'prop-1',sessionId:'s1',shadow:{format:'banane-gcv1-shadow-v1',
   selection:{selector:'active-pilot-test',selectedEngine:GCV1,fallback:false},rails:{left:{next:{status:'candidate'}},right:{next:{status:'candidate'}}}}}];
 const diagnostic=Export.buildDiagnostic({version:'4.6.0',sessionId:'s1',events:ancien});
 assert.equal(diagnostic.observations.length,1);
 assert.equal(diagnostic.observations[0].runtime.deferral,null);
});

test('les compteurs sont identiques après rechargement et redémarrage',async()=>{
 const Engine=EngineWith(byCut({700:candidate(),701:unresolved(),702:candidate()})),adapter=new SimulatedESV(),store=new MemoryStore();
 adapter.identity.cut=700;
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await engine.startBatch(scope({start:700,end:702}));await engine.task;
 const avant=engine.closureSummary();
 const repris=restartFrom(store.state,store,Engine,adapter);await repris.engine.init();
 const apres=repris.engine.closureSummary();
 assert.equal(apres.deferred,avant.deferred);assert.deepEqual(apres.deferredCuts,avant.deferredCuts);
 assert.equal(apres.completed,avant.completed);assert.equal(apres.skipped,avant.skipped);
 assert.equal(apres.unresolvedPolicy,'defer');assert.equal(apres.deferPending,null);
});

/* ----------------------------------------------------------------- Régression */

test('les deux verdicts de transition VALIDATE restent inchangés',async()=>{
 const Engine=EngineWith(byCut({default:candidate()})),engine=new Engine(new SimulatedESV(),new MemoryStore());
 const identity={pageId:'p',part:23,cut:100,shape:'U50',frameId:'f',projectId:null};
 const suivant=e=>engine.expectedTransition(identity,e,{part:23});
 assert.equal(suivant({navigationObserved:true,nextIdentity:{...identity,cut:101}}).reason,'IMMEDIATE_SUCCESSOR_SAME_PAGE_AND_PART');
 const saut={navigationObserved:true,nextIdentity:{...identity,cut:149},operatorDecision:'VALIDATE',
  navigationSemantics:'VALIDATE_NEXT_NON_VALIDATED_CUT',decisionCommand:{id:'O2N3DCutValidate3DRail'}};
 assert.equal(suivant(saut).reason,'NEXT_NON_VALIDATED_CUT_SAME_PAGE_AND_PART');
 // Un saut SANS cette provenance reste refusé : la navigation sans décision
 // n'assouplit pas le contrat VALIDATE, elle a le sien.
 assert.equal(suivant({navigationObserved:true,nextIdentity:{...identity,cut:149}}).reason,'CUTS_SKIPPED');
 assert.equal(engine.deferTransition(identity,{navigationObserved:true,nextIdentity:{...identity,cut:149}},{part:23}).reason,
  'NEXT_CUT_WITHOUT_DECISION_SAME_PAGE_AND_PART');
});
