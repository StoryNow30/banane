const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../src/core.js'),O=require('../tools/native-offline-evaluate.cjs'),{base}=require('./fixtures.cjs');
const identity={pageId:'offline-page',part:23,cut:2855,shape:'U50',frameId:'offline-frame',projectId:null};
function points(side){const rail=base.rails[side];return base.pointsSceneRelative.filter(point=>{const local=K.C.point(rail.sceneRelativeToProfileLocal,point);
 return Math.abs(local[0])<=.5&&Math.abs(local[1])<=.4&&Math.abs(local[2])<=.3;});}
function fixture(){const clouds=new Map(),eligibility={};for(const side of ['left','right']){const rows=points(side),id=`capture-${side}:${side}:0`;
  clouds.set(id,{format:'banane-native-lidar-chunk-v1',chunkId:id,captureId:`capture-${side}`,visitId:'visit-1',side,identity,
   coordinateSystem:{name:'scene-relative',units:'metres-observed-not-independently-calibrated'},rail:K.clone(base.rails[side]),
   pointsSceneRelative:rows,pointsProfileLocal:rows.map(point=>K.C.point(base.rails[side].sceneRelativeToProfileLocal,point)),visibleByClipBoxes:rows.map(()=>true)});
  eligibility[side]={status:'comparable-candidate',captureId:`capture-${side}`,chunkIds:[id],points:rows.length,reasons:[]};}
 eligibility.pair={status:'comparable-candidate',simultaneousRequired:false,reasons:[]};const state={identity,rails:K.clone(base.rails),capturedAt:new Date().toISOString()};
 const record={recordId:'record-1',visitId:'visit-1',identity,beforeEstablished:state,humanFinalReference:{status:'candidate-observed',state:K.clone(state)},
  observedLabelCandidate:'VALIDATE_NO_MOVEMENT',geometryEligibility:eligibility,serverConfirmationStatus:'not-observed'};return {clouds,record};}

test('the offline engine input boundary accepts geometry and initial rails but no human final',()=>{
 const f=fixture(),descriptor={identity,side:'left',initialRail:f.record.beforeEstablished.rails.left,eligibility:f.record.geometryEligibility.left};
 const input=O.buildEngineInput(descriptor,f.clouds);assert.equal(input.status,'ready');assert.equal(input.points,points('left').length);
 assert.equal(Object.hasOwn(descriptor,'humanFinalReference'),false);assert.equal(input.capture.humanFinalReference,undefined);
});

test('changing only the human final never changes engine input or proposal',()=>{
 const f=fixture(),engine={parameters:require('../src/geometry.js').DEFAULTS},first=O.evaluateRecord(f.record,f.clouds,engine),moved=K.clone(f.record);
 moved.humanFinalReference.state.rails.left=K.expectedPoses(f.record.beforeEstablished,{left:{delta:[0,.01,.002]},right:{delta:[0,0,0]}}).left;
 const second=O.evaluateRecord(moved,f.clouds,engine);assert.equal(first.engineInput.left.inputHash,second.engineInput.left.inputHash);
 assert.deepEqual(first.proposal.left,second.proposal.left);assert.equal(first.safety.humanFinalPositionsProvidedToEngine,false);
});

test('one rail can be evaluated independently and a visual proof stays in its initial profile frame',()=>{
 const f=fixture();f.record.geometryEligibility.right={status:'excluded',reasons:['right-missing']};f.record.geometryEligibility.pair={status:'excluded',reasons:['right-missing']};
 const result=O.evaluateRecord(f.record,f.clouds,{parameters:require('../src/geometry.js').DEFAULTS});assert.equal(result.engineInput.left.status,'ready');
 assert.equal(result.engineInput.right.status,'excluded');const svg=O.renderSvg(result,'left');assert.match(svg,/repère profil initial/);assert.match(svg,/points exportés/);
});

test('a mismatched identity is excluded instead of mixing cuts',()=>{
 const f=fixture(),chunk=f.clouds.get('capture-left:left:0');chunk.identity={...identity,cut:999};const descriptor={identity,side:'left',initialRail:f.record.beforeEstablished.rails.left,
  eligibility:f.record.geometryEligibility.left};const input=O.buildEngineInput(descriptor,f.clouds);assert.equal(input.status,'excluded');assert.ok(input.reasons.some(reason=>reason.startsWith('chunk-identity-mismatch')));
});
test('the replay feeds only proven clip-visible points, not the raw coverage used in the old audit',()=>{
 const f=fixture(),chunk=f.clouds.get('capture-left:left:0');chunk.visibleByClipBoxes=chunk.visibleByClipBoxes.map((_,index)=>index%2===0);
 const descriptor={identity,side:'left',initialRail:f.record.beforeEstablished.rails.left,eligibility:f.record.geometryEligibility.left};
 const input=O.buildEngineInput(descriptor,f.clouds);assert.equal(input.status,'ready');
 assert.equal(input.points,Math.ceil(chunk.pointsSceneRelative.length/2));assert.ok(input.capture.visibleByClipBoxes.every(Boolean));
});
test('a new qualified descriptor must refer to the exact persisted snapshot chunk',()=>{
 const f=fixture(),descriptor={identity,side:'left',initialRail:f.record.beforeEstablished.rails.left,
  eligibility:{...f.record.geometryEligibility.left,criteriaVersion:'native-visible-roi-v1',snapshotId:'wrong'}};
 assert.ok(O.buildEngineInput(descriptor,f.clouds).reasons.includes('qualified-checkpoint-not-exported'));
});
