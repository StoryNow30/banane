'use strict';
/* Observation « continuité » 4.7.7 (cahier 4.8, amendement n°7) : calcul
 * fantôme, jamais appliqué ni affiché. Les règles vérifiées ici sont celles que
 * la relecture indépendante du 23/09 a exigées : ancres fiables et antérieures,
 * même repère, points pris à la pose ESV avant le premier geste, visibilité
 * prouvée, pas de point compté deux fois. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const {K,base}=require('./fixtures.cjs');
const SIDES=['left','right'];
const T0=Date.parse('2026-09-24T08:00:00.000Z'),at=ms=>new Date(T0+ms).toISOString();

const identity=cut=>({pageId:'p',part:22,cut,shape:'U50',frameId:'f1',projectId:null});
/* Une visite validée, référence fraîche (état observé 200 ms avant l'intention). */
function validatedVisit(cut,visitIndex,rails,{freshnessMs=200,intents=1,status='candidate-observed',frameId='f1'}={}){
  const id={...identity(cut),frameId},stateAt=at(visitIndex*10000),intentAt=at(visitIndex*10000+freshnessMs);
  const state={identity:id,capturedAt:stateAt,rails:K.clone(rails)};
  const intent={intent:'VALIDATE',observedAt:intentAt,eventSeq:visitIndex*100,stateObservedBeforeInput:state};
  return {visitId:'v'+visitIndex,visitIndex,identity:id,operatorIntent:intents===1?'VALIDATE':'AMBIGUOUS_MULTIPLE',
    operatorIntents:Array.from({length:intents},()=>intent),multiIntent:intents>1,
    humanFinalReference:{status,state,observedAt:intentAt,eventSeq:visitIndex*100,association:{identityMatched:true,freshnessMs,source:'last-passively-observed-state-before-intent'}}};
}
/* La vraie position du fixture : ce que GCV1 publie depuis sa pose. */
const science=Shadow.scientificProposeBoth(base);
const truth=K.expectedPoses({rails:base.rails},{left:{delta:science.rails.left.next.delta},right:{delta:science.rails.right.next.delta}});
/* Pose ESV lointaine : les deux rails décalés de 150 mm dans leur plan de profil. */
function shifted(rails,mm){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
function observedVisit(cut,visitIndex,esv,{points=base.pointsSceneRelative,railChangeAt=null}={}){
  const before=Object.fromEntries(SIDES.map(side=>{const {profileContours,...rest}=K.clone(esv[side]);return [side,rest];}));
  const record={visitId:'v'+visitIndex,visitIndex,identity:identity(cut),beforeEstablished:{rails:before},visitRelation:{type:'first-observation'},
    stateTransitions:railChangeAt?[{observedAt:railChangeAt,effect:{kind:'rail-state-changed'}}]:[],
    // Poison : l'observation ne doit JAMAIS lire la pose finale de la visite observée.
    get humanFinalReference(){throw Error('pose finale lue');},get finalObserved(){throw Error('pose finale lue');}};
  const chunks=SIDES.map(side=>({format:'banane-native-lidar-chunk-v1',chunkId:`c-${side}`,captureId:'cap-1',visitId:record.visitId,side,
    rail:K.clone(esv[side]),capturedAt:at(visitIndex*10000+100),acquisition:{endedAt:at(visitIndex*10000+300)},
    coordinateSystem:{name:'scene-relative',frameId:'f1'},pointsSceneRelative:points,visibleByClipBoxes:points.map(()=>true)}));
  return {record,chunks};
}

test('ancres : seules les validations fiables, antérieures, du même repère et proches servent',()=>{
  const current={visitId:'v9',visitIndex:9,identity:identity(105)};
  const earlier=[
    validatedVisit(104,1,truth),                               // retenue
    validatedVisit(103,2,truth),                               // retenue
    validatedVisit(102,3,truth),                               // plus loin : écartée par le nombre d'ancres
    validatedVisit(104,4,truth,{freshnessMs:60000}),           // état vieux de 60 s : refusée
    validatedVisit(106,5,truth,{intents:2}),                   // deux intentions : refusée
    validatedVisit(107,6,truth,{status:'candidate-timing-uncertain'}),
    validatedVisit(104,7,truth,{frameId:'f2'}),                // autre repère de scène : refusée
    validatedVisit(101,8,truth),                               // à 4 numéros : hors fenêtre
    validatedVisit(106,12,truth)];                             // postérieure : jamais une ancre
  const anchors=O.selectAnchors(current,earlier);
  assert.deepEqual(anchors.map(a=>a.cut),[104,103]);
  assert.deepEqual(anchors.map(a=>a.visitIndex),[1,2]);
});

test('ancres : pour un même cut, la validation la plus récente l’emporte',()=>{
  const current={visitId:'v9',visitIndex:9,identity:identity(105)};
  const anchors=O.selectAnchors(current,[validatedVisit(104,1,truth),validatedVisit(104,3,truth)]);
  assert.equal(anchors.length,1);assert.equal(anchors[0].visitIndex,3);
});

test('prédiction : la droite des ancres, dans le repère profil de la pose ESV',()=>{
  const rail=base.rails.left,M=rail.sceneRelativeToProfileLocal,P=rail.profileLocalToSceneRelative,o=K.C.point(M,rail.positionSceneRelative);
  const at=(x,y,z)=>K.C.point(P,[o[0]+x,o[1]+y,o[2]+z]);
  // Ancres à −2 m et −1 m, latéral 0,200 puis 0,210 : 0,220 au cut.
  const p=O.predict(rail,[{positions:{left:at(-2,.200,.01)}},{positions:{left:at(-1,.210,.01)}}],'left');
  assert.ok(Math.abs(p.lateral-.220)<1e-9);assert.ok(Math.abs(p.vertical-.01)<1e-9);
  const moved=O.translated(rail,p.translation),q=K.C.point(M,moved.positionSceneRelative);
  assert.ok(Math.abs(q[1]-o[1]-.220)<1e-9&&Math.abs(q[0]-o[0])<1e-9);
});

test('entrée : pose ESV exacte, avant le premier geste, visibilité prouvée, sans doublon, une capture par côté',()=>{
  const esv=shifted(base.rails,150),{record,chunks}=observedVisit(105,9,esv,{railChangeAt:at(9*10000+1000)});
  const p=[[1,2,3],[4,5,6],[7,8,9]];
  const extra=[
    {...chunks[0],chunkId:'moved',rail:K.clone(truth.left),pointsSceneRelative:[[9,9,9]],visibleByClipBoxes:[true]},            // autre pose : écarté
    {...chunks[0],chunkId:'late',acquisition:{endedAt:at(9*10000+2000)},pointsSceneRelative:[[8,8,8]],visibleByClipBoxes:[true]}, // après le geste : écarté
    {...chunks[0],chunkId:'small',captureId:'cap-2',pointsSceneRelative:[[7,7,7]],visibleByClipBoxes:[true]}];                    // capture plus petite : écartée
  const left={...chunks[0],pointsSceneRelative:p.concat([p[0]]),visibleByClipBoxes:[true,undefined,true,true]};                    // inconnu + doublon
  const input=O.gatherInput(record,[left,chunks[1],...extra]);
  assert.deepEqual(input.captureIds,{left:'cap-1',right:'cap-1'});
  assert.ok(!input.chunkIds.includes('moved')&&!input.chunkIds.includes('late')&&!input.chunkIds.includes('small'));
  assert.ok(input.points.some(q=>q[0]===7&&q[1]===8)&&!input.points.some(q=>q[0]===4&&q[1]===5),'visibilité inconnue : exclue');
  assert.equal(input.points.filter(q=>q[0]===1&&q[1]===2).length,1,'doublon exact : compté une fois');
  assert.ok(input.duplicatesRemoved>=1);
});

test('sans ancre : aucun calcul, et le dit',()=>{
  const {record,chunks}=observedVisit(105,9,shifted(base.rails,150));
  const block=O.observe({record,anchors:[],chunks,Shadow});
  assert.equal(block.status,'no-anchor');assert.equal(block.applied,false);assert.equal(block.displayed,false);
  assert.equal(block.fromContinuity,undefined);
});

test('moteur réel : depuis une pose ESV à 150 mm, le départ par continuité retrouve le rail',()=>{
  const esv=shifted(base.rails,150),{record,chunks}=observedVisit(105,9,esv);
  const anchors=O.selectAnchors(record,[validatedVisit(104,1,truth),validatedVisit(103,2,truth)]);
  const block=O.observe({record,anchors,chunks,Shadow});
  assert.equal(block.status,'computed');assert.equal(block.applied,false);assert.equal(block.displayed,false);
  assert.deepEqual(block.anchors.map(a=>a.cut),[104,103]);
  // Prédiction = vraie position vue depuis la pose ESV : décalage du moteur au fixture, moins les 150 mm.
  assert.ok(Math.abs(block.prediction.left.lateralMm-(science.rails.left.next.delta[1]*1000-150))<1);
  assert.equal(block.fromContinuity.applicable,true);
  for(const side of SIDES){
    const m=esv[side].sceneRelativeToProfileLocal,a=K.C.point(m,block.fromContinuity.rails[side].positionSceneRelative),h=K.C.point(m,truth[side].positionSceneRelative);
    assert.ok(Math.abs(a[1]-h[1])*1000<3,`${side} : ${((a[1]-h[1])*1000).toFixed(1)} mm`);
    assert.ok(Math.abs(block.fromContinuity.rails[side].fromPredictionLateralMm)<3);
  }
  assert.ok(Number.isFinite(block.fromContinuity.engineMs));
  assert.equal(block.engine.convention,Shadow.state().conventionVersion);
});

test('points capturés après un geste de l’opérateur : aucun calcul',()=>{
  const esv=shifted(base.rails,150),{record,chunks}=observedVisit(105,9,esv,{railChangeAt:at(9*10000+200)});
  const anchors=O.selectAnchors(record,[validatedVisit(104,1,truth)]);
  const block=O.observe({record,anchors,chunks,Shadow});
  assert.equal(block.status,'no-points');
});

/* Dans la session Natif : le calcul part après la fin de visite, hors de la
 * file des événements, et n'écrit que le bloc d'observation. */
const {Sessions}=require('../src/native-session.js'),{Engine}=require('../src/engine.js'),{MemoryStore}=require('./fixtures.cjs');
async function nativeFixture(){
  const store=new MemoryStore();store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];
  store.getRecord=async id=>{const r=store.records.find(x=>(x.recordId||x.id)===id);return r?K.clone(r):undefined;};
  const adapter={state:async()=>null,nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})};
  const engine=new Engine(adapter,store);await engine.init();const sessions=new Sessions(engine,adapter,store);await sessions.init();await sessions.start();
  const n=engine.s.native,p=n.observationPeriods.at(-1);
  await sessions.receive('period-started',{sessionId:n.id,observationPeriodId:p.observationPeriodId,startedAt:new Date().toISOString()});
  const send=(type,data)=>sessions.receive(type,{sessionId:n.id,observationPeriodId:p.observationPeriodId,...data});
  return {store,engine,sessions,send};
}
function stateAt(cut,rails){return {identity:identity(cut),rails:K.clone(rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],
  viewObservation:{status:'observed',viewEpochId:'view',observedAt:new Date().toISOString()},geominfo:{status:'not-observed',raw:null,source:null}};}
async function visit(f,visitId,cut,esv,{validate=true,chunks=true}={}){
  const initial=stateAt(cut,Object.fromEntries(SIDES.map(side=>{const {profileContours,...rest}=esv[side];return [side,rest];})));
  await f.send('visit-started',{visitId,identity:initial.identity,initialObserved:initial});
  if(chunks)for(const side of SIDES)await f.send('capture-checkpoint',{visitId,identity:initial.identity,chunk:{format:'banane-native-lidar-chunk-v1',version:K.VERSION,
    chunkId:`${visitId}:${side}`,captureId:`${visitId}:cap`,visitId,side,identity:K.clone(initial.identity),capturedAt:initial.capturedAt,rail:K.clone(esv[side]),viewObservation:K.clone(initial.viewObservation),
    coordinateSystem:{name:'scene-relative',frameId:'f1'},acquisition:{startedAt:initial.capturedAt,endedAt:initial.capturedAt},
    pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)}});
  // L'opérateur pose les rails à la vraie position puis valide (quelques ms après la capture).
  await new Promise(resolve=>setTimeout(resolve,5));const final=stateAt(cut,truth);
  if(validate){await f.send('state-observed',{visitId,identity:final.identity,state:final,trigger:'poll',effect:{kind:'rail-state-changed'}});
    await f.send('operator-event',{visitId,identity:final.identity,stateObservedBeforeInput:final,event:{type:'keydown',intent:'VALIDATE',observedAt:new Date().toISOString()}});}
  await f.send('visit-ended',{visitId,identity:final.identity,finalObserved:final,reason:'target-changed',nextIdentity:identity(cut+1),endedAt:new Date().toISOString()});
  await f.sessions.continuityRunning;await f.sessions.queue;
  return f.store.records.find(r=>r.visitId===visitId);
}

test('session Natif : bloc consigné après la fin de visite, ancres = cuts validés avant, rien d’appliqué',async()=>{
  const f=await nativeFixture(),esv=shifted(base.rails,150);
  const first=await visit(f,'a',100,esv);
  assert.equal(first.continuityObservation.status,'no-anchor');
  await visit(f,'b',101,esv);
  const third=await visit(f,'c',102,esv);
  const block=third.continuityObservation;
  assert.equal(block.status,'computed');assert.deepEqual(block.anchors.map(a=>a.cut),[101,100]);
  assert.equal(block.applied,false);assert.equal(block.displayed,false);assert.equal(block.fromContinuity.applicable,true);
  // La pose finale de la visite reste celle de l'opérateur : l'observation n'a rien déplacé.
  assert.deepEqual(third.humanFinalReference.state.rails.left.positionSceneRelative,truth.left.positionSceneRelative);
  assert.equal(third.commandSentByBanane,false);
});

test('session Natif : une revisite n’est pas observée, et la fin de session attend le calcul en cours',async()=>{
  const f=await nativeFixture(),esv=shifted(base.rails,150);
  await visit(f,'a',100,esv);await visit(f,'b',101,esv);
  const initial=stateAt(100,truth);
  await f.send('visit-started',{visitId:'r',identity:initial.identity,initialObserved:initial});
  await f.send('visit-ended',{visitId:'r',identity:initial.identity,finalObserved:initial,reason:'target-changed',nextIdentity:identity(102),endedAt:new Date().toISOString()});
  await f.sessions.continuityRunning;
  assert.equal(f.store.records.find(r=>r.visitId==='r').continuityObservation,undefined);
  const data=await f.sessions.end();
  assert.ok(data.records.find(r=>r.visitId==='b').continuityObservation,'bloc exporté avec la visite');
});
