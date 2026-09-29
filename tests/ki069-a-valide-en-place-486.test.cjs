'use strict';
/* KI-069 (4.8.6), essai a : N = M−1, cut posé et vérifié → validation par
 * Ctrl+Entrée relayé (`validateInPlace`). Aucun clic sur « valider et suivant »,
 * aucune commande de navigation, l'identité reste N, le cut est confirmé
 * validé (compteur N → N+1), le lot se ferme par le message de la direction. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dernierCut,appels,navigations}=require('./helpers/dernier-cut.cjs');

test('N = M−1 : Ctrl+Entrée, ni bouton « valider et suivant » ni navigation, lot clos sur le cut',async()=>{
  const {r,view}=await dernierCut();
  assert.equal(appels(r,'apply'),1,'la paire est posée');
  assert.equal(appels(r,'validateInPlace'),1,'validation par le raccourci relayé');
  assert.deepEqual(navigations(r),[],'aucun clic « valider et suivant », aucun suivant, aucun SKIP');
  assert.equal(r.b.adapter.identity.cut,100,'ESV reste sur le dernier cut');assert.equal(r.b.adapter.identity.part,23);
  assert.equal(view.batch.state,'STOPPED');
  assert.equal(view.notice,'Fin du lot : dernier cut de la partie (100) validé ; ESV est resté sur ce cut.');
  assert.equal(view.batch.stoppedAtEnd.cut,100);assert.equal(view.batch.stoppedAtEnd.issue,'dernier-cut-valide');
  assert.equal(view.batch.processed.length,1,'le cut est compté validé');
  const p=view.batch.processed[0];assert.equal(p.evidence.serverConfirmed,true);assert.notEqual(p.evidence.navigationObserved,true,'jamais de navigation affirmée');
  assert.equal(p.evidence.compteurApres.traites,p.evidence.compteurAvant.traites+1);
  assert.ok(r.b.store.events.some(e=>e.type==='validation-accepted'&&e.validationProof==='server-confirmed'),'validation acceptée par le moteur épinglé, sur preuve serveur');
});
test('lot borné au-delà (100 → 101), M = 101 : même chose, clos sans navigation',async()=>{
  const {r,view}=await dernierCut({options:{start:100,end:101,endMode:null}});
  assert.equal(appels(r,'validateInPlace'),1);assert.deepEqual(navigations(r),[]);
  assert.equal(r.b.adapter.identity.cut,100);assert.match(view.notice,/^Fin du lot : dernier cut de la partie \(100\) validé ; ESV est resté sur ce cut\.$/);
  assert.notEqual(view.batch.state,'RUNNING');
});
test('le repli n\'est pas branché par défaut : la commande demandée est « ctrl-entree »',async()=>{
  const {r}=await dernierCut();assert.equal(r.b.adapter.commandes[0].commande,'ctrl-entree');
});
