'use strict';
/* CH-137 (D-371, D-372) : MIX DANS LE VRAI PANNEAU (panel.html, API Chrome simulée, données fabriquées ; ignoré sans Chromium, et dit ignoré).
 *  - Réglages → « Interface : Mix » : le panneau passe en Mix sans recharger la page, la feuille de réglages reste ouverte, le choix est gardé
 *    (`banane51Interface`) ; retour à « Glacier » de même ;
 *  - un choix gardé « cadran » ou « riche » ouvre le panneau en Mix ;
 *  - les mêmes clics envoient les mêmes messages qu'en Glacier (aucun message nouveau vers le service worker) ;
 *  - polices IBM Plex embarquées, aucune erreur de page. Scènes : chantiers/CH-137/outils/scenes.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {SCENES,ouvrirScene}=require('../chantiers/CH-137/outils/scenes.cjs');

/* Découpé comme CH-135 : chaque fichier sous 20 s. Partie 3 sur 4 (cas 5 à 7). */
test('CH-137 : mêmes clics, mêmes messages au service worker en Mix qu’en Glacier',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 const CAS=[
  ['fin','#ui5 .sg-actions>button:nth-child(2)'],['repos','#ui5 .sg-actions>button:nth-child(1)'],['echo','#ui5 .sg-actions>button:nth-child(2)']];
 let vus=0;
 try{
  for(const [nom,sel] of CAS){
   const res={};
   for(const variante of ['signal','mix']){
    const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES[nom],{variante});
    const avant=(await page.evaluate(()=>window.__appels)).length;
    const texte=await page.$eval(sel,e=>e.textContent.trim());
    await page.click(sel);await page.waitForTimeout(400);
    res[variante]={texte,appels:(await page.evaluate(()=>window.__appels)).slice(avant).filter(a=>a!=='view'&&a!=='list-tabs')};
    assert.deepEqual(erreurs,[],`${nom} ${variante}`);await ctx.close();
   }
   assert.equal(res.mix.texte,res.signal.texte,`${nom} : même bouton`);
   assert.deepEqual(res.mix.appels,res.signal.appels,`${nom} « ${res.signal.texte} » : mêmes messages`);vus+=res.signal.appels.length;
  }
  assert.ok(vus>=1,'les clics envoient bien des messages (sinon l’essai ne prouverait rien) : '+vus);
 }finally{await nav.close();}
});

