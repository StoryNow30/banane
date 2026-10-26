'use strict';
/* Revue du code de Signal, test 21 (fiches/SIGNAL_REVUE_T21.md), DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré).
 * Montage : tests/helpers/signal-navigateur.cjs ; panel.js est le vrai, l'API Chrome est simulée ; rien n'est envoyé à ESV. Données fabriquées.
 *  - D7 + D4 : après « Nouveau lot », Signal montre les bornes ; le dernier cut tapé dans Signal est celui que « Démarrer » envoie ; un refus du
 *    service worker est dit dans Signal ;
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
  const {page,erreurs}=await ouvrir(nav,{...SC.fin,connection:{status:'ready'}},{width:600,height:760});
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
  const lot={...SC.lot,connection:{status:'ready'}};lot.batch={...lot.batch,cutStartedAt:new Date(Date.now()-2000).toISOString(),processed:lot.batch.processed.map((x,i)=>({...x,durationMs:20000+i*100}))};
  const {page,erreurs}=await ouvrir(nav,lot,{width:600,height:760});
  await page.evaluate(()=>{window.__fen=document.querySelector('#ui5 .sg-fen');});
  const v0=await page.evaluate(()=>document.querySelector('#ui5 .sg-arc')?.style.strokeDashoffset||document.querySelector('#ui5 .sg-arc')?.getAttribute('stroke-dashoffset'));
  await page.waitForTimeout(2600);
  assert.equal(await page.evaluate(()=>window.__fen.isConnected),true,'même écran après plusieurs rendus du panneau');
  const v1=await page.evaluate(()=>document.querySelector('#ui5 .sg-arc')?.style.strokeDashoffset);
  assert.ok(v1&&v1!==v0,'l’anneau avance quand même (vivant)');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
