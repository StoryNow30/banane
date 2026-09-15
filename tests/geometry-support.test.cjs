const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../src/geometry.js'),old=require('./baseline-geometry-v301.cjs'),{K,MemoryStore,SimulatedESV}=require('./fixtures.cjs'),{Engine}=require('../src/engine.js');
const dataset=JSON.parse(fs.readFileSync(path.join(__dirname,'incidents/banane-dataset-v3-1788955914519.json')));
test('real cut 200 right no longer yields a writable position from a slope forced to 0.5',()=>{
 const cloud=dataset.clouds.find(c=>c.cut===200),previous=old.propose(cloud,'right'),now=G.propose(cloud,'right');
 assert.ok(previous.delta);assert.equal(previous.face.slope,.5);assert.equal(now.delta,null);assert.equal(now.status,'unresolved');
 assert.ok(now.face.rawSlope>.5);assert.match(now.reasons.join(' '),/pente ne sera pas forcée/);
});
test('real cut 207 left no longer yields a writable position without sufficient running-sheet points',()=>{
 const cloud=dataset.clouds.find(c=>c.cut===207),previous=old.propose(cloud,'left'),now=G.propose(cloud,'left');
 assert.ok(previous.delta);assert.equal(now.metrics.topCount,14);assert.equal(now.delta,null);assert.match(now.reasons.join(' '),/roulement insuffisamment observé/);
});
test('the other eight supported positions use the full-template placement while retaining the old surface intersection',()=>{
 for(const cloud of dataset.clouds)for(const side of ['left','right']){
   if(cloud.cut===200&&side==='right'||cloud.cut===207&&side==='left')continue;
   const previous=old.propose(cloud,side),now=G.propose(cloud,side);
   assert.equal(now.status,'candidate');assert.equal(now.source,'lidar-template-supported');
   assert.deepEqual(now.delta,[0,...now.metrics.seed]);
   assert.deepEqual(now.metrics.surfaceIntersection,previous.delta.slice(1));
 }
});
test('missing geometry always pauses explicitly; legacy skip is normalized to pause',async()=>{
 for(const policy of ['attempt','skip']){
   const a=new SimulatedESV(),store=new MemoryStore(),e=new Engine(a,store),cloud=dataset.clouds.find(c=>c.cut===200);
   a.identity=K.clone(cloud.identity);a.rails=K.clone(cloud.rails);
   a.capture=async()=>K.clone(cloud);await e.init();e.s.mode='automatic-test';
   await e.startBatch({part:7,start:200,end:200,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:policy});await e.task;
   assert.equal(a.calls.includes('apply'),false);assert.equal(a.calls.includes('validate'),false);
   assert.equal(e.s.batch.state,'PAUSED_UNRESOLVED_RAIL');assert.equal(e.s.batch.skipped.length,0);
 }
});
