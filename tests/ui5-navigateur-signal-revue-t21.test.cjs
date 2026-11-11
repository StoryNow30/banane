'use strict';
/* Revue du code de Signal, test 21 (fiches/SIGNAL_REVUE_T21.md), DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré).
 * Montage : tests/helpers/signal-navigateur.cjs ; panel.js est le vrai, l'API Chrome est simulée ; rien n'est envoyé à ESV. Données fabriquées.
 *  - D7 + D4 : après « Nouveau lot », Signal montre les bornes ; le dernier cut tapé dans Signal est celui que « Démarrer » envoie ; un refus du
 *    service worker est dit dans Signal ;
 *  - connexion T21 (test 22) : l'onglet 1, listé par `list-tabs` et prêt, est celui que le service worker cible (`tabId`) ; sans lui, « Démarrer » reste grisé ;
 *  - R6 : pendant un lot, le panneau se redessine chaque seconde ; l'écran de Signal n'est pas réécrit pour autant. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');

/* Les messages envoyés, avec leurs arguments ; `start` refusé comme le moteur le refuse quand ESV n'affiche pas le premier cut. */
async function espionner(page,refus){
 await page.evaluate(refus=>{const o=window.chrome.runtime.sendMessage;window.__msgs=[];
  window.chrome.runtime.sendMessage=async m=>{window.__msgs.push(m);if(refus&&m.action==='start')return {error:refus};return o(m);};},refus);
}

test('D7 + D4 · « Nouveau lot » : les bornes sont dans Signal ; le dernier cut tapé est celui que « Démarrer » envoie ; le refus du moteur est dit',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,{...SC.fin,connection:{status:'ready',tabId:1}},{width:600,height:760});
  assert.equal(await page.locator('#ui5 [data-borne]').count(),0,'lot fini, « Nouveau lot » pas choisi : pas de bornes');
  await page.click('#ui5 [data-act="legacy:new-batch"]');await page.waitForTimeout(400);
  assert.equal(await page.locator('#ui5 [data-borne="start"]').count(),1);assert.equal(await page.locator('#ui5 [data-borne="end"]').count(),1);
  assert.equal(await page.inputValue('#ui5 [data-borne="end"]'),await page.inputValue('#end'),'Signal montre la fin que « Démarrer » lirait');
  await page.fill('#ui5 [data-borne="end"]','4850');await page.waitForTimeout(1300);
  assert.equal(await page.inputValue('#end'),'4850');assert.equal(await page.inputValue('#ui5 [data-borne="end"]'),'4850','gardé après les redessins du panneau');
  await espionner(page,'Ouvre le premier cut du lot dans ESV.');
  await page.click('#ui5 [data-act="legacy:start-batch"]');await page.waitForTimeout(600);
  const start=await page.evaluate(()=>window.__msgs.filter(m=>m.action==='start').map(m=>m.args));
  assert.equal(start.length,1);assert.equal(start[0].end,4850);assert.equal(start[0].part,13);
  const avis=await page.evaluate(()=>[...document.querySelectorAll('#ui5 .sg-incident[role="alert"] p')].map(p=>p.textContent));
  assert.ok(avis.some(t=>/Ouvre le premier cut du lot dans ESV/.test(t)),'le refus est dit dans Signal : '+JSON.stringify(avis));
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('R6 · lot en cours : le panneau se redessine chaque seconde, l’écran de Signal n’est pas réécrit',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const lot={...SC.lot,connection:{status:'ready',tabId:1}};lot.batch={...lot.batch,cutStartedAt:new Date(Date.now()-2000).toISOString(),processed:lot.batch.processed.map((x,i)=>({...x,durationMs:20000+i*100}))};
  const {page,erreurs}=await ouvrir(nav,lot,{width:600,height:760});
  await page.evaluate(()=>{window.__fen=document.querySelector('#ui5 .sg-fen');});
  /* CH-104 : l'anneau du temps passé sur le cut n'existe plus (l'anneau dit l'avancement du lot) : on vérifie que l'anneau et le fil restent les mêmes éléments. */
  await page.evaluate(()=>{window.__anneau=document.querySelector('#ui5 .sg-tu-etat .sg-anneau');window.__fil=document.querySelector('#ui5 .sg-fil');});
  await page.waitForTimeout(2600);
  assert.equal(await page.evaluate(()=>window.__fen.isConnected),true,'même écran après plusieurs rendus du panneau');
  assert.deepEqual(await page.evaluate(()=>[!!window.__anneau,window.__anneau?.isConnected,!!window.__fil,window.__fil?.isConnected]),[true,true,true,true],'l’anneau et le fil ne sont pas recréés');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

/* CH-104 : l'anneau du temps passé sur le cut n'existe plus (voir R6 ci-dessus) ; ce qui avance encore seul entre deux rendus, c'est « en pause depuis ». */
test('R6 · lot en pause : « en pause depuis » avance sans réécrire l’écran',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const pause={...SC.pause,connection:{status:'ready',tabId:1}};pause.batch={...pause.batch,pausedAt:new Date(Date.now()-3000).toISOString()};
  const {page,erreurs}=await ouvrir(nav,pause,{width:600,height:760});
  await page.evaluate(()=>{window.__fen=document.querySelector('#ui5 .sg-fen');});
  const t0=await page.evaluate(()=>document.querySelector('#ui5 .sg-pause-depuis')?.textContent);
  await page.waitForTimeout(2600);
  assert.equal(await page.evaluate(()=>window.__fen.isConnected),true,'même écran après plusieurs rendus du panneau');
  const t1=await page.evaluate(()=>document.querySelector('#ui5 .sg-pause-depuis')?.textContent);
  assert.ok(t0&&t1&&t1!==t0,'« en pause depuis » avance : '+t0+' → '+t1);
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
