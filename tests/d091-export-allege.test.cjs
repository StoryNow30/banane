'use strict';
/* D-091 (4.9.0.9) : allègement A des exports (mode « allege » de src/native-export.js), validé par la direction le
 * 13 octobre. Retire seulement les sondes sans information (nœud sans point retenu, aucune sonde dans la zone) et
 * arrondit les points au micromètre (écart ≤ 0,5 µm ; précision d'ESV : 61 µm au mieux). Ne modifie jamais le nuage
 * stocké ; le nuage allégé le dit. Mesure sur le lot de 112 cuts de la 4.9.0.8 : corpus 21,7 → 12,1 Mo compressés
 * (−44 %), 2 711 nœuds allégés, touches de zone des sondes inchangées (357), aucun autre champ modifié. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const X=require('../src/native-export.js'),S=require('../src/settings.js');
const gele=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(gele);}return o;};
const nuage=(nodes,points=[[3481.5495554931695,1086.1717523196712,25.628759189648463],[-0.12345649999,0,1e-7]])=>
  ({format:'banane-lidar-capture-v1',captureId:'c',nodes,pointsSceneRelative:points,pointSources:points.map((_,i)=>[0,i]),
    attributes:{intensity:points.map(()=>7)},nearest:1});

test('réglage livré : allègement actif, affiché dans le panneau ; « complet » reste le repli du code',()=>{
  assert.equal(S.export.mode,'allege');assert.equal(X.MODE_DEFAUT,'complet');assert.equal(X.exportMode('allege').nuage,X.alleger);
  const l=S.describe().find(x=>x.nom==='Allègement des nuages');assert.ok(l);assert.match(l.valeur,/^actif/);assert.match(l.pourquoi,/D-091/);
});

test('sondes retirées seulement d’un nœud sans point retenu dont aucune sonde ne touche la zone',()=>{
  const sonde=(roiHit,hierarchyRoiHit)=>({sourceIndex:0,roiHit,...(hierarchyRoiHit===undefined?{}:{hierarchyRoiHit})});
  const c=gele(nuage([
    {id:'a',retained:0,probes:[sonde({left:false,right:false})],nearestToRailOrigin:{left:null}},
    {id:'b',retained:0,probes:[sonde({left:false,right:true})]},
    {id:'c',retained:0,probes:[sonde({left:false},{right:true})]},
    {id:'d',retained:0,probes:[sonde(true)]},
    {id:'e',retained:3,probes:[sonde({left:false})]},
    {id:'f',probes:[sonde({left:false})]},
    {id:'g',retained:'0',probes:[]},
    {id:'h',retained:0}]));
  const a=X.alleger(c);
  assert.deepEqual(a.nodes.map(n=>[n.id,'probes' in n]),[['a',false],['b',true],['c',true],['d',true],['e',true],['f',true],['g',true],['h',false]]);
  assert.deepEqual(a.nodes[0],{id:'a',retained:0,nearestToRailOrigin:{left:null}},'le reste du nœud est gardé, nearestToRailOrigin compris');
  assert.equal(a.exportLightening.probesRemovedFromNodes,1);
});

test('points arrondis au micromètre, écart ≤ 0,5 µm, rien d’autre ne change, le nuage stocké reste intact',()=>{
  let graine=7;const hasard=()=>{graine=(Math.imul(graine,1664525)+1013904223)>>>0;return graine/4294967296;};
  const pts=Array.from({length:4000},(_,i)=>[(hasard()-.5)*8000,(hasard()-.5)*2,i%2?Math.fround(hasard()*30):-hasard()]);
  const c=gele(nuage([],pts)),avant=JSON.stringify(c),a=X.alleger(c);
  assert.equal(JSON.stringify(c),avant);
  let ecart=0;pts.forEach((p,i)=>p.forEach((v,k)=>{ecart=Math.max(ecart,Math.abs(v-a.pointsSceneRelative[i][k]));
    assert.equal(Math.round(a.pointsSceneRelative[i][k]*1e6),Math.round(v*1e6));}));
  assert.ok(ecart<=5.0001e-7,`écart ${ecart}`);
  for(const k of ['pointSources','attributes','format','captureId','nodes'])assert.deepEqual(a[k],c[k],k);
  assert.deepEqual(a.exportLightening,{mode:'allege',decision:'D-091',pointsRoundedToMetres:1e-6,maxRoundingErrorMetres:5e-7,roundedPoints:4000,
    probesRemovedFromNodes:0,probesRule:'retained === 0 et aucune sonde roiHit ni hierarchyRoiHit'});
  assert.deepEqual(X.alleger(a).pointsSceneRelative,a.pointsSceneRelative,'un second passage ne change plus rien');
  assert.ok(JSON.stringify(a.pointsSceneRelative).length<JSON.stringify(pts).length*0.7,'plus court à l’écriture');
});

test('valeurs non numériques gardées ; nuage sans rien à alléger ou non objet : rendu tel quel, sans marque',()=>{
  const a=X.alleger(nuage([],[[1.23456789,null,'x'],'pas-un-point',[Infinity,NaN,-0.0000004]]));
  assert.deepEqual(a.pointsSceneRelative,[[1.234568,null,'x'],'pas-un-point',[Infinity,NaN,-0]]);assert.equal(a.exportLightening.roundedPoints,2);
  const vide={format:'banane-native-lidar-chunk-v1',captureId:'z'};assert.equal(X.alleger(vide),vide);
  assert.equal(X.alleger(null),null);assert.equal(X.alleger('x'),'x');
  const plein=nuage([{id:'n',retained:2,probes:[]}],[]);assert.equal(X.alleger(plein),plein,'ni sonde à retirer ni point : même objet');
});
