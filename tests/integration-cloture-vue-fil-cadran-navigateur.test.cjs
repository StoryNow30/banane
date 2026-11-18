'use strict';
/* Intégration de la clôture 5.0 (CH-134 × CH-135, D-368) : la bascule « vue fil » d'Orbite marche aussi en Cadran.
 * Vrai panneau (panel.html, API Chrome simulée, données fabriquées ; ignoré sans Chromium, et dit ignoré).
 *  - en Cadran, un lot en cours offre un seul bouton `sg:vue-lot` (pas de doublon entre l'instrument et le Cadran) ;
 *  - un clic passe en vue fil (`data-vue="fil"` sur la fenêtre, bouton pressé, choix gardé `banane51VueLot`), sans message au service worker ;
 *  - un second clic revient à la vue instrument. Scènes : chantiers/CH-135/outils/scenes.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {SCENES,ouvrirScene}=require('../chantiers/CH-135/outils/scenes.cjs');
/* lectures périodiques du panneau (aucune écriture), envoyées de même en instrument sans clic */
const LECTURES=new Set(['view','list-tabs','fiches-depart']);

test('Clôture 5.0 : en Cadran, « Vue fil » bascule la vue du lot et revient, un seul bouton, aucun message au service worker',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES.cours,{variante:'cadran'});
  const lire=()=>page.evaluate(()=>({classe:document.getElementById('ui5').className,n:document.querySelectorAll('#ui5 [data-act="sg:vue-lot"]').length,
   vue:document.querySelector('#ui5 .sg-fen')?.getAttribute('data-vue')||'',presse:document.querySelector('#ui5 [data-act="sg:vue-lot"]')?.getAttribute('aria-pressed')}));
  const a=await lire();
  assert.equal(a.classe,'u-cadran');assert.equal(a.n,1,'un seul bouton de vue');assert.equal(a.vue,'');assert.equal(a.presse,'false');
  const appels=(await page.evaluate(()=>window.__appels)).length;
  await page.click('#ui5 [data-act="sg:vue-lot"]');await page.waitForTimeout(500);
  const b=await lire();
  assert.equal(b.n,1);assert.equal(b.vue,'fil','vue fil posée sur la fenêtre');assert.equal(b.presse,'true');
  assert.ok((await page.evaluate(()=>window.__ecrits)).some(o=>o.banane51VueLot==='fil'),'choix gardé');
  await page.click('#ui5 [data-act="sg:vue-lot"]');await page.waitForTimeout(500);
  const c=await lire();
  assert.equal(c.vue,'','retour à la vue instrument');assert.equal(c.presse,'false');
  assert.deepEqual((await page.evaluate(()=>window.__appels)).slice(appels).filter(x=>!LECTURES.has(x)),[],'aucun message au service worker hors des lectures périodiques');
  assert.deepEqual(erreurs,[]);await ctx.close();
 }finally{await nav.close();}
});
