'use strict';
/* CH-026 — L'ONGLET « File de parties » DE SIGNAL, DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage :
 * tests/helpers/signal-navigateur.cjs (service worker simulé), états de tests/helpers/signal-file.cjs, départs des parties fabriqués. Maquette :
 * Figma, page « CH-026 · Onglet File de parties ». Mesures : 0 erreur de console, 0 débordement de 360 à 600 px, contraste ≥ 4,5:1, sombre et clair ;
 * chaque bouton de l'onglet envoie ce qu'envoie le bouton d'origine. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {FILE,parLargeurs,poserEtat,verifier}=require('./helpers/signal-file.cjs');

const FICHES=[{at:'2026-10-30T14:21:56.620Z',batchId:'b1',ignores:0,invalides:165,partie:13,total:9305,valides:9140,version:'x'},
 {at:'2026-10-30T14:40:10.000Z',batchId:'b2',ignores:12,invalides:493,partie:14,total:9305,valides:8800,version:'x'}];
const ARRET={...FILE.arret,fileParties:{...FILE.arret.fileParties,reprise:{rang:1,part:14,reste:1}}};
const EXTRA='.sg-chaine .sg-mono,.sg-onglet-file .sg-of-t,.sg-onglet-file .sg-meta,.sg-onglet-file .sg-of-depart [role="cell"],.sg-onglet-file .sg-of-depart b,.sg-onglet-file .sg-of-ligne span,.sg-bascule button';

/* Panneau avec des fiches de départ, et un espion des messages de la file. */
async function monter(nav,state){
 const sig=await ouvrir(nav,state,{width:600,height:760});
 await sig.page.addInitScript(fiches=>{const f=window.chrome.runtime.sendMessage;window.__m=[];
  window.chrome.runtime.sendMessage=async m=>{if(/^(file-|settings$)/.test(m.action||''))window.__m.push(JSON.parse(JSON.stringify(m)));if(m.action==='fiches-depart')return {result:{fiches}};return f(m);};},FICHES);
 await sig.page.reload();await sig.page.waitForTimeout(700);
 return sig;
}
const messages=page=>page.evaluate(()=>window.__m.splice(0));


test('onglet « File » : nombre, Lancer (un clic), Reprendre au rang (depuis la partie 14), Arrêter confirmé ; Orbite ramène l’instrument',{skip:absent,timeout:25000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  await page.click('#ui5 .sg-onglet-file [data-act="sg:file-n:3"]');await page.waitForTimeout(200);
  assert.match(await page.textContent('#ui5 .sg-actions .sg-principal'),/Lancer la Constellation · 3 parties/);
  await page.click('#ui5 .sg-actions .sg-principal');await page.waitForTimeout(400);
  const m1=await messages(page);assert.deepEqual(m1.map(m=>m.action),['settings','file-demarrer'],'un clic lance');assert.equal(m1[1].args.n,3);assert.equal(m1[1].args.depuis,undefined);
  await poserEtat(page,ARRET);
  await page.click('#ui5 .sg-actions [data-act="legacy:file-reprendre"]');await page.waitForTimeout(400);
  const m2=await messages(page);assert.deepEqual(m2.map(m=>m.action),['settings','file-demarrer']);assert.equal(m2[1].args.n,1);assert.equal(m2[1].args.depuis,14,'reprise au rang interrompu');
  await poserEtat(page,FILE.lot);
  const sel='#ui5 .sg-actions [data-act="legacy:file-secondaire"]';
  await page.click(sel);await page.waitForTimeout(200);assert.deepEqual(await messages(page),[],'un clic ne fait que demander');
  assert.match(await page.textContent(sel),/Confirmer l’arrêt de la Constellation/);
  await page.waitForTimeout(500);await page.click(sel);await page.waitForTimeout(300);
  assert.deepEqual((await messages(page)).map(m=>m.action),['file-arreter']);
  await page.click('#ui5 .sg-bascule [data-act="mode:automatic"]');await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-fen').dataset.activite),'orbite');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
