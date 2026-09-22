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

 * Ce fichier porte : D4 (une seule opération dans l’export). Le banc de `tools/verify.cjs` applique un budget de
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

/* ====================== D4 — UNE SEULE OPÉRATION DANS L'EXPORT ====================== */

/* Construit le scénario Astra : opération A préparée puis interrompue, reprise
 * sur la même proposition, opération B à la navigation incertaine. */
async function scenarioAB(){
 const {store,image}=await runCapturingCrash(toujours,{end:102},s=>s.deferIntent?.phase==='PREPARED');
 assert.ok(image,'la frontière PREPARED a bien été atteinte');
 const operationA=image.state.deferIntent.operationId;
 const repris=restartFromImage(image,{esvCut:100});
 await repris.engine.init();
 repris.adapter.deferOutcome='no-navigation';
 await repris.engine.resume();await repris.engine.task;
 const operationB=repris.engine.s.deferIntent?.operationId??null;
 await ajouterShadow(repris);
 return {premier:store,repris,operationA,operationB};
}

/* T8 — REPRODUCTION. Sur 091462f l'export prenait le dernier événement de
 * CHAQUE type séparément : `deferral.operationId` pouvait valoir A tandis que
 * l'evidence portait B. */
test('T8 · D4 · l’export d’un scénario A/B ne mélange plus deux opérations',async()=>{
 const {repris,operationA,operationB}=await scenarioAB();
 assert.notEqual(operationA,operationB,'deux opérations distinctes existent bien');
 const defer=deferralDe(repris);
 assert.equal(defer.operationId,operationB,'l’opération active persistée est choisie');
 assert.equal(defer.selectedBy,'persisted-active-intent');
 assert.ok(defer.operationIds.includes(operationA)&&defer.operationIds.includes(operationB));
 assert.equal(defer.confirmed,false);
 // Tout sous-champ opérationnel portant une opération porte la MÊME.
 assert.equal(defer.navigationWithoutDecision.evidence?.operationId??operationB,operationB);
 assert.equal(defer.uncertainty?.operationId,operationB);
 assert.equal(defer.ambiguity,null);
});

/* T9 — REPRODUCTION. `store.all('events')` rend les événements par clé UUID :
 * l'ordre du tableau n'est pas une chronologie. Le résultat logique ne doit pas
 * en dépendre. */
test('T9 · D4 · le résultat exporté est indépendant de l’ordre de lecture des événements',async()=>{
 const {repris,operationB}=await scenarioAB();
 const base=repris.store.events.map(e=>K.clone(e));
 const ordres={
  naturel:base,
  lexicalUuid:base.slice().sort((a,b)=>String(a.eventId).localeCompare(String(b.eventId))),
  inverseUuid:base.slice().sort((a,b)=>String(b.eventId).localeCompare(String(a.eventId))),
  inverse:base.slice().reverse(),
  melange:base.slice().sort((a,b)=>String(a.type).localeCompare(String(b.type))),
 };
 const resultats=new Map();
 for(const [nom,events] of Object.entries(ordres)){
  const defer=deferralDe(repris,{events});
  // Tout l'objet exporté est comparé, pas une sélection de champs : aucun ne
  // doit dépendre de l'ordre de lecture, pas même les listes d'identifiants.
  resultats.set(nom,JSON.stringify(defer));
 }
 assert.equal(new Set(resultats.values()).size,1,'un seul résultat logique : '+JSON.stringify([...resultats]));
 assert.match([...resultats.values()][0],new RegExp(operationB));
});

/* T9b — CONTRAT. Timestamps identiques, doublons et événements historiques sans
 * `operationId` : le résultat reste stable et l'ambiguïté reste explicite. */
test('T9b · D4 · timestamps égaux, doublons et événements legacy restent stables',async()=>{
 const {repris,operationB}=await scenarioAB();
 const base=repris.store.events.map(e=>K.clone(e));
 const horodatage='2026-09-21T00:00:00.000Z';
 const egaux=base.map(e=>e.type.startsWith('defer-')?{...e,timestamp:horodatage}:e);
 const doublons=[...egaux,...egaux.filter(e=>e.type.startsWith('defer-')).map(e=>K.clone(e))];
 const legacy=[...doublons,{eventId:'legacy-1',timestamp:horodatage,type:'defer-intent',
  identity:K.clone(base.find(e=>e.type==='defer-intent').identity),
  proposalId:base.find(e=>e.type==='defer-intent').proposalId,batchId:repris.engine.s.batch.id}];
 const rendu=events=>deferralDe(repris,{events});
 const avecDoublons=rendu(doublons);
 assert.equal(avecDoublons.operationId,operationB);
 assert.equal(avecDoublons.ambiguity,null);
 const avecLegacy=rendu(legacy);
 assert.equal(avecLegacy.operationId,operationB,'un événement sans opération n’en devient pas une');
 assert.equal(avecLegacy.legacyEventsWithoutOperationId,1,'il est compté et exposé');
 // Ordre inversé : même verdict.
 assert.equal(rendu(legacy.slice().reverse()).operationId,operationB);
 assert.equal(rendu(legacy.slice().reverse()).legacyEventsWithoutOperationId,1);
});

/* T9c — CONTRAT. Deux opérations, aucune finalisation, aucune intention
 * persistée : rien ne permet de trancher, et l'export le dit au lieu d'en
 * choisir une. */
test('T9c · D4 · une ambiguïté non résoluble est exportée telle quelle',async()=>{
 const {repris,operationA,operationB}=await scenarioAB();
 const events=repris.store.events.map(e=>K.clone(e));
 const sansIntention={...repris.engine.view(),deferIntent:null};
 const defer=deferralDe(repris,{events,state:sansIntention});
 assert.equal(defer.status,'DEFER_AMBIGUOUS');
 assert.equal(defer.confirmed,false);
 assert.equal(defer.operationId,null,'aucune opération n’est choisie arbitrairement');
 assert.equal(defer.ambiguity.reason,'MULTIPLE_OPERATIONS_NO_DURABLE_SELECTOR');
 assert.deepEqual(defer.ambiguity.operationIds.slice().sort(),[operationA,operationB].sort());
 assert.equal(defer.navigationWithoutDecision,null,'aucun champ opérationnel mélangé');
 // Le verdict ne dépend pas de l'ordre du tableau.
 const inverse=deferralDe(repris,{events:events.slice().reverse(),state:sansIntention});
 assert.equal(inverse.ambiguity.reason,'MULTIPLE_OPERATIONS_NO_DURABLE_SELECTOR');
});

/* T9d — CONTRAT. Une finalisation durable tranche, même si une autre opération
 * a laissé des traces sur la même proposition. */
test('T9d · D4 · une finalisation durable désigne l’opération, quel que soit l’ordre',async()=>{
 const {image}=await runCapturingCrash(toujours,{end:100},s=>s.deferIntent?.phase==='PREPARED');
 const operationA=image.state.deferIntent.operationId;
 const repris=restartFromImage(image,{esvCut:100});await repris.engine.init();
 await repris.engine.resume();await repris.engine.task;
 const finale=finalEvents(repris.store)[0];
 assert.ok(finale&&finale.operationId!==operationA,'la reprise a finalisé une seconde opération');
 await ajouterShadow(repris);
 for(const events of [repris.store.events,repris.store.events.slice().reverse()]){
  const defer=deferralDe(repris,{events:events.map(e=>K.clone(e))});
  assert.equal(defer.operationId,finale.operationId);
  assert.equal(defer.selectedBy,'durable-finalization');
  assert.equal(defer.confirmed,true);
  assert.equal(defer.ambiguity,null);
 }
 assert.equal(counts(repris.adapter).nextWithoutDecision,1,'une seule navigation sur la reprise');
});

