'use strict';
/* CH-025 — LA FILE DE PARTIES DANS SIGNAL, DANS UN VRAI NAVIGATEUR, les clics (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage :
 * tests/helpers/signal-navigateur.cjs. Préparer puis lancer par Signal envoie au service worker exactement ce qu'envoient les boutons de la carte
 * d'origine (`#file-n`, `#file-principal`) ; « Arrêter la file » de Signal envoie ce qu'envoie `#file-secondaire`. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {FILE}=require('./helpers/signal-file.cjs');

/* Les messages de la file (et les réglages envoyés juste avant), dans l'ordre, avec leur contenu. */
const espion=page=>page.evaluate(()=>{window.__m=[];const f=window.chrome.runtime.sendMessage;window.chrome.runtime.sendMessage=async m=>{if(/^(file-|settings$)/.test(m.action||''))window.__m.push(m);return f(m);};});
const messages=page=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__m)));

test('préparer puis lancer une file de 3 parties : Signal envoie la même chose que la carte d’origine, et rien avant « Lancer »',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const sig=await ouvrir(nav,FILE.prete,{width:600,height:760});await espion(sig.page);
  await sig.page.click('#ui5 [data-act="sg:file"]');await sig.page.waitForTimeout(200);
  assert.equal(await sig.page.isVisible('#ui5 .sg-boite'),true,'la boîte s’ouvre');
  await sig.page.click('#ui5 .sg-boite [data-act="sg:file-n:3"]');await sig.page.waitForTimeout(150);
  assert.equal(await sig.page.getAttribute('#ui5 .sg-boite [data-act="sg:file-n:3"]','aria-pressed'),'true');
  await sig.page.click('#ui5 .sg-boite [data-act="legacy:file-principal"]');await sig.page.waitForTimeout(400);
  assert.match(await sig.page.textContent('#ui5 .sg-boite [data-act="legacy:file-principal"]'),/Lancer la file · 3 parties/);
  assert.deepEqual(await messages(sig.page),[],'« Préparer » ne lance rien');
  assert.match(await sig.page.textContent('#ui5 .sg-principal'),/Lancer la file · 3 parties/,'préparée : « Lancer » est l’action principale');
  await sig.page.click('#ui5 .sg-boite [data-act="legacy:file-principal"]');await sig.page.waitForTimeout(500);
  assert.equal(await sig.page.isVisible('#ui5 .sg-boite'),false,'« Lancer » referme la boîte');
  const parSignal=await messages(sig.page);

  const ori=await ouvrir(nav,FILE.prete,{width:600,height:760});await espion(ori.page);
  await ori.page.evaluate(()=>document.querySelector('#file-n [data-n="3"]').click());
  await ori.page.evaluate(()=>document.getElementById('file-principal').click());await ori.page.waitForTimeout(400);
  await ori.page.evaluate(()=>document.getElementById('file-principal').click());await ori.page.waitForTimeout(500);
  const parOrigine=await messages(ori.page);
  assert.deepEqual(parSignal,parOrigine);
  assert.deepEqual(parSignal.map(m=>m.action),['settings','file-demarrer']);assert.equal(parSignal[1].args.n,3);
  assert.deepEqual(sig.erreurs,[]);assert.deepEqual(ori.erreurs,[]);
 }finally{await nav.close();}
});

test('« Arrêter la file » de Signal envoie ce qu’envoie `#file-secondaire`, pendant le lot de la file',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const sig=await ouvrir(nav,FILE.lot,{width:600,height:760});await espion(sig.page);
  assert.match(await sig.page.textContent('#ui5 .sg-file'),/partie 1 sur 2/);
  await sig.page.click('#ui5 .sg-file [data-act="legacy:file-secondaire"]');await sig.page.waitForTimeout(300);
  const ori=await ouvrir(nav,FILE.lot,{width:600,height:760});await espion(ori.page);
  await ori.page.evaluate(()=>document.getElementById('file-secondaire').click());await ori.page.waitForTimeout(300);
  const a=await messages(sig.page),b=await messages(ori.page);
  assert.deepEqual(a,b);assert.deepEqual(a.map(m=>m.action),['file-arreter']);
  assert.deepEqual(sig.erreurs,[]);
 }finally{await nav.close();}
});
