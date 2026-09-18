const {test}=require('node:test');
const assert=require('node:assert/strict');
const real=require('../src/gcv1-shadow.js');

const DEFAULTS=Object.freeze({
 searchY:.08,searchZ:.04,grid:.003,minTop:15,minFace:6,
 maxResidual:.004,minConfidence:55,topBand:.012,faceBand:.01,
 alternativeSeparation:.02,minTemplateLossRatio:1.5,maxSingleRailLateral:.06,pairedSupportLateral:.04,
 method:'template-surfaces-v3',
});
const median=a=>{if(!a.length)return NaN;const b=a.slice().sort((x,y)=>x-y),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};
const C={point:(_m,p)=>p.slice()};

function fixture(){
 const contour=[];
 for(let i=0;i<8;i++)contour.push([0,.03+i*.005,0]);
 const rail={sceneRelativeToProfileLocal:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
   profileContours:[{verticesSceneRelative:contour}]};
 const points=[];
 for(let i=0;i<24;i++)points.push([0,.03+(i%8)*.004,(i%3)*.002]);
 return {rails:{left:rail,right:rail},pointsSceneRelative:points,visibleByClipBoxes:points.map(()=>true)};
}
function harness({candidateThrows=false}={}){
 let runtimeCalls=0,candidateCalls=0;
 const runtimeResult={left:{status:'candidate',delta:[0,0,0]},right:{status:'candidate',delta:[0,0,0]}};
 const baselineProposal={status:'unresolved',delta:null,reasons:['Plan de roulement non estimable.'],metrics:{}};
 const Runtime={
   DEFAULTS,
   frozen:{DEFAULTS,propose:()=>baselineProposal},
   proposeBoth(){runtimeCalls++;return runtimeResult;},
 };
 const Candidate={
   DEFAULTS,median,
   robustLine(rows){return rows.length<3?null:{slope:0,rawSlope:0,slopeLimited:false,intercept:0,residual:0,count:rows.length};},
   propose(){candidateCalls++;if(candidateThrows)throw Error('candidate-test-failure');
     return {status:'unresolved',delta:null,confidence:0,reasons:['Plan de roulement non estimable.'],
       metrics:{templateLoss:1,seed:[0,0],lab:{uCenters:[0],coarseCount:0}},top:null,face:null};},
 };
 const api=real._createForTest(Runtime,Candidate,C);
 return {api,runtimeResult,get runtimeCalls(){return runtimeCalls;},get candidateCalls(){return candidateCalls;}};
}

test('GCV1 shadow is disabled by default and returns the exact V4.6 runtime object',()=>{
 const h=harness();
 assert.equal(h.api.state().enabled,false);
 const got=h.api.geometry.proposeBoth(fixture(),{});
 assert.strictEqual(got,h.runtimeResult);
 assert.equal(h.runtimeCalls,1);
 assert.equal(h.candidateCalls,0);
 assert.equal(h.api.journal(),null);
});

test('GCV1 shadow contains candidate failures and never replaces the V4.6 runtime decision',()=>{
 const h=harness({candidateThrows:true});
 h.api.configure({enabled:true});
 const got=h.api.geometry.proposeBoth(fixture(),{});
 assert.strictEqual(got,h.runtimeResult);
 assert.equal(h.runtimeCalls,1);
 assert.equal(h.candidateCalls,2);
 const j=h.api.journal();
 assert.equal(j.runtimeDecisionUntouched,true);
 assert.equal(j.commandsByShadow,0);
 assert.match(j.rails.left.error,/candidate-test-failure/);
 assert.match(j.rails.right.error,/candidate-test-failure/);
});

test('GCV1 shadow gate accepts only an explicit boolean and disabling clears pending telemetry',()=>{
 const h=harness({candidateThrows:true});
 assert.throws(()=>h.api.configure({enabled:1}),/booléen/);
 h.api.configure({enabled:true});
 h.api.geometry.proposeBoth(fixture(),{});
 assert.equal(h.api.state().hasPendingJournal,true);
 h.api.configure({enabled:false});
 assert.equal(h.api.state().enabled,false);
 assert.equal(h.api.state().hasPendingJournal,false);
 assert.equal(h.api.consumeLast(),null);
});

test('S1 leaves an already STRONG A_STAR candidate untouched and inactive',()=>{
 const T=real._test;
 const astar={status:'candidate',motif:'candidate',reason:null,seed:[.01,.002],loss:1,topRows:15,faceCount:6,slopeLimited:false};
 const strong={u:.01,z:.002,loss:1,topRows:15,faceCount:6,slopeLimited:false,windowOk:true};
 const view={lmin:1,nStrongCompetitive:1,nClusters:1};
 const out=T.policyS1(astar,[strong],{sign:1},view);
 assert.equal(out.status,'candidate');
 assert.equal(out.activated,false);
 assert.equal(out.changed,false);
 assert.deepEqual(out.pick.u,.01);
});

test('S1 uses one STRONG competitive cluster but abstains when STRONG clusters are spatially distinct',()=>{
 const T=real._test;
 const astar={status:'unresolved',motif:'flank',reason:'Flanc interne insuffisamment observé.',seed:[0,0],loss:1,topRows:15,faceCount:2,slopeLimited:false};
 const a={u:0,z:0,loss:1,topRows:20,faceCount:7,slopeLimited:false,windowOk:true};
 const near={u:.019,z:0,loss:1.1,topRows:18,faceCount:8,slopeLimited:false,windowOk:true};
 const one=T.policyS1(astar,[a,near],{sign:1},{lmin:1,nStrongCompetitive:2,nClusters:1});
 assert.equal(one.status,'candidate');
 assert.equal(one.activated,true);
 assert.equal(one.changed,true);
 assert.strictEqual(one.pick,a);
 const far={...near,u:.02};
 const two=T.policyS1(astar,[a,far],{sign:1},{lmin:1,nStrongCompetitive:2,nClusters:2});
 assert.equal(two.status,'unresolved');
 assert.equal(two.motif,'ambiguity');
 assert.equal(two.activated,true);
 assert.equal(two.changed,false);
});
