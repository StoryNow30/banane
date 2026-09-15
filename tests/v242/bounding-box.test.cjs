const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../capture-core.js'),L=require('../lidar.js'),F=require('./fixtures.cjs');
const options=f=>({viewer:f.viewer,rails:[f.left,f.right].map(C.railState),origin:[513237,6638161,60],
  guard:()=>{},enums:F.enums,meta:{part:20,cut:3392,shape:'U50'},pause:async()=>{}});
function sixteenNodes() {
  const f=F.scene();f.pc.visibleNodes=[];
  for(let j=0;j<16;j++) {
    const n=F.object([513237,6638161,60],'Points');n.isPoints=true;
    n.geometry={attributes:{position:F.buffer([[0,.01,.02],[.1,-.03,-.06],[0,1.4,.03],[.1,1.42,0],[100,100,100]])},
      drawRange:{start:0,count:Infinity},boundingBox:{min:{x:1000,y:1000,z:1000},max:{x:1001,y:1001,z:1001}}};
    f.pc.visibleNodes.push({sceneNode:n,geometryNode:{boundingBox:n.geometry.boundingBox}});
  }
  return f;
}

test('3392 regression: 16 nodes with incompatible reported boxes are actually read',async()=>{
  const data=await L.capture(options(sixteenNodes()));
  assert.equal(data.nodes.length,16);
  assert.equal(data.quality.skippedBoundingBoxes,0);
  assert.equal(data.quality.inspected,80);assert.equal(data.quality.retained,64);
  assert.equal(data.status,'complete-loaded-roi');assert.equal(data.scope.boundingBoxPreFilter,false);
  for(const n of data.nodes) {
    assert.equal(n.inspection,'complete');assert.equal(n.inspected,5);assert.equal(n.probes.length,5);
    assert.ok(n.probes.every(p=>p.insideReportedGeometryBox===false));
    assert.equal(n.boundingBoxesUsedForSelection,false);
    assert.ok(n.nearestToRailOrigin.left);assert.ok(n.nearestToRailOrigin.right);
  }
});

test('zero ROI retains evidence; no point checks are reported as zero error',async()=>{
  const f=F.scene();f.mesh.geometry.attributes.position=F.buffer([[100,100,100],[200,200,200]]);
  const data=await L.capture(options(f));
  assert.equal(data.status,'no-points');assert.equal(data.quality.inspected,2);
  assert.equal(data.quality.roundTripMaxSceneUnits,null);assert.equal(data.quality.pointRoundTripsChecked,0);
  assert.equal(data.scope.scanComplete,true);assert.equal(data.scope.completeLoadedRoi,false);
  assert.equal(data.nodes.length,1);assert.equal(data.nodes[0].probes.length,2);
  assert.deepEqual(data.nodes[0].probes[0].pointNodeLocal,[100,100,100]);
});

test('all node diagnostics survive an early scan budget',async()=>{
  const data=await L.capture({...options(sixteenNodes()),maxInspected:1});
  assert.equal(data.nodes.length,16);assert.equal(data.quality.inspected,1);
  assert.equal(data.scope.scanComplete,false);assert.equal(data.scope.completeLoadedRoi,false);
  assert.equal(data.nodes[0].inspection,'partial-budget');
  assert.ok(data.nodes.slice(1).every(n=>n.inspection==='not-scanned'&&n.probes.length===5));
});

test('matrix hypotheses are exposed but never silently substituted',async()=>{
  const f=F.scene();f.mesh.matrixWorld.elements[12]+=1000;
  const data=await L.capture(options(f)),n=data.nodes[0];
  assert.equal(data.status,'no-points');assert.equal(n.hierarchyMatrixMaxDifference,1000);
  assert.equal(n.probes[0].roiHit.left,false);assert.equal(n.probes[0].hierarchyRoiHit.left,true);
  assert.equal(data.pointsSceneRelative.length,0);
  assert.equal(f.mesh.matrixWorld.elements[12],514237);
});

test('probes respect indexed draw ranges',async()=>{
  const f=F.scene();f.mesh.geometry.index={array:new Uint16Array([4,0,2,3]),count:4,itemSize:1};
  f.mesh.geometry.drawRange={start:1,count:2};
  const data=await L.capture(options(f));
  assert.deepEqual(data.nodes[0].probes.map(p=>p.sourceIndex),[0,2]);
  assert.equal(data.quality.inspected,2);assert.equal(data.quality.retained,2);
});

test('diagnostic samples from unscanned nodes must also remain consistent',async()=>{
  const f=sixteenNodes();let calls=0;
  await assert.rejects(L.capture({...options(f),maxInspected:1,pause:async()=>{
    if(++calls===2)f.pc.visibleNodes[3].sceneNode.geometry.attributes.position.version++;
  }}),/changé/);
});
