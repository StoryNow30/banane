const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const G=require('../src/geometry.js'),{K,MemoryStore,SimulatedESV}=require('./fixtures.cjs');

function engineWith(railsOrError){
 const geometry={...G,proposeBoth(){if(railsOrError instanceof Error)throw railsOrError;return K.clone(railsOrError);}};
 const ctx={BananeCore3:K,BananeGeometry3:geometry};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8'),ctx);
 return ctx.BananeEngine3.Engine;
}
function candidate(confidence=80,confidenceStatus='candidate-v1'){
 return Object.fromEntries(['left','right'].map((side,i)=>[side,{side,status:'candidate',delta:[0,i?0.001:-0.001,0.001],confidence,reasons:[],
  method:G.DEFAULTS.method,source:confidenceStatus==='candidate-v1'?'geometry-candidate-v1-astar':'geometry-candidate-v1-s1',
  geometryEngine:'geometry-candidate-v1',gcv1:{confidenceStatus}}]));
}
const scope={pageId:'fixture-page',part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',
 geometryContract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:'candidate-hash'}};
async function run(railsOrError){const Engine=engineWith(railsOrError),adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);
 await engine.init();engine.s.mode='automatic-test';await engine.startBatch(scope);await engine.task;return {engine,adapter,store,Engine};}

test('GCV1 A_STAR candidates are applied normally in automatic-test',async()=>{
 const {engine,adapter,store}=await run(candidate());assert.equal(engine.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
 assert.equal(adapter.calls.filter(x=>x==='apply').length,1);assert.equal(adapter.calls.filter(x=>x==='validate').length,1);
 const proposal=store.events.find(e=>e.type==='proposed').proposal;assert.equal(proposal.rails.left.source,'geometry-candidate-v1-astar');
});

test('GCV1 S1 candidates with confidence zero remain admissible in the TEST batch',async()=>{
 const {engine,adapter,store}=await run(candidate(0,'non-calibrated-s1-selection'));
 assert.equal(engine.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(adapter.calls.filter(x=>x==='apply').length,1);
 const rail=store.events.find(e=>e.type==='proposed').proposal.rails.left;assert.equal(rail.confidence,0);
 assert.equal(rail.gcv1.confidenceStatus,'non-calibrated-s1-selection');
});

test('GCV1 unresolved pauses without apply, validate, or implicit SKIP',async()=>{
 const unresolved=Object.fromEntries(['left','right'].map(side=>[side,{side,status:'unresolved',delta:null,confidence:0,reasons:['test-unresolved'],method:G.DEFAULTS.method,
  source:'geometry-candidate-v1-abstention',geometryEngine:'geometry-candidate-v1'}]));
 const {engine,adapter}=await run(unresolved);assert.equal(engine.s.batch.state,'PAUSED_UNRESOLVED_RAIL');
 assert.equal(adapter.calls.includes('apply'),false);assert.equal(adapter.calls.includes('validate'),false);assert.equal(adapter.calls.includes('skip'),false);
});

test('a technical GCV1 error ends explicitly before every write',async()=>{
 const {engine,adapter}=await run(Error('candidate-technical-test'));assert.equal(engine.s.batch.state,'ERROR');
 assert.match(engine.s.batch.error.message,/candidate-technical-test/);assert.equal(adapter.calls.includes('apply'),false);assert.equal(adapter.calls.includes('skip'),false);
});

test('the persisted batch engine survives Engine rehydration',async()=>{
 const Engine=engineWith(candidate()),adapter=new SimulatedESV(),store=new MemoryStore(),first=new Engine(adapter,store);await first.init();
 first.s.mode='automatic-test';
 first.s.batch={id:'g8-restart',state:'PAUSED',step:'capture',scope:{...scope},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],activeIdentity:K.completeIdentity(adapter.identity)};
 await first.save();const restarted=new Engine(adapter,store);await restarted.init();assert.equal(restarted.s.batch.scope.geometryEngine,'geometry-candidate-v1');
 await restarted.resume();await restarted.task;assert.equal(restarted.s.batch.scope.geometryEngine,'geometry-candidate-v1');
 assert.equal(adapter.calls.filter(x=>x==='apply').length,1,JSON.stringify({calls:adapter.calls,batch:restarted.s.batch,notice:restarted.s.notice}));assert.equal(adapter.calls.includes('skip'),false);
});
