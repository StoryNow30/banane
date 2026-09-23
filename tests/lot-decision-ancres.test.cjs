'use strict';
/* Décision sur le lot : reprise par la voie et ses limites (amendement n°9,
 * D-039, KI-047). Cas des ancres fausses, dans son propre fichier pour tenir le délai. */
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
const lateralMm=(rails,positions,ref)=>Math.max(...SIDES.map(s=>{const m=rails[s].sceneRelativeToProfileLocal,a=K.C.point(m,positions[s]),h=K.C.point(m,ref[s].positionSceneRelative);return Math.abs(a[1]-h[1])*1000;}));

test('voisins faux sans structure parallèle à leur écart : jamais de paire fausse',()=>{
  for(const [esv,mm] of [[150,-150],[0,100]]){
    const rails=shifted(truth,esv),cap=capture(rails),sci=Shadow.scientificProposeBoth(cap),wrong=shifted(truth,mm);
    const d=L.decideCut({capture:cap,science:sci,anchors:[anchorAt(104,wrong),anchorAt(103,wrong)],Shadow});
    if(d.positions&&d.stage!=='first-pass')assert.ok(lateralMm(rails,d.positions,truth)<=10,`ESV ${esv}, ancres ${mm} : ${d.stage}`);
  }
});

