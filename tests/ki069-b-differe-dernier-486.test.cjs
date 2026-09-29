'use strict';
/* KI-069 (4.8.6), essai b : N = M−1 différé → aucune commande « suivant »
 * (nextWithoutDecision, engine.js:462) ; le lot se ferme proprement. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dernierCut,differe,appels,navigations}=require('./helpers/dernier-cut.cjs');

test('N = M−1 différé : rien n\'est envoyé à ESV, lot clos, message de la direction',async()=>{
  const {r,view}=await dernierCut({decision:differe});
  assert.deepEqual(navigations(r),[],'aucune commande « suivant »');assert.equal(appels(r,'validateInPlace'),0,'rien n\'est validé non plus');
  assert.equal(appels(r,'apply'),0,'rien n\'est posé');
  assert.equal(r.b.adapter.identity.cut,100);
  assert.equal(view.batch.state,'STOPPED');
  assert.equal(view.notice,'Fin du lot : dernier cut de la partie (100), différé ; rien n’a été envoyé à ESV.');
  assert.equal(view.batch.stoppedAtEnd.issue,'dernier-cut-differe');assert.equal(view.batch.stoppedAtEnd.cut,100);
  assert.equal(view.batch.error??null,null,'ni erreur ni « navigation incertaine »');
  assert.ok(!r.b.store.events.some(e=>e.type==='defer-navigation-uncertain'));
  assert.ok(!r.b.store.events.some(e=>e.type==='defer-command-possible'),'aucune émission possible n\'est consignée : rien n\'est parti');
  assert.equal(view.deferPending??null,null,'aucune intention de navigation ouverte');
});
test('le journal garde le cut différé du dernier cut, sans le compter comme différé confirmé',async()=>{
  const {r,view}=await dernierCut({decision:differe});
  const e=r.b.store.events.find(x=>x.type==='dernier-cut-differe');assert.ok(e);assert.equal(e.cut,100);assert.equal(e.total,101);assert.equal(e.commande,null);
  assert.equal(view.batch.deferred.length,0);
  assert.equal(view.batch.interrupted.at(-1).status,'DEFER_DERNIER_CUT_SANS_ENVOI');
});
