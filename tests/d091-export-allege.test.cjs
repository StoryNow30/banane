'use strict';
/* D-091 (4.9.0.9) : allègement A des exports (mode « allege » de src/native-export.js), validé par la direction le
 * 13 octobre. Retire seulement les sondes sans information (nœud sans point retenu, aucune sonde dans la zone). Les points
 * restent au bit près : l'arrondi au micromètre d'abord prévu faisait échouer le rejeu exact d'acceptance-report (9 cuts
 * sur 112 à 0,3 µm, relecture indépendante). Ne modifie jamais le nuage stocké ; le nuage allégé le dit. Mesure sur le lot de
 * 112 cuts de la 4.9.0.8 : corpus 21,7 → 14,6 Mo compressés (−33 %), 2 711 nœuds allégés, touches de zone des sondes
 * inchangées (357), aucun autre champ modifié, rejeu du lot fidèle sur 112 cuts sur 112. */
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

test('points, intensité, classe, sources : au bit près ; le nuage stocké reste intact ; la marque dit ce qui est retiré',()=>{
  const pts=[[3481.5495554931695,1086.1717523196712,25.628759189648463],[-0.12345649999,0,1e-7]];
  const c=gele(nuage([{id:'v',retained:0,probes:[{sourceIndex:0,roiHit:{left:false}}]}],pts)),avant=JSON.stringify(c),a=X.alleger(c);
  assert.equal(JSON.stringify(c),avant);assert.notEqual(a,c);
  for(const k of ['pointsSceneRelative','pointSources','attributes','format','captureId','nearest'])assert.equal(a[k],c[k],k+' : même valeur, non recopiée');
  assert.equal(JSON.stringify(a.pointsSceneRelative),JSON.stringify(pts),'17 chiffres gardés');
  assert.deepEqual(a.exportLightening,{mode:'allege',decision:'D-091',probesRemovedFromNodes:1,
    probesRule:'retained === 0 et aucune sonde roiHit ni hierarchyRoiHit',pointsUnchanged:true});
  assert.equal(X.alleger(a),a,'un second passage ne retire plus rien');
});

test('nuage sans nœud, sans rien à alléger ou non objet : rendu tel quel, sans marque',()=>{
  const vide={format:'banane-native-lidar-chunk-v1',captureId:'z',pointsSceneRelative:[[1.23456789,2,3]]};assert.equal(X.alleger(vide),vide);
  assert.equal(X.alleger(null),null);assert.equal(X.alleger('x'),'x');
  const plein=nuage([{id:'n',retained:2,probes:[]}]);assert.equal(X.alleger(plein),plein,'aucune sonde à retirer : même objet');
});
