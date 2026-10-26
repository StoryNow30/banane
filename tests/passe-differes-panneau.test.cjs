'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md) — LA DEUXIÈME PASSE DANS LE PANNEAU D'AVANT (le défaut). Panneau réel (panel.js) en vm, DOM et API Chrome simulés
 * (tools/audit-qualite-480.cjs). Aucune action nouvelle : l'interrupteur passe par `choix-lot`, l'arrêt par `stop`, la relance par `passe-differes-ecrire` (existantes).
 *  - Réglages (« Règles et choix du prochain lot ») : case « Deuxième passe des différés en fin de lot (en ombre : n’écrit rien dans ESV) » (test 21, D-251 : livrée en ombre), cochée d'après `choix-lot-etat`, gardée par un clic ;
 *  - tant qu'elle écrit : « La deuxième passe travaille, ne touche à rien dans ESV », « Arrêter la deuxième passe », pas de « Nouveau lot » ;
 *  - arrêtée avant la fin avec des poses décidées qui restent : « Relancer la deuxième passe ». Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const Settings=require('../src/settings.js');
const HTML=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
const vue=(p2,etat='COMPLETED')=>({current:{identity:{part:23,cut:120}},batch:{id:'lot-1',state:etat,scope:{part:23,start:100,end:120},processed:[],deferred:[],skipped:[],
 manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:{part:23,cut:120}},...(p2?{passeDifferes:{lotId:'lot-1',mode:'ecriture',differes:4,posees:3,demandees:3,ecrites:1,cut:null,message:null,...p2}}:{})});
const ouvrir=(state,choix={clicHumain:'tel-quel',regleGrappeDifferes:false,passeDifferes:true},enr=[])=>panneau(state,{globals:{BananeSettings:Settings},
 reponses:{'choix-lot-etat':choix,'choix-lot':args=>{enr.push(args);return {...choix,...args};}}});

test('Réglages : la case dit qu’elle est en ombre et n’écrit rien dans ESV, cochée d’après le choix gardé ; un clic la garde et la note le dit',async()=>{
 assert.match(HTML,/<input id="passe-differes" type="checkbox"> Deuxième passe des différés en fin de lot \(en ombre : n’écrit rien dans ESV\)<\/label>/);
 assert.match(HTML,/<div id="carte-choix"[\s\S]*<div id="passe-differes-row"[\s\S]*<\/section>/);
 const enr=[],p=await ouvrir(vue(null),undefined,enr);
 assert.equal(p.$('passe-differes').checked,true);assert.equal(p.$('passe-differes').indeterminate,false);
 /* Service worker muet sur les choix : la case reste « inconnue », jamais « coupée » par défaut d'affichage. */
 const muet=await panneau(vue(null),{globals:{BananeSettings:Settings}});assert.equal(muet.$('passe-differes').indeterminate,true);
 p.$('passe-differes').checked=false;await p.$('passe-differes').onclick();await p.attendre();
 assert.deepEqual(JSON.parse(JSON.stringify(enr)),[{passeDifferes:false}]);assert.equal(p.$('passe-differes').checked,false);
 assert.equal(p.$('notice').textContent,'Deuxième passe coupée : plus aucun calcul en fin de lot.');
 const q=await ouvrir(vue(null),{clicHumain:'tel-quel',regleGrappeDifferes:false,passeDifferes:false});assert.equal(q.$('passe-differes').checked,false);
});

test('pendant qu’elle écrit : la consigne en vue, « Arrêter la deuxième passe », pas de nouveau lot',async()=>{
 const p=await ouvrir(vue({etat:'ecriture',cut:112}));
 const l=p.$('passe-differes-ligne');assert.equal(l.hidden,false);assert.equal(l.className,'warning');
 assert.equal(l.textContent,'La deuxième passe travaille, ne touche à rien dans ESV · cut 112 · 1 posé sur 3. « Arrêter la deuxième passe » l’arrête avant le cut suivant.');
 assert.equal(p.$('stop').hidden,false);assert.equal(p.$('stop').textContent,'Arrêter la deuxième passe');
 assert.equal(p.$('new-batch').hidden,true);assert.equal(p.$('passe-differes-lancer').hidden,true);
 assert.equal(p.$('export-cache-clear').disabled,true,'le service worker refuse le vidage du cache tant qu’elle écrit');
 await p.$('stop').onclick();await p.attendre();assert.ok(p.appels.some(a=>a.action==='stop'));
});

test('après : l’issue en une ligne ; arrêtée avec des poses qui restent, « Relancer la deuxième passe » ; rien pour un autre lot ou sans passe',async()=>{
 let p=await ouvrir(vue({etat:'arretee',message:'une pose d’Ariane attend ta validation au cut 120 : valide-la (ou corrige-la) dans ESV'}));
 assert.equal(p.$('passe-differes-ligne').className,'muted');assert.equal(p.$('stop').hidden,true);assert.equal(p.$('stop').textContent,'Arrêter le lot');
 assert.match(p.$('passe-differes-ligne').textContent,/^Deuxième passe arrêtée : 1 cut\(s\) posé\(s\) et validé\(s\) sur 3 décidé\(s\), 4 différé\(s\) revus\. une pose d’Ariane attend ta validation au cut 120/);
 assert.equal(p.$('passe-differes-lancer').hidden,false);
 await p.$('passe-differes-lancer').onclick();await p.attendre();assert.ok(p.appels.some(a=>a.action==='passe-differes-ecrire'));
 p=await ouvrir(vue({etat:'finie',ecrites:3}));assert.match(p.$('passe-differes-ligne').textContent,/^Deuxième passe finie : 3 cut\(s\) posé\(s\)/);assert.equal(p.$('passe-differes-lancer').hidden,true);
 p=await ouvrir(vue({etat:'erreur',ecrites:0,message:'panne'}));assert.equal(p.$('passe-differes-ligne').textContent,'Deuxième passe en erreur : 0 cut(s) posé(s) et validé(s) sur 3 décidé(s), 4 différé(s) revus. panne.');
 p=await ouvrir(vue({etat:'finie',mode:'ombre',ecrites:0}));assert.equal(p.$('passe-differes-ligne').textContent,'Deuxième passe en ombre : 3 cut(s) sur 4 qu’elle poserait ; rien n’est écrit dans ESV.');
 p=await ouvrir(vue({etat:'calcul'}));assert.equal(p.$('passe-differes-ligne').textContent,'Deuxième passe : calcul des cuts restés sans pose…');
 p=await ouvrir({...vue({etat:'ecriture'}),passeDifferes:{...vue({etat:'ecriture'}).passeDifferes,lotId:'autre'}});assert.equal(p.$('passe-differes-ligne').hidden,true);assert.equal(p.$('stop').hidden,true);
 p=await ouvrir(vue(null));assert.equal(p.$('passe-differes-ligne').hidden,true);assert.equal(p.$('passe-differes-lancer').hidden,true);
});
