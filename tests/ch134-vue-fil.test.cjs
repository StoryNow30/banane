'use strict';
/* CH-134 (D-368) — LA VUE « FIL » DU LOT DANS ORBITE (src/signal-rendu.js, partie pure ; télécommande : src/telecommande-instantane.js).
 *  - Orbite, lot ouvert : un bouton d'icône (`sg:vue-lot`) dans la ligne d'état, libellé accessible « Vue fil » (vue instrument, par défaut) ou
 *    « Vue instrument » (vue fil), `aria-pressed` dit la vue fil ;
 *  - vue fil : la fenêtre porte `data-vue="fil"`, la tuile du fil des cuts est rendue en entier (le plus récent en haut), même pendant une
 *    Constellation (pas la trace réduite de la ligne « Constellation ») ;
 *  - pas de bouton au repos, ni dans Écho, la Constellation, l'Aurore ;
 *  - la télécommande garde le geste (navigation locale, rien n'est envoyé à Ariane).
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../src/signal-rendu.js'),I=require('../src/telecommande-instantane.js');
const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ar=(etat,x={})=>({etat,etatTexte:'',horsLigne:false,partie:13,cutEsv:4812,cibles:120,poses:27,differes:4,traites:31,restants:89,cours:4812,dernier:4811,
 bornes:{debut:4790,fin:null},differesListe:[],verts:[],vertsNombre:0,vertsLigne:'',aExaminer:0,lotOuvert:['cours','dem','pause','alerte','p2','rel'].includes(etat),passe2:null,cache:{actif:false},connexionBloquee:false,
 echoEtat:'Aucune séance en cours',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...x});
const FIL=[{cut:4811,statut:'pose',dureeS:7.2},{cut:4810,statut:'differe',dureeS:9.1,detail:'rail droit'},{cut:4809,statut:'pose',dureeS:6.4},{cut:4808,statut:'voie',dureeS:5.9},{cut:4807,statut:'pose',dureeS:6.0}];
const sig=(x={})=>({activite:'orbite',statuts:['pose','pose','differe','voie','pose'],allure:{mediane:8.4,parMinute:60/8.4,debutCut:1000,debutPause:null,depuisS:4.2,pauseS:null},
 echo:{mediane:null,marques:[]},connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV · partie 13',historique:null,goto:{present:false,actif:false,raison:'',etat:'',texte:''},
 examines:[],theme:'sombre',f5:null,taille:'normal',fil:FIL,...x});
const snap=(x={})=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},boutonsOrbite:[b('pause','Pause','primary'),b('stop','Arrêter le lot','danger')],boutonsEcho:[],
 onglets:[{valeur:'12',texte:'ESV · partie 13'}],ongletChoisi:'12',reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,bandeau:false},
 echo:{visites:'0',corriges:0},echoRows:[],ar:ar('cours'),sig:sig(),...x});
const ui=(x={})=>({tiroir:false,couche:null,sel:null,q:'',pi:0,note:'',...x});
const bouton=h=>(h.match(/<button[^>]*data-act="sg:vue-lot"[^>]*>[\s\S]*?<\/button>/)||[])[0]||'';

test('Orbite, lot en cours, vue instrument (défaut) : bouton « Vue fil », non pressé ; pas de data-vue',()=>{
 const h=S.rendre(snap(),ui()),B=bouton(h);
 assert.ok(B,'le bouton de vue est là');
 assert.match(B,/aria-label="Vue fil"/);assert.match(B,/aria-pressed="false"/);assert.match(B,/<svg[^>]*aria-hidden="true"/);
 assert.doesNotMatch(h,/data-vue="fil"/);
 /* le bouton est dans la ligne d'état de la tuile, pas dans le pied */
 const haut=(h.match(/<div class="sg-haut">[\s\S]*?<\/div><div class="sg-milieu">/)||[])[0]||'';assert.ok(haut.includes('sg:vue-lot'),'dans la ligne d’état');
});

test('vue fil : data-vue="fil", bouton « Vue instrument » pressé, fil complet du plus récent au plus ancien',()=>{
 const h=S.rendre(snap(),ui({vueLot:'fil'})),B=bouton(h);
 assert.match(h,/class="sg-fen" data-activite="orbite"[^>]*data-vue="fil"/);
 assert.match(B,/aria-label="Vue instrument"/);assert.match(B,/aria-pressed="true"/);
 const cuts=[...h.matchAll(/<li data-k="f(\d+)"/g)].map(m=>+m[1]);
 assert.deepEqual(cuts,[4811,4810,4809,4808,4807],'tous les cuts du fil, le plus récent en haut');
 assert.match(h,/class="sg-tu sg-tu-fil[^"]*" data-k="fil"/);
});

test('vue fil pendant une Constellation : la tuile du fil, pas la trace réduite de la ligne « Constellation »',()=>{
 const file={etat:'lot',actif:true,etatTexte:'partie 2 sur 3',phrase:'Partie 13',secondaire:{texte:'Arrêter la Constellation',actif:true},bilan:[],alerte:null};
 const s=snap({file,ar:ar('cours',{file:true})});
 const inst=S.rendre(s,ui()),fil=S.rendre(s,ui({vueLot:'fil'}));
 assert.ok(bouton(inst)&&bouton(fil));
 assert.match(fil,/data-k="fil"/);assert.doesNotMatch(inst,/data-k="fil"/,'vue instrument : la trace réduite, dans la ligne « Constellation »');
 assert.equal([...fil.matchAll(/<li data-k="f\d+"/g)].length,5);
});

test('pas de bouton de vue au repos, dans Écho, la Constellation ni l’Aurore',()=>{
 assert.equal(bouton(S.rendre(snap({ar:ar('pret',{traites:0,poses:0,differes:0})}),ui())),'','repos');
 assert.equal(bouton(S.rendre(snap({ar:ar('pret',{traites:0,poses:0,differes:0})}),ui({vueLot:'fil'}))),'','repos, vue fil gardée');
 assert.doesNotMatch(S.rendre(snap({ar:ar('pret',{traites:0,poses:0,differes:0})}),ui({vueLot:'fil'})),/data-vue="fil"/);
 assert.equal(bouton(S.rendre(snap({mode:'native',sig:sig({activite:'echo'})}),ui({vueLot:'fil'}))),'','Écho');
 assert.equal(bouton(S.rendre(snap(),ui({onglet:'correction'}))),'','Aurore');
});

test('télécommande : « sg:vue-lot » est une navigation locale, gardée par le filtre, jamais un ordre',()=>{
 assert.ok(I.NAVIGATION.includes('sg:vue-lot'));
 assert.equal(I.ordreDe('sg:vue-lot',{boutons:{}}),null);
 const h=S.rendre(snap(),ui());assert.ok(bouton(I.filtrer(h,{boutons:{}})),'le bouton reste sur le téléphone');
});
