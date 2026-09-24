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
