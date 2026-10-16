'use strict';
/* Montage des essais de l'ombre de l'Écho (memoire-differes-ombre) : session Écho réelle (src/native-session.js), moteur réel,
 * captures synthétiques (tests/fixtures.cjs). */
const assert=require('node:assert/strict');
const O=require('../../src/continuity-observer.js'),Shadow=require('../../src/gcv1-shadow.js'),S=require('../../src/settings.js');
const {K,base,MemoryStore}=require('../fixtures.cjs'),{Sessions,entreeSansFuite}=require('../../src/native-session.js'),{Engine}=require('../../src/engine.js');
const SIDES=['left','right'];
const identity=cut=>({pageId:'p',part:22,cut,shape:'U50',frameId:'f1',projectId:null});
const science=Shadow.scientificProposeBoth(base);
const truth=K.expectedPoses({rails:base.rails},{left:{delta:science.rails.left.next.delta},right:{delta:science.rails.right.next.delta}});
function shifted(rails,mm){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
const esv=shifted(base.rails,150);
async function nativeFixture({differes=[100,101,102,103],continuite=false}={}){
  const store=new MemoryStore();store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];
  store.getRecord=async id=>{const r=store.records.find(x=>(x.recordId||x.id)===id);return r?K.clone(r):undefined;};
  const adapter={state:async()=>null,nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})};
  const engine=new Engine(adapter,store);await engine.init();
  /* Le lot Orbite de la partie, vu par le moteur : ces cuts sont restés différés. */
  for(const c of differes)engine.s.records.push({id:'d'+c,recordId:'d'+c,format:'banane-deferred-unresolved-v1',status:'deferred-unresolved',identity:identity(c)});
  const sessions=new Sessions(engine,adapter,store);await sessions.init();await sessions.start();
  /* Délai de verify (20 s par fichier) : l'observation « continuité » (une relance du moteur par visite) n'est gardée que là où l'essai la lit. */
  if(!continuite)sessions.continuityOn=()=>false;
  const n=engine.s.native,p=n.observationPeriods.at(-1);
  await sessions.receive('period-started',{sessionId:n.id,observationPeriodId:p.observationPeriodId,startedAt:new Date().toISOString()});
  const send=(type,data)=>sessions.receive(type,{sessionId:n.id,observationPeriodId:p.observationPeriodId,...data});
  return {store,engine,sessions,send};
}
function stateAt(cut,rails){return {identity:identity(cut),rails:K.clone(rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],
  viewObservation:{status:'observed',viewEpochId:'view',observedAt:new Date().toISOString()},geominfo:{status:'not-observed',raw:null,source:null}};}
/* Une visite : pose de départ à 150 mm, capture autour d'elle, puis l'opérateur pose `pose` et valide. */
async function visit(f,visitId,cut,{pose=truth}={}){
  const initial=stateAt(cut,Object.fromEntries(SIDES.map(side=>{const {profileContours,...rest}=esv[side];return [side,rest];})));
  await f.send('visit-started',{visitId,identity:initial.identity,initialObserved:initial});
  for(const side of SIDES)await f.send('capture-checkpoint',{visitId,identity:initial.identity,chunk:{format:'banane-native-lidar-chunk-v1',version:K.VERSION,
    chunkId:`${visitId}:${side}`,captureId:`${visitId}:cap`,visitId,side,identity:K.clone(initial.identity),capturedAt:initial.capturedAt,rail:K.clone(esv[side]),viewObservation:K.clone(initial.viewObservation),
    coordinateSystem:{name:'scene-relative',frameId:'f1'},acquisition:{startedAt:initial.capturedAt,endedAt:initial.capturedAt},
    pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)}});
  await new Promise(resolve=>setTimeout(resolve,5));const final=stateAt(cut,pose);
  await f.send('state-observed',{visitId,identity:final.identity,state:final,trigger:'poll',effect:{kind:'rail-state-changed'}});
  await f.send('operator-event',{visitId,identity:final.identity,stateObservedBeforeInput:final,event:{type:'keydown',intent:'VALIDATE',observedAt:new Date().toISOString()}});
  await f.send('visit-ended',{visitId,identity:final.identity,finalObserved:final,reason:'target-changed',nextIdentity:identity(cut+1),endedAt:new Date().toISOString()});
  await f.sessions.continuityRunning;await f.sessions.queue;
  return f.store.records.find(r=>r.visitId===visitId);
}
const ombres=f=>f.store.events.filter(e=>e.type==='memoire-differes-ombre');
const sansHorloge=e=>{const {eventId,timestamp,ms,eventSeq,event_seq,...x}=e;return x;};

module.exports={identity,truth,shifted,esv,nativeFixture,visit,ombres,sansHorloge,SIDES,O,Shadow,S,K,base,entreeSansFuite};
