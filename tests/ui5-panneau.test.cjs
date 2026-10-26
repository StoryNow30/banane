'use strict';
/* Test 17 — L'HABILLAGE DU PANNEAU DANS LA PAGE (src/ui5.js, chargé comme panel.html le charge), contre une page minimale (tests/helpers/ui5-page.cjs) :
 *  - D-250 : au départ, c'est Signal ; rien n'est écrit, aucune fenêtre n'est redimensionnée ; le panneau d'avant n'est plus proposé (un ancien choix « ancienne »
 *    gardé vaut le départ) ; les présentations d'essai se choisissent et se gardent ; un choix gardé inconnu laisse le départ ;
 *  - l'état du lot dit ce que le lot attend (un lot en pause pour une pose peu sûre n'est pas « en pause » tout court) ; « 999999 » n'est jamais une borne affichée ;
 *  - un clic sur l'habillage est un clic sur l'élément d'origine, jamais un message nouveau ; un nouveau dessin garde la position de défilement.
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {monter}=require('./helpers/ui5-page.cjs');
const lire=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const js=x=>JSON.parse(JSON.stringify(x));   /* les objets de la vm viennent d'un autre contexte : on compare leur contenu */
const LOT={id:'L1',scope:{start:4800,end:999999},state:'RUNNING',processed:[],deferred:[],activeIdentity:{part:13,cut:4812}};
const etat=(batch,extra={})=>({batch,current:{identity:{part:13,cut:4812}},connection:{status:'ok'},native:{status:'IDLE',visits:[]},...extra});

test('au départ (D-250) : Signal, sans rien écrire, envoyer ni redimensionner ; le panneau d’avant reste caché derrière',async()=>{
 const p=await monter({etat:etat(LOT)});
 assert.equal(p.hote.hidden,false);assert.equal(p.body.classList.contains('ui5'),true);assert.equal(p.hote.className,'u-signal');
 assert.match(p.hote.innerHTML,/class="sg-fen"/);assert.equal(p.hote.dataset.theme,'sombre','sombre par défaut');
 assert.deepEqual(js(p.ecrits),[]);assert.deepEqual(js(p.envoyes),[]);assert.deepEqual(js(p.fenetres),[],'la fenêtre garde la taille que le service worker lui a donnée');
 assert.equal(typeof p.els['ui5-essai'].onclick,'function','le lien du panneau d’avant ramène à Signal (secours)');
});

test('le panneau d’avant n’est plus proposé : « variante:ancienne » ne fait rien ; les essais ariane2 et palette se choisissent et se gardent',async()=>{
 const p=await monter({etat:etat(LOT)});
 await p.ui.setVariante('ariane2');await p.attendre(20);
 assert.deepEqual(js(p.ecrits),[{banane51Interface:'ariane2'}]);assert.equal(p.hote.className,'u-ariane');assert.match(p.hote.innerHTML,/data-vue="accueil"/);assert.deepEqual(js(p.fenetres),[{width:1180,height:840}]);
 assert.doesNotMatch(p.hote.innerHTML,/variante:ancienne|Ancien panneau/);
 p.ui.agir('variante:ancienne');await p.attendre(20);
 assert.equal(p.ecrits.length,1,'rien d’écrit');assert.equal(p.hote.hidden,false);assert.equal(p.hote.className,'u-ariane');
 p.ui.agir('variante:signal');await p.attendre(20);
 assert.deepEqual(js(p.ecrits.at(-1)),{banane51Interface:'signal'});assert.equal(p.hote.className,'u-signal');assert.deepEqual(js(p.fenetres.at(-1)),{width:600,height:760});
});

test('le choix gardé passe devant le départ ; un choix inconnu (l’ancien « ancienne » et les présentations écartées compris) laisse Signal',async()=>{
 const garde=await monter({stockage:{banane51Interface:'ariane2'},etat:etat(LOT)});
 assert.equal(garde.hote.className,'u-ariane');assert.match(garde.hote.innerHTML,/data-vue="accueil"/);
 for(const v of ['ancienne','ariane','linear','raycast','figma','n’importe quoi',null]){
  const p=await monter({stockage:{banane51Interface:v},etat:etat(LOT)});
  assert.equal(p.hote.hidden,false,String(v));assert.equal(p.hote.className,'u-signal',String(v));assert.equal(p.body.classList.contains('ui5'),true,String(v));
 }
});

test('une fenêtre agrandie par l’opérateur n’est redimensionnée qu’au changement de présentation, jamais à l’ouverture',async()=>{
 const p=await monter({etat:etat(LOT),fenetre:{width:1180,height:840}});
 assert.deepEqual(js(p.fenetres),[],'Signal à l’ouverture : la taille de l’opérateur est gardée');
 await p.ui.setVariante('ariane2');assert.deepEqual(js(p.fenetres),[],'déjà à la taille de la présentation d’essai');
 await p.ui.setVariante('palette');await p.attendre(20);p.fenetres.length=0;await p.ui.setVariante('signal');await p.attendre(20);
 assert.deepEqual(js(p.fenetres),[{width:600,height:760}],'revenir à Signal le remet à sa taille');
});

test('présentation d’essai : choisie dans Réglages, gardée ; un clic sur un onglet le choisit puis clique « Reconnecter ESV » ; le cache et le verrou de connexion suivent les boutons d’origine',async()=>{
 const p=await monter({stockage:{banane51Interface:'ariane2'},etat:etat(LOT)});
 assert.equal(p.body.classList.contains('ui5'),true);assert.match(p.hote.innerHTML,/data-vue="accueil"/);assert.equal(p.hote.className,'u-ariane');
 assert.deepEqual(js(p.fenetres),[{width:1180,height:840}],'une présentation d’essai demande sa taille à l’ouverture');
 p.els.tabs.value='';p.ui.agir('conn:12');assert.equal(p.els.tabs.value,'12');assert.equal(p.els.connect.clics,1);
 p.els['export-cache-clear'].disabled=true;p.els.connect.disabled=true;
 const ar=p.ui.instantane(etat(null)).ar;assert.equal(ar.cache.actif,false);assert.equal(ar.connexionBloquee,true);
 p.els['export-cache-clear'].disabled=false;p.els.connect.disabled=false;
 const libre=p.ui.instantane(etat(null)).ar;assert.equal(libre.cache.actif,true);assert.equal(libre.connexionBloquee,false);
 const autre=await monter({etat:etat(LOT)});
 autre.hote.ecoutes.change[0]({target:{closest:()=>({dataset:{sel:'variante'},value:'ariane2'})}});await autre.attendre(20);
 assert.deepEqual(js(autre.ecrits.at(-1)),{banane51Interface:'ariane2'});assert.match(autre.hote.innerHTML,/data-vue="accueil"/);
});

const touche=(key,o={})=>({key,ctrlKey:false,altKey:false,target:null,preventDefault(){this.empeche=true;},...o});
test('palette : champ actif à l’ouverture, frappe gardée à chaque dessin, flèches, Entrée = commande du panneau (jamais une grisée), Échap vide, Ctrl K bascule, Réglages ouvre ceux d’Ariane',async()=>{
 const p=await monter({stockage:{banane51Interface:'palette'},etat:etat(LOT)});
 const clavier=e=>{e.target||=p.champ;for(const f of p.body.ecoutes.keydown)f(e);return e;};
 assert.equal(p.hote.className,'u-palette');assert.equal(p.body.classList.contains('ui5'),true);assert.deepEqual(js(p.fenetres),[{width:720,height:560}]);
 assert.match(p.hote.innerHTML,/id="ui5-q"/);assert.ok(p.champ.focuses>=1,'le champ est actif à l’ouverture');
 /* La frappe : le champ est redessiné à chaque lettre, il garde la mise au point et ce qui a été tapé. */
 p.document.activeElement=p.champ;p.hote.ecoutes.focusout[0]({target:p.champ});const avant=p.champ.focuses;   /* la mise au point rendue ne tient pas à un souvenir de focusin */
 p.champ.value='regl';p.hote.ecoutes.input[0]({target:p.champ});
 assert.match(p.hote.innerHTML,/value="regl"/);assert.match(p.hote.innerHTML,/data-act="interface:reglages"/);assert.ok(p.champ.focuses>avant,'mise au point rendue après le dessin');
 clavier(touche('Escape'));assert.match(p.hote.innerHTML,/value=""/);assert.doesNotMatch(p.hote.innerHTML,/interface:reglages/);
 /* Entrée lance la commande choisie : le bouton d’origine est cliqué. */
 for(const id of ['start-batch','resume','retry','manual-takeover','manual-completion','close-uncertain','export-tout','new-batch','relecture-acquitter','relecture-arreter','relecture-lancer','passe-differes-lancer','explicit-skip'])p.els[id].hidden=true;
 Object.assign(p.els.pause,{hidden:false,className:'primary',textContent:'Pause'});Object.assign(p.els.stop,{hidden:false,disabled:true,textContent:'Arrêter le lot'});p.rendu(etat(LOT));
 assert.match(p.hote.innerHTML,/data-act="legacy:pause"/);
 assert.equal(clavier(touche('Enter')).empeche,true);assert.equal(p.els.pause.clics,1);
 clavier(touche('ArrowDown'));assert.match(p.hote.innerHTML,/class="i2 s off" aria-disabled="true"/);
 clavier(touche('Enter'));assert.equal(p.els.stop.clics,0,'une commande grisée n’est jamais lancée');
 p.champ.value='écho';p.hote.ecoutes.input[0]({target:p.champ});clavier(touche('Enter'));assert.equal(p.els['tab-native'].clics,0,'Écho est grisé pendant le lot : Entrée ne l’ouvre pas');
 p.champ.value='';p.hote.ecoutes.input[0]({target:p.champ});clavier(touche('ArrowUp'));clavier(touche('ArrowUp'));assert.match(p.hote.innerHTML,/class="i2 s" data-act="legacy:pause"/,'la sélection reste dans la liste');
 /* « regl » + Entrée : les Réglages d’Ariane. */
 p.champ.value='regl';p.hote.ecoutes.input[0]({target:p.champ});clavier(touche('Enter'));await p.attendre(30);
 assert.equal(p.hote.className,'u-ariane');assert.match(p.hote.innerHTML,/data-vue="reglages"/);assert.deepEqual(js(p.ecrits.at(-1)),{banane51Interface:'ariane2'});
 /* Ctrl K : cartes → palette → Signal. */
 const k=()=>clavier(touche('k',{ctrlKey:true,target:{tagName:'DIV'}}));
 k();await p.attendre(20);assert.equal(p.hote.className,'u-palette');k();await p.attendre(20);assert.equal(p.hote.className,'u-signal','Ctrl K ramène à Signal');assert.match(p.hote.innerHTML,/class="sg-fen"/);
 /* Un clic sur un résultat lance sa commande et vide la recherche ; une lettre tapée hors du champ y revient. */
 await p.ui.setVariante('palette');p.champ.value='pau';p.hote.ecoutes.input[0]({target:p.champ});p.document.activeElement=null;const f0=p.champ.focuses;
 clavier(touche('p',{target:{tagName:'BODY'}}));assert.equal(p.champ.focuses,f0+1);
 p.hote.ecoutes.click[0]({target:{closest:()=>({dataset:{act:'mode:native'}})}});assert.match(p.hote.innerHTML,/value=""/);assert.equal(p.els['tab-native'].clics,1);
 assert.deepEqual(js(p.envoyes),[],'aucun message au service worker');
});
test('le compteur des exemples d’apprentissage est lu dans datasets/compteur-gcv2.json (format du compteur)',async()=>{
 const p=await monter({stockage:{banane51Interface:'ariane2'},etat:etat(null)});
 const j=JSON.parse(lire('datasets/compteur-gcv2.json'));
 assert.deepEqual(js(p.ui.instantane(etat(null)).gcv2),{total:j.totaux.tous.corriges,date:'19/10/2026'});
});

test('état du lot : une pause qui attend un choix est « à toi », une pause simple « en pause » ; sans lot ni cut affiché, « aucun onglet ESV »',async()=>{
 const p=await monter({etat:etat(LOT)});
 const ar=b=>p.ui.instantane(etat(b)).ar;
 const peuSur=ar({...LOT,state:'PAUSED',pauseReason:'low-confidence',step:'apply'});
 assert.equal(peuSur.etat,'alerte');assert.match(peuSur.alerte,/pas assez sûre de sa pose sur le cut 4812/);
 assert.equal(ar({...LOT,state:'PAUSED',pauseReason:'user',step:'capture'}).etat,'pause');
 assert.equal(ar({...LOT,state:'PAUSED_UNRESOLVED_RAIL',pauseReason:'unresolved-rail',step:'apply'}).etat,'alerte');
 assert.equal(ar(LOT).etat,'cours');assert.equal(ar({...LOT,state:'STOPPED',stoppedAtEnd:{issue:'fin'}}).etat,'fini');assert.equal(ar({...LOT,state:'STOPPED'}).etat,'arrete');
 const sans=p.ui.instantane({batch:null,current:null,connection:{status:'ok'}}).ar;
 assert.equal(sans.etat,'pret');assert.equal(sans.horsLigne,true);assert.equal(sans.esv,'non');
 assert.equal(p.ui.instantane(etat(null)).ar.horsLigne,false,'un cut est affiché dans ESV : l’onglet existe');
});

test('relecture après le lot : « Relecture en cours » passe devant « Lot terminé » ; un résultat incertain passe devant la relecture',async()=>{
 const p=await monter({etat:etat(LOT)});
 const fini={...LOT,state:'COMPLETED'},ar=x=>p.ui.instantane(etat(fini,x)).ar;
 assert.equal(ar().etat,'fini','sans relecture : lot terminé');assert.equal(ar().lotOuvert,false);
 p.els['relecture-arreter'].hidden=false;
 assert.equal(ar().etat,'rel');assert.equal(ar().lotOuvert,true,'Écho et le cache sont indisponibles pendant la relecture');
 assert.equal(p.ui.instantane(etat({...LOT,state:'STOPPED',stoppedAtEnd:{issue:'fin'}})).ar.etat,'rel','lot arrêté à la fin de la partie, puis relu');
 assert.equal(p.ui.instantane(etat({...LOT,state:'STOPPED'})).ar.etat,'arrete','lot arrêté en route : pas de relecture');
 assert.equal(ar({reconcileRequired:true}).etat,'alerte');
});

test('deuxième passe des différés : « en cours » seulement quand elle écrit dans ESV ; elle passe devant « Relecture en cours » ; un résultat incertain passe devant tout',async()=>{
 const p=await monter({etat:etat(LOT)});
 const fini={...LOT,state:'COMPLETED'},passe=(e,x={})=>({passeDifferes:{lotId:'L1',mode:'ecriture',etat:e,differes:3,posees:2,demandees:2,ecrites:0,cut:4787,message:null,...x}});
 const ar=(e,x)=>p.ui.instantane(etat(fini,passe(e,x))).ar;
 assert.equal(ar('ecriture').etat,'p2');assert.equal(ar('ecriture').lotOuvert,true);assert.deepEqual(js(ar('ecriture').passe2),{cut:4787,ecrites:0,demandees:2});
 for(const e of ['calcul','finie','arretee','erreur'])assert.equal(ar(e).etat,'fini',e+' : elle n’écrit pas');assert.equal(ar('finie').lotOuvert,false);
 assert.equal(p.ui.instantane(etat(fini)).ar.passe2,null,'sans deuxième passe, rien');
 p.els['relecture-arreter'].hidden=false;assert.equal(ar('ecriture').etat,'p2','la passe qui écrit passe devant la relecture');assert.equal(ar('finie').etat,'rel');
 assert.equal(p.ui.instantane(etat(fini,{...passe('ecriture'),reconcileRequired:true})).ar.etat,'alerte');
});

test('« Pause demandée » : le clic sur Pause la garde tant que le lot tourne, pour ce lot seulement',async()=>{
 const p=await monter({etat:etat(LOT)});
 p.els.pause.hidden=false;
 p.ui.agir('pause');assert.equal(p.els.pause.clics,1,'le clic est celui du bouton d’origine');
 assert.equal(p.ui.instantane(etat(LOT)).ar.etat,'dem');
 assert.equal(p.ui.instantane(etat({...LOT,state:'PAUSED'})).ar.etat,'pause');
 assert.equal(p.ui.instantane(etat(LOT)).ar.etat,'cours','la demande est oubliée dès que le lot s’est arrêté');
 p.els.pause.disabled=true;p.ui.agir('pause');assert.equal(p.els.pause.clics,1,'un bouton grisé n’est pas cliqué');
});

test('bornes du prochain lot : « 999999 » (fin de partie) n’est jamais affiché ; le champ d’origine reçoit ce qu’on tape',async()=>{
 const p=await monter({stockage:{banane51Interface:'ariane2'},etat:etat(null)});
 p.els.start.value='4800';p.els.end.value='999999';
 assert.deepEqual(JSON.parse(JSON.stringify(p.ui.instantane(etat(null)).ar.bornes)),{debut:'4800',fin:null});
 p.els.end.value='4900';assert.equal(p.ui.instantane(etat(null)).ar.bornes.fin,'4900');
 assert.deepEqual(JSON.parse(JSON.stringify(p.ui.instantane(etat(LOT)).ar.bornes)),{debut:4800,fin:null},'lot « jusqu’à la fin de la partie »');
 assert.deepEqual(JSON.parse(JSON.stringify(p.ui.instantane(etat({...LOT,scope:{start:4800,end:4900}})).ar.bornes)),{debut:4800,fin:4900});
 const evenements=[];p.els.end.dispatchEvent=e=>evenements.push(e.type);
 p.hote.ecoutes.input[0]({target:{dataset:{borne:'end'},value:'4950'}});
 assert.equal(p.els.end.value,'4950');assert.deepEqual(js(evenements),['input','change']);
});

test('un réglage choisi sur l’habillage clique la case ou le bouton radio d’origine',async()=>{
 const p=await monter({etat:etat(null)});
 const choisir=(nom,valeur)=>p.hote.ecoutes.change[0]({target:{closest:()=>({dataset:{sel:nom},value:valeur})}});
 choisir('relecture','ombre');choisir('clic','tout-recentre');
 assert.equal(p.els['relecture-ombre'].clics,1);assert.equal(p.els['clic-tout-recentre'].clics,1);
 choisir('grappe','oui');assert.equal(p.els['grappe-differes'].clics,1);
 p.els['grappe-differes'].checked=true;choisir('grappe','oui');assert.equal(p.els['grappe-differes'].clics,1,'déjà allumée : pas de second clic');
 choisir('grappe','non');assert.equal(p.els['grappe-differes'].clics,2);
 p.els['passe-differes'].checked=true;choisir('passe2','oui');assert.equal(p.els['passe-differes'].clics,0,'déjà allumée : pas de clic');
 choisir('passe2','non');assert.equal(p.els['passe-differes'].clics,1);
 p.els['passe-differes'].indeterminate=true;assert.equal(p.ui.instantane(etat(null)).reglages.passe2,null,'case indéterminée : état inconnu');
 choisir('passe2','non');assert.equal(p.els['passe-differes'].clics,2,'état inconnu puis « Coupée » : un clic sur la case');assert.equal(p.els['passe-differes'].indeterminate,false);
 p.els['passe-differes'].indeterminate=true;choisir('passe2','');assert.equal(p.els['passe-differes'].clics,2,'« État inconnu » choisi : rien');
 choisir('raison','alt-chiffres');assert.equal(p.els['raison-actif'].clics,1);assert.equal(p.els['raison-touches-alt-chiffres'].clics,1);
 p.els['raison-actif'].checked=true;choisir('raison','non');assert.equal(p.els['raison-actif'].clics,2);
 assert.deepEqual(js(p.envoyes),[],'aucun message au service worker');
});

test('un nouveau dessin garde la position de défilement de l’écran, des réglages et des listes',async()=>{
 const p=await monter({stockage:{banane51Interface:'ariane2'},etat:etat(LOT)});
 const avant=[{scrollTop:240},{scrollTop:0},{scrollTop:35}],apres=[{scrollTop:0},{scrollTop:0},{scrollTop:0}];let appels=0;
 p.hote.querySelectorAll=sel=>sel.split(',').includes('.ecr')&&sel.split(',').includes('.reg')&&sel.split(',').includes('.defile')?(appels++%2===0?avant:apres):[];   /* avant le dessin, puis après : les éléments sont remplacés */
 p.ui.maj(true);
 assert.deepEqual(apres.map(e=>e.scrollTop),[240,0,35]);
});

test('un clic sur l’habillage est un clic sur l’élément d’origine (jamais un message) ; un bouton grisé n’est pas cliqué',async()=>{
 const p=await monter({etat:etat(LOT)});
 p.ui.agir('legacy:export-tout');assert.equal(p.els['export-tout'].clics,1);
 p.els['export-tout'].disabled=true;p.ui.agir('legacy:export-tout');assert.equal(p.els['export-tout'].clics,1);
 p.ui.agir('legacy:inexistant');
 assert.deepEqual(js(p.envoyes),[]);
});

test('l’habillage : chargé après panel.js, dans la page du panneau seulement, aucun message au service worker, aucune API Chrome hors son choix, la taille de la fenêtre et une ressource',()=>{
 const html=lire('panel.html'),manifeste=require('../manifest.json');
 assert.ok(html.includes('<script src="panel.js"></script><script src="src/ui5-variante.js"></script><script src="src/ui5-rendu.js"></script><script src="src/signal-rendu.js"></script><script src="src/ui5.js"></script></body>'));
 assert.ok(html.includes('<link rel="stylesheet" href="panel.css"><link rel="stylesheet" href="panel-ui5.css"><link rel="stylesheet" href="panel-signal.css">'));
 for(const f of ['src/ui5.js','src/ui5-rendu.js','src/signal-rendu.js','src/ui5-variante.js','src/relecture-pause.js'])assert.ok(!manifeste.content_scripts.some(c=>c.js.includes(f)),f+' : jamais injecté dans ESV');
 assert.ok(!/ui5/.test(lire('background.js').replace(/\/\*[\s\S]*?\*\//g,'')),'le service worker ne connaît pas l’habillage');
 assert.equal(lire('src/ui5-variante.js').match(/defaut: '([a-z0-9]+)'/)[1],'signal','Signal au départ (D-250)');
 for(const f of ['src/ui5.js','src/ui5-rendu.js','src/signal-rendu.js','src/ui5-variante.js']){
  const s=lire(f).replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/sendMessage|runtime\.connect|exportToutZip|exportComplet|saveBlob|downloads|BananeZip|api\(/.test(s),f);
  const apis=[...s.matchAll(/chrome\??\.[a-zA-Z]+(?:\??\.[a-zA-Z]+)*/g)].map(m=>m[0].replace(/\?/g,''));
  for(const a of apis)assert.ok(/^chrome(\.(storage(\.local(\.(get|set))?)?|windows(\.(getCurrent|update))?|runtime(\.getURL)?))?$/.test(a),f+' : '+a);
  assert.ok(!/chrome\??\.(tabs|downloads|scripting|webNavigation)/.test(s),f);
 }
});

/* D-250 : Signal dans la page. */
const {element}=require('./helpers/ui5-page.cjs');
const LOT_FINI={...LOT,state:'COMPLETED',deferred:[{cut:4809,deferredAt:'2026-10-25T13:33:00Z',unresolvedRails:['right']},{cut:4803}],processed:[{durationMs:6000},{durationMs:8000},{durationMs:7000}]};
test('Signal · Revue V2 : « Examiner » est gardé par lot sans message ; « Ouvrir » recopie la cible et clique le bouton caché du panneau, jamais autre chose',async()=>{
 const p=await monter({etat:etat(LOT_FINI)});
 p.ui.agir('sg:examiner:d:4809');await p.attendre(10);
 assert.deepEqual(js(p.ecrits.at(-1)),{banane51Examines:{lot:'L1',cles:['d:4809']}});assert.match(p.hote.innerHTML,/data-act="sg:examiner:d:4809" aria-pressed="true"/);
 p.ui.agir('sg:examiner:d:4809');await p.attendre(10);assert.deepEqual(js(p.ecrits.at(-1)),{banane51Examines:{lot:'L1',cles:[]}});
 p.ui.agir('sg:ouvrir:4809');assert.match(p.hote.innerHTML,/indisponible pour l’instant/,'sans le bouton du moteur : une note, rien d’autre');
 for(const id of ['goto-cut','goto-cut-cible','goto-cut-etat'])p.els[id]=element(id);
 p.ui.agir('sg:ouvrir:4809');assert.equal(p.els['goto-cut-cible'].value,'13:4809');assert.equal(p.els['goto-cut'].clics,1);
 p.els['goto-cut'].disabled=true;p.ui.agir('sg:ouvrir:4803');assert.equal(p.els['goto-cut'].clics,1,'grisé par le panneau : pas de clic');
 assert.deepEqual(js(p.envoyes),[],'aucun message au service worker');
 const autre=await monter({stockage:{banane51Examines:{lot:'L1',cles:['d:4803']}},etat:etat(LOT_FINI)});
 assert.deepEqual(js(autre.ui.instantane(etat(LOT_FINI)).sig.examines),['d:4803'],'gardé d’une ouverture à l’autre');
 assert.deepEqual(js(autre.ui.instantane(etat({...LOT_FINI,id:'L2'})).sig.examines),[],'un autre lot repart de zéro');
});

test('Signal · clavier : Ctrl K ouvre et ferme la palette, Échap ferme, tiroir ouvert ↓ puis E marque la ligne ; Entrée ne lance jamais une commande grisée',async()=>{
 const p=await monter({etat:etat(LOT_FINI)});
 const clavier=e=>{for(const f of p.body.ecoutes.keydown)f(e);return e;};
 clavier(touche('k',{ctrlKey:true,target:{tagName:'DIV'}}));assert.match(p.hote.innerHTML,/class="sg-palette"/);
 clavier(touche('Escape',{target:{tagName:'DIV'}}));assert.doesNotMatch(p.hote.innerHTML,/class="sg-palette"/);
 p.ui.agir('sg:tiroir');clavier(touche('ArrowDown',{target:{tagName:'DIV'}}));clavier(touche('e',{target:{tagName:'DIV'}}));await p.attendre(10);
 assert.deepEqual(js(p.ecrits.at(-1)),{banane51Examines:{lot:'L1',cles:['d:4803']}},'la première ligne : le différé le plus récent');
 clavier(touche('Escape',{target:{tagName:'DIV'}}));assert.match(p.hote.innerHTML,/data-ouvert="0"/);
 p.els['export-tout'].disabled=true;clavier(touche('k',{ctrlKey:true,target:{tagName:'DIV'}}));p.champ.value='export';p.hote.ecoutes.input[0]({target:p.champ});
 clavier(touche('Enter',{target:p.champ}));assert.equal(p.els['export-tout'].clics,0);
 assert.deepEqual(js(p.envoyes),[]);
});

test('Signal · secours : si le dessin échoue, le panneau d’avant revient avec la raison ; rien n’est envoyé',async()=>{
 const p=await monter({etat:etat(LOT)});
 const rendre=p.ctx.ArianeSignalRendu.rendre;p.ctx.ArianeSignalRendu.rendre=()=>{throw Error('essai');};
 p.ui.maj(true);
 assert.equal(p.hote.hidden,true);assert.equal(p.body.classList.contains('ui5'),false);assert.match(p.els.notice.textContent,/n’a pas pu s’afficher \(essai\)/);
 p.ctx.ArianeSignalRendu.rendre=rendre;p.els['ui5-essai'].onclick();await p.attendre(20);
 assert.equal(p.hote.hidden,false,'« Essayer le nouveau panneau » le rend');assert.equal(p.hote.className,'u-signal');
 assert.deepEqual(js(p.envoyes),[]);
});

test('Signal · réglages : un choix clique l’élément d’origine (thème, bandeau, F5 de la relecture)',async()=>{
 const p=await monter({etat:etat(null)});
 p.ui.agir('sg:choix:bandeau:oui');assert.equal(p.els['bandeau-toggle'].clics,1);
 p.els['relecture-f5'].value='pause';let change=0;p.els['relecture-f5'].onchange=()=>change++;
 p.hote.ecoutes.change[0]({target:{closest:()=>({dataset:{sel:'f5'},value:'arret'})}});assert.equal(p.els['relecture-f5'].value,'arret');assert.equal(change,1);
 p.hote.ecoutes.change[0]({target:{closest:()=>({dataset:{sel:'f5'},value:'arret'})}});assert.equal(change,1,'déjà choisi : rien');
 assert.deepEqual(js(p.envoyes),[]);
});
