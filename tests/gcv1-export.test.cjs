const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Export=require('../src/gcv1-export.js');

const identity=cut=>({pageId:'page-test',part:9,cut,shape:'U50',frameId:'frame-test'});
const event=(type,detail={})=>({eventId:`event-${type}-${detail.proposalId||detail.proposal?.id||detail.identity?.cut||'x'}`,
 timestamp:'2026-09-20T10:00:00.000Z',type,identity:detail.identity||identity(497),...detail});
const science=(next,extra={})=>({ok:true,side:extra.side||'left',frame:{pointsLocal:42},astar:{confidence:73},
 next,poolMeta:{nCoarse:12,nLocalMin:2,nKept:4},competitive:{nClusters:2,nCompetitive:3},...extra});

function sourceEvents(){
 const s1={status:'candidate',delta:[0.01,0.02,0],changed:true,activated:true,motif:'s1',topRows:18,nClusters:2};
 const candidate={status:'candidate',delta:[0.02,0.01,0],changed:false,activated:false,motif:'candidate',topRows:20};
 const unresolved={status:'unresolved',delta:null,changed:false,activated:false,motif:'flank',reason:'Flanc interne insuffisant.'};
 const proposal={id:'proposal-497',identity:identity(497),rails:{
  left:{status:'candidate',source:'geometry-candidate-v1-s1',delta:s1.delta,confidence:0,gcv1:{confidenceStatus:'non-calibrated-s1-selection'}},
  right:{status:'candidate',source:'geometry-candidate-v1-astar',delta:candidate.delta,confidence:73,gcv1:{confidenceStatus:'candidate-v1'}},
 }};
 return [
  event('before-captured',{identity:identity(497),lidarId:'lidar-497'}),
  event('proposed',{identity:identity(497),proposal}),
  event('gcv1-shadow-observed',{identity:identity(497),sessionId:'session-test',proposalId:'proposal-497',shadow:{format:'banane-gcv1-shadow-v1',
   observedAt:'2026-09-20T10:00:01.000Z',contract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:'candidate-hash'},
   runtimeDecisionUntouched:false,commandsByShadow:0,rails:{left:science(s1),right:science(candidate,{side:'right'})},
   summary:{nextCandidates:2,nextUnresolved:0,s1Changed:1},selection:{selector:'active-pilot-test',requestedEngine:'geometry-candidate-v1',selectedEngine:'geometry-candidate-v1',fallback:false,fallbackReason:null},
   comparison:{v46:{},gcv1:{},selectedEngine:'geometry-candidate-v1',fallback:false}}}),
  event('applied-verified',{identity:identity(497),proposalId:'proposal-497',commandSent:true,afterObserved:true}),
  event('validation-intent',{identity:identity(497),proposalId:'proposal-497',batchId:'batch-9',validationAttemptId:'attempt-497',commandSent:false}),
  event('validation-observation',{identity:identity(497),proposalId:'proposal-497',batchId:'batch-9',validationAttemptId:'attempt-497',
   commandSent:true,afterObserved:false,serverConfirmed:false,navigationObserved:true,
   expectedTransition:'NEXT_NON_VALIDATED_CUT_SAME_PAGE_AND_PART',evidence:{afterObserved:false,serverConfirmed:false,navigationObserved:true,nextIdentity:identity(499)}}),
  event('validation-accepted',{identity:identity(497),proposalId:'proposal-497',batchId:'batch-9',validationAttemptId:'attempt-497',
   transition:'NEXT_NON_VALIDATED_CUT_SAME_PAGE_AND_PART',nextIdentity:identity(499),validationProof:'navigation-only'}),
  event('before-captured',{identity:identity(499),lidarId:'lidar-499'}),
  event('proposed',{identity:identity(499),proposal:{id:'proposal-499',identity:identity(499),rails:{
   left:{status:'candidate',source:'geometry-candidate-v1-astar',delta:[0,0,0],confidence:60,gcv1:{confidenceStatus:'candidate-v1'}},
   right:{status:'unresolved',source:'geometry-candidate-v1-abstention',delta:null,confidence:0,gcv1:{confidenceStatus:'not-applicable'}},
  }}}),
  event('gcv1-shadow-observed',{identity:identity(499),sessionId:'session-test',proposalId:'proposal-499',shadow:{format:'banane-gcv1-shadow-v1',
   contract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:'candidate-hash'},runtimeDecisionUntouched:false,commandsByShadow:0,
   rails:{left:science(candidate),right:science(unresolved,{side:'right'})},summary:{nextCandidates:1,nextUnresolved:1},
   selection:{selector:'active-pilot-test',requestedEngine:'geometry-candidate-v1',selectedEngine:'geometry-candidate-v1',fallback:false,fallbackReason:null},comparison:{fallback:false}}}),
  event('batch-paused-unresolved-rail',{identity:identity(499),batchId:'batch-9',paused:{status:'PAUSED_UNRESOLVED_RAIL',lidarCaptureId:'lidar-499',proposal:{id:'proposal-499'}}}),
 ];
}

test('diagnostic is a lossless observational view and never mutates persisted events',()=>{
 const events=sourceEvents(),before=JSON.stringify(events);
 const diagnostic=Export.buildDiagnostic({version:'4.6.0',sessionId:'session-test',events,exportedAt:'2026-09-20T11:00:00.000Z'});
 assert.equal(JSON.stringify(events),before);
 assert.equal(diagnostic.format,'banane-gcv1-diagnostic-v1');
 assert.equal(diagnostic.observationCount,2);
 const first=diagnostic.observations[0];
 assert.equal(first.sessionId,'session-test');assert.equal(first.batchId,'batch-9');assert.equal(first.lidar.captureId,'lidar-497');
 assert.equal(first.selection.fallback,false);assert.equal(first.contract.geometrySha256,'candidate-hash');
 assert.equal(first.rails.left.status,'candidate');assert.equal(first.rails.left.confidence,0);
 assert.equal(first.rails.left.confidenceStatus,'non-calibrated-s1-selection');assert.equal(first.rails.left.branch,'S1');
 assert.equal(first.rails.left.scientificRail.poolMeta.nCoarse,12);
 assert.equal(first.runtime.transition,'NEXT_NON_VALIDATED_CUT_SAME_PAGE_AND_PART');
 assert.equal(first.runtime.nextIdentity.cut,499);assert.equal(first.runtime.validationAccepted.validationProof,'navigation-only');
 assert.equal(JSON.stringify(first.runtime).includes('498'),false,'no intermediate cut is invented');
 const second=diagnostic.observations[1];
 assert.equal(second.rails.right.status,'unresolved');assert.equal(second.rails.right.delta,null);
 assert.equal(second.rails.right.branch,'ABSTENTION');assert.equal(second.runtime.abstention.status,'PAUSED_UNRESOLVED_RAIL');
});

test('same-cut events never cross proposal boundaries and ambiguous legacy fallback stays empty',()=>{
 const id=identity(497),shadow={selection:{fallback:false},rails:{},summary:{}};
 const events=[
  event('gcv1-shadow-observed',{identity:id,batchId:'batch-retry',proposalId:'proposal-A',sessionId:'session-test',shadow}),
  event('gcv1-shadow-observed',{identity:id,batchId:'batch-retry',proposalId:'proposal-B',sessionId:'session-test',shadow}),
  event('validation-accepted',{identity:id,batchId:'batch-retry',proposalId:'proposal-B',nextIdentity:identity(499),transition:'B_ONLY'}),
  event('batch-after-state-missing',{identity:id,batchId:'batch-retry',message:'legacy event without proposal id'}),
 ];
 const diagnostic=Export.buildDiagnostic({sessionId:'session-test',events});
 const a=diagnostic.observations.find(o=>o.proposalId==='proposal-A');
 const b=diagnostic.observations.find(o=>o.proposalId==='proposal-B');
 assert.equal(a.runtime.validationAccepted,null,'proposal B must not contaminate proposal A');
 assert.equal(a.runtime.interruption,null,'ambiguous event without proposalId must not be guessed');
 assert.equal(b.runtime.validationAccepted.proposalId,'proposal-B');
 assert.equal(b.runtime.interruption,null,'ambiguous fallback is absent for every competing proposal');
});

test('a legacy observation is not assigned to the current export session',()=>{
 const legacy=event('gcv1-shadow-observed',{proposalId:'legacy-proposal',shadow:{selection:{fallback:false},rails:{},summary:{}}});
 const diagnostic=Export.buildDiagnostic({sessionId:'current-session',events:[legacy]});
 assert.equal(diagnostic.sessionId,'current-session','root session remains export context');
 assert.equal(diagnostic.observations[0].sessionId,null);
 assert.equal(diagnostic.observations[0].sessionScope,'legacy-unscoped');
});

test('complete corpus links available LiDAR and reports a missing capture without mutation',async()=>{
 const diagnostic=Export.buildDiagnostic({version:'4.6.0',sessionId:'session-test',events:sourceEvents()});
 const before=JSON.stringify(diagnostic),cloud={captureId:'lidar-497',pointsSceneRelative:[[1,2,3]]};
 const plan=await Export.buildCorpusPlan({diagnostic,getCloud:async id=>id==='lidar-497'?cloud:undefined,
  exportedAt:'2026-09-20T11:00:00.000Z'});
 assert.equal(JSON.stringify(diagnostic),before);
 assert.deepEqual(plan.cloudIds,['lidar-497']);assert.deepEqual(plan.missingCaptureIds,['lidar-499']);
 assert.deepEqual(plan.captureReferences,[{captureId:'lidar-497',status:'available'},{captureId:'lidar-499',status:'missing'}]);
 assert.equal(plan.diagnostic.observations[0].lidar.captureId,'lidar-497');
});

test('GCV1 exports are exposed only by explicit panel controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
 const panel=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
 const background=fs.readFileSync(path.join(__dirname,'../background.js'),'utf8');
 assert.match(html,/>Export diagnostic GCV1</);assert.match(html,/>Export corpus GCV1 \+ LiDAR</);
 assert.match(panel,/on\('gcv1-diagnostic-export'/);assert.match(panel,/on\('gcv1-corpus-export'/);
 assert.doesNotMatch(background,/saveBlob|createObjectURL|downloads\.download/);
 assert.doesNotMatch(panel,/setInterval\([^)]*gcv1-(?:diagnostic|corpus)-export/);
});
