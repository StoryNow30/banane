const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../tools/offline-evaluate.cjs');
test('les quatre labels humains sont exclusifs et la validation sans mouvement reste positive',()=>{
 const make=(l,r)=>({rails:{left:{positionChanged:l},right:{positionChanged:r}}});
 assert.deepEqual([[true,true],[true,false],[false,true],[false,false]].map(x=>O.label(make(...x))),O.LABELS);
});
test('les quantiles et agrégats hors ligne sont déterministes',()=>{
 assert.equal(O.quantile([4,1,3,2],.5),2.5);
 const rail=(e,d=[0,0,0])=>({status:'comparable',engineDeltaLocal:d,errorMm:{lateral:e,vertical:e/2,euclidean:e},confidence:80});
 const rows=[{status:'comparable',humanLabel:'VALIDATE_NO_MOVEMENT',rails:{left:rail(1),right:rail(2)},initialRails:{left:{},right:{}},finalHumanRails:{left:{},right:{}},positionChanged:{left:false,right:false},identity:{cut:1}}];
 const x=O.aggregate(rows);assert.equal(x.cutsComparable,1);assert.equal(x.errors.left.euclidean.medianMm,1);assert.equal(x.noMovementReference.rate,1);
});
