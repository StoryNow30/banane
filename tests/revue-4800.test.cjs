'use strict';
/* 4.8.0 — constats de la revue de code (ead1cd1..b3aa1ef).
 *  (Le rafraîchissement automatique a été retiré : option 1, D-058.)
 *  Une autre partie ouverte à la main au milieu d'un cut : le lot se clôt,
 *     mais aucune fin de partie n'est retenue. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,reglages,L}=require('./helpers/esv-lent.cjs');

test('autre partie ouverte à la main au milieu d\'un cut : lot clos, aucune fin de partie retenue',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',settings:reglages(),esv:esv=>{const capture=esv.capture.bind(esv);
    esv.capture=async(...a)=>{const c=await capture(...a);if(esv.identity.cut===102){esv.identity.part=24;esv.identity.cut=7;}return c;};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd?.reason,'navigation-other-part');
  assert.equal(await r.b.api('bornes-partie',{part:23}),null,'la fin de la partie 23 reste inconnue');
});
