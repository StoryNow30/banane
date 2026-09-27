'use strict';
/* 4.8.0 — ESV rafraîchi pendant un lot : voir tests/helpers/esv-lent.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin}=require('./helpers/esv-lent.cjs');

test('« Reprendre » sans rafraîchissement : même page, rien n\'est rattaché',async()=>{
  const r=await pilote(espion,{start:100,end:103,settings:reglages(),esv:esvLent});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  await r.b.api('resume');view=await attendreFin(r);
  assert.equal(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'),false);
  assert.equal(view.batch.scope.pageId,'fixture-page');assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
