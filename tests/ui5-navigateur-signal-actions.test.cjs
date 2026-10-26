'use strict';
/* UI 5.0 « Signal » (D-250) DANS UN VRAI NAVIGATEUR, les actions : clic identique au bouton d’origine, détails techniques, palette (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage : tests/helpers/signal-navigateur.cjs.
 * Captures dans le dossier de SIGNAL_CAPTURES s'il est donné. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {CHROMIUM,PW,absent,N,CAPTURES,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');

test('un clic sur Signal envoie au service worker la même chose que le bouton d’origine, rien de plus',{skip:absent,timeout:19000},async()=>{
 const r=await N.comparerClics('signal',[{etat:SC.lot,idLegacy:'pause',selecteur:'#ui5 .sg-principal[data-act="pause"]'},{etat:SC.lot,idLegacy:'stop',selecteur:'#ui5 [data-act="legacy:stop"]'}]);
 for(const x of r){assert.deepEqual(x.habillage,x.origine,x.idLegacy);}
 assert.ok(r[0].origine.length>0,'Pause envoie bien quelque chose');
});

test('détails techniques : ouverts depuis les réglages, ce sont les éléments du panneau d’avant, remis à leur place à la fermeture ; Ctrl K et Échap',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,SC.fin,{width:600,height:760});
  const avant=await page.evaluate(()=>({parent:document.getElementById('lot-details').parentElement.id,cache:document.getElementById('lot-details').hidden}));
  await page.click('#ui5 [data-act="sg:reglages"]');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>!!document.querySelector('#ui5 .sg-feuille')),true);
  await page.click('#ui5 .sg-feuille [data-act="sg:tech"]');await page.waitForTimeout(300);
  const ouvert=await page.evaluate(()=>({dans:document.getElementById('lot-details').closest('#ui5-tech')!==null,visible:!document.getElementById('lot-details').hidden,journal:!!document.querySelector('#ui5-tech #journal'),diag:!!document.querySelector('#ui5-tech #gcv1-diagnostic-export')}));
  assert.deepEqual(ouvert,{dans:true,visible:true,journal:true,diag:true});
  if(CAPTURES)await page.screenshot({path:path.join(CAPTURES,'signal-details-techniques.png')});
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({parent:document.getElementById('lot-details').parentElement.id,cache:document.getElementById('lot-details').hidden,couche:!!document.getElementById('ui5-tech')})),{...avant,couche:false});
  await page.keyboard.press('Control+k');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ui5-q');
  if(CAPTURES)await page.screenshot({path:path.join(CAPTURES,'signal-palette.png')});
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>!!document.querySelector('#ui5 .sg-palette')),false);
  assert.ok(!(await page.evaluate(()=>window.__appels)).some(a=>/goto|ouvrir/.test(a)),'aucune commande nouvelle');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
