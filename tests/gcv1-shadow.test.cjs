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
/* Le double de capture-core doit désormais savoir mesurer une distance : la
 * composition GCV1 y lit l'écartement de la paire publiée. */
const C={point:(_m,p)=>p.slice(),
 distance:(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))};

function fixture(){
 const contour=[];
 for(let u=.012;u<=.072+1e-12;u+=.006)contour.push([0,u,0]);
 for(let z=-.014;z>=-.034-1e-12;z-=.004)contour.push([0,.012,z]);
 /* Les deux rails portent une origine distincte : l'écartement de la paire est
  * de 1450 mm, et les deux propositions du double se déplacent du même vecteur,
  * donc l'écartement prévu reste 1450 mm — nominal, admissible. */
 const railAt=x=>({positionSceneRelative:[x,0,0],
   sceneRelativeToProfileLocal:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
   profileLocalToSceneRelative:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
   profileContours:[{verticesSceneRelative:contour}]});
 const points=[];
 for(let i=0;i<24;i++)points.push([0,.03+(i%8)*.004,(i%3)*.002]);
 return {rails:{left:railAt(0),right:railAt(1.45)},pointsSceneRelative:points,visibleByClipBoxes:points.map(()=>true)};
}
function harness({candidateThrows=false,candidates={},runtimeThrows=false}={}){
 let runtimeCalls=0,candidateCalls=0;const order=[];
 const runtimeResult={
  left:{side:'left',status:'candidate',delta:[0,-.001,.001],confidence:70,reasons:[],method:DEFAULTS.method,source:'v4.6'},
  right:{side:'right',status:'candidate',delta:[0,.001,.001],confidence:71,reasons:[],method:DEFAULTS.method,source:'v4.6'},
 };
 const baselineProposal={status:'unresolved',delta:null,reasons:['Plan de roulement non estimable.'],metrics:{}};
 const Runtime={
   DEFAULTS,
   frozen:{DEFAULTS,propose:()=>baselineProposal},
   proposeBoth(){runtimeCalls++;order.push('runtime');if(runtimeThrows)throw Error('runtime-test-failure');return runtimeResult;},
 };
 const Candidate={
   DEFAULTS,median,
   robustLine(rows){return rows.length<3?null:{slope:0,rawSlope:0,slopeLimited:false,intercept:0,residual:0,count:rows.length};},
   propose(_capture,side){candidateCalls++;order.push('candidate-'+side);
     if(candidateThrows===true||candidateThrows===side)throw Error('candidate-test-failure-'+side);
     if(candidates[side]==='candidate')return {side,status:'candidate',delta:[0,.01,.002],confidence:88,reasons:[],
       method:DEFAULTS.method,source:'candidate-test',metrics:{templateLoss:1,seed:[.01,.002],lab:{uCenters:[0],coarseCount:0}},
       top:{count:20,slopeLimited:false},face:{count:8,slopeLimited:false}};
     return {status:'unresolved',delta:null,confidence:0,reasons:['Plan de roulement non estimable.'],
       metrics:{templateLoss:1,seed:[0,0],lab:{uCenters:[0],coarseCount:0}},top:null,face:null};},
 };
 const api=real._createForTest(Runtime,Candidate,C);
 return {api,runtimeResult,order,get runtimeCalls(){return runtimeCalls;},get candidateCalls(){return candidateCalls;}};
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
 assert.equal(j.selection.selector,'shadow');assert.equal(j.selection.selectedEngine,'v4.6');assert.equal(j.selection.fallback,false);
});

test('GCV1 shadow gate accepts only an explicit boolean and disabling clears pending telemetry',()=>{
 const h=harness({candidateThrows:true});
 assert.throws(()=>h.api.configure({enabled:1}),/booléen/);
 assert.throws(()=>h.api.configure({activeAssisted:1}),/booléen/);
 assert.throws(()=>h.api.armOnce('active-assisted'),/gate fermée/);
 h.api.configure({activeAssisted:true});assert.throws(()=>h.api.armOnce('active-pilot'),/inconnu/);
 h.api.configure({enabled:true});
 h.api.geometry.proposeBoth(fixture(),{});
 assert.equal(h.api.state().hasPendingJournal,true);
 h.api.configure({enabled:false});
 assert.equal(h.api.state().enabled,false);
 assert.equal(h.api.state().hasPendingJournal,false);
 assert.equal(h.api.consumeLast(),null);
});

test('active assisted converts two GCV1 candidates after V4.6 and records provenance',()=>{
 const h=harness({candidates:{left:'candidate',right:'candidate'}});
 h.api.configure({activeAssisted:true});h.api.armOnce('active-assisted');
 const got=h.api.geometry.proposeBoth(fixture(),{}),j=h.api.journal();
 assert.notStrictEqual(got,h.runtimeResult);assert.deepEqual(h.order,['runtime','candidate-left','candidate-right']);
 for(const side of ['left','right']){
  assert.equal(got[side].status,'candidate');assert.deepEqual(got[side].delta,[0,.01,.002]);
  assert.equal(got[side].geometryEngine,'geometry-candidate-v1');assert.equal(got[side].method,DEFAULTS.method);
  assert.equal(got[side].parameters.geometrySha256,real.CONTRACT.geometrySha256);
 }
 assert.deepEqual(j.comparison.v46.left.delta,h.runtimeResult.left.delta);
 assert.equal(j.selection.selectedEngine,'geometry-candidate-v1');assert.equal(j.selection.fallback,false);
 assert.equal(j.runtimeDecisionUntouched,false);assert.equal(j.commandsByShadow,0);assert.equal(h.runtimeCalls,1);
 assert.equal(h.api.state().selector,'shadow');assert.equal(h.api.state().armedForNextCall,false);
 assert.strictEqual(h.api.geometry.proposeBoth(fixture(),{}),h.runtimeResult,'the next unarmed call must return V4.6');
 assert.equal(h.candidateCalls,2,'the one-shot selector must not leak into the next call');
});

test('active assisted preserves one candidate and one unresolved without a V4.6 rail mix',()=>{
 const h=harness({candidates:{left:'candidate'}});h.api.configure({activeAssisted:true});h.api.armOnce('active-assisted');
 const got=h.api.geometry.proposeBoth(fixture(),{});
 assert.equal(got.left.status,'candidate');assert.ok(got.left.delta);
 assert.equal(got.right.status,'unresolved');assert.equal(got.right.delta,null);
 assert.equal(got.right.geometryEngine,'geometry-candidate-v1');assert.notDeepEqual(got.right,h.runtimeResult.right);
 assert.equal(h.api.journal().selection.fallback,false);
});

test('active assisted keeps two scientific unresolved results as abstentions',()=>{
 const h=harness();h.api.configure({activeAssisted:true});h.api.armOnce('active-assisted');
 const got=h.api.geometry.proposeBoth(fixture(),{});
 for(const side of ['left','right']){assert.equal(got[side].status,'unresolved');assert.equal(got[side].delta,null);}
 assert.equal(h.api.journal().selection.selectedEngine,'geometry-candidate-v1');
 assert.equal(h.api.journal().selection.fallback,false);
});

test('active assisted technical failure falls back atomically to the already computed V4.6 object',()=>{
 const h=harness({candidateThrows:'left',candidates:{right:'candidate'}});
 h.api.configure({activeAssisted:true});h.api.armOnce('active-assisted');
 const got=h.api.geometry.proposeBoth(fixture(),{}),j=h.api.journal();
 assert.strictEqual(got,h.runtimeResult);assert.equal(h.runtimeCalls,1);
 assert.equal(j.selection.selectedEngine,'v4.6');assert.equal(j.selection.fallback,true);
 assert.equal(j.runtimeDecisionUntouched,true);assert.equal(j.commandsByShadow,0);
 assert.match(j.selection.fallbackReason,/candidate-test-failure-left/);
 assert.equal(j.comparison.gcv1,null);assert.deepEqual(j.comparison.v46.left.delta,h.runtimeResult.left.delta);
});

test('active pilot TEST returns GCV1 candidates without using the assisted gate',()=>{
 const h=harness({candidates:{left:'candidate',right:'candidate'}});h.api.armOnce('active-pilot-test');
 const got=h.api.geometry.proposeBoth(fixture(),{}),j=h.api.journal();
 assert.deepEqual(h.order,['runtime','candidate-left','candidate-right']);
 assert.equal(got.left.geometryEngine,'geometry-candidate-v1');assert.equal(got.right.geometryEngine,'geometry-candidate-v1');
 assert.equal(j.selection.selector,'active-pilot-test');assert.equal(j.selection.selectedEngine,'geometry-candidate-v1');
 assert.equal(j.selection.fallback,false);assert.equal(j.commandsByShadow,0);
});

test('active pilot TEST contains no technical fallback to V4.6',()=>{
 const h=harness({candidateThrows:'left',candidates:{right:'candidate'}});h.api.armOnce('active-pilot-test');
 assert.throws(()=>h.api.geometry.proposeBoth(fixture(),{}),/GCV1 Pilote TEST.*candidate-test-failure-left/);
 const j=h.api.journal();assert.equal(j.selection.selector,'active-pilot-test');assert.equal(j.selection.selectedEngine,null);
 assert.equal(j.selection.fallback,false);assert.equal(j.selection.technicalError,true);
 assert.equal(j.runtimeDecisionUntouched,true);assert.equal(j.commandsByShadow,0);assert.equal(h.runtimeCalls,1);
});

test('selector is single-use, is cleared on runtime failure, and defaults inactive after restart',()=>{
 const failing=harness({runtimeThrows:true});failing.api.configure({activeAssisted:true});failing.api.armOnce('active-assisted');
 assert.throws(()=>failing.api.geometry.proposeBoth(fixture(),{}),/runtime-test-failure/);
 assert.equal(failing.api.state().selector,'shadow');assert.equal(failing.api.state().armedForNextCall,false);
 const restarted=harness();assert.equal(restarted.api.state().activeAssistedEnabled,false);
 assert.equal(restarted.api.state().selector,'shadow');
});

test('GCV1 facade exposes computation and selection only, never an ESV action surface',()=>{
 const h=harness();
 for(const action of ['apply','restore','next','validateAndNext','skipAndNext','navigate'])
  assert.equal(Object.hasOwn(h.api,action),false,action+' must not be exposed');
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
