'use strict';
/* D-143 : la « référence humaine » de l'Écho ne doit pas rester figée sur le dernier état lu à la touche de validation.
 * Si l'opérateur clique un rail quelques millisecondes avant la touche, ESV applique le déplacement APRÈS elle : l'état lu
 * à la touche est périmé. L'écriture serveur de validation (PUT 2xx, les deux rails), rattachée à la visite par numéro
 * de ligne, porte la bonne pose et fait foi. Données SYNTHÉTIQUES (corpus de test, cut 100, déplacements inventés).
 * Observation seulement : aucune requête ESV, aucun changement d'Orbite. */
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

test('D-143 constat : avant l’écriture, la référence est celle lue à la touche, donc périmée (le déplacement vient 11 ms après)',async()=>{
 const f=await session();const {a,b}=await cas428(f);
 const r=f.record('v1');
 assert.equal(r.humanFinalReference.state.capturedAt,a.capturedAt);
 assert.ok(mm(pos(r.humanFinalReference.state,'right'),pos(b,'right'))>150,'le rail droit de la référence est resté à sa pose d’avant le déplacement');
 assert.equal(r.observedLabelCandidate,'VALIDATE_NO_MOVEMENT');
 assert.equal(r.operatorIntents[0].observedAt,f.at(100));
});

test('D-143 : l’écriture de validation de la ligne remplace la référence ; l’ancienne est gardée ; l’étiquette suit',async()=>{
 const f=await session();const {a,b}=await cas428(f);
 const w=await f.sessions.noteServerWrite(f.ecriture(720,100,b.rails));
 assert.equal(w.joinMethod,'row-index');
 const r=f.record('v1');
 assert.equal(r.humanFinalReferenceSource,'validation-write');
 assert.equal(r.humanFinalReference.source,'validation-write');
 assert.ok(mm(pos(r.humanFinalReference.state,'right'),pos(b,'right'))<0.001,'la référence porte la pose de l’écriture');
 assert.ok(mm(pos(r.humanFinalReference.state,'left'),pos(b,'left'))<0.001);
 assert.equal(r.humanFinalReferences.length,2);
 assert.ok(mm(pos(r.humanFinalReferences[0].state,'right'),pos(a,'right'))<0.001,'l’ancienne référence reste dans humanFinalReferences');
 assert.equal(r.humanFinalReferences[0].supersededBy,'validation-write');
 assert.equal(r.humanFinalReferences[1],r.humanFinalReference);
 assert.equal(r.humanFinalReference.replaces?.eventSeq,r.humanFinalReferences[0].eventSeq);
 assert.ok(Math.abs(r.humanFinalReference.replacedByWrite.maxDiffMm-190)<0.5,String(r.humanFinalReference.replacedByWrite.maxDiffMm));
 assert.equal(r.observedLabelCandidate,'VALIDATE_CORRECTED_RIGHT_ONLY');
 assert.ok(Math.abs(r.humanDelta.right.distanceMm-190)<0.5,String(r.humanDelta.right.distanceMm));
 assert.ok(r.humanDelta.left.distanceMm<0.001);
});

test('D-143 : le dernier état observé sert de référence s’il concorde avec l’écriture à 1 mm près (matrices comprises)',async()=>{
 const f=await session();const {b}=await cas428(f);
 /* Écriture arrondie : 0,3 mm d’écart avec l’état observé. */
 const arrondi={left:b.rails.left,right:{...b.rails.right,positionSceneRelative:[...pos(b,'right')].map((v,i)=>i===1?v+0.0003:v)}};
 await f.sessions.noteServerWrite(f.ecriture(720,100,arrondi));
 const r=f.record('v1');
 assert.equal(r.humanFinalReference.source,'validation-write');
 assert.equal(r.humanFinalReference.state.capturedAt,b.capturedAt);
 assert.deepEqual(r.humanFinalReference.state.rails,b.rails);
 assert.equal(r.humanFinalReference.replacedByWrite.poseFrom,'last-observed-state');
});

test('D-143 : si le dernier état observé ne concorde pas, la référence prend les positions de l’écriture',async()=>{
 const f=await session();await f.sessions.start();
 const a=f.at0(-25);await f.open('v1',100,-200);
 await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Shift+Space'},100);
 const b=f.moved(a,{right:[0,0.19,0]},111);await f.observe('v1',b);
 const c=f.moved(a,{right:[0,0.195,0]},250);await f.observe('v1',c);          // un dernier ajustement, 5 mm plus loin, que l’écriture ne porte pas
 await f.close('v1',c,300);
 await f.sessions.noteServerWrite(f.ecriture(720,100,b.rails));
 const r=f.record('v1');
 assert.equal(r.humanFinalReference.replacedByWrite.poseFrom,'write');
 assert.ok(mm(pos(r.humanFinalReference.state,'right'),pos(b,'right'))<0.001,'positions de l’écriture');
 assert.ok(mm(pos(r.humanFinalReference.state,'right'),pos(c,'right'))>4);
 assert.equal(r.humanFinalReference.state.rails.right.positionSource,'validation-write');
 assert.equal(r.humanFinalReference.state.rails.right.sceneRelativeToProfileLocal.length,16,'l’orientation du repère profil est gardée');
 assert.deepEqual(r.humanFinalReference.state.identity,a.identity);
});

test('D-143 : sous 1 mm d’écart, rien ne change ; au-dessus, la référence est remplacée',async()=>{
 const f=await session();await f.sessions.start();
 const a=f.at0(-25);await f.open('v1',100,-200);await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Shift+Space'},100);await f.close('v1',a,300);
 const proche=f.moved(a,{right:[0,0.0008,0]},0);
 await f.sessions.noteServerWrite(f.ecriture(720,100,proche.rails));
 let r=f.record('v1');
 assert.equal(r.humanFinalReferences.length,1);assert.equal(r.humanFinalReference.source,undefined);assert.equal(r.humanFinalReferenceSource,'sole-validate-intent');
 const loin=f.moved(a,{right:[0,0.0015,0]},0);
 await f.sessions.noteServerWrite(f.ecriture(730,100,loin.rails,{},204,'w2'));
 r=f.record('v1');
 assert.equal(r.humanFinalReference.source,'validation-write');assert.equal(r.humanFinalReferences.length,2);
 /* La même écriture reçue deux fois ne remplace rien de plus. */
 await f.sessions.noteServerWrite(f.ecriture(740,100,loin.rails,{},204,'w3'));
 assert.equal(f.record('v1').humanFinalReferences.length,2);
});

test('D-143 : seule une écriture de validation réussie, rattachée par numéro de ligne, corrige la référence',async()=>{
 const f=await session();const {b}=await cas428(f);
 await f.sessions.noteServerWrite(f.ecriture(700,100,b.rails,{},500,'echec'));                                   // échec serveur
 await f.sessions.noteServerWrite(f.ecriture(705,100,b.rails,{ExtractionStatus:undefined,TreatedByOperator:false},204,'vu'));   // « vu par l’opérateur » seul
 await f.sessions.noteServerWrite(f.ecriture(710,101,b.rails,{},204,'autre-ligne'));                              // ligne voisine
 await f.sessions.noteServerWrite({...f.ecriture(715,100,b.rails,{},204,'sans-ligne'),rowIndex:undefined});       // sans numéro de ligne : repli sur l’heure
 const r=f.record('v1');
 assert.equal(r.humanFinalReferences.length,1,'aucune de ces écritures ne corrige');
 assert.equal(r.humanFinalReference.source,undefined);
 assert.equal(r.observedLabelCandidate,'VALIDATE_NO_MOVEMENT');
 const joints=r.serverWrites.map(w=>[w.eventId,w.joinMethod]);
 assert.ok(!joints.some(([id,m])=>id==='sans-ligne'&&m==='row-index'));
});

test('D-143 : une visite sans validation, ou sautée, n’a pas de référence à corriger',async()=>{
 const f=await session();await f.sessions.start();
 const a=f.at0(-25);await f.open('v1',100,-200);await f.gesture('v1',a,{intent:'SKIP'},100);await f.close('v1',a,300);
 const b=f.moved(a,{right:[0,0.19,0]},0);
 await f.sessions.noteServerWrite(f.ecriture(720,100,b.rails));
 const r=f.record('v1');
 assert.equal(r.humanFinalReference,null);assert.equal(r.observedLabelCandidate,'SKIP');
});

test('D-143 : un changement de rails dans les 150 ms qui suivent l’intention est nommé ; plus tard, non',async()=>{
 const f=await session();await f.sessions.start();
 const a=f.at0(-25);await f.open('v1',100,-200);
 await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Shift+Space'},100);
 await f.observe('v1',f.moved(a,{right:[0,0.01,0]},250));                     // 150 ms pile : dans la fenêtre
 assert.ok(f.record('v1').partialReasons.includes('rail-change-after-validate-intent'));
 const g=await session();await g.sessions.start();
 const a2=g.at0(-25);await g.open('v2',100,-200);
 await g.gesture('v2',a2,{intent:'VALIDATE',decisionKey:'Shift+Space'},100);
 await g.observe('v2',g.moved(a2,{right:[0,0.01,0]},251));                    // 151 ms : hors de la fenêtre
 assert.ok(!g.record('v2').partialReasons.includes('rail-change-after-validate-intent'));
 /* Avant l'intention : jamais. */
 const h=await session();await h.sessions.start();
 const a3=h.at0(-25);await h.open('v3',100,-200);
 await h.observe('v3',h.moved(a3,{right:[0,0.01,0]},50));
 await h.gesture('v3',a3,{intent:'VALIDATE',decisionKey:'Shift+Space'},100);
 assert.ok(!h.record('v3').partialReasons.includes('rail-change-after-validate-intent'));
});

test('D-143 : une référence confirmée par l’écriture n’est plus jugée « périmée » à la classification',async()=>{
 const f=await session();const {b}=await cas428(f,{lectureMs:-2000});                      // état lu 2 s avant la touche : trop ancien
 let r=f.record('v1');
 assert.ok(r.geometryEligibility.right.reasons.includes('human-final-reference-not-freshly-observed'),'constat avant l’écriture');
 await f.sessions.noteServerWrite(f.ecriture(720,100,b.rails));
 r=f.record('v1');
 assert.ok(!r.geometryEligibility.right.reasons.includes('human-final-reference-not-freshly-observed'),r.geometryEligibility.right.reasons.join(','));
 assert.equal(r.serverConfirmed,true);
});

test('D-143 : une écriture qui arrive après la fermeture de la visite corrige quand même la référence et reclasse la visite',async()=>{
 const f=await session();const {b}=await cas428(f);
 assert.notEqual(f.record('v1').endedAt,null);
 await f.sessions.noteServerWrite(f.ecriture(5000,100,b.rails));                 // 4,7 s après la sortie du cut, dans le délai de jointure
 assert.equal(f.record('v1').humanFinalReference.source,'validation-write');
 assert.equal(f.record('v1').observedLabelCandidate,'VALIDATE_CORRECTED_RIGHT_ONLY');
});
