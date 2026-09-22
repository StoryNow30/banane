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

 * Ce fichier porte : les neuf frontières de crash et les invariants conservés. Le banc de `tools/verify.cjs` applique un budget de
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

/* ==================== T10 — LES NEUF FRONTIÈRES DE CRASH ==================== */

/* Chaque frontière est rejouée depuis une photographie fidèle. On rapporte
 * séparément le RÉSULTAT LOCAL reconstruit et ce que l'on sait de l'effet ESV :
 * une commande ayant pu partir n'est jamais présentée comme non émise. */
test('T10 · aucun rejeu aux neuf frontières du protocole',async()=>{
 const frontieres=[
  ['1-avant-persistance-intention',s=>s.batch?.step==='apply'&&!s.deferIntent,100],
  ['2-PREPARED-durable',s=>s.deferIntent?.phase==='PREPARED',100],
  ['3-marqueur-emission-possible',s=>s.deferIntent?.phase==='COMMAND_MAY_HAVE_BEEN_SENT'&&!s.deferIntent.evidence,100],
  ['8-OBSERVED-durable',s=>s.deferIntent?.phase==='OBSERVED',101],
  ['9-FINALIZED-durable',s=>s.deferIntent?.phase==='FINALIZED',101],
 ];
 const rapport=[];
 for(const [nom,frontiere,cut] of frontieres){
  const {image}=await runCapturingCrash(toujours,{end:100},frontiere);
  assert.ok(image,'frontière atteinte : '+nom);
  const repris=restartFromImage(image,{esvCut:cut});await repris.engine.init();
  assert.equal(counts(repris.adapter).nextWithoutDecision,0,nom+' : aucun rejeu');
  assert.equal(counts(repris.adapter).validate,0,nom);
  assert.equal(counts(repris.adapter).skip,0,nom);
  assert.equal(counts(repris.adapter).apply,0,nom);
  assert.ok(repris.engine.s.batch.deferred.length<=1,nom+' : au plus un deferred');
  rapport.push({frontiere:nom,deferredLocal:repris.engine.s.batch.deferred.length,
   etat:repris.engine.s.batch.state,
   effetEsvConnu:repris.engine.s.deferIntent?(repris.engine.s.deferIntent.commandInvoked??'unknown'):'n/a'});
 }
 // Frontières 4 à 7 : l'appel adaptateur lui-même, reproduites par une doublure
 // qui échoue à chaque étape sans que le moteur puisse distinguer l'effet.
 for(const [nom,outcome,cut] of [['4-pendant-appel-avant-effet','target-mismatch',100],
   ['5-apres-effet-avant-accuse','throw',101],['6-apres-accuse-avant-observation','no-navigation',100],
   ['7-observation-sans-acceptation','target-mismatch',100]]){
  const Engine=EngineWith(toujours),adapter=new SimulatedESV(),store=new CrashStore();
  const engine=new Engine(adapter,store);adapter.deferOutcome=outcome;
  await engine.init();engine.s.mode='automatic-test';
  await engine.startBatch(scope({end:100}));await engine.task;
  const repris=restartFromImage(store.image(),{esvCut:cut});await repris.engine.init();
  assert.equal(counts(repris.adapter).nextWithoutDecision,0,nom+' : aucun rejeu');
  assert.equal(repris.engine.s.batch.deferred.length,0,nom);
  rapport.push({frontiere:nom,deferredLocal:0,etat:repris.engine.s.batch.state,
   effetEsvConnu:repris.engine.s.deferIntent?.commandInvoked??'n/a'});
 }
 assert.equal(rapport.length,9,'les neuf frontières sont rejouées');
 // Trace lisible dans la sortie TAP : résultat local vs connaissance de l'effet ESV.
 console.log('# T10 '+JSON.stringify(rapport));
});

/* ==================== INVARIANTS FONCTIONNELS CONSERVÉS ==================== */

/* T11 — 549 → 552 : aucun cut intermédiaire inventé. */
test('T11 · 549 vers 552 ne crée que 549 differed',async()=>{
 const {engine,adapter}=await pilot(byCut({549:unresolved(),default:candidate()}),
  {start:549,end:552},({adapter})=>{adapter.deferJump=3;});
 const b=engine.s.batch;
 assert.deepEqual(b.deferred.map(d=>d.cut),[549]);
 const touches=[...b.processed,...b.skipped,...b.deferred,...(b.manuallyCompleted||[])].map(x=>x.cut);
 assert.equal(touches.includes(550),false);assert.equal(touches.includes(551),false);
 assert.equal(counts(adapter).nextWithoutDecision,1);
});

/* T12 — G8.1 : les deux verdicts VALIDATE et le saut terrain 512 → 549. */
test('T12 · G8.1 · les verdicts VALIDATE et le saut 512 vers 549 sont inchangés',async()=>{
 const Engine=EngineWith(byCut({default:candidate()}));
 const engine=new Engine(new SimulatedESV(),new MemoryStore());
 const identity={pageId:'p',part:23,cut:512,shape:'U50',frameId:'f',projectId:null};
 const verdict=e=>engine.expectedTransition(identity,e,{part:23}).reason;
 assert.equal(verdict({navigationObserved:true,nextIdentity:{...identity,cut:513}}),
  'IMMEDIATE_SUCCESSOR_SAME_PAGE_AND_PART');
 assert.equal(verdict({navigationObserved:true,nextIdentity:{...identity,cut:549},operatorDecision:'VALIDATE',
  navigationSemantics:'VALIDATE_NEXT_NON_VALIDATED_CUT',decisionCommand:{id:'O2N3DCutValidate3DRail'}}),
  'NEXT_NON_VALIDATED_CUT_SAME_PAGE_AND_PART');
 assert.equal(verdict({navigationObserved:true,nextIdentity:{...identity,cut:549}}),'CUTS_SKIPPED');
 // Aucun cut intermédiaire n'est représenté par ce saut.
 const transition=engine.expectedTransition(identity,{navigationObserved:true,nextIdentity:{...identity,cut:549},
  operatorDecision:'VALIDATE',navigationSemantics:'VALIDATE_NEXT_NON_VALIDATED_CUT',
  decisionCommand:{id:'O2N3DCutValidate3DRail'}},{part:23});
 assert.equal(transition.observed.cut,549);
 // Le chemin deferred a son propre contrat et ne se substitue pas à VALIDATE.
 assert.equal(engine.deferTransition(identity,{navigationObserved:true,nextIdentity:{...identity,cut:549}},{part:23}).reason,
  'NEXT_CUT_WITHOUT_DECISION_SAME_PAGE_AND_PART');
});

/* T13 — candidate/unresolved : aucune application partielle, aucune décision. */
test('T13 · candidate à gauche, unresolved à droite : cut entier différé sans décision',async()=>{
 const {engine,adapter,store}=await pilot(byCut({default:unresolved(['right'])}));
 assert.deepEqual(counts(adapter),{apply:0,validate:0,skip:0,nextWithoutDecision:1,capture:1});
 const entry=engine.s.batch.deferred[0];
 assert.equal(entry.rails.left.status,'candidate');assert.equal(entry.rails.right.status,'unresolved');
 assert.equal(engine.s.batch.processed.length,0);assert.equal(engine.s.batch.skipped.length,0);
 const record=store.records.find(r=>r.format==='banane-deferred-unresolved-v1');
 assert.equal(record.applyCommandSent,false);assert.equal(record.validationCommandSent,false);
 assert.equal(record.skipCommandSent,false);assert.equal(record.bananeValidated,false);
});

/* T14 — le chemin explicit SKIP reste entièrement distinct du report. */
test('T14 · explicit SKIP et deferred restent des chemins séparés',async()=>{
 const {engine,adapter,store}=await pilot(toujours,{unresolvedPolicy:'pause'});
 assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 await engine.skipPaused();
 assert.equal(engine.s.batch.skipped.length,1);
 assert.equal(engine.s.batch.deferred.length,0,'aucun deferred sur un SKIP explicite');
 assert.equal(counts(adapter).nextWithoutDecision,0,'le SKIP ne passe pas par la navigation sans décision');
 assert.equal(store.events.some(e=>e.type.startsWith('defer-')),false,'aucun événement deferred');
 const skip=store.records.find(r=>r.format==='banane-automatic-skip-v1');
 assert.equal(skip.decision,'SKIP');
 assert.equal(store.records.some(r=>r.format==='banane-deferred-unresolved-v1'),false);
 // Et réciproquement : un deferred n'apparaît jamais dans `skipped`.
 const differe=await pilot(toujours);
 assert.equal(differe.engine.s.batch.deferred.length,1);
 assert.equal(differe.engine.s.batch.skipped.length,0);
 assert.equal(differe.adapter.calls.includes('skip'),false);
});

