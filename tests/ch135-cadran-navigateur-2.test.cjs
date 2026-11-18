'use strict';
/* CH-135 (D-368) : CADRAN DANS LE VRAI PANNEAU (panel.html, API Chrome simulée, données fabriquées ; ignoré sans Chromium, et dit ignoré).
 *  - Réglages → « Interface : Cadran » : le panneau passe en Cadran sans recharger la page, la feuille de réglages reste ouverte, le choix est gardé
 *    (`banane51Interface`) ; retour à « Instrument » de même ;
 *  - un choix gardé « cadran » ouvre le panneau en Cadran ;
 *  - les mêmes clics envoient les mêmes messages qu'en instrument (aucun message nouveau vers le service worker) ;
 *  - polices IBM Plex embarquées, aucune erreur de page. Scènes : chantiers/CH-135/outils/scenes.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {SCENES,ouvrirScene}=require('../chantiers/CH-135/outils/scenes.cjs');

/* Découpé à l'intégration de la clôture (18/11) : le fichier entier durait plus de 20 s, la limite du verify par fichier. Partie 2 sur 5 (cas 1 et 2). */
test('CH-135 : mêmes clics, mêmes messages au service worker en Cadran qu’en instrument',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 const CAS=[['cours','#ui5 .sg-actions>button:nth-child(1)'],['cours','#ui5 .sg-actions>button:nth-child(2)'],];
 let vus=0;
 try{
  for(const [nom,sel] of CAS){
   const res={};
   for(const variante of ['signal','cadran']){
    const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES[nom],{variante});
    const avant=(await page.evaluate(()=>window.__appels)).length;
    const texte=await page.$eval(sel,e=>e.textContent.trim());
    await page.click(sel);await page.waitForTimeout(400);
    res[variante]={texte,appels:(await page.evaluate(()=>window.__appels)).slice(avant).filter(a=>a!=='view'&&a!=='list-tabs')};
    assert.deepEqual(erreurs,[],`${nom} ${variante}`);await ctx.close();
   }
   assert.equal(res.cadran.texte,res.signal.texte,`${nom} : même bouton`);
   assert.deepEqual(res.cadran.appels,res.signal.appels,`${nom} « ${res.signal.texte} » : mêmes messages`);vus+=res.signal.appels.length;
  }
  assert.ok(vus>=1,'les clics envoient bien des messages (sinon l’essai ne prouverait rien) : '+vus);
 }finally{await nav.close();}
});

