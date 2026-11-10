'use strict';
/* CH-097, défaut 3 — ALERTES DE LA FILE : `alertes` lisait `resume.ecritsPasse` et `resume.refus`, que le service worker (`fileResume`) ne fournit
 * jamais ({traites, poses, differes, main}). L'alerte « refus » ne pouvait pas sortir et l'alerte « différés » comptait des différés bruts, sans
 * retrancher ce que la deuxième passe a écrit. Les deux nombres existent déjà dans la partie : `passe.ecrits` (événement `passe-fin`) et les
 * corrections refusées par la page pendant la relecture (`refusees` de l'événement `relecture-fin`, jusqu'ici jeté). Alertes non bloquantes :
 * aucune décision ne change. Machine à états pure, aucune donnée d'ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../src/file-parties.js');
const at='2026-11-10T10:00:00.000Z';
const SEL={status:'ok',current:23,parts:[22,23,24,25,26].map(part=>({part,label:'Part '+part,current:part===23}))};
/* Le résumé tel que le service worker le fabrique (background.js `fileResume`). */
const resume=(traites,differes)=>({traites,poses:traites-differes,differes,main:0});
function unePartie(e,lotId,{differes=10,ecrits=0,refusees=0,corriges=0}={}){const part=e.partie.part;
 e=F.transition(e,{type:'lot-demarre',lotId,part,at}).etat;
 e=F.transition(e,{type:'lot-fin',lotId,motif:'fin-normale',issue:'fin-normale',resume:resume(100,differes),at}).etat;
 e=F.transition(e,{type:'passe-fin',lotId,issue:'finie',ecrits,at}).etat;
 return F.transition(e,{type:'relecture-fin',lotId,issue:'fin',corriges,refusees,faits:100,mode:'corriger',at});}
const file=n=>F.transition(null,{type:'demarrer',id:'f1',n,selecteur:SEL,courante:23,lotArgs:{},at}).etat;

test('refus de la page pendant la relecture : l’alerte « refus » sort au bilan de la partie, la file continue',()=>{
 const r=unePartie(file(2),'L1',{refusees:2});
 assert.equal(r.etat.etat,'changement','la file continue');
 assert.equal(r.etat.bilan[0].relecture.refusees,2,'le nombre de refus est gardé avec la relecture');
 assert.deepEqual(r.etat.bilan[0].alertes.map(x=>[x.code,x.texte]),[['refus','2 refus de la page']]);});

test('aucun refus : pas d’alerte ; refus absent de l’événement (ancien état gardé) : pas d’alerte non plus',()=>{
 assert.deepEqual(unePartie(file(2),'L1',{refusees:0}).etat.bilan[0].alertes,[]);
 assert.deepEqual(F.alertes({resume:resume(100,10),relecture:{issue:'fin',corriges:0,faits:100}},[]),[]);});

test('différés : les cuts écrits par la deuxième passe sont retranchés (partie courante et médiane des précédentes)',()=>{
 const prec=[{resume:resume(100,5),passe:{issue:'finie',ecrits:0}},{resume:resume(100,7),passe:{issue:'finie',ecrits:2}}];   // 5 % et 5 % : médiane 5 %
 const brut={resume:resume(100,18),passe:{issue:'finie',ecrits:0},relecture:{corriges:0,faits:100}};
 assert.deepEqual(F.alertes(brut,prec).map(x=>x.code),['differes'],'18 différés, rien d’écrit : au-delà de 2 fois la médiane');
 const ecrits={resume:resume(100,18),passe:{issue:'finie',ecrits:10},relecture:{corriges:0,faits:100}};
 assert.deepEqual(F.alertes(ecrits,prec),[],'18 différés dont 10 écrits par la passe : 8 restants, pas d’alerte');
 const prec2=[{resume:resume(100,20),passe:{issue:'finie',ecrits:15}},{resume:resume(100,20),passe:{issue:'finie',ecrits:15}}];   // 5 % restants
 assert.deepEqual(F.alertes({resume:resume(100,12),passe:{issue:'finie',ecrits:0}},prec2).map(x=>x.texte),['différés : 12 sur 100, plus de 2 fois la médiane des parties précédentes'],'la médiane retranche aussi les écrits des parties précédentes');});

test('compatibilité : un résumé qui porte déjà `ecritsPasse` ou `refus` garde la priorité (essais et états anciens)',()=>{
 const prec=[{resume:{traites:100,differes:5,ecritsPasse:0}},{resume:{traites:100,differes:7,ecritsPasse:2}}];
 assert.deepEqual(F.alertes({resume:{traites:100,differes:13,ecritsPasse:1,refus:1},passe:{ecrits:9},relecture:{corriges:0,faits:100,refusees:0}},prec).map(x=>x.code),['differes','refus']);});

test('bilan complété après l’arrêt de la file (`completerBilan`) : les refus de la relecture sont gardés',()=>{
 let e=file(2);e=F.transition(e,{type:'lot-demarre',lotId:'L1',part:23,at}).etat;
 e=F.transition(e,{type:'lot-fin',lotId:'L1',motif:'operateur',issue:'operateur',resume:resume(100,10),at}).etat;
 assert.equal(e.etat,'arret');
 const n=F.completerBilan(e,{lotId:'L1',relecture:{issue:'fin',corriges:1,refusees:3,faits:50,mode:'corriger'}});
 assert.equal(n.bilan.at(-1).relecture.refusees,3);});
