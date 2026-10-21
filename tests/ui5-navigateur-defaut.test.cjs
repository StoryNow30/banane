'use strict';
/* Test 17 (UI) — LE PANNEAU DANS UN VRAI NAVIGATEUR : le panneau d'avant est le défaut, « Essayer le nouveau panneau » ouvre la maquette v2 et garde le choix.
 * Chromium de Playwright, fourni par l'environnement ; ignoré s'il est absent, et dit ignoré, pas réussi. panel.html est chargé depuis le disque avec une API Chrome
 * simulée (états fabriqués, tools/ui5-navigateur.cjs) ; rien n'est envoyé à ESV. Un fichier par partie de l'essai : chacun doit tenir dans les 20 secondes de verify. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const N=require('../tools/ui5-navigateur.cjs');
test('au départ le panneau d’avant ; la relecture en pause y est visible avec sa reprise ; le lien ouvre la v2 et garde le choix',{skip:N.absent,timeout:60000},async()=>{
 const {navigateur,nouvelle}=await N.ouvrir();
 try{
  const {page,erreurs}=await nouvelle();await N.preparer(page,'relecture-pause','ancienne');await page.waitForFunction(()=>!document.getElementById('relecture-reprendre').hidden);
  const avant=await page.evaluate(()=>({ui5:document.body.classList.contains('ui5'),contenu:document.getElementById('ui5').innerHTML,reprendre:!document.getElementById('relecture-reprendre').hidden,
   texte:document.getElementById('relecture-reprendre').textContent,arreter:!document.getElementById('relecture-arreter-pause').hidden,lancer:document.getElementById('relecture-lancer').hidden,
   reglage:document.getElementById('relecture-pause-actif').checked,essai:!!document.getElementById('ui5-essai'),nom:document.title,stockage:window.__stockage}));
  assert.deepEqual([avant.ui5,avant.contenu,avant.stockage],[false,'',{}],'rien n’est dessiné ni écrit au départ');
  assert.deepEqual([avant.reprendre,avant.texte,avant.arreter,avant.lancer,avant.reglage,avant.essai],[true,'Reprendre la relecture au cut 110',true,true,true,true],'pause : reprise et arrêt proposés, pas de « Lancer »');
  assert.equal(avant.nom,'Ariane 4.9.5 test 17 (UI)');
  await page.click('#ui5-essai');await page.waitForSelector('#ui5 .app');
  const apres=await page.evaluate(()=>({vue:document.querySelector('#ui5 .app')?.dataset.vue,stockage:window.__stockage}));
  assert.equal(apres.vue,'accueil');assert.deepEqual(apres.stockage,{banane51Interface:'ariane2'});
  assert.deepEqual(erreurs,[]);
 }finally{await navigateur.close();}
});
