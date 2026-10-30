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
const EXTRA='.sg-onglet-file .sg-of-t,.sg-onglet-file .sg-meta,.sg-onglet-file th,.sg-onglet-file td,.sg-onglet-file .sg-of-ligne span,.sg-bascule button';

/* Panneau avec des fiches de départ, et un espion des messages de la file. */
async function monter(nav,state){
 const sig=await ouvrir(nav,state,{width:600,height:760});
 await sig.page.addInitScript(fiches=>{const f=window.chrome.runtime.sendMessage;window.__m=[];
  window.chrome.runtime.sendMessage=async m=>{if(/^(file-|settings$)/.test(m.action||''))window.__m.push(JSON.parse(JSON.stringify(m)));if(m.action==='fiches-depart')return {result:{fiches}};return f(m);};},FICHES);
 await sig.page.reload();await sig.page.waitForTimeout(700);
 return sig;
}
const messages=page=>page.evaluate(()=>window.__m.splice(0));

test('onglet « File » : prête, en cours, arrêtée avec alerte, finie ; 360 à 600, sombre et clair ; sans débordement ni contraste faible ni erreur',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM}),res={},vus={};
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  for(const [nom,st] of [['prete',FILE.prete],['lot',FILE.lot],['arret',ARRET],['fin',FILE.fin]]){
   if(nom!=='prete')await poserEtat(page,st);
   res[nom]=await parLargeurs(page,{extra:EXTRA});
   vus[nom]=await page.evaluate(()=>{const h=document.getElementById('ui5');return {onglet:h.querySelector('.sg-fen')?.dataset.activite,choisi:h.querySelector('.sg-bascule [aria-selected="true"]')?.textContent,
    titres:[...h.querySelectorAll('.sg-of-t')].map(e=>e.textContent),boutons:[...h.querySelectorAll('.sg-onglet-file button[data-act]')].map(b=>b.textContent.trim()+'|'+b.dataset.act),
    departs:[...h.querySelectorAll('.sg-of-departs tbody tr')].map(r=>[...r.cells].map(c=>c.textContent)),bilan:h.querySelectorAll('.sg-file-bilan li').length,tiroir:!!h.querySelector('.sg-tiroir')};});
  }
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
 for(const [nom,r] of Object.entries(res))verifier(assert,nom,r);
 for(const nom of Object.keys(vus)){assert.equal(vus[nom].onglet,'file',nom);assert.equal(vus[nom].choisi,'File',nom);assert.equal(vus[nom].tiroir,false,nom+' : pas de tiroir dans l’onglet');
  assert.deepEqual(vus[nom].departs,[['14','30/10 15:40','8 800','493','12','9 305'],['13','30/10 15:21','9 140','165','0','9 305']],nom+' : départs, du plus récent, heure de Paris');}
 assert.equal(res.prete['600'].mot,'File prête');assert.deepEqual(vus.prete.titres,['Lancer la file','Bilan de la file','Départs des parties']);
 assert.ok(vus.prete.boutons.some(b=>/^Lancer la file · 2 parties\|legacy:file-lancer$/.test(b)),JSON.stringify(vus.prete.boutons));
 assert.equal(res.lot['600'].mot,'File en cours');assert.equal(res.lot['360'].arreter,true);assert.equal(res.lot['600'].depart,false);
 assert.deepEqual(vus.lot.titres,['Bilan de la file','Départs des parties'],'pendant la file : pas de lancement');
 assert.equal(res.arret['600'].mot,'File arrêtée');assert.match(res.arret['600'].alerte,/ne change pas de partie/);
 assert.deepEqual(vus.arret.boutons.filter(b=>/file-(reprendre|lancer)/.test(b)),['Reprendre la file · 1 partie restante|legacy:file-reprendre','Nouvelle file · 2 parties|legacy:file-lancer']);
 assert.equal(vus.arret.bilan,1);
 for(const nom of ['prete','arret','fin'])assert.ok(vus[nom].boutons.includes('3|sg:file-n:3'),nom+' : le nombre de parties se choisit (aussi après une file)');
 assert.ok(!vus.lot.boutons.some(b=>/sg:file-n/.test(b)),'pas pendant la file');
 assert.equal(res.fin['600'].mot,'File terminée');assert.equal(vus.fin.bilan,2);
 assert.deepEqual(vus.fin.boutons.filter(b=>/file-lancer|export-tout/.test(b)),['Relancer une file · 2 parties|legacy:file-lancer','Exporter le dossier|legacy:export-tout']);
});

test('onglet « File » : nombre, Lancer (un clic), Reprendre au rang (depuis la partie 14), Arrêter confirmé ; Orbite ramène l’instrument',{skip:absent,timeout:25000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  await page.click('#ui5 .sg-onglet-file [data-act="sg:file-n:3"]');await page.waitForTimeout(200);
  assert.match(await page.textContent('#ui5 .sg-onglet-file .sg-principal'),/Lancer la file · 3 parties/);
  await page.click('#ui5 .sg-onglet-file .sg-principal');await page.waitForTimeout(400);
  const m1=await messages(page);assert.deepEqual(m1.map(m=>m.action),['settings','file-demarrer'],'un clic lance');assert.equal(m1[1].args.n,3);assert.equal(m1[1].args.depuis,undefined);
  await poserEtat(page,ARRET);
  await page.click('#ui5 .sg-onglet-file [data-act="legacy:file-reprendre"]');await page.waitForTimeout(400);
  const m2=await messages(page);assert.deepEqual(m2.map(m=>m.action),['settings','file-demarrer']);assert.equal(m2[1].args.n,1);assert.equal(m2[1].args.depuis,14,'reprise au rang interrompu');
  await poserEtat(page,FILE.lot);
  const sel='#ui5 .sg-onglet-file [data-act="legacy:file-secondaire"]';
  await page.click(sel);await page.waitForTimeout(200);assert.deepEqual(await messages(page),[],'un clic ne fait que demander');
  assert.match(await page.textContent(sel),/Confirmer l’arrêt de la file/);
  await page.waitForTimeout(500);await page.click(sel);await page.waitForTimeout(300);
  assert.deepEqual((await messages(page)).map(m=>m.action),['file-arreter']);
  await page.click('#ui5 .sg-bascule [data-act="mode:automatic"]');await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-fen').dataset.activite),'orbite');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
