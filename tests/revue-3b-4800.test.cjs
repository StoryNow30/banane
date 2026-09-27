'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — troisième revue : « Pause » pendant l'attente d'un ESV muet, puis ESV revient sur une autre partie. */
test('pause pendant l\'attente, ESV revient sur une autre partie : lot clos proprement, pas en erreur',async()=>{
  let r;r=await pilote(L,{start:100,end:0,endMode:'partie',settings:reglages({rafraichirAuto:false}),esv:esv=>{const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let muet=false,n=0;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);if(!n)muet=true;return e;};
    esv.state=async(...a)=>{if(muet){n++;if(n===2)await r.b.api('pause');if(n<4)throw Error(MUET);muet=false;esv.identity.part=24;esv.identity.cut=1;}return st(...a);};}});
  await r.b.settle();const view=await finMoteur(r);
  assert.equal(view.batch.state,'STOPPED');assert.equal(view.batch.stoppedAtEnd?.reason,'navigation-other-part');
});
