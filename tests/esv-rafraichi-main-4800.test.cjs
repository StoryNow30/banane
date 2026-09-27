'use strict';
/* 4.8.0 — ESV rafraîchi par l'opérateur pendant un lot, repère non vérifiable ;
 * voir tests/helpers/esv-lent.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin}=require('./helpers/esv-lent.cjs');

test('F5 puis « Reprendre », repère non vérifiable (un rail décalé de 5 mm de plus) : appuis écartés, le lot finit',async()=>{
  const r=await pilote(espion,{start:100,end:103,settings:reglages(),esv:esvLent});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');
  r.b.adapter.onReload();r.b.adapter.rails.left.positionSceneRelative[0]+=.005;/* translation incohérente entre les rails */
  const next=r.b.adapter.next.bind(r.b.adapter);let premier=true;
  r.b.adapter.next=async(...a)=>{const x=await next(...a);if(premier){premier=false;r.b.adapter.rails.left.positionSceneRelative[0]+=.005;return r.b.adapter.state();}return x;};
  await r.b.api('resume');view=await attendreFin(r);
  const reb=r.b.store.events.find(e=>e.type==='batch-rebased-after-reload');assert.ok(reb);
  assert.equal(reb.translation,null,'translation refusée');assert.ok(reb.appuisEcartes>=1,'appuis de l’ancien repère écartés');
  assert.equal(view.batch.stoppedAtEnd?.cut,103,'le lot continue sans ces appuis');
});
