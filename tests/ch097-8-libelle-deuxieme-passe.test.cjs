'use strict';
/* CH-097, défaut 8 (accord de l'opérateur, D-319) — LE LIBELLÉ DE LA DEUXIÈME PASSE DIT CE QUE FAIT LE RÉGLAGE EFFECTIF. Avant : le panneau, la
 * feuille de réglages de Signal et l'avis après le clic disaient « en ombre : n'écrit rien dans ESV », écrit en dur, alors que le réglage livré pose et
 * valide jusqu'à 10 cuts par lot. Maintenant le service worker rend le mode effectif (`passeDiffReglage`, la fonction même qu'il lit avant d'écrire)
 * avec les choix du lot, et un seul module en tire les textes : « en ombre » seulement si la passe n'écrit pas, « pose et valide … jusqu'à N cuts »
 * sinon. Aucun réglage ne change. Service worker, panneau et Signal réels en vm. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {production,memoire}=require('./helpers/perf-production.cjs');
const {panneau}=require('../tools/audit-qualite-480.cjs');
const Settings=require('../src/settings.js'),S=require('../src/signal-rendu.js');
const lire=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const ECRIT={mode:'ecriture',max:10},OMBRE={mode:'ombre',max:10};

test('service worker : `choix-lot-etat` et `choix-lot` rendent le mode effectif du réglage livré (écriture, 10 cuts au plus)',async()=>{
 const b=production({local:memoire()});
 const attendu={mode:b.get('passeDiffReglage()').mode,max:b.get('passeDiffReglage()').max};
 assert.deepEqual(attendu,{mode:'ecriture',max:Settings.passeDifferesDefaut.ecritureMax},'réglage livré : la passe écrit, plafonnée (D-259)');
 assert.deepEqual({...(await b.api('choix-lot-etat')).passeDifferesReglage},attendu);
 const r=await b.api('choix-lot',{passeDifferes:false});assert.equal(r.passeDifferes,false);assert.deepEqual({...r.passeDifferesReglage},attendu,'l’interrupteur ne change pas le réglage');});

test('service worker : réglage en ombre seule (`ecriture:false`) → mode « ombre » ; plafond levé → `max:null` (jamais Infinity dans un message)',async()=>{
 const b=production({local:memoire()});await b.api('view');
 const regler=p=>b.get(`globalThis.BananeSettings=Object.freeze({...globalThis.BananeSettings,lot:Object.freeze({...globalThis.BananeSettings.lot,passeDifferes:Object.freeze({...globalThis.BananeSettings.passeDifferesDefaut,...${JSON.stringify(p)}})})})`);
 regler({ecriture:false});assert.equal((await b.api('choix-lot-etat')).passeDifferesReglage.mode,'ombre');
 regler({ecriture:true,ecritureMax:null});assert.deepEqual({...(await b.api('choix-lot-etat')).passeDifferesReglage},{mode:'ecriture',max:null});
 regler({ombre:false});assert.equal((await b.api('choix-lot-etat')).passeDifferesReglage.mode,'off');});

test('textes (un seul module, `passe2Textes`) : « en ombre » seulement quand la passe n’écrit pas',()=>{
 const e=S.passe2Textes(ECRIT),o=S.passe2Textes(OMBRE),sansPlafond=S.passe2Textes({mode:'ecriture',max:null}),off=S.passe2Textes({mode:'off',max:0}),inconnu=S.passe2Textes(null);
 for(const t of [e.mode,e.titre,e.detail,e.avisAllumee,sansPlafond.mode,sansPlafond.detail])assert.doesNotMatch(t,/ombre|n’écrit rien|sans rien écrire/,t);
 assert.match(e.mode,/pose et valide jusqu’à 10 cuts en fin de lot/);assert.match(e.detail,/jusqu’à 10 cuts/);assert.match(e.avisAllumee,/pose et valide.*jusqu’à 10 cuts/);
 assert.match(S.passe2Textes({mode:'ecriture',max:1}).mode,/jusqu’à 1 cut en fin de lot/);
 assert.doesNotMatch(sansPlafond.mode,/jusqu’à/);assert.match(sansPlafond.mode,/pose et valide/);
 assert.match(o.mode,/en ombre : n’écrit rien dans ESV/);assert.match(o.titre,/en ombre/);assert.match(o.avisAllumee,/sans rien écrire dans ESV/);
 assert.match(off.mode,/coupée par le réglage/);
 for(const t of Object.values(inconnu))assert.doesNotMatch(t,/ombre|pose et valide/,'mode pas encore lu : ni l’un ni l’autre');});

test('feuille de réglages de Signal : le libellé suit le mode effectif',()=>{
 const snap=reglage=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},boutonsOrbite:[],boutonsEcho:[],onglets:[],ongletChoisi:'',
  reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,passe2Reglage:reglage,raison:false,bandeau:false},echo:{visites:'0',corriges:0},echoRows:[],
  ar:{etat:'pret',etatTexte:'Prêt',horsLigne:false,partie:13,cutEsv:1,cibles:null,poses:0,differes:0,traites:0,restants:null,cours:null,dernier:null,bornes:{debut:null,fin:null},differesListe:[],
   verts:[],vertsNombre:0,vertsLigne:'',aExaminer:0,lotOuvert:false,passe2:null,cache:{actif:false},connexionBloquee:false,echoEtat:'',alerte:'',esv:'ok',pause:{actif:true},reprendre:null},
  sig:{activite:'orbite',statuts:[],allure:{mediane:null,parMinute:null,debutCut:null,debutPause:null,depuisS:null,pauseS:null},echo:{mediane:null,marques:[]},
   connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV',historique:null,goto:{present:false,actif:false,raison:'',etat:'',texte:''},examines:[],theme:'sombre',f5:null,taille:'normal'}});
 const ui={tiroir:false,couche:'reglages',sel:null,q:'',pi:0,note:''};
 const e=S.rendre(snap(ECRIT),ui);assert.doesNotMatch(e,/Rattrapage \(en ombre\)|sans rien écrire dans ESV/);assert.match(e,/Rattrapage/);assert.match(e,/pose et valide dans ESV jusqu’à 10 cuts/);
 const o=S.rendre(snap(OMBRE),ui);assert.match(o,/Rattrapage \(en ombre\)/);assert.match(o,/sans rien écrire dans ESV/);});

test('panneau : le libellé de la case et l’avis après le clic suivent le mode rendu par le service worker ; rien d’écrit en dur',async()=>{
 const html=lire('panel.html');
 assert.doesNotMatch(html,/en ombre : n’écrit rien dans ESV/,'panel.html : plus de mode écrit en dur');assert.match(html,/id="passe-differes-mode"/);
 assert.doesNotMatch(lire('panel.js'),/Deuxième passe allumée, en ombre/,'panel.js : plus d’avis écrit en dur');
 const etat={current:{identity:{part:23,cut:1}},batch:null};
 for(const [reglage,libelle,avis] of [[ECRIT,/^\(pose et valide jusqu’à 10 cuts en fin de lot\)$/,/pose et valide.*jusqu’à 10 cuts/],[OMBRE,/^\(en ombre : n’écrit rien dans ESV\)$/,/en ombre.*sans rien écrire dans ESV/]]){
  const choix={clicHumain:'tel-quel',regleGrappeDifferes:false,passeDifferes:true,aurorePassage:true,passeDifferesReglage:reglage};
  const p=await panneau(etat,{globals:{BananeSettings:Settings,ArianeSignalRendu:S},reponses:{'choix-lot-etat':choix,'choix-lot':choix}});
  await p.attendre();assert.match(p.$('passe-differes-mode').textContent,libelle);
  p.$('passe-differes').checked=true;p.$('passe-differes').onclick();await p.attendre();
  assert.match(p.notes.at(-1),avis);}});
