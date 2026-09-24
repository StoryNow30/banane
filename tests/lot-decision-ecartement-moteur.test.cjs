'use strict';
/* Garde d'écartement voisin sur le moteur : appuis dont le rail droit est à
 * 8 mm de la vérité (continuité tenue, 8 mm ≤ 30) ; à 10 mm la garde laisse
 * passer le premier passage, à 5 mm elle le retire et, la reprise retrouvant le
 * même écartement, le cut est différé : aucune paire n'est tirée vers celui des
 * voisins. Fichier séparé pour tenir le délai. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../src/lot-decision.js'),O=require('../src/continuity-observer.js'),Shadow=require('../src/gcv1-shadow.js');
const {K,base}=require('./fixtures.cjs');
const SIDES=['left','right'];
const capture=(rails,cut=105)=>({identity:{part:23,cut,frameId:'f'},rails,pointsSceneRelative:base.pointsSceneRelative,visibleByClipBoxes:base.pointsSceneRelative.map(()=>true)});
const science0=Shadow.scientificProposeBoth(capture(base.rails));
const truth=Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,d=science0.rails[side].next.delta;
  const w=K.C.point(P,d),o=K.C.point(P,[0,0,0]);return [side,O.translated(r,w.map((v,i)=>v-o[i]))];}));
function shiftedSide(rails,side,mm){const r=rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return {...rails,[side]:O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])};}
const anchorAt=(cut,rails)=>({identity:{part:23,cut,frameId:'f'},positions:Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative]))});
const wide=shiftedSide(truth,'right',8),anchors=[anchorAt(104,wide),anchorAt(103,wide)];
const cap=capture(base.rails),sci=Shadow.scientificProposeBoth(cap);

test('garde à 10 mm : écart de 8 mm toléré, premier passage retenu',()=>{
  const d=L.decideCut({capture:cap,science:sci,anchors,Shadow,options:{gaugeGuardMm:10}});
  assert.equal(d.stage,'first-pass');assert.ok(d.gaugeReference&&d.guardMm<=30);
});
test('garde à 5 mm : premier passage retiré, cut différé sans être tiré vers l\'écartement des voisins',()=>{
  const d=L.decideCut({capture:cap,science:sci,anchors,Shadow,options:{gaugeGuardMm:5}});
  assert.equal(d.stage,'deferred');assert.equal(d.guardDeferred,true);assert.ok(d.gaugeJumpMm>5&&d.gaugeJumpMm<11,String(d.gaugeJumpMm));
  assert.equal(d.positions,undefined);
});
