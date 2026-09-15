const {test}=require('node:test'),assert=require('node:assert/strict');
const {Sessions}=require('../src/native-session.js'),{Engine}=require('../src/engine.js'),{K,base,MemoryStore}=require('./fixtures.cjs');

async function fixture(){
 const store=new MemoryStore();store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];store.keys=async()=>[...store.clouds.keys()];
 const calls=[],adapter={state:async()=>initial(),nativeStart:async()=>{calls.push('nativeStart');return {active:true};},
  nativePause:async()=>{calls.push('nativePause');return {metrics:{}};},nativeResume:async()=>{calls.push('nativeResume');return {active:true};},
  nativeFinish:async()=>{calls.push('nativeFinish');return {metrics:{}};}};
 const engine=new Engine(adapter,store);await engine.init();const sessions=new Sessions(engine,adapter,store);await sessions.init();
 function initial(cut=100){return {identity:{pageId:'native-page',part:23,cut,shape:'U50',frameId:'native-frame',projectId:null},rails:K.clone(base.rails),
   capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],viewObservation:{status:'observed',viewEpochId:'view-1',observedAt:new Date().toISOString()},
   geominfo:{status:'not-observed',raw:null,source:null}};}
 async function open(visitId='visit-1',cut=100){const n=engine.s.native,p=n.observationPeriods.at(-1);await sessions.receive('period-started',{sessionId:n.id,
   observationPeriodId:p.observationPeriodId,startedAt:new Date().toISOString()});const state=initial(cut);await sessions.receive('visit-started',{sessionId:n.id,
   observationPeriodId:p.observationPeriodId,visitId,identity:state.identity,initialObserved:state});return {n,p,state,visitId};}
 function geometry(state,id='capture-1',sides=['left','right'],visitId='visit-1'){
  const chunks=[],railObservations={};for(const side of sides){const local=Array.from({length:200},(_,index)=>[-.49+.98*index/199,.03,.02]);
   const scene=local.map(point=>K.C.point(state.rails[side].profileLocalToSceneRelative,point));chunks.push({format:'banane-native-lidar-chunk-v1',version:K.VERSION,
    chunkId:`${id}:${side}:0`,captureId:id,visitId,side,identity:K.clone(state.identity),capturedAt:state.capturedAt,viewObservation:K.clone(state.viewObservation),
    rail:K.clone(state.rails[side]),coordinateSystem:{name:'scene-relative',units:'metres-observed-not-independently-calibrated',frameId:state.identity.frameId},
    acquisition:{startedAt:state.capturedAt,endedAt:state.capturedAt,emittedAt:state.capturedAt,sourceStatus:'reference-version-and-matrix-stable-through-checkpoint'},
    qualification:{format:'banane-native-rail-snapshot-v1',criteriaVersion:'native-visible-roi-v1',status:'qualified-candidate',
     acquisitionStartedAt:state.capturedAt,acquiredThroughAt:state.capturedAt,coverage:{status:'qualified-candidate',pointsInRoi:200,
      pointsInEngineUsefulRoi:200,longitudinalBins:10,longitudinalSpan:.98,exclusionReasons:[]},transform:{valid:true,maxIdentityError:0},
     associationStatus:'same-target-and-rail-pose',sourceStatus:'reference-version-and-matrix-stable-through-checkpoint',clipStatus:'verified-classifiable',
     chunkIds:[`${id}:${side}:0`],exclusionReasons:[]},pointsSceneRelative:scene,
    pointsProfileLocal:local,pointSources:local.map((_,index)=>[0,index]),visibleByClipBoxes:local.map(()=>true)});
   railObservations[side]={side,rail:K.clone(state.rails[side]),capturedAt:state.capturedAt,completedAt:new Date().toISOString(),associationStatus:'same-target-and-rail-pose',
    transform:{valid:true,maxIdentityError:0},pointsRetained:200,coverage:{status:'qualified-candidate',pointsInRoi:200,pointsInEngineUsefulRoi:200,
     longitudinalBins:10,longitudinalSpan:.98,exclusionReasons:[]},geometryInputStatus:'qualified-candidate',exclusionReasons:[],checkpointedPoints:200};}
  const cloud={format:'banane-native-lidar-capture-v2',version:K.VERSION,captureId:id,visitId,identity:K.clone(state.identity),startedAt:state.capturedAt,
   capturedAt:state.capturedAt,completedAt:new Date().toISOString(),status:'complete-loaded-buffers',viewObservation:K.clone(state.viewObservation),railObservations,
   trace:{pointsAvailableInBuffers:400,diagnosticProbesRead:66,pointsRead:400,pointsTransformed:400,pointsRetainedInRoi:200*sides.length,
    pointsCheckpointed:200*sides.length,pointsSaved:0,pointsExported:0},termination:null};return {chunks,cloud};
 }
 async function saveGeometry(info,id='capture-1',sides=['left','right']){const data=geometry(info.state,id,sides,info.visitId);
  for(const chunk of data.chunks)await sessions.receive('capture-checkpoint',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
   visitId:info.visitId,identity:info.state.identity,chunk});
  await sessions.receive('capture-ready',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,visitId:info.visitId,
   identity:info.state.identity,cloud:data.cloud});return data;}
 return {store,adapter,engine,sessions,calls,initial,open,geometry,saveGeometry};
}

async function intent(f,info,name,state=info.state){await f.sessions.receive('operator-event',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
 visitId:info.visitId,identity:info.state.identity,stateObservedBeforeInput:state,event:{type:'keydown',intent:name,observedAt:new Date().toISOString()}});}
async function closeVisit(f,info,state=info.state,next=101,reason='target-changed'){await f.sessions.receive('visit-ended',{sessionId:info.n.id,
 observationPeriodId:info.p.observationPeriodId,visitId:info.visitId,identity:info.state.identity,finalObserved:state,reason,
 nextIdentity:next===null?null:{...state.identity,cut:next},endedAt:new Date().toISOString()});}

test('a qualified no-movement validation stays a candidate reference, never an automatic training item',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open();await f.saveGeometry(info);await intent(f,info,'VALIDATE');await closeVisit(f,info);
 const data=await f.sessions.end(),record=data.records[0];assert.equal(record.observedLabelCandidate,'VALIDATE_NO_MOVEMENT');
 assert.equal(record.geometryEligibility.left.status,'comparable-candidate');assert.equal(record.geometryEligibility.right.status,'comparable-candidate');
 assert.equal(record.usableAsNativeReference,true);assert.equal(record.usableForTraining,false);assert.equal(record.commandSentByBanane,false);
 assert.equal(record.serverConfirmationStatus,'not-observed');assert.equal(data.closureSummary.serverConfirmationNotAnError,true);
 assert.equal(data.closureSummary.firstQualifiedStoredSnapshotByRail.left,1);
 assert.equal(data.closureSummary.firstQualifiedStoredSnapshotByRail.right,1);
 assert.ok(data.closureSummary.durationMinutes>=0);
 assert.equal(data.format,'banane-native-session-v2');assert.equal(data.cloudIds.length,3);
 const captureEvent=data.events.find(event=>event.type==='native-capture-ready');assert.equal(captureEvent.cloud.pointsByRail.left,200);assert.equal(captureEvent.cloud.pointsSceneRelative,undefined);
 assert.deepEqual(data.events.map(event=>event.eventSeq),data.events.map(event=>event.eventSeq).slice().sort((a,b)=>a-b));
 assert.deepEqual(f.calls,['nativeStart','nativeFinish']);
});

test('an observed SKIP remains distinct and is excluded from pointing references',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open();await f.saveGeometry(info);await intent(f,info,'SKIP');await closeVisit(f,info,info.state,105);
 const data=await f.sessions.end(),record=data.records[0];assert.equal(record.observedLabelCandidate,'SKIP');assert.equal(record.usableAsNativeReference,false);
 assert.equal(record.trainingExclusionReason,'operator-skip-observed');assert.equal(data.closureSummary.serverConfirmationAvailable,false);
});

test('native observation classifies corrections of both rails without sending their movement',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open();await f.saveGeometry(info);const final=K.clone(info.state);
 final.rails=K.expectedPoses(info.state,{left:{delta:[0,.006,.002]},right:{delta:[0,-.008,.003]}});final.capturedAt=new Date().toISOString();
 await f.sessions.receive('state-observed',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,visitId:info.visitId,identity:info.state.identity,
  state:final,trigger:'poll',effect:{kind:'rail-state-changed'}});await intent(f,info,'VALIDATE',final);await closeVisit(f,info,final);
 const data=await f.sessions.end(),record=data.records[0];assert.equal(record.observedLabelCandidate,'VALIDATE_CORRECTED_BOTH');
 assert.equal(record.usableAsNativeReference,true);assert.equal(f.calls.some(value=>['apply','next','validate','skip'].includes(value)),false);
});

test('one good rail remains comparable when the other geometry is missing',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open();await f.saveGeometry(info,'capture-left',['left']);await intent(f,info,'VALIDATE');await closeVisit(f,info);
 const record=(await f.sessions.end()).records[0];assert.equal(record.geometryEligibility.left.status,'comparable-candidate');
 assert.equal(record.geometryEligibility.right.status,'excluded');assert.equal(record.geometryEligibility.pair.status,'excluded');
 assert.equal(record.usableForOfflineEvaluationByRail.left,true);assert.equal(record.usableForOfflineEvaluationByRail.right,false);
});

test('multiple terminal intentions remain sequenced and never become a silent positive reference',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open();await f.saveGeometry(info);await intent(f,info,'VALIDATE');await intent(f,info,'SKIP');await closeVisit(f,info);
 const record=(await f.sessions.end()).records[0];assert.equal(record.operatorIntents.length,2);assert.equal(record.multiIntent,true);
 assert.equal(record.observedLabelCandidate,'AMBIGUOUS_MULTIPLE_INTENTS');assert.equal(record.usableAsNativeReference,false);
 assert.ok(record.geometryEligibility.left.reasons.includes('multiple-operator-intents-observed'));
});

test('Pause and resume preserve the session and classify continuation separately from a revisit',async()=>{
 const f=await fixture();await f.sessions.start();const first=await f.open();await closeVisit(f,first,first.state,null,'pause');const id=f.engine.s.native.id,period=f.engine.s.native.currentPeriodId;
 await f.sessions.pause();await f.sessions.resume();const second=await f.open('visit-2',100);assert.equal(f.engine.s.native.id,id);assert.notEqual(second.p.observationPeriodId,period);
 const record=await f.store.records.find(item=>item.visitId==='visit-2');assert.equal(record.visitRelation.type,'pause-continuation');
 assert.deepEqual(f.calls,['nativeStart','nativePause','nativeResume']);
});

test('a worker restart writes a recovered closure with unknown end time and no invented final state',async()=>{
 const f=await fixture();await f.sessions.start();await f.open();const nextEngine=new Engine(f.adapter,f.store);await nextEngine.init();const next=new Sessions(nextEngine,f.adapter,f.store);await next.init();
 assert.equal(nextEngine.s.native.status,'PAUSED');assert.equal(nextEngine.s.native.interruptions,1);const record=f.store.records.find(item=>item.visitId==='visit-1');
 assert.equal(record.recoveredClosure.finalStateInvented,false);assert.equal(record.endTimeStatus,'unknown');assert.equal(record.endedAt,null);
 const data=await next.dataset();assert.ok(data.events.some(event=>event.type==='native-recovered-closure'));assert.equal(data.session.observationPeriods[0].endTimeStatus,'unknown');
});

test('progressive chunks remain exportable after an interruption',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open();await f.saveGeometry(info,'capture-a',['left']);
 const nextEngine=new Engine(f.adapter,f.store);await nextEngine.init();const next=new Sessions(nextEngine,f.adapter,f.store);await next.init();const data=await next.dataset();
 assert.equal(data.records.length,1);assert.deepEqual(data.cloudIds.sort(),['capture-a','capture-a:left:0']);assert.ok(await f.store.getCloud('capture-a:left:0'));
});

test('partial rails and missing LiDAR retain exact exclusion reasons',async()=>{
 const f=await fixture();await f.sessions.start();const first=await f.open();await closeVisit(f,first,first.state,101);const partial=f.initial(101);
 partial.rails.right=null;partial.status='partial';partial.partialReasons=['rail-right-not-observed'];const n=f.engine.s.native,p=n.observationPeriods.at(-1);
 await f.sessions.receive('visit-started',{sessionId:n.id,observationPeriodId:p.observationPeriodId,visitId:'visit-2',identity:partial.identity,initialObserved:partial});
 await f.sessions.receive('capture-failed',{sessionId:n.id,observationPeriodId:p.observationPeriodId,visitId:'visit-2',identity:partial.identity,reason:'no-loaded-point-buffer'});
 const info={n,p,state:partial,visitId:'visit-2'};await closeVisit(f,info,partial,null,'finished');const record=(await f.sessions.end()).records.find(item=>item.visitId==='visit-2');
 assert.equal(record.status,'partial');assert.ok(record.partialReasons.includes('rail-right-not-observed'));assert.ok(record.partialReasons.includes('lidar-missing'));
 assert.equal(record.observedLabelCandidate,'PASS_NO_DECISION');assert.ok(record.geometryEligibility.left.reasons.includes('qualified-stored-snapshot-missing'));
});
test('a stable stored rail snapshot remains comparable when the final capture report arrives after VALIDATE and reports interruption',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open(),data=f.geometry(info.state,'late-report',['left'],info.visitId);
 await f.sessions.receive('capture-checkpoint',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
  visitId:info.visitId,identity:info.state.identity,chunk:data.chunks[0]});
 await intent(f,info,'VALIDATE');await closeVisit(f,info);
 data.cloud.status='partial-interrupted';data.cloud.termination={code:'RAIL_STATE_CHANGED',reason:'other-rail-moved'};
 data.cloud.railObservations.left.geometryInputStatus='unavailable-or-insufficient';data.cloud.railObservations.left.coverage.status='insufficient';
 await f.sessions.receive('capture-ready',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,visitId:info.visitId,
  identity:info.state.identity,cloud:data.cloud});
 const result=(await f.sessions.end()).records[0];assert.equal(result.geometryEligibility.left.status,'comparable-candidate');
 assert.equal(result.geometryEligibility.left.snapshotId,data.chunks[0].chunkId);
 assert.equal(result.railSnapshots.left[0].captureStatusAtQualification,'reading');assert.equal(result.railSnapshots.left[0].receiptEventSeq>0,true);
 assert.equal(result.geometryObservations.left[0].geometryInputStatus,'unavailable-or-insufficient');assert.equal(result.usableForTraining,false);
});
test('the acquisition interval, not late checkpoint storage or the final report sequence, determines pre-intent geometry',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open(),data=f.geometry(info.state,'delayed-checkpoint',['left'],info.visitId);
 let release;const blocked=new Promise(resolve=>release=resolve),put=f.store.putCloud.bind(f.store);
 f.store.putCloud=async(...args)=>{await blocked;return put(...args);};
 const checkpoint=f.sessions.receive('capture-checkpoint',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
  visitId:info.visitId,identity:info.state.identity,chunk:data.chunks[0]});
 await new Promise(resolve=>setTimeout(resolve,10));const intentAt=new Date().toISOString();
 const decision=f.sessions.receive('operator-event',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
  visitId:info.visitId,identity:info.state.identity,stateObservedBeforeInput:info.state,
  event:{type:'keydown',intent:'VALIDATE',observedAt:intentAt}});
 await new Promise(resolve=>setTimeout(resolve,10));release();await Promise.all([checkpoint,decision]);await closeVisit(f,info);
 const result=(await f.sessions.end()).records[0];assert.ok(result.railSnapshots.left[0].storedAt>intentAt);
 assert.ok(result.railSnapshots.left[0].acquiredThroughAt<=intentAt);
 assert.equal(result.geometryEligibility.left.status,'comparable-candidate');
});
test('a cached human state observed after the keypress is retained but explicitly excluded',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open();await f.saveGeometry(info,'timing',['left']);
 const future=K.clone(info.state);future.capturedAt=new Date(Date.now()+1000).toISOString();await intent(f,info,'VALIDATE',future);await closeVisit(f,info);
 const result=(await f.sessions.end()).records[0];assert.equal(result.humanFinalReference.status,'candidate-timing-uncertain');
 assert.ok(result.partialReasons.includes('cached-state-observed-after-operator-input'));
 assert.ok(result.geometryEligibility.left.reasons.includes('human-final-reference-not-freshly-observed'));
 assert.equal(result.usableForOfflineEvaluationByRail.left,false);
});
test('a checkpoint with clipping or source proof absent cannot be promoted by a later clean capture report',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open(),data=f.geometry(info.state,'unverified',['left'],info.visitId);
 data.chunks[0].qualification.clipStatus='unverified';data.chunks[0].qualification.sourceStatus='unverified';
 await f.sessions.receive('capture-checkpoint',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
  visitId:info.visitId,identity:info.state.identity,chunk:data.chunks[0]});
 await f.sessions.receive('capture-ready',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
  visitId:info.visitId,identity:info.state.identity,cloud:data.cloud});
 await intent(f,info,'VALIDATE');await closeVisit(f,info);const result=(await f.sessions.end()).records[0];
 assert.equal(result.geometryEligibility.left.status,'excluded');assert.ok(result.geometryEligibility.left.reasons.includes('clipping-not-verified'));
 assert.ok(result.geometryEligibility.left.reasons.includes('source-stability-not-demonstrated'));
});
test('a contradictory final frame revokes a prior checkpoint with explicit evidence, without erasing its history',async()=>{
 const f=await fixture();await f.sessions.start();const info=await f.open(),data=f.geometry(info.state,'contradiction',['left'],info.visitId);
 await f.sessions.receive('capture-checkpoint',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
  visitId:info.visitId,identity:info.state.identity,chunk:data.chunks[0]});
 data.cloud.railObservations.left.rail.railLocalToSceneRelative[12]+=.005;
 await f.sessions.receive('capture-ready',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,
  visitId:info.visitId,identity:info.state.identity,cloud:data.cloud});
 await intent(f,info,'VALIDATE');await closeVisit(f,info);const result=(await f.sessions.end()).records[0];
 assert.equal(result.geometryEligibility.left.status,'excluded');
 assert.ok(result.geometryEligibility.left.reasons.includes('capture-report-contradicts-snapshot-frame'));
 assert.equal(result.railSnapshots.left[0].qualificationStatus,'qualified-candidate');assert.equal(result.railSnapshots.left[0].revocations.length,1);
});
