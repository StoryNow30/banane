'use strict';
/* 5.0 (audit 5.0, I8 (2)) — ÉCHO : UN ÉVÉNEMENT `memoire-differes-ombre` PAR PREMIÈRE VISITE D'UN CUT QUE LE LOT A DIFFÉRÉ.
 *
 * G1 (b), en ombre : la voie est prolongée depuis les corrections DÉJÀ VALIDÉES par l'opérateur sur les cuts précédents de la
 * même série de différés, puis le moteur est recentré sur elle (module commun src/voie-recentree.js). Frontière anti-fuite :
 * celle de l'observation « continuité » (l'ombre GCV1 de l'Écho, amendement n°7) — la pose de départ de la visite et les points
 * capturés AVANT le premier changement de rail ; jamais la référence humaine ni la pose finale de la visite observée. Le
 * calcul tourne après la fin de visite, hors de la file des événements, et ne commande rien (l'Écho est passif). Données
 * synthétiques (tests/fixtures.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js'),S=require('../src/settings.js');
const {K,base,MemoryStore}=require('./fixtures.cjs'),{Sessions,entreeSansFuite}=require('../src/native-session.js'),{Engine}=require('../src/engine.js');
const SIDES=['left','right'];
const identity=cut=>({pageId:'p',part:22,cut,shape:'U50',frameId:'f1',projectId:null});
const science=Shadow.scientificProposeBoth(base);
const truth=K.expectedPoses({rails:base.rails},{left:{delta:science.rails.left.next.delta},right:{delta:science.rails.right.next.delta}});
function shifted(rails,mm){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
const esv=shifted(base.rails,150);
async function nativeFixture({differes=[100,101,102,103]}={}){
  const store=new MemoryStore();store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];
  store.getRecord=async id=>{const r=store.records.find(x=>(x.recordId||x.id)===id);return r?K.clone(r):undefined;};
  const adapter={state:async()=>null,nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})};
  const engine=new Engine(adapter,store);await engine.init();
  /* Le lot Orbite de la partie, vu par le moteur : ces cuts sont restés différés. */
  for(const c of differes)engine.s.records.push({id:'d'+c,recordId:'d'+c,format:'banane-deferred-unresolved-v1',status:'deferred-unresolved',identity:identity(c)});
  const sessions=new Sessions(engine,adapter,store);await sessions.init();await sessions.start();
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

test('le réglage existe, actif par défaut en OMBRE, réglage G1 (b) de D-148 ; le panneau dit qu\'il ne fait que consigner',()=>{
  const m=S.memoireDifferesOmbre;assert.ok(Object.isFrozen(m));
  assert.deepEqual({...m,etages:[...m.etages]},{actif:true,ecartSerieMax:10,K:3,appuis:2,mmParCut:3,porteDispersionMm:10,etages:['first-pass','window','choice']});
  const ligne=S.describe().find(l=>/Mémoire des différés en ombre/.test(l.nom));assert.ok(ligne);assert.match(ligne.valeur,/consign/i);assert.match(ligne.pourquoi,/référence/i);
});

test('session Écho : un événement par première visite d\'un différé ; la série apprend des corrections déjà validées ; rien n\'est commandé',{timeout:60000},async()=>{
  const f=await nativeFixture();
  const a=await visit(f,'a',100),b=await visit(f,'b',101),c=await visit(f,'c',102);
  const e=ombres(f);
  assert.deepEqual(e.map(x=>[x.identity.cut,x.etat]),[[100,'sans-memoire'],[101,'calcule'],[102,'calcule']]);
  for(const x of e){assert.equal(x.nativeSessionId,f.engine.s.native.id,'sort dans l\'export Écho');assert.equal(x.frontiere,'avant-reference');assert.ok(x.visitId);}
  const [,e1,e2]=e;
  assert.deepEqual(e1.memoire.cuts,[100]);assert.deepEqual(e2.memoire.cuts,[101,100]);assert.deepEqual(e2.appuis,[101,100]);
  assert.equal(e2.verdict.posable,true);
  /* La pose de l'ombre retrouve celle de l'opérateur (vérité du fixture), à quelques mm. */
  for(const side of SIDES){const v=K.C.point(esv[side].sceneRelativeToProfileLocal,truth[side].positionSceneRelative),o=K.C.point(esv[side].sceneRelativeToProfileLocal,esv[side].positionSceneRelative);
    assert.ok(Math.abs(e2.poseMm[side][1]-(v[1]-o[1])*1000)<3,`${side} : ${e2.poseMm[side]}`);}
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(e)));
  /* Écho passif : aucune visite ne porte de commande d'Ariane ; la référence de l'opérateur est intacte. */
  for(const r of [a,b,c]){assert.equal(r.commandSentByBanane,false);}
  assert.deepEqual(c.humanFinalReference.state.rails.left.positionSceneRelative,truth.left.positionSceneRelative);
  /* Un cut que le lot n'a pas différé : aucun événement. */
  await visit(f,'d',110);assert.equal(ombres(f).length,3);
});

test('FRONTIÈRE ANTI-FUITE : l\'événement ne dépend pas de la pose finale de l\'opérateur sur le cut observé',{timeout:60000},async()=>{
  const juste=await nativeFixture(),faux=await nativeFixture();
  for(const f of [juste,faux]){await visit(f,'a',100);await visit(f,'b',101);}
  await visit(juste,'c',102);await visit(faux,'c',102,{pose:shifted(truth,40)});   // l'opérateur pose ailleurs
  const pris=f=>sansHorloge(ombres(f).find(x=>x.identity.cut===102));
  const j=pris(juste),x=pris(faux);for(const k of ['nativeSessionId','observationPeriodId']){delete j[k];delete x[k];}
  assert.deepEqual(x,j,'même événement, quelle que soit la réponse de l\'opérateur sur ce cut');
  /* L'entrée du calcul est construite sans jamais lire la référence humaine (lectures piégées). */
  const record={visitId:'v9',visitIndex:9,identity:identity(102),beforeEstablished:{rails:Object.fromEntries(SIDES.map(s=>{const {profileContours,...r}=K.clone(esv[s]);return [s,r];}))},
    stateTransitions:[],visitRelation:{type:'first-observation'}};
  for(const k of ['humanFinalReference','humanFinalReferences','finalObserved','lastObserved','operatorIntents','serverWrites','railPoseHistory','observedLabelCandidate'])
    Object.defineProperty(record,k,{get(){throw Error('lu : '+k);},enumerable:true});
  const chunks=SIDES.map(side=>({chunkId:'c'+side,captureId:'cap',visitId:'v9',side,rail:K.clone(esv[side]),capturedAt:'2026-10-16T00:00:00.000Z',acquisition:{endedAt:'2026-10-16T00:00:00.100Z'},
    coordinateSystem:{name:'scene-relative'},pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)}));
  const ent=entreeSansFuite(record,chunks);
  assert.equal(ent.points.length>0,true);assert.deepEqual(Object.keys(ent).sort(),['identity','points','rails','visible','visitId','visitIndex']);
});

test('ce qui manque est dit : sans lot connu pour la partie, un seul événement « differes-inconnus », rien de calculé',{timeout:60000},async()=>{
  const f=await nativeFixture({differes:[]});
  await visit(f,'a',100);await visit(f,'b',101);await visit(f,'c',102);
  const e=ombres(f);assert.equal(e.length,1);assert.equal(e[0].etat,'differes-inconnus');assert.equal(e[0].identity.part,22);assert.equal(e[0].verdict.posable,false);
});

test('réglage coupé : rien ; panne de l\'ombre : la visite et la continuité sont intactes',{timeout:60000},async()=>{
  const garde=globalThis.BananeSettings;
  try{
    globalThis.BananeSettings={...S,memoireDifferesOmbre:{...S.memoireDifferesOmbre,actif:false}};
    const f=await nativeFixture();await visit(f,'a',100);await visit(f,'b',101);assert.equal(ombres(f).length,0);
  }finally{if(garde===undefined)delete globalThis.BananeSettings;else globalThis.BananeSettings=garde;}
  const f=await nativeFixture();f.sessions.memoireOutils=()=>({V:{evaluerEcho:()=>{throw Error('panne simulée');}},O,Shadow});
  await visit(f,'a',100);const b=await visit(f,'b',101);
  assert.equal(b.continuityObservation.status,'computed','la continuité est calculée comme avant');
  const e=ombres(f).find(x=>x.identity.cut===101);assert.equal(e.etat,'erreur');assert.match(e.message,/panne simulée/);
});
