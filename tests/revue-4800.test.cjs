'use strict';
/* 4.8.0 — constats de la revue de code (ead1cd1..b3aa1ef).
 *  1. « Arrêter » pendant le rafraîchissement automatique d'ESV : le lot ne
 *     doit pas repartir à la fin du rafraîchissement.
 *  2. Une autre partie ouverte à la main au milieu d'un cut : le lot se clôt,
 *     mais aucune fin de partie n'est retenue. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');

test('« Arrêter » pendant le rafraîchissement automatique : le lot reste arrêté',async()=>{
  let r;r=await pilote(espion,{start:100,end:103,settings:reglages(),esv:esv=>{esvLent(esv);const reload=esv.onReload;
    esv.onReload=()=>{reload();void r.b.api('stop');};}});
  const view=await attendreFin(r);await new Promise(x=>setTimeout(x,50));const fin=await r.b.api('view');
  assert.equal(r.b.adapter.recharges,1);assert.equal(fin.batch.state,'STOPPED');
  assert.equal(r.b.adapter.calls.filter(c=>c==='validate').length,1,'rien n\'est validé après l\'arrêt (seul 100 l\'a été)');void view;
});

test('autre partie ouverte à la main au milieu d\'un cut : lot clos, aucune fin de partie retenue',async()=>{
  const r=await pilote(L,{start:100,end:0,endMode:'partie',settings:reglages({rafraichirAuto:false}),esv:esv=>{const capture=esv.capture.bind(esv);
    esv.capture=async(...a)=>{const c=await capture(...a);if(esv.identity.cut===102){esv.identity.part=24;esv.identity.cut=7;}return c;};}});
  const view=await r.b.settle();
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd?.reason,'navigation-other-part');
  assert.equal(await r.b.api('bornes-partie',{part:23}),null,'la fin de la partie 23 reste inconnue');
});
