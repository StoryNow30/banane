'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const finMoteur=async r=>{let v;for(let i=0;i<400&&(v=await r.b.api('view')).busy;i++)await new Promise(x=>setTimeout(x,10));return v;};
/* 4.8.0 — troisième revue : pause pendant une lecture (étape « analyse »), puis F5. */
test('pause pendant la lecture d\'un cut, puis F5 : reprise sans refus',async()=>{
  let r;r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{esvLent(esv,{lecturesInstables:false});const c=esv.capture.bind(esv);
    esv.capture=async(...a)=>{const x=await c(...a);if(esv.identity.cut===102&&!esv.pause){esv.pause=true;await r.b.api('pause');}return x;};}});
  let view=await r.b.settle();view=await finMoteur(r);assert.equal(view.batch.state,'PAUSED');
  r.b.adapter.onReload();r.b.adapter.identity.cut=102;
  await r.b.api('resume');view=await attendreFin(r);
  assert.ok(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'));assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
