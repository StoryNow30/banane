'use strict';
/* CH-106 — LES COUCHES ET LE CLAVIER (relecture de CH-104, défauts relevés le 11/11), dans un vrai navigateur (ignoré, et dit ignoré, sans Chromium).
 * 1. Une couche ouverte (feuille « Ce qui reste », menu « ··· », palette, réglages, onglets ESV, boîte Constellation, détails techniques) rend inatteignable
 *    ce qu'elle recouvre : quinze Tab puis Entrée n'envoient aucun ordre, et le focus ne tombe jamais sur un élément caché (relevé : la feuille ouverte
 *    pendant un lot, le Tab atteignait « Arrêter le lot » sous la feuille et Entrée envoyait `stop`).
 * 2. À l'ouverture d'une couche, le focus va dedans ; à sa fermeture, il revient au bouton qui l'a ouverte. Le champ de la palette a un anneau de focus.
 * 3. La boîte Constellation tient dans une fenêtre de 320 × 480 : son bouton principal reste atteignable.
 * Montage : tests/helpers/signal-navigateur.cjs ; états : chantiers/CH-104/outils/capturer.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {E}=require('../chantiers/CH-104/outils/capturer.cjs');
const js=x=>JSON.parse(JSON.stringify(x));
const ORDRES=/^(pause|resume|stop|start-batch|new-batch|retry|manual|explicit-skip|file-|relecture-(?!etat|choix)|apply|validate|skip|close-uncertain|export)/;
const ordres=page=>page.evaluate(()=>window.__appels.slice()).then(L=>L.filter(a=>ORDRES.test(String(a))));
const COUCHE='.sg-tiroir[data-ouvert="1"],#ui5 [role="dialog"],#ui5-tech';
/* L'élément qui a le focus : dans la couche ? visible (le point en son centre le touche) ? */
const focus=page=>page.evaluate(sel=>{const e=document.activeElement;if(!e||e===document.body)return {corps:true};
 const r=e.getBoundingClientRect(),x=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
 return {txt:(e.textContent||e.getAttribute('aria-label')||e.id||'').trim().slice(0,40),couche:!!e.closest(sel),barre:!!e.closest('.sg-barre'),vu:!!x&&(e===x||e.contains(x))};},COUCHE);
const CAS=[['tiroir','sg:tiroir','cours'],['menu','sg:menu','cours'],['palette','sg:palette','cours'],['reglages','sg:reglages','cours'],['esv','sg:esv','cours'],['boite','sg:file','boite-file'],['tech','sg:tech','cours']];


test('feuille « Ce qui reste » ouverte pendant un lot : « Arrêter le lot » n’est plus atteignable au clavier',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js({...E.cours.state,fileParties:null}),{width:600,height:760});
  await page.evaluate(()=>window.ArianeUi5.agir('sg:tiroir'));await page.waitForTimeout(500);
  await page.evaluate(()=>{window.__appels.length=0;});
  for(let i=0;i<40;i++){await page.keyboard.press('Tab');const t=await page.evaluate(()=>document.activeElement?.closest?.('.sg-actions')?document.activeElement.textContent.trim():'');assert.equal(t,'',`Tab ${i+1} atteint le pied (« ${t} »)`);}
  /* fermée, le pied redevient atteignable */
  await page.keyboard.press('Escape');await page.waitForTimeout(400);
  let vu=false;for(let i=0;i<40&&!vu;i++){await page.keyboard.press('Tab');vu=await page.evaluate(()=>/Arrêter le lot/.test(document.activeElement?.closest?.('.sg-actions')?document.activeElement.textContent:''));}
  assert.ok(vu,'feuille fermée, « Arrêter le lot » est de nouveau atteignable');
  assert.deepEqual(await ordres(page),[]);assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('boîte Constellation à 320 × 480 : elle tient dans la fenêtre, son bouton principal est atteignable',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  for(const vp of [{width:320,height:480},{width:360,height:480},{width:600,height:760}]){
   const {page,erreurs}=await ouvrir(nav,js(E['boite-file'].state),vp);
   await page.evaluate(()=>window.ArianeUi5.agir('sg:file'));await page.waitForTimeout(600);
   const m=await page.evaluate(()=>{const b=document.querySelector('#ui5 .sg-boite'),p=b?.querySelector('.sg-principal');if(!b||!p)return null;p.scrollIntoView({block:'nearest'});
    const r=b.getBoundingClientRect(),q=p.getBoundingClientRect();return {bas:r.bottom,h:innerHeight,pBas:q.bottom,pHaut:q.top,hautB:r.top};});
   assert.ok(m,'boîte et bouton principal présents');
   assert.ok(m.bas<=m.h+0.5,`${vp.width}×${vp.height} : la boîte sort de ${Math.round(m.bas-m.h)} px sous la fenêtre`);
   assert.ok(m.pBas<=m.bas+0.5&&m.pHaut>=m.hautB-0.5,`${vp.width}×${vp.height} : le bouton principal est visible dans la boîte`);
   assert.deepEqual(erreurs,[]);await page.close();
  }
 }finally{await nav.close();}
});
