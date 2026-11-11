'use strict';
/* CH-105 — LA MOLETTE DU NOMBRE DE PARTIES, DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage :
 * tests/helpers/signal-navigateur.cjs (service worker simulé), états de tests/helpers/signal-file.cjs. Chaque geste (clic « − » / « + », clic sur
 * un voisin, molette de la souris, glisser, flèches, Début, Fin) règle le nombre ; aucun ne sort de 1 à 20 ; « Lancer » envoie `file-demarrer` avec ce
 * `n` ; la boîte « Constellation » d'Orbite a la même molette ; la chaîne tient à 9, 12 et 20 parties aux trois largeurs ; rien n'est animé sous
 * « réduire les animations ». Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {FILE,poserEtat}=require('./helpers/signal-file.cjs');
const FP=require('../src/file-parties.js');

async function monter(nav,state,opts={}){
 const sig=await ouvrir(nav,state,{width:600,height:760});
 if(opts.calme)await sig.page.emulateMedia({reducedMotion:'reduce'});
 await sig.page.addInitScript(()=>{const f=window.chrome.runtime.sendMessage;window.__m=[];
  window.chrome.runtime.sendMessage=async m=>{if(/^(file-|settings$)/.test(m.action||''))window.__m.push(JSON.parse(JSON.stringify(m)));if(m.action==='fiches-depart')return {result:{fiches:[]}};return f(m);};});
 await sig.page.reload();await sig.page.waitForTimeout(700);
 return sig;
}
const messages=page=>page.evaluate(()=>window.__m.splice(0));
const SL='#ui5 .sg-onglet-file [role="slider"]';
const valeur=page=>page.evaluate(s=>Number(document.querySelector(s)?.getAttribute('aria-valuenow')),SL);
const attendre=page=>page.waitForTimeout(120);

test('molette : chaque geste règle le nombre, sans sortir de 1 à 20 ; Lancer envoie file-demarrer avec n (7, 12, 20)',{skip:absent,timeout:40000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  assert.equal(await page.getAttribute(SL,'aria-valuemax'),String(FP.MAX_PARTIES),'borne haute = MAX_PARTIES');
  assert.equal(await page.getAttribute(SL,'aria-valuemin'),'1');assert.equal(await page.getAttribute(SL,'aria-label'),'Nombre de parties');
  assert.equal(await valeur(page),2,'valeur par défaut d’aujourd’hui');
  /* « + » et « − » */
  for(let i=0;i<5;i++){await page.click('#ui5 .sg-onglet-file .sg-mol-plus');await attendre(page);}
  assert.equal(await valeur(page),7);
  assert.match(await page.textContent('#ui5 .sg-actions .sg-principal'),/Lancer la Constellation · 7 parties/);
  assert.match(await page.textContent('#ui5 .sg-constel-t .sg-chiffre'),/7 parties/,'la tuile du haut suit');
  await page.click('#ui5 .sg-actions .sg-principal');await page.waitForTimeout(400);
  let m=await messages(page);assert.deepEqual(m.map(x=>x.action),['settings','file-demarrer']);assert.equal(m[1].args.n,7);
  await poserEtat(page,FILE.prete);await page.waitForTimeout(200);
  /* clavier : Fin, Début, flèches */
  await page.focus(SL);await page.keyboard.press('End');await attendre(page);assert.equal(await valeur(page),20,'Fin');
  await page.keyboard.press('ArrowRight');await attendre(page);assert.equal(await valeur(page),20,'pas au-delà de 20');
  assert.equal(await page.isDisabled('#ui5 .sg-onglet-file .sg-mol-plus'),true,'« + » éteint à 20');
  await page.keyboard.press('Home');await attendre(page);assert.equal(await valeur(page),1,'Début');
  await page.keyboard.press('ArrowLeft');await attendre(page);assert.equal(await valeur(page),1,'pas sous 1');
  assert.equal(await page.isDisabled('#ui5 .sg-onglet-file .sg-mol-moins'),true,'« − » éteint à 1');
  for(let i=0;i<11;i++)await page.keyboard.press('ArrowRight');await attendre(page);assert.equal(await valeur(page),12,'flèches');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('role')),'slider','le focus reste sur la molette');
  await page.click('#ui5 .sg-actions .sg-principal');await page.waitForTimeout(400);
  m=await messages(page);assert.equal(m.find(x=>x.action==='file-demarrer').args.n,12);
  await poserEtat(page,FILE.prete);await page.waitForTimeout(200);
  /* molette de la souris : un cran = un pas, la zone derrière ne défile pas */
  const box=await page.locator(SL).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  const zone=()=>page.evaluate(()=>document.querySelector('#ui5 .sg-page')?.scrollTop||0),z0=await zone();
  await page.mouse.wheel(0,100);await page.waitForTimeout(150);assert.equal(await valeur(page),13,'un cran vers le bas = +1');
  await page.mouse.wheel(0,-100);await page.waitForTimeout(150);assert.equal(await valeur(page),12,'un cran vers le haut = −1');
  for(let i=0;i<15;i++){await page.mouse.wheel(0,100);await page.waitForTimeout(40);}
  await page.waitForTimeout(150);assert.equal(await valeur(page),20,'la molette ne passe pas 20');
  assert.equal(await zone(),z0,'la zone derrière n’a pas défilé');
  /* glisser : vers la gauche fait monter, accroche sur le plus proche */
  for(let i=0;i<10;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(40);}
  await page.waitForTimeout(150);assert.equal(await valeur(page),10);
  const cell=await page.evaluate(()=>document.querySelector('#ui5 .sg-onglet-file .sg-mol-n').getBoundingClientRect().width);
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();
  for(let i=1;i<=10;i++)await page.mouse.move(cx-i*cell*0.32,cy);
  await page.mouse.up();await page.waitForTimeout(200);
  assert.equal(await valeur(page),13,'glisser de 3,2 cases à gauche : 13 (accroche)');
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+cell*40,cy,{steps:8});await page.mouse.up();await page.waitForTimeout(200);
  assert.equal(await valeur(page),1,'glisser loin à droite : borné à 1');
  /* clic sur un voisin, puis 20 et Lancer */
  await page.click('#ui5 .sg-onglet-file [data-act="sg:file-n:2"]');await attendre(page);assert.equal(await valeur(page),2,'clic sur un voisin');
  await page.focus(SL);await page.keyboard.press('End');await attendre(page);
  await page.click('#ui5 .sg-actions .sg-principal');await page.waitForTimeout(400);
  m=await messages(page);assert.equal(m.find(x=>x.action==='file-demarrer').args.n,20);
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
