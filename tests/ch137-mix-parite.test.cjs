'use strict';
/* CH-137 : LES GARANTIES DE COMPORTEMENT DOIVENT TENIR EN MIX AUSSI. Six fichiers décrivent la structure de Glacier (anneau `.sg-anneau`,
 * `.sg-chiffre`, ligne « Palette » des Réglages, trace masquée à 600 px) et fixent désormais leur variante ; ce fichier reprend ce qu'ils portaient de
 * comportemental, mesuré en Mix avec les scènes de l'audit (`chantiers/CH-137/outils/scenes.cjs`) et le montage de `tests/helpers/signal-navigateur.cjs` :
 *  - l'Aurore liste ses deux parties et l'action permet d'ouvrir la traversée (partie 14 comme la 13) ;
 *  - la Constellation garde le bouton « Bilan et départs des parties » et ses deux écrans ;
 *  - le gros nombre de Mix suit le cut affiché (c'est le chiffre de l'anneau, remplacé par `src/mix-rendu.js`, D-372).
 * La variante est posée ici, pas héritée de l'environnement. Ignoré, et dit ignoré, sans Chromium. */
process.env.UI5_VARIANTE = 'mix';
const {test}=require('node:test'),assert=require('node:assert/strict');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {ouvrir,SC}=require('./helpers/signal-navigateur.cjs');
const {SCENES,ouvrirScene}=require('../chantiers/CH-137/outils/scenes.cjs');
const {E,lot}=require('../chantiers/CH-104/outils/capturer.cjs');
/* Même Aurore à deux parties que tests/ui5-navigateur-signal-constellation-aurore.test.cjs (qui, lui, décrit Glacier). */
const CL=require('../src/correction-liste.js'),{journal}=require('./helpers/correction-journal.cjs');
const L13=CL.construire(journal({partie:13,lot:'B1'}),{partie:13}),L14=CL.construire(journal({partie:14,lot:'B2'}),{partie:14});
const LISTES=[{batchId:'B1',partie:13,entrees:L13.entrees,comptes:L13.comptes},{batchId:'B2',partie:14,entrees:L14.entrees,comptes:L14.comptes}];
const base={...SC.fin,current:{identity:{part:13,cut:15}}};
const visite=(part,cut,label,fin=true)=>({visitId:`v${part}-${cut}`,identity:{part,cut},startedAt:'2026-10-31T10:10:00Z',...(fin?{endedAt:'2026-10-31T10:10:09Z'}:{}),label});
const AURORE={state:{...base,correction:{id:'C1',etat:'proposee',listes:LISTES}},gestes:['sg:onglet-correction']};
const AURORE_OUVERTE={state:{...base,correction:{id:'C1',etat:'ouverte',entreParties:true,courant:{part:13,cut:15},listes:LISTES},
 native:{id:'n1',status:'RUNNING',correction:{id:'C1'},visits:[visite(13,14,'VALIDATE_NO_MOVEMENT'),visite(13,15,null,false)]}},gestes:['sg:onglet-correction']};

test('CH-137 : en Mix, l’Aurore liste ses deux parties et ouvre la traversée de la seconde',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const proposer=await ouvrirScene(nav,AURORE,{largeur:600}),page=proposer.page,erreurs=proposer.erreurs;
  const r=await page.evaluate(()=>{const h=document.getElementById('ui5');
   return {mix:h.classList.contains('u-mix'),parties:[...h.querySelectorAll('.sg-corr-partie')].map(e=>e.textContent).length,
    ouvrir14:!!h.querySelector('[data-act^="sg:corr-ouvrir:14:"]'),principal:h.querySelector('.sg-principal')?.textContent.trim()||''};});
  assert.equal(r.mix,true,'la scène est bien en Mix');
  assert.equal(r.parties,2,'les deux parties de l’Aurore sont listées');
  assert.match(r.principal,/Commencer l’Aurore/);
  assert.deepEqual(erreurs,[]);
  await proposer.ctx.close();
  /* Partie ouverte sur la 13, traversée allumée : « Ouvrir » doit servir aussi pour la 14, comme en Glacier. */
  const ouvert=await ouvrirScene(nav,AURORE_OUVERTE,{largeur:600});
  const o=await ouvert.page.evaluate(()=>{const h=document.getElementById('ui5');
   return {parties:h.querySelectorAll('.sg-corr-partie').length,ouvrir14:!!h.querySelector('[data-act^="sg:corr-ouvrir:14:"]'),principal:h.querySelector('.sg-principal')?.textContent.trim()||''};});
  assert.equal(o.parties,2,'les deux parties restent listées une fois l’Aurore ouverte');
  assert.equal(o.ouvrir14,true,'« Ouvrir » sert aussi pour la partie 14 (traversée allumée)');
  assert.match(o.principal,/Suivant · cut/);
  assert.deepEqual(ouvert.erreurs,[]);
  await ouvert.ctx.close();
 }finally{await nav.close();}
});

test('CH-137 : en Mix, la Constellation garde « Bilan et départs » et ses deux écrans',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES.constellation,{largeur:600});
  const vu=s=>page.evaluate(q=>{const e=document.querySelector(q);return !!e&&e.getClientRects().length>0&&!e.closest('[hidden]');},s);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-barre .sg-stats-b')?.getAttribute('aria-label')),'Bilan et départs des parties');
  assert.equal(await vu('#ui5 [data-k="bilan"]'),false,'le bilan reste derrière le bouton');
  assert.equal(await vu('#ui5 [data-k="departs"]'),false,'les départs aussi');
  await page.click('#ui5 .sg-barre .sg-stats-b');await page.waitForTimeout(400);
  assert.equal(await vu('#ui5 [data-k="bilan"]'),true,'le bouton ouvre le bilan');
  assert.equal(await vu('#ui5 [data-k="departs"]'),true,'et les départs');
  assert.deepEqual(erreurs,[]);
  await ctx.close();
 }finally{await nav.close();}
});

test('CH-137 : en Mix, le gros nombre suit le cut affiché et se met à jour avec le panneau',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,E.cours.state,{width:600,height:760});
  const avant=await page.evaluate(()=>{const b=document.querySelector('#ui5 .mx-chiffre');return {chiffre:b?.textContent.trim(),anneau:!!document.querySelector('#ui5 .sg-anneau')};});
  assert.match(avant.chiffre,/^\d+$/,'le gros nombre porte un chiffre');
  assert.equal(avant.anneau,false,'en Mix, l’anneau est remplacé par le gros nombre (D-372)');
  await page.evaluate(s=>{window.__etat={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...s};},lot('RUNNING',4815,{cutStartedAt:new Date().toISOString()}));
  await page.waitForFunction(a=>document.querySelector('#ui5 .mx-chiffre')?.textContent.trim()!==a,avant.chiffre,{timeout:5000});
  const apres=await page.evaluate(()=>document.querySelector('#ui5 .mx-chiffre').textContent.trim());
  assert.notEqual(apres,avant.chiffre,'le nombre a suivi le nouveau cut');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
