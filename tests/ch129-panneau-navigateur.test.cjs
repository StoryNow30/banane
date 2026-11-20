'use strict';
/* CH-129 (D-361) — RETOUR DE L'OPÉRATEUR SUR LA VISION 18, DANS UN VRAI NAVIGATEUR (ignoré, et dit ignoré, sans Chromium).
 *  - Relecture : la tuile dit « Relecture en cours » ; la phrase complète et ses chiffres restent dans les détails.
 *  - Disposition à 600 px (sa largeur) : la trace des cuts tient sur une ligne en pleine largeur, les boutons du pied vont par paires.
 *  - Réglages : clic du mode rapide, passage de l'Aurore, série de cuts, rattrapage et compteur d'apprentissage ne sont plus à l'écran ; les cases
 *    d'origine gardent leur valeur et aucun message n'est envoyé.
 *  - Troisième palette « Signal », sans recharger.
 *  - Un avis seul (refus d'une action) n'est pas une carte rouge.
 * Montage : tests/helpers/signal-navigateur.cjs ; états fabriqués de chantiers/CH-104/outils/capturer.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
/* CH-137 : ce fichier décrit la disposition de Glacier (trace des cuts masquée à 600 px, ligne « Palette » des Réglages). Il ne suit pas
 * `UI5_VARIANTE` : la variante Mix a ses propres essais (tests/ch137-mix-*.test.cjs). */
delete process.env.UI5_VARIANTE;
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {E}=require('../chantiers/CH-104/outils/capturer.cjs');
const js=x=>JSON.parse(JSON.stringify({...x,fileParties:x.fileParties??null}));

test('relecture : « Relecture en cours » dans la tuile, la phrase complète dans les détails',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.fin.state),{width:600,height:760});
  await page.evaluate(()=>{const b=document.getElementById('relecture-arreter');if(b)b.hidden=false;});await page.waitForTimeout(1300);
  const r=await page.evaluate(()=>({court:document.querySelector('#ui5 .sg-tu-etat .sg-phrase')?.textContent,longue:!!document.querySelector('#ui5 .sg-phrase-longue')}));
  assert.equal(r.court,'Relecture en cours');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

/* CH-134 (D-368), essai mis à jour : la direction A remplace la disposition de CH-129 à 600 px (la trace en points passe derrière « Détails », les
 * boutons du pied ne vont plus par paires : une action pleine sur toute la largeur, les autres en liens sur une ligne). */
test('600 px (direction A) : la trace des cuts derrière « Détails », une action pleine sur toute la largeur, les secondaires en liens sur une ligne',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.cours.state),{width:600,height:760});await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const q=s=>document.querySelector(s),fil=q('#ui5 .sg-tu-fil'),A=q('#ui5 .sg-actions'),b=[...A.children].map(x=>x.getBoundingClientRect()),cs=getComputedStyle(A);
   return {trace:fil?getComputedStyle(fil).display:'absente',plein:b[0].width/(A.getBoundingClientRect().width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)),liens:b.slice(1).every(x=>Math.abs(x.top-b[1].top)<1)};});
  assert.equal(r.trace,'none');assert.ok(r.plein>0.98,`action pleine (${r.plein})`);assert.ok(r.liens,'les liens sur une ligne');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('réglages : quatre réglages hors de l’écran, cases d’origine inchangées, aucun message ; palette « Signal » sans recharger',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.pret.state),{width:600,height:760});
  const cases=()=>page.evaluate(()=>['grappe-differes','aurore-passage','passe-differes','clic-tel-quel','clic-gauche-recentre','clic-tout-recentre'].map(i=>{const e=document.getElementById(i);return e?[i,e.checked,!!e.indeterminate]:[i,null];}));
  const avant=await cases(),appels=await page.evaluate(()=>[...new Set(window.__appels)]);
  await page.evaluate(()=>window.ArianeUi5.agir('sg:reglages'));await page.waitForTimeout(300);
  const t=await page.evaluate(()=>document.querySelector('#ui5 .sg-feuille').textContent);
  for(const m of [/Clic du mode rapide/,/passage entre parties/,/Série de cuts/,/Rattrapage/])assert.doesNotMatch(t,m);
  assert.match(t,/Thème/);assert.match(t,/Palette/);assert.match(t,/Hauteur des poses/);   /* D-367 : allumé par défaut, plus « à l’essai » */
  await page.evaluate(()=>{window.__marque=1;});await page.click('#ui5 [data-act="sg:choix:palette:signal"]');await page.waitForTimeout(400);
  const p=await page.evaluate(()=>({pal:document.getElementById('ui5').dataset.palette,fond:getComputedStyle(document.querySelector('#ui5 .sg-fen')).backgroundColor,marque:window.__marque,garde:window.__ecrits.some(o=>o.banane51Palette==='signal')}));
  assert.deepEqual(p,{pal:'signal',fond:'rgb(8, 9, 11)',marque:1,garde:true});
  assert.deepEqual(await cases(),avant,'les cases d’origine gardent leur valeur');
  assert.deepEqual(await page.evaluate(a=>[...new Set(window.__appels)].filter(x=>!a.includes(x)),appels),['reinitialiser-etat'],'seule la lecture CH-149 est ajoutée dans Réglages');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('un avis seul (refus d’une action pendant la relecture) n’est pas une carte rouge',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.fin.state),{width:600,height:760});
  /* le refus du service worker (background.js, RELECTURE_BLOQUE) : le panneau d'origine l'écrit en rouge dans #notice, puis Signal se redessine */
  await page.waitForTimeout(800);
  await page.evaluate(()=>{const n=document.getElementById('notice');n.textContent='Relecture après le lot en cours (153 sur 324) : clique sur « Arrêter la relecture » et attends qu’elle s’arrête.';n.classList.add('error');window.ArianeUi5.maj(true);});
  const r=await page.evaluate(()=>{const e=document.querySelector('#ui5 .sg-avis-seul');if(!e)return null;const s=getComputedStyle(e);return {fond:s.backgroundColor,image:s.backgroundImage,icone:getComputedStyle(e.querySelector('.sg-ic')).display};});
  assert.ok(r,'l’avis est dit');assert.equal(r.fond,'rgba(0, 0, 0, 0)');assert.equal(r.image,'none');assert.equal(r.icone,'none');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('consigne de sécurité : pendant le rattrapage, « ne touche à rien » reste visible d’emblée, en ligne sobre ; le titre est court',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.rattrapage.state),{width:600,height:760});await page.waitForTimeout(500);
  const r=await page.evaluate(()=>{const c=document.querySelector('#ui5 .sg-tu-etat .sg-consigne');return {titre:document.querySelector('#ui5 .sg-tu-etat .sg-phrase').textContent,consigne:c&&c.getClientRects().length?c.textContent:null,fond:c?getComputedStyle(c).backgroundColor:null};});
  assert.equal(r.titre,'Rattrapage en cours');assert.match(r.consigne||'',/ne touche à rien/);assert.equal(r.fond,'rgba(0, 0, 0, 0)');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('D-362 : à 600 px, l’écran Constellation n’a ni bilan par partie ni départs ; le bouton à icône de l’en-tête ouvre leur écran, Échap en revient',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const e=E['file-fin'],{page,erreurs}=await ouvrir(nav,js(e.state),{width:600,height:760});
  await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(500);
  const vu=()=>page.evaluate(()=>['bilan','departs'].map(k=>!!document.querySelector(`#ui5 [data-k="${k}"]`)?.getClientRects().length));
  assert.deepEqual(await vu(),[false,false],'ni bilan ni départs à l’écran');
  const b=await page.evaluate(()=>{const x=document.querySelector('#ui5 .sg-barre .sg-stats-b');return x?{label:x.getAttribute('aria-label'),horsOnglets:!x.closest('.sg-bascule')}:null;});
  assert.deepEqual(b,{label:'Bilan et départs des parties',horsOnglets:true});
  await page.click('#ui5 .sg-stats-b');await page.waitForTimeout(400);assert.deepEqual(await vu(),[true,true],'leur écran');
  await page.keyboard.press('Escape');await page.waitForTimeout(400);assert.deepEqual(await vu(),[false,false],'retour en un geste');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
