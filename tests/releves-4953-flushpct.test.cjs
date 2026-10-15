'use strict';
/* 4.9.5.3 (S6) — `flushPct` du lecteur du passage à niveau consigné à CHAQUE cut (avant : seulement quand la lecture dépassait 50 %).
 * Relevé seul : la décision (stade, appui, positions, motif) est la même avec et sans lui. Coupe synthétique de
 * tests/lot-decision-passage-niveau.test.cjs (voie courante : chaussée sous le champignon ; passage à niveau : au ras). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../vendor/capture-core.js'),L=require('../src/lot-decision.js');
const SIDES=['left','right'],Y={left:0,right:1.495};
const rail=y=>{const P=C.translation([0,y,0]);return {positionSceneRelative:[0,y,0],profileOriginSceneRelative:[0,y,0],railLocalToSceneRelative:P,profileLocalToSceneRelative:P,sceneRelativeToProfileLocal:C.inverse(P)};};
function coupe(cut,hauteur){const pts=[];for(let x=-0.4;x<=0.4;x+=0.04)for(let y=-0.5;y<=1.995;y+=0.004)pts.push([x,y,hauteur(y)]);
 return {identity:{part:9,cut,frameId:'f'},rails:{left:rail(Y.left),right:rail(Y.right)},pointsSceneRelative:pts,visibleByClipBoxes:pts.map(()=>true)};}
const orniere=y=>(y>=0.030&&y<=0.085)||(y>=1.495-0.085&&y<=1.495-0.030)?-0.05:0,voieCourante=y=>(y>=-0.065&&y<=0)||(y>=1.495&&y<=1.56)?0:-0.17;
const science=inward=>({rails:Object.fromEntries(SIDES.map(s=>[s,{ok:true,next:{status:'candidate',delta:[0,(s==='left'?1:-1)*inward,0]}}])),summary:{}});
const abstenu={scientificProposeBoth:()=>({rails:{left:{ok:false},right:{ok:false}},summary:{}})};
const decide=(capture,sci,anchors=[],options)=>L.decideCut({capture,science:sci,anchors,Shadow:abstenu,...(options?{options}:{})});

test('flushPct consigné sur une voie courante (sous 50 %) comme sur un passage à niveau (au-dessus)', () => {
 const voie=decide(coupe(10,voieCourante),science(0.03)),pn=decide(coupe(10,orniere),science(0.03));
 assert.ok(Number.isFinite(voie.flushPct)&&voie.flushPct<50,'voie courante : '+voie.flushPct);
 assert.ok(Number.isFinite(pn.flushPct)&&pn.flushPct>=50,'passage à niveau : '+pn.flushPct);
 assert.equal(voie.levelCrossing,undefined,'avant comme après : pas de bloc levelCrossing hors passage à niveau');assert.ok(pn.levelCrossing,'bloc levelCrossing au passage à niveau');
 assert.equal(pn.levelCrossing.flushPct,pn.flushPct);
});

test('flushPct : cut sans point utile = null ; lecteur coupé (crossing:false) = absent ; réglage coupé = absent', () => {
 const vide=coupe(10,voieCourante);vide.pointsSceneRelative=[];vide.visibleByClipBoxes=[];
 assert.equal(decide(vide,science(0.03)).flushPct,null);
 assert.ok(!('flushPct' in decide(coupe(10,voieCourante),science(0.03),[],{crossing:false})));
 const S=globalThis.BananeSettings;globalThis.BananeSettings={releves:{flushPct:false}};
 try{assert.ok(!('flushPct' in decide(coupe(10,voieCourante),science(0.03))));}finally{globalThis.BananeSettings=S;}
});

test('la décision est la même avec et sans le relevé (hors la clé flushPct)', () => {
 for(const h of [voieCourante,orniere])for(const inward of [0.03,0.045]){
  const a=decide(coupe(10,h),science(inward)),S=globalThis.BananeSettings;globalThis.BananeSettings={releves:{flushPct:false}};
  let b;try{b=decide(coupe(10,h),science(inward));}finally{globalThis.BananeSettings=S;}
  const {flushPct,...sans}=a;assert.deepEqual(JSON.parse(JSON.stringify(b)),JSON.parse(JSON.stringify(sans)));}
 assert.equal(L.crossingOf(coupe(10,voieCourante),{...L.DEFAULTS}),null,'crossingOf rend toujours null hors passage à niveau');
 assert.ok(L.crossingOf(coupe(10,orniere),{...L.DEFAULTS}).crossing);
});
