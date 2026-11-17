'use strict';
/* CH-133 (D-366, D-367) — LES BORNES DE LA RELECTURE AU PANNEAU. `vue` (src/relecture-pause.js, pure) rend deux champs « Du cut » / « Au cut »
 * (préremplis par les bornes proposées du service worker) et le bouton « Reprendre du cut A au cut B » (en pause) ou « Relancer du cut A au cut B »
 * (relecture arrêtée, en erreur ou finie, sur le lot affiché) ; Signal (src/signal-rendu.js) les montre dans Orbite. Le téléphone (CH-130) n'a rien
 * de nouveau. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src/relecture-pause.js'),'utf8'),ctx);
const P=ctx.ArianeRelecturePause,js=x=>JSON.parse(JSON.stringify(x));
const S=require('../src/signal-rendu.js');
const PAUSE=p=>({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'COMPLETED'},passe:{lotId:'L1',etat:'en-pause',faits:3,total:7,cut:113,reprise:true,pauseDemandee:false,expire:null,
 pauseRaison:'points',bornesProposees:{debut:116,fin:116},...p},repriseReglage:{actif:true,f5:'pause'}});
const ARRET=(p,x={})=>({choix:'corriger',lot:{id:'L1',mode:'corriger',etat:'COMPLETED'},passe:{lotId:'L1',etat:'erreur',faits:3,total:7,cut:null,reprise:false,
 message:'Relecture arrêtée au cut 113 : ESV n’affiche plus les points (3 cuts de suite sans point, dès le cut 113).',bornesProposees:{debut:116,fin:116},...p},
 correctionInterrompue:null,repriseReglage:{actif:false,f5:'pause'},...x});

test('pause : deux champs préremplis après la série et « Reprendre du cut 116 au cut 116 » ; la saisie change le bouton ; bornes inversées : grisé, dit',()=>{
 const v=js(P.vue(PAUSE()));
 assert.deepEqual(v.bornes,{action:'reprendre',debut:116,fin:116,texte:'Reprendre du cut 116 au cut 116',actif:true,raison:'',note:'Les cuts hors des bornes ne sont ni relus ni corrigés : ils sont comptés « non relus ».'});
 assert.equal(v.raisonPause,'points');
 assert.equal(js(P.vue(PAUSE(),{saisie:{du:'114',au:'116'}})).bornes.texte,'Reprendre du cut 114 au cut 116');
 const inv=js(P.vue(PAUSE(),{saisie:{du:'116',au:'113'}})).bornes;assert.equal(inv.actif,false);assert.equal(inv.raison,'Le cut de départ doit être avant le cut de fin.');
 const vide=js(P.vue(PAUSE(),{saisie:{du:'',au:'116'}})).bornes;assert.equal(vide.actif,false);assert.equal(vide.raison,'Écris le cut de départ et le cut de fin.');
 assert.equal(js(P.vue(PAUSE(),{esvMuet:true})).bornes.actif,false,'ESV muet : comme « Reprendre »');
 /* Pause demandée par l'opérateur : les bornes proposées partent du cut gardé. */
 assert.equal(js(P.vue(PAUSE({pauseRaison:'mic',bornesProposees:{debut:113,fin:116}}))).bornes.texte,'Reprendre du cut 113 au cut 116');
});

test('relecture arrêtée (défaut) ou finie, sur le lot affiché : « Relancer du cut A au cut B » ; jamais tant qu’une correction interrompue attend, ni relecture coupée, ni autre lot',()=>{
 const v=js(P.vue(ARRET()));
 assert.equal(v.bornes.action,'relancer');assert.equal(v.bornes.texte,'Relancer du cut 116 au cut 116');assert.equal(v.bornes.actif,true);
 assert.match(v.bornes.ligne,/Relecture arrêtée au cut 113/);
 assert.equal(js(P.vue(ARRET({etat:'arretee'}))).bornes.action,'relancer');
 assert.equal(js(P.vue(ARRET({etat:'finie',message:'Relecture finie : 7 cuts relus.',bornesProposees:{debut:108,fin:116}}))).bornes.texte,'Relancer du cut 108 au cut 116');
 assert.equal(js(P.vue(ARRET({},{correctionInterrompue:{cut:113,part:23,origine:'relecture'}}))).bornes,null,'« J’ai contrôlé le cut » d’abord');
 assert.equal(js(P.vue(ARRET({},{lot:{id:'L1',mode:'coupee',etat:'COMPLETED'}}))).bornes,null);
 assert.equal(js(P.vue(ARRET({},{lot:{id:'L2',mode:'corriger',etat:'COMPLETED'}}))).bornes,null,'autre lot');
 assert.equal(js(P.vue(ARRET({},{lot:{id:'L1',mode:'corriger',etat:'RUNNING'}}))).bornes,null,'lot ouvert');
 assert.equal(js(P.vue(ARRET({etat:'en-cours'}))).bornes,null,'pendant la passe : rien');
});

/* ------------------------------------------------------------------ Signal */
const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ar=(etat,x={})=>({etat,etatTexte:'',horsLigne:false,partie:23,cutEsv:113,cibles:3,poses:2,differes:0,traites:3,restants:0,cours:113,dernier:113,bornes:{debut:111,fin:113},
 differesListe:[],verts:[],vertsNombre:0,vertsLigne:'',aExaminer:0,lotOuvert:['cours','dem','pause','alerte','p2','rel'].includes(etat),passe2:null,cache:{actif:false},connexionBloquee:false,
 echoEtat:'Aucune séance en cours',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...x});
const sig=(x={})=>({activite:'orbite',statuts:['pose','pose','pose'],allure:{mediane:8.4,parMinute:7,debutCut:1000,debutPause:null,depuisS:4.2,pauseS:null},echo:{mediane:null,marques:[]},
 connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV · partie 23',historique:null,goto:{present:false,actif:false,raison:'',etat:'',texte:''},examines:[],theme:'sombre',f5:null,taille:'normal',...x});
const snap=(x={})=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},avisContrat:'',relecture:{ligne:'',actif:false,interrompue:''},boutonsOrbite:[],boutonsEcho:[],
 onglets:[{valeur:'12',texte:'ESV · partie 23'}],ongletChoisi:'12',reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,bandeau:false},
 echo:{visites:'0',corriges:0},echoRows:[],ar:ar('cours'),sig:sig(),...x});
const ui=(x={})=>({tiroir:false,couche:null,sel:null,q:'',pi:0,note:'',...x});

test('Signal, pause sur série vide : les deux champs (recopiés dans ceux du panneau) et « Reprendre du cut 116 au cut 116 » en bouton principal',()=>{
 const h=S.rendre(snap({ar:ar('rel'),relPause:js(P.vue(PAUSE())),boutonsOrbite:[]}),ui());
 assert.match(h,/data-k="relecture-bornes"/);
 assert.match(h,/<span>Du cut<\/span><input type="number" min="0" data-borne="relecture-du"[^>]*value="116"/);
 assert.match(h,/<span>Au cut<\/span><input type="number" min="0" data-borne="relecture-au"[^>]*value="116"/);
 assert.match(h,/class="sg-principal"[^>]*data-act="legacy:relecture-bornes"[^>]*><span>Reprendre du cut 116 au cut 116<\/span>/);
 assert.match(h,/data-act="legacy:relecture-reprendre"[^>]*><span>Reprendre la relecture au cut 113<\/span>/,'la reprise au cut gardé reste offerte');
 assert.match(h,/data-act="legacy:relecture-arreter-pause"/);
 /* Pause demandée : la reprise au cut gardé reste devant, les bornes suivent. */
 const mic=S.rendre(snap({ar:ar('rel'),relPause:js(P.vue(PAUSE({pauseRaison:'mic',bornesProposees:{debut:113,fin:116}})))}),ui());
 assert.match(mic,/class="sg-principal"[^>]*data-act="legacy:relecture-reprendre"/);assert.match(mic,/data-act="legacy:relecture-bornes"/);
});

test('Signal, lot terminé et relecture arrêtée : la ligne de l’arrêt, les deux champs et « Relancer du cut 116 au cut 116 » ; rien de tel pendant un lot',()=>{
 const h=S.rendre(snap({ar:ar('fini'),relPause:js(P.vue(ARRET())),boutonsOrbite:[b('export-tout','Tout télécharger','primary'),b('new-batch','Nouveau lot')]}),ui());
 assert.match(h,/data-k="relecture-bornes"/);assert.match(h,/Relecture arrêtée au cut 113/);
 assert.match(h,/data-act="legacy:relecture-bornes"[^>]*><span>Relancer du cut 116 au cut 116<\/span>/);
 assert.match(h,/class="sg-principal"[^>]*data-act="legacy:relecture-bornes"/,'arrêt après un défaut : la relance passe devant');
 const fin=S.rendre(snap({ar:ar('fini'),relPause:js(P.vue(ARRET({etat:'finie',message:'Relecture finie.',bornesProposees:{debut:108,fin:116}}))),boutonsOrbite:[b('export-tout','Tout télécharger','primary')]}),ui());
 /* Lot avec des cuts à poser : « Voir ce qui reste » ne repousse pas la relance après un arrêt. */
 assert.match(S.rendre(snap({ar:ar('fini',{differes:6}),relPause:js(P.vue(ARRET())),boutonsOrbite:[b('export-tout','Tout télécharger','primary')]}),ui()),/class="sg-principal"[^>]*data-act="legacy:relecture-bornes"/);
 assert.match(fin,/data-act="legacy:relecture-bornes"/);assert.doesNotMatch(fin,/class="sg-principal"[^>]*data-act="legacy:relecture-bornes"/,'relecture finie : la relance reste au second rang');
 assert.doesNotMatch(S.rendre(snap({ar:ar('cours'),relPause:js(P.vue(ARRET()))}),ui()),/relecture-bornes/);
});

test('téléphone (CH-130) : aucun ordre de bornes, l’ordre est exécuté sans argument',()=>{
 const t=fs.readFileSync(path.join(__dirname,'..','src/telecommande.js'),'utf8'),i=fs.readFileSync(path.join(__dirname,'..','src/telecommande-instantane.js'),'utf8');
 assert.doesNotMatch(t+i,/relecture-bornes|relecture-du|relecture-au/);
 assert.match(t,/await executer\(c\.action\);/,'executer(action) : aucun argument ne passe du téléphone au service worker');
});

test('panneau d’origine : les champs et le bouton existent (Signal y recopie la saisie et les clique)',()=>{
 const h=fs.readFileSync(path.join(__dirname,'..','panel.html'),'utf8');
 assert.match(h,/id="relecture-du"/);assert.match(h,/id="relecture-au"/);assert.match(h,/id="relecture-bornes"/);
});
