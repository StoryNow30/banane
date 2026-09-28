'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,esvLent,reglages,attendreFin,L}=require('./helpers/esv-lent.cjs');
/* 4.8.0 — quatrième revue : deux reprises à la fois (suite de `revue-4b-4800.test.cjs`). */
test('deux « Reprendre » à la fois : le second est refusé en clair',async()=>{
  let r;r=await pilote(L,{start:100,end:103,settings:reglages(),esv:esv=>{esvLent(esv);const inj=esv.onInject;let n=0;
    esv.onInject=()=>{if(esv.recharges&&++n===1){esv.second=r.b.api('resume').then(()=>'ok',e=>e.message);return;}inj();};}});
  await r.b.settle();r.b.adapter.onReload();await r.b.api('resume');
  assert.match(await r.b.adapter.second,/Reprise déjà en cours/);await attendreFin(r);
});
