const {test}=require('node:test'),assert=require('node:assert/strict');
const {extent,pose}=require('../tools/audit-native-v441.cjs');
test('exploratory baseline screens only visible, sufficiently spread points and identical initial pose',()=>{
 const good=Array.from({length:180},(_,i)=>[-.49+.98*i/179,.02,.01]),a=extent(good);
 assert.equal(a.passes,true);assert.equal(extent(good.slice(0,20)).passes,false);
 assert.equal(extent(good.map(point=>[point[0],.35,point[2]])).passes,false);
 const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],rail={railLocalToSceneRelative:matrix,profileLocalToSceneRelative:matrix};
 assert.equal(pose(rail,rail),true);assert.equal(pose(rail,{...rail,profileLocalToSceneRelative:matrix.map((v,i)=>i===12?v+.001:v)}),false);
});
