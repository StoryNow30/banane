'use strict';
/* CH-062 — outil de mesure tools/ch062-signal-lot.cjs sur un journal SYNTHÉTIQUE : une page, 12 cuts posés (4 s par cut au signal, 6 s au repli) ; lectures au signal jusqu'au cut 5,
 * une requête de points en HTTP 502 juste après, puis le compteur bloqué à 1 et toutes les lectures au repli. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {analyser,gain}=require('../tools/ch062-signal-lot.cjs');
const T0=Date.parse('2026-11-05T08:00:00.000Z'),iso=ms=>new Date(T0+ms).toISOString();
function journal(){const ev=[],page='p1',id=c=>({pageId:page,part:10,cut:c});
 let t=0;
 for(let c=1;c<=12;c++){t+=c<=6?4000:6000;const regle=c<=5?'signal':'stabilite',nl=c<=5?0:1,req='r'+c;
  for(const side of ['left','right']){ev.push({type:'adapter-progress',action:'capture',requestId:req,identity:id(c),timestamp:iso(t),elapsedMs:10,lastStage:'capture-wait',lastDetail:{side,attempt:1}});
   ev.push({type:'adapter-progress',action:'capture',requestId:req,identity:id(c),timestamp:iso(t),elapsedMs:side==='left'?300:600,lastStage:'capture-read',lastDetail:{side,attempt:1,lecture:'rapide',regle,diag:{navS:Math.round(t/1000)+10,nl:[nl,nl],m:regle==='stabilite'?'chargements':undefined}}});
   ev.push({type:'adapter-progress',action:'capture',requestId:req,identity:id(c),timestamp:iso(t),elapsedMs:side==='left'?350:650,lastStage:'capture-view-ready',lastDetail:{side,attempt:1}});}
  ev.push({type:'adapter-result',action:'capture',requestId:req,identity:id(c),timestamp:iso(t+700),demandeA:iso(t),elapsedMs:700,lastDetail:{lecture:'rapide'}});
  ev.push({type:'validation-accepted',identity:id(c),batchId:'lot',timestamp:iso(t+2000)});}
 ev.push({type:'esv-observation',kind:'resource',class:'point-resource',timestamp:iso(5*4000+2500),ept:3,statuts:{200:2,502:1},sansStatut:0,echecs:1,echecsCumules:1});
 ev.push({type:'esv-observation',kind:'resource',class:'point-resource',timestamp:iso(2000),ept:4,statuts:{200:4},sansStatut:0,echecs:0,echecsCumules:0});
 return {events:ev};}
test('outil CH-062 : mort du signal à l’échec, pas de détection sous 8 replis, ligne de base exacte, temps par cut avec et sans signal',()=>{
 const [p]=analyser(journal());
 assert.deepEqual(p.parts,[10]);assert.equal(p.signalLot,5);assert.equal(p.repliLot,7);
 assert.equal(p.cause.echecsPage,1);assert.equal(p.cause.statuts['502'],1);
 assert.ok(p.cause.dernierSignalAvantEchecS>=0&&p.cause.dernierSignalAvantEchecS<=3,'dernier signal juste avant l’échec');
 assert.equal(p.detectionS,null,'7 replis : sous le seuil de 8, pas de détection');
 assert.deepEqual([p.cause.ligneDeBase.vuesRepliApresEchec,p.cause.ligneDeBase.exact,p.cause.ligneDeBase.moins],[14,14,0],'compteur = échecs sur chaque vue au repli');
 assert.equal(p.cause.ligneDeBase.capturesRecuperables,7);
 assert.equal(p.parLecture.signal.mediane,4000);assert.ok(p.parLecture.repli.mediane>p.parLecture.signal.mediane);
 const g=gain([p],{tirages:50});assert.equal(g.pagesTouchees,0);assert.ok(g.ligneDeBase.gainS>0,'la ligne de base gagne sans rechargement');
});
test('outil CH-062 : trou après un échec = captures de la même page sous 30 % de la médiane des 20 d’avant, en série',()=>{
 const {trous}=require('../tools/ch062-signal-lot.cjs');const ev=[];
 const pts=[5000,5100,4900,5000,5050,/* échec */ 0,200,4000,10,0,5000,5000,5000,5000];
 pts.forEach((p,i)=>ev.push({type:'adapter-result',action:'capture',identity:{pageId:'p',cut:100+i},timestamp:iso(i*1000),lastDetail:{points:p}}));
 ev.push({type:'esv-observation',kind:'resource',echecs:1,timestamp:iso(4500)});
 assert.deepEqual(trous({events:ev}),[{mediane:5000,cuts:4,dureeS:5}],'105, 106, 108, 109 troués ; 107 (4 000 points) toléré ; série close par trois captures normales');
});
