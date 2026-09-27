'use strict';
/* 4.8.0 — revue de code approfondie (ead1cd1..83e2ebe), reprise après un
 * rafraîchissement d'ESV : suite : cut du lot introuvable, silence passager qui
 * n'est pas un rechargement. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';

test('silence passager au moment de « Reprendre » : même page, rien n\'est rattaché, le lot finit',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esvLent});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  const state=r.b.adapter.state.bind(r.b.adapter);let une=true;r.b.adapter.state=async(...a)=>{if(une){une=false;throw Error(MUET);}return state(...a);};
  await r.b.api('resume');view=await attendreFin(r);
  assert.equal(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'),false);assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
