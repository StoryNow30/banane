'use strict';
/* KI-069 (4.8.6), essai d : Ctrl+Entrée sans effet ou en erreur → arrêt
 * explicite du lot, JAMAIS de repli vers « valider et suivant » sur ce cut. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dernierCut,validationEnPlace,appels,navigations}=require('./helpers/dernier-cut.cjs');
const sansRepli=(r,view)=>{
  assert.equal(appels(r,'validateInPlace'),1,'une seule tentative');assert.deepEqual(navigations(r),[],'jamais « valider et suivant », jamais de navigation');
  assert.equal(r.b.adapter.identity.cut,100);assert.notEqual(view.batch.state,'RUNNING');assert.equal(view.batch.processed.length,0,'rien n\'est compté validé');
  assert.notEqual(view.batch.stoppedAtEnd?.issue,'dernier-cut-valide');};

test('Ctrl+Entrée sans effet (identité inchangée, cut non validé) : arrêt explicite, pose gardée',async()=>{
  const {r,view}=await dernierCut({esv:e=>validationEnPlace(e,{effet:'sans-effet',traites:100,total:101})});
  sansRepli(r,view);assert.match(view.notice,/Ctrl\+Entrée/);assert.match(view.notice,/non validé/);
  assert.match(view.notice,/valide-le toi-même dans ESV/);assert.doesNotMatch(view.notice,/Fin du lot/);
});
test('Ctrl+Entrée en erreur : arrêt explicite, aucun repli',async()=>{
  const {r,view}=await dernierCut({esv:e=>validationEnPlace(e,{effet:'erreur'})});
  sansRepli(r,view);assert.match(view.notice,/Ctrl\+Entrée/);
});
test('le cut a changé après Ctrl+Entrée : arrêt explicite (rien n\'est affirmé)',async()=>{
  const {r,view}=await dernierCut({esv:e=>{validationEnPlace(e,{traites:100,total:101});const f=e.validateInPlace.bind(e);
    e.validateInPlace=async(...a)=>{const x=await f(...a);x.afterState={...x.afterState,identity:{...x.afterState.identity,cut:101}};return x;};}});
  sansRepli(r,view);
});
test('compteur non avancé de 1 (N → N+2) : arrêt explicite',async()=>{
  const {r,view}=await dernierCut({esv:e=>{validationEnPlace(e,{traites:100,total:101});const f=e.validateInPlace.bind(e);
    e.validateInPlace=async(...a)=>{const x=await f(...a);x.compteurApres={traites:102,total:101};return x;};}});
  sansRepli(r,view);
});
