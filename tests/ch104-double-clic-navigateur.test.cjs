'use strict';
/* CH-104 — LE DOUBLE-CLIC QUI CHANGE D'ÉCRAN NE DONNE PAS D'ORDRE (relevé de l'intégrateur, 11/11), dans un vrai navigateur (ignoré, et dit ignoré,
 * sans Chromium). Dans la Constellation en cours, « Suivre dans Orbite » affiche aussitôt le pied d'Orbite, dont le premier bouton (« Pause ») est à
 * la même place : le second clic d'un double-clic mettait le lot en pause. Pendant 400 ms après un clic qui change d'écran (onglet, feuille « Ce qui
 * reste »), le pied n'accepte aucun clic ; après, les boutons répondent comme avant. La feuille, elle, répond tout de suite : le second essai vérifie qu'un
 * double-clic qui l'ouvre ne donne aucun ordre et ne marque aucune ligne, aux deux tailles. Montage : tests/helpers/signal-navigateur.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {E}=require('../chantiers/CH-104/outils/capturer.cjs');
const js=x=>JSON.parse(JSON.stringify(x));
const centre=(page,sel)=>page.evaluate(s=>{const b=[...document.querySelectorAll(s)].find(x=>x.getClientRects().length);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,t:b.textContent.trim()};},sel);
const ORDRES=/^(pause|resume|stop|start-batch|new-batch|retry|manual|explicit-skip|file-|relecture-(?!etat|choix)|apply|validate|skip)/;
const ordres=page=>page.evaluate(()=>window.__appels.slice()).then(L=>L.filter(a=>ORDRES.test(String(a))));

test('double-clic sur « Suivre dans Orbite » : aucun ordre ; « Pause » répond 500 ms plus tard',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  for(const vp of [{width:600,height:760},{width:360,height:480}]){
   const {page,erreurs}=await ouvrir(nav,js(E['file-cours'].state),vp);
   await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(700);
   const s=await centre(page,'#ui5 .sg-actions [data-act="mode:automatic"]');
   assert.equal(s?.t,'Suivre dans Orbite');
   await page.evaluate(()=>{window.__appels.length=0;});
   await page.mouse.click(s.x,s.y);await page.waitForTimeout(150);await page.mouse.click(s.x,s.y);await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-fen').dataset.activite),'orbite','le premier clic a bien changé d’onglet');
   const sous=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-act]')?.dataset.act||'',s);
   assert.deepEqual(await ordres(page),[],`${vp.width} : le second clic (tombé sur « ${sous} ») n’a donné aucun ordre`);
   await page.waitForTimeout(350);
   const p=await centre(page,'#ui5 .sg-actions [data-act="pause"]');
   assert.equal(p?.t,'Pause');
   await page.mouse.click(p.x,p.y);await page.waitForTimeout(300);
   assert.deepEqual(await ordres(page),['pause'],`${vp.width} : passé le délai, « Pause » envoie son ordre`);
   assert.deepEqual(erreurs,[]);await page.close();
  }
 }finally{await nav.close();}
});
