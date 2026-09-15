const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js'),{MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
const scope={part:23,start:100,end:100,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true};
async function app(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}
test('a V3 exported dataset pairs its own before and after by metadata',async()=>{
 const {adapter,store,engine:e}=await app();await e.begin();adapter.rails=K.expectedPoses(e.s.before,{left:{delta:[0,.01,0]},right:{delta:[0,0,0]}});await e.finish();
 const data={...await e.exportReferences(),clouds:[...store.clouds.values()]};
 const result=K.pairCorpus([{name:'suffix-049.json',text:JSON.stringify(data)}]);assert.equal(result.paired.length,1);assert.deepEqual(result.errors,[]);
 assert.equal(result.paired[0].reference.data.rails.right.positionChanged,false);
 data.clouds[0].coordinateBridge.sceneFrameId='foreign';assert.match(K.pairCorpus([{name:'test',text:JSON.stringify(data)}]).errors.join(''),/sceneFrameId/);
 assert.match(K.pairCorpus([{name:'schema',text:'{"records":{}}'}]).errors.join(''),/doit être une liste/);
});
test('two concurrent lot starts create one lot and one application',async()=>{
 const {adapter,engine:e}=await app();e.s.mode='automatic-test';
 const results=await Promise.allSettled([e.startBatch(scope),e.startBatch(scope)]);await e.task;
 assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(adapter.calls.filter(x=>x==='apply').length,1);
});
test('restart between verified apply and progress save resumes validation without reapplying',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';await e.analyze();
 e.s.batch={id:'test',state:'RUNNING',step:'apply',scope:{...scope,pageId:adapter.identity.pageId},processed:[],skipped:[],cutStartedAt:new Date().toISOString()};await e.apply();
 const restarted=new Engine(adapter,store);await restarted.init();assert.equal(restarted.s.batch.step,'validate');await restarted.resume();await restarted.task;
 assert.equal(restarted.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(adapter.calls.filter(x=>x==='apply').length,1);assert.equal(adapter.calls.filter(x=>x==='validate').length,1);
});
test('restart after persisted navigation evidence archives progress without repeating validation',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';await e.analyze();
 e.s.batch={id:'test',state:'RUNNING',step:'validate',scope:{...scope,pageId:adapter.identity.pageId},processed:[],skipped:[]};await e.apply();await e.validateAndNext(scope);
 const restarted=new Engine(adapter,store);await restarted.init();assert.equal(restarted.s.batch.step,'capture');assert.equal(restarted.s.batch.processed.length,1);
 await restarted.resume();await restarted.task;assert.equal(restarted.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(adapter.calls.filter(x=>x==='validate').length,1);
});
test('closing an uncertain result preserves evidence and blocks that target while allowing a new cut',async()=>{
 const {adapter,store,engine:e}=await app();adapter.noNavigation=true;e.s.mode='automatic-test';await e.startBatch(scope);await e.task;
 await e.closeUncertain();assert.equal(e.s.reconcileRequired,false);assert.ok(store.events.some(x=>x.type==='uncertain-result-closed'));assert.equal(store.records.length,1);
 await assert.rejects(()=>e.startBatch(scope),/résultat incertain/);
 await adapter.next();adapter.noNavigation=false;await e.startBatch({...scope,start:101,end:101});await e.task;assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
});
