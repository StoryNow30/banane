'use strict';
/* 4.8.0 — revue de code approfondie (ead1cd1..83e2ebe), reprise après un
 * rafraîchissement d'ESV : cut du lot introuvable après F5. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,esvLent,reglages,L}=require('./helpers/esv-lent.cjs');

test('cut du lot introuvable après F5 : refus en clair, rien n\'est rattaché ni relancé',async()=>{
  const r=await pilote(L,{start:100,end:103,settings:reglages({rafraichirAuto:false}),esv:esv=>{esvLent(esv);const next=esv.next.bind(esv);
    esv.next=async(...a)=>{const s=await next(...a);if(esv.recharges&&esv.identity.cut===102){esv.identity.cut=103;return esv.state();}return s;};}});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  r.b.adapter.onReload();
  await assert.rejects(()=>r.b.api('resume'),/cut 102 du lot n’est pas retrouvé/);
  view=await r.b.api('view');assert.equal(view.batch.state,'PAUSED');assert.equal(view.batch.scope.pageId,'fixture-page');
  assert.equal(r.b.store.events.some(e=>e.type==='batch-rebased-after-reload'),false);
});
