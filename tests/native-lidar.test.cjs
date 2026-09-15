const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../vendor/capture-core.js'),L=require('../vendor/lidar.js'),N=require('../src/native-lidar.js'),F=require('./v242/fixtures.cjs');

function state(rail){return {object:rail,profile:rail.children[1],railMatrix:C.worldMatrix(rail),profileMatrix:C.worldMatrix(rail.children[1]),
 rotation:C.rotation(rail),profileRotation:C.rotation(rail.children[1])};}
function pointsNode(rows,position){const node=F.object(position,'Points');node.isPoints=true;node.geometry={attributes:{position:F.buffer(rows)},drawRange:{start:0,count:Infinity}};return node;}
function fixture(){
 const f=F.scene(),origin=[513237,6638161,60],far=pointsNode(Array.from({length:1200},(_,i)=>[100+i/100,100,100]),origin);
 const useful=[];for(let i=0;i<220;i++){const x=-.49+.98*i/219;useful.push([x,.03,.02],[x,1.405,.02]);}
 const near=pointsNode(useful,origin);f.pc.visibleNodes=[{sceneNode:far},{sceneNode:near}];return {f,origin,far,near};
}
function options(x,rails){return {viewer:x.f.viewer,rails,origin:x.origin,enums:F.enums,identity:{pageId:'page',part:1,cut:2,shape:'U50',frameId:'frame',projectId:null},
 meta:{version:'test',identity:{pageId:'page',part:1,cut:2,shape:'U50',frameId:'frame',projectId:null}},visitId:'visit',captureId:'capture',
 maxInspected:520,maxMillis:100000,yieldEvery:64,checkpointPoints:50,pause:async()=>{},guard:()=>{},now:()=>0};}

test('passive reader prioritizes nodes whose probes hit a rail ROI before a large irrelevant node',async()=>{
 const x=fixture(),chunks=[],result=await N.capture({...options(x,{left:state(x.f.left),right:state(x.f.right)}),onCheckpoint:async chunk=>chunks.push(chunk)});
 assert.equal(result.sourceNodes[0].nodeId,'cloud-0-node-1');assert.equal(result.termination.code,'RESOURCE_LIMIT');
 assert.ok(result.trace.pointsAvailableInBuffers>result.trace.pointsRead);assert.equal(result.trace.pointsRead,520);
 assert.ok(result.railObservations.left.pointsRetained>=200);assert.ok(result.railObservations.right.pointsRetained>=200);
 assert.equal(result.railObservations.left.coverage.status,'qualified-candidate');assert.equal(result.railObservations.right.coverage.status,'qualified-candidate');
 assert.equal(chunks.reduce((n,c)=>n+c.pointsSceneRelative.length,0),result.trace.pointsCheckpointed);
});

test('passive and functional readers see the same loaded buffers without invoking adapter navigation',async()=>{
 const x=fixture(),rails=[state(x.f.left),state(x.f.right)],functional=await L.capture({viewer:x.f.viewer,rails,origin:x.origin,enums:F.enums,
  guard:()=>{},pause:async()=>{},maxInspected:5000,maxMillis:100000,meta:{identity:options(x,{}).meta.identity}});
 const passive=await N.capture({...options(x,{left:rails[0],right:rails[1]}),maxInspected:5000,onCheckpoint:async()=>{}});
 assert.equal(passive.trace.pointsAvailableInBuffers,functional.nodes.reduce((sum,node)=>sum+node.positionAttribute.count,0));
 assert.ok(functional.quality.perRail.left>0&&functional.quality.perRail.right>0);
 assert.ok(passive.railObservations.left.pointsRetained>0&&passive.railObservations.right.pointsRetained>0);
});

test('one observed rail produces an independently qualified geometry observation',async()=>{
 const x=fixture(),chunks=[],result=await N.capture({...options(x,{left:state(x.f.left)}),maxInspected:440,onCheckpoint:async chunk=>chunks.push(chunk)});
 assert.deepEqual(Object.keys(result.railObservations),['left']);assert.equal(result.railObservations.left.coverage.status,'qualified-candidate');
 assert.ok(chunks.length);assert.ok(chunks.every(chunk=>chunk.side==='left'));
});

test('a target change preserves already checkpointed points and reports the interruption explicitly',async()=>{
 const x=fixture(),chunks=[];let checks=0;const error=Error('Cible différente : cut');error.code='TARGET_CHANGED';
 const result=await N.capture({...options(x,{left:state(x.f.left)}),yieldEvery:32,checkpointPoints:16,guard:()=>{if(++checks>5)throw error;},onCheckpoint:async chunk=>chunks.push(chunk)});
 assert.equal(result.status,'partial-interrupted');assert.equal(result.termination.code,'TARGET_CHANGED');assert.ok(chunks.length);
 assert.ok(result.trace.pointsCheckpointed>0);assert.equal(result.railObservations.left.coverage.status,'insufficient');
 assert.ok(result.railObservations.left.coverage.exclusionReasons.includes('capture-interrupted-before-stable-boundary'));
});

test('coverage never qualifies a merely non-empty or uncalibrated rail sample',()=>{
 const settings={...N.DEFAULTS,coverage:N.DEFAULTS.coverage};
 const sparse=N.coverage([[0,0,0]],settings,{valid:true},'same-target-and-rail-pose',null);assert.equal(sparse.status,'insufficient');
 const many=Array.from({length:200},(_,i)=>[-.49+.98*i/199,.03,.02]);
 const invalid=N.coverage(many,settings,{valid:false},'same-target-and-rail-pose',null);assert.equal(invalid.status,'insufficient');assert.ok(invalid.exclusionReasons.includes('transform-invalid'));
});
test('a stored first rail snapshot survives a later target interruption without qualifying unfinished enrichment',async()=>{
 const x=fixture(),chunks=[];let changed=false;const error=Object.assign(Error('Cible différente : cut'),{code:'TARGET_CHANGED'});
 const result=await N.capture({...options(x,{left:state(x.f.left),right:state(x.f.right)}),maxInspected:440,
  guard:()=>{if(changed)throw error;},onCheckpoint:async chunk=>{chunks.push(chunk);if(chunk.side==='left'&&chunk.qualification?.status==='qualified-candidate')changed=true;
   return {storageConfirmedAt:new Date().toISOString()};}});
 assert.equal(result.termination.code,'TARGET_CHANGED');const good=chunks.find(chunk=>chunk.side==='left'&&chunk.qualification.status==='qualified-candidate');
 assert.ok(good);assert.equal(good.qualification.criteriaVersion,'native-visible-roi-v1');assert.ok(good.qualification.coverage.pointsInEngineUsefulRoi>=64);
 assert.equal(good.acquisition.sourceStatus,'reference-version-and-matrix-stable-through-checkpoint');
 assert.equal(result.railObservations.left.firstQualifiedSnapshot.snapshotId,good.chunkId);
 assert.equal(result.railObservations.left.coverage.status,'insufficient');
});
test('unknown clipping never qualifies a snapshot even with ample raw points',async()=>{
 const x=fixture(),chunks=[],result=await N.capture({...options(x,{left:state(x.f.left)}),enums:{},maxInspected:440,onCheckpoint:async chunk=>chunks.push(chunk)});
 assert.ok(result.trace.pointsRetainedInRoi>128);assert.equal(result.railObservations.left.firstQualifiedSnapshot,null);
 assert.ok(chunks.every(chunk=>chunk.qualification.status==='insufficient'));
 assert.ok(chunks.some(chunk=>chunk.qualification.exclusionReasons.includes('clip-state-not-classifiable')));
});
test('visibility clipping qualifies the left rail independently and rejects raw right points outside the active cut',async()=>{
 const x=fixture(),chunks=[];x.f.pc.material.clipTask=F.enums.ClipTask.SHOW_INSIDE;
 x.f.pc.material.clipBoxes=[{inverse:C.translation(x.origin.map(v=>-v))}];
 const result=await N.capture({...options(x,{left:state(x.f.left),right:state(x.f.right)}),maxInspected:440,
  onCheckpoint:async chunk=>chunks.push(chunk)});
 assert.ok(result.railObservations.right.pointsRetained>128);
 assert.equal(result.railObservations.right.pointsVisibleForEngine,0);
 assert.equal(result.railObservations.right.firstQualifiedSnapshot,null);
 assert.ok(result.railObservations.left.firstQualifiedSnapshot);
 assert.ok(chunks.some(chunk=>chunk.side==='right'&&chunk.visibleByClipBoxes.includes(false)));
});
