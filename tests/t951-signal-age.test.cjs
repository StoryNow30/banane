'use strict';
/* 4.9.5.1 (D-109) : `tools/signal-age.cjs` range les lectures au signal par page ESV et par tranche de
 * 5 min d'âge de la page, et dit la condition manquante dominante au repli. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/signal-age.cjs');
const T0=Date.UTC(2026,9,15,8);
function lecture(page,s,regle,{diag,lecture='rapide',attempt=1,cut=100}={}){
 return {type:'adapter-progress',action:'capture',timestamp:new Date(T0+s*1000).toISOString(),identity:{pageId:page,part:27,cut},requestId:'r'+s,
  lastStage:'capture-read',lastDetail:{side:'left',attempt,lecture,regle,...(diag?{diag}:{})}};}

test('export d’avant la 4.9.5.1 : âge depuis la première action sur la page, rapides de première tentative seulement',()=>{
 const ev=[{type:'batch',timestamp:new Date(T0).toISOString(),identity:{pageId:'A'}},
  lecture('A',10,'signal'),lecture('A',200,'signal'),lecture('A',400,'signal'),lecture('A',700,'stabilite'),lecture('A',710,'stabilite'),
  lecture('A',720,'stabilite',{lecture:'reference'}),lecture('A',730,'stabilite',{attempt:2}),
  lecture('B',1000,'signal')];
 const r=T.analyser(ev);
 assert.equal(r.lectures,6,'référence et relecture exclues');
 assert.deepEqual(r.tranches.map(t=>[t.minutes,t.signal,t.repli]),[[0,3,0],[5,1,0],[10,0,2]],'page B : âge 0 (sa propre première action)');
 const a=r.pages.find(p=>p.page==='A');assert.deepEqual(a.tranches.map(t=>[t.minutes,t.partSignal]),[[0,1],[5,1],[10,0]]);
 assert.equal(a.ageSource,'journal');assert.equal(r.dominante,null);
 assert.match(T.toMarkdown(r),/non consignée \(export d’avant la 4\.9\.5\.1\)/);
});

test('4.9.5.1 : âge de la page lu dans le diagnostic, condition manquante dominante, chargements en cours à la fin',()=>{
 const d=(navS,m,nl)=>({navS,ageS:navS,img:9,nl,paires:8,pc:m==='chargements'?8:0,nc:0,vc:0,noeuds:40,lruPts:2e6,memMo:900,...(m?{m}:{})});
 const ev=[lecture('A',0,'signal',{diag:d(30,undefined,[0,4])}),lecture('A',1,'signal',{diag:d(290,undefined,[0,2])}),
  lecture('A',2,'stabilite',{diag:d(650,'chargements',[1,3])}),lecture('A',3,'stabilite',{diag:d(660,'chargements',[2,5])}),
  lecture('A',4,'stabilite',{diag:d(670,'vue',[0,1])}),lecture('A',5,'stabilite',{diag:d(680,'hors-signal',[0,null])})];
 const r=T.analyser(ev);
 assert.equal(r.lectures,5,'« hors-signal » exclu');assert.equal(r.avecDiagnostic,5);
 assert.deepEqual(r.tranches.map(t=>[t.minutes,t.signal,t.repli]),[[0,2,0],[10,0,3]]);
 const t10=r.tranches[1];assert.equal(t10.dominante,'chargements');assert.deepEqual(t10.conditions,{chargements:2,vue:1});
 assert.equal(t10.replisChargementFinal,2);assert.equal(t10.chargementsMaxMedian,3);
 assert.equal(r.pages[0].ageSource,'page');
 const md=T.toMarkdown(r);assert.match(md,/\|  10 à 15 min \| 3 \| 0 \| 3 \| 0 % \| chargements \| 2 \/ 3 \|/);
 assert.match(md,/condition manquante dominante au repli : chargements \(chargements 2, vue 1\)/);
});

test('un F5 donne une nouvelle page : ses lectures repartent de l’âge 0',()=>{
 const ev=[lecture('A',0,'signal',{diag:{navS:800}}),lecture('B',1,'signal',{diag:{navS:20}})];
 const r=T.analyser(ev);assert.deepEqual(r.pages.map(p=>[p.page,p.tranches[0].minutes]),[['A',10],['B',0]]);
});
