'use strict';
/* 4.7.20 — §14 I amendé (D-054) : des voisins VALIDÉS par l'opérateur servent
 * d'appuis à la voie, sous garde de cohérence (3 voisins alignés à 8 mm sur les
 * deux rails, ±5 cuts). Rails de départ à 150 mm : le moteur est retiré, aucun
 * appui posé ; trois voisins validés sur la vraie voie reprennent le cut. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const {K,base}=require('./fixtures.cjs');
const SIDES=['left','right'];
const capture=(rails,cut=105)=>({identity:{part:23,cut,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
const science0=Shadow.scientificProposeBoth(capture(base.rails));
const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,d=science0.rails[side].next.delta;
  const w=K.C.point(P,d),o=K.C.point(P,[0,0,0]);return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
function shifted(rails,mm){return Object.fromEntries(SIDES.map(side=>{const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));}
const at=(cut,rails,frameId='f')=>({identity:{part:23,cut,frameId},positions:Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative]))});
const rails=shifted(truth,150),cap=capture(rails),sci=Shadow.scientificProposeBoth(cap);

test('trois voisins validés cohérents : le cut est repris par la voie, consigné',()=>{
  const sans=L.decideCut({capture:cap,science:sci,anchors:[],Shadow});
  assert.notEqual(sans.stage,'window','sans appui, pas de reprise');
  const d=L.decideCut({capture:cap,science:sci,anchors:[],validated:[at(103,truth),at(104,truth),at(106,truth)],Shadow});
  assert.ok(['window','choice'].includes(d.stage),d.stage);assert.deepEqual(d.validatedAnchors.slice().sort(),[103,104,106]);
  assert.ok(d.anchorsUsed.every(c=>[103,104,106].includes(c)));
});

test('un voisin validé incohérent (SKIP faux) est écarté ; deux seuls ne suffisent pas',()=>{
  const faux=at(106,shifted(truth,45));
  assert.deepEqual(L.consistentValidated(cap.identity,rails,[at(103,truth),at(104,truth),at(107,truth),faux]).map(a=>a.identity.cut).sort(),[103,104,107]);
  const d=L.decideCut({capture:cap,science:sci,anchors:[],validated:[at(104,truth),faux],Shadow});
  assert.deepEqual(d.validatedAnchors,[]);assert.notEqual(d.stage,'window');
});

test('autre repère ou autre partie : jamais d’appui validé',()=>{
  assert.deepEqual(L.consistentValidated(cap.identity,rails,[at(103,truth,'g'),at(104,truth,'g'),at(106,truth,'g')]),[]);
  assert.deepEqual(L.consistentValidated({...cap.identity,part:24},rails,[at(103,truth),at(104,truth),at(106,truth)]),[]);
});
