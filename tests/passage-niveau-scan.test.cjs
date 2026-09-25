'use strict';
/* Passage à niveau : chaussée au niveau du champignon, ornière côté intérieur.
 * `tools/passage-niveau-scan.cjs` sur deux coupes synthétiques (repère : voie
 * selon x, latéral selon y, hauteur selon z ; rails à y = 0 et y = 1,435). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../tools/passage-niveau-scan.cjs');
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const rail=y=>({positionSceneRelative:[0,y,0],sceneRelativeToProfileLocal:I});
function coupe(hauteur){const pts=[];for(let x=-0.4;x<=0.4;x+=0.04)for(let y=-0.5;y<=1.935;y+=0.004)pts.push([x,y,hauteur(y)]);
  return {rails:{left:rail(0),right:rail(1.435)},pointsSceneRelative:pts};}

test('passage à niveau : chaussée affleurante reconnue, bord de l\'ornière à la face intérieure',()=>{
  /* Ornières de 55 mm, 50 mm de profondeur, qui commencent à 30 mm à l'intérieur de chaque pose. */
  const pn=coupe(y=>(y>=0.030&&y<=0.085)||(y>=1.435-0.085&&y<=1.435-0.030)?-0.05:0);
  const d=P.describe(pn);
  assert.equal(d.levelCrossing,true);assert.ok(d.flushPct>=85,String(d.flushPct));
  assert.equal(d.edges.left.edgeMm,30);assert.equal(d.edges.right.edgeMm,30,'latéral compté vers l\'intérieur pour les deux rails');
});

test('voie courante : ballast 17 cm sous le champignon, pas de passage à niveau',()=>{
  const voie=coupe(y=>(y>=-0.065&&y<=0)||(y>=1.435&&y<=1.5)?0:-0.17);
  const d=P.describe(voie);
  assert.equal(d.levelCrossing,false);assert.ok(d.flushPct<=10,String(d.flushPct));
});

test('synthèse : cuts de passage à niveau, écarts à la pose appliquée ou humaine',()=>{
  const row=(cut,pn,edges)=>({source:'s',cut,outcome:'applied',levelCrossing:pn,edges});
  const s=P.summarize([row(1,true,{left:{edgeMm:30,appliedMinusEdgeMm:2},right:{edgeMm:25,appliedMinusEdgeMm:-4}}),
    row(2,true,{left:{edgeMm:null},right:{edgeMm:30,humanMinusEdgeMm:1}}),row(3,false,{left:{edgeMm:0},right:{edgeMm:0}})]);
  assert.equal(s.levelCrossingCuts,2);assert.equal(s.edgeFound,3);
  assert.deepEqual(s.appliedMinusEdge,{n:2,median:2,absMedian:4,absMax:4});assert.equal(s.humanMinusEdge.n,1);
});
