const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js');const {MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
/* Lot V4.6.0 — contrat validation/navigation (défaut 4 d'AUDIT_PILOTE.md) et
 * MANUAL_COMPLETION avec reprise du lot (défaut 9). Fichier séparé de
 * `engine.test.cjs` : ces cas font tourner des lots complets, et le banc borne
 * chaque FICHIER à 10 s. Les réunir dépassait ce budget sous charge. */
async function app(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}
const scope=(extra={})=>({part:23,start:100,end:102,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true,...extra});
/* V4.6.0, défaut 4 d'AUDIT_PILOTE.md. Le bouton de validation d'ESV valide ET
 * navigue : la relecture de l'état final échoue systématiquement, et le lot
 * s'arrêtait au premier cut — 12 lots sur 12 le 15/09. La navigation ATTENDUE
 * vaut désormais avancement quand l'opérateur l'a déclaré au lancement, sans
 * jamais valoir validation : l'enregistrement reste marqué et hors
 * entraînement. La navigation est simulée par l'adaptateur, qui avance d'un
 * cut et ne relit pas l'état final. */
const sansEtatFinal=(adapter,suivant=()=>K.clone(adapter.identity))=>async()=>{
 adapter.calls.push('validate');await adapter.next();
 return {commandSent:true,afterObserved:false,afterStateStatus:'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',
   serverConfirmed:false,navigationObserved:true,nextIdentity:suivant(),navigationAfter:{identity:suivant()}};};
test('expected navigation without an after-state advances the batch, marked and excluded from training',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';adapter.validateAndNext=sansEtatFinal(adapter);
 await e.startBatch(scope());await e.task;
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(e.s.batch.processed.length,3);
 assert.equal(adapter.calls.filter(c=>c==='capture').length,3);assert.equal(adapter.calls.filter(c=>c==='validate').length,3);
 // Ce qui avance n'est jamais déclaré validé : trois enregistrements, tous marqués.
 const suivis=store.records.filter(r=>r.status==='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');
 assert.equal(suivis.length,3);assert.ok(suivis.every(r=>r.usableForTraining===false));
 assert.ok(suivis.every(r=>r.validationProof==='navigation-only'&&r.acceptedOnNavigationEvidence===true));
 assert.ok(suivis.every(r=>r.navigationMatchedExpectedTransition===true&&r.expectedTransition==='IMMEDIATE_SUCCESSOR_SAME_PAGE_AND_PART'));
 assert.deepEqual({commandSent:suivis[0].commandSent,afterObserved:suivis[0].afterObserved,serverConfirmed:suivis[0].serverConfirmed,navigationObserved:suivis[0].navigationObserved},
   {commandSent:true,afterObserved:false,serverConfirmed:false,navigationObserved:true});
 // Aucun lot contenant une action non confirmée ne peut porter « Terminé confirmé ».
 assert.notEqual(e.s.batch.state,'COMPLETED');
});
/* Défaut 10 : conséquence du défaut 4, sans correctif propre. Un lot d'un seul
 * cut ne pouvait pas se terminer, la relecture échouant avant la ligne de fin. */
test('a single-cut batch finishes on expected navigation instead of stalling',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';adapter.validateAndNext=sansEtatFinal(adapter);
 await e.startBatch(scope({end:100}));await e.task;
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(e.s.batch.processed.length,1);
 assert.equal(e.s.batch.processed[0].cut,100);assert.equal(store.records.at(-1).status,'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');
 assert.equal(store.records.at(-1).usableForTraining,false);
});
/* La navigation ne vaut preuve que si elle est CELLE QU'ON ATTEND. Un saut, un
 * retour en arrière, un changement de part ou d'onglet ne valent rien : sans
 * état final relu, le lot s'arrête comme avant V4.6.0. Sans ce contrôle, un
 * saut ferait franchir en silence les cuts sautés. */
test('an unexpected navigation without an after-state stops the batch instead of advancing',async()=>{
 for(const [nom,ecart,raison] of [
   ['saut de cuts',{cut:105},'CUTS_SKIPPED'],
   ['retour en arrière',{cut:99},'NO_FORWARD_MOVE'],
   ['autre part',{part:24,cut:101},'PART_CHANGED'],
   ['autre onglet',{pageId:'autre-page',cut:101},'PAGE_CHANGED']]){
  const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
  const depart=K.clone(adapter.identity);
  adapter.validateAndNext=sansEtatFinal(adapter,()=>({...depart,...ecart}));
  await e.startBatch(scope());await e.task;
  assert.equal(e.s.batch.state,'PAUSED_AFTER_STATE_MISSING',nom);
  assert.equal(e.s.batch.processed.length,0,nom);assert.equal(adapter.calls.filter(c=>c==='capture').length,1,nom);
  const r=store.records.at(-1);
  assert.equal(r.status,'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',nom);assert.equal(r.usableForTraining,false,nom);
  assert.equal(r.navigationMatchedExpectedTransition,false,nom);assert.equal(r.expectedTransition,raison,nom);
  assert.equal(r.acceptedOnNavigationEvidence,false,nom);assert.equal(r.validationProof,'none',nom);
 }
});
test('no observed navigation at all stays ambiguous and is never accepted as evidence',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 adapter.validateAndNext=async()=>{adapter.calls.push('validate');
   return {commandSent:true,afterObserved:false,afterStateStatus:'PENDING',serverConfirmed:false,navigationObserved:false,nextIdentity:null};};
 await e.startBatch(scope());await e.task;
 assert.equal(e.s.batch.state,'ERROR');assert.match(e.s.batch.error.message,/ambigu/);
 assert.equal(e.s.batch.processed.length,0);assert.equal(e.s.reconcileRequired,true);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
 await assert.rejects(()=>e.resume(),/Réconciliation/);
});
/* Défaut 9 : la reprise manuelle ne ramenait jamais le lot en RUNNING — un seul
 * cut ambigu coupait les 22 autres. Elle rend la main, puis reprend. */
test('manual completion resumes the batch and never claims Banane validated the cut',async()=>{
 const {adapter,store,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';
 await e.startBatch(scope({end:101}));await e.task;
 assert.equal(e.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 await e.manualTakeover();assert.equal(e.s.batch.state,'MANUAL_TAKEOVER');assert.equal(e.s.mode,'observation');
 assert.doesNotMatch(e.s.notice,/Mes corrections/);
 // Déclarer sans avoir rien fait dans ESV est refusé : le cut est toujours affiché.
 await assert.rejects(()=>e.manualCompletion(),/toujours affiché/);
 assert.equal(e.s.batch.state,'MANUAL_TAKEOVER');
 adapter.noPoints=false;await adapter.next();
 await e.manualCompletion();await e.task;
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
 assert.equal(e.s.mode,'automatic-test');
 // Le cut repris n'entre pas dans `processed` : seul le cut 101 y figure.
 assert.deepEqual(e.s.batch.processed.map(p=>p.cut),[101]);
 assert.deepEqual(e.s.batch.manuallyCompleted.map(m=>m.cut),[100]);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
 const r=store.records.find(x=>x.operatorDecision==='MANUAL_COMPLETION');
 assert.ok(r);assert.equal(r.status,'operator-manual-completion');assert.equal(r.provenance,'operator-in-esv');
 assert.equal(r.source,'operator-manual-completion-from-automatic-pause');
 assert.deepEqual({bananeValidated:r.bananeValidated,commandSent:r.commandSent,afterObserved:r.afterObserved,
   serverConfirmed:r.serverConfirmed,navigationObserved:r.navigationObserved,validationProof:r.validationProof},
   {bananeValidated:false,commandSent:false,afterObserved:false,serverConfirmed:false,navigationObserved:false,validationProof:'none'});
 assert.equal(r.usableForTraining,false);assert.equal(r.trainingExclusionReason,'operator-manual-completion');
 assert.equal(r.identity.cut,100);
 /* Ce qui est consigné correspond exactement à ce qui est observé : UNE lecture
  * de l'identité affichée au moment de la déclaration. Banane n'a pas vu
  * l'opérateur naviguer et ne l'affirme pas. */
 assert.equal(r.identityReadAtDeclaration.cut,101);
 assert.equal(r.navigationObservedByBanane,false);assert.equal(r.identityIsExpectedSuccessor,true);
 assert.equal(r.identityDifferedFromTakenCut,true);assert.equal(r.transitionAtDeclaration,'IMMEDIATE_SUCCESSOR_SAME_PAGE_AND_PART');
 assert.equal(r.operatorNavigationObserved,undefined,'une observation de navigation qui n’a pas eu lieu ne doit plus être affirmée');
 // Le résumé de clôture ne compte pas ce cut comme une validation de Banane.
 const bilan=e.closureSummary();assert.equal(bilan.completed,1);assert.equal(bilan.manuallyCompleted,1);
 assert.equal(bilan.lastCompletedIdentity.cut,101);assert.equal(bilan.lastManuallyCompletedIdentity.cut,100);
 assert.ok(e.s.events.some(x=>x.type==='batch-manual-completion'&&x.bananeValidated===false));
});
test('manual completion refuses a cut that is not the expected successor',async()=>{
 const {adapter,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';
 await e.startBatch(scope({end:102}));await e.task;await e.manualTakeover();
 await adapter.next();await adapter.next();
 await assert.rejects(()=>e.manualCompletion(),/pas le suivant attendu/);
 assert.equal(e.s.batch.state,'MANUAL_TAKEOVER');assert.equal(e.s.batch.manuallyCompleted?.length??0,0);
});
test('a manually completed cut is never restarted by the batch loop',async()=>{
 const {adapter,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';
 await e.startBatch(scope({end:101}));await e.task;await e.manualTakeover();
 adapter.noPoints=false;await adapter.next();await e.manualCompletion();await e.task;
 assert.equal(e.s.batch.manuallyCompleted.length,1);
 // Le cut 100 est réouvert dans ESV : le lot refuse de le reprendre.
 adapter.identity.cut=100;e.s.batch.state='PAUSED';e.s.batch.step='capture';e.s.before=null;e.s.collection='IDLE';
 await e.resume();await e.task;
 assert.equal(e.s.batch.state,'ERROR');assert.match(e.s.batch.error.message,/déjà traité/);
});
