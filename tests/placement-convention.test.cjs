'use strict';
/* Calage de convention — cahier 4.8, amendement n°4.
 *
 * Le moteur pose le gabarit au milieu de la bande de points ; l'opérateur pose
 * le contour en enveloppe. Le calage déplace un rail DÉJÀ publié selon ses
 * propres points : dessus au 90e centile + 1,0 mm, flanc à la médiane − 2,6 mm,
 * aucune correction latérale sous 6 points de flanc. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const Convention=require('../src/placement-convention.js'),Shadow=require('../src/gcv1-shadow.js');
const Gauge=require('../src/gauge.js'),C=require('../vendor/capture-core.js'),Candidate=require('../src/geometry-candidate-v1.js');
const pilot=require('./corpus/pilot-part18-cut6704-partial-flank.json');
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

/* Champignon rectangulaire : dessus z = 0 de u = 0 à 64 mm, flanc côté voie en
 * u = 0 jusqu'à −40 mm. Points : dessus décalé de −3 à +3 mm, flanc de −2 à +2 mm,
 * autour du gabarit posé au delta [0, 10 mm, −5 mm]. */
function capture({topPoints=40,facePoints=11,topSpreadMm=3}={}){
  const contour=[];
  for(let y=0;y<=.064+1e-12;y+=.001)contour.push([0,y,0]);
  for(let z=-.001;z>=-.04-1e-12;z-=.001)contour.push([0,0,z]);
  const bu=.01,bz=-.005,points=[];
  for(let i=0;i<topPoints;i++){const u=.015+i*(.035/Math.max(1,topPoints-1));points.push([0,bu+u,bz+(-topSpreadMm+i*(2*topSpreadMm/Math.max(1,topPoints-1)))/1000]);}
  for(let i=0;i<facePoints;i++){const z=-.012-i*(.02/Math.max(1,facePoints-1));points.push([0,bu+(-2+i*(4/Math.max(1,facePoints-1)))/1000,bz+z]);}
  points.push([0,.15,-.08],[0,-.1,.05]);  // hors des bandes : ignorés
  const rail={positionSceneRelative:[0,0,0],sceneRelativeToProfileLocal:I,profileLocalToSceneRelative:I,profileContours:[{verticesSceneRelative:contour}]};
  return {rails:{left:rail,right:{...rail,positionSceneRelative:[1.44,0,0]}},pointsSceneRelative:points,visibleByClipBoxes:points.map(()=>true)};
}
const raw=[0,.01,-.005];

test('deux constantes, figées et versionnées',()=>{
  assert.ok(Object.isFrozen(Convention.DEFAULTS));
  assert.equal(Convention.DEFAULTS.version,'convention-envelope-v1');
  assert.deepEqual([Convention.DEFAULTS.topOffsetMm,Convention.DEFAULTS.faceOffsetMm,Convention.DEFAULTS.faceFallbackMm],[1.0,-2.6,0]);
  assert.equal(Convention.DEFAULTS.minFacePoints,Candidate.DEFAULTS.minFace,'le repli suit le seuil de flanc du moteur');
  assert.equal(Convention.DEFAULTS.minTopPoints,Candidate.DEFAULTS.minTop);
});

test('dessus au 90e centile + 1,0 mm, flanc à la médiane − 2,6 mm',()=>{
  const r=Convention.calibrate(capture(),'left',raw);
  assert.equal(r.applied,true);assert.equal(r.faceMode,'median');assert.equal(r.topN,40);assert.equal(r.faceN,11);
  const p90=-3+Math.floor(.9*40)*(6/39);
  assert.ok(Math.abs(r.topQuantileMm-p90)<.05);assert.ok(Math.abs(r.dzMm-(p90+1.0))<.05);
  assert.ok(Math.abs(r.faceQuantileMm)<.05);assert.ok(Math.abs(r.duMm-(-2.6))<.05);
  assert.deepEqual(r.rawDelta,raw);
  assert.ok(Math.abs(r.delta[1]-(raw[1]+r.duMm/1000))<1e-12,'u orienté vers le champignon, signe du profil appliqué');
  assert.ok(Math.abs(r.delta[2]-(raw[2]+r.dzMm/1000))<1e-12);assert.equal(r.delta[0],raw[0]);
});

test('sous 6 points de flanc, le dessus est calé mais pas le latéral',()=>{
  const r=Convention.calibrate(capture({facePoints:4}),'left',raw);
  assert.equal(r.applied,true);assert.equal(r.faceMode,'under-observed');assert.equal(r.duMm,0);
  assert.equal(r.delta[1],raw[1]);assert.ok(r.dzMm>0);
});

test('dessus sous-observé : aucun calage, delta intact',()=>{
  const r=Convention.calibrate(capture({topPoints:10}),'left',raw);
  assert.equal(r.applied,false);assert.equal(r.reason,'top-under-observed');assert.deepEqual(r.delta,raw);
});

test('hors du domaine mesuré : aucun calage',()=>{
  const r=Convention.calibrate(capture({topSpreadMm:11}),'left',raw);
  assert.equal(r.applied,false);assert.equal(r.reason,'shift-out-of-domain');assert.deepEqual(r.delta,raw);
});

test('déterministe, et sans autre entrée que la capture et le delta publié',()=>{
  assert.equal(Convention.calibrate.length,3);
  assert.deepEqual(Convention.calibrate(capture(),'left',raw),Convention.calibrate(capture(),'left',raw));
});

test('dans le moteur : appliqué au rail publié, avant la garde d’écartement',()=>{
  Shadow.configure({convention:false});const off=Shadow.scientificProposeBoth(pilot);
  Shadow.configure({convention:true});const on=Shadow.scientificProposeBoth(pilot);
  assert.equal(Shadow.state().convention,true);
  const left=on.rails.left;
  assert.equal(left.conventionCalibration.applied,true);
  assert.deepEqual(left.next.rawDelta,off.rails.left.next.delta,'le delta scientifique reste lisible');
  assert.deepEqual(left.next.delta,left.conventionCalibration.delta);
  // Rail droit hors domaine : publié tel que GCV1 l'a trouvé.
  assert.equal(on.rails.right.conventionCalibration.applied,false);assert.deepEqual(on.rails.right.next.delta,off.rails.right.next.delta);
  const expected=Gauge.predictedGaugeMm(pilot.rails,{left:on.rails.left.next.delta,right:on.rails.right.next.delta},C);
  assert.ok(Math.abs(on.pairGauge.predictedMm-expected)<1e-9,'l’écartement est jugé sur les positions calées');
  const runtime=Shadow.toRuntimeRails(on);
  assert.equal(runtime.left.parameters.convention,'convention-envelope-v1');
  assert.equal(runtime.left.gcv1.convention.applied,true);assert.deepEqual(runtime.left.gcv1.convention.rawDelta,off.rails.left.next.delta);
  assert.deepEqual(runtime.left.delta,on.rails.left.next.delta);
});

test('coupé : strictement le moteur 4.7.5',()=>{
  Shadow.configure({convention:false});
  try{const s=Shadow.scientificProposeBoth(pilot);
    for(const side of ['left','right']){assert.equal(s.rails[side].conventionCalibration,null);assert.equal(s.rails[side].next.rawDelta,undefined);}
    assert.equal(Shadow.toRuntimeRails(s).left.parameters.convention,false);}
  finally{Shadow.configure({convention:true});}
  assert.throws(()=>Shadow.configure({convention:'oui'}),/booléen/);
});

test('un rail non résolu le reste',()=>{
  Shadow.configure({partialFlank:false});
  try{const s=Shadow.scientificProposeBoth(pilot);
    for(const side of ['left','right']){assert.equal(s.rails[side].next.status,'unresolved');assert.equal(s.rails[side].conventionCalibration,null);}}
  finally{Shadow.configure({partialFlank:true});}
});
