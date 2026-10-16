'use strict';
/* 5.0 (audit 5.0, I8 (2)) — ÉCHO : FRONTIÈRE ANTI-FUITE ET PANNES DE L'OMBRE `memoire-differes-ombre` (suite de tests/memoire-differes-ombre.test.cjs) : PREMIÈRE VISITE D'UN CUT QUE LE LOT A DIFFÉRÉ.
 *
 * G1 (b), en ombre : la voie est prolongée depuis les corrections DÉJÀ VALIDÉES par l'opérateur sur les cuts précédents de la
 * même série de différés, puis le moteur est recentré sur elle (module commun src/voie-recentree.js). Frontière anti-fuite :
 * celle de l'observation « continuité » (l'ombre GCV1 de l'Écho, amendement n°7) — la pose de départ de la visite et les points
 * capturés AVANT le premier changement de rail ; jamais la référence humaine ni la pose finale de la visite observée. Le
 * calcul tourne après la fin de visite, hors de la file des événements, et ne commande rien (l'Écho est passif). Données
 * synthétiques (tests/fixtures.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {identity,truth,shifted,esv,nativeFixture,visit,ombres,sansHorloge,SIDES,O,Shadow,S,K,base,entreeSansFuite}=require('./helpers/memoire-ombre-session.cjs');

test('FRONTIÈRE ANTI-FUITE : l\'événement ne dépend pas de la pose finale de l\'opérateur sur le cut observé',{timeout:60000},async()=>{
  const juste=await nativeFixture(),faux=await nativeFixture();
  for(const f of [juste,faux])await visit(f,'a',100);
  await visit(juste,'b',101);await visit(faux,'b',101,{pose:shifted(truth,40)});   // l'opérateur pose ailleurs
  const pris=f=>sansHorloge(ombres(f).find(x=>x.identity.cut===101));
  const j=pris(juste),x=pris(faux);for(const k of ['nativeSessionId','observationPeriodId']){delete j[k];delete x[k];}
  assert.equal(j.etat,'calcule');assert.deepEqual(x,j,'même événement, quelle que soit la réponse de l\'opérateur sur ce cut');
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

test('réglage coupé : rien ; panne de l\'ombre : la visite et la continuité sont intactes',{timeout:60000},async()=>{
  const garde=globalThis.BananeSettings;
  try{
    globalThis.BananeSettings={...S,memoireDifferesOmbre:{...S.memoireDifferesOmbre,actif:false}};
    const f=await nativeFixture();await visit(f,'a',100);await visit(f,'b',101);assert.equal(ombres(f).length,0);
  }finally{if(garde===undefined)delete globalThis.BananeSettings;else globalThis.BananeSettings=garde;}
  const f=await nativeFixture({continuite:true});f.sessions.memoireOutils=()=>({V:{evaluerEcho:()=>{throw Error('panne simulée');}},O,Shadow});
  await visit(f,'a',100);const b=await visit(f,'b',101);
  assert.equal(b.continuityObservation.status,'computed','la continuité est calculée comme avant');
  const e=ombres(f).find(x=>x.identity.cut===101);assert.equal(e.etat,'erreur');assert.match(e.message,/panne simulée/);
});
