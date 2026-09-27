'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — troisième revue : « adaptateur sans réponse » se règle par F5 puis « Reprendre ». */
test('ESV muet dans la partie jusqu\'à « sans réponse », puis F5 et « Reprendre » : le lot finit',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{esvLent(esv,{lecturesInstables:false});const v=esv.validateAndNext.bind(esv),st=esv.state.bind(esv);let muet=false;
    esv.validateAndNext=async(...a)=>{const e=await v(...a);if(esv.identity.cut===102&&!esv.fait){esv.fait=true;muet=true;}return e;};
    esv.state=async(...a)=>{if(muet&&!esv.recharges)throw Error(MUET);return st(...a);};}});
  await r.b.settle();let view=await finMoteur(r);assert.equal(view.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');
  r.b.adapter.onReload();r.b.adapter.identity.cut=102;
  await r.b.api('resume');view=await attendreFin(r);assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
