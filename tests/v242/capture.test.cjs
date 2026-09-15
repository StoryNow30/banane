const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../capture-core.js'),L=require('../lidar.js'),F=require('./fixtures.cjs');
const close=(a,b,eps=1e-8)=>assert.ok(C.distance(a,b)<eps,`${a} != ${b}`);
const options=f=>({viewer:f.viewer,rails:[f.left,f.right].map(C.railState),origin:[513237,6638161,60],
  guard:()=>{},enums:F.enums,meta:{part:20,cut:0,shape:'U50'},pause:async()=>{}});

test('independent NumPy/SciPy oracle for arbitrary 3D rotations and nonuniform reflected scales',()=>{
  for(const t of require('./matrices-oracle.json').cases) {
    const o=F.object(t.position,'Object3D',0,t.scale);
    o.quaternion=Object.fromEntries(['x','y','z','w'].map((key,i)=>[key,t.quaternion[i]]));
    const actual=C.worldMatrix(o);
    assert.ok(actual.every((x,i)=>Math.abs(x-t.matrix[i])<1e-10));
    close(C.point(actual,t.point),t.world,3e-9);
    close(C.point(C.inverse(actual),t.world),t.point,6e-9);
  }
});

test('full rotation, translated parent, mirrored scale and world/local round trips',()=>{
  const parent=F.object([500000,6600000,20],'Object3D',Math.PI/2,[2,3,1]);
  const child=F.add(parent,F.object([1,2,3],'Object3D',0,[-1,1,1]));
  const m=C.worldMatrix(child);
  close(C.point(m,[4,5,6]),[499979,6599994,29]);
  close(C.point(C.inverse(m),[499979,6599994,29]),[4,5,6]);
  const rebased=C.rebase(m,[500000,6600000,20]);close(C.point(rebased,[4,5,6]),[-21,-6,9]);
  assert.throws(()=>C.inverse(Array(16).fill(0)),/singulière/);
  assert.throws(()=>C.point(C.identity(),[NaN,0,0]),/non finie/);
});

test('manual matrices, stale live caches, Euler and nested profile rotations are preserved',()=>{
  const f=F.scene(),before=[f.left,f.right].map(C.railState);
  f.left.position.y+=.032;
  f.right.children[1].rotation.x=.02;f.right.children[1].quaternion.x=Math.sin(.01);f.right.children[1].quaternion.w=Math.cos(.01);
  const after=[f.left,f.right].map(C.railState),r=C.reference(before,after,[513237,6638161,60],{source:'explicit-before-after'});
  assert.ok(Math.abs(r.rails.left.displacementSceneMeters-.032)<1e-8);
  assert.equal(r.rails.right.rotationChanged,true);
  close(r.rails.left.corrected.positionSceneRelative,[0,.032,0]);
  assert.equal(f.left.matrixWorld.elements[13],6638161); // our code did not update this cache
  const manual=F.object();manual.matrixAutoUpdate=false;manual.matrix={elements:C.translation([1,2,3])};
  close(C.point(C.worldMatrix(manual),[0,0,0]),[1,2,3]);
});

test('interleaved and normalized attributes, source precision and invalid buffers',()=>{
  const a={isInterleavedBufferAttribute:true,data:{array:new Float32Array([9,1,2,3,9,4,5,6]),stride:4,version:0},offset:1,itemSize:3,count:2};
  const reader=C.attribute(a);assert.deepEqual(reader.point(1),[4,5,6]);assert.equal(reader.unchanged(),true);
  a.data.version++;assert.equal(reader.unchanged(),false);
  const b=C.attribute({array:new Uint8Array([0,255,128]),count:1,itemSize:3,normalized:true});
  close(b.point(0),[0,1,128/255]);
  assert.throws(()=>C.attribute({array:new Float32Array(2),itemSize:3,count:1}),/incomplet/);
});

test('loaded points preserve identity and matrices, both rail ROIs, no scene mutation',async()=>{
  const f=F.scene(),before=JSON.stringify([f.left.position,f.right.position,f.mesh.matrixWorld,f.mesh.geometry]);
  const data=await L.capture(options(f));
  assert.equal(data.status,'complete-loaded-roi');assert.equal(data.quality.retained,4);
  assert.equal(data.quality.perRail.left,2);assert.equal(data.quality.perRail.right,2);
  close(data.pointsSceneRelative[0],[0,.01,.02]);assert.deepEqual(data.pointSources[0],[0,0]);
  assert.equal(data.scope.subsampling,false);assert.equal(data.scope.completeCloud,false);
  assert.equal(data.quality.visualCorrespondence,'not-verified');
  assert.ok(data.quality.worldRoundTripMaxSceneUnits<1e-6);
  assert.equal(JSON.stringify([f.left.position,f.right.position,f.mesh.matrixWorld,f.mesh.geometry]),before);
  assert.ok(!JSON.stringify(data).includes('6638161'));
  assert.equal(data.rails.left.profileContours.length,1);
});

test('Set nodes and object deduplication; no loaded-cache fallback when visibleNodes is empty',async()=>{
  const f=F.scene();f.pc.visibleNodes=new Set([{sceneNode:f.mesh},{sceneNode:f.mesh}]);
  assert.equal((await L.capture(options(f))).quality.retained,4);
  f.pc.visibleNodes=[];F.add(f.pc,f.mesh);
  assert.equal((await L.capture(options(f))).status,'no-points');
  delete f.pc.visibleNodes;
  const fallback=await L.capture(options(f));assert.equal(fallback.quality.retained,4);
  assert.ok(fallback.warnings.some(x=>x.includes('visibleNodes absente')));
});

test('unknown geometry-node transform is reported and not guessed',async()=>{
  const f=F.scene();f.pc.visibleNodes.push({geometryNode:{geometry:f.mesh.geometry}});
  const data=await L.capture(options(f));
  assert.equal(data.status,'partial-unsupported');assert.equal(data.quality.retained,4);
  assert.equal(data.clouds[0].unsupportedNodes[0].hasGeometryNodePosition,true);
});

test('bounded export is visibly partial; non-finite points and drawRange are tracked',async()=>{
  const f=F.scene();
  const partial=await L.capture({...options(f),maxPoints:2});
  assert.equal(partial.status,'partial-limit');assert.equal(partial.quality.retained,2);
  f.mesh.geometry.attributes.position=F.buffer([[NaN,0,0],[0,0,0],[0,1.435,0]]);
  const bad=await L.capture(options(f));assert.equal(bad.quality.nonFinitePositions,1);assert.equal(bad.quality.retained,2);
  f.mesh.geometry.drawRange={start:2,count:1};
  assert.equal((await L.capture(options(f))).quality.retained,1);
});

test('actual cancellation and cut changes abort within a chunk',async()=>{
  const f=F.scene();let cancelled=false,calls=0;
  await assert.rejects(L.capture({...options(f),yieldEvery:1,
    guard:()=>{if(cancelled)throw Error('cut changed');},pause:async()=>{calls++;cancelled=true;}}),/cut changed/);
  assert.equal(calls,1);
});

test('buffer replacement, version changes, LOD replacement and camera change are rejected',async()=>{
  for(const change of [
    f=>{f.mesh.geometry.attributes.position=F.buffer([[0,0,0]]);},
    f=>{f.mesh.geometry.attributes.position.version++;},
    f=>{f.pc.visibleNodes=[];},
    f=>{f.camera.position.x+=1;}
  ]) {
    const f=F.scene();let once=false;
    await assert.rejects(L.capture({...options(f),pause:async()=>{if(!once){once=true;change(f);}}}),/changé/);
  }
});

test('box clipping uses actual enum values; keeps all ROI points and annotates membership',async()=>{
  const f=F.scene();f.pc.material.clipTask=2;
  f.pc.material.clipBoxes=[{inverse:{elements:C.inverse(C.translation([513237,6638161,60]))}}];
  const data=await L.capture(options(f));assert.equal(data.quality.retained,4);
  assert.deepEqual(data.visibleByClipBoxes,[true,true,false,false]);
  const unknown=await L.capture({...options(f),enums:{}});
  assert.deepEqual(unknown.visibleByClipBoxes,[null,null,null,null]);
  assert.equal(unknown.clouds[0].clipping.classificationAvailable,false);
});
