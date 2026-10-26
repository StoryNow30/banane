'use strict';
/* Test 17 — L'HABILLAGE DU PANNEAU, partie pure (src/ui5-rendu.js) et ses liens avec le panneau d'origine (panel.html) :
 *  - un seul bouton principal par état, choisi par le panneau ; pendant la relecture, « Arrêter la relecture » passe devant et l'export descend ;
 *  - aucune case ni bouton radio sur les écrans de séance ; les listes ne sont que dans Réglages ;
 *  - tout texte venu du panneau est échappé ;
 *  - chaque action de l'habillage désigne un élément qui existe dans panel.html (clic sur le bouton d'origine), jamais un message nouveau ;
 *  - la pastille dit l'état du lot par sa forme ; sans onglet ESV elle le dit ; la relecture en pause a sa ligne et ses boutons. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../src/ui5-rendu.js');
const racine=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const html=lire('panel.html'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const ECRANS=['accueil','orbite','echo','revue','reglages'];
const ar=(etat,extra={})=>({etat,traites:31,poses:27,differes:4,cibles:120,restants:89,cours:4812,dernier:4811,partie:13,differesListe:[{cut:4787,motif:'Rail non résolu',precision:'rail droit',heure:'17 h 21'}],verts:[],vertsNombre:0,aExaminer:4,lotOuvert:true,esv:'ok',pause:{actif:true},...extra});
const base={variante:'ariane2',notice:{texte:'Orbite enchaîne les cuts.',erreur:false},avisContrat:'',connexionOuverte:false,lot:{etat:'En cours · pose des rails',finPartie:''},
 relecture:{ligne:'',actif:false,interrompue:''},echo:{visites:'0',corriges:0},echoRows:[],reglages:{relecture:'corriger',clic:'tel-quel',grappe:false,passe2:true,raison:false,touches:'chiffres',bandeau:false},
 exportTexte:'',onglets:[{valeur:'1',texte:'ESV'}],ongletChoisi:'1',connexionNote:'',gcv2:{total:2684,date:'19/10/2026'},ar:ar('cours'),
 boutonsOrbite:[b('pause','Pause','primary'),b('export-tout','Tout télécharger pour l’analyse'),b('stop','Arrêter le lot','danger')],boutonsEcho:[b('native-start','Démarrer Écho','primary')]};
const avec=o=>({...base,...o});

test('le bouton principal est celui du panneau ; une relecture en cours passe devant et rejette l’export dans les autres actions',()=>{
 const m=R.modele({...base,mode:'automatic',boutons:base.boutonsOrbite});assert.equal(m.primaire.id,'pause');assert.deepEqual(m.autres.map(x=>x.id),['export-tout','stop']);
 const rel=R.modele({mode:'automatic',boutons:[b('export-tout','Tout télécharger','primary'),b('relecture-arreter','Arrêter la relecture'),b('relecture-lancer','Lancer la relecture')],relecture:{ligne:'Relecture 12 sur 85',actif:true,interrompue:''}});
 assert.equal(rel.primaire.id,'relecture-arreter');assert.ok(rel.autres.some(x=>x.id==='export-tout'),'l’export reste possible, mais pas en avant');assert.equal(rel.phrase,'Relecture 12 sur 85');
 const ack=R.modele({mode:'automatic',boutons:[b('relecture-acquitter','J’ai contrôlé le cut 4903'),b('relecture-arreter','Arrêter')],relecture:{ligne:'',actif:true,interrompue:'Une correction a été interrompue au cut 4903.'}});
 assert.equal(ack.primaire.id,'relecture-acquitter');assert.match(ack.phrase,/interrompue au cut 4903/);
 const echo=R.modele({mode:'native',boutons:[b('native-end','Terminer et télécharger','primary'),b('native-pause','Pause'),b('native-discard','Abandonner')]});
 assert.equal(echo.primaire.id,'native-end');assert.ok(!echo.autres.some(x=>x.id==='native-discard'),'l’abandon vit dans Réglages');
 assert.equal(R.modele({mode:'automatic',boutons:[]}).primaire,null,'sans bouton principal, aucun n’est inventé');
});

test('écrans de séance : aucune case, aucun bouton radio, aucun champ de saisie hors les bornes du prochain lot ; Réglages : des listes',()=>{
 for(const e of ECRANS.filter(x=>x!=='reglages')){
  const s=R.rendre(base,e);assert.ok(s.length>200,e);assert.ok(!/<select|type="checkbox"|type="radio"/.test(s),e);
  assert.ok(!/<input(?![^>]*data-borne)/.test(s),e+' : seules les bornes du prochain lot sont des champs');
 }
 const s=R.rendre(base,'reglages');assert.ok((s.match(/<select/g)||[]).length>=5);
 for(const nom of ['relecture','clic','grappe','passe2','raison','variante','onglet'])assert.ok(s.includes(`data-sel="${nom}"`),nom);
 assert.match(s,/Deuxième passe \(écrit dans ESV\)[\s\S]*?<option value="oui" selected>Allumée<\/option>/);
 assert.match(R.rendre({...base,reglages:{...base.reglages,passe2:null}},'reglages'),/data-sel="passe2"><option value="" selected>État inconnu<\/option>/,'état inconnu : jamais « Coupée » par défaut');
 assert.match(s,/<option value="ancienne">Ancien panneau<\/option>/);assert.doesNotMatch(s,/value="(linear|raycast|figma|ariane)"/);
});

test('tout texte du panneau est échappé avant d’entrer dans le HTML',()=>{
 const piege='<img src=x onerror=alert(1)>"\'&';
 const s0=avec({notice:{texte:piege,erreur:true},avisContrat:piege,lot:{etat:piege,finPartie:piege},exportTexte:piege,connexionNote:piege,onglets:[{valeur:piege,texte:piege}],gcv2:{total:piege,date:piege},
  relecture:{ligne:piege,actif:true,interrompue:piege},ar:ar('alerte',{alerte:piege,differesListe:[{cut:piege,motif:piege,precision:piege,heure:piege}]}),
  boutonsOrbite:[b('resume',piege,'primary'),b('stop',piege)],boutonsEcho:[b('native-start',piege,'primary')],relPause:{pause:null,reprendre:{texte:piege,actif:true,raison:piege},arreter:true,ligne:piege}});
 for(const e of ECRANS){const s=R.rendre(s0,e);assert.ok(!/<img/.test(s),e);assert.ok(!/onerror=alert\(1\)>/.test(s.replace(/&lt;img[^&]*&gt;/g,'')),e);}
});

test('chaque action de l’habillage désigne un élément qui existe dans panel.html (clic sur le bouton d’origine)',()=>{
 const src=lire('src/ui5.js'),listes=[...src.matchAll(/const ORDRE_(?:ORBITE|ECHO) = \[([^\]]+)\]/g)].flatMap(m=>[...m[1].matchAll(/'([a-z-]+)'/g)].map(x=>x[1]));
 assert.ok(listes.length>=18);for(const id of listes)assert.ok(ids.has(id),'bouton absent de panel.html : '+id);
 for(const id of ['tab-native','tab-automatic','bandeau-toggle','theme-toggle','connect','export-cache-clear','native-discard','grappe-differes','passe-differes','raison-actif','tabs','ui5-essai','pause','resume','start','end',
  'native-count','lot-etat','lot-fin-partie','verts-controle','verts-plages','verts-ligne','relecture-ligne','relecture-interrompue','notice','avis-contrat','export-status','tabs-note',
  ...['coupee','ombre','corriger'].map(x=>'relecture-'+x),...['tel-quel','gauche-recentre','tout-recentre'].map(x=>'clic-'+x),...['chiffres','alt-chiffres','pave'].map(x=>'raison-touches-'+x)])
  assert.ok(ids.has(id),id);
 const relPause={pause:{texte:'Pause',actif:true},reprendre:{texte:'Reprendre',actif:true,raison:''},arreter:true,ligne:''};
 for(const e of ECRANS)for(const m of R.rendre(avec({relPause}),e).matchAll(/data-act="legacy:([a-z-]+)"/g))assert.ok(ids.has(m[1]),e+' : '+m[1]);
 for(const e of ECRANS)for(const m of R.rendre(base,e).matchAll(/data-act="([a-z]+)(?::[a-z-]+)?"/g))assert.ok(['legacy','aller','pause','variante','conn'].includes(m[1]),e+' : '+m[1]);
});

/* Présentation « Ariane » : dessinée à partir de `snap.ar` (src/ui5.js) et des boutons du panneau. */
test('Ariane : la pastille dit l’état du lot par sa forme ; « Pause demandée » garde la place du bouton, grisé',()=>{
 const h=R.rendre(base,'orbite');
 assert.match(h,/class="etat cours"/);assert.match(h,/data-act="pause"/);assert.match(h,/31<\/b> <span>sur 120 cuts traités/);assert.match(h,/89 restants/);
 const d=R.rendre(avec({ar:ar('dem')}),'orbite');
 assert.match(d,/class="etat dem"/);assert.match(d,/id="ar-cmd" disabled>.*Pause demandée…/);assert.doesNotMatch(d,/data-act="pause"/);
});
test('Ariane : Écho est indisponible pendant un lot ; la fin de lot mène d’abord à la Revue, l’export ensuite',()=>{
 const a=R.rendre(base,'accueil');
 assert.match(a,/vig e indispo" aria-disabled="true"/);assert.doesNotMatch(a,/data-act="aller:echo" data-k/);
 const f=R.rendre(avec({ar:ar('fini',{lotOuvert:false,cours:null}),boutonsOrbite:[b('export-tout','Tout télécharger pour l’analyse','primary')]}),'orbite');
 assert.ok(f.indexOf('data-act="aller:revue">Examiner les 4 cuts')<f.indexOf('legacy:export-tout'),'Examiner avant l’export');
});
test('Ariane : sans `ar`, l’accueil se dessine quand même ; un écran inconnu se dessine comme l’accueil',()=>{
 assert.match(R.rendre({},'accueil'),/class="t2">ESV/);assert.match(R.rendre({},'inconnu'),/data-vue="accueil"/);
});
test('Ariane : sans onglet ESV, la pastille le dit au lieu de « Prêt »',()=>{
 const h=R.rendre(avec({ar:ar('pret',{horsLigne:true,esv:'non',lotOuvert:false,traites:0,cibles:null,partie:null})}),'accueil');
 assert.match(h,/class="etat hors"/);assert.match(h,/Aucun onglet ESV/);assert.doesNotMatch(h,/class="etat pret"/);
 assert.match(R.rendre(avec({ar:ar('pret',{horsLigne:false,lotOuvert:false,traites:0,cibles:null})}),'accueil'),/class="etat pret"/);
});
test('Ariane : pendant la deuxième passe des différés, la pastille et la ligne disent de ne toucher à rien dans ESV, la commande est verrouillée, Écho indisponible',()=>{
 const p2=ar('p2',{lotOuvert:true,cours:null,passe2:{cut:4787,ecrites:0,demandees:2}});
 const o=R.rendre(avec({ar:p2}),'orbite'),a=R.rendre(avec({ar:p2}),'accueil');
 for(const h of [o,a]){assert.match(h,/class="etat cours"[^>]*><span class="f"><\/span>Deuxième passe en cours/);assert.match(h,/travaille dans ESV/);assert.doesNotMatch(h,/data-act="pause"/);}
 assert.match(o,/id="ar-cmd" disabled><span class="ar-lbl"><svg[^>]*>.*<\/svg>Ne touche à rien dans ESV/);assert.match(o,/<b>cut 4787<\/b> · 0 posé sur 2\. <b>Ne touche à rien<\/b>/);
 assert.match(a,/Suivre la passe/);assert.match(a,/vig e indispo" aria-disabled="true"/);assert.match(a,/Deuxième passe en cours<\/span><\/span><span class="fl">/);
 assert.match(R.rendre(avec({ar:ar('p2',{lotOuvert:true,passe2:{cut:null,ecrites:1,demandees:1}})}),'orbite'),/travaille dans ESV · 1 posé sur 1\./,'sans cut connu, pas de « cut null »');
 assert.match(R.rendre(avec({variante:'palette',mode:'automatic',ar:p2}),'accueil'),/<span class="et2">Deuxième passe · ne touche à rien dans ESV<\/span>/,'palette : la même consigne');
 assert.match(R.rendre(avec({ar:{...p2,cache:{actif:false}}}),'orbite'),/Disponible quand la deuxième passe est finie ou arrêtée/,'cache grisé avec sa raison pendant la passe');
});
test('Ariane : pendant la relecture après le lot, la pastille, la ligne et « Arrêter » le disent ; l\u2019export n\u2019est plus la commande principale ; Écho et le cache sont indisponibles',()=>{
 const rel=avec({ar:ar('rel',{lotOuvert:true,cours:null,pause:null,cache:{actif:true}}),relecture:{ligne:'Relecture : 3 sur 40',actif:true,interrompue:''},mode:'automatic',
  boutonsOrbite:[b('relecture-arreter','Arrêter la relecture','danger'),b('export-tout','Tout télécharger pour l’analyse')]});
 const o=R.rendre(rel,'orbite'),a=R.rendre(rel,'accueil');
 for(const h of [o,a]){assert.match(h,/class="etat cours"[^>]*><span class="f"><\/span>Relecture en cours/);assert.doesNotMatch(h,/Lot terminé/);}
 assert.doesNotMatch(a,/data-act="legacy:export-tout"/,'l\u2019accueil ne propose pas l\u2019export pendant la relecture');assert.match(o,/id="ar-cmd" data-act="legacy:relecture-arreter"/,'la commande principale d\u2019Orbite est « Arrêter »');
 assert.match(o,/id="ar-cmd" data-act="legacy:relecture-arreter"/);assert.match(o,/Relecture : 3 sur 40/);
 assert.match(a,/Suivre la relecture/);assert.match(a,/data-act="legacy:relecture-arreter"[^>]*>Arrêter la relecture/);assert.match(a,/vig e indispo" aria-disabled="true"/);assert.match(a,/Relecture en cours<\/span><\/span><span class="fl">/);
 assert.match(o,/id="ar-cache" data-act="legacy:export-cache-clear" disabled/,'le cache est grisé pendant la relecture, même si le bouton d\u2019origine ne l\u2019est pas');
 assert.match(o,/Disponible quand la relecture est terminée ou arrêtée/);
 const enPause=R.rendre(avec({ar:ar('fini',{cache:{actif:true}}),relPause:{pause:null,reprendre:{texte:'Reprendre',actif:true},arreter:true,ligne:'Relecture en pause'}}),'echo');
 assert.match(enPause,/id="ar-cache" data-act="legacy:export-cache-clear" disabled/,'grisé aussi pendant la pause, dans Écho comme dans Orbite');assert.match(enPause,/Disponible quand la relecture est terminée ou arrêtée/);
});
test('Ariane : relecture en pause → ligne, « Reprendre » et « Arrêter » (clic sur les boutons du module) ; grisé si ESV ne répond pas',()=>{
 const vue=o=>({pause:null,reprendre:null,arreter:false,ligne:'',...o}),sans=ar('pret',{lotOuvert:false,traites:0,cibles:null});
 const actif=vue({reprendre:{texte:'Reprendre la relecture au cut 110',actif:true,raison:''},arreter:true,ligne:'Relecture en pause au cut 110 · 12 cuts relus sur 85.'});
 for(const e of ['accueil','orbite']){
  const h=R.rendre(avec({ar:sans,relPause:actif}),e);
  assert.match(h,/12 cuts relus sur 85/,e);assert.match(h,/data-act="legacy:relecture-reprendre"/,e);assert.match(h,/data-act="legacy:relecture-arreter-pause"/,e);
  assert.doesNotMatch(h,/data-act="legacy:relecture-reprendre"[^>]*disabled/,e);
 }
 const muet=vue({reprendre:{texte:'Reprendre la relecture',actif:false,raison:'Disponible quand ESV répond.'},arreter:true});
 assert.match(R.rendre(avec({ar:sans,relPause:muet}),'orbite'),/data-act="legacy:relecture-reprendre" disabled title="Disponible quand ESV répond."/);
 assert.match(R.rendre(avec({ar:sans,relPause:vue({pause:{texte:'Pause',actif:true}})}),'orbite'),/data-act="legacy:relecture-pause">.*Pause/);
 assert.doesNotMatch(R.rendre(avec({ar:sans}),'orbite'),/relpause/,'rien sans pause ni relecture');
});
test('Ariane : « 999999 » n’est jamais écrit dans les bornes du prochain lot',()=>{
 const h=R.rendre(avec({ar:ar('pret',{lotOuvert:false,bornes:{debut:'1',fin:null}})}),'orbite');
 assert.doesNotMatch(h,/999999/);assert.match(h,/placeholder="fin de partie"/);assert.match(h,/à la fin de la partie/);
});
test('relecture-pause.js : ses boutons existent dans panel.html, il est chargé avant panel.js et ne touche ni ESV ni les exports',()=>{
 for(const id of ['relecture-pause','relecture-reprendre','relecture-arreter-pause','relecture-pause-actif','relecture-f5','relecture-pause-zone','relecture-pause-ligne','relecture-pause-raison','relecture-pause-note'])assert.ok(ids.has(id),id);
 assert.ok(html.indexOf('src/relecture-pause.js')>0&&html.indexOf('src/relecture-pause.js')<html.indexOf('src="panel.js"'));
 assert.doesNotMatch(lire('src/relecture-pause.js'),/export-|exporter|executeScript|chrome\.tabs/);
});

/* Présentation « ariane2 » (maquette v2) : sans grand titre ni phrase d'accompagnement, onglets ESV, cache en vue, nouveau logo. */
const tabs=[{valeur:'11',texte:'Onglet 1 · fenêtre 1 — Partie 13'},{valeur:'12',texte:'Onglet 2 · fenêtre 1 — Partie 14'},{valeur:'13',texte:'Onglet 3 · pas prêt'}];
const v2=(etat,ecran,extra={},a={})=>R.rendre(avec({onglets:tabs,ongletChoisi:'11',ar:ar(etat,{lotOuvert:etat==='cours',cache:{actif:etat==='fini'},...a}),boutonsEcho:[b('native-start','Démarrer l’observation','primary')],...extra}),ecran);
test('plus de grand titre, plus de phrase qui tient la main, plus de ligne « parcours du lot »',()=>{
 const o=v2('cours','orbite');
 assert.doesNotMatch(o,/<h2>/);assert.doesNotMatch(o,/Pose des rails|Pendant le lot, ne change pas|Parcours du lot|class="position"/);
 assert.doesNotMatch(v2('pret','echo',{},{lotOuvert:false}),/Tu corriges|Écho garde les exemples|<h2>/);
 const a=v2('cours','accueil');assert.doesNotMatch(a,/<h2>|Ne change pas de cut dans ESV/);assert.match(a,/class="t2">Partie 13/);assert.match(a,/Pose du cut 4812\./);
});
test('un onglet ESV par puce, un clic = choisir puis connecter ; l’onglet pas prêt ou verrouillé ne se clique pas',()=>{
 const o=v2('pret','orbite',{},{lotOuvert:false});
 assert.match(o,/class="esvbar"/);assert.match(o,/class="te o"[^>]*aria-disabled="true"/,'l’onglet connecté porte la couleur d’Orbite');
 assert.match(o,/data-act="conn:12"/);assert.doesNotMatch(o,/data-act="conn:13"/);assert.doesNotMatch(o,/data-act="conn:11"/);
 assert.doesNotMatch(v2('cours','orbite',{},{connexionBloquee:true}),/data-act="conn:/,'pendant un lot, on ne change pas d’onglet');
 assert.match(v2('pret','echo',{},{lotOuvert:false}),/class="te e"/,'Écho a sa propre couleur');
 assert.match(v2('pret','accueil',{onglets:[],ongletChoisi:''}),/Aucun onglet ESV ouvert\./);
 assert.doesNotMatch(v2('pret','revue'),/esvbar/);
 const piege=v2('pret','orbite',{onglets:[{valeur:'9',texte:'<img src=x onerror=alert(1)>'}],ongletChoisi:''});assert.doesNotMatch(piege,/<img/);
});
test('« Vider le cache » est en vue dans Orbite et Écho, grisé avec sa raison tant qu’il est impossible, et clique le bouton d’origine',()=>{
 const f=v2('fini','orbite');assert.match(f,/<button type="button" class="pill cache" id="ar-cache" data-act="legacy:export-cache-clear">/);assert.match(f,/À vider seulement après réception/);
 const l=v2('cours','orbite');assert.match(l,/id="ar-cache" data-act="legacy:export-cache-clear" disabled/);assert.match(l,/Disponible quand le lot est terminé ou arrêté\./);
 assert.match(v2('pret','orbite',{relecture:{ligne:'',actif:true,interrompue:''}},{lotOuvert:false}),/Disponible quand la relecture est terminée ou arrêtée\./);
 const e=v2('pret','echo',{},{lotOuvert:false,echoEtat:'Collecte en cours',cache:{actif:false}});assert.match(e,/id="ar-cache"[^>]* disabled/);assert.match(e,/Disponible quand la séance Écho est terminée\./);
 assert.doesNotMatch(v2('fini','accueil'),/ar-cache/);
});
test('nouveau logo ; accès discret à la palette (icône, lien d’accueil) ; choisissable dans Réglages > Interface',()=>{
 assert.match(v2('pret','accueil'),/id="ar-lg"/);
 const g=R.rendre(base,'reglages');
 assert.match(g,/<option value="ariane2" selected>/);assert.match(g,/<option value="ancienne">/);const a=v2('pret','accueil');assert.match(a,/data-act="variante:palette"[^>]*aria-label="Interface palette"/);assert.match(a,/class="astuce"/);assert.match(g,/<option value="palette">Palette/);
});

/* Palette sobre (D-233, D-236) : une ligne de recherche, l'état en petit à droite, quatre commandes au plus à l'ouverture, le reste en tapant. */
const btn=b;
const pal=(extra={},arx={},q='',pi=0)=>R.rendre(avec({variante:'palette',mode:'automatic',onglets:tabs,ongletChoisi:'11',ar:ar('cours',{cache:{actif:false},...arx}),
 boutons:[btn('pause','Pause','primary'),btn('stop','Arrêter le lot','danger'),btn('export-tout','Exporter le dossier','link',false)],...extra}),'accueil',{q,pi});
test('palette : une ligne de recherche, l’état à droite, les commandes du moment (quatre au plus), rien d’autre ; aucune case ni liste',()=>{
 const h=pal();
 assert.equal((h.match(/class="i2[ "]/g)||[]).length,3,'pause, arrêter, exporter (grisé) : les commandes du moment seulement');
 assert.doesNotMatch(h,/Réglages|Vider le cache|Orbite<\/span>|Écho<\/span>|Connecter à|Interface Ariane \(cartes\)/,'activités, onglets, cache et réglages n’apparaissent qu’en tapant');
 assert.match(h,/class="et2">Orbite en cours · 31\/120</);assert.match(h,/id="ui5-q"/);assert.match(h,/class="i2 s" data-act="legacy:pause"[^>]*>.*Pause<\/span><kbd>↵<\/kbd>/);
 assert.doesNotMatch(h,/<select|type="checkbox"|type="radio"|<h2|class="vig|class="g"|class="ty"/);assert.equal((h.match(/<input/g)||[]).length,1);
 const six=[1,2,3,4,5,6].map(i=>btn('c'+i,'Commande '+i,i===1?'primary':'link'));
 assert.equal((pal({boutons:six}).match(/class="i2[ "]/g)||[]).length,4,'jamais plus de quatre à l’ouverture');
 assert.match(pal({}, {}, '', 1),/class="i2 s"[^>]*>.*Arrêter le lot/,'la ligne choisie suit ui.pi');
});
test('palette : en tapant on trouve activités, onglets, cache (grisé avec sa raison), réglages, retour ; Écho grisé pendant un lot ; sept résultats au plus',()=>{
 const c=pal({},{},'vider');assert.match(c,/Vider le cache des exports/);assert.match(c,/class="i2(?: s)? off" aria-disabled="true"/);assert.match(c,/Disponible quand le lot est terminé ou arrêté\./);
 const ok=pal({},{lotOuvert:false,cache:{actif:true}},'vider');assert.match(ok,/data-act="legacy:export-cache-clear"/);assert.doesNotMatch(ok,/class="i2(?: s)? off"/);
 assert.match(pal({},{},'onglet 2'),/data-act="conn:12"/);assert.doesNotMatch(pal({},{},'onglet 3'),/data-act="conn:13"/,'un onglet pas prêt ne se connecte pas');
 assert.match(pal({},{},'écho'),/class="i2(?: s)? off" aria-disabled="true"[^>]*>.*indisponible pendant un lot/);
 assert.match(pal({},{},'regl'),/data-act="interface:reglages"/);assert.match(pal({},{},'ariane'),/data-act="variante:ariane2"/);assert.match(pal({},{},'detail'),/data-act="variante:ancienne"/);
 assert.match(pal({},{},'zzzz'),/Aucun résultat/);
 assert.match(pal({mode:'native',echo:{corriges:5}},{echoEtat:'Collecte en cours',lotOuvert:false},''),/class="et2">Collecte en cours · 5</);
 assert.match(pal({ongletChoisi:''},{},''),/data-act="conn:11"/,'sans onglet choisi, la connexion est proposée en premier');
 const beaucoup=Array.from({length:12},(_,i)=>({valeur:String(20+i),texte:'Onglet extra '+i}));
 assert.equal((pal({onglets:beaucoup,ongletChoisi:'20'},{},'onglet').match(/class="i2[ "]/g)||[]).length,7);
 assert.match(pal({},{etat:'pret',horsLigne:true,lotOuvert:false,traites:0,cibles:null},''),/class="et2">Hors ligne</);
 assert.match(pal({},{esv:'ko'},''),/class="et2">ESV ne répond plus</);
});
test('palette : tout texte venu du panneau est échappé ; Entrée ne lance jamais une commande grisée (elle n’a pas d’action)',()=>{
 const piege='<img src=x onerror=alert(1)>';
 const x=pal({onglets:[{valeur:piege,texte:piege}],ongletChoisi:'',notice:{texte:piege,erreur:true},boutons:[btn(piege,piege,'primary')],relPause:{reprendre:{texte:piege,actif:true,raison:piege},arreter:true,pause:null}},{alerte:piege,etat:'alerte',etatTexte:piege},'');
 assert.doesNotMatch(x,/<img/);assert.doesNotMatch(pal({onglets:[{valeur:piege,texte:piege}]},{},'img'),/<img/);
 const off=pal({},{},'exporter');assert.match(off,/aria-disabled="true"/);assert.doesNotMatch(off,/data-act="legacy:export-tout"/);
 const R2=require('../src/ui5-rendu.js');assert.ok(R2.paletteListe(avec({variante:'palette',mode:'automatic',boutons:[btn('export-tout','Exporter','link',false)]}),'exporter').every(c=>c.off));
});
