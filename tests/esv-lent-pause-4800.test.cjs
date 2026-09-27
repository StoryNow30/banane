'use strict';
/* 4.8.0 — ESV lent pendant un lot (option 1 de la direction, D-058) : pause
 * avec la consigne F5, puis F5 et « Reprendre » ; voir tests/helpers/esv-lent.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,espion,esvLent,reglages,attendreFin,DECALAGE}=require('./helpers/esv-lent.cjs');

test('ESV lent : pause avec la consigne F5 ; après F5, « Reprendre » revient du premier différé au cut du lot et le termine',async()=>{
  const r=await pilote(espion,{start:100,end:103,settings:reglages(),esv:esvLent});
  let view=await r.b.settle();assert.equal(view.batch.state,'PAUSED');assert.equal(r.b.adapter.recharges??0,0,'aucun rafraîchissement automatique');
  assert.match(view.notice,/rafraîchis la page ESV \(F5\), puis clique sur Reprendre/);
  r.b.adapter.onReload();await r.b.api('resume');view=await attendreFin(r);
  const reb=r.b.store.events.find(e=>e.type==='batch-rebased-after-reload');assert.ok(reb,'lot rattaché');
  assert.equal(reb.cut,102);assert.equal(reb.atteint,102);assert.equal(reb.pas,1,'101 (différé) → 102 par « suivant non validé »');
  assert.ok(reb.translation.every((v,i)=>Math.abs(v-DECALAGE[i])<1e-9),'translation du repère mesurée sur les deux rails');
  assert.ok(reb.appuisGardes>=1,'appuis gardés, translatés');assert.equal(reb.appuisEcartes,0);
  assert.equal(view.batch.scope.pageId,'page-apres-F5');assert.equal(view.batch.stoppedAtEnd?.cut,103,'lot mené à sa borne');
});
