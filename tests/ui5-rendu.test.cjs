'use strict';
/* 4.9.5 test 10-ui — L'HABILLAGE DU PANNEAU, partie pure (src/ui5-rendu.js) et ses liens avec le panneau d'origine (panel.html).
 *  - un seul bouton principal par état, choisi par le panneau ; pendant la relecture, « Arrêter la relecture » passe devant et l'export descend ;
 *  - aucune case, aucun bouton radio, aucune liste sur l'écran de séance ; les listes ne sont que dans Réglages ;
 *  - tout texte venu du panneau est échappé ;
 *  - chaque action de l'habillage désigne un élément qui existe dans panel.html (clic sur le bouton d'origine), jamais un message nouveau. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../src/ui5-rendu.js');
const racine=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const html=lire('panel.html'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const base={variante:'linear',mode:'automatic',contexte:'ESV · partie 13 · cut 4812',partie:13,cutEsv:4812,notice:{texte:'Orbite enchaîne les cuts.',erreur:false},avisContrat:'',connexionOuverte:false,
 lot:{etat:'En cours · pose des rails',ton:'live',cut:'4812',pct:26,traites:'31',traitesUnite:'/ 120 invalides',compteurs:[{label:'Posés',valeur:'27',sous:''},{label:'Différés',valeur:'4',sous:''}],finPartie:''},
 relecture:{ligne:'',actif:false,interrompue:''},echo:{etat:'',ton:'ink',visites:'0',corriges:0},
 rows:[{cut:'4812',statut:'cours',texte:'Pose des rails',ecart:'',ordre:22,rang:0},{cut:'4809',statut:'differe',texte:'Différé',ecart:'',ordre:19,rang:1},{cut:'4811',statut:'pose',texte:'Posé par le moteur',ecart:'2 mm',ordre:21,rang:2}],aPoser:88,echoRows:[],
 reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,raison:false,touches:'chiffres',bandeau:false},exportTexte:'',onglets:[{valeur:'1',texte:'ESV'}],ongletChoisi:'1',connexionNote:'',gcv2:{total:2684,date:'19/10/2026',session:0},
 boutons:[b('pause','Pause','primary'),b('export-tout','Tout télécharger pour l’analyse'),b('stop','Arrêter le lot','danger')]};
const avec=(o)=>({...base,...o});

test('le bouton principal est celui du panneau ; une relecture en cours passe devant et rejette l’export dans les autres actions',()=>{
 const m=R.modele(base);assert.equal(m.primaire.id,'pause');assert.deepEqual(m.autres.map(x=>x.id),['export-tout','stop']);
 const rel=R.modele(avec({boutons:[b('export-tout','Tout télécharger','primary'),b('relecture-arreter','Arrêter la relecture'),b('relecture-lancer','Lancer la relecture')],relecture:{ligne:'Relecture 12 sur 85',actif:true,interrompue:''}}));
 assert.equal(rel.primaire.id,'relecture-arreter');assert.ok(rel.autres.some(x=>x.id==='export-tout'),'l’export reste possible, mais pas en avant');assert.equal(rel.phrase,'Relecture 12 sur 85');
 const ack=R.modele(avec({boutons:[b('relecture-acquitter','J’ai contrôlé le cut 4903'),b('relecture-arreter','Arrêter')],relecture:{ligne:'',actif:true,interrompue:'Une correction a été interrompue au cut 4903.'}}));
 assert.equal(ack.primaire.id,'relecture-acquitter');assert.match(ack.phrase,/interrompue au cut 4903/);
 const echo=R.modele(avec({mode:'native',boutons:[b('native-end','Terminer et télécharger','primary'),b('native-pause','Pause'),b('native-discard','Abandonner')],echo:{etat:'Collecte en cours · observation',ton:'live',visites:'148',corriges:61}}));
 assert.equal(echo.primaire.id,'native-end');assert.ok(!echo.autres.some(x=>x.id==='native-discard'),'l’abandon vit dans Réglages');assert.equal(echo.gros,'148');
 assert.equal(R.modele(avec({boutons:[]})).primaire,null,'sans bouton principal, aucun n’est inventé');
});

test('écran de séance : aucune case, aucun bouton radio, aucune liste (seule la ligne de recherche de Raycast est un champ) ; Réglages : des listes',()=>{
 for(const v of R.VARIANTES)for(const mode of ['home','automatic','native']){
  const s=R.rendre(v,avec({variante:v,mode}),{sel:null,palette:false,q:'',pi:0},'seance');
  assert.ok(s.length>200,v+' '+mode);assert.ok(!/<select|type="checkbox"|type="radio"/.test(s),v+' '+mode);
  assert.ok(!/<input(?![^>]*id="ui5-q")/.test(s),v+' '+mode+' : seul le champ de recherche est permis');
 }
 for(const v of R.VARIANTES){const s=R.rendre(v,avec({variante:v}),{sel:null,palette:false,q:'',pi:0},'reglages');
  assert.ok((s.match(/<select/g)||[]).length>=5,v);for(const nom of ['relecture','clic','grappe','raison','variante'])assert.ok(s.includes(`data-sel="${nom}"`),v+' '+nom);}
});

test('tout texte du panneau est échappé avant d’entrer dans le HTML',()=>{
 const piege='<img src=x onerror=alert(1)>"\'&';
 const s0=avec({notice:{texte:piege,erreur:true},avisContrat:piege,rows:[{cut:piege,statut:'differe',texte:piege,ecart:piege,ordre:1,rang:0}],boutons:[b('pause',piege,'primary')],
  lot:{...base.lot,etat:piege,cut:piege,compteurs:[{label:piege,valeur:piege,sous:piege}]},onglets:[{valeur:piege,texte:piege}]});
 for(const v of R.VARIANTES)for(const e of ['seance','reglages']){const s=R.rendre(v,{...s0,variante:v},{sel:null,palette:true,q:piege,pi:0},e);
  assert.ok(!/<img/.test(s),v+' '+e);assert.ok(!/onerror=alert\(1\)>/.test(s.replace(/&lt;img[^&]*&gt;/g,'')),v+' '+e);}
});

test('la palette filtre sans tenir compte des accents ni de la casse, et ne propose que des actions que le panneau offre',()=>{
 const m=R.modele(base),c=R.commandes(base,m);
 assert.ok(R.filtrer(c,'apres').some(x=>x.nom==='Après le lot'));assert.ok(R.filtrer(c,'PAUSE').some(x=>x.act==='legacy:pause'));assert.equal(R.filtrer(c,'zzzz').length,0);
 for(const x of c)assert.match(x.act,/^(legacy:[a-z-]+|mode:(automatic|native)|ecran:reglages|variante:(ancienne|ariane2))$/,x.act);
 const grise=R.commandes(avec({boutons:[b('pause','Pause','primary',false)]}),R.modele(avec({boutons:[b('pause','Pause','primary',false)]})));
 assert.ok(grise.some(x=>x.act==='legacy:pause'),'un bouton désactivé reste visible (désactivé) plutôt que de disparaître');
});

test('chaque action de l’habillage désigne un élément qui existe dans panel.html (clic sur le bouton d’origine)',()=>{
 const src=lire('src/ui5.js'),listes=[...src.matchAll(/const ORDRE_(?:ORBITE|ECHO) = \[([^\]]+)\]/g)].flatMap(m=>[...m[1].matchAll(/'([a-z-]+)'/g)].map(x=>x[1]));
 assert.ok(listes.length>=18);for(const id of listes)assert.ok(ids.has(id),'bouton absent de panel.html : '+id);
 for(const id of ['tab-native','tab-automatic','bandeau-toggle','theme-toggle','connect','export-cache-clear','native-discard','grappe-differes','raison-actif','tabs','ui5-essai',
  ...['coupee','ombre','corriger'].map(x=>'relecture-'+x),...['tel-quel','gauche-recentre','tout-recentre'].map(x=>'clic-'+x),...['chiffres','alt-chiffres','pave'].map(x=>'raison-touches-'+x)])
  assert.ok(ids.has(id),id);
 for(const v of R.VARIANTES){const s=R.rendre(v,avec({variante:v}),{sel:null,palette:true,q:'',pi:0},'seance')+R.rendre(v,avec({variante:v}),{sel:null,palette:false,q:'',pi:0},'reglages');
  for(const m of s.matchAll(/data-act="legacy:([a-z-]+)"/g))assert.ok(ids.has(m[1]),v+' : '+m[1]);}
});

test('trois présentations, un ruban et une liste dessinés avec les cuts du lot ; une sélection par défaut sur le cut en cours',()=>{
 const lin=R.rendre('linear',base,{sel:null,palette:false,q:'',pi:0},'seance');
 assert.match(lin,/<div class="row s" data-row="0"><span class="ic cours"><\/span><span class="c">4812<\/span>/);assert.match(lin,/Différés <span class="n">1<\/span>/);assert.match(lin,/À poser <span class="n">88<\/span>/);
 const fig=R.rendre('figma',base,{sel:null,palette:false,q:'',pi:0},'seance');
 assert.equal((fig.match(/class="cell /g)||[]).length,3+88);assert.match(fig,/cell now sel/);assert.match(fig,/<h3>Cut 4812<\/h3>/);
 const ray=R.rendre('raycast',base,{sel:null,palette:false,q:'',pi:0},'seance');assert.match(ray,/class="o s" data-act="legacy:pause"/);assert.match(ray,/Pause <kbd>↵<\/kbd>/);
});

/* 4.9.6 test 1 — présentation « Ariane » : dessinée à partir de `snap.ar` (src/ui5.js) et des boutons du panneau. */
const RA=require('../src/ui5-rendu.js');
const arBase=(etat,extra={})=>({etat,traites:31,poses:27,differes:4,cibles:120,restants:89,cours:4812,dernier:4811,partie:13,differesListe:[{cut:4787,motif:'Rail non résolu',precision:'rail droit',heure:'17 h 21'}],parcours:Array(31).fill('pose'),verts:[],vertsNombre:0,aExaminer:4,lotOuvert:true,esv:'ok',pause:{actif:true},...extra});
const btn=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
test('Ariane : la pastille dit l’état du lot par sa forme ; « Pause demandée » garde la place du bouton, grisé',()=>{
 const snap={mode:'automatic',ar:arBase('cours'),boutonsOrbite:[btn('pause','Pause','primary'),btn('stop','Arrêter le lot','danger')]};
 const h=RA.rendre('ariane',snap,{},'orbite');
 assert.match(h,/class="etat cours"/);assert.match(h,/data-act="pause"/);assert.match(h,/31<\/b> <span>sur 120 cuts traités/);assert.match(h,/89 restants/);
 const d=RA.rendre('ariane',{...snap,ar:arBase('dem')},{},'orbite');
 assert.match(d,/class="etat dem"/);assert.match(d,/id="ar-cmd" disabled>.*Pause demandée…/);assert.doesNotMatch(d,/data-act="pause"/);
});
test('Ariane : Écho est indisponible pendant un lot ; la fin de lot mène d’abord à la Revue, l’export ensuite',()=>{
 const a=RA.rendre('ariane',{mode:'home',ar:arBase('cours')},{},'accueil');
 assert.match(a,/vig e indispo" aria-disabled="true"/);assert.doesNotMatch(a,/data-act="aller:echo" data-k/);
 const f=RA.rendre('ariane',{mode:'automatic',ar:arBase('fini',{lotOuvert:false,cours:null}),boutonsOrbite:[btn('export-tout','Tout télécharger pour l’analyse','primary')]},{},'orbite');
 assert.ok(f.indexOf('data-act="aller:revue">Examiner les 4 cuts')<f.indexOf('legacy:export-tout'),'Examiner avant l’export');
});
test('Ariane : tout texte venu du panneau est échappé ; sans `ar`, l’accueil se dessine quand même',()=>{
 const h=RA.rendre('ariane',{mode:'automatic',ar:arBase('alerte',{alerte:'<img src=x onerror=alert(1)>'}),notice:{texte:'<b>x</b>',erreur:true},boutonsOrbite:[btn('resume','<i>Reprendre</i>','primary')]},{},'orbite');
 assert.doesNotMatch(h,/<img|<b>x<\/b>|<i>Reprendre/);
 assert.match(RA.rendre('ariane',{mode:'home'},{},'accueil'),/Aucune partie ouverte/);
});

/* 4.9.6 (D-232, D-233) — bloc A : pastille sans onglet ESV ; bloc C : relecture en pause dans la présentation « Ariane ». */
test('Ariane : sans onglet ESV, la pastille le dit au lieu de « Prêt »',()=>{
 const h=RA.rendre('ariane',{mode:'home',ar:arBase('pret',{horsLigne:true,esv:'non',lotOuvert:false,traites:0,cibles:null,partie:null})},{},'accueil');
 assert.match(h,/class="etat hors"/);assert.match(h,/Aucun onglet ESV/);assert.doesNotMatch(h,/class="etat pret"/);
 const p=RA.rendre('ariane',{mode:'home',ar:arBase('pret',{horsLigne:false,lotOuvert:false,traites:0,cibles:null})},{},'accueil');
 assert.match(p,/class="etat pret"/);
});
test('Ariane : relecture en pause → ligne, « Reprendre » et « Arrêter » (clic sur les boutons du module) ; grisé si ESV ne répond pas',()=>{
 const vue=(o)=>({pause:null,reprendre:null,arreter:false,ligne:'',...o});
 const actif=vue({reprendre:{texte:'Reprendre la relecture au cut 110',actif:true,raison:''},arreter:true,ligne:'Relecture en pause au cut 110 · 12 cuts relus sur 85.'});
 for(const [ecran,mode] of [['accueil','home'],['orbite','automatic']]){
  const h=RA.rendre('ariane',{mode,ar:arBase('pret',{lotOuvert:false,traites:0,cibles:null}),relPause:actif},{},ecran);
  assert.match(h,/12 cuts relus sur 85/,ecran);assert.match(h,/data-act="legacy:relecture-reprendre"/,ecran);assert.match(h,/data-act="legacy:relecture-arreter-pause"/,ecran);
  assert.doesNotMatch(h,/data-act="legacy:relecture-reprendre"[^>]*disabled/,ecran);
 }
 const muet=vue({reprendre:{texte:'Reprendre la relecture',actif:false,raison:'Disponible quand ESV répond.'},arreter:true});
 assert.match(RA.rendre('ariane',{mode:'automatic',ar:arBase('pret',{lotOuvert:false}),relPause:muet},{},'orbite'),/data-act="legacy:relecture-reprendre" disabled title="Disponible quand ESV répond."/);
 const enCours=vue({pause:{texte:'Pause',actif:true}});
 assert.match(RA.rendre('ariane',{mode:'automatic',ar:arBase('pret',{lotOuvert:false}),relPause:enCours},{},'orbite'),/data-act="legacy:relecture-pause">.*Pause/);
 assert.doesNotMatch(RA.rendre('ariane',{mode:'automatic',ar:arBase('pret',{lotOuvert:false})},{},'orbite'),/relpause/,'rien sans pause ni relecture');
});
test('Ariane : les actions du module de pause désignent des éléments de panel.html ; le module est chargé et ne touche ni ESV ni les exports',()=>{
 for(const id of ['relecture-pause','relecture-reprendre','relecture-arreter-pause','relecture-pause-actif','relecture-f5'])assert.ok(ids.has(id),id);
 assert.match(html,/src\/relecture-pause\.js/);
 const src=lire('src/relecture-pause.js');assert.doesNotMatch(src,/export-|exporter|executeScript|chrome\.tabs/);
 const ui=lire('src/ui5.js');assert.match(ui,/FIN_PARTIE\s*=\s*999999/);
});
test('Ariane : « 999999 » n’est jamais affiché comme borne',()=>{
 const ui=lire('src/ui5.js');
 const fin=new Function(ui.match(/const FIN_PARTIE = 999999;\n\s*const finVisible = [^\n]+/)[0]+';return finVisible;')();
 assert.equal(fin('999999'),null);assert.equal(fin(''),null);assert.equal(fin(null),null);assert.equal(fin('4812'),'4812');
 const h=RA.rendre('ariane',{mode:'automatic',ar:arBase('pret',{lotOuvert:false,bornes:{debut:'1',fin:null}})},{},'orbite');
 assert.doesNotMatch(h,/999999/);assert.match(h,/placeholder="fin de partie"/);
});

/* 4.9.6 (D-234, bloc D) : nouvelle présentation « ariane2 » — sans grand titre ni phrase d'accompagnement, onglets ESV, cache en vue, logo, palette. */
const tabs=[{valeur:'11',texte:'Onglet 1 · fenêtre 1 — Partie 13'},{valeur:'12',texte:'Onglet 2 · fenêtre 1 — Partie 14'},{valeur:'13',texte:'Onglet 3 · pas prêt'}];
const v2=(mode,etat,ecran,extra={},ar={})=>RA.rendre('ariane2',{mode,variante:'ariane2',onglets:tabs,ongletChoisi:'11',ar:arBase(etat,{lotOuvert:etat==='cours',cache:{actif:etat==='fini'},...ar}),boutonsOrbite:[btn('pause','Pause','primary')],boutonsEcho:[btn('native-start','Démarrer l’observation','primary')],...extra},{},ecran);
test('ariane2 : plus de grand titre, plus de phrase qui tient la main, plus de ligne « parcours du lot »',()=>{
 const o=v2('automatic','cours','orbite');
 assert.doesNotMatch(o,/<h2>/);assert.doesNotMatch(o,/Pose des rails|Pendant le lot, ne change pas|Parcours du lot|class="position"/);
 const e=v2('native','pret','echo');assert.doesNotMatch(e,/Tu corriges|Écho garde les exemples|<h2>/);
 const a=v2('home','cours','accueil');assert.doesNotMatch(a,/<h2>|Ne change pas de cut dans ESV/);assert.match(a,/class="t2">Partie 13/);assert.match(a,/Pose du cut 4812\./);
 assert.match(RA.rendre('ariane',{mode:'automatic',ar:arBase('cours'),boutonsOrbite:[]},{},'orbite'),/<h2>Pose des rails<\/h2>/,'la présentation Ariane d’origine ne change pas');
});
test('ariane2 : un onglet ESV par puce, un clic = choisir puis connecter ; l’onglet pas prêt ou verrouillé ne se clique pas',()=>{
 const o=v2('automatic','pret','orbite',{},{lotOuvert:false});
 assert.match(o,/class="esvbar"/);assert.match(o,/class="te o"[^>]*aria-disabled="true"/,'l’onglet connecté porte la couleur d’Orbite');
 assert.match(o,/data-act="conn:12"/);assert.doesNotMatch(o,/data-act="conn:13"/);assert.doesNotMatch(o,/data-act="conn:11"/);
 const v=v2('automatic','cours','orbite',{},{connexionBloquee:true});assert.doesNotMatch(v,/data-act="conn:/,'pendant un lot, on ne change pas d’onglet');
 assert.match(v2('native','pret','echo',{ongletChoisi:'11'},{lotOuvert:false}),/class="te e"/,'Écho a sa propre couleur');
 assert.match(v2('home','pret','accueil',{onglets:[],ongletChoisi:''}),/Aucun onglet ESV ouvert\./);
 assert.doesNotMatch(v2('home','pret','revue'),/esvbar/);assert.doesNotMatch(RA.rendre('ariane',{mode:'automatic',ar:arBase('pret'),onglets:tabs},{},'orbite'),/esvbar/);
 const piege=v2('automatic','pret','orbite',{onglets:[{valeur:'9',texte:'<img src=x onerror=alert(1)>'}],ongletChoisi:''});assert.doesNotMatch(piege,/<img/);
});
test('ariane2 : « Vider le cache » est en vue dans Orbite et Écho, grisé avec sa raison tant qu’il est impossible, et clique le bouton d’origine',()=>{
 const f=v2('automatic','fini','orbite');assert.match(f,/<button type="button" class="pill cache" id="ar-cache" data-act="legacy:export-cache-clear">/);assert.match(f,/Seulement après réception|À vider seulement après réception/);
 const l=v2('automatic','cours','orbite');assert.match(l,/id="ar-cache" data-act="legacy:export-cache-clear" disabled/);assert.match(l,/Disponible quand le lot est terminé ou arrêté\./);
 const r=v2('automatic','pret','orbite',{relecture:{actif:true}},{lotOuvert:false});assert.match(r,/Disponible quand la relecture est terminée ou arrêtée\./);
 const e=v2('native','pret','echo',{},{lotOuvert:false,echoEtat:'Collecte en cours',cache:{actif:false}});assert.match(e,/id="ar-cache"[^>]* disabled/);assert.match(e,/Disponible quand la séance Écho est terminée\./);
 assert.doesNotMatch(v2('home','fini','accueil'),/ar-cache/);assert.doesNotMatch(RA.rendre('ariane',{mode:'automatic',ar:arBase('fini',{cache:{actif:true}})},{},'orbite'),/ar-cache/);
});
test('ariane2 : nouveau logo, accès discret à la palette (icône et lien d’accueil), retour par une commande de la palette',()=>{
 const a=v2('home','pret','accueil');assert.match(a,/id="ar-lg"/);assert.match(a,/data-act="variante:raycast"[^>]*aria-label="Interface palette"/);assert.match(a,/class="astuce"/);
 assert.doesNotMatch(RA.rendre('ariane',{mode:'home',ar:arBase('pret')},{},'accueil'),/ar-lg|Interface palette/);
 const m=RA.modele(base);assert.ok(RA.commandes(base,m).some(x=>x.act==='variante:ariane2'),'la palette ramène à l’interface Ariane');
 const g=RA.rendre('ariane2',{mode:'home',variante:'ariane2',reglages:base.reglages,ar:arBase('pret')},{},'reglages');
 assert.match(g,/<option value="ariane2" selected>/);assert.match(g,/<option value="raycast">Palette/);
});
