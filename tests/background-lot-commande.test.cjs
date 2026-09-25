/* Décision sur le lot dans le Pilote (4.7.8 à 4.7.12), au niveau du service
 * worker : commande dans un lot « appliquer », rien en « observer ». Séparé de
 * `background.test.cjs` pour tenir sous 10 s par fichier. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('./fixtures.cjs');
const {background,shadowHarness}=require('./helpers/background-harness.cjs');

/* 4.7.10 — la décision sur le lot COMMANDE dans un lot créé avec « appliquer »
 * (D-041, D-042) : les rails remis à `Engine.apply()` sont ceux de la décision,
 * la proposition du moteur reste dans l'événement « proposed ». « Observer
 * seulement », ou un lot sans ce champ : exactement la 4.7.9. */
test('a GCV1 pilot batch created with lotDecision apply commands the lot decision; observe changes nothing',async()=>{
 const Shadow=require('../src/gcv1-shadow.js'),L=require('../src/lot-decision.js'),K=require('../src/core.js'),{base}=require('./fixtures.cjs'),{withCameras}=require('./helpers/navigateur.cjs');
 const science=Shadow.scientificProposeBoth(base),SIDES=['left','right'];
 /* Décision factice : reprise depuis la voie, à 6 mm de la proposition V4.6 du
  * banc (42 mm vers l'intérieur par rail sur la fixture, écartée à 1 500 mm) ;
  * paire à 1 428 mm. */
 const moved=rails=>Object.fromEntries(SIDES.map(s=>{const P=rails[s].profileLocalToSceneRelative,w=K.C.point(P,[0,s==='left'?-.036:.036,.001]),o=K.C.point(P,[0,0,0]);
   return [s,rails[s].positionSceneRelative.map((v,i)=>v+w[i]-o[i])];}));
 const fake={...L,decideCut:({capture})=>({version:'lot-decision-v1',stage:'window',fromPredictionMm:6,anchorsUsed:[99],positions:moved(capture.rails),anchor:true})};
 async function run(lotDecision){
  /* Chaque armement publie la sélection GCV1 du harnais avec la science de la fixture. */
  const shadow=shadowHarness(),arm=shadow.armOnce.bind(shadow),consume=shadow.consumeLast.bind(shadow);
  shadow.armOnce=selector=>{arm(selector);shadow.pending={...consume(),rails:science.rails,summary:science.summary};};
  shadow.consumeLast=()=>{shadow.calls.consume++;const o=shadow.pending;shadow.pending=null;return o;};
  shadow.scientificProposeBoth=Shadow.scientificProposeBoth;
  const b=background({shadow,globals:{BananeLotDecision:fake,BananeSettings:require('../src/settings.js'),BananeCore3:K}});
  /* Caméras de capture comme celles du Pilote : une vue par rail, ±0,2 (KI-051). */
  const capture=b.adapter.capture.bind(b.adapter);
  b.adapter.capture=async(...a)=>withCameras(await capture(...a));
  const applied=[],apply=b.adapter.apply.bind(b.adapter);
  b.adapter.apply=async(before,proposals)=>{applied.push({before:K.clone(before),proposals:K.clone(proposals)});return apply(before,proposals);};
  await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
  await b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',
   ...(lotDecision?{lotDecision}:{})});
  // 4.7.19 : le lot s'arrête au dernier cut (STOPPED), paire posée sans validation.
  while(!['COMPLETED','FINISHED_WITH_UNCONFIRMED_ACTIONS','ERROR','PAUSED','STOPPED'].includes((await b.api('view')).batch?.state))await new Promise(r=>setImmediate(r));
  return {b,view:await b.api('view'),applied,observed:b.store.events.filter(e=>e.type==='gcv1-shadow-observed'),
   proposed:b.store.events.filter(e=>e.type==='proposed')};
 }
 const lot=await run('apply');
 assert.equal(lot.view.batch.scope.lotDecision,'apply');
 assert.ok(lot.applied.length>=1&&lot.view.batch.error==null,JSON.stringify(lot.view.batch.error));
 for(const a of lot.applied){const expected=K.expectedPoses(a.before,a.proposals),want=moved(a.before.rails);
  for(const s of SIDES){assert.ok(K.C.distance(expected[s].positionSceneRelative,want[s])<1e-9,'position commandée = position de la décision ('+s+')');
   assert.equal(a.proposals[s].source,'lot-decision-window');}}
 for(const e of lot.observed){assert.deepEqual(e.lotObservation.command,{action:'lot',reason:'window',gaugeMm:e.lotObservation.command.gaugeMm});
  assert.equal(e.lotObservation.applied,true);}
 for(const e of lot.proposed)for(const s of SIDES)assert.notEqual(e.proposal.rails[s].source,'lot-decision-window','« proposed » garde la proposition du moteur');
 for(const mode of ['observe',undefined]){const control=await run(mode);
  assert.equal(control.view.batch.scope.lotDecision,'observe');
  assert.equal(control.applied.length,lot.applied.length);
  for(const a of control.applied)for(const s of SIDES)assert.notEqual(a.proposals[s].source,'lot-decision-window');
  for(const e of control.observed){assert.equal(e.lotObservation.command,undefined);assert.equal(e.lotObservation.applied,false);}}
 const b=background({shadow:shadowHarness()});await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 await assert.rejects(b.api('start',{part:23,start:100,end:101,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
  geometryEngine:'geometry-candidate-v1',lotDecision:'toujours'}),/Décision sur le lot inconnue/);
});
