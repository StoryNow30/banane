'use strict';
/* UI 5.0 « Signal » (D-250) DANS UN VRAI NAVIGATEUR, « Ouvrir dans ESV » par le déclencheur caché de T20a (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage : tests/helpers/signal-navigateur.cjs.
 * Captures dans le dossier de SIGNAL_CAPTURES s'il est donné. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {CHROMIUM,PW,absent,N,CAPTURES,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');


test('T20a · « Ouvrir dans ESV » : le bouton caché du panneau envoie l’action existante « goto-cut » ; grisé pendant un lot, avec sa raison',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,{...SC.fin,connection:{status:'ready'}},{width:600,height:760});
  await page.click('#ui5 .sg-poignee');await page.waitForTimeout(300);
  const avant=await page.evaluate(()=>window.__appels.length);
  await page.click('#ui5 [data-act^="sg:ouvrir:"]');await page.waitForTimeout(400);
  const envoye=await page.evaluate(a=>window.__appels.slice(a).filter(x=>x!=='view'&&x!=='fiches-depart'),avant);
  assert.deepEqual(envoye,['goto-cut'],'une seule action, celle qui existait déjà');
  const lot=await ouvrir(nav,{...SC.lot,connection:{status:'ready'}},{width:600,height:760});
  await lot.page.click('#ui5 .sg-poignee');await lot.page.waitForTimeout(300);
  const b=await lot.page.evaluate(()=>{const x=[...document.querySelectorAll('#ui5 .sg-outils button')].find(e=>/Ouvrir/.test(e.textContent));return x?{off:x.disabled,titre:x.title}:null;});
  assert.equal(b.off,true);assert.match(b.titre,/Lot en cours/);
  assert.deepEqual([...erreurs,...lot.erreurs],[]);
 }finally{await nav.close();}
});
