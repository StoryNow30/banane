'use strict';
/* CH-060 — outil de décomposition du temps de la relecture (tools/ch060-relecture-temps.cjs), sur un journal FABRIQUÉ : deux cuts relus, leurs
 * captures (étapes de la page), une relecture-debut avec une zone d'ADV et un hors-plafond. Vérifie la découpe (navigation, avant capture,
 * sélection, attente, lecture, transfert, calcul, entre deux cuts), le rapprochement d'une capture par l'heure de sa demande (l'identité des étapes est
 * en retard d'un cut), la distance au cœur de l'ADV et le volume. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/ch060-relecture-temps.cjs');
const iso=ms=>new Date(Date.UTC(2026,10,5,8,0,0)+ms).toISOString();
function capture(id,demandeMs,{regle='signal',lecture='rapide',cutEnRetard=0}={}){
 const p=(el,st,d)=>({type:'adapter-progress',action:'capture',requestId:id,identity:{part:4,cut:cutEnRetard},timestamp:iso(demandeMs+el),elapsedMs:el,lastStage:st,lastDetail:d});
 return [p(1,'received',{}),p(20,'capture-wait',{side:'left',attempt:1}),p(1020,'capture-read',{side:'left',lecture,regle,diag:{nc:2,m:regle==='signal'?undefined:'chargements'}}),
  p(1025,'capture-view-ready',{side:'left'}),p(1030,'capture-wait',{side:'right',attempt:1}),p(1330,'capture-read',{side:'right',lecture,regle,diag:{}}),p(1332,'capture-view-ready',{side:'right'}),
  p(1333,'capture-ready',{nodes:30,points:3000}),
  {type:'adapter-result',action:'capture',requestId:id,identity:{part:4,cut:cutEnRetard},timestamp:iso(demandeMs+1340),demandeA:iso(demandeMs),elapsedMs:1335}];}
function journal(){const ev=[];
 ev.push({type:'relecture-debut',lotId:'L',timestamp:iso(-10),zones:{adv:[[40,100],[40,104]]},horsPlafond:[{debut:300,fin:302,libelle:'cut isolé 300–302'}]});
 /* cut 70 : navigation 0–30 ms, capture demandée à 40 ms, journal à 1 450 ms ; cut 75 : navigation dès 1 452 ms. */
 ev.push(...capture('a',40,{cutEnRetard:69}));
 ev.push({type:'relecture-ombre',lotId:'L',timestamp:iso(1450),identity:{part:4,cut:70},zone:'adv',role:'vert',plage:'ADV 40–104',arrivee:'pas',chemins:['pas'],action:'corrige',verdict:'je corrigerais',critere:{corriger:true},
  durees:{navigationMs:30,captureMs:1360,calculMs:50,totalMs:1450}});
 ev.push(...capture('b',1452+25,{regle:'stabilite',cutEnRetard:70}));
 ev.push({type:'relecture-ombre',lotId:'L',timestamp:iso(1452+1500),identity:{part:4,cut:75},zone:'adv',role:'vert',plage:'ADV 40–104',arrivee:'pas',chemins:['pas'],action:'visite',verdict:'je laisserais',critere:{corriger:false},
  durees:{navigationMs:25,captureMs:1400,calculMs:75,totalMs:1500}});
 ev.push({type:'validation-accepted',batchId:'L',identity:{part:4,cut:72}});
 return {events:ev};}

test('découpe d’un cut relu : postes, capture reliée par l’heure, entre deux cuts',()=>{
 const {cuts}=T.analyser(journal());assert.equal(cuts.length,2);
 const [a,b]=cuts;
 assert.equal(a.cut,70);assert.equal(a.navigationMs,30);assert.equal(a.avantCaptureMs,10,'demande à 40 ms, navigation finie à 30 ms');
 assert.deepEqual(a.rails.left,{selectionMs:20,attenteMs:1000,lectureMs:5});assert.deepEqual(a.rails.right,{selectionMs:5,attenteMs:300,lectureMs:2});
 assert.equal(a.capturePageMs,1333);assert.equal(a.transfertMs,1360-10-1333);assert.equal(a.entreMs,2,'le cut suivant part 2 ms après le journal');
 assert.equal(a.lecture,'rapide');assert.deepEqual(a.regles,['signal','signal']);assert.equal(b.regles[0],'stabilite');
 const agr=T.agreger(cuts)[4];assert.equal(agr.tous.n,2);assert.equal(agr.parRegle.signal.n,1);assert.equal(agr.parRegle.stabilite.n,1);
 assert.ok(agr.tous.postes.attenteG.part>50,'l’attente du rail gauche domine');
});
test('volume : distance au cœur de l’ADV (marges de 30), distance au lot, hors plafond',()=>{
 const v=T.volume(journal()),relus=v.filter(x=>!x.horsPlafond);
 assert.equal(relus.find(x=>x.cut===70).distAdv,0,'70 est dans le cœur 70–74');assert.equal(relus.find(x=>x.cut===75).distAdv,1);
 assert.equal(relus.find(x=>x.cut===70).distLot,2);assert.equal(relus.find(x=>x.cut===70).motif,'adv');
 const h=v.find(x=>x.horsPlafond);assert.equal(h.motif,'isole');assert.equal(h.cuts,3);
 const a=T.agregerVolume(v);assert.equal(a.adv.parDistanceAuCoeur['0 (cœur)'].corriges,1);assert.equal(a.adv.parDistanceAuCoeur['01-05'].relus,1);
 assert.equal(a.horsPlafond.isole.plages,1);
 assert.equal(JSON.stringify(a).includes('"L"'),false,'aucun identifiant de lot recopié');
});
