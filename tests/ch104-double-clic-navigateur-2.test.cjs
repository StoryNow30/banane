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


test('ouvrir puis fermer « Ce qui reste », changer d’onglet : un second clic au même endroit ne donne aucun ordre',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  for(const vp of [{width:600,height:760},{width:360,height:480}]){
  const {page,erreurs}=await ouvrir(nav,js(E.fin.state),vp);await page.waitForTimeout(500);
  await page.evaluate(()=>{window.__appels.length=0;});
  /* « Voir ce qui reste » (bouton plein du pied) ouvre la feuille ; la ligne « à poser » aussi ; le second clic tombe sur la feuille */
  for(const sel of ['#ui5 .sg-actions [data-act="sg:tiroir"]','#ui5 .sg-poignee']){
   const b=await centre(page,sel);assert.ok(b,sel);
   await page.mouse.click(b.x,b.y);await page.waitForTimeout(150);await page.mouse.click(b.x,b.y);await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-tiroir').dataset.ouvert),'1',sel+' : la feuille reste ouverte');
   const ex=await page.evaluate(()=>document.querySelectorAll('#ui5 .sg-examine').length);assert.equal(ex,0,sel+' : aucune ligne marquée examinée par le second clic');
   await page.keyboard.press('Escape');await page.waitForTimeout(500);
  }
  /* changement d'onglet par la barre, puis second clic au même endroit (la barre) : aucun ordre */
  const o=await centre(page,'#ui5 .sg-bascule [data-act="sg:onglet-correction"]');
  await page.mouse.click(o.x,o.y);await page.waitForTimeout(150);await page.mouse.click(o.x,o.y);await page.waitForTimeout(300);
  assert.deepEqual(await ordres(page),[],'aucun ordre sur tout le parcours');
  /* passé le délai, le pied répond : le clic sur « Nouveau lot » atteint le bouton d'origine `#new-batch` (une fois) */
  await page.evaluate(()=>window.ArianeUi5.agir('mode:automatic'));await page.waitForTimeout(600);
  await page.evaluate(()=>{window.__nb=0;document.getElementById('new-batch').addEventListener('click',()=>{window.__nb++;},true);});
  const n=await centre(page,'#ui5 .sg-actions [data-act="legacy:new-batch"]');assert.equal(n?.t,'Nouveau lot');
  await page.mouse.click(n.x,n.y);await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>window.__nb),1,'« Nouveau lot » répond');
  assert.deepEqual(erreurs,[]);await page.close();
  }
 }finally{await nav.close();}
});
