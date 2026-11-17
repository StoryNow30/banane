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

test('CH-135 : Interface « Cadran » choisie dans les Réglages, sans recharger, gardée ; retour à l’instrument',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES.cours,{variante:'signal'});
  const marque=await page.evaluate(()=>window.__marque);
  assert.equal(await page.evaluate(()=>document.getElementById('ui5').className),'u-signal','instrument par défaut');
  await page.evaluate(()=>window.ArianeUi5.agir('sg:reglages'));await page.waitForTimeout(200);
  await page.click('#ui5 [data-act="sg:choix:variante:cadran"]');await page.waitForTimeout(500);
  const r=await page.evaluate(()=>({classe:document.getElementById('ui5').className,marque:window.__marque,feuille:!!document.querySelector('#ui5 .sg-feuille'),
   ecrits:window.__ecrits,presse:document.querySelector('#ui5 [data-act="sg:choix:variante:cadran"]')?.getAttribute('aria-pressed')}));
  assert.equal(r.classe,'u-cadran');assert.equal(r.marque,marque,'la page n’a pas été rechargée');assert.ok(r.feuille,'les Réglages restent ouverts');
  assert.equal(r.presse,'true');assert.ok(r.ecrits.some(o=>o.banane51Interface==='cadran'),'choix gardé');
  await page.evaluate(()=>window.ArianeUi5.agir('sg:fermer'));await page.waitForTimeout(300);
  const c=await page.evaluate(()=>{const m=document.querySelector('#ui5 .sg-mot');return {police:getComputedStyle(m).fontFamily,voie:!!document.querySelector('#ui5 .cd-voie svg'),
   prets:document.fonts?[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family):[]};});
  assert.match(c.police,/IBM Plex Mono/);assert.ok(c.voie,'la voie est dessinée');
  await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:variante:signal'));await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.getElementById('ui5').className),'u-signal');
  assert.ok((await page.evaluate(()=>window.__ecrits)).some(o=>o.banane51Interface==='signal'));
  assert.deepEqual(erreurs,[]);await ctx.close();
  /* un choix gardé : le panneau s'ouvre en Cadran */
  const g=await ouvrirScene(nav,SCENES.repos,{stockage:{banane51Interface:'cadran'}});
  assert.equal(await g.page.evaluate(()=>document.getElementById('ui5').className),'u-cadran');assert.deepEqual(g.erreurs,[]);await g.ctx.close();
 }finally{await nav.close();}
});

test('CH-135 : mêmes clics, mêmes messages au service worker en Cadran qu’en instrument',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 const CAS=[['cours','#ui5 .sg-actions>button:nth-child(1)'],['cours','#ui5 .sg-actions>button:nth-child(2)'],['pause','#ui5 .sg-actions>button:nth-child(1)'],
  ['toi','#ui5 .sg-actions>button:nth-child(1)'],['fin','#ui5 .sg-actions>button:nth-child(2)'],['repos','#ui5 .sg-actions>button:nth-child(1)'],['echo','#ui5 .sg-actions>button:nth-child(2)']];
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
  assert.ok(vus>=4,'les clics envoient bien des messages (sinon l’essai ne prouverait rien) : '+vus);
 }finally{await nav.close();}
});
