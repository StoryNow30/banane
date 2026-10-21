'use strict';
/* Test 17 (UI) — LA MAQUETTE V2 (« ariane2 ») DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). États fabriqués, rien n'est envoyé à ESV.
 *  1. aucune erreur de page sur l'accueil, Orbite, Écho, Revue et Réglages, en lot et après le lot ; Écho indisponible pendant un lot ;
 *  2. la rangée des onglets ESV, « Vider le cache » (grisé pendant le lot) et l'accès à la palette sont là, sans grand titre ;
 *  3. un clic sur le bouton « Pause » du nouveau panneau envoie au service worker les mêmes messages que le bouton d'origine. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../tools/ui5-navigateur.cjs');
const ouvrirEcran=async(page,ec)=>{await page.click(ec==='reglages'?'#ui5 [data-act="aller:reglages"]':`#ui5 .onglets [data-act="aller:${ec}"]`);await page.waitForTimeout(300);};
test('ariane2 : cinq écrans sans erreur, en lot et après le lot ; onglets ESV, cache grisé en lot, palette, sans grand titre',{skip:N.absent,timeout:60000},async()=>{
 const {navigateur,nouvelle}=await N.ouvrir(),res={};
 try{
  for(const sc of ['lot','fin']){
   const {page,erreurs}=await nouvelle();await N.preparer(page,sc,'ariane2');await page.waitForTimeout(400);
   for(const ec of ['orbite','echo','revue','reglages']){
    await ouvrirEcran(page,ec);assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .app')?.dataset.vue),ec,`${sc}/${ec}`);
    if(ec==='orbite')res[sc]=await page.evaluate(()=>({tabs:document.querySelectorAll('#ui5 .esvbar .te').length,cache:!!document.querySelector('#ui5 #ar-cache'),cacheOff:document.querySelector('#ui5 #ar-cache')?.disabled,h2:document.querySelectorAll('#ui5 .scene h2').length,palette:!!document.querySelector('#ui5 [data-act="variante:palette"]')}));
    await page.click('#ui5 .onglets [data-act="aller:accueil"]');await page.waitForTimeout(100);
   }
   assert.deepEqual(erreurs,[],sc);await page.close();
  }
  assert.deepEqual(res.lot,{tabs:1,cache:true,cacheOff:true,h2:0,palette:true},'pendant le lot : le cache est là mais grisé');
  assert.deepEqual([res.fin.cache,res.fin.cacheOff,res.fin.h2],[true,false,0],'après le lot : le cache est actif');
 }finally{await navigateur.close();}
});
test('ariane2 : « Pause » envoie au service worker les mêmes messages que le bouton d’origine ; Écho indisponible pendant un lot',{skip:N.absent,timeout:60000},async()=>{
 const {navigateur,nouvelle}=await N.ouvrir(),sorties={};
 try{
  for(const [chemin,variante,clic] of [['habillage','ariane2','#ui5 [data-act="pause"]'],['origine','ancienne','#pause']]){
   const {page}=await nouvelle();await N.preparer(page,'lot',variante);await page.waitForTimeout(1200);
   if(chemin==='habillage')assert.match(await page.evaluate(()=>document.querySelector('#ui5 .vig.indispo[data-k="echo"]')?.textContent||''),/Indisponible pendant le lot/);
   const a=await page.evaluate(()=>window.__appels.length);
   await page.evaluate(s=>document.querySelector(s).click(),clic);await page.waitForTimeout(600);
   sorties[chemin]=await page.evaluate(a=>window.__appels.slice(a).filter(x=>x!=='view'&&x!=='fiches-depart'),a);await page.close();
  }
  assert.ok(sorties.origine.includes('pause'),'le bouton d’origine parle au service worker');assert.deepEqual(sorties.habillage,sorties.origine);
 }finally{await navigateur.close();}
});
