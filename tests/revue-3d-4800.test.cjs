'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — troisième revue : ESV muet sur le cut de fin, rien de posé : clôture propre après l'attente longue. */
test('cut de fin lu une fois puis ESV muet, rien posé : lot clos proprement (KI-061)',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{const st=esv.state.bind(esv);let vu=0;
    esv.state=async(...a)=>{if(esv.identity.cut===103&&++vu>1)throw Error(MUET);return st(...a);};}});
  const view=await r.b.settle();const fin=await finMoteur(r);
  assert.equal(fin.batch.state,'STOPPED');assert.equal(fin.batch.stoppedAtEnd?.reason,'adapter-lost-after-navigation');void view;
});
