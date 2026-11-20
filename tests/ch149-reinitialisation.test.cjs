'use strict';
/* CH-149 (D-381) — remise à zéro complète, seulement hors activité et hors écriture incertaine.
 * Module pur, service worker réel (API Chrome et IndexedDB simulés), rendus Glacier et Mix, actions de la feuille Réglages.
 * Toutes les données sont fabriquées pour ces essais. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const R=require('../src/reinitialisation.js'),SN=require('../src/stockage-neuf.js'),S=require('../src/signal-rendu.js'),M=require('../src/mix-rendu.js');
const {production,memoire}=require('./helpers/perf-production.cjs'),{MemoryStore}=require('./fixtures.cjs'),{monter}=require('./helpers/ui5-page.cjs');

const motif=(ctx,attendu)=>{const r=R.refus(ctx);assert.equal(typeof r,'string',JSON.stringify(ctx));assert.match(r,attendu);};

test('refus : prêt et lots clos sans incertitude sont permis',()=>{
 assert.equal(R.refus({}),null);assert.equal(R.refus({lotEnCours:'IDLE'}),null);
 for(const lotEnCours of ['STOPPED','PAUSED','COMPLETED','ERROR'])assert.equal(R.refus({lotEnCours}),null,lotEnCours);
});

test('refus : chaque activité interdit la remise à zéro',()=>{
 motif({lotEnCours:'RUNNING'},/lot Orbite.*RUNNING/);motif({lotEnCours:'MANUAL_TAKEOVER'},/reprise manuelle/);
 motif({busy:true},/travaille encore/);motif({task:{}},/travaille encore/);motif({repriseEnCours:true},/reprise du lot/);
 motif({retourCutEnCours:{}},/retour à un cut/);motif({fileActive:true},/Constellation/);motif({passeEnCours:true},/deuxième passe/);
 motif({relectureEnCours:'en-cours'},/relecture/);motif({nativeActive:true},/Écho/);motif({manualActive:true},/Mes corrections/);
});

test('refus : aucune alerte d’écriture incertaine ni écriture de mesure ne peut être effacée',()=>{
 for(const c of [{intent:{}},{reconcileRequired:true},{deferPending:true},{applied:{}},{intentionsRelecture:1},{intentionsEnSuspens:2}])
  motif(c,/incertaine.*contrôler dans ESV/);
 motif({timingPending:1},/écritures de mesure/);motif({graceObservations:'en-cours'},/observations/);
});

test('executer : télécommande, IndexedDB, stockages local et session, puis mémoire ; la marque de premier lancement est effacée',async()=>{
 const appels=[],local={banane5Poste:{neuf:false},autre:1},session={present:true};
 const stock=(nom,data)=>({clear:async()=>{appels.push(nom);for(const k of Object.keys(data))delete data[k];}});
 await R.executer({store:{clearAll:async()=>appels.push('indexeddb')},storageLocal:stock('local',local),storageSession:stock('session',session),
  fermerTelecommande:async()=>appels.push('telecommande'),reinitialiserMemoire:async()=>appels.push('memoire')});
 assert.deepEqual(appels,['telecommande','indexeddb','local','session','memoire']);assert.deepEqual(local,{});assert.deepEqual(session,{});
 assert.equal(SN.evaluer(local).avis,true);
 await R.executer({store:{clearAll:async()=>{}},storageLocal:{clear:async()=>{}}});
});

function stockageVidage(){const s=memoire();s.vidages=0;s.clear=async()=>{s.vidages++;for(const k of Object.keys(s.m))delete s.m[k];};return s;}
async function serviceWorker(){
 const store=new MemoryStore(),vidages={store:0};store.clearAll=async()=>{vidages.store++;store.clouds.clear();store.events.length=0;store.records.length=0;};
 const local=stockageVidage(),session=stockageVidage(),b=production({store,local,session});await b.api('view');await b.get('telecommandePrete');
 let coupe=0;const tc=b.get('telecommande'),couper=tc.couper.bind(tc);tc.couper=async()=>{coupe++;return couper();};
 return {b,store,local,session,vidages,coupe:()=>coupe};
}

test('service worker : état lu, confirmation indispensable et refus revérifié avant tout effacement',async()=>{
 const {b,store,local,session,vidages}=await serviceWorker();store.clouds.set('nuage',{points:[]});local.m.banane5Poste={neuf:false};session.m.session=1;
 assert.deepEqual(JSON.parse(JSON.stringify(await b.api('reinitialiser-etat'))),{permis:true,refus:null});
 b.get('engine').s.batch={state:'RUNNING'};const occupe=await b.api('reinitialiser-etat');assert.equal(occupe.permis,false);assert.match(occupe.refus,/RUNNING/);
 await assert.rejects(b.api('reinitialiser-extension',{}),/Confirmation requise pour réinitialiser Ariane\./);
 b.get('engine').s.batch={state:'STOPPED'};b.get('engine').s.intent={kind:'apply'};
 await assert.rejects(b.api('reinitialiser-extension',{confirme:true}),/Réinitialisation refusée : .*contrôler dans ESV/);
 assert.equal(vidages.store,0);assert.equal(local.vidages,0);assert.equal(session.vidages,0);assert.equal(store.clouds.size,1);
});

test('service worker : succès, tous les magasins et toute la mémoire vive reviennent à l’état neuf',async()=>{
 const {b,store,local,session,vidages,coupe}=await serviceWorker(),e=b.get('engine');
 local.m.banane5Poste={neuf:false};local.m.banane51Palette='sarcelle';session.m.session=1;store.clouds.set('nuage',{points:[]});
 b.get('selectedTab=42');e.enBase.add('visite');e.fenetre={ouverte:true};e.s.native={status:'FINISHED'};e.s.manual={status:'FINISHED'};
 e.s.connection={status:'ready'};e.s.fenetreEcritures={};e.s.reconcileRequired=false;
 const swStore=b.get('store');swStore.connus=new Map([['morceau',{}]]);swStore.index=new Set(['morceau']);
 const fins=b.get('finsLot');fins.departs.push({});fins.fins.push({});fins.sig.set('lot','x');fins.fin.set('lot','x');
 b.get('fileP').etat={etat:'arret'};b.get('passeDiff').planifie.add('lot');Object.assign(b.get('passeDiff'),{cours:null,ecriture:null,vue:{},reprise:{},etat:{}});
 b.get('relecture').planifie.add('lot');b.get('relecture').attente={};b.get('ajEssai={regle:true}');b.get('bandeau').on=true;
 b.get('b1').repere={};b.get('b1Depart').repere={};b.get('gsOmbre').batchId='lot';b.get('gsOmbre').ecartements.set(1,{});
 b.get('voieSure').mem={};b.get('voieSure').zones.set(1,{});b.get('voieSure').poses.set(1,{});
 b.get('l1Restes={cle:"lot",m:new Map([[1,{}]])}');b.get('l1eTransport={cle:"lot",poses:[{}]}');
 b.get('globalThis.__syncNeuf=0;syncLauncher=async()=>{globalThis.__syncNeuf++;return {};}');
 const out=await b.api('reinitialiser-extension',{confirme:true});assert.deepEqual(JSON.parse(JSON.stringify(out)),{reinitialise:true});
 assert.equal(vidages.store,1);assert.equal(local.vidages,1);assert.equal(session.vidages,1);assert.equal(coupe(),1);assert.equal(b.get('__syncNeuf'),1);
 assert.deepEqual(local.m,{});assert.deepEqual(session.m,{});assert.equal(store.clouds.size,0);assert.equal(store.events.length,0);assert.equal(store.records.length,0);
 assert.equal(SN.evaluer(local.m).avis,true);assert.equal(b.get('selectedTab'),null);assert.equal(e.fenetre,null);assert.equal(e.enBase.size,0);
 assert.deepEqual(swStore.connus.size,0);assert.deepEqual(swStore.index.size,0);
 assert.deepEqual(Object.keys(e.s).sort(),['schemaVersion','version','sessionId','mode','collection','before','after','lidarId','records','incomplete','proposal','snapshot','applied','validationStarted','batch','notice','events','settings'].sort());
 assert.equal(e.s.schemaVersion,4);assert.equal(e.s.version,b.get('BananeCore3.VERSION'));assert.equal(typeof e.s.sessionId,'string');assert.notEqual(e.s.sessionId,'');
 assert.equal(e.s.mode,'observation');assert.equal(e.s.collection,'IDLE');assert.equal(e.s.batch,null);assert.equal(e.s.notice,'Prêt. Sélectionne un onglet ESV.');
 assert.deepEqual(JSON.parse(JSON.stringify(e.s.settings)),JSON.parse(JSON.stringify(b.get('BananeGeometry3.DEFAULTS'))));
 assert.deepEqual(fins.departs,[]);assert.deepEqual(fins.fins,[]);assert.equal(fins.sig.size,0);assert.equal(fins.fin.size,0);
 assert.equal(b.get('fileP').etat,null);assert.equal(b.get('passeDiff').planifie.size,0);assert.equal(b.get('passeDiff').vue,null);assert.equal(b.get('passeDiff').etat,null);
 assert.equal(b.get('relecture').planifie.size,0);assert.equal(b.get('relecture').passe,null);assert.equal(b.get('relecture').attente,null);
 assert.equal(b.get('ajEssai'),null);assert.equal(b.get('bandeau').on,false);assert.equal(b.get('b1').repere,null);assert.equal(b.get('b1Depart').repere,null);
 assert.equal(b.get('gsOmbre').batchId,null);assert.equal(b.get('gsOmbre').ecartements.size,0);assert.equal(b.get('voieSure').mem,null);
 assert.deepEqual(JSON.parse(JSON.stringify(b.get('l1Restes'))),{cle:null,m:{}});assert.deepEqual(JSON.parse(JSON.stringify(b.get('l1eTransport'))),{cle:null,poses:[]});
 assert.equal((await b.api('reinitialiser-etat')).permis,true);
});

const snap=reinit=>({variante:'signal',ar:{etat:'pret'},sig:{activite:'orbite',theme:'sombre',palette:'glacier'},reglages:{},reinit});
test('rendus Glacier et Mix : bouton, motif du refus, confirmation accessible et annulation',()=>{
 for(const rendre of [S.rendre,M.rendre]){
  const normal=rendre(snap({actif:true,refus:null}),{couche:'reglages'});
  assert.match(normal,/Remise à zéro complète : efface le cache, l’historique et tous les réglages locaux, comme à la première ouverture\./);
  assert.match(normal,/data-act="sg:reinit-demander">Réinitialiser l’extension…<\/button>/);assert.doesNotMatch(normal,/sg:reinit-demander" disabled/);
  const refuse=rendre(snap({actif:false,refus:'Écho est actif'}),{couche:'reglages'});assert.match(refuse,/Écho est actif/);assert.match(refuse,/sg:reinit-demander" disabled/);
  const confirmation=rendre(snap({actif:true,refus:null}),{couche:'reglages',reinitConfirme:true});
  assert.match(confirmation,/Tout ce qui n’a pas été téléchargé et tous tes réglages locaux seront effacés\./);
  assert.match(confirmation,/data-act="sg:reinit-confirmer">Confirmer la remise à zéro<\/button>/);assert.match(confirmation,/class="sg-annuler" data-act="sg:reinit-annuler">Annuler<\/button>/);
  assert.doesNotMatch(confirmation,/sg:reinit-demander/);
 }
});

test('ui5 : état demandé seulement dans Réglages, confirmation, annulation, fermeture puis rechargement après succès',async()=>{
 const etat={batch:null,current:null,connection:{status:'no-tab'},native:{status:'IDLE',visits:[]}},p=await monter({etat});
 assert.equal(p.envoyes.length,0,'aucune lecture tant que la feuille est fermée');
 let recharge=0;p.ctx.location={reload:()=>recharge++};
 p.ctx.chrome.runtime.sendMessage=async m=>{p.envoyes.push(m);if(m.action==='reinitialiser-etat')return {result:{permis:true,refus:null}};if(m.action==='reinitialiser-extension')return {result:{reinitialise:true}};return {result:{}};};
 p.ui.agir('sg:reglages');await p.attendre(20);assert.equal(p.ui.instantane(etat).reinit.actif,true);assert.equal(p.ui.instantane(etat).reinit.refus,null);
 p.ui.agir('sg:reinit-demander');assert.equal(p.ui.ui.reinitConfirme,true);assert.match(p.hote.innerHTML,/sg:reinit-confirmer/);
 p.ui.agir('sg:reinit-annuler');assert.equal(p.ui.ui.reinitConfirme,false);
 p.ui.agir('sg:reinit-demander');p.ui.agir('sg:fermer');assert.equal(p.ui.ui.reinitConfirme,false,'la croix ferme aussi la confirmation');
 p.ui.agir('sg:reglages');p.ui.agir('sg:reinit-demander');
 for(const f of p.body.ecoutes.keydown)f({key:'Escape',altKey:false,ctrlKey:false,metaKey:false,target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(p.ui.ui.reinitConfirme,false,'Échap ferme aussi la confirmation');
 p.ui.agir('sg:reglages');p.ui.agir('sg:reinit-demander');p.ui.agir('sg:reinit-confirmer');await p.attendre(30);
 const confirmation=p.envoyes.find(m=>m.action==='reinitialiser-extension');assert.deepEqual(JSON.parse(JSON.stringify(confirmation)),{kind:'panel',action:'reinitialiser-extension',args:{confirme:true}});
 assert.equal(recharge,1);assert.equal(p.envoyes.filter(m=>m.action==='reinitialiser-etat').length>=1,true);
});

test('ui5 : avant la réponse du service worker, le rendu synchrone ne prétend jamais qu’une activité est réinitialisable',async()=>{
 const etat={batch:null,current:null,connection:{status:'no-tab'},native:{status:'IDLE',visits:[]}},p=await monter({etat});
 p.ctx.chrome.runtime.sendMessage=()=>new Promise(()=>{});p.ui.agir('sg:reglages');
 assert.deepEqual(JSON.parse(JSON.stringify(p.ui.instantane(etat).reinit)),{actif:true,refus:null});
 const cours={...etat,batch:{id:'lot',state:'RUNNING',processed:[],deferred:[]}};assert.equal(p.ui.instantane(cours).reinit.actif,false);assert.match(p.ui.instantane(cours).reinit.refus,/en cours/);
});
