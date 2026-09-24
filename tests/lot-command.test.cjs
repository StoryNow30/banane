'use strict';
/* 4.7.10 — la décision sur le lot COMMANDE (D-041, D-042). `commandRails`
 * traduit une décision en rails pour `Engine.apply()` : premier passage =
 * proposition du moteur ; reprise ou choix = positions de la décision, relues ;
 * retiré par la garde sans reprise = différé ; tout le reste = moteur. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),Shadow=require('../src/gcv1-shadow.js'),Gauge=require('../src/gauge.js'),{Engine}=require('../src/engine.js');
const {K}=require('./fixtures.cjs'),{build}=require('./helpers/navigateur.cjs');
const SIDES=['left','right'];
const {capture,decision}=build(L,Shadow);
const abstention=side=>({side,status:'unresolved',delta:null,confidence:0,reasons:['GCV1 ne publie pas de position exploitable.'],method:'gcv1-method',
  source:'geometry-candidate-v1-abstention',parameters:{contractId:'GEOMETRY_CANDIDATE_V1'},geometryEngine:'geometry-candidate-v1',gcv1:{motif:'ambiguity'}});
const candidate=side=>({...abstention(side),status:'candidate',delta:[0,.004,-.002],confidence:.8,reasons:[],source:'geometry-candidate-v1-astar'});
const both=f=>Object.fromEntries(SIDES.map(s=>[s,f(s)]));
const command=(d,runtimeRails=both(abstention),expectedPoses=K.expectedPoses)=>L.commandRails({decision:d,runtimeRails,before:capture.rails,expectedPoses});

test('choix : les décalages reproduisent les positions de la décision, écartement admissible, provenance consignée',()=>{
  assert.equal(decision.stage,'choice',decision.reason);
  const runtimeRails=both(abstention),frozen=JSON.stringify(runtimeRails),out=command(decision,runtimeRails);
  assert.equal(out.action,'lot');assert.equal(out.reason,'choice');
  const expected=K.expectedPoses({rails:capture.rails},out.rails);
  for(const s of SIDES){
    assert.ok(K.C.distance(expected[s].positionSceneRelative,decision.positions[s])<1e-9,s+' : position commandée = position décidée');
    assert.equal(out.rails[s].status,'candidate');assert.equal(out.rails[s].source,'lot-decision-choice');
    assert.equal(out.rails[s].geometryEngine,'geometry-candidate-v1');assert.equal(out.rails[s].method,'gcv1-method');
    assert.deepEqual(out.rails[s].lotDecision.anchorsUsed,[104,103]);
  }
  assert.ok(Gauge.admissible(Gauge.classifyMm(out.gaugeMm)),'écartement '+out.gaugeMm+' mm dans le contrat');
  assert.equal(JSON.stringify(runtimeRails),frozen,'la proposition du moteur n’est pas modifiée');
});

test('reprise depuis la voie : même traduction, source « window »',()=>{
  const out=command({...decision,stage:'window',chosen:undefined,fromPredictionMm:4.2});
  assert.equal(out.action,'lot');
  for(const s of SIDES){assert.equal(out.rails[s].source,'lot-decision-window');assert.equal(out.rails[s].lotDecision.fromPredictionMm,4.2);}
});

test('premier passage, différé sans garde, décision absente ou en erreur : proposition du moteur inchangée',()=>{
  const runtimeRails=both(candidate);
  for(const d of [{stage:'first-pass',guardMm:3.1,positions:decision.positions,anchor:true},{stage:'deferred',reason:'no-anchor'},
    {stage:'error',reason:'x'},{stage:'no-capture'},null]){
    const out=command(d,runtimeRails);
    assert.equal(out.action,'engine',JSON.stringify(d));assert.equal(out.rails,runtimeRails);
  }
});

test('retiré par la garde sans reprise : deux abstentions GCV1, et le moteur diffère le cut',()=>{
  const out=command({stage:'deferred',guardDeferred:true,guardMm:42.1,reason:'left:no-qualified-minimum-near-prediction',anchorsUsed:[104,103]},both(candidate));
  assert.equal(out.action,'defer');
  for(const s of SIDES){const r=out.rails[s];
    assert.equal(r.status,'unresolved');assert.equal(r.delta,null);assert.equal(r.source,'geometry-candidate-v1-abstention');
    assert.equal(r.lotDecision.reason,'guard');assert.equal(r.lotDecision.guardMm,42.1);assert.match(r.reasons[0],/garde de continuité/);}
  /* Le moteur reconnaît un rail non résolu GCV1 : chemin « différer », jamais une application. */
  const identity=K.completeIdentity({pageId:'p',part:23,cut:105,frameId:'f'});
  const self={unresolvedPolicy:Engine.prototype.unresolvedPolicy,
    s:{proposal:{identity,rails:out.rails,geometrySelection:{selectedEngine:'geometry-candidate-v1',fallback:false}},before:{identity},lidarId:'capture'}};
  const eligibility=Engine.prototype.deferEligibility.call(self,identity,{scope:{unresolvedPolicy:'defer',geometryEngine:'geometry-candidate-v1'}});
  assert.equal(eligibility.eligible,true,eligibility.reason);assert.deepEqual(eligibility.unresolvedRails,SIDES);
});

test('relecture : repère différent ou écartement hors contrat → proposition du moteur, jamais la décision',()=>{
  const shifted=(before,rails)=>{const out=K.expectedPoses(before,rails);out.right.positionSceneRelative=out.right.positionSceneRelative.map(v=>v+.001);return out;};
  assert.deepEqual([command(decision,both(abstention),shifted).action,command(decision,both(abstention),shifted).reason],['engine','position-mismatch']);
  const [a,b]=SIDES.map(s=>decision.positions[s]),u=b.map((v,i)=>v-a[i]),n=Math.hypot(...u);
  const wide={...decision,positions:{left:a,right:b.map((v,i)=>v+u[i]/n*.08)}},out=command(wide);
  assert.equal(out.action,'engine');assert.equal(out.reason,'gauge-HIGH_INVALID');
  assert.equal(command(decision,both(abstention),null).reason,'positions-missing');
});

test('mémoire des appuis : un cut analysé deux fois ne compte que pour un appui, la plus récente fait foi',()=>{
  const entry=(cut,x,frameId='f')=>({identity:{part:23,cut,frameId},positions:{left:[x,0,0],right:[x,1.435,0]}});
  const anchors=[];L.rememberAnchor(anchors,entry(103,1));L.rememberAnchor(anchors,entry(104,2));L.rememberAnchor(anchors,entry(104,3));
  assert.deepEqual(anchors.map(a=>[a.identity.cut,a.positions.left[0]]),[[103,1],[104,3]]);
  L.rememberAnchor(anchors,entry(104,4,'autre-repère'));assert.equal(anchors.length,3,'autre repère : autre voie');
  for(let c=0;c<5;c++)L.rememberAnchor(anchors,entry(200+c,0),4);assert.equal(anchors.length,4);
  assert.deepEqual(L.neighbours({part:23,cut:105,frameId:'f'},[entry(104,2),entry(104,3)].reduce((m,e)=>L.rememberAnchor(m,e),[]),L.DEFAULTS).length,1);
});
