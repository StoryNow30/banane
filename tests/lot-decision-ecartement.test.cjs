'use strict';
/* Garde d'écartement voisin (étude du 24/09, KI-054) : référence = médiane de
 * l'écartement des appuis proches ; inactive par défaut ; garde, jamais cible. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js');
const pos=(g,x=0)=>({left:[x,0,0],right:[x,g/1000,0]});
const anchor=(cut,g,part=2)=>({identity:{part,cut,frameId:'f'},positions:pos(g,cut)});
test('inactive par défaut : aucune règle de la 4.7.15 ne change',()=>{
  assert.equal(L.DEFAULTS.gaugeGuardMm,null);assert.equal(L.DEFAULTS.gaugeChoice,false);assert.equal(L.DEFAULTS.gaugeTargetStudy,false);
  assert.equal(L.DEFAULTS.version,'lot-decision-v3');
});
test('écartement d\'une paire, référence par la médiane des appuis les plus proches',()=>{
  assert.ok(Math.abs(L.gaugeOf(pos(1452))-1452)<1e-6);
  const cfg={...L.DEFAULTS,gaugeGuardMm:15};
  const ref=L.gaugeReference({part:2,cut:114,frameId:'f'},[anchor(100,1400),anchor(110,1452),anchor(111,1456),anchor(112,1448),anchor(113,1500,3)],cfg);
  assert.deepEqual(ref.cuts,[112,111,110]);assert.ok(Math.abs(ref.mm-1452)<1e-6);
  assert.equal(L.gaugeReference({part:2,cut:130,frameId:'f'},[anchor(110,1452)],cfg),null);
  const even=L.gaugeReference({part:2,cut:114,frameId:'f'},[anchor(112,1448),anchor(113,1456)],cfg);
  assert.ok(Math.abs(even.mm-1452)<1e-6);
});
test('le Pilote ne passe aucune option à la décision : la variante « cible » reste une mesure',()=>{
  const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','background.js'),'utf8');
  const calls=src.match(/L\.decideCut\(\{[\s\S]*?\}\);/g)||[];
  assert.ok(calls.length>=1);for(const c of calls)assert.ok(!/options|gaugeTarget/.test(c),c);
});
