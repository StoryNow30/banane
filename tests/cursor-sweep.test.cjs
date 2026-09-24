'use strict';
/* Bilan des curseurs : totaux, écarts à la base, cuts gagnés, perdus et décidés autrement. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const W=require('../tools/cursor-sweep.cjs');
const row=(cut,{kind='natif',stage='first-pass',judged=true,wrong=false,worstMm=2}={})=>({source:kind==='natif'?'n':'p',kind,cut,stage,judged,wrong,worstMm:wrong?20:worstMm});
const base=[row(1),row(2,{stage:'window'}),row(3,{stage:'choice',wrong:true}),row(4,{kind:'pilote'}),row(5,{judged:false})];
const other=[row(1),row(2,{stage:'window',worstMm:4}),row(4,{kind:'pilote',stage:'choice'}),row(5,{judged:false}),row(6,{stage:'window'}),row(7,{wrong:true})];
test('totaux par configuration et écart à la base',()=>{
  const r=W.summarize({base,other});
  assert.deepEqual([r.base.all.applied,r.base.all.right,r.base.all.wrong],[5,3,1]);
  assert.deepEqual(r.base.natif.wrongCuts,['n:3 (20 mm)']);
  assert.equal(r.base.delta,undefined);
  assert.deepEqual(r.other.delta,{applied:1,right:1,wrong:0});
  assert.deepEqual(r.other.stages,{'first-pass':3,window:2,choice:1});
});
test('gagnés, perdus, décidés autrement, avec leur jugement',()=>{
  const r=W.summarize({base,other}).other;
  assert.deepEqual(r.gained.map(x=>[x.cut,x.verdict]),[['n:6','juste'],['n:7','faux']]);
  assert.deepEqual(r.lost.map(x=>[x.cut,x.stage,x.verdict]),[['n:3','choice','faux']]);
  assert.deepEqual(r.changed.map(x=>[x.cut,x.stage,x.worstMm,x.verdict]),[['n:2','window → window',[2,4],'juste'],['p:4','first-pass → choice',[2,2],'juste']]);
});
test('relevés fusionnés par configuration, référence absente refusée',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'curseurs-'));
  fs.writeFileSync(path.join(dir,'base-a.json'),JSON.stringify({rows:base.slice(0,2)}));
  fs.writeFileSync(path.join(dir,'base-b.json'),JSON.stringify({rows:base.slice(2)}));
  fs.writeFileSync(path.join(dir,'base-a.log'),'journal');
  fs.writeFileSync(path.join(dir,'baseline-a.json'),JSON.stringify({rows:[row(9)]}));
  assert.equal(W.load(dir,'base').length,5);
  assert.throws(()=>W.summarize({other}),/référence absente/);
});
