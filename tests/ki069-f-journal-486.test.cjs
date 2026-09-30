'use strict';
/* KI-069 (4.8.6), essai f : le journal consigne M, N et la commande utilisée. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {dernierCut}=require('./helpers/dernier-cut.cjs');
test('journal : M, N et « ctrl-entrée »',async()=>{
  const {r}=await dernierCut();
  const e=r.b.store.events.find(x=>x.type==='validation-en-place');assert.ok(e,'événement consigné');
  assert.equal(e.total,101);assert.equal(e.cut,100);assert.equal(e.commande,'ctrl-entrée');assert.equal(e.part,23);
  assert.deepEqual(e.compteurAvant,{traites:100,total:101});assert.deepEqual(e.compteurApres,{traites:101,total:101});
});
