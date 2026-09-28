'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const COUPE='Could not establish connection. Receiving end does not exist.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — sixième revue : « Arrêter » pendant le retour au cut après F5. */
test('« Arrêter » pendant le retour au cut : le retour cesse, rien n\'est rattaché, le lot reste arrêté',async()=>{
  let r;r=await pilote(espion,{start:100,end:103,settings:reglages(),esv:esvLent});
  await r.b.settle();r.b.adapter.onReload();
  const next=r.b.adapter.next.bind(r.b.adapter);let pas=0;r.b.adapter.next=async(...a)=>{pas++;await r.b.api('stop');return next(...a);};
  await assert.rejects(()=>r.b.api('resume'),/Reprise interrompue/);const view=await finMoteur(r);
  assert.equal(view.batch.state,'STOPPED');assert.equal(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'),false);assert.equal(pas,1);
});
