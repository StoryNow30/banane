'use strict';
/* 4.8.0 — seconde revue de code (83e2ebe..82e6e66) : F5 juste après une
 * validation. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');

test('F5 juste après une validation : le lot reprend au premier cut non validé suivant',async()=>{
  let r;r=await pilote(L,{start:100,end:103,settings:reglages(),esv:esv=>{esvLent(esv,{lecturesInstables:false});const v=esv.validateAndNext.bind(esv);
    esv.validateAndNext=async(...a)=>{const e=await v(...a);if(esv.identity.cut===102)await r.b.api('pause');return e;};}});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  /* F5 : ESV rouvre le premier cut non validé, 102. */
  r.b.adapter.onReload();r.b.adapter.identity.cut=102;
  await r.b.api('resume');view=await attendreFin(r);
  const reb=r.b.store.events.find(e=>e.type==='batch-rebased-after-reload');
  assert.ok(reb,'lot rattaché');assert.equal(reb.atteint,102);assert.equal(view.batch.stoppedAtEnd?.cut,103);
});
