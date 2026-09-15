'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const K=require('../src/core.js'),G=require('../src/geometry.js'),Lab=require('../tools/placement-lab.cjs'),Legacy=require('../tools/native-offline-evaluate.cjs');
const {base}=require('./fixtures.cjs');
const identity={pageId:'page',part:1,cut:7,shape:'U50',frameId:'frame',projectId:null};
const before='2026-09-13T19:00:00.000Z',snapshotTime='2026-09-13T19:00:01.000Z',change='2026-09-13T19:00:03.000Z';
function fixture(){const clouds=new Map(),railSnapshots={left:[],right:[]};
 for(const side of ['left','right']){const id=`snap-${side}`,rail=K.clone(base.rails[side]);
  const points=base.pointsSceneRelative.filter(p=>{const q=K.C.point(rail.sceneRelativeToProfileLocal,p);
   return Math.abs(q[0])<=.5&&Math.abs(q[1])<=.4&&Math.abs(q[2])<=.3;});
  const coord={name:'scene-relative',frameId:'frame',units:'metres-observed-not-independently-calibrated',physicalCalibrationStatus:'not-independently-verified'};
  const qualification={status:'qualified-candidate',chunkIds:[id],coordinateSystem:coord,transform:{valid:true},associationStatus:'same-target-and-rail-pose'};
  clouds.set(id,{format:'banane-native-lidar-chunk-v1',chunkId:id,side,identity,coordinateSystem:coord,rail,qualification,
   pointsSceneRelative:points,visibleByClipBoxes:points.map(()=>true)});
  railSnapshots[side].push({snapshotId:id,side,identity,coordinateSystem:coord,chunkIds:[id],
   qualificationStatus:'qualified-candidate',criteriaVersion:'native-visible-roi-v1',acquisitionStartedAt:before,
   acquiredThroughAt:snapshotTime,storedAt:'2026-09-13T19:00:01.100Z',receiptEventSeq:1,
   transform:{valid:true},clipStatus:'verified-classifiable',associationStatus:'same-target-and-rail-pose',
   coverage:{status:'qualified-candidate',pointsInEngineUsefulRoi:100}});}
 const state={identity,rails:K.clone(base.rails),capturedAt:before},finalState=K.clone(state);
 finalState.capturedAt='2026-09-13T19:00:03.900Z';
 return {clouds,record:{recordId:'record',visitId:'visit',identity,beforeEstablished:state,railSnapshots,
  stateTransitions:[],operatorIntents:[{intent:'VALIDATE',observedAt:'2026-09-13T19:00:04.000Z',eventSeq:9,
   stateObservedBeforeInput:K.clone(finalState)}],
  humanFinalReference:{status:'candidate-observed',state:finalState,observedAt:'2026-09-13T19:00:04.000Z',eventSeq:9,
   association:{identityMatched:true,freshnessMs:100,stateCapturedAt:finalState.capturedAt}},
  observedLabelCandidate:'VALIDATE_NO_MOVEMENT',serverConfirmationStatus:'not-observed'}};}
function transition(record,kind,side,at=change){const beforeState=K.clone(record.beforeEstablished),afterState=K.clone(beforeState);
 afterState.capturedAt=at;if(side)afterState.rails[side]=K.expectedPoses(beforeState,
  {left:{delta:side==='left'?[0,.01,0]:[0,0,0]},right:{delta:side==='right'?[0,.01,0]:[0,0,0]}})[side];
 return {observedAt:at,eventSeq:8,effect:{kind},beforeState,afterState};}
test('the pre-correction input, selected snapshot and proposal are invariant to final-only change',()=>{
 const {clouds,record}=fixture(),first=Lab.evaluateVisit(record,clouds),secondRecord=K.clone(record);
 secondRecord.humanFinalReference.state.rails.left=K.expectedPoses(record.beforeEstablished,{left:{delta:[0,.012,.002]},right:{delta:[0,0,0]}}).left;
 const second=Lab.evaluateVisit(secondRecord,clouds);
 for(const side of ['left','right']){
  assert.equal(first.rails[side].input.snapshotId,second.rails[side].input.snapshotId);
  assert.equal(first.rails[side].input.inputHash,second.rails[side].input.inputHash);
  assert.deepEqual(first.rails[side].proposal,second.rails[side].proposal);
 }
 assert.equal(first.rails.left.reference.status,'candidate');
 assert.equal(second.rails.left.reference.reason,'human-final-not-associated-with-validate-state');
 assert.equal(first.safety.commandsSent,0);assert.equal(first.serverConfirmationStatus,'not-observed');
});
test('never feed a qualified snapshot acquired after an observed correction to the engine',()=>{
 const f=fixture();f.record.stateTransitions.push(transition(f.record,'rail-state-changed','right'));
 f.record.railSnapshots.right[0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 const result=Lab.evaluateVisit(f.record,f.clouds);
 assert.equal(result.rails.left.input.status,'ready');assert.equal(result.rails.right.input.status,'excluded');
 assert.ok(result.rails.right.input.reasons.includes('no-qualified-pre-correction-snapshot'));
 assert.equal(result.pairInput.status,'excluded');
});
test('left corrected before acquisition of the still-unchanged right rail retains right input',()=>{
 const f=fixture();f.record.stateTransitions.push(transition(f.record,'rail-state-changed','left'));
 f.record.railSnapshots.right[0].acquisitionStartedAt='2026-09-13T19:00:03.100Z';
 f.record.railSnapshots.right[0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 const r=Lab.evaluateVisit(f.record,f.clouds);
 assert.equal(r.rails.right.input.status,'ready');assert.equal(r.rails.left.input.firstObservedRailChangeAt,change);
 assert.equal(r.rails.right.input.firstObservedRailChangeAt,null);
});
test('rail displacement accompanied by a view change bounds only that rail; camera-only changes do not',()=>{
 const f=fixture(),t=transition(f.record,'rail-and-loaded-view-changed','right');
 t.afterState.viewObservation={viewEpochId:'new-view'};f.record.stateTransitions.push(t);
 f.record.railSnapshots.right[0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 f.record.railSnapshots.left[0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 const r=Lab.evaluateVisit(f.record,f.clouds);
 assert.equal(r.rails.left.input.status,'ready');assert.equal(r.rails.right.input.status,'excluded');
 assert.equal(r.rails.right.input.temporalBoundary.reason,'no-qualified-pre-correction-snapshot');
 const g=fixture();g.record.stateTransitions.push(transition(g.record,'loaded-view-changed',null));
 g.record.railSnapshots.right[0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 assert.equal(Lab.evaluateVisit(g.record,g.clouds).rails.right.input.status,'ready');
});
test('unattributable rail change excludes both sides with an explicit conservative reason',()=>{
 const f=fixture();f.record.stateTransitions.push({observedAt:change,eventSeq:8,effect:{kind:'rail-and-loaded-view-changed'}});
 for(const side of ['left','right'])f.record.railSnapshots[side][0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 const r=Lab.evaluateVisit(f.record,f.clouds);
 for(const side of ['left','right']){
  assert.equal(r.rails[side].input.status,'excluded');
  assert.ok(r.rails[side].input.reasons.includes('no-qualified-before-unattributed-rail-transition'));
  assert.equal(r.rails[side].input.firstUnattributedTransitionReason,'transition-states-missing');
 }
});
test('a local rail frame change without a displacement bounds its side, while a global frame change bounds both',()=>{
 const f=fixture(),t=transition(f.record,'rail-state-changed',null);
 t.afterState.rails.right.profileLocalToSceneRelative[0]+=.001;f.record.stateTransitions.push(t);
 f.record.railSnapshots.right[0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 let r=Lab.evaluateVisit(f.record,f.clouds);
 assert.equal(r.rails.left.input.status,'ready');assert.equal(r.rails.right.input.status,'excluded');
 assert.equal(r.rails.right.input.firstObservedRailChangeKind,'rail-profile-frame-changed');
 const g=fixture(),frame=transition(g.record,'rail-and-loaded-view-changed',null);
 frame.afterState.identity={...identity,frameId:'other-frame'};g.record.stateTransitions.push(frame);
 for(const side of ['left','right'])g.record.railSnapshots[side][0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 r=Lab.evaluateVisit(g.record,g.clouds);
 for(const side of ['left','right']){
  assert.equal(r.rails[side].input.status,'excluded');
  assert.equal(r.rails[side].input.firstUnattributedTransitionReason,'transition-coordinate-frame-changed');
 }
});
test('transition side is reconstructed from exported visit-state events, without reading the human final',()=>{
 const f=fixture(),t=transition(f.record,'rail-and-loaded-view-changed','left');
 f.record.stateTransitions.push({observedAt:t.observedAt,eventSeq:8,effect:{kind:t.effect.kind}});
 const observations=[{type:'native-visit-started',eventSeq:1,state:t.beforeState},
  {type:'native-state-observed',eventSeq:8,state:t.afterState}];
 f.record.railSnapshots.left[0].acquiredThroughAt='2026-09-13T19:00:03.500Z';
 assert.equal(Lab.prepareVisit(f.record,f.clouds,observations).rails.left.status,'excluded');
 assert.equal(Lab.prepareVisit(f.record,f.clouds,observations).rails.right.status,'ready');
 assert.equal(Lab.prepareVisit(f.record,f.clouds).rails.left.firstUnattributedTransitionReason,'transition-states-missing');
});
test('human final freshness, association and visit chronology are checked independently of unique VALIDATE',()=>{
 const f=fixture();let altered=K.clone(f.record);
 altered.humanFinalReference.state.capturedAt='2026-09-13T18:59:50.000Z';
 assert.equal(Lab.evaluateVisit(altered,f.clouds).rails.left.reference.status,'unavailable');
 altered=K.clone(f.record);altered.humanFinalReference.observedAt='2026-09-13T19:00:05.000Z';
 assert.equal(Lab.evaluateVisit(altered,f.clouds).rails.left.reference.reason,'human-final-not-associated-with-validate-state');
 altered=K.clone(f.record);altered.humanFinalReference.association.freshnessMs=200;
 assert.equal(Lab.evaluateVisit(altered,f.clouds).rails.left.reference.reason,'human-final-not-freshly-observed');
 altered=K.clone(f.record);altered.endedAt='2026-09-13T19:00:02.000Z';
 assert.equal(Lab.evaluateVisit(altered,f.clouds).rails.left.reference.reason,'human-final-after-visit-ended');
});
test('reference engine proposal is identical to frozen legacy evaluation on the same rail/pair input',()=>{
 const {clouds,record}=fixture(),prepared=Lab.prepareVisit(record,clouds),actual=Lab.execute(prepared);
 const expected=prepared.pair.status==='ready'?G.proposeBoth(prepared.pair.capture,G.DEFAULTS):{};
 for(const side of ['left','right'])assert.deepEqual(actual.proposals[side],expected[side]);
 assert.equal(Lab.engines.reference.parameters,G.DEFAULTS);
 const descriptor={identity,side:'left',initialRail:record.beforeEstablished.rails.left,eligibility:{criteriaVersion:'native-visible-roi-v1',snapshotId:'snap-left',chunkIds:['snap-left']}};
 assert.equal(prepared.rails.left.inputHash,Legacy.buildEngineInput(descriptor,clouds).inputHash);
});
test('unknown physical calibration never claims certified millimetres',()=>{
 const s=Lab.score({status:'candidate',delta:[0,.005,.002]},{status:'candidate',deltaLocal:[0,0,0]},
  {units:'metres-observed-not-independently-calibrated',physicalCalibrationStatus:'not-independently-verified'});
 assert.equal(s.status,'comparable');assert.equal(s.physicalMillimetres,null);assert.equal(s.errorSceneUnits.lateral,.005);
});
test('multiple or skip-only operator intents cannot silently become a reference',()=>{
 const f=fixture();f.record.operatorIntents.push({intent:'SKIP'});
 assert.equal(Lab.evaluateVisit(f.record,f.clouds).rails.left.reference.reason,'multi-intent-reference-ambiguous');
 f.record.operatorIntents=[{intent:'SKIP'}];
 assert.equal(Lab.evaluateVisit(f.record,f.clouds).rails.left.reference.reason,'no-single-validate-intent');
});
test('untrusted checkpoint and mismatched cut are excluded without mixing rails',()=>{
 const f=fixture();f.clouds.get('snap-left').identity={...identity,cut:8};
 assert.equal(Lab.evaluateVisit(f.record,f.clouds).rails.left.input.status,'excluded');
 f.clouds.get('snap-left').identity={...identity};f.record.railSnapshots.right[0].transform.valid=false;
 assert.ok(Lab.evaluateVisit(f.record,f.clouds).rails.right.input.reasons.includes('snapshot-transform-clip-or-association-unverified'));
});
test('separate engine adapters run on prepared inputs without changing the source engine',()=>{
 const f=fixture(),prepared=Lab.prepareVisit(f.record,f.clouds);
 const adapter={id:'future-stub-test-only',parameters:{},run:input=>({proposals:{left:{status:'unresolved',reasons:['test']},right:null},errors:{}})};
 assert.equal(Lab.execute(prepared,adapter).proposals.left.status,'unresolved');
 assert.equal(Lab.execute(prepared).proposals.left.status,Lab.engines.reference.run(prepared).proposals.left.status);
});
