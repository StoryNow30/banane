/* CONTRAT D'ÉCARTEMENT — frontières, invariance, et identité du calcul.
 *
 * Le contrat métier est : hors contrat sous 1405 mm, tolérance jusqu'à 1430,
 * nominal jusqu'à 1470 inclus, hors contrat au-delà. La comparaison porte sur
 * la valeur numérique, jamais sur un affichage arrondi.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Gauge=require('../src/gauge.js');
const K=require('../src/core.js');
const C=require('../vendor/capture-core.js');

const railAt=p=>({positionSceneRelative:p,profileOriginSceneRelative:p,
  railLocalToSceneRelative:C.multiply(C.translation(p),C.identity()),
  profileLocalToSceneRelative:C.multiply(C.translation(p),C.identity()),
  sceneRelativeToProfileLocal:C.inverse(C.multiply(C.translation(p),C.identity())),
  rotation:[0,0,0,'ZYX'],profileRotation:[0,0,0,'XYZ']});
/* La paire est séparée selon Y : avec des matrices de profil identité, Y est
 * l'axe latéral, comme dans le repère profil réel où delta[1] est le
 * déplacement latéral. */
const pairAt=mm=>({left:railAt([0,0,0]),right:railAt([0,mm/1000,0])});

test('les six frontières exactes du contrat',()=>{
 const cases=[[1404.999,'LOW_INVALID',false],[1405,'TOLERANCE',true],[1429.999,'TOLERANCE',true],
   [1430,'NOMINAL',true],[1470,'NOMINAL',true],[1470.001,'HIGH_INVALID',false]];
 for(const [mm,expected,admissible] of cases){
  assert.equal(Gauge.classifyMm(mm),expected,mm+' mm');
  assert.equal(Gauge.admissible(Gauge.classifyMm(mm)),admissible,mm+' mm admissible ?');
 }
});

test('aucun arrondi d’affichage ne décide de la classe',()=>{
 /* 1470,0004 s’afficherait « 1470,0 mm » et serait pourtant hors contrat. */
 assert.equal(Gauge.classifyMm(1470.0004),'HIGH_INVALID');
 assert.equal(Number(1470.0004.toFixed(1)),1470,'l’affichage arrondi, lui, vaut 1470');
 assert.equal(Gauge.classifyMm(1404.9996),'LOW_INVALID');
 assert.equal(Gauge.classifyMm(1405-Number.EPSILON*1405),'LOW_INVALID');
 // une mesure non finie n’est pas une classe du contrat, et n’est pas admissible
 for(const v of [NaN,Infinity,null,undefined,'1440'])assert.equal(Gauge.classifyMm(v),'INDETERMINATE');
 assert.equal(Gauge.admissible('INDETERMINATE'),false);
});

test('la mesure est invariante par translation globale, échange des rails et changement de repère',()=>{
 const rails=pairAt(1443.7);
 const base=Gauge.gaugeMmOf(rails,C);
 assert.ok(Math.abs(base-1443.7)<1e-9,'mesure de référence : '+base);
 // translation globale
 const T=C.translation([12.5,-3.25,0.75]);
 const moved={left:{...rails.left,positionSceneRelative:C.point(T,rails.left.positionSceneRelative)},
   right:{...rails.right,positionSceneRelative:C.point(T,rails.right.positionSceneRelative)}};
 assert.ok(Math.abs(Gauge.gaugeMmOf(moved,C)-base)<1e-9);
 // échange gauche/droite
 assert.equal(Gauge.gaugeMmOf({left:rails.right,right:rails.left},C),base);// symétrie exacte
 // rotation du repère de scène : la paire ne bouge pas physiquement
 const cos=Math.cos(1.3641),sin=Math.sin(1.3641);
 const R=[cos,sin,0,0,-sin,cos,0,0,0,0,1,0,0,0,0,1];
 const turned={left:{...rails.left,positionSceneRelative:C.point(R,rails.left.positionSceneRelative)},
   right:{...rails.right,positionSceneRelative:C.point(R,rails.right.positionSceneRelative)}};
 assert.ok(Math.abs(Gauge.gaugeMmOf(turned,C)-base)<1e-9);
});

test('l’écartement prévu est celui de expectedPoses, et ignore l’état AVANT comme critère',()=>{
 const rails=pairAt(1500);
 const deltas={left:[0,0.03,0.004],right:[0,-0.03,-0.001]};// referme la paire de 60 mm : 1500,0 -> 1440,0
 const viaCore=Gauge.gaugeMmOf(K.expectedPoses({rails},{left:{delta:deltas.left},right:{delta:deltas.right}}),C);
 const direct=Gauge.predictedGaugeMm(rails,deltas,C);
 assert.ok(Math.abs(viaCore-direct)<1e-9,`expectedPoses ${viaCore} vs calcul direct ${direct}`);
 // l’AVANT est hors contrat, l’APRÈS est nominal : seul l’APRÈS décide
 const report=Gauge.assessPair(rails,deltas,C);
 assert.equal(Gauge.classifyMm(report.beforeMm),'HIGH_INVALID');
 assert.equal(report.gaugeClass,'NOMINAL');
 assert.equal(report.admissible,true);
 assert.equal(report.measurable,true);
});

test('une paire dont l’écartement n’est pas mesurable est déclarée non mesurable, pas hors contrat',()=>{
 const report=Gauge.assessPair({left:{profileLocalToSceneRelative:C.identity()},right:{profileLocalToSceneRelative:C.identity()}},
   {left:[0,0,0],right:[0,0,0]},C);
 assert.equal(report.measurable,false);
 assert.equal(report.gaugeClass,'INDETERMINATE');
});
