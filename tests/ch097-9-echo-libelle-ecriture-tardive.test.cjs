'use strict';
/* CH-097, défaut 9 — ÉCHO : LE LIBELLÉ RÉSUMÉ D'UNE VISITE SUIT L'ÉCRITURE DE VALIDATION TARDIVE. L'écriture serveur de validation arrive souvent après la
 * clôture de la visite (0,5 à 0,7 s après le geste). Elle peut remplacer la référence humaine (D-143) et donc changer l'étiquette de l'enregistrement
 * (« validé tel quel » devient « corrigé »). Le résumé `native.visits[].label`, que lisent le panneau et le bilan de la correction, gardait l'ancienne.
 * Même scénario et même monture que tests/echo-ref-ecriture.test.cjs (cut 100, déplacement inventé). Données SYNTHÉTIQUES, aucune requête ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Sessions}=require('../src/native-session.js'),{Engine}=require('../src/engine.js');
const {K,base,MemoryStore}=require('./fixtures.cjs');

async function session(){
 const store=new MemoryStore();store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];store.keys=async()=>[...store.clouds.keys()];
 const adapter={state:async()=>st(),nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})};
 const engine=new Engine(adapter,store);await engine.init();const sessions=new Sessions(engine,adapter,store);await sessions.init();
 function st(cut=100,at=new Date().toISOString()){return {identity:{pageId:'page-a',part:23,cut,shape:'U50',frameId:'frame-page-a',projectId:null},rails:K.clone(base.rails),capturedAt:at,status:'complete',partialReasons:[],
  viewObservation:{status:'observed',viewEpochId:'v',observedAt:at},geominfo:{status:'not-observed',raw:null,source:null}};}
 const ctx=()=>{const n=engine.s.native;return {sessionId:n.id,observationPeriodId:n.currentPeriodId};};
 const T0=Date.now(),at=ms=>new Date(T0+ms).toISOString();
 /* Pose déplacée de `delta` (mètres, repère profil) sur les rails nommés, état saisi à T0 + ms. */
 const moved=(state,delta,ms)=>({...K.clone(state),rails:K.expectedPoses(state,{left:{delta:delta.left||[0,0,0]},right:{delta:delta.right||[0,0,0]}}),capturedAt:at(ms)});
 const at0=ms=>st(100,at(ms));
 async function open(visitId,cut=100,ms=0){const s=st(cut,at(ms));await sessions.receive('visit-started',{...ctx(),visitId,identity:s.identity,initialObserved:s});return s;}
 async function observe(visitId,state){await sessions.receive('state-observed',{...ctx(),visitId,identity:state.identity,state,trigger:'poll',effect:{kind:'rail-state-changed'}});}
 async function gesture(visitId,state,event,ms){await sessions.receive('operator-event',{...ctx(),visitId,identity:state.identity,stateObservedBeforeInput:state,event:{type:'keydown',observedAt:at(ms),...event}});}
 async function close(visitId,state,ms,next=101){await sessions.receive('visit-ended',{...ctx(),visitId,identity:state.identity,finalObserved:state,reason:'target-changed',nextIdentity:{...state.identity,cut:next},endedAt:at(ms)});}
 const record=id=>store.records.find(r=>r.visitId===id);
 /* Écriture de validation d'ESV : corps avec les bords gauche et droit de `rails` (positions de la scène). */
 const corps=(rails,extra={})=>({XLeftEdge:rails.left.positionSceneRelative[0],YLeftEdge:rails.left.positionSceneRelative[1],ZLeftEdge:rails.left.positionSceneRelative[2],
  XRightEdge:rails.right.positionSceneRelative[0],YRightEdge:rails.right.positionSceneRelative[1],ZRightEdge:rails.right.positionSceneRelative[2],
  ExtractionStatus:'valid',TreatedByOperator:true,SeenByOperator:true,...extra});
 const ecriture=(ms,rowIndex,rails,extra={},status=204,id='w'+ms)=>({eventId:id,timestamp:at(ms),status,method:'PUT',outcome:'done',attempt:1,rowIndex,body:corps(rails,extra),durationMs:40});
 return {store,engine,sessions,st,at,at0,open,moved,observe,gesture,close,record,corps,ecriture};
}
const pos=(state,side)=>state.rails[side].positionSceneRelative;
const mm=(a,b)=>K.C.distance(a,b)*1000;

/* Scénario du cut 428 : le clic sur le rail droit précède la touche de 7 ms ; ESV applique le déplacement 11 ms après la touche. */
async function cas428(f,{deplacementM=0.19,lectureMs=-25}={}){
 await f.sessions.start();
 const a=f.at0(lectureMs);                                    // dernier état lu avant la touche, 25 ms avant
 await f.open('v1',100,-200);
 await f.gesture('v1',a,{type:'click',key:undefined,targetKind:'canvas'},93);          // clic sur le rail, 7 ms avant la touche
 await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Shift+Space'},100);
 const b=f.moved(a,{right:[0,deplacementM,0]},111);   // déplacement appliqué 11 ms après la touche
 await f.observe('v1',b);await f.close('v1',b,300);
 return {a,b};
}


const resume=(f,id)=>f.engine.s.native.visits.find(v=>v.visitId===id);

test('visite close, puis écriture de validation qui change l’étiquette : le résumé de la visite porte la nouvelle étiquette',async()=>{
 const f=await session();const {b}=await cas428(f);
 const avant=f.record('v1').observedLabelCandidate;
 assert.equal(resume(f,'v1').label,avant,'à la clôture : résumé et enregistrement d’accord');
 await f.sessions.noteServerWrite(f.ecriture(600,100,b.rails));
 const apres=f.record('v1').observedLabelCandidate;
 assert.notEqual(apres,avant,`l’écriture tardive change bien l’étiquette de l’enregistrement (${avant} → ${apres})`);
 assert.equal(resume(f,'v1').label,apres,'le résumé suit');});

test('écriture tardive qui ne change rien (mêmes rails que la référence) : le résumé garde son étiquette',async()=>{
 const f=await session();const {a}=await cas428(f,{deplacementM:0});
 const avant=resume(f,'v1').label;
 await f.sessions.noteServerWrite(f.ecriture(600,100,a.rails));
 assert.equal(f.record('v1').observedLabelCandidate,avant);assert.equal(resume(f,'v1').label,avant);});

test('écriture pendant la visite encore ouverte : rien n’est écrit dans le résumé avant la clôture (comme avant)',async()=>{
 const f=await session();await f.sessions.start();const a=f.at0(-25);await f.open('v1',100,-200);
 await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Shift+Space'},100);
 const label=resume(f,'v1')?.label;
 await f.sessions.noteServerWrite(f.ecriture(150,100,a.rails));
 assert.equal(resume(f,'v1')?.label,label);});
