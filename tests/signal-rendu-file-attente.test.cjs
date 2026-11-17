'use strict';
/* CH-026-c — FILE ARRÊTÉE PENDANT QU'UNE ACTIVITÉ DE SA PARTIE TOURNE (constat de l'opérateur sur un vrai ESV, 30/10 : « File arrêtée » à côté d'une
 * relecture vivante, avec « Reprendre »). Signal le dit (« attend la fin de la relecture ») et n'offre ni reprise ni nouvelle file avant sa fin ; l'activité
 * finie, l'écran d'arrêt habituel revient. Rendu pur (src/signal-rendu.js). Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../src/signal-rendu.js');
const html=fs.readFileSync(path.join(__dirname,'..','panel.html'),'utf8'),IDS=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
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
const legacy=h=>[...h.matchAll(/data-act="legacy:([a-z0-9-]+)"/g)].map(m=>m[1]);

const F=x=>({etat:'arret',actif:false,n:3,rang:2,etatTexte:'arrêtée',phrase:'pose écrite non validée : contrôle le cut dans ESV · 2 parties faites sur 3 · rien exporté.',alerte:'pose écrite non validée : contrôle le cut dans ESV (pose d’Ariane au cut 5346 non validée).',
 bilan:['Partie 2 · 23 posés','Partie 3 · 31 posés','Partie 4 · interrompue · 48 posés, 3 différés · relecture —'],principal:{texte:'Préparer la reprise · 1 partie restante',actif:true},secondaire:null,
 reprendre:{texte:'Reprendre la file · 1 partie restante',actif:true},lancer:{texte:'Nouvelle file · 3 parties',actif:true},reprise:{rang:2,part:4,reste:1},nombreTous:{n:3,min:1,max:20},partieAffichee:4,departs:[],faites:2,...x});
/* CH-036 : mots de l'opérateur (« Constellation », « rattrapage » pour la deuxième passe, décision du 01/11) ; les mêmes garanties. */
for(const [etat,mot] of [['rel','de la relecture'],['p2','du rattrapage']]){
 test(`orbite, activité ${mot} de la partie, file arrêtée : bandeau « attend la fin ${mot} », aucune reprise offerte`,()=>{
  const h=S.rendre(snap({ar:ar(etat),file:F()}),ui());
  assert.match(h,new RegExp(`attend la fin ${mot}`));assert.match(h,/la Constellation s’est arrêtée et ne repartira pas seule/);
  assert.doesNotMatch(h,/data-act="legacy:file-(reprendre|principal|lancer)"/,'ni « Reprendre la file » ni « Préparer la reprise » pendant l’activité');
 });
 test(`onglet Constellation, activité ${mot} en cours, file arrêtée : « Attend la fin ${mot} », boutons de reprise et de nouvelle file grisés`,()=>{
  const h=S.rendre(snap({ar:ar(etat),file:F()}),ui({onglet:'file'}));
  assert.match(h,new RegExp(`class="sg-mot">Attend la fin ${mot}<`));assert.doesNotMatch(h,/class="sg-mot">Arrêtée</);
  assert.match(h,/data-act="legacy:file-reprendre" disabled/);assert.match(h,/data-act="legacy:file-lancer" disabled/);
 });
}
test('activité finie (lot clos) : l’écran d’arrêt habituel, avec « Reprendre à la partie 4 » (au rang)',()=>{
 const h=S.rendre(snap({ar:ar('fini'),file:F()}),ui({onglet:'file'}));
 assert.match(h,/class="sg-mot">Arrêtée</);assert.match(h,/data-act="legacy:file-reprendre">.*Reprendre à la partie 4 · 1 restante/);
});

/* Vision 19, capture de l'opérateur (17/11) : Constellation arrêtée sur une correction de la relecture interrompue (cut 2475) ; l'avis dit « clique sur
 * « J’ai contrôlé le cut 2475 » », mais l'écran d'Orbite n'offrait que « Reprendre », l'Aurore, l'export et « Voir la Constellation » : aucun moyen d'acquitter
 * (ni dans la palette), et « Reprendre » est refusé tant que la correction n'est pas acquittée. Le bouton d'acquittement passe devant, comme pendant la relecture. */
for(const etat of ['fini','arrete']) test(`Constellation arrêtée, correction interrompue (lot ${etat}) : « J’ai contrôlé le cut 2475 » est le bouton principal, « Reprendre » après`,()=>{
 const s=snap({ar:ar(etat),file:F({reprise:{rang:2,part:3,reste:11}}),relecture:{interrompue:'Une correction de la relecture a été interrompue au cut 2475 (partie 3) : contrôle ce cut dans ESV, puis clique sur « J’ai contrôlé le cut 2475 ».'},
  boutonsOrbite:[b('relecture-acquitter','J’ai contrôlé le cut 2475'),b('export-tout','Exporter le dossier')]});
 const h=S.rendre(s,ui()),l=legacy(h);
 assert.equal(l[0],'relecture-acquitter','le premier bouton est l’acquittement');assert.match(h,/J’ai contrôlé le cut 2475/);
 assert.ok(l.includes('file-reprendre'),'« Reprendre » reste offert, après');
 assert.ok(S.paletteListe?S.paletteListe(s,ui({q:'contrôlé'})).some(c=>c.act==='legacy:relecture-acquitter'):true,'la palette le trouve');
});
test('onglet Constellation, arrêtée sur une correction interrompue : « J’ai contrôlé le cut 2475 » avant « Reprendre »',()=>{
 const s=snap({ar:ar('fini'),file:F({reprise:{rang:2,part:3,reste:11}}),boutonsOrbite:[b('relecture-acquitter','J’ai contrôlé le cut 2475'),b('export-tout','Exporter le dossier')]});
 const l=legacy(S.rendre(s,ui({onglet:'file'})));
 assert.ok(l.includes('relecture-acquitter'));assert.ok(l.indexOf('relecture-acquitter')<l.indexOf('file-reprendre'),'acquitter avant reprendre');
});
