'use strict';
/* CH-104 — deux défauts établis par la relecture critique (CH-106, 11/11), épinglés sur le rendu pur (src/signal-rendu.js) :
 *  1. Étapes du lot : une étape n'est cochée que si elle est FINIE. Une relecture en pause, interrompue ou arrêtée dit son état et ses chiffres,
 *     sans coche ; un rattrapage en ombre, en erreur, en calcul ou arrêté ne se coche pas comme « posé ».
 *  2. La puce ESV nomme l'onglet (règle Connexion T21 : le lot part sur l'onglet nommé en haut à droite) ; un état anormal s'écrit en clair,
 *     y compris en compact (ligne d'état sous la barre). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../src/signal-rendu.js');
const ar=(o={})=>({etat:'fini',traites:93,poses:87,differes:6,partie:13,lotOuvert:false,differesListe:[],verts:[],vertsNombre:null,etapes:{relecture:'corriger',passe:'ecriture'},...o});
const snap=(o={})=>({ar:ar(o.ar),sig:{activite:'orbite',fil:[],connexion:{statut:'ready',nomme:true,tabId:'1'},onglet:'Partie 13 — ESV · onglet 2',...(o.sig||{})},boutonsOrbite:[{id:'new-batch',texte:'Nouveau lot',role:'link',actif:true}],relChiffres:o.rel||null,lot:{},file:null});
const etape=(h,nom)=>{const m=h.match(new RegExp('<li data-etape="([a-z-]+)"[^>]*><i aria-hidden="true"></i><b>'+nom+'</b><span>([^<]*)</span>'));return m?{etat:m[1],texte:m[2]}:null;};

test('étapes : la relecture n’est cochée que finie ; en pause, interrompue, arrêtée : son état et ses chiffres, sans coche',()=>{
 const R=etat=>etape(S.rendre(snap({rel:{faits:12,total:85,corriges:3,lot:true,etat}}),{}),'Relecture');
 assert.deepEqual(R('finie'),{etat:'fait',texte:'12 relus'});
 assert.deepEqual(R('en-pause'),{etat:'actif',texte:'en pause · 12 sur 85'});
 assert.deepEqual(R('interrompue'),{etat:'actif',texte:'interrompue · 12 sur 85'});
 assert.deepEqual(R('arretee'),{etat:'a-venir',texte:'arrêtée · 12 sur 85'});
 assert.deepEqual(R('en-cours'),{etat:'actif',texte:'12 sur 85'},'une passe encore en cours n’est pas finie');
 assert.notEqual(R(undefined).etat,'fait','état inconnu : jamais cochée');
 assert.notEqual(etape(S.rendre(snap({rel:{faits:12,total:85,lot:false,etat:'finie'}}),{}),'Relecture').etat,'fait','la relecture d’un autre lot ne coche rien');
});

test('étapes : un rattrapage en ombre, en erreur, en calcul ou arrêté n’est pas coché ; fini en écriture, il l’est',()=>{
 const P=p=>etape(S.rendre(snap({ar:{passeFin:{mode:'ecriture',etat:'finie',posees:3,differes:6,ecrites:2,message:null,...p}}}),{}),'Rattrapage');
 assert.deepEqual(P({}),{etat:'fait',texte:'2 posés'});
 assert.deepEqual(P({mode:'ombre'}),{etat:'a-venir',texte:'en ombre'});
 assert.deepEqual(P({etat:'erreur'}),{etat:'a-venir',texte:'en erreur'});
 assert.deepEqual(P({etat:'calcul'}),{etat:'actif',texte:'calcul…'});
 assert.deepEqual(P({etat:'arretee'}),{etat:'a-venir',texte:'arrêté · 2 posés'});
});

test('puce ESV : elle nomme l’onglet (long) et son premier morceau (court) ; état anormal en clair, avec la ligne d’état pour le compact',()=>{
 const puce=h=>({long:(h.match(/class="sg-puce"[^>]*>.*?<span class="sg-long">([^<]*)</)||[])[1],court:(h.match(/class="sg-puce"[^>]*>.*?<span class="sg-court">([^<]*)</)||[])[1],
  etat:(h.match(/class="sg-puce" data-etat="([a-z]+)"/)||[])[1],ligne:(h.match(/<div class="sg-barre-etat" data-etat="([a-z]+)" role="status"><i><\/i>([^<]*)</)||[]).slice(1)});
 assert.deepEqual(puce(S.rendre(snap(),{})),{long:'Partie 13 — ESV · onglet 2',court:'Partie 13 — ESV',etat:'ok',ligne:[]});
 const sans=S.rendre(snap({ar:{etat:'pret',horsLigne:true},sig:{connexion:{statut:'no-tab'},onglet:''}}),{});
 assert.deepEqual(puce(sans),{long:'Aucun onglet',court:'Aucun onglet',etat:'aucun',ligne:['aucun','Aucun onglet']});
 const choisir=S.rendre(snap({ar:{etat:'pret'},sig:{connexion:{statut:'ready',nomme:false,tabId:'7'},onglet:''}}),{});
 assert.deepEqual(puce(choisir),{long:'Onglet à choisir',court:'Onglet à choisir',etat:'aucun',ligne:['aucun','Onglet à choisir']});
 const muet=S.rendre(snap({ar:{etat:'alerte',etatTexte:'ESV ne répond plus',lotOuvert:true,esv:'ko',alerte:'ESV ne répond plus.'},sig:{connexion:{statut:'unavailable'}}}),{});
 assert.deepEqual(puce(muet),{long:'ESV ne répond plus',court:'ESV ne répond plus',etat:'ko',ligne:['ko','ESV ne répond plus']});
});
