'use strict';
/* Test 17 (UI) — LA PALETTE SOBRE DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). États fabriqués, rien n'est envoyé à ESV.
 * Le champ est actif à l'ouverture, au plus quatre commandes, la frappe n'est pas perdue à chaque dessin, Entrée lance la commande du panneau (jamais une commande grisée),
 * « regl » ouvre les Réglages d'Ariane, Ctrl K revient aux cartes ; la reprise de la relecture est proposée pendant une pause. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../tools/ui5-navigateur.cjs');
test('palette : champ actif, commandes du moment, frappe gardée, Entrée = bouton d’origine, Réglages, Ctrl K',{skip:N.absent,timeout:60000},async()=>{
 const {navigateur,nouvelle}=await N.ouvrir({width:720,height:560});
 try{
  const {page,erreurs}=await nouvelle();await N.preparer(page,'lot','palette',{width:720,height:560});await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ui5-q');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#ui5 .i2').length),3,'trois commandes du moment, pas plus');
  await page.keyboard.type('regl');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5-q').value),'regl','la frappe n’est pas perdue à chaque dessin');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);await page.keyboard.press('Enter');await page.waitForTimeout(300);
  assert.ok((await page.evaluate(()=>window.__appels)).includes('pause'),'Entrée = « Pause », comme le bouton d’origine');
  await page.keyboard.type('regl');await page.keyboard.press('Enter');await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .app')?.dataset.vue),'reglages');
  await page.keyboard.press('Control+k');await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5').className),'u-palette');
  assert.deepEqual(erreurs,[]);
 }finally{await navigateur.close();}
});
test('palette : pendant une pause de la relecture, la reprise est la première commande',{skip:N.absent,timeout:60000},async()=>{
 const {navigateur,nouvelle}=await N.ouvrir({width:720,height:560});
 try{
  const {page,erreurs}=await nouvelle();await N.preparer(page,'relecture-pause','palette',{width:720,height:560});await page.waitForFunction(()=>/Reprendre la relecture/.test(document.querySelector('#ui5')?.textContent||''));
  const l=await page.evaluate(()=>[...document.querySelectorAll('#ui5 .i2 .nm')].map(e=>e.textContent));
  assert.equal(l[0],'Reprendre la relecture au cut 110');assert.ok(l.includes('Arrêter la relecture'));assert.deepEqual(erreurs,[]);
 }finally{await navigateur.close();}
});
