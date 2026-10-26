'use strict';
/* Test 17 — L'HABILLAGE DU PANNEAU DANS LA PAGE (src/ui5.js, chargé comme panel.html le charge), contre une page minimale (tests/helpers/ui5-page.cjs) :
 *  - D-250 : au départ, c'est Signal ; rien n'est écrit, aucune fenêtre n'est redimensionnée ; le panneau d'avant n'est plus proposé ; test 23 : les
 *    présentations d'essai sont retirées, tout choix gardé vaut Signal ;
 *  - l'état du lot dit ce que le lot attend (un lot en pause pour une pose peu sûre n'est pas « en pause » tout court) ; « 999999 » n'est jamais une borne affichée ;
 *  - un clic sur l'habillage est un clic sur l'élément d'origine, jamais un message nouveau ; un nouveau dessin garde la position de défilement.
 * Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {monter}=require('./helpers/ui5-page.cjs');
const lire=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const js=x=>JSON.parse(JSON.stringify(x));   /* les objets de la vm viennent d'un autre contexte : on compare leur contenu */
const LOT={id:'L1',scope:{start:4800,end:999999},state:'RUNNING',processed:[],deferred:[],activeIdentity:{part:13,cut:4812}};
const touche=(key,o={})=>({key,ctrlKey:false,altKey:false,target:null,preventDefault(){this.empeche=true;},...o});
const etat=(batch,extra={})=>({batch,current:{identity:{part:13,cut:4812}},connection:{status:'ok'},native:{status:'IDLE',visits:[]},...extra});

test('au départ (D-250) : Signal, sans rien écrire, envoyer ni redimensionner ; le panneau d’avant reste caché derrière',async()=>{
 const p=await monter({etat:etat(LOT)});
 assert.equal(p.hote.hidden,false);assert.equal(p.body.classList.contains('ui5'),true);assert.equal(p.hote.className,'u-signal');
 assert.match(p.hote.innerHTML,/class="sg-fen"/);assert.equal(p.hote.dataset.theme,'sombre','sombre par défaut');
 assert.deepEqual(js(p.ecrits),[]);assert.deepEqual(js(p.envoyes),[]);assert.deepEqual(js(p.fenetres),[],'la fenêtre garde la taille que le service worker lui a donnée');
 assert.ok(!lire('panel.html').includes('id="ui5-essai"'),'test 23 : plus de lien « Essayer le nouveau panneau »');
});

test('test 23 : Signal est la seule présentation ; un choix gardé (ancienne, ariane2, palette ou autre) laisse Signal ; « variante:… » ne change rien',async()=>{
 for(const v of ['signal','ancienne','ariane2','palette','ariane','linear','n’importe quoi',null]){
  const p=await monter({stockage:{banane51Interface:v},etat:etat(LOT)});
  assert.equal(p.hote.hidden,false,String(v));assert.equal(p.hote.className,'u-signal',String(v));assert.equal(p.body.classList.contains('ui5'),true,String(v));
 }
 const p=await monter({etat:etat(LOT)});
 for(const v of ['ancienne','ariane2','palette']){p.ui.agir('variante:'+v);await p.attendre(10);assert.equal(p.hote.className,'u-signal',v);}
 assert.deepEqual(js(p.ecrits),[],'rien d’écrit');assert.doesNotMatch(p.hote.innerHTML,/variante|ariane2|Ancien panneau/);
 assert.ok(!require('node:fs').existsSync(require('node:path').join(__dirname,'..','src/ui5-rendu.js')),'la présentation d’essai est retirée');
});

test('la fenêtre garde la taille que l’opérateur lui a donnée : Signal ne la redimensionne pas à l’ouverture',async()=>{
 const p=await monter({etat:etat(LOT),fenetre:{width:1180,height:840}});
 assert.deepEqual(js(p.fenetres),[]);
});

test('un clic sur un onglet ESV le choisit puis clique « Reconnecter ESV » ; le cache et le verrou de connexion suivent les boutons d’origine',async()=>{
 const p=await monter({etat:etat(LOT)});
 p.els.tabs.value='';p.ui.agir('conn:12');assert.equal(p.els.tabs.value,'12');assert.equal(p.els.connect.clics,1);
 p.els['export-cache-clear'].disabled=true;p.els.connect.disabled=true;
 const ar=p.ui.instantane(etat(null)).ar;assert.equal(ar.cache.actif,false);assert.equal(ar.connexionBloquee,true);
 p.els['export-cache-clear'].disabled=false;p.els.connect.disabled=false;
 const libre=p.ui.instantane(etat(null)).ar;assert.equal(libre.cache.actif,true);assert.equal(libre.connexionBloquee,false);
 assert.deepEqual(js(p.envoyes),[]);
});

test('le compteur des exemples d’apprentissage est lu dans datasets/compteur-gcv2.json (format du compteur)',async()=>{
 const p=await monter({etat:etat(null)});
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

test('Bascule T21 : l’état de la séance Écho vient du statut réel ; une séance FINIE est « Séance terminée », jamais « à terminer »',async()=>{
 const p=await monter({etat:etat(null)});
 const e=n=>p.ui.instantane(etat(null,{native:n})).ar.echoEtat,v=[{cut:1}];
 assert.equal(e({status:'RUNNING',visits:v}),'Collecte en cours');assert.equal(e({status:'PAUSED',visits:v}),'Collecte en pause');
 assert.equal(e({status:'STARTING',visits:[]}),'Démarrage de la collecte');assert.equal(e({status:'PAUSED_ADAPTER_UNRESPONSIVE',visits:v}),'ESV ne répond plus');
 assert.equal(e({status:'FINISHED',visits:v}),'Séance terminée');assert.equal(e({status:'FINISHED',visits:[]}),'Séance terminée');
 assert.equal(e({status:'IDLE',visits:[]}),'Aucune séance en cours');
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
 const p=await monter({etat:etat(null)});
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

test('un clic sur l’habillage est un clic sur l’élément d’origine (jamais un message) ; un bouton grisé n’est pas cliqué',async()=>{
 const p=await monter({etat:etat(LOT)});
 p.ui.agir('legacy:export-tout');assert.equal(p.els['export-tout'].clics,1);
 p.els['export-tout'].disabled=true;p.ui.agir('legacy:export-tout');assert.equal(p.els['export-tout'].clics,1);
 p.ui.agir('legacy:inexistant');
 assert.deepEqual(js(p.envoyes),[]);
});

test('l’habillage : chargé après panel.js, dans la page du panneau seulement, aucun message au service worker, aucune API Chrome hors son choix, la taille de la fenêtre et une ressource',()=>{
 const html=lire('panel.html'),manifeste=require('../manifest.json');
 assert.ok(html.includes('<script src="panel.js"></script><script src="src/ui5-variante.js"></script><script src="src/signal-rendu.js"></script><script src="src/ui5.js"></script></body>'));
 assert.ok(html.includes('<link rel="stylesheet" href="panel.css"><link rel="stylesheet" href="panel-ui5.css"><link rel="stylesheet" href="panel-signal.css">'));
 for(const f of ['src/ui5.js','src/signal-rendu.js','src/ui5-variante.js','src/relecture-pause.js'])assert.ok(!manifeste.content_scripts.some(c=>c.js.includes(f)),f+' : jamais injecté dans ESV');
 assert.ok(!/ui5/.test(lire('background.js').replace(/\/\*[\s\S]*?\*\//g,'')),'le service worker ne connaît pas l’habillage');
 assert.equal(lire('src/ui5-variante.js').match(/defaut: '([a-z0-9]+)'/)[1],'signal','Signal au départ (D-250)');
 for(const f of ['src/ui5.js','src/signal-rendu.js','src/ui5-variante.js']){
  const s=lire(f).replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/sendMessage|runtime\.connect|exportToutZip|exportComplet|saveBlob|downloads|BananeZip|api\(/.test(s),f);
  const apis=[...s.matchAll(/chrome\??\.[a-zA-Z]+(?:\??\.[a-zA-Z]+)*/g)].map(m=>m[0].replace(/\?/g,''));
  for(const a of apis)assert.ok(/^chrome(\.(storage(\.local(\.(get|set))?)?|windows(\.(getCurrent|update))?|runtime(\.getURL)?))?$/.test(a),f+' : '+a);
  assert.ok(!/chrome\??\.(tabs|downloads|scripting|webNavigation)/.test(s),f);
 }
});

/* D-250 : Signal dans la page. */
const LOT_FINI={...LOT,state:'COMPLETED',deferred:[{cut:4809,deferredAt:'2026-10-25T13:33:00Z',unresolvedRails:['right']},{cut:4803}],processed:[{durationMs:6000},{durationMs:8000},{durationMs:7000}]};
test('Signal · Revue V2 : « Examiner » est gardé par lot sans message ; « Ouvrir » recopie la cible et clique le bouton caché du panneau, jamais autre chose',async()=>{
 const p=await monter({etat:etat(LOT_FINI)});
 p.ui.agir('sg:examiner:d:4809');await p.attendre(10);
 assert.deepEqual(js(p.ecrits.at(-1)),{banane51Examines:{lot:'L1',cles:['d:4809']}});assert.match(p.hote.innerHTML,/data-act="sg:examiner:d:4809" aria-pressed="true"/);
 p.ui.agir('sg:examiner:d:4809');await p.attendre(10);assert.deepEqual(js(p.ecrits.at(-1)),{banane51Examines:{lot:'L1',cles:[]}});
 for(const id of ['goto-cut','goto-cut-cible','goto-cut-etat'])assert.ok(p.els[id],id+' : dans panel.html (T20a)');
 const go=p.els['goto-cut'];delete p.els['goto-cut'];
 p.ui.agir('sg:ouvrir:4809');assert.match(p.hote.innerHTML,/indisponible pour l’instant/,'sans le bouton du moteur : une note, rien d’autre');
 p.els['goto-cut']=go;
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

test('Signal · secours : si le dessin échoue, le panneau d’avant revient avec la raison, jusqu’à la prochaine ouverture ; rien n’est envoyé',async()=>{
 const p=await monter({etat:etat(LOT)});
 const rendre=p.ctx.ArianeSignalRendu.rendre;p.ctx.ArianeSignalRendu.rendre=()=>{throw Error('essai');};
 p.ui.maj(true);
 assert.equal(p.hote.hidden,true);assert.equal(p.body.classList.contains('ui5'),false);assert.match(p.els.notice.textContent,/n’a pas pu s’afficher \(essai\)/);
 p.ctx.ArianeSignalRendu.rendre=rendre;p.ui.maj(true);assert.equal(p.hote.hidden,true,'le secours tient jusqu’à la prochaine ouverture');
 const autre=await monter({etat:etat(LOT)});assert.equal(autre.hote.hidden,false,'à la prochaine ouverture, Signal');
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

test('Signal · T20a : statut de connexion, « Reconnecter » (bouton d’origine), historique des parties et heure de pause lus dans l’état ; rien d’inventé quand ils manquent',async()=>{
 const pausedAt=new Date(Date.now()-90000).toISOString();
 const H=[{part:13,batchId:'L1',startedAt:'2026-10-25T13:00:00Z',endedAt:null,version:'4.9.5.21',depart:{valides:10,invalides:120,ignores:0,total:130},cibles:120,poses:null,differes:null,ecritsPasse:null,main:null,fin:'en-cours'}];
 const p=await monter({etat:etat({...LOT,state:'PAUSED',pauseReason:'user',pausedAt},{connection:{status:'reconnecting'},partsHistory:H})});
 Object.assign(p.els.reconnect,{hidden:false,disabled:true});
 const sig=p.ui.instantane(etat({...LOT,state:'PAUSED',pauseReason:'user',pausedAt},{connection:{status:'reconnecting'},partsHistory:H})).sig;
 assert.equal(sig.connexion.statut,'reconnecting');assert.deepEqual(js(sig.connexion.reconnect),{visible:true,actif:false});
 assert.equal(sig.historique[0].part,13);assert.ok(sig.allure.pauseS>=89&&sig.allure.pauseS<120,'en pause depuis environ 90 s');
 p.rendu(etat({...LOT,state:'PAUSED',pauseReason:'user',pausedAt},{connection:{status:'reconnecting'},partsHistory:H}));
 assert.match(p.hote.innerHTML,/class="sg-pause-depuis" data-debut="\d+">1 min 3\d<\/b>|class="sg-pause-depuis" data-debut="\d+">1 min 30<\/b>/);assert.match(p.hote.innerHTML,/data-etat="libre"/,'la puce dit la reconnexion');
 p.els.reconnect.disabled=false;p.ui.agir('legacy:reconnect');assert.equal(p.els.reconnect.clics,1);
 const vide=p.ui.instantane(etat(LOT)).sig;assert.equal(vide.historique,null);assert.equal(vide.allure.pauseS,null);
 assert.deepEqual(js(p.envoyes),[]);
});
