'use strict';
/* CH-137 (D-371, D-372) : l'interface alternative « Mix » (planche Figma « Q4 sombre (mix strict) », banane-data maquettes/figma-signal-mix-q4/),
 * partie pure (src/mix-rendu.js). Ce qui est prouvé ici, sans navigateur :
 *  - Mix dessine les MÊMES commandes que Glacier (Signal) : mêmes `data-act` dans le même ordre, mêmes boutons grisés, mêmes champs, sur chaque état
 *    d'Orbite et d'Écho et dans chaque couche ; seuls écarts permis : ce qui est marqué `data-mx-extra` (raccourcis vers des commandes que Glacier
 *    offre déjà ailleurs, vérifié ici) et la ligne « Palette » des Réglages, retirée en Mix (la palette ne vaut que pour Glacier) ;
 *  - la tuile d'état porte le gros chiffre et sa légende, et la réglette graduée, tirés de l'instantané : rien quand la donnée manque ;
 *  - l'icône d'état de la planche remplace le glyphe ; le pied « Cache des exports » est sur chaque écran ;
 *  - aucun message au service worker, rien d'un serveur, la feuille est sous #ui5.u-mix seul.
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=path.join(__dirname,'..'),lire=f=>fs.readFileSync(path.join(R,f),'utf8');
const S=require('../src/signal-rendu.js');
const M=require('../src/mix-rendu.js');

const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ar=(etat,x={})=>({etat,etatTexte:'',horsLigne:false,partie:13,cutEsv:4812,cibles:40,poses:18,differes:2,traites:21,restants:19,cours:4812,dernier:4811,
 bornes:{debut:4790,fin:4829},differesListe:[{cut:4809,motif:'Rail non résolu',precision:'rail droit',heure:'15 h 33'},{cut:4801,motif:'À poser',precision:'',heure:'15 h 10'}],
 verts:[],vertsNombre:0,vertsLigne:'',aExaminer:2,lotOuvert:['cours','dem','pause','alerte','p2','rel'].includes(etat),passe2:null,cache:{actif:false},connexionBloquee:false,
 echoEtat:'Aucune séance en cours',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...x});
const ST=['pose','pose','pose','pose','pose','pose','pose','pose','pose','pose','pose','differe','pose','pose','pose','pose','pose','pose','pose','differe','pose'];
const sig=(x={})=>({activite:'orbite',statuts:ST,allure:{mediane:6.6,parMinute:9,debutCut:1000,debutPause:null,depuisS:4.2,pauseS:null},
 echo:{mediane:null,marques:[]},connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV · onglet 2',historique:null,goto:{present:true,actif:true,raison:'',etat:'',texte:''},
 examines:[],theme:'sombre',palette:'glacier',f5:null,taille:'normal',fil:[],...x});
const snap=(x={})=>({variante:'mix',mode:'automatic',notice:{texte:'',erreur:false},boutonsOrbite:[b('pause','Pause','primary'),b('stop','Arrêter le lot','danger')],boutonsEcho:[],
 onglets:[{valeur:'12',texte:'ESV · onglet 2'}],ongletChoisi:'12',reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,bandeau:false,ajustement:true},
 relectureModifiable:true,echo:{visites:'0',corriges:0},echoRows:[],ar:ar('cours'),sig:sig(),...x});
const ui=(x={})=>({tiroir:false,couche:null,sel:null,q:'',pi:0,note:'',...x});

const SCENES={
 pret:snap({ar:ar('pret',{traites:0,poses:0,differes:0,restants:null,cours:null,dernier:null,differesListe:[],lotOuvert:false,bornesProchain:{debut:'1',fin:null,note:''}}),sig:sig({statuts:[]}),
  boutonsOrbite:[b('start-batch','Démarrer le lot','primary')]}),
 cours:snap(),
 dem:snap({ar:ar('dem')}),
 pause:snap({ar:ar('pause',{cours:null}),boutonsOrbite:[b('resume','Reprendre','primary'),b('new-batch','Nouveau lot'),b('stop','Arrêter le lot','danger')],sig:sig({allure:{mediane:6.6,parMinute:9,debutPause:500,pauseS:42}})}),
 toi:snap({ar:ar('alerte',{etatTexte:'À toi',alerte:'Le cut 4812 a un rail qu’Ariane ne sait pas poser.'}),boutonsOrbite:[b('retry','Réessayer','primary'),b('manual-takeover','Reprendre à la main'),b('explicit-skip','Passer ce cut','danger'),b('stop','Arrêter le lot','danger')]}),
 incertain:snap({ar:ar('alerte',{etatTexte:'Résultat incertain',alerte:'L’opération sur le cut 4812 n’a pas été confirmée.'}),boutonsOrbite:[b('close-uncertain','Archiver le résultat interrompu','primary'),b('stop','Arrêter le lot','danger')]}),
 p2:snap({ar:ar('p2',{passe2:{cut:4809,ecrites:1,demandees:2}}),boutonsOrbite:[]}),
 rel:snap({ar:ar('rel'),relPause:{ligne:'Relecture : 5 relus sur 18',pause:{texte:'Mettre en pause',actif:true},arreter:true},relChiffres:{faits:5,total:18,corriges:1,lot:true,etat:'en-cours'},boutonsOrbite:[b('relecture-arreter','Arrêter la relecture','danger')]}),
 relpause:snap({ar:ar('rel'),relPause:{ligne:'Relecture en pause',reprendre:{texte:'Reprendre la relecture',actif:true},arreter:true,bornes:{action:'reprendre',texte:'Reprendre du cut 4800 au cut 4829',actif:true,debut:4800,fin:4829}},
  boutonsOrbite:[b('relecture-acquitter','J’ai contrôlé le cut 4805','primary'),b('stop','Arrêter le lot','danger')],relecture:{ligne:'',actif:false,interrompue:'Correction interrompue au cut 4805.'}}),
 arrete:snap({ar:ar('arrete',{lotOuvert:false,cours:null}),boutonsOrbite:[b('resume','Continuer ce lot','primary'),b('new-batch','Préparer un autre lot'),b('export-tout','Exporter le dossier')]}),
 fini:snap({ar:ar('fini',{traites:40,poses:38,restants:0,cours:null,dernier:4829,lotOuvert:false,cache:{actif:true}}),sig:sig({statuts:[...ST,...Array(19).fill('pose')]}),exportTexte:'prêt',
  boutonsOrbite:[b('new-batch','Nouveau lot','primary'),b('export-tout','Exporter le dossier')]}),
 sansTotal:snap({ar:ar('cours',{cibles:null,restants:null})}),
 hors:snap({ar:ar('pret',{horsLigne:true,traites:0,poses:0,differes:0,differesListe:[],lotOuvert:false}),sig:sig({statuts:[],connexion:{statut:'no-tab',tabId:null,nomme:false,reconnect:null},onglet:''}),onglets:[],boutonsOrbite:[b('start-batch','Démarrer le lot','primary')]}),
 echo:snap({mode:'native',ar:ar('pret',{lotOuvert:false,echoEtat:'Collecte en cours'}),sig:sig({activite:'echo',echo:{mediane:12,marques:[false,true,false,false,true]}}),
  boutonsEcho:[b('native-pause','Pause','primary'),b('native-end','Terminer la séance','danger')],echo:{visites:'5',corriges:2,valides:3}}),
};
const COUCHES=[ui(),ui({details:true}),ui({tiroir:true}),ui({couche:'menu'}),ui({couche:'reglages'}),ui({couche:'palette'}),ui({couche:'esv'}),ui({vueLot:'fil'})];

/* Les extras de Mix (raccourcis de la barre, pied « Cache des exports ») sont retirés avant la comparaison ; la ligne « Palette » aussi, côté Glacier. */
const sansExtras=h=>h.replace(/<(div|button|footer)\b[^>]*data-mx-extra[^>]*>[\s\S]*?<\/\1>/g,'');
const sansPalette=h=>h.replace(/data-act="sg:choix:palette:[a-z]+"/g,'');
const acts=h=>[...h.matchAll(/data-act="([^"]+)"/g)].map(m=>m[1]);
const grises=h=>[...h.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]).filter(t=>/\sdisabled\b/.test(t)).map(t=>(t.match(/data-act="([^"]+)"/)||[])[1]||'?');
const champs=h=>[...h.matchAll(/data-(?:borne|sel)="([^"]+)"/g)].map(m=>m[1]);

test('CH-137 : Mix garde les commandes de Glacier, dans le même ordre, avec les mêmes boutons grisés et les mêmes champs',()=>{
 for(const [nom,s] of Object.entries(SCENES))for(const u of COUCHES){
  const hs=sansPalette(S.rendre(s,u)),hm=M.rendre(s,u),hx=sansExtras(hm),k=`${nom} ${JSON.stringify(u.couche||u.details||u.tiroir||u.vueLot||'')}`;
  assert.deepEqual(acts(hx),acts(hs),k+' : mêmes data-act dans le même ordre');
  assert.deepEqual(grises(hx),grises(hs),k+' : mêmes boutons grisés');
  assert.deepEqual(champs(hx),champs(hs),k+' : mêmes champs');
  assert.match(hm,/^<div class="sg-fen" data-activite="[^"]*" data-etat="[^"]*" data-teinte="[^"]*"/,k+' : même fenêtre (ui5.js en lit la clé)');
  /* un extra ne mène qu'à une commande que Glacier offre déjà (dans son menu) */
  const menu=acts(S.rendre(s,ui({couche:'menu'})));
  for(const m of hm.matchAll(/<(?:div|button|footer)\b[^>]*data-mx-extra[^>]*>[\s\S]*?<\/(?:div|button|footer)>/g))for(const a of acts(m[0]))assert.ok(menu.includes(a),k+' : extra '+a+' déjà offert par Glacier');
 }
});

const compte=h=>(h.match(/<div class="mx-compte"[\s\S]*?<\/div><\/div>/)||[''])[0];
const reglette=h=>(h.match(/<div class="mx-reglette"[\s\S]*?<\/svg><\/div>/)||[''])[0];
const n=(h,re)=>(h.match(re)||[]).length;
test('CH-137 : le gros chiffre et sa légende, tirés de l’instantané',()=>{
 const c=compte(M.rendre(SCENES.cours,ui()));
 assert.match(c,/<b class="mx-chiffre">21<\/b>/);assert.match(c,/traités sur 40 ciblés/);assert.match(c,/<b>18<\/b> posés · <b>2<\/b> à poser/);
 const p=compte(M.rendre(SCENES.pret,ui()));
 assert.match(p,/<b class="mx-chiffre">40<\/b>/);assert.match(p,/cuts ciblés · aucun traité/);
 const t=compte(M.rendre(SCENES.sansTotal,ui()));
 assert.match(t,/<b class="mx-chiffre">21<\/b>/);assert.doesNotMatch(t,/ciblés/,'total inconnu : rien d’inventé');
 const r=compte(M.rendre(SCENES.rel,ui()));
 assert.match(r,/<b class="mx-chiffre">5<\/b>/);assert.match(r,/relus sur 18/);assert.match(r,/<b>1<\/b> corrigé/);
 const e=compte(M.rendre(SCENES.echo,ui()));
 assert.match(e,/<b class="mx-chiffre">5<\/b>/);assert.match(e,/cuts vus/);assert.match(e,/<b>2<\/b> corrigés · <b>3<\/b> validés tels quels/);
 /* la planche ne porte pas de chiffre quand l'opérateur doit agir, pendant le rattrapage, hors ligne, ni à la fin (le bilan le dit) */
 for(const k of ['toi','incertain','p2','hors','fini','arrete'])assert.equal(compte(M.rendre(SCENES[k],ui())),'',k);
 for(const [k,s] of Object.entries(SCENES))assert.doesNotMatch(M.rendre(s,ui()),/class="sg-anneau/,k+' : plus d’anneau');
});
test('CH-137 : la réglette graduée (0, milieu, N), l’aiguille ambre pendant le lot, claire en pause ; aucune sans total',()=>{
 const c=reglette(M.rendre(SCENES.cours,ui()));
 assert.ok(c);assert.match(c,/aria-label="21 traités sur 40 ciblés, 2 à poser"/);
 assert.match(c,/<span>0<\/span><span>20<\/span><span>40<\/span>/);
 assert.equal(n(c,/class="mx-marque"/g),2,'une marque par cut à poser');
 assert.match(c,/class="mx-aiguille" data-ton="marche"/);
 assert.match(reglette(M.rendre(SCENES.pause,ui())),/class="mx-aiguille" data-ton="pause"/);
 const r=reglette(M.rendre(SCENES.pret,ui()));
 assert.ok(r,'prêt : réglette vide');assert.doesNotMatch(r,/mx-aiguille|mx-fait/);
 assert.equal(reglette(M.rendre(SCENES.sansTotal,ui())),'','total inconnu : pas de réglette');
 const e=reglette(M.rendre(SCENES.echo,ui()));
 assert.equal(n(e,/class="mx-visite"/g),3,'une visite validée telle quelle par trait court');assert.equal(n(e,/class="mx-visite mx-corr"/g),2);assert.equal(n(e,/class="mx-visite mx-en"/g),1);
});
test('CH-137 : l’icône d’état de la planche remplace le glyphe ; le pied « Cache des exports » est sur chaque écran',()=>{
 for(const [k,s] of Object.entries(SCENES)){const h=M.rendre(s,ui());
  assert.match(h,/<i class="sg-glyphe mx-ic" data-g="[^"]+" data-ton="[^"]+" aria-hidden="true"><svg/,k);
  assert.match(h,/<div class="mx-pied" data-mx-extra="1"><span class="mx-cache">Cache des exports/,k);}
 assert.match(M.rendre(SCENES.cours,ui()),/Cache des exports<\/span><span class="sg-r"> · vidable après le lot<\/span>/);
 assert.match(M.rendre(SCENES.fini,ui()),/data-act="legacy:export-cache-clear">Vider le cache/);
});
test('CH-137 : en Mix, la ligne « Palette » des Réglages disparaît ; Glacier la garde',()=>{
 assert.doesNotMatch(M.rendre(SCENES.cours,ui({couche:'reglages'})),/<span>Palette<\/span>/);
 assert.match(S.rendre({...SCENES.cours,variante:'signal'},ui({couche:'reglages'})),/<span>Palette<\/span>/);
});
test('CH-137 : la vue fil (CH-134) : un seul bouton sg:vue-lot, data-vue="fil" sur la fenêtre',()=>{
 const nb=h=>(h.match(/data-act="sg:vue-lot"/g)||[]).length;
 for(const k of ['cours','pause','arrete','fini','toi'])assert.equal(nb(M.rendre(SCENES[k],ui())),1,k);
 assert.match(M.rendre(SCENES.cours,ui({vueLot:'fil'})),/^<div class="sg-fen" data-activite="orbite" data-etat="cours" data-teinte="[^"]*" data-vue="fil">/);
});
test('CH-137 : aucun message au service worker, rien d’un serveur, tout sous #ui5.u-mix, fichiers chargés par panel.html',()=>{
 const src=lire('src/mix-rendu.js'),css=lire('panel-mix.css'),html=lire('panel.html');
 assert.doesNotMatch(src,/chrome\.|sendMessage|fetch\(|document\.|window\./,'mix-rendu est pur');
 assert.doesNotMatch(css,/url\((?!fonts\/)/);assert.doesNotMatch(css,/https?:/);assert.doesNotMatch(css,/gradient\(/,'aucun dégradé');
 for(const f of css.matchAll(/url\((fonts\/[^)]+)\)/g))assert.ok(fs.existsSync(path.join(R,f[1])),f[1]);
 const sels=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@font-face\{[^}]*\}/g,'').replace(/@media[^{]*\{/g,'').replace(/@keyframes [a-z-]+\{/g,'').match(/[^{}]+(?=\{)/g)||[];
 const haut=s=>{const o=[];let d=0,c='';for(const x of s){if(x==='('||x==='[')d++;if(x===')'||x===']')d--;if(x===','&&!d){o.push(c);c='';}else c+=x;}o.push(c);return o;};
 for(const s of sels)for(const p of haut(s))assert.match(p.trim(),/^(#ui5\.u-mix|body\.ui5:has\(#ui5\.u-mix|\.sg-tech\[data-variante="mix"\]|from|to|\d+%)/,'tout est sous #ui5.u-mix : '+p.trim());
 const iM=html.indexOf('src/mix-rendu.js'),iU=html.indexOf('src/ui5.js'),iS=html.indexOf('src/signal-rendu.js');
 assert.ok(iS>0&&iM>iS&&iU>iM,'signal-rendu, puis mix-rendu, puis ui5');
 assert.ok(html.indexOf('panel-mix.css')>html.indexOf('panel-signal.css'));
 /* jetons exacts de la planche */
 for(const c of ['#121314','#1a1b1d','#222427','#ecedee','#a6a9ad','#f2b65a','#f2806f'])assert.ok(css.toLowerCase().includes(c),c);
});
test('CH-137 (retour de la mère) : le rail de la Constellation n’écrit que des numéros de partie connus : ni « +1 », ni « ? »',()=>{
 const s=snap({ar:ar('pret',{lotOuvert:false}),file:{etat:'repos',actif:false,n:3,rang:0,etatTexte:'prête',phrase:'',bilan:[],plan:null}});
 const chaine=h=>(h.match(/<ol class="sg-chaine[\s\S]*?<\/ol>/)||[''])[0];
 assert.match(chaine(S.rendre(s,ui({onglet:'file'}))),/>\+1</,'Glacier écrit « +1 » (la scène prouve quelque chose)');
 const m=chaine(M.rendre(s,ui({onglet:'file'})));
 assert.ok(m);assert.doesNotMatch(m,/>\+\d+<|>\?</);
});
test('CH-137 (retour de la mère) : le bouton de vue dit « Vue du lot » / « Vue fil », jamais « Vue instrument »',()=>{
 for(const r of [S,M]){
  assert.match(r.rendre(SCENES.cours,ui()),/aria-label="Vue fil" title="Vue fil"/);
  const f=r.rendre(SCENES.cours,ui({vueLot:'fil'}));
  assert.match(f,/aria-label="Vue du lot" title="Vue du lot"/);assert.doesNotMatch(f,/Vue instrument/);
 }
});
