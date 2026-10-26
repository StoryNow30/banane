'use strict';
/* Connexion T21 (fiches/CONNEXION_T21.md) — défaut de terrain de la test 21 : « au démarrage il est hors ligne ; quand je choisis l'onglet, rien ; il faut
 * recliquer, et c'est long ». Cause : le panneau s'ouvre sur l'accueil du panneau d'avant (`#home`, background.js `openPanel`), où panel.js `discover` ne
 * cherche pas les onglets ESV ; Signal n'a pas d'accueil et n'en sortait jamais : liste des onglets vide, aucune connexion de l'onglet unique.
 *  - l'habillage (src/ui5.js, Signal) entre une fois dans la vue de l'activité affichée, comme le clic sur « Orbite » (ou « Écho ») de l'accueil d'avant :
 *    un clic sur l'onglet d'origine, aucun message de plus ;
 *  - la couche des onglets (src/signal-rendu.js) ne dit « connecté » que pour l'onglet choisi ET prêt : sinon il garde son bouton « Connecter » ;
 *  - « Hors ligne » ne dit plus « Aucun onglet ESV ouvert » quand des onglets sont listés, et montre le refus de la connexion (ligne d'avis du panneau).
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {monter}=require('./helpers/ui5-page.cjs');
const S=require('../src/signal-rendu.js');
const js=x=>JSON.parse(JSON.stringify(x));
const repos=(extra={})=>({batch:null,current:null,connection:{status:'no-tab',tabId:null},native:{status:'IDLE',visits:[]},...extra});

test('Signal ouvert sur l’accueil du panneau : il entre une fois dans Orbite (clic sur l’onglet d’origine), sans aucun message',async()=>{
 const p=await monter({etat:repos()});p.rendu(repos());await p.attendre(10);
 assert.equal(p.els['tab-automatic'].clics,1,'comme le clic sur « Orbite » de l’accueil d’avant : panel.js cherche alors les onglets ESV');
 assert.equal(p.els['tab-native'].clics,0);
 p.rendu(repos());p.rendu(repos());await p.attendre(10);
 assert.equal(p.els['tab-automatic'].clics,1,'une seule fois');
 assert.deepEqual(js(p.envoyes),[],'aucun message au service worker depuis l’habillage');
});

test('séance Écho en cours ou à terminer : il entre dans Écho ; déjà dans une vue, ou présentation d’essai : aucun clic',async()=>{
 for(const native of [{status:'RUNNING',visits:[]},{status:'PAUSED_ADAPTER_UNRESPONSIVE',visits:[]},{status:'IDLE',visits:[{c:1}]}]){
  const p=await monter({etat:repos({native})});p.rendu(repos({native}));await p.attendre(10);
  assert.equal(p.els['tab-native'].clics,1,JSON.stringify(native));assert.equal(p.els['tab-automatic'].clics,0,JSON.stringify(native));
 }
 const vue=await monter({etat:null});vue.body.dataset.window='automatic';vue.rendu(repos());await vue.attendre(10);
 assert.equal(vue.els['tab-automatic'].clics+vue.els['tab-native'].clics,0,'déjà dans Orbite');
 const essai=await monter({stockage:{banane51Interface:'ariane2'},etat:repos()});essai.rendu(repos());await essai.attendre(10);
 assert.equal(essai.els['tab-automatic'].clics+essai.els['tab-native'].clics,0,'la présentation d’essai garde son accueil');
});

/* Instantanés comme src/ui5.js les fait : hors ligne, au repos. */
const ar={etat:'pret',etatTexte:'',horsLigne:true,partie:null,cutEsv:null,cibles:null,poses:0,differes:0,traites:0,restants:null,cours:null,dernier:null,bornes:{debut:null,fin:null},
 differesListe:[],verts:[],vertsNombre:0,vertsLigne:'',aExaminer:0,lotOuvert:false,passe2:null,cache:{actif:true},connexionBloquee:false,echoEtat:'Aucune séance en cours',alerte:'',esv:'non',pause:null,reprendre:null};
const snap=(statut,onglets,choisi,notice={texte:'',erreur:false})=>({variante:'signal',mode:'automatic',notice,boutonsOrbite:[],boutonsEcho:[],onglets,ongletChoisi:choisi,
 reglages:{},echo:{visites:'0',corriges:0},echoRows:[],ar,sig:{activite:'orbite',statuts:[],allure:null,echo:{},connexion:{statut,reconnect:null},
  onglet:(onglets.find(o=>o.valeur===choisi)||{}).texte||'',historique:null,goto:{},examines:[],theme:'sombre',f5:null,taille:'normal'}});
const ui={tiroir:false,couche:'esv',sel:null,q:'',pi:0,note:''};
const UN=[{valeur:'7',texte:'ESV · partie 23'}],DEUX=[...UN,{valeur:'8',texte:'ESV · partie 24'}];

test('couche des onglets : « connecté » seulement pour l’onglet choisi ET prêt ; choisi mais pas connecté : son bouton « Connecter » reste',()=>{
 for(const statut of ['no-tab',null,'reconnecting']){
  const h=S.rendre(snap(statut,UN,'7'),ui);
  assert.doesNotMatch(h,/class="sg-conn"/,`${statut} : rien n’est connecté`);
  assert.match(h,/data-act="conn:7"/,`${statut} : l’onglet choisi d’avance se connecte en un clic`);
 }
 const pret=S.rendre(snap('ready',UN,'7'),ui);assert.match(pret,/class="sg-conn"><i><\/i>connecté/);assert.doesNotMatch(pret,/data-act="conn:7"/);
 const perdu=S.rendre(snap('unavailable',UN,'7'),ui);assert.match(perdu,/data-act="conn:7"[^>]*>Reconnecter</);
});

test('« Hors ligne » : des onglets listés ne sont pas « aucun onglet ouvert » ; le refus de la connexion est dit',()=>{
 const deux=S.rendre(snap('no-tab',DEUX,''),{...ui,couche:null});
 assert.match(deux,/class="sg-mot">Hors ligne</);assert.doesNotMatch(deux,/Aucun onglet ESV ouvert/);assert.match(deux,/Choisis l’onglet ESV/);
 assert.match(S.rendre(snap('no-tab',[],''),{...ui,couche:null}),/Aucun onglet ESV ouvert/,'sans onglet : inchangé');
 const refus=S.rendre(snap('no-tab',UN,'7',{texte:'Recharge la page ESV (F5) pour activer Ariane 4.9.5 test 21.',erreur:true}),{...ui,couche:null});
 assert.match(refus,/Recharge la page ESV \(F5\) pour activer Ariane/);
 assert.doesNotMatch(S.rendre(snap('no-tab',UN,'7',{texte:'Prêt.',erreur:false}),{...ui,couche:null}),/Prêt\./,'une ligne d’avis ordinaire n’est pas recopiée');
});

/* Constat de l'opérateur (capture) : puce « Aucun onglet », et pourtant « Démarrer le lot » actif ; le lot est parti sur l'onglet que le service worker
 * gardait (`connection.tabId`), que le panneau ne nommait pas. Le lot ne démarre que sur un onglet listé, nommé dans la puce, et prêt. */
const D=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const repos2=(connexion,onglets,choisi='')=>({...snap(connexion.statut,onglets,choisi),boutonsOrbite:[D('start-batch','Démarrer le lot','primary')],
 ar:{...ar,horsLigne:false,partie:23,cutEsv:100,esv:'ok'}});
const avec=(x,connexion)=>({...x,sig:{...x.sig,connexion:{reconnect:null,...connexion},onglet:connexion.onglet??x.sig.onglet}});
test('« Démarrer le lot » : grisé avec sa raison, et pas « Prêt », tant que l’onglet ciblé n’est pas listé, nommé et prêt',()=>{
 const cas=[
  ['liste vide, le service worker garde l’onglet 7, prêt',avec(repos2({statut:'ready'},[]),{statut:'ready',tabId:'7',nomme:false,onglet:''})],
  ['onglet ciblé absent de la liste',avec(repos2({statut:'ready'},DEUX,'7'),{statut:'ready',tabId:'9',nomme:false,onglet:''})],
  ['onglet listé mais en reconnexion',avec(repos2({statut:'reconnecting'},UN,'7'),{statut:'reconnecting',tabId:'7',nomme:true})],
  ['onglet listé mais injoignable',avec(repos2({statut:'unavailable'},UN,'7'),{statut:'unavailable',tabId:'7',nomme:true})],
 ];
 for(const [nom,x] of cas){
  const h=S.rendre(x,{...ui,couche:null});
  assert.doesNotMatch(h,/class="sg-mot">Prêt</,nom);
  assert.match(h,/data-act="legacy:start-batch" disabled>/,nom+' : « Démarrer le lot » grisé');
  assert.doesNotMatch(h,/data-act="legacy:start-batch">/,nom);
  assert.match(h,/Choisis un onglet ESV|ESV n’est pas connecté|Reconnexion à ESV/,nom+' : la raison est dite');
  const p=S.paletteListe(x,{...ui,couche:'palette',q:'démarrer'});assert.ok(p.every(c=>c.act!=='legacy:start-batch'||c.off),nom+' : la palette ne le lance pas');
 }
 /* Revue de Signal, D2 : le service worker garde un onglet prêt que la liste ne nomme pas : la puce ne dit pas « Aucun onglet ». */
 const puce=S.rendre(cas[0][1],{...ui,couche:null});assert.doesNotMatch(puce,/class="sg-long">Aucun onglet</);assert.match(puce,/class="sg-long">Onglet à choisir</);
 const ok=S.rendre(avec(repos2({statut:'ready'},UN,'7'),{statut:'ready',tabId:'7',nomme:true}),{...ui,couche:null});
 assert.match(ok,/class="sg-mot">Prêt</);assert.match(ok,/class="sg-principal" data-act="legacy:start-batch">/,'onglet listé, nommé, prêt : Démarrer');
});

test('la puce nomme l’onglet que le service worker cible (`connection.tabId`), pas seulement celui du menu',async()=>{
 const p=await monter({etat:null});
 p.els.tabs.options=[{value:'7',textContent:'ESV 7'},{value:'8',textContent:'ESV 8 · utilisé par Ariane'}];p.els.tabs.value='7';
 const g=p.ui.instantane(repos({connection:{status:'ready',tabId:8},current:{identity:{part:23,cut:100}}})).sig;
 assert.equal(g.onglet,'ESV 8 · utilisé par Ariane');assert.equal(g.connexion.tabId,'8');assert.equal(g.connexion.nomme,true);
 const sans=p.ui.instantane(repos({connection:{status:'ready',tabId:9},current:{identity:{part:23,cut:100}}})).sig;
 assert.equal(sans.onglet,'','onglet ciblé absent de la liste : la puce ne nomme pas un autre onglet');assert.equal(sans.connexion.nomme,false);
});
