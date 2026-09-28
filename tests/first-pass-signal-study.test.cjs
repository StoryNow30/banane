'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Study=require('../tools/first-pass-signal-study.cjs');
const rail={positionSceneRelative:[0,0,0],sceneRelativeToProfileLocal:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]};
test('une règle arrête les deux rails et retire l’appui sans modifier la proposition',()=>{
 const d={stage:'first-pass',positions:{left:[0,.12,0],right:[0,1.55,0]},anchor:true,anchorsUsed:[]};
 const capture={rails:{left:rail,right:rail}},science={rails:{left:{next:{status:'candidate',topRows:20,faceCount:7}},right:{next:{status:'candidate',topRows:20,faceCount:7}}}};
 const result=Study.ruled(capture,science,d,Study.RULES['esv-100']);
 assert.equal(result.removed,true);assert.equal(result.decision.stage,'deferred');
 assert.equal(result.decision.anchor,false);assert.equal(result.decision.positions,undefined);
 assert.equal(d.anchor,true);assert.equal(result.feature.rails.left.esvLateralMm,120);
});
test('la garde ne touche pas une reprise par la voie',()=>{
 const d={stage:'window',positions:{left:[0,.12,0],right:[0,1.55,0]},anchor:true};
 const capture={rails:{left:rail,right:rail}},science={rails:{left:{next:{}},right:{next:{}}}};
 assert.equal(Study.ruled(capture,science,d,()=>true).decision,d);
});
test('la garde d’écartement bas ne refuse qu’un premier passage sans appui sous le seuil',()=>{
 const f=(anchors,gaugeMm)=>({anchors,gaugeMm});
 for(const r of ['sans-appui-ecart-bas-1420','sans-appui-ecart-bas-1425']){const R=Study.RULES[r];
  assert.equal(R(f(0,1405)),true);assert.equal(R(f(0,1414.5)),true);
  assert.equal(R(f(0,1426.1)),false);assert.equal(R(f(0,1462.8)),false);
  assert.equal(R(f(1,1405)),false);assert.equal(R(f(0,NaN)),false);}
 assert.equal(Study.RULES['sans-appui-ecart-bas-1425'](f(0,1422)),true);
 assert.equal(Study.RULES['sans-appui-ecart-bas-1420'](f(0,1422)),false);
});
/* D5 : l'outil de portes J1 compare la base cut par cut ; `--base-seule` ne rejoue aucune variante. */
test('D5 : la base est rendue ligne à ligne, et sans variante quand aucune règle n’est demandée',()=>{
 const rows=[{cut:7,stage:'first-pass',feature:{anchors:0},removed:false,applied:true,judged:true,wrong:false,worstMm:2.5},
  {cut:8,stage:'deferred',feature:null,removed:false,applied:false,judged:false,wrong:null,worstMm:null}];
 const r=Study.compare('natif-x','natif',()=>rows.map(x=>({...x})),{});
 assert.deepEqual(r.variants,{});
 assert.deepEqual(r.base.rows,[{cut:7,stage:'first-pass',applied:true,judged:true,wrong:false,worstMm:2.5},{cut:8,stage:'deferred',applied:false,judged:false,wrong:null,worstMm:null}]);
});
test('D5 : --base-seule vide la liste des règles ; --regles la garde',()=>{
 assert.deepEqual(Study.regles(['o.json','--base-seule','--natif','a=b']),{rules:{},argv:['o.json','--natif','a=b']});
 const r=Study.regles(['o.json','--regles','esv-100','--lot','a=b']);
 assert.deepEqual(Object.keys(r.rules),['esv-100']);assert.deepEqual(r.argv,['o.json','--lot','a=b']);
 assert.throws(()=>Study.regles(['o.json','--base-seule','--regles','esv-100']),/--base-seule/);
});
