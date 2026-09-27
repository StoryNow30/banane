'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — quatrième revue : « Pause » pendant l'attente d'un ESV muet sur le cut de fin. */
test('pause pendant l\'attente sur le cut de fin (rien posé) : lot clos proprement, pas « sans réponse »',async()=>{
  let r;r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let muet=false,n=0;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);if(esv.identity.cut===103)muet=true;return e;};
    esv.state=async(...a)=>{if(muet){if(++n===1)await r.b.api('pause');throw Error(MUET);}return st(...a);};}});
  await r.b.settle();const view=await finMoteur(r);
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd?.reason,'adapter-lost-after-navigation');assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
