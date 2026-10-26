'use strict';
/* Connexion T21 (fiches/CONNEXION_T21.md) DANS UN VRAI NAVIGATEUR : panel.html réel (panel.js + Signal), ouvert comme le service worker l'ouvre
 * (`panel.html#home`), API Chrome simulée qui tient un petit état (onglets ESV, onglet connecté, refus éventuel). Rien n'est envoyé à ESV. Ignoré, et dit
 * ignoré, sans Chromium. Le même défaut avec l'extension réelle sur la maquette : tests/esv-maquette/connexion-t21.test.cjs. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {CHROMIUM,PW,absent}=require('./helpers/signal-navigateur.cjs');
const racine=path.resolve(__dirname,'..');

async function ouvrir(nav,{onglets,refus=null,connecte=null,lot=null,native={status:'IDLE',visits:[],incomplete:[]},hash='#home'}){
 const page=await nav.newPage({viewport:{width:600,height:760}}),erreurs=[];
 page.on('pageerror',e=>erreurs.push(e.message));
 await page.addInitScript(({onglets,refus,racine,connecte,lot,native})=>{
  const E={connecte,refus,connects:[]};window.__E=E;window.__appels=[];
  const vue=()=>({current:E.connecte?{identity:{part:23,cut:100}}:null,batch:lot,busy:false,manual:{status:'IDLE'},native,
   connection:E.connecte?{status:'ready',observedAt:'t',message:null,tabId:E.connecte}:{status:'no-tab',observedAt:'t',message:'Aucun onglet ESV choisi.',tabId:null}});
  const fixes={'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},'relecture-choix-etat':{mode:'corriger'},
   'relecture-etat':{choix:'corriger',lot:null,passe:null},'bandeau-etat':{on:false},'fiches-depart':{fiches:[]}};
  window.fetch=async()=>({json:async()=>({})});
  window.chrome={runtime:{id:'essai',getURL:p=>'file://'+racine+'/'+p,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
   sendMessage:async m=>{const a=m.action||m.kind;window.__appels.push(a);
    if(a==='view')return {result:vue()};
    if(a==='list-tabs')return {result:onglets.map((t,i)=>({id:t,title:'ESV '+t,windowId:1,index:i,active:i===0,pret:true,utilise:t===E.connecte}))};
    if(a==='connect'){E.connects.push(m.args?.tabId);if(E.refus)return {error:E.refus};E.connecte=m.args?.tabId;return {result:vue()};}
    return {result:a in fixes?fixes[a]:{}};}},
   storage:{local:{get:async()=>({}),set:async()=>{}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
 },{onglets,refus,racine,connecte,lot,native});
 const t0=Date.now();
 await page.goto('file://'+path.join(racine,'panel.html')+hash);
 const lire=()=>page.evaluate(()=>({mot:document.querySelector('#ui5 .sg-mot')?.textContent||'',texte:document.getElementById('ui5')?.textContent||'',connects:[...window.__E.connects]}));
 return {page,erreurs,t0,lire};
}
async function attendre(f,ms){const t0=Date.now();while(Date.now()-t0<ms){const r=await f();if(r)return r;await new Promise(r=>setTimeout(r,50));}return null;}

test('Connexion T21 · panneau ouvert sur l’accueil, un onglet ESV ouvert : connecté seul, jamais « Hors ligne » au-delà de 2 s',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs,t0,lire}=await ouvrir(nav,{onglets:[7]});
  const r=await attendre(async()=>{const x=await lire();return x.mot==='Prêt'?x:null;},2000);
  assert.ok(r,`toujours « ${(await lire()).mot} » 2 s après l’ouverture`);console.log(`# prêt ${Date.now()-t0} ms après l’ouverture`);
  assert.deepEqual(r.connects,[7],'l’onglet unique est connecté une fois, comme avant Signal');
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});

test('Connexion T21 · deux onglets ESV : la puce les liste ; un seul choix suffit',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs,lire}=await ouvrir(nav,{onglets:[7,8]});
  await page.waitForTimeout(700);
  const av=await lire();assert.doesNotMatch(av.texte,/Aucun onglet ESV ouvert/,'deux onglets ESV sont ouverts : '+av.texte);
  await page.click('#ui5 .sg-puce');await page.waitForTimeout(250);
  const boutons=await page.$$eval('#ui5 .sg-popover [data-act^="conn:"]',l=>l.map(b=>b.dataset.act));
  assert.deepEqual(boutons,['conn:7','conn:8'],'les deux onglets, chacun avec « Connecter »');
  const t=Date.now();await page.click('#ui5 .sg-popover [data-act="conn:8"]');
  const r=await attendre(async()=>{const x=await lire();return x.mot==='Prêt'?x:null;},1500);
  assert.ok(r,'un seul clic : prêt');console.log(`# prêt ${Date.now()-t} ms après le choix`);assert.deepEqual(r.connects,[8]);
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});

test('Connexion T21 · connexion refusée (page ESV d’une autre version) : le refus se lit dans Signal, l’onglet garde « Connecter »',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs,lire}=await ouvrir(nav,{onglets:[7],refus:'Recharge la page ESV (F5) pour activer Ariane 4.9.5 test 21 (L1-e6).'});
  const r=await attendre(async()=>{const x=await lire();return /Recharge la page ESV \(F5\)/.test(x.texte)?x:null;},2000);
  assert.ok(r,'le refus est dit dans Signal');assert.equal(r.mot,'Hors ligne');
  await page.click('#ui5 .sg-puce');await page.waitForTimeout(250);
  assert.equal(await page.$('#ui5 .sg-popover .sg-conn'),null,'rien n’est dit « connecté »');
  await page.evaluate(()=>{window.__E.refus=null;});
  await page.click('#ui5 .sg-popover [data-act="conn:7"]');
  const ok=await attendre(async()=>{const x=await lire();return x.mot==='Prêt'?x:null;},1500);
  assert.ok(ok,'page rechargée, un clic : prêt');assert.deepEqual(ok.connects,[7,7]);
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});

/* Constat de l'opérateur (test 21, capture) : lot terminé (46 cuts, 1 différé), onglet mémorisé joignable, PLUSIEURS onglets ESV ouverts ; la puce disait
 * « Aucun onglet » et la couche « Aucun onglet ESV ouvert », avec seulement « Reconnecter ». */
const FINI={id:'L46',state:'COMPLETED',scope:{part:23,start:55,end:100},processed:Array.from({length:45},(_,i)=>({identity:{part:23,cut:55+i},cut:55+i})),
 deferred:[{identity:{part:23,cut:100},cut:100}],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:null,lotCommands:{}};
test('Connexion T21 · plusieurs onglets ESV ouverts, aucun encore choisi dans ce panneau, lot terminé : la liste n’est pas vide',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,{onglets:[7,8,9],connecte:7,lot:FINI});
  await page.waitForTimeout(800);
  const puce=await page.$eval('#ui5 .sg-puce .sg-long',e=>e.textContent);
  assert.notEqual(puce,'Aucun onglet','la puce nomme l’onglet utilisé');
  await page.click('#ui5 .sg-puce');await page.waitForTimeout(250);
  const couche=await page.$eval('#ui5 .sg-popover',e=>e.textContent);
  assert.doesNotMatch(couche,/Aucun onglet ESV ouvert/,'trois onglets ESV sont ouverts : '+couche);
  assert.equal(await page.$$eval('#ui5 .sg-popover .sg-ong .sg-lib b',l=>l.filter(b=>/ESV \d/.test(b.textContent)).length),3,'les trois onglets');
  assert.deepEqual(await page.$$eval('#ui5 .sg-popover [data-act^="conn:"]',l=>l.map(b=>b.dataset.act)),['conn:8','conn:9'],'l’onglet utilisé est « connecté », les autres se choisissent');
  assert.deepEqual(await page.evaluate(()=>window.__E.connects),[],'rien n’est connecté sans clic (plusieurs onglets)');
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});

test('Connexion T21 · le service worker garde un onglet que la liste ne montre pas : « Démarrer le lot » grisé, pas « Prêt »',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs,lire}=await ouvrir(nav,{onglets:[],connecte:7});
  await page.waitForTimeout(800);
  const r=await page.evaluate(()=>({puce:document.querySelector('#ui5 .sg-puce .sg-long')?.textContent,b:[...document.querySelectorAll('#ui5 .sg-actions button')].filter(x=>/Démarrer/.test(x.textContent)).map(x=>x.disabled)}));
  assert.notEqual((await lire()).mot,'Prêt');assert.equal(r.puce,'Onglet à choisir','le service worker garde un onglet : jamais « Aucun onglet »');
  assert.deepEqual(r.b,[true],'« Démarrer le lot » présent et grisé');
  assert.match((await lire()).texte,/Choisis un onglet ESV/);
  const avant=await page.evaluate(()=>window.__appels.length);
  await page.evaluate(()=>{for(const x of document.querySelectorAll('#ui5 [data-act="legacy:start-batch"]'))x.click();});await page.waitForTimeout(300);
  assert.ok(!(await page.evaluate(a=>window.__appels.slice(a),avant)).includes('start'),'aucun lot lancé');
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});

/* Revue de Signal, D1 : ouverture réelle, `panel.html` SANS fragment (le popup), panneau rouvert pendant un lot ou une séance Écho. */
const EN_COURS={...FINI,id:'L9',state:'RUNNING',activeIdentity:{part:23,cut:101},cutStartedAt:new Date().toISOString()};
test('Connexion T21 · panel.html sans fragment, lot en cours : Pause en action principale, Arrêter présent, pas de « Démarrer le lot »',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs,lire}=await ouvrir(nav,{onglets:[7,8],connecte:7,lot:EN_COURS,hash:''});
  await page.waitForTimeout(800);
  assert.equal((await lire()).mot,'En cours');
  assert.equal(await page.$eval('#ui5 .sg-principal',e=>e.dataset.act),'pause','Pause en action principale');
  assert.ok(await page.$('#ui5 [data-act="legacy:stop"]'),'Arrêter le lot présent');
  assert.equal(await page.$('#ui5 [data-act="legacy:start-batch"]'),null,'aucun « Démarrer le lot » pendant le lot');
  assert.deepEqual(await page.evaluate(()=>window.__E.connects),[],'rien n’est connecté pendant le lot');
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});
test('Connexion T21 · panel.html sans fragment, séance Écho en cours : Signal est dans Écho, « Démarrer le lot » nulle part actif (palette comprise)',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const t0=Date.parse('2026-10-26T08:00:00Z'),visits=[0,1,2].map(i=>({id:'v'+i,identity:{part:23,cut:100+i},startedAt:new Date(t0+i*9000).toISOString(),endedAt:new Date(t0+i*9000+7000).toISOString(),label:'VALIDATE_NO_MOVEMENT',outcome:'VALIDATE_NO_MOVEMENT',decision:'VALIDATE'}));
  const {page,erreurs}=await ouvrir(nav,{onglets:[7],connecte:7,native:{status:'RUNNING',visits,incomplete:[]},hash:''});
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(()=>document.body.dataset.window),'native');
  assert.equal(await page.$('#ui5 [data-act="legacy:start-batch"]:not([disabled])'),null,'instrument');
  await page.keyboard.press('Control+k');await page.waitForTimeout(150);await page.keyboard.type('démarrer');await page.waitForTimeout(150);
  assert.equal(await page.$('#ui5 .sg-palette [data-act="legacy:start-batch"]'),null,'palette');
  assert.deepEqual(erreurs,[]);await page.close();
 }finally{await nav.close();}
});
