const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../src/geometry.js');

test('competing distant template placements are unresolved instead of receiving a misleading confidence score',()=>{
 const root=path.join(__dirname,'corpus'),index=JSON.parse(fs.readFileSync(path.join(root,'index.json')));
 const item=index.paired.find(x=>x.cut===2857),capture=JSON.parse(fs.readFileSync(path.join(root,item.lidar_file)));
 const fit=G.propose(capture,'left');
 assert.equal(fit.status,'unresolved');assert.equal(fit.delta,null);assert.equal(fit.confidence,0);
 assert.ok(fit.metrics.templateAmbiguity.lossRatio<G.DEFAULTS.minTemplateLossRatio);
 assert.match(fit.reasons.join(' '),/placements concurrents/);
});

test('a large one-sided placement is refused unless the other rail provides pair support',()=>{
 const candidate=delta=>({status:'candidate',delta,confidence:80,reasons:[],source:'lidar-template-supported'});
 const isolated=G.enforcePairSupport({left:candidate([0,.061,0]),right:candidate([0,.02,0])});
 assert.equal(isolated.left.status,'unresolved');assert.equal(isolated.left.delta,null);
 assert.match(isolated.left.reasons.join(' '),/Grand déplacement isolé/);assert.ok(isolated.right.delta);
 const supported=G.enforcePairSupport({left:candidate([0,.061,0]),right:candidate([0,.041,0])});
 assert.ok(supported.left.delta);assert.ok(supported.right.delta);
});

test('geometry reliability parameters reject inconsistent pair thresholds',()=>{
 assert.throws(()=>G.enforcePairSupport({left:{delta:[0,0,0]},right:{delta:[0,0,0]}},{maxSingleRailLateral:.03,pairedSupportLateral:.04}),/incohérents/);
});
