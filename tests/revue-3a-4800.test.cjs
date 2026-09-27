'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — troisième revue : F5 après un différé (le cut annoncé n'est pas sauté). */
test('différé, pause, F5 : le lot reprend au cut annoncé après le différé, sans le sauter',async()=>{
  let r;r=await pilote(espion,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{esvLent(esv,{lecturesInstables:false});const n=esv.nextWithoutDecision.bind(esv);
    esv.nextWithoutDecision=async(...a)=>{const e=await n(...a);await r.b.api('pause');return e;};}});
  let view=await r.b.settle();view=await finMoteur(r);assert.equal(view.batch.state,'PAUSED');
  r.b.adapter.onReload();/* ESV repart du premier non validé : 101, le différé. */
  await r.b.api('resume');view=await attendreFin(r);
  const reb=r.b.store.events.find(e=>e.type==='batch-rebased-after-reload');assert.ok(reb);assert.equal(reb.atteint,102,'101 (différé) passé, 102 retrouvé');
  assert.ok(view.batch.processed.some(p=>p.cut===102),'102 traité');assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
