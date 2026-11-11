'use strict';
/* CH-107 — UNE capture vide, sa relecture pleine (ESV finissait de charger) : le cut est jugé sur la capture PLEINE, mais il n'est jamais corrigé ;
 * deux cuts vides isolés (sous le seuil de 3) n'arrêtent pas la relecture. Service worker réel, ESV simulé. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotVide}=require('./helpers/relecture-points-vides.cjs');

test('capture vide puis pleine au cut 114 : calcul sur la pleine, correction écartée ; 113 vide isolé : pas de pause, rien de rechargé',async()=>{
 const {b,adapter}=await lotVide({vides:[]});
 /* 114 : la première capture est vide, la seconde pleine. 113 vide (deux captures), 114 non vide : la série est rompue. */
 const capture=adapter.capture.bind(adapter);let n114=0;
 adapter.capture=async e=>{const d=await capture(e);if(adapter.identity.cut===114&&adapter.apresLot&&++n114===1){d.pointsSceneRelative=[];d.visibleByClipBoxes=[];d.quality={...d.quality,retained:0,perRail:{left:0,right:0}};}return d;};
 adapter.sansPoints.add(113);
 const fin=await H.finPasse(b,60000);
 assert.equal(fin.etat,'finie',fin.message);assert.equal(adapter.rechargements,0);assert.equal(H.evenements(b,'relecture-pause').length,0);
 const de=c=>H.evenements(b,'relecture-ombre').find(e=>e.identity.cut===c);
 assert.equal(n114,2,'114 capturé deux fois');
 assert.deepEqual(de(114).skipOmbre,{raison:null,points:{left:0,right:0},captures:2,capturesVides:1});
 assert.equal(de(114).critere.corriger,true,'la règle aurait corrigé (calcul sur la capture pleine)');
 assert.equal(de(114).action,'visite');assert.match(de(114).raisonAction,/capture sans point/);
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109,115],'114 jamais corrigé ; 115 (plein) l’est');
});
