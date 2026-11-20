'use strict';
/* CH-149 (D-381) — remise à zéro complète, seulement hors activité et hors écriture incertaine.
 * Module pur, service worker réel (API Chrome et IndexedDB simulés), rendus Glacier et Mix, actions de la feuille Réglages.
 * Toutes les données sont fabriquées pour ces essais. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const R=require('../src/reinitialisation.js'),SN=require('../src/stockage-neuf.js'),S=require('../src/signal-rendu.js'),M=require('../src/mix-rendu.js'),T=require('../src/telecommande.js'),I=require('../src/telecommande-instantane.js');
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
 let coupe=0;const tc=b.get('telecommande'),couper=tc.couperApresReponse.bind(tc);tc.couperApresReponse=async()=>{coupe++;return couper();};
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
 assert.deepEqual(JSON.parse(JSON.stringify(fins.departs)),[]);assert.deepEqual(JSON.parse(JSON.stringify(fins.fins)),[]);assert.equal(fins.sig.size,0);assert.equal(fins.fin.size,0);
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

test('télécommande : la feuille Réglages offre la même confirmation, sans texte libre dans la vue chiffrée',()=>{
 const source={s:{batch:null,connection:{status:'no-tab'}},relecture:null,file:null,passe:null,echo:false,reinit:{actif:true,refus:'aucun'}},v=T.vueReduite(source);
 assert.deepEqual(JSON.parse(JSON.stringify(v.reinit)),{actif:true,refus:'aucun'});assert.equal(v.boutons['reinitialiser-extension'],true);
 const snap=I.instantane(v),normal=I.filtrer(S.rendre(snap,{couche:'reglages'}),v);
 assert.match(normal,/sg:reglages|sg:reinit-demander/);assert.ok(I.NAVIGATION.includes('sg:reinit-demander'));assert.equal(I.ordreDe('sg:reinit-demander',v),null);
 const confirmation=I.filtrer(S.rendre(snap,{couche:'reglages',reinitConfirme:true}),v);
 assert.match(confirmation,/sg:reinit-confirmer/);assert.match(confirmation,/sg:reinit-annuler/);assert.equal(I.ordreDe('sg:reinit-confirmer',v),'reinitialiser-extension');
 const occupe=T.vueReduite({...source,s:{batch:{state:'RUNNING',scope:{},processed:[],deferred:[],skipped:[]},connection:{status:'ready'}},reinit:{actif:false,refus:'lot'}});
 assert.equal(occupe.boutons['reinitialiser-extension'],false);assert.equal(I.ordreDe('sg:reinit-confirmer',occupe),null);
 assert.match(I.instantane(occupe).reinit.refus,/lot Orbite/);
 assert.equal(T.controlerOrdre({type:'ordre',n:1,h:Date.now(),ordre:'reinitialiser-extension'}).action,'reinitialiser-extension');
});

test('télécommande : l’accusé de remise à zéro part avant la coupure, avec confirme=true côté panneau',async()=>{
 const sockets=[];class WS{constructor(url){this.url=url;this.readyState=0;this.envoyes=[];sockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.();},0);}
  send(x){if(this.readyState!==1)throw Error('fermée');this.envoyes.push(x);}close(){if(this.readyState===3)return;this.readyState=3;this.onclose?.({code:1000});}recevoir(x){this.onmessage?.({data:x});}}
 const donnees={},stockage={get:async k=>Object.fromEntries([].concat(k).filter(x=>x in donnees).map(x=>[x,donnees[x]])),set:async o=>Object.assign(donnees,o),remove:async k=>{for(const x of [].concat(k))delete donnees[x];}};
 const source={s:{batch:null,connection:{status:'no-tab'}},relecture:null,file:null,passe:null,echo:false,reinit:{actif:true,refus:'aucun'}};let args=null,t;
 t=T.creer({stockage,WS,periodeMs:10,battementMs:1000,sources:()=>source,executer:async(action,a)=>{if(action==='reinitialiser-extension'){args=a;await t.couperApresReponse();}return {reinitialise:true};}});
 const app=await t.appairer(['https:/','/relais-essai','.exemple','.test'].join(''));await new Promise(r=>setTimeout(r,30));const D=await T.deriver(await T.decoder(app.code)),s=sockets.at(-1),n=Date.now();
 s.recevoir(JSON.stringify(await T.chiffrer(D,'t>a',{type:'ordre',n,h:n,ordre:'reinitialiser-extension'})));await new Promise(r=>setTimeout(r,50));
 assert.deepEqual(JSON.parse(JSON.stringify(args)),{confirme:true});let acc=null;for(const x of s.envoyes){const o=await T.dechiffrer(D,'a>t',JSON.parse(x));if(o.type==='accuse'&&o.ordre==='reinitialiser-extension')acc=o;}
 assert.equal(acc?.resultat,'accepte');assert.equal(acc?.pour,n);assert.equal(s.readyState,3);assert.equal(donnees.arianeTelecommande,undefined);
});

/* Mesure visuelle des deux états, dans les deux interfaces et les deux thèmes. Aucune capture : seulement des rectangles et des couleurs calculées. */
const navigateur=require('./esv-maquette/navigateur.cjs'),CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false,fs=require('node:fs'),path=require('node:path');
test('navigateur : de 320 à 720 px, les deux thèmes gardent la zone et ses boutons sans débordement, avec un contraste suffisant',{skip:absent,timeout:90000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),{ouvrir,SC}=require('./helpers/signal-navigateur.cjs'),nav=await chromium.launch({executablePath:CHROMIUM}),defauts=[],ancienne=process.env.UI5_VARIANTE;
 try{
  for(const variante of ['signal','mix'])for(const largeur of [320,720])for(const theme of ['sombre','clair']){
   process.env.UI5_VARIANTE=variante;const {page,erreurs}=await ouvrir(nav,SC.repos,{width:largeur,height:760});
   await page.evaluate(t=>{document.documentElement.dataset.theme=t==='clair'?'light':'dark';window.ArianeUi5.agir('sg:reglages');},theme);await page.waitForTimeout(150);
   for(const confirmation of [false,true]){
    if(confirmation){await page.evaluate(()=>window.ArianeUi5.agir('sg:reinit-demander'));await page.waitForTimeout(80);}
    const mesure=await page.evaluate(()=>{
     const z=document.querySelector('#ui5 .sg-reinit'),boutons=[...z.querySelectorAll('button')],rect=e=>{const r=e.getBoundingClientRect();return {g:r.left,d:r.right,h:r.top,b:r.bottom,l:r.width,t:r.height};},zone=rect(z),rs=boutons.map(rect);
     const rgb=s=>{const m=String(s).match(/[\d.]+/g)?.map(Number)||[];return [m[0]||0,m[1]||0,m[2]||0,m.length>3?m[3]:1];},fond=e=>{let couche=[0,0,0,0],n=e;while(n){const c=rgb(getComputedStyle(n).backgroundColor);if(c[3]){const a=c[3]+couche[3]*(1-c[3]);couche=[0,1,2].map(i=>(c[i]*c[3]+couche[i]*couche[3]*(1-c[3]))/a);couche.push(a);}if(couche[3]>=.999)return couche;n=n.parentElement;}return couche;};
     const contraste=(a,b)=>{const L=c=>{const f=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);},x=L(a),y=L(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);},F=fond(z);
     return {largeur:innerWidth,doc:document.documentElement.scrollWidth,zone,boutons:rs,contrasteTexte:contraste(rgb(getComputedStyle(z).color),F),contrasteBoutons:boutons.map(b=>contraste(rgb(getComputedStyle(b).color),F))};
    });
    const nom=`${variante} ${largeur} ${theme}${confirmation?' confirmation':''}`;
    if(mesure.doc>largeur)defauts.push(nom+' : débordement horizontal du document');if(mesure.zone.g<0||mesure.zone.d>largeur)defauts.push(nom+' : zone hors fenêtre');
    for(const [i,r] of mesure.boutons.entries()){if(r.g<mesure.zone.g-1||r.d>mesure.zone.d+1||r.l<20||r.t<20)defauts.push(nom+` : bouton ${i} mal contenu`);if(mesure.contrasteBoutons[i]<4.5)defauts.push(nom+` : contraste du bouton ${i} ${mesure.contrasteBoutons[i].toFixed(2)}`);}
    for(let i=1;i<mesure.boutons.length;i++){const a=mesure.boutons[i-1],b=mesure.boutons[i];if(Math.min(a.d,b.d)>Math.max(a.g,b.g)&&Math.min(a.b,b.b)>Math.max(a.h,b.h))defauts.push(nom+' : boutons qui se recouvrent');}
    if(mesure.contrasteTexte<4.5)defauts.push(nom+` : contraste du texte ${mesure.contrasteTexte.toFixed(2)}`);assert.deepEqual(erreurs,[],nom);
   }
   await page.close();
  }
 }finally{if(ancienne===undefined)delete process.env.UI5_VARIANTE;else process.env.UI5_VARIANTE=ancienne;await nav.close();}
 assert.deepEqual(defauts,[]);
});

test('page réelle du téléphone : Réglages, annulation, confirmation et retour à l’appairage',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM}),page=await nav.newPage({viewport:{width:390,height:760}}),erreurs=[],RACINE=path.resolve(__dirname,'..');
 page.on('pageerror',e=>erreurs.push(e.message));
 const fichiers={'/signal-rendu.js':'src/signal-rendu.js','/telecommande-instantane.js':'src/telecommande-instantane.js','/panel-signal.css':'panel-signal.css'};
 await page.route('**/*',route=>{const u=new URL(route.request().url()),f=fichiers[u.pathname];
  if(u.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(path.join(RACINE,'telecommande/telephone.html'),'utf8')});
  if(f)return route.fulfill({status:200,contentType:f.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(path.join(RACINE,f),'utf8')});return route.fulfill({status:404,body:''});});
 try{
  await page.goto('https://relais-essai.exemple.test/');
  await page.evaluate(()=>{D={};dernierEtat={schema:3,reinit:{actif:true,refus:'aucun'},boutons:{'reinitialiser-extension':true}};dernierEtatH=Date.now();arianePresente=true;relaisOk=true;
   ws={readyState:1,close(){this.readyState=3;}};window.__ordre=null;envoyerOrdre=k=>{window.__ordre=k;};$('appairage').hidden=true;afficher();});
  await page.click('#ui5 [data-act="sg:menu"]');await page.click('#menu-reglages');
  await page.click('#ui5 [data-act="sg:reinit-demander"]');assert.equal(await page.locator('#ui5 [data-act="sg:reinit-confirmer"]').count(),1);
  await page.click('#ui5 [data-act="sg:reinit-annuler"]');assert.equal(await page.locator('#ui5 [data-act="sg:reinit-confirmer"]').count(),0);
  await page.click('#ui5 [data-act="sg:reinit-demander"]');await page.click('#ui5 [data-act="sg:reinit-confirmer"]');
  assert.equal(await page.evaluate(()=>window.__ordre),'reinitialiser-extension');
  await page.evaluate(()=>{localStorage.setItem('ariane-code','essai');localStorage.setItem('ariane-n','1');accuse({ordre:'reinitialiser-extension',resultat:'accepte',pour:1});});
  assert.equal(await page.locator('#appairage').isVisible(),true);assert.equal(await page.evaluate(()=>localStorage.getItem('ariane-code')),null);
  assert.match(await page.locator('#avis').textContent(),/nouveau QR code/);assert.deepEqual(erreurs,[]);
 }finally{await page.close();await nav.close();}
});
