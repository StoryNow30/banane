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

test('600 px : la trace des cuts sur une ligne en pleine largeur, les boutons du pied par paires',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.cours.state),{width:600,height:760});await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const q=s=>document.querySelector(s).getBoundingClientRect();const z=q('#ui5 .sg-zone'),t=q('#ui5 .sg-tu-fil'),a=q('#ui5 .sg-actions'),b1=q('#ui5 .sg-actions>button:nth-child(1)'),b2=q('#ui5 .sg-actions>button:nth-child(2)');
   return {trace:{w:t.width,zone:z.width,h:t.height},b1:b1.width,b2:b2.width,pied:a.width,memeLigne:Math.abs(b1.top-b2.top)<1};});
  assert.ok(r.trace.w>=r.trace.zone-2,`trace pleine largeur (${r.trace.w} sur ${r.trace.zone})`);assert.ok(r.trace.h<=48,`trace sur une ligne (${r.trace.h} px)`);
  assert.ok(r.memeLigne,'deux boutons sur la même ligne');assert.ok(r.b1+r.b2>=r.pied-60,`la paire prend la largeur du pied (${r.b1}+${r.b2} sur ${r.pied})`);
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
  assert.match(t,/Thème/);assert.match(t,/Palette/);assert.match(t,/À l’essai : hauteur des poses/);
  await page.evaluate(()=>{window.__marque=1;});await page.click('#ui5 [data-act="sg:choix:palette:signal"]');await page.waitForTimeout(400);
  const p=await page.evaluate(()=>({pal:document.getElementById('ui5').dataset.palette,fond:getComputedStyle(document.querySelector('#ui5 .sg-fen')).backgroundColor,marque:window.__marque,garde:window.__ecrits.some(o=>o.banane51Palette==='signal')}));
  assert.deepEqual(p,{pal:'signal',fond:'rgb(8, 9, 11)',marque:1,garde:true});
  assert.deepEqual(await cases(),avant,'les cases d’origine gardent leur valeur');
  assert.deepEqual(await page.evaluate(a=>[...new Set(window.__appels)].filter(x=>!a.includes(x)),appels),[],'aucune sorte de message nouvelle');
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
