'use strict';
/* CH-137 (D-371, D-372) : MIX DANS LE VRAI PANNEAU (panel.html, API Chrome simulée, données fabriquées ; ignoré sans Chromium, et dit ignoré).
 *  - Réglages → « Interface : Mix » : le panneau passe en Mix sans recharger la page, la feuille de réglages reste ouverte, le choix est gardé
 *    (`banane51Interface`) ; la ligne « Palette » n'y est plus ; retour à « Glacier » de même ;
 *  - un choix gardé « cadran » ou « riche » ouvre le panneau en Mix ;
 *  - le pied « Cache des exports » de Mix envoie le même message que le bouton du menu de Glacier ;
 *  - polices IBM Plex embarquées, aucune erreur de page. Scènes : chantiers/CH-137/outils/scenes.cjs. Partie 1 sur 4. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {SCENES,ouvrirScene}=require('../chantiers/CH-137/outils/scenes.cjs');

test('CH-137 : Interface « Mix » choisie dans les Réglages, sans recharger, gardée ; Palette absente ; retour à Glacier ; choix anciens repliés',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES.cours,{variante:'signal'});
  const marque=await page.evaluate(()=>window.__marque);
  assert.equal(await page.evaluate(()=>document.getElementById('ui5').className),'u-signal','Glacier par défaut');
  await page.evaluate(()=>window.ArianeUi5.agir('sg:reglages'));await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#ui5 .sg-reg .sg-lib>span')].some(e=>e.textContent==='Palette')),'Glacier : ligne Palette');
  await page.click('#ui5 [data-act="sg:choix:variante:mix"]');await page.waitForTimeout(500);
  const r=await page.evaluate(()=>({classe:document.getElementById('ui5').className,marque:window.__marque,feuille:!!document.querySelector('#ui5 .sg-feuille'),ecrits:window.__ecrits,
   presse:document.querySelector('#ui5 [data-act="sg:choix:variante:mix"]')?.getAttribute('aria-pressed'),palette:[...document.querySelectorAll('#ui5 .sg-reg .sg-lib>span')].some(e=>e.textContent==='Palette')}));
  assert.equal(r.classe,'u-mix');assert.equal(r.marque,marque,'la page n’a pas été rechargée');assert.ok(r.feuille,'les Réglages restent ouverts');
  assert.equal(r.presse,'true');assert.ok(r.ecrits.some(o=>o.banane51Interface==='mix'),'choix gardé');assert.equal(r.palette,false,'Mix : pas de ligne Palette');
  await page.evaluate(()=>window.ArianeUi5.agir('sg:fermer'));await page.waitForTimeout(300);
  const c=await page.evaluate(()=>({mot:getComputedStyle(document.querySelector('#ui5 .sg-mot')).fontFamily,chiffre:getComputedStyle(document.querySelector('#ui5 .mx-chiffre')).fontFamily,
   pied:!!document.querySelector('#ui5 .mx-pied'),anneau:!!document.querySelector('#ui5 .sg-anneau')}));
  assert.match(c.mot,/IBM Plex Sans/);assert.match(c.chiffre,/IBM Plex Mono/);assert.ok(c.pied);assert.equal(c.anneau,false);
  await page.evaluate(()=>window.ArianeUi5.agir('sg:choix:variante:signal'));await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.getElementById('ui5').className),'u-signal');
  assert.ok((await page.evaluate(()=>window.__ecrits)).some(o=>o.banane51Interface==='signal'));
  assert.deepEqual(erreurs,[]);await ctx.close();
  for(const v of ['cadran','riche']){const g=await ouvrirScene(nav,SCENES.repos,{stockage:{banane51Interface:v}});
   assert.equal(await g.page.evaluate(()=>document.getElementById('ui5').className),'u-mix',v);assert.deepEqual(g.erreurs,[]);await g.ctx.close();}
 }finally{await nav.close();}
});

test('CH-137 : le pied « Vider le cache » de Mix envoie le même message que le bouton du menu de Glacier',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const res={};
  for(const [variante,sel] of [['signal','#ui5 .sg-menu [data-act="legacy:export-cache-clear"]'],['mix','#ui5 .mx-pied [data-act="legacy:export-cache-clear"]']]){
   const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES.fin,{variante});
   if(variante==='signal'){await page.evaluate(()=>window.ArianeUi5.agir('sg:menu'));await page.waitForTimeout(200);}
   const avant=(await page.evaluate(()=>window.__appels)).length,actif=await page.$eval(sel,e=>!e.disabled);
   if(actif){await page.click(sel);await page.waitForTimeout(400);}
   res[variante]={actif,appels:(await page.evaluate(()=>window.__appels)).slice(avant).filter(a=>a!=='view'&&a!=='list-tabs')};
   assert.deepEqual(erreurs,[],variante);await ctx.close();
  }
  assert.ok(res.signal.actif&&res.signal.appels.length>0,'le clic envoie bien un message (sinon l’essai ne prouverait rien)');assert.equal(res.mix.actif,res.signal.actif,'même garde');assert.deepEqual(res.mix.appels,res.signal.appels,'mêmes messages');
 }finally{await nav.close();}
});
