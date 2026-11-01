'use strict';
/* CH-036 — L'ÉCRAN ORBITE DANS LES MOTS DE L'OPÉRATEUR (décision du 01/11, relayée par l'intégrateur) : « Deuxième passe » → « Rattrapage », « différés »
 * → « à poser », « skippés » → « sautés », dans les libellés visibles seulement ; identifiants, actions et export inchangés. Rendu pur (src/signal-rendu.js).
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../src/signal-rendu.js');
const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ar=(etat,x={})=>({etat,etatTexte:'',horsLigne:false,partie:13,cutEsv:4812,cibles:120,poses:27,differes:4,traites:31,restants:89,cours:4812,dernier:4811,
 bornes:{debut:4790,fin:null},differesListe:[{cut:4809,motif:'Rail non résolu',precision:'rail droit',heure:'15 h 33'},{cut:4803,motif:'Différé',precision:'',heure:'15 h 10'}],
 verts:[],vertsNombre:0,vertsLigne:'',aExaminer:4,lotOuvert:['cours','dem','pause','alerte','p2','rel'].includes(etat),passe2:null,cache:{actif:false},connexionBloquee:false,
 echoEtat:'Aucune séance en cours',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...x});
const sig=(x={})=>({activite:'orbite',statuts:['pose','pose','differe','voie','pose'],allure:{mediane:8.4,parMinute:60/8.4,debutCut:1000,debutPause:null,depuisS:4.2,pauseS:null},
 echo:{mediane:null,marques:[]},connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV · partie 13',historique:null,goto:{present:false,actif:false,raison:'',etat:'',texte:''},
 examines:[],theme:'sombre',f5:null,taille:'normal',...x});
const snap=(x={})=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},boutonsOrbite:[b('pause','Pause','primary'),b('stop','Arrêter le lot','danger')],boutonsEcho:[],
 onglets:[{valeur:'12',texte:'ESV · partie 13'}],ongletChoisi:'12',reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,bandeau:false},
 echo:{visites:'0',corriges:0},echoRows:[],ar:ar('cours'),sig:sig(),...x});
const ui=(x={})=>({tiroir:false,couche:null,sel:null,q:'',pi:0,note:'',...x});
const texte=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');

test('deuxième passe en cours : « Rattrapage », verrou et cache disent « rattrapage »',()=>{
 const h=S.rendre(snap({ar:ar('p2',{passe2:{cut:4813,ecrites:1,demandees:3}})}),ui());
 assert.match(h,/class="sg-mot">Rattrapage</);assert.match(texte(h),/fin du rattrapage/);assert.match(texte(h),/après le rattrapage/);
 assert.doesNotMatch(texte(h),/[Dd]euxième passe/);
});
test('fin du lot : « Rattrapage » au bilan, « à poser » dans « Il reste » ; le rail et le compte disent « à poser »',()=>{
 const h=S.rendre(snap({ar:ar('fini',{passeFin:{mode:'ombre',etat:'finie',posees:2,differes:4,ecrites:0}})}),ui());
 assert.match(h,/<dt>Rattrapage<\/dt>/);assert.match(texte(h),/Il reste \d+ à poser/);
 assert.doesNotMatch(texte(h),/[Dd]euxième passe|différés?\b/);
});
test('tiroir « Ce qui reste » : la section « À poser », jamais « Différés »',()=>{
 const h=S.rendre(snap({ar:ar('fini')}),ui({tiroir:true}));
 assert.match(h,/<div class="sg-section"><span>À poser<\/span>/);assert.doesNotMatch(texte(h),/[Dd]ifférés?\b/);
});
test('réglages : « Rattrapage (en ombre) », « Série de cuts à poser » ; historique : « à poser », « sautés »',()=>{
 const H=[{part:13,fin:'complete',cibles:120,poses:112,differes:6,sautes:2,depart:{ignores:3},debut:'2026-10-30T14:21:56Z'}];
 const h=S.rendre(snap({sig:sig({historique:H})}),ui({couche:'reglages'}));
 assert.match(texte(h),/Rattrapage \(en ombre\)/);assert.match(texte(h),/Série de cuts à poser/);
 assert.match(texte(h),/6 à poser · 2 sautés · 3 sautés au départ/);
 assert.doesNotMatch(texte(h),/[Dd]euxième passe|différés?\b|skipp|ignorés/);
});
