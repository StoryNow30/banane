'use strict';
/* UI 5.0 « Signal » (D-250) DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). panel.html est chargé avec une API Chrome
 * simulée (tools/ui5-navigateur.cjs) ; rien n'est envoyé à ESV.
 *  1. Signal est là au départ, le panneau d'avant caché, aucune erreur de page, en 600 × 760 et en compact 360 × 480, sans débordement horizontal ;
 *  2. un clic sur Signal envoie au service worker exactement ce qu'envoie le bouton d'origine (même action, même ordre), et rien de nouveau ;
 *  3. les détails techniques s'ouvrent depuis les réglages (éléments du panneau d'avant déplacés, pas recopiés) et retournent à leur place ;
 *  4. Ctrl K ouvre la palette, le champ actif ; Échap la ferme.
 * Captures dans le dossier de SIGNAL_CAPTURES s'il est donné. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const CHROMIUM=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',PW=process.env.PLAYWRIGHT_PATH||'/opt/node-tools/node_modules/playwright';
const absent=!fs.existsSync(CHROMIUM)||!fs.existsSync(PW)?'Chromium ou Playwright absent : essai de navigateur ignoré':false;
const N=require('../tools/ui5-navigateur.cjs'),CAPTURES=process.env.SIGNAL_CAPTURES||'';
const FIN=N.lot('COMPLETED',{activeIdentity:null,processed:Array.from({length:19},(_,i)=>({identity:{part:13,cut:4790+i},cut:4790+i,durationMs:6000+i*150}))});
const SC={repos:N.SCENARIOS.repos.state,lot:N.lot('RUNNING',{cutStartedAt:new Date(Date.now()-4000).toISOString(),processed:Array.from({length:19},(_,i)=>({identity:{part:13,cut:4790+i},cut:4790+i,durationMs:6000+i*150}))}),
 pause:N.lot('PAUSED'),incident:N.SCENARIOS.incident.state,fin:FIN,echo:N.SCENARIOS.echo.state,accueil:N.SCENARIOS.accueil.state};

async function ouvrir(nav,state,vue,hash='#automatic'){
 const page=await nav.newPage({viewport:vue}),erreurs=[];
 page.on('pageerror',e=>erreurs.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR_FILE_NOT_FOUND/.test(m.text()))erreurs.push('console: '+m.text());});
 await page.addInitScript(({state,racine})=>{
  const reponses={view:state,'list-tabs':[{id:1,title:'ESV',pret:true,utilise:true,index:0,windowId:1,active:true}],'choix-lot-etat':{clicHumain:'tel-quel',regleGrappeDifferes:false},'raison-choix-etat':{actif:false,touches:'chiffres'},
   'relecture-choix-etat':{mode:'corriger'},'relecture-etat':{choix:'corriger',lot:null,passe:null},'bandeau-etat':{on:false},'fiches-depart':{fiches:[]}};
  const stockage={};window.__appels=[];window.__ecrits=[];
  window.fetch=async()=>({json:async()=>({totaux:{tous:{corriges:2731}},creeLe:'2026-10-20T08:00:00Z'})});
  window.chrome={runtime:{id:'essai',getURL:p=>'file://'+racine+'/'+p,connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
   sendMessage:async m=>{window.__appels.push(m.action||m.kind);return {result:m.action in reponses?reponses[m.action]:{}};}},
   storage:{local:{get:async()=>({...stockage}),set:async o=>{Object.assign(stockage,o);window.__ecrits.push(o);}}},windows:{getCurrent:async()=>({id:1,type:'normal',width:600,height:760}),update:async()=>({})}};
 },{state,racine:path.resolve(__dirname,'..')});
 await page.goto('file://'+path.resolve(__dirname,'..','panel.html')+hash);
 await page.waitForTimeout(600);
 return {page,erreurs};
}

test('Signal au départ, en 600 × 760 et en compact : aucune erreur, panneau d’avant caché, rien qui déborde',{skip:absent,timeout:120000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM}),res={};
 if(CAPTURES)fs.mkdirSync(CAPTURES,{recursive:true});
 try{
  for(const [taille,vue] of [['normal',{width:600,height:760}],['compact',{width:360,height:480}]])for(const [nom,state] of Object.entries(SC)){
   const {page,erreurs}=await ouvrir(nav,state,vue,nom==='echo'?'#native':'#automatic');
   if(nom==='fin'){await page.click('#ui5 .sg-poignee');await page.waitForTimeout(400);}
   if(CAPTURES)await page.screenshot({path:path.join(CAPTURES,`signal-${taille}-${nom}.png`)});
   res[`${taille}/${nom}`]={erreurs,...await page.evaluate(()=>{const h=document.getElementById('ui5'),f=h?.querySelector('.sg-fen');
    return {classe:h?.className,taille:h?.dataset.taille,theme:h?.dataset.theme,main:getComputedStyle(document.querySelector('main')).display,mot:f?.querySelector('.sg-mot')?.textContent,
     deborde:f?f.scrollWidth>f.clientWidth+1:true,principaux:f?.querySelectorAll('.sg-principal').length,police:getComputedStyle(f.querySelector('.sg-mot')).fontFamily};})};
   await page.close();
  }
 }finally{await nav.close();}
 for(const [k,r] of Object.entries(res)){
  assert.deepEqual(r.erreurs,[],k);assert.equal(r.classe,'u-signal',k);assert.equal(r.main,'none',k+' : le panneau d’avant est caché');
  assert.equal(r.taille,k.split('/')[0],k);assert.equal(r.theme,'sombre',k+' : sombre par défaut');assert.equal(r.deborde,false,k+' : rien ne déborde');
  assert.ok(r.principaux<=1,k+' : une action principale au plus');assert.match(r.police,/IBM Plex Sans/,k);
 }
 assert.equal(res['normal/lot'].mot,'En cours');assert.equal(res['normal/fin'].mot,'Terminé');assert.equal(res['normal/echo'].mot,'En observation');assert.equal(res['normal/repos'].mot,'Prêt');
});

test('un clic sur Signal envoie au service worker la même chose que le bouton d’origine, rien de plus',{skip:absent,timeout:60000},async()=>{
 const r=await N.comparerClics('signal',[{etat:SC.lot,idLegacy:'pause',selecteur:'#ui5 .sg-principal[data-act="pause"]'},{etat:SC.lot,idLegacy:'stop',selecteur:'#ui5 [data-act="legacy:stop"]'}]);
 for(const x of r){assert.deepEqual(x.habillage,x.origine,x.idLegacy);}
 assert.ok(r[0].origine.length>0,'Pause envoie bien quelque chose');
});

test('détails techniques : ouverts depuis les réglages, ce sont les éléments du panneau d’avant, remis à leur place à la fermeture ; Ctrl K et Échap',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,SC.fin,{width:600,height:760});
  const avant=await page.evaluate(()=>({parent:document.getElementById('lot-details').parentElement.id,cache:document.getElementById('lot-details').hidden}));
  await page.click('#ui5 [data-act="sg:reglages"]');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>!!document.querySelector('#ui5 .sg-feuille')),true);
  await page.click('#ui5 .sg-feuille [data-act="sg:tech"]');await page.waitForTimeout(300);
  const ouvert=await page.evaluate(()=>({dans:document.getElementById('lot-details').closest('#ui5-tech')!==null,visible:!document.getElementById('lot-details').hidden,journal:!!document.querySelector('#ui5-tech #journal'),diag:!!document.querySelector('#ui5-tech #gcv1-diagnostic-export')}));
  assert.deepEqual(ouvert,{dans:true,visible:true,journal:true,diag:true});
  if(CAPTURES)await page.screenshot({path:path.join(CAPTURES,'signal-details-techniques.png')});
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({parent:document.getElementById('lot-details').parentElement.id,cache:document.getElementById('lot-details').hidden,couche:!!document.getElementById('ui5-tech')})),{...avant,couche:false});
  await page.keyboard.press('Control+k');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ui5-q');
  if(CAPTURES)await page.screenshot({path:path.join(CAPTURES,'signal-palette.png')});
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>!!document.querySelector('#ui5 .sg-palette')),false);
  assert.ok(!(await page.evaluate(()=>window.__appels)).some(a=>/goto|ouvrir/.test(a)),'aucune commande nouvelle');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
