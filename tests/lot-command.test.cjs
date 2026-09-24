'use strict';
/* 4.7.10 — la décision sur le lot COMMANDE (D-041, D-042). `commandRails`
 * traduit une décision en rails pour `Engine.apply()` : premier passage =
 * proposition du moteur ; reprise ou choix = positions de la décision, relues ;
 * retiré par la garde sans reprise = différé ; tout le reste = moteur. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),Shadow=require('../src/gcv1-shadow.js'),Gauge=require('../src/gauge.js'),{Engine}=require('../src/engine.js');
const {K}=require('./fixtures.cjs'),{build,withCameras}=require('./helpers/navigateur.cjs');
const SIDES=['left','right'];
const {capture,decision}=build(L,Shadow);
const abstention=side=>({side,status:'unresolved',delta:null,confidence:0,reasons:['GCV1 ne publie pas de position exploitable.'],method:'gcv1-method',
  source:'geometry-candidate-v1-abstention',parameters:{contractId:'GEOMETRY_CANDIDATE_V1'},geometryEngine:'geometry-candidate-v1',gcv1:{motif:'ambiguity'}});
const candidate=side=>({...abstention(side),status:'candidate',delta:[0,.004,-.002],confidence:.8,reasons:[],source:'geometry-candidate-v1-astar'});
const both=f=>Object.fromEntries(SIDES.map(s=>[s,f(s)]));
const cameras=L.viewCameras(withCameras(capture));
const command=(d,runtimeRails=both(abstention),expectedPoses=K.expectedPoses,cams=cameras)=>L.commandRails({decision:d,runtimeRails,before:capture.rails,expectedPoses,cameras:cams});

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

/* KI-051 — lot 4.7.10, partie 33, cut 8089 : cible à 21 cm de la pose ESV, hors
 * de la vue de ±20 cm ; l'adaptateur refusait le clic et le lot s'arrêtait. */
test('vue d\'ESV : une cible hors de la vue du rail n\'est pas commandée ; caméra inconnue non plus',()=>{
  const narrow=L.viewCameras(withCameras(capture,.01));   // vue de ±1 cm : la cible du rail gauche est à 12 mm
  const out=command(decision,both(abstention),K.expectedPoses,narrow);
  assert.equal(out.action,'engine');assert.match(out.reason,/^hors-vue-(left|right)$/);assert.ok(Math.abs(out.ndc[0])>L.VIEW_MARGIN||Math.abs(out.ndc[1])>L.VIEW_MARGIN);
  assert.equal(command(decision,both(abstention),K.expectedPoses,null).reason,'vue-inconnue-left');
  assert.equal(command(decision,both(abstention),K.expectedPoses,{left:cameras.left,right:null}).reason,'vue-inconnue-right');
});
test('caméra de chaque rail : celle où il projette au centre, quel que soit l\'ordre des vues',()=>{
  const cap=withCameras(capture),swapped={...cap,viewCaptures:cap.viewCaptures.slice().reverse()};
  for(const c of [cap,swapped]){const cams=L.viewCameras(c);
    for(const s of SIDES)assert.ok(Math.hypot(...L.inView(cams[s],capture.rails[s].positionSceneRelative).ndc.slice(0,2))<1e-9);}
  assert.deepEqual(L.viewCameras({rails:capture.rails}),{left:null,right:null});
  const lone=L.viewCameras({...cap,viewCaptures:[cap.viewCaptures[0]]});assert.equal(lone.right,null,'aucune vue centrée sur le rail droit');
});

/* 4.7.12 — garde de paire (chantier 2, D-044) : un rail repêché par S1 et un
 * calage de convention hors domaine sur l'un des deux rails → premier passage
 * différé, jamais appui, et le Pilote diffère le cut. */
test('garde de paire : S1 et calage hors domaine différent le premier passage ; l\'un sans l\'autre, non',()=>{
  const science=(s1Side,oodSide)=>({summary:{pairGaugeRejected:false},rails:Object.fromEntries(SIDES.map(s=>[s,{ok:true,
    next:{status:'candidate',delta:[0,.001,0],changed:s===s1Side},conventionCalibration:{applied:s!==oodSide,reason:s===oodSide?'shift-out-of-domain':null}}]))});
  const decide=(sc,options)=>L.decideCut({capture,science:sc,anchors:[],Shadow,options});
  for(const [s1,ood] of [['left','right'],['right','right'],['left','left']]){const d=decide(science(s1,ood));
    assert.equal(d.stage,'deferred');assert.equal(d.reason,'pair-guard');assert.equal(d.anchor,false);assert.equal(d.positions,undefined);
    const out=command(d,both(candidate));assert.equal(out.action,'defer');assert.equal(out.reason,'pair-guard');
    for(const s of SIDES){assert.equal(out.rails[s].status,'unresolved');assert.equal(out.rails[s].source,'geometry-candidate-v1-abstention');}}
  for(const [s1,ood] of [[null,'left'],['left',null],[null,null]])assert.equal(decide(science(s1,ood)).stage,'first-pass',`S1 ${s1}, hors domaine ${ood}`);
  assert.equal(decide(science('left','right'),{pairGuard:false}).stage,'first-pass','coupure : options.pairGuard');
});

/* KI-053 (relecture 4.7.12, B1) : une paire retirée par la garde de continuité
 * n'est jamais rendue par un repli ; sans retrait, le repli reste le moteur. */
test('repli après retrait par la garde : toujours différé ; sans retrait : proposition du moteur',()=>{
  const retire={...decision,stage:'window',guardDeferred:true,guardMm:156.2};
  const shifted=(before,rails)=>{const out=K.expectedPoses(before,rails);out.right.positionSceneRelative=out.right.positionSceneRelative.map(v=>v+.001);return out;};
  const [a,b]=SIDES.map(s=>decision.positions[s]),u=b.map((v,i)=>v-a[i]),n=Math.hypot(...u);
  const large={left:a,right:b.map((v,i)=>v+u[i]/n*.08)};
  for(const [d,exp,cams,motif] of [[retire,K.expectedPoses,cameras,null],[retire,shifted,cameras,'guard-position-mismatch'],[{...retire,positions:large},K.expectedPoses,cameras,'guard-gauge-HIGH_INVALID'],
    [retire,K.expectedPoses,null,'guard-vue-inconnue-left'],[retire,null,cameras,'guard-positions-missing']]){
    const out=command(d,both(candidate),exp,cams);
    if(motif===null){assert.equal(out.action,'lot');continue;}
    assert.equal(out.action,'defer',motif);assert.equal(out.reason,motif);
    for(const s of SIDES){assert.equal(out.rails[s].status,'unresolved');assert.equal(out.rails[s].delta,null);}}
  const out=command({...decision,stage:'window'},both(candidate),K.expectedPoses,null);
  assert.deepEqual([out.action,out.reason],['engine','vue-inconnue-left'],'sans retrait par la garde, le repli reste la proposition du moteur');
});
