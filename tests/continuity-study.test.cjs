'use strict';
/* Étude hors ligne de continuité de voie (cahier 4.8, amendement n°3 §3.4) :
 * la prédiction par les voisins est une droite des moindres carrés évaluée au cut. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {linearPrediction}=require('../tools/continuity-study.cjs');

test('la position prédite est l’ordonnée à l’abscisse du cut',()=>{
  assert.ok(Math.abs(linearPrediction([[-2,.10],[-1,.11],[1,.13],[2,.14]])-.12)<1e-12,'voisins des deux côtés');
  assert.ok(Math.abs(linearPrediction([[-3,.07],[-2,.08],[-1,.09]])-.10)<1e-12,'voisins précédents seuls : extrapolation');
});

test('des voisins alignés sur une même abscisse donnent leur moyenne',()=>{
  assert.equal(linearPrediction([[1,.2],[1,.4]]),.30000000000000004);
});
