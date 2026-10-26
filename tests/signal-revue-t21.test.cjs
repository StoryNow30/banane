'use strict';
/* Revue du code de Signal, test 21 (fiches/SIGNAL_REVUE_T21.md) — ce que Signal doit dire et offrir comme le panneau d'avant :
 *  - D7 : les bornes du prochain lot (champs d'origine `#start` / `#end`) et « Reprise des différés » sont montrées et modifiables dans Signal, au repos
 *    et après « Nouveau lot » ; jamais pendant un lot (« aucun lot ne part sans que tu aies revu ses bornes », panel.js) ;
 *  - D5 : « Ouvrir dans ESV » vise la partie du LOT (le différé lui appartient), pas la partie affichée ;
 *  - D4 / R5 / D6 : la ligne d'avis du panneau en erreur (refus d'une action), l'avis de contrat ESV et la correction interrompue sont dits ;
 *    « J'ai contrôlé le cut » reste offert pendant la relecture ;
 *  - R6 : le temps qui passe (anneau, « en pause depuis ») ne réécrit pas l'écran ;
 *  - R4 : un nombre inconnu n'est pas un zéro (verts pas encore calculés) ; « validés tels quels » ne compte que les validations sans correction ;
 *  - R1 : le résultat de la deuxième passe (en ombre) est dit en fin de lot ;
 *  - G1 : dans la palette, Entrée sur une commande dangereuse demande une seconde Entrée.
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const S=require('../src/signal-rendu.js');
const {monter}=require('./helpers/ui5-page.cjs');
const js=x=>JSON.parse(JSON.stringify(x));

const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ar=(etat,x={})=>({etat,etatTexte:'',horsLigne:false,partie:13,cutEsv:4812,cibles:120,poses:27,differes:4,traites:31,restants:89,cours:4812,dernier:4811,
 bornes:{debut:4790,fin:null},differesListe:[{cut:4809,motif:'Rail non résolu',precision:'rail droit',heure:'15 h 33'},{cut:4803,motif:'Différé',precision:'',heure:'15 h 10'}],
 verts:[],vertsNombre:0,vertsLigne:'',aExaminer:4,lotOuvert:['cours','dem','pause','alerte','p2','rel'].includes(etat),passe2:null,cache:{actif:false},connexionBloquee:false,
 echoEtat:'Aucune séance en cours',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...x});
const sig=(x={})=>({activite:'orbite',statuts:['pose','pose','differe','voie','pose'],allure:{mediane:8.4,parMinute:60/8.4,debutCut:1000,debutPause:null,depuisS:4.2,pauseS:null},
 echo:{mediane:null,marques:[]},connexion:{statut:'ready',reconnect:null},onglet:'ESV · partie 13',historique:null,goto:{present:false,actif:false,raison:'',etat:'',texte:''},
 examines:[],theme:'sombre',f5:null,taille:'normal',...x});
const snap=(x={})=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},avisContrat:'',relecture:{ligne:'',actif:false,interrompue:''},
 boutonsOrbite:[b('pause','Pause','primary'),b('stop','Arrêter le lot','danger')],boutonsEcho:[],
 onglets:[{valeur:'12',texte:'ESV · partie 13'}],ongletChoisi:'12',reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,bandeau:false},
 echo:{visites:'0',corriges:0},echoRows:[],ar:ar('cours'),sig:sig(),...x});
const ui=(x={})=>({tiroir:false,couche:null,sel:null,q:'',pi:0,note:'',...x});

const LOT={id:'L1',scope:{part:13,start:4800,end:999999},state:'RUNNING',processed:[],deferred:[],activeIdentity:{part:13,cut:4812}};
const LOT_FINI={...LOT,state:'COMPLETED',deferred:[{cut:4809,deferredAt:'2026-10-25T13:33:00Z'},{cut:4803}],processed:[{durationMs:6000},{durationMs:8000},{durationMs:7000}]};
const etat=(batch,extra={})=>({batch,current:{identity:{part:13,cut:4812}},connection:{status:'ok'},native:{status:'IDLE',visits:[]},...extra});
const touche=(key,o={})=>({key,ctrlKey:false,altKey:false,target:{tagName:'DIV'},preventDefault(){this.empeche=true;},...o});

/* ------------------------------------------------------------------ D7 */
test('D7 · bornes du prochain lot : au repos et après « Nouveau lot », deux champs (ceux que « Démarrer » lit) et la note du panneau ; jamais pendant un lot',()=>{
 const bp={debut:'4812',fin:'4900',note:'Dernier cut du lot précédent. Modifiable.'};
 const pret=S.rendre(snap({ar:ar('pret',{lotOuvert:false,bornesProchain:bp}),boutonsOrbite:[b('start-batch','Démarrer le lot','primary')]}),ui());
 assert.match(pret,/<input[^>]*data-borne="start"[^>]*value="4812"/);assert.match(pret,/<input[^>]*data-borne="end"[^>]*value="4900"/);
 assert.match(pret,/Dernier cut du lot précédent\. Modifiable\./);
 const vide=S.rendre(snap({ar:ar('pret',{lotOuvert:false,bornesProchain:{debut:'',fin:null,note:''}}),boutonsOrbite:[b('start-batch','Démarrer le lot','primary')]}),ui());
 assert.match(vide,/data-borne="end"[^>]*placeholder="fin de partie"[^>]*value=""/,'vide : jusqu’à la fin de la partie, dit par le champ');
 const nouveau=S.rendre(snap({ar:ar('fini',{lotOuvert:false,bornesProchain:bp}),boutonsOrbite:[b('start-batch','Démarrer le lot','primary'),b('export-tout','Tout télécharger')]}),ui());
 assert.match(nouveau,/data-borne="start"/,'après « Nouveau lot » : les bornes sont revues avant de démarrer');assert.match(nouveau,/data-borne="end"[^>]*value="4900"/);
 const attend=S.rendre(snap({ar:ar('fini',{lotOuvert:false,bornesProchain:null}),boutonsOrbite:[b('export-tout','Tout télécharger','primary'),b('new-batch','Nouveau lot')]}),ui());
 assert.doesNotMatch(attend,/data-borne/,'avant « Nouveau lot » : pas de bornes (le panneau les cache)');
 for(const e of ['cours','pause','dem','alerte','p2','rel'])assert.doesNotMatch(S.rendre(snap({ar:ar(e,{bornesProchain:bp})}),ui()),/data-borne/,e+' : jamais pendant un lot');
 assert.doesNotMatch(S.rendre(snap({ar:ar('pret',{lotOuvert:false,bornesProchain:bp}),sig:sig({activite:'echo'})}),ui()),/data-borne/,'Écho : pas de bornes');
});
test('D7 · « Reprise des différés » : la case d’origine, cochée ou non, et sa note',()=>{
 const r=x=>S.rendre(snap({ar:ar('fini',{lotOuvert:false,bornesProchain:{debut:'4796',fin:'4900',note:''},reprise:x}),boutonsOrbite:[b('start-batch','Démarrer le lot','primary')]}),ui());
 const non=r({coche:false,note:'3 différé(s) dans le lot précédent, du cut 4796 au cut 4809.'});
 assert.match(non,/<input type="checkbox" data-act="legacy:lot-reprise"(?! checked)/);assert.match(non,/3 différé\(s\) dans le lot précédent/);
 assert.match(r({coche:true,note:''}),/data-act="legacy:lot-reprise" checked/);
 assert.doesNotMatch(r(null),/lot-reprise/);
});
test('D7 · dans la page : les bornes viennent des champs d’origine (pas du lot fini) tant que le panneau les montre ; la case clique celle d’origine',async()=>{
 const p=await monter({etat:etat(null)});
 for(const id of ['lot-bornes','start-batch'])p.els[id].hidden=false;p.els['lot-reprise-row'].hidden=true;
 p.els.start.value='4812';p.els.end.value='4900';p.els['bornes-note'].textContent='Dernier cut du lot précédent. Modifiable.';
 assert.deepEqual(js(p.ui.instantane(etat(null)).ar.bornesProchain),{debut:'4812',fin:'4900',note:'Dernier cut du lot précédent. Modifiable.'});
 p.els.end.value='999999';assert.equal(p.ui.instantane(etat(null)).ar.bornesProchain.fin,null,'« 999999 » : fin de partie, jamais affichée');
 p.els.end.value='4950';
 assert.equal(p.ui.instantane(etat(LOT_FINI)).ar.bornesProchain.fin,'4950','après « Nouveau lot » : le champ, pas la fin du lot fini');
 p.els['lot-bornes'].hidden=true;assert.equal(p.ui.instantane(etat(LOT_FINI)).ar.bornesProchain,null,'bornes cachées par le panneau (lot ouvert, ou « Nouveau lot » pas choisi)');
 p.els['lot-bornes'].hidden=false;p.els['start-batch'].hidden=true;assert.equal(p.ui.instantane(etat(LOT_FINI)).ar.bornesProchain,null,'sans « Démarrer le lot » : rien');
 p.els['start-batch'].hidden=false;assert.equal(p.ui.instantane(etat(LOT_FINI)).ar.reprise,null);
 p.els['lot-reprise-row'].hidden=false;p.els['lot-reprise'].checked=true;p.els['lot-reprise-note'].textContent='2 différé(s)';
 assert.deepEqual(js(p.ui.instantane(etat(LOT_FINI)).ar.reprise),{coche:true,note:'2 différé(s)'});
 p.ui.agir('legacy:lot-reprise');assert.equal(p.els['lot-reprise'].clics,1,'la case d’origine (son gestionnaire remplit les bornes)');
 assert.deepEqual(js(p.envoyes),[]);
});

/* ------------------------------------------------------------------ D5 */
test('D5 · « Ouvrir dans ESV » vise la partie du lot, même quand ESV affiche une autre partie ; sans lot, la partie affichée',async()=>{
 const p=await monter({etat:{...etat(LOT_FINI),current:{identity:{part:14,cut:20}}}});
 p.ui.agir('sg:ouvrir:4812');assert.equal(p.els['goto-cut-cible'].value,'13:4812','le différé 4812 est celui de la partie 13 (le moteur refusera WRONG_PART, et le dira)');
 assert.equal(p.els['goto-cut'].clics,1);
 p.ctx.etatPanneau={...etat(null),current:{identity:{part:14,cut:20}}};p.ui.agir('sg:ouvrir:30');assert.equal(p.els['goto-cut-cible'].value,'14:30');
 assert.deepEqual(js(p.envoyes),[]);
});

/* ------------------------------------------------------------------ R6 */
/* ------------------------------------------------------------------ R1 */
/* ------------------------------------------------------------------ G1 */