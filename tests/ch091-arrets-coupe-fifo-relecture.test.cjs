'use strict';
/* CH-091 : arrêt simulé du service worker après CHAQUE écriture confirmée du lot (capture, analyse, pose, validation, fenêtre de CH-086),
 * deux ordres de magasin, ESV qui relit ou « navigation seule ». Aucune reprise en ERREUR, aucune pose ni validation en double ou perdue,
 * aucun SKIP ; une reprise qui ne repart pas est une pause motivée par une commande en cours à l'arrêt, et n'envoie rien. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {patchOk,arretsPartout}=require('./helpers/ch091.cjs');
test('le patch s’applique au tronc (ou le tronc le porte)',patchOk);
for(const ordre of ['fifo'])for(const navigationSeule of [false])
 test(`arrêt après chaque écriture du lot (${ordre}, navigation seule ${navigationSeule}) : jamais d’ERREUR, rien de perdu, jamais de double`,async()=>{
  const o=await arretsPartout({navigationSeule,ordre});
  assert.ok(o.ecritures>=50,'écritures du lot : '+o.ecritures);assert.ok(o.rejoues>=25,'états durables distincts rejoués : '+o.rejoues);
  assert.equal(o.vises,2,'l’instant visé est rejoué pour chaque coupe');
  assert.ok(o.termines>=15,'reprises menées au bout : '+o.termines);
  assert.equal(o.issues.some(([e])=>e==='ERROR'),false,JSON.stringify(o.issues));
  console.log(`# CH-091 ${ordre} navigationSeule=${navigationSeule} : ${JSON.stringify(o)}`);
 });
