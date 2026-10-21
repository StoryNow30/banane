'use strict';
/* 4.9.6 (D-234, bloc D) — LA NOUVELLE PRÉSENTATION « ARIANE » (ariane2) DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré).
 * panel.html est chargé avec une API Chrome simulée ; rien n'est envoyé à ESV.
 *  1. aucune erreur de page sur l'accueil, Orbite et Écho, en lot et après le lot ;
 *  2. la rangée des onglets ESV, le bouton « Vider le cache » (grisé pendant le lot, actif après) et l'accès à la palette sont là ;
 *  3. aucun grand titre sur les écrans d'activité. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const CHROMIUM=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',PW=process.env.PLAYWRIGHT_PATH||'/opt/node-tools/node_modules/playwright';
const absent=!fs.existsSync(CHROMIUM)||!fs.existsSync(PW)?'Chromium ou Playwright absent : essai de navigateur ignoré':false;
const N=require('../tools/ui5-navigateur.cjs');
test('ariane2 : onglets ESV, cache en vue, palette, sans grand titre ; aucune erreur de page',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(PW);
 const r=await N.capturerAriane(null,['lot','fin'],['accueil','orbite','echo'],{width:1180,height:840},300,'ariane2');
 assert.deepEqual(r.erreurs,[]);
 for(const k of Object.keys(r.resultat))assert.equal(r.resultat[k].vue,k.split('/')[1],k);
 const nav=await chromium.launch({executablePath:CHROMIUM}),res={};
 try{
  for(const sc of ['lot','fin']){
   const page=await nav.newPage({viewport:{width:1180,height:840}});
   await N.preparerAriane(page,sc,'ariane2');
   await page.click('#ui5 .onglets [data-act="aller:orbite"]');await page.waitForTimeout(500);
   res[sc]=await page.evaluate(()=>({tabs:document.querySelectorAll('#ui5 .esvbar .te').length,cache:!!document.querySelector('#ui5 #ar-cache'),cacheOff:document.querySelector('#ui5 #ar-cache')?.disabled,h2:document.querySelectorAll('#ui5 .scene h2').length,palette:!!document.querySelector('#ui5 [data-act="variante:raycast"]'),parcours:!!document.querySelector('#ui5 .position')}));
   await page.close();
  }
 }finally{await nav.close();}
 assert.deepEqual(res.lot,{tabs:1,cache:true,cacheOff:true,h2:0,palette:true,parcours:false},'pendant le lot : le cache est là mais grisé');
 assert.equal(res.fin.cache,true);assert.equal(res.fin.h2,0);
});
