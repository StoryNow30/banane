'use strict';
/* 4.8.0 — ESV rafraîchi pendant un lot : voir tests/helpers/esv-lent.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,DECALAGE}=require('./helpers/esv-lent.cjs');

test('rafraîchissement automatique coupé : pause, puis F5 et « Reprendre » à la main',async()=>{
  const r=await pilote(espion,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esvLent});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');assert.equal(r.b.adapter.recharges??0,0);
  r.b.adapter.onReload();/* F5 de l'opérateur */
  await r.b.api('resume');view=await attendreFin(r);
  assert.ok(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'&&e.auto===false&&e.atteint===102));
  assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
