'use strict';
/* T20a (D-243, D-250, architecture module U) — CONNEXION À ESV TENUE À JOUR, RECONNEXION APRÈS F5. Service worker RÉEL (background.js) en VM,
 * ESV simulé (tests/helpers/background-harness.cjs) :
 *  - `connection.status` ∈ {ready, reconnecting, unavailable, no-tab}, avec `observedAt`, `message`, `tabId`, mis à jour à chaque équipement réussi
 *    de l'onglet (ready), à chaque perte de la page (unavailable), pendant une reconnexion (reconnecting), sans onglet (no-tab) ;
 *  - après un F5, l'onglet est ré-équipé seul (« équipé » en moins de 2 s après `complete`), sans aucune commande ESV ;
 *  - jamais pendant Écho (qui a sa propre reprise), un lot ouvert, la deuxième passe, la relecture, une reprise ou un retour au cut ;
 *  - équipements sérialisés par onglet : un `complete` d'Écho et un second équipement simultanés ne font qu'une injection ;
 *  - le contrôle « Une autre Ariane » est respecté : rien n'est injecté ni tamponné ;
 *  - action `reconnect` (bouton « Reconnecter ») ; relevé en lecture seule du sélecteur de parties (`partsSelector`) ; `batch.pausedAt`.
 * Le message « ESV n'est pas connecté » du nouveau panneau ne dépend que du statut (src/ui5-rendu.js). Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {background}=require('./helpers/background-harness.cjs'),K=require('../src/core.js'),Settings=require('../src/settings.js'),EC=require('../src/export-cache.js');
const R=require('../src/ui5-rendu.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x));
/* Commandes ESV de l'adaptateur simulé (`calls`) : la lecture `ping` et l'injection n'en sont pas. */
const COMMANDES=['capture','apply','restore','next','validate','skip','nextWithoutDecision','goToCut','validateInPlace','cancel','nativeStart','nativeResume'];
const REGLAGES={...Settings,echo:{...Settings.echo,reprise:{pollMs:5,silenceListeMs:40,attenteSansListeMs:60,delaiMaxMs:700}}};
const globals=(extra={})=>({BananeCore3:K,BananeSettings:REGLAGES,BananeExportCache:EC,setTimeout,clearTimeout,...extra});
const adaptateurs=injected=>injected.filter(o=>o.files?.includes('src/adapter-page.js')).length;
const bridges=injected=>injected.filter(o=>o.files?.includes('src/bridge.js')).length;
async function statut(b,attendu,ms=2000){const t0=Date.now();let v;
 while(Date.now()-t0<ms){v=(await b.api('view')).connection;if(v?.status===attendu)return {v,ms:Date.now()-t0};await sleep(5);}
 return {v,ms:null};}
/* Injection lente (30 ms par executeScript) : deux équipements lancés ensemble se chevauchent à coup sûr. */
function lente(injected){return async o=>{injected.push(o);await sleep(30);return [{frameId:0,result:o.func?null:undefined}];};}
async function monte(opts={}){const injected=opts.injected||[];
 const b=background({globals:globals(opts.globals),executeScript:opts.executeScript||(async o=>{injected.push(o);return [{frameId:0,result:o.func?null:undefined}];})});
 await b.api('connect',{tabId:1});return {b,injected,engine:b.fonction('engine')};}

test('après un F5 hors activité : « unavailable » au rechargement, puis « ready » en moins de 2 s après complete, une injection, 0 commande ESV',async()=>{
 const {b,injected}=await monte();
 let c=(await b.api('view')).connection;assert.equal(c.status,'ready');assert.equal(c.tabId,1);assert.equal(typeof c.observedAt,'string');
 const avant=injected.length,appels=b.adapter.calls.length;
 await b.tabUpdated(1,{status:'loading'});
 c=b.fonction('engine.s.connection');assert.equal(c.status,'unavailable','perte de la page : statut à jour sans attendre une lecture');assert.equal(c.tabId,1);assert.equal(typeof c.message,'string');
 const t0=Date.now();await b.tabUpdated(1,{status:'complete'});
 const r=await statut(b,'ready');assert.notEqual(r.ms,null,`statut final ${JSON.stringify(r.v)}`);
 const ms=Date.now()-t0;console.log(`# équipé en ${ms} ms après complete`);assert.ok(ms<2000,`${ms} ms`);
 const neuves=injected.slice(avant);assert.equal(adaptateurs(neuves),1,'une injection de l’adaptateur');assert.equal(bridges(neuves),1,'un pont');
 assert.ok(neuves.length<=3,'sonde, adaptateur, pont : rien d’autre');
 assert.deepEqual(b.adapter.calls.slice(appels).filter(x=>COMMANDES.includes(x)),[],'aucune commande ESV');
 assert.equal(r.v.tabId,1);assert.equal(r.v.message,null);
 assert.ok(b.store.events.some(e=>e.type==='reconnexion-auto'&&e.resultat==='equipe'),'la reconnexion automatique est journalisée');
});

test('trois F5 de suite : chaque fois ré-équipé, sans repasser par le menu',async()=>{
 const {b,injected}=await monte();const avant=adaptateurs(injected);
 for(let i=0;i<3;i++){await b.tabUpdated(1,{status:'loading'});assert.equal(b.fonction('engine.s.connection').status,'unavailable');
  await b.tabUpdated(1,{status:'complete'});assert.notEqual((await statut(b,'ready')).ms,null,`F5 n° ${i+1}`);}
 assert.equal(adaptateurs(injected)-avant,3);
});

test('rien ne se ré-équipe pendant Écho, un lot en cours ou en pause, la passe, la relecture, une reprise ou un retour au cut ; le lot n’est jamais relancé',async()=>{
 const cas=[
  ['lot en cours',x=>{x.engine.s.batch={id:'L1',state:'RUNNING',scope:{part:23,start:1,end:9},processed:[],deferred:[],skipped:[]};},x=>{x.engine.s.batch=null;}],
  ['lot en pause',x=>{x.engine.s.batch={id:'L2',state:'PAUSED',scope:{part:23,start:1,end:9},processed:[],deferred:[],skipped:[]};},x=>{x.engine.s.batch=null;}],
  ['deuxième passe (calcul)',x=>{x.b.fonction('passeDiff').cours=new Promise(()=>{});},x=>{x.b.fonction('passeDiff').cours=null;}],
  ['deuxième passe (écriture)',x=>{x.b.fonction('passeDiff').ecriture={arret:false};},x=>{x.b.fonction('passeDiff').ecriture=null;}],
  ['relecture',x=>{x.b.fonction('relecture').passe={etat:'en-cours',faits:1,total:3};},x=>{x.b.fonction('relecture').passe=null;}],
  ['relecture en pause',x=>{x.b.fonction('relecture').passe={etat:'en-pause',faits:1,total:3};},x=>{x.b.fonction('relecture').passe=null;}],
  ['reprise du lot',x=>{x.b.fonction('repriseEnCours=true');},x=>{x.b.fonction('repriseEnCours=false');}],
  ['retour au cut',x=>{x.b.fonction('retourCutEnCours={operationId:"op",depuis:Date.now(),cible:{part:23,cut:9}}');},x=>{x.b.fonction('retourCutEnCours=null');}],
  ['Écho actif',x=>{x.b.fonction('native').active=()=>true;},x=>{delete x.b.fonction('native').active;}]];
 const x=await monte();
 for(const [nom,poser,oter] of cas){
  const avant=adaptateurs(x.injected),appels=x.b.adapter.calls.length,lot=x.engine.s.batch?.state;
  poser(x);const lotAvant=JSON.stringify(x.engine.s.batch);
  await x.b.tabUpdated(1,{status:'loading'});await x.b.tabUpdated(1,{status:'complete'});await sleep(60);
  assert.equal(adaptateurs(x.injected),avant,`${nom} : rien n’est injecté`);
  assert.deepEqual(x.b.adapter.calls.slice(appels),[],`${nom} : aucune commande`);
  assert.notEqual(x.b.fonction('engine.s.connection').status,'ready',`${nom} : la page rechargée n’est pas dite prête`);
  assert.equal(JSON.stringify(x.engine.s.batch),lotAvant,`${nom} : le lot n’est pas touché (${lot})`);
  oter(x);
  /* Activité finie : le F5 suivant ré-équipe de nouveau. */
  await x.b.tabUpdated(1,{status:'loading'});await x.b.tabUpdated(1,{status:'complete'});
  assert.notEqual((await statut(x.b,'ready')).ms,null,`${nom} : après l’activité, la reconnexion reprend`);}
});

test('équipements sérialisés par onglet : deux complete simultanés, ou un complete d’Écho et « Reconnecter » ensemble, ne font qu’une injection',async()=>{
 /* Hors activité : deux événements complete coup sur coup. */
 let injected=[];let x=await monte({injected,executeScript:lente(injected)});
 await x.b.tabUpdated(1,{status:'loading'});let avant=adaptateurs(injected);
 await Promise.all([x.b.tabUpdated(1,{status:'complete'}),x.b.tabUpdated(1,{status:'complete'})]);
 assert.notEqual((await statut(x.b,'ready')).ms,null);assert.equal(adaptateurs(injected)-avant,1,'une seule injection');
 /* Écho : la page est perdue ; sa reprise (complete) et un clic « Reconnecter » partent ensemble. */
 injected=[];x=await monte({injected,executeScript:lente(injected)});
 const page={label:{part:23,cut:100}};x.b.adapter.ping=async()=>({version:K.VERSION,pageId:x.b.adapter.identity.pageId,proprietaire:'test',label:page.label});
 await x.b.api('native-start');
 await x.b.tabUpdated(1,{status:'loading'});assert.equal(x.b.fonction('engine.s.native').status,'PAUSED_ADAPTER_UNRESPONSIVE');
 avant=adaptateurs(injected);
 await Promise.all([x.b.tabUpdated(1,{status:'complete'}),x.b.api('reconnect')]);
 await sleep(200);
 assert.equal(adaptateurs(injected)-avant,1,'Écho et « Reconnecter » : une seule injection');
 assert.equal(x.b.fonction('engine.s.connection').status,'ready');
});

test('F5 pendant Écho, puis reprise : le message « ESV n’est pas connecté » paraît au rechargement et disparaît dès que la page est ré-équipée',async()=>{
 const x=await monte();const page={label:{part:23,cut:0}};
 x.b.adapter.ping=async()=>({version:K.VERSION,pageId:x.b.adapter.identity.pageId,proprietaire:'test',label:page.label});
 page.label={part:23,cut:100};await x.b.api('native-start');page.label={part:23,cut:0};
 const message=async()=>{const v=await x.b.api('view');return /ESV n’est pas connecté/.test(R.rendre(snap(v.connection?.status),'echo'));};
 assert.equal(await message(),false,'connecté : aucun message');
 await x.b.tabUpdated(1,{status:'loading'});
 assert.equal((await x.b.api('view')).connection.status,'unavailable');assert.equal(await message(),true,'page perdue : le message');
 await x.b.tabUpdated(1,{status:'complete'});
 assert.notEqual((await statut(x.b,'ready')).ms,null,'la reprise d’Écho ré-équipe : statut prêt');
 assert.equal(await message(),false,'le message disparaît dès « ready »');
 page.label={part:23,cut:1681};await sleep(200);
 assert.equal(x.b.fonction('engine.s.native').status,'RUNNING','Écho a repris seul');assert.equal(await message(),false);
});

test('« Une autre Ariane » dans l’onglet rechargé : rien n’est injecté ni tamponné, statut « unavailable » avec le refus, aucun nouvel essai',async()=>{
 const fenetre={},injected=[];
 const executeScript=async o=>{injected.push(o);
  if(o.func)return [{frameId:0,result:vm.runInNewContext(`(${o.func})(...args)`,{window:fenetre,args:o.args||[]})}];
  if(o.files?.includes('src/adapter-page.js')&&!fenetre.__BANANE_V3_PAGE){fenetre.__BANANE_V3_PAGE={version:fenetre.__ARIANE_PROPRIETAIRE?.version,proprietaire:fenetre.__ARIANE_PROPRIETAIRE?.id??null};delete fenetre.__ARIANE_PROPRIETAIRE;}
  return [{frameId:0,result:undefined}];};
 const x=await monte({injected,executeScript});
 /* F5 : la page neuve est d'abord prise par une autre Ariane. */
 for(const k of Object.keys(fenetre))delete fenetre[k];fenetre.__BANANE_V3_PAGE={version:'4.8.6.2',versionName:'4.8.6 test 2',proprietaire:'autre'};
 const avant=injected.length;
 await x.b.tabUpdated(1,{status:'loading'});await x.b.tabUpdated(1,{status:'complete'});await sleep(80);
 const neuves=injected.slice(avant);
 assert.equal(neuves.filter(o=>o.files).length,0,'aucun fichier injecté');assert.equal(neuves.length,1,'une seule sonde, aucun nouvel essai');
 assert.equal('__ARIANE_PROPRIETAIRE' in fenetre,false,'aucun tampon posé');assert.equal(fenetre.__BANANE_V3_PAGE.proprietaire,'autre');
 const c=x.b.fonction('engine.s.connection');assert.equal(c.status,'unavailable');assert.match(c.message,/Une autre Ariane \(4\.8\.6 test 2\)/);
});

test('« Reconnecter » (action reconnect) : équipe l’onglet choisi ; refusé sans onglet (no-tab) ou pendant une action ; onglet fermé : no-tab',async()=>{
 const x=await monte();const avant=adaptateurs(x.injected);
 await x.b.tabUpdated(1,{status:'loading'});
 const v=await x.b.api('reconnect');assert.equal(v.connection.status,'ready');assert.equal(v.connection.tabId,1);assert.equal(adaptateurs(x.injected)-avant,1);
 x.engine.busy=true;await assert.rejects(x.b.api('reconnect'),/Termine l’activité en cours/);x.engine.busy=false;
 await x.b.tabRemoved(1);const c=x.b.fonction('engine.s.connection');assert.equal(c.status,'no-tab');assert.equal(c.tabId,1);
 const y=background({globals:globals()});await assert.rejects(y.api('reconnect'),/onglet ESV/);
 assert.equal((await y.api('view')).connection.status,'no-tab','sans onglet choisi : no-tab');
});

test('statut « reconnecting » pendant la reconnexion ; ESV sans réponse après le rechargement : « unavailable » avec la raison, borné',async()=>{
 const injected=[],R0={...REGLAGES,connexion:{pollMs:5,delaiMaxMs:150}};
 const b=background({globals:globals({BananeSettings:R0}),executeScript:lente(injected)});await b.api('connect',{tabId:1});
 const ping=b.adapter.ping.bind(b.adapter);let muet=true;b.adapter.ping=async(...a)=>{if(muet)throw Error('Could not establish connection. Receiving end does not exist.');return ping(...a);};
 await b.tabUpdated(1,{status:'loading'});void b.tabUpdated(1,{status:'complete'});await sleep(15);
 assert.equal(b.fonction('engine.s.connection').status,'reconnecting');
 await sleep(400);const c=b.fonction('engine.s.connection');assert.equal(c.status,'unavailable');assert.match(c.message,/Reconnexion automatique impossible/);
 assert.ok(b.store.events.some(e=>e.type==='reconnexion-auto'&&e.resultat==='echec'));
 muet=false;assert.equal((await b.api('reconnect')).connection.status,'ready','« Reconnecter » reste possible');
});

test('perte de page pendant une commande (page absente) : statut « unavailable » tout de suite',async()=>{
 const x=await monte();x.b.adapter.state=async()=>{throw Error('Could not establish connection. Receiving end does not exist.');};
 await assert.rejects(x.b.fonction('call')('state'));
 const c=x.b.fonction('engine.s.connection');assert.equal(c.status,'unavailable');assert.match(c.message,/page ESV rechargée ou fermée/);
});

test('relevé du sélecteur de parties (lecture seule, au ping de contrat de l’équipement) : `partsSelector` nettoyé ; journalisé ; absent si la page ne le donne pas',async()=>{
 let rendu={status:'ok',current:12,parts:[{part:11,label:'Partie 11',current:false},{part:12,label:'  Partie   12 ',current:true},{part:'x',label:'?'},{part:13,label:'y'.repeat(90),current:false}]};
 const x=await monte();assert.equal((await x.b.api('view')).partsSelector,null,'adaptateur muet sur le sélecteur : rien d’inventé');
 const ping=x.b.adapter.ping.bind(x.b.adapter);x.b.adapter.ping=async o=>({...await ping(),...(o?.contrat?{selecteurParties:rendu}:{})});
 await x.b.api('reconnect');await sleep(20);
 const s=(await x.b.api('view')).partsSelector;
 assert.equal(typeof s.at,'string');deq0(s,{status:'ok',current:12,parts:[{part:11,label:'Partie 11',current:false},{part:12,label:'Partie 12',current:true},{part:13,label:'y'.repeat(40),current:false}]});
 assert.ok(x.b.store.events.some(e=>e.type==='releve-selecteur-parties'&&e.status==='ok'&&e.n===3));
 rendu={status:'absent',current:null,parts:[]};await x.b.api('reconnect');await sleep(20);deq0((await x.b.api('view')).partsSelector,{status:'absent',current:null,parts:[]});
 rendu={status:'n’importe quoi',parts:'abîmé'};await x.b.api('reconnect');await sleep(20);deq0((await x.b.api('view')).partsSelector,{status:'illisible',current:null,parts:[]});
 assert.ok(!x.b.adapter.calls.some(c=>COMMANDES.includes(c)),'aucune commande ESV');
});
function deq0(s,attendu){const {at,...reste}=plat(s);assert.deepEqual(reste,attendu);}

test('batch.pausedAt : posé à l’entrée en pause, retiré à la reprise',async()=>{
 const x=await monte();const e=x.engine;
 e.s.batch={id:'LP',state:'RUNNING',scope:{part:23,start:1,end:9},processed:[],deferred:[],skipped:[]};await e.save();assert.equal(e.s.batch.pausedAt,undefined);
 e.s.batch.state='PAUSED';await e.save();const t=e.s.batch.pausedAt;assert.ok(Number.isFinite(Date.parse(t)),String(t));
 await sleep(5);await e.save();assert.equal(e.s.batch.pausedAt,t,'l’heure de la pause ne bouge pas');
 e.s.batch.state='RUNNING';await e.save();assert.equal(e.s.batch.pausedAt,undefined);
});

/* Instantané minimal du nouveau panneau (src/ui5-rendu.js) : seul le statut de connexion change. */
function snap(statut){return {variante:'ariane2',notice:{texte:'',erreur:false},avisContrat:'',connexionOuverte:true,connexionStatut:statut,lot:{etat:'Aucun lot',finPartie:''},
 relecture:{ligne:'',actif:false,interrompue:''},echo:{visites:'0',corriges:0},echoRows:[],reglages:{},exportTexte:'',onglets:[{valeur:'1',texte:'ESV'}],ongletChoisi:'1',connexionNote:'',gcv2:null,
 boutonsOrbite:[],boutonsEcho:[],mode:'native',boutons:[],
 ar:{etat:'pret',traites:0,poses:0,differes:0,cibles:null,restants:null,cours:null,dernier:null,partie:23,differesListe:[],verts:[],vertsNombre:0,aExaminer:0,lotOuvert:false,esv:'ok',pause:null,cache:{actif:false},bornes:{debut:null,fin:null},echoEtat:'Collecte en cours'}};}
test('nouveau panneau : « ESV n’est pas connecté » seulement si le statut est unavailable ou no-tab, quel que soit l’état du volet « Connexion à ESV »',()=>{
 for(const [s,vu] of [['unavailable',true],['no-tab',true],['ready',false],['reconnecting',false],[null,false],[undefined,false]])
  for(const e of ['orbite','echo'])assert.equal(/ESV n’est pas connecté/.test(R.rendre(snap(s),e)),vu,`${s} / ${e}`);
});
