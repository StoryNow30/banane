'use strict';
/* 4.7.15 (D-047) : une reprise depuis la voie devient appui jusqu'à 15 mm de la
 * prédiction (10 mm jusqu'à la 4.7.14). Voisins décalés de 12 mm : la reprise
 * retrouve le rail à 12 mm de la prédiction. Fichier séparé pour tenir le délai. */
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
const anchorAt=(cut,rails)=>({identity:{part:23,cut,frameId:'f'},positions:Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative]))});
const rails=shifted(truth,150),cap=capture(rails),sci=Shadow.scientificProposeBoth(cap),anchors=[anchorAt(104,shifted(truth,12)),anchorAt(103,shifted(truth,12))];

test('curseurs consignés : lot-decision-v3, reprise appui jusqu\'à 15 mm',()=>{
  assert.equal(L.DEFAULTS.version,'lot-decision-v3');assert.equal(L.DEFAULTS.chainMm,15);
  const d=L.decideCut({capture:cap,science:sci,anchors,Shadow});
  assert.equal(d.stage,'window');assert.ok(d.fromPredictionMm>10&&d.fromPredictionMm<=15,String(d.fromPredictionMm));
  assert.equal(d.anchor,true);assert.deepEqual([d.version,d.chainMm,d.pairGuard],['lot-decision-v3',15,true]);
});
test('rejeu d\'un lot antérieur : à 10 mm, la même reprise n\'est pas appui',()=>{
  const d=L.decideCut({capture:cap,science:sci,anchors,Shadow,options:{chainMm:10}});
  assert.equal(d.stage,'window');assert.equal(d.anchor,false);assert.equal(d.chainMm,10);
});
