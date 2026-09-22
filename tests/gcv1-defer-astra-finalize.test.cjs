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

 * Ce fichier porte : D3 (finalisation durable et réparation du journal). Le banc de `tools/verify.cjs` applique un budget de
 * temps PAR FICHIER ; la série Astra est donc répartie, sans qu'aucun essai ne
 * soit retiré ni allégé.
 */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {K,GCV1,MemoryStore,SimulatedESV,EngineWith,candidate,unresolved,scope,byCut,pilot,counts,
 CrashStore,restartFromImage,runCapturingCrash,ajouterShadow,deferralDe}=require('./helpers/defer.cjs');
const {page}=require('./helpers/page.cjs');

const toujours=byCut({default:unresolved()});
const finalEvents=(store,operationId=null)=>store.events.filter(e=>e.type==='defer-finalized'
 &&(!operationId||e.operationId===operationId));
const eventIds=events=>new Set(events.map(e=>e.eventId));

/* ================= D3 — FINALIZED DURABLE, ÉVÉNEMENT FINAL ABSENT ================= */

/* T6 — REPRODUCTION. Sur 091462f, `recoverDefer` effaçait l'intention sans
 * reconstruire l'événement final : le runtime gardait un deferred et son
 * enregistrement tandis que l'export répondait DEFER_NOT_CONFIRMED. */
test('T6 · D3 · un crash après FINALIZED répare le journal et confirme l’export',async()=>{
 const {store,image}=await runCapturingCrash(toujours,{end:102},
  s=>s.deferIntent?.phase==='FINALIZED');
 assert.ok(image,'la frontière FINALIZED a bien été atteinte');
 assert.equal(image.state.deferIntent.phase,'FINALIZED');
 assert.equal(finalEvents(image).length,0,'aucun événement final dans l’image du crash');
 assert.equal(image.state.batch.deferred.length,1,'le deferred, lui, est durable');
 assert.equal(image.records.filter(r=>r.format==='banane-deferred-unresolved-v1').length,1);

 const repris=restartFromImage(image,{esvCut:101});
 await repris.engine.init();
 assert.equal(repris.engine.s.batch.deferred.length,1);
 assert.equal(finalEvents(repris.store).length,1,'exactement un événement final logique');
 assert.equal(repris.engine.s.deferIntent,null);
 assert.equal(counts(repris.adapter).nextWithoutDecision,0,'zéro action ESV pendant la réparation');
 assert.ok(repris.store.events.some(e=>e.type==='defer-final-event-repaired-on-restart'));
 // La provenance vient de l'opération réparée, pas d'un état plus récent.
 const final=finalEvents(repris.store)[0],intention=image.state.deferIntent;
 assert.equal(final.operationId,intention.operationId);
 assert.equal(final.proposalId,intention.proposalId);
 assert.equal(final.lidarCaptureId,intention.lidarCaptureId);
 assert.equal(final.identity.cut,intention.identity.cut);
 assert.equal(final.nextIdentity.cut,intention.nextIdentity.cut);
 assert.deepEqual(final.unresolvedRails,intention.unresolvedRails);

 await ajouterShadow(repris);
 const defer=deferralDe(repris);
 assert.equal(defer.status,'DEFERRED_UNRESOLVED');
 assert.equal(defer.confirmed,true);
 assert.equal(defer.operationId,intention.operationId);
 assert.equal(defer.selectedBy,'durable-finalization');
 assert.equal(defer.ambiguity,null);
});

/* T7 — CONTRAT. Reprises répétées, depuis la même image puis depuis les données
 * déjà réparées : toujours un deferred, un événement final logique, zéro rejeu.
 * L'identifiant déterministe interdit qu'une nouvelle UUID transforme une
 * finalisation unique en plusieurs événements. */
test('T7 · D3 · des reprises répétées ne multiplient ni deferred ni événement final',async()=>{
 const {image}=await runCapturingCrash(toujours,{end:102},s=>s.deferIntent?.phase==='FINALIZED');
 let courant=image;
 for(let tour=0;tour<3;tour++){
  const repris=restartFromImage(courant,{esvCut:101});
  await repris.engine.init();
  assert.equal(repris.engine.s.batch.deferred.length,1,'tour '+tour);
  assert.equal(finalEvents(repris.store).length,1,'tour '+tour);
  assert.equal(eventIds(finalEvents(repris.store)).size,1,'tour '+tour+' : un seul identifiant final');
  assert.equal(counts(repris.adapter).nextWithoutDecision,0,'tour '+tour);
  courant=repris.store.image();
 }
 // Reprise depuis la même image trois fois de suite : résultat logique identique.
 const empreintes=new Set();
 for(let tour=0;tour<3;tour++){
  const repris=restartFromImage(image,{esvCut:101});await repris.engine.init();
  empreintes.add(JSON.stringify(finalEvents(repris.store).map(e=>[e.eventId,e.operationId,e.timestamp,e.status])));
 }
 assert.equal(empreintes.size,1,'le même checkpoint produit toujours le même événement final');
});

/* T7b — CONTRAT. L'événement final est déjà durable, mais le nettoyage de
 * l'intention ne l'est pas encore. Aucune réémission, aucun doublon. */
test('T7b · D3 · un événement final déjà durable n’est pas réémis au redémarrage',async()=>{
 const {store}=await runCapturingCrash(toujours,{end:100},()=>false);
 // Image reconstruite à la main : intention FINALIZED + événement final présent.
 const image=store.image();
 const final=finalEvents(store)[0];assert.ok(final);
 const deferred=image.state.batch.deferred[0];
 image.state.deferIntent={format:'banane-defer-intent-v1',operationId:deferred.operationId,
  batchId:image.state.batch.id,phase:'FINALIZED',identity:deferred.identity,
  nextIdentity:deferred.nextIdentity,proposalId:deferred.proposalId,lidarCaptureId:deferred.lidarCaptureId,
  rails:deferred.rails,unresolvedRails:deferred.unresolvedRails,transition:deferred.transition,
  finalEventId:final.eventId,finalEventEmitted:true,finalizedAt:final.timestamp,
  commandInvoked:deferred.commandInvoked,evidence:deferred.evidence};
 const repris=restartFromImage(image,{esvCut:101});await repris.engine.init();
 assert.equal(finalEvents(repris.store).length,1,'aucun doublon');
 assert.equal(repris.engine.s.deferIntent,null,'l’intention est nettoyée');
 assert.equal(repris.store.events.some(e=>e.type==='defer-final-event-repaired-on-restart'),false,
  'rien à réparer : aucune réémission');
 assert.equal(counts(repris.adapter).nextWithoutDecision,0);
});

