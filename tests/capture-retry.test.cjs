const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {page}=require('./helpers/page.cjs'),F=require('./v242/fixtures.cjs');
const {Engine}=require('../src/engine.js'),{MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
const L=require('../vendor/lidar.js');
const unstable="Les nœuds LiDAR visibles ont changé pendant l'export. Attends la fin du chargement puis réessaie.";
function points(rows){const n=F.object([0,0,0],'Points');n.geometry={attributes:{position:F.buffer(rows)}};return {sceneNode:n};}
function lidarPage(){const f=page(),pc=F.object([0,0,0],'PointCloudOctree');
 pc.material={clipBoxes:[],clipTask:0,clipMethod:0};pc.visibleNodes=[points([[0,.01,.01],[0,1.425,.01]])];
 f.ctx.viewer.scene.pointclouds=[pc];f.ctx.Potree=F.enums;return {...f,pc};}

test('actual exporter node replacement is retried; only successful G/D snapshots enter the merge',async()=>{
 const f=lidarPage(),before=await f.call('state');let reads=0;
 f.ctx.BananeLidar.capture=async opts=>{reads++;return L.capture({...opts,pause:async()=>{
   if(reads===1&&f.pc.visibleNodes.length===1)f.pc.visibleNodes.push(points([[0,.025,.02]]));
 }});};
 const out=await f.call('capture',before);
 assert.equal(reads,3);assert.equal(out.readStrategy.attempts.filter(a=>a.status==='discarded').length,1);
 assert.equal(out.viewCaptures.length,2);assert.equal(out.pointsSceneRelative.length,3);
 assert.equal(new Set(out.pointsSceneRelative.map(p=>p.join(','))).size,3);
 assert.ok(f.progress.some(p=>p.stage==='capture-retry'&&p.detail.message===unstable));
 assert.ok(K.equalPoses((await f.call('state')).rails,before.rails));
});
test('per-view retries are bounded and never send a validation command',async()=>{
 const f=lidarPage(),before=await f.call('state');let reads=0,validations=0;
 f.nodes.get('O2N3DCutValidate3DRail').click=()=>{validations++;};
 f.ctx.BananeLidar.capture=async()=>{reads++;throw Error(unstable);};
 await assert.rejects(()=>f.call('capture',before),/après 3 tentatives/);
 assert.equal(reads,3);assert.equal(validations,0);assert.ok(f.clock()<60000);
});
test('permanently replacing buffers never pass the stable-view check, even at constant point count',async()=>{
 const f=lidarPage(),before=await f.call('state');let reads=0;
 f.ctx.onTick=()=>{f.pc.visibleNodes[0]=points([[0,.01,.01],[0,1.425,.01]]);};
 f.ctx.BananeLidar.capture=async()=>{reads++;throw Error('must not read');};
 await assert.rejects(()=>f.call('capture',before),/après 3 tentatives/);
 assert.equal(reads,0);assert.ok(f.clock()>=36000&&f.clock()<60000);
});
test('the total capture budget expires before the 90-second bridge deadline',async()=>{
 const f=lidarPage(),before=await f.call('state');let reads=0;
 f.ctx.BananeLidar.capture=async()=>{reads++;f.advance(22000);throw Error(unstable);};
 await assert.rejects(()=>f.call('capture',before),/60 secondes/);
 assert.equal(reads,3);assert.ok(f.clock()<90000);
});
test('Stop during capture wait prevents any read or automatic retry',async()=>{
 const f=lidarPage(),before=await f.call('state');let reads=0;
 f.ctx.onTick=()=>{f.ctx.onTick=null;void f.call('cancel');};
 f.ctx.BananeLidar.capture=async()=>{reads++;throw Error(unstable);};
 await assert.rejects(()=>f.call('capture',before),/interrompu/);assert.equal(reads,0);
 assert.equal(f.progress.filter(p=>p.stage==='capture-retry').length,0);
});
test('changed cuts or rail poses abort capture immediately and never qualify as LOD retries',async()=>{
 for(const change of ['cut','rail']){
   const f=lidarPage(),before=await f.call('state');let reads=0;
   f.ctx.onTick=()=>{f.ctx.onTick=null;if(change==='cut')f.nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';else f.left.position.z+=.01;};
   f.ctx.BananeLidar.capture=async()=>{reads++;throw Error(unstable);};
   await assert.rejects(()=>f.call('capture',before),/Cible différente|Rails modifiés/);
   assert.equal(reads,0);assert.ok(f.clock()<1000);
 }
});
test('camera and clipping changes are not silently retried as LOD replacement',async()=>{
 for(const message of ["La caméra a changé pendant l'export. Garde la vue immobile et réessaie.","La découpe du nuage a changé pendant l'export. Recommence lorsque la vue est stable."]){
   const f=lidarPage(),before=await f.call('state');let reads=0;
   f.ctx.BananeLidar.capture=async()=>{reads++;throw Error(message);};
   await assert.rejects(()=>f.call('capture',before),e=>e.message===message);assert.equal(reads,1);
 }
});

const scope={part:23,start:100,end:101,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true};
async function app(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';return {adapter,store,engine};}
test('exhausted capture pauses; Resume keeps the first snapshot and does not repeat earlier cuts',async()=>{
 const {adapter,store,engine:e}=await app(),capture=adapter.capture.bind(adapter);let fail=true;
 adapter.capture=async b=>{if(adapter.identity.cut===101&&fail)throw Error(unstable);return capture(b);};
 await e.startBatch(scope);await e.task;assert.equal(e.s.batch.state,'PAUSED');assert.equal(e.s.batch.processed.length,1);
 const before=K.clone(e.s.before);assert.equal(e.s.collection,'BEFORE_CAPTURED');assert.equal(store.clouds.size,1);assert.equal(e.s.reconcileRequired,undefined);
 fail=false;await e.resume();await e.task;
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(e.s.batch.processed.length,2);
 assert.equal(adapter.calls.filter(c=>c==='apply').length,2);assert.equal(adapter.calls.filter(c=>c==='validate').length,2);
 assert.equal(e.s.incomplete.length,0);assert.equal(e.s.records[1].startedAt,before.capturedAt);
});
test('Stop remains stopped when the cancelled read rejects; Resume needs no manual cancellation',async()=>{
 const {adapter,engine:e}=await app(),capture=adapter.capture.bind(adapter);let first=true;
 adapter.capture=async b=>{if(first){first=false;await e.stop();throw Error('Export interrompu.');}return capture(b);};
 await e.startBatch({...scope,end:100});await e.task;assert.equal(e.s.batch.state,'STOPPED');assert.equal(adapter.calls.includes('apply'),false);
 await e.resume();await e.task;assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
});
test('resume after an interrupted capture refuses manual rail movements without erasing the before',async()=>{
 const {adapter,engine:e}=await app();adapter.capture=async()=>{throw Error(unstable);};
 await e.startBatch(scope);await e.task;const before=K.clone(e.s.before);
 adapter.rails=K.expectedPoses(before,{left:{delta:[0,.01,0]},right:{delta:[0,0,0]}});
 await assert.rejects(()=>e.resume(),/Rails modifiés/);assert.deepEqual(e.s.before,before);assert.equal(adapter.calls.includes('apply'),false);
});
test('a standalone interrupted read can be restarted directly without Annuler',async()=>{
 const {adapter,engine:e}=await app(),capture=adapter.capture.bind(adapter);let first=true;
 adapter.capture=async b=>{if(first){first=false;throw Error(unstable);}return capture(b);};
 await assert.rejects(()=>e.locked(()=>e.begin()),/nœuds/);const before=K.clone(e.s.before);
 await e.locked(()=>e.begin());assert.equal(e.s.collection,'READY_FOR_AFTER');assert.deepEqual(e.s.before,before);assert.equal(e.s.incomplete.length,0);
});
test('legacy cut-62 capture error migrates to a resumable pause while preserving records',async()=>{
 const journal=JSON.parse(fs.readFileSync(path.join(__dirname,'incidents/banane-journal-v3-1788955443422.json')));
 const abandoned=journal.records.find(r=>r.before?.identity.part===7&&r.before?.identity.cut===62);
 const failure=journal.events.find(e=>e.type==='batch-error'&&e.message===unstable);
 const {adapter,store,engine:e}=await app();
 e.s.before=K.clone(abandoned.before);e.s.lidarId=null;e.s.collection='BEFORE_CAPTURED';
 e.s.batch={state:'ERROR',step:'capture',error:failure,scope:{part:7,start:62,end:62,pageId:abandoned.before.identity.pageId},processed:[],skipped:[]};
 e.s.records=K.clone(journal.records.filter(r=>r.recordId));await e.save();
 const restarted=new Engine(adapter,store);await restarted.init();assert.equal(restarted.s.batch.state,'PAUSED');
 assert.equal(restarted.s.batch.error.retryableCapture,true);assert.deepEqual(restarted.s.records,e.s.records);assert.deepEqual(restarted.s.before,e.s.before);
});
