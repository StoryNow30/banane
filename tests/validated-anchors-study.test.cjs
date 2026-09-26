'use strict';
/* Étude « appuis validés » : choix des voisins hors du lot, repère, filtre des
 * voisins retouchés à la relecture. Données synthétiques, sans moteur. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../tools/validated-anchors-study.cjs');
const {pair,visit,relecture}=require('./helpers/acceptance-lot.cjs');
const P=21,T=[1000,-2000,50];
test('voisins hors du lot, ramenés dans le repère du Pilote ; --stables écarte les voisins retouchés',()=>{
  const records=[visit(P,99,{before:pair(99,{},T)}),visit(P,100,{before:pair(100,{},T)}),visit(P,101,{before:pair(101,{left:[40,0]},T)})];
  records[2].stateTransitions=[{effect:{kind:'rail-state-changed'}}];     // 101 corrigé à la relecture
  const lot={relecture:relecture(records)},analysed={batch:{part:P},rows:[{cut:100,frameId:'cadre-pilote'}],relecture:{frame:{translationSceneUnits:T}}};
  const all=V.validatedNeighbours(lot,analysed);
  assert.deepEqual(all.map(a=>a.identity.cut),[99,101]);                    // 100 est dans le lot
  assert.equal(all[0].identity.frameId,'cadre-pilote');
  assert.deepEqual(all[0].positions.left,pair(99).left.positionSceneRelative); // translation retirée
  assert.deepEqual(V.validatedNeighbours(lot,analysed,{stables:true}).map(a=>a.identity.cut),[99]);
});
test('garde : un voisin incohérent avec les autres est écarté ; moins de 3 voisins cohérents, aucun appui',()=>{
  const id={part:P,cut:100,frameId:'f'},rails=pair(100);
  const anchor=(cut,d={})=>({identity:{part:P,cut,frameId:'f'},positions:Object.fromEntries(['left','right'].map(s=>[s,pair(cut,d)[s].positionSceneRelative]))});
  const aligned=[97,98,99,101,102].map(c=>anchor(c)),faux=anchor(103,{left:[40,0]});
  const kept=V.consistentAnchors(id,rails,[...aligned,faux]).map(a=>a.identity.cut);
  assert.deepEqual(kept.sort((a,b)=>a-b),[97,98,99,101,102]);
  assert.deepEqual(V.consistentAnchors(id,rails,[anchor(99),anchor(101)]),[]);          // deux voisins : incontrôlables
  assert.deepEqual(V.consistentAnchors(id,rails,[anchor(99),anchor(101,{left:[40,0]}),anchor(102,{right:[0,-30]})]),[]);
  assert.deepEqual(V.consistentAnchors({...id,frameId:'autre'},rails,aligned),[]);     // autre repère
});
test('lot sans journal (partie 9, 4.7.18) : la partie est lue sur les cuts du lot',()=>{
  const records=[visit(P,99,{before:pair(99,{},T)}),visit(P,100,{before:pair(100,{},T)})];
  const lot={relecture:relecture(records)},analysed={batch:null,rows:[{part:P,cut:100,frameId:'cadre-pilote'}],relecture:{frame:{translationSceneUnits:T}}};
  assert.deepEqual(V.validatedNeighbours(lot,analysed).map(a=>[a.identity.part,a.identity.cut]),[[P,99]]);
});
