'use strict';
/* Garde d'écartement voisin (étude du 24/09, KI-054) : référence = médiane de
 * l'écartement des appuis proches ; inactive par défaut ; garde, jamais cible. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js');
const pos=(g,x=0)=>({left:[x,0,0],right:[x,g/1000,0]});
const anchor=(cut,g,part=2)=>({identity:{part,cut,frameId:'f'},positions:pos(g,cut)});
test('4.7.16 (D-050) : garde à 20 mm, choix à 5 points de dessus ; ni aide au choix ni cible',()=>{
  assert.equal(L.DEFAULTS.gaugeGuardMm,20);assert.equal(L.DEFAULTS.minTop,5);
  assert.equal(L.DEFAULTS.gaugeChoice,false);assert.equal(L.DEFAULTS.gaugeTargetStudy,false);
  assert.equal(L.DEFAULTS.version,'lot-decision-v6','v6 (4.7.19) : même règle d\'écartement, appui = cut posé');
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
test('paire retirée par la garde d\'écartement voisin : différée, motif nommé',()=>{
  const rails={left:{status:'candidate'},right:{status:'candidate'}};
  const r=L.commandRails({decision:{stage:'deferred',reason:'gauge-guard',guardDeferred:true,gaugeJumpMm:22.4,guardMm:null},runtimeRails:rails,before:rails});
  assert.equal(r.action,'defer');assert.equal(r.reason,'gauge-guard');
  for(const s of ['left','right']){assert.equal(r.rails[s].status,'unresolved');assert.match(r.rails[s].reasons[0],/écartement voisin \(22\.4 mm/);}
});
