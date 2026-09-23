'use strict';
/* Chantier n°1 du plan de mi-parcours (D-037) : choisir, parmi les minima que
 * le moteur calcule, celui que la voie prédit — jamais un écartement. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chooseRail,studySession}=require('../tools/lot-choice-study.cjs');
const O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const {K,base}=require('./fixtures.cjs');
const SIDES=['left','right'];
const science=Shadow.scientificProposeBoth({format:'test',identity:{},rails:base.rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
/* La vraie position, rails ET contours déplacés ensemble (expectedPoses ne
 * déplace pas les contours : ne jamais l'utiliser pour construire une capture). */
const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,d=science.rails[side].next.delta;
  const w=K.C.point(P,d),o=K.C.point(P,[0,0,0]);return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
function shifted(rails,mm){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
const captureAt=rails=>({format:'test',identity:{part:23,cut:2855},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});

test('prédiction sur le rail : le minimum retenu est à quelques mm de la prédiction',()=>{
  const capture=captureAt(truth),sci=Shadow.scientificProposeBoth(capture);
  for(const side of SIDES){
    const pick=chooseRail(capture,side,sci,15);
    assert.equal(pick.ok,true,side);
    assert.ok(pick.fromPredictionMm<=5,`${side} : ${pick.fromPredictionMm} mm`);
    assert.ok(pick.top>=15&&pick.face>=3);
  }
});

test('prédiction fausse de 60 à 150 mm : la paire n’est jamais choisie',()=>{
  /* Un rail peut trouver un vrai champignon voisin près d'une prédiction
   * fausse (ici à gauche, +150 mm) : c'est le risque propre au choix par la
   * voie, et la raison pour laquelle les deux rails sont exigés. */
  for(const mm of [150,-100]){
    const capture=captureAt(shifted(truth,mm)),sci=Shadow.scientificProposeBoth(capture);
    assert.ok(!SIDES.every(side=>chooseRail(capture,side,sci,15).ok),`${mm} mm`);
  }
});

test('une session vide rend un bilan vide',()=>{
  const r=studySession({records:[],clouds:[]},'vide');
  assert.equal(r.summary.judged,0);assert.deepEqual(r.rows,[]);
});
