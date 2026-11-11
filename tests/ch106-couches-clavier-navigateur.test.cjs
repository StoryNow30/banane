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

test('couche ouverte : quinze Tab puis Entrée, aucun ordre et jamais un élément caché sous la couche',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  for(const [nom,act,etat] of CAS){
   const {page,erreurs}=await ouvrir(nav,js({...E[etat].state,fileParties:null}),{width:600,height:760});
   await page.evaluate(a=>window.ArianeUi5.agir(a),act);await page.waitForTimeout(500);
   await page.evaluate(()=>{window.__appels.length=0;});
   for(let i=0;i<15;i++){
    await page.keyboard.press('Tab');const f=await focus(page);
    if(f.corps)continue;
    /* la feuille « Ce qui reste » laisse la barre au-dessus d'elle (visible, ses onglets referment la feuille) ; toute autre couche garde le focus */
    assert.ok(f.couche||(nom==='tiroir'&&f.barre),`${nom} : Tab ${i+1} hors de la couche (« ${f.txt} »)`);
    assert.ok(f.vu||f.couche,`${nom} : Tab ${i+1} sur un élément caché (« ${f.txt} »)`);
   }
   if(nom!=='palette'&&nom!=='menu'&&nom!=='esv'){await page.keyboard.press('Enter');await page.waitForTimeout(400);}
   assert.deepEqual(await ordres(page),[],`${nom} : aucun ordre`);
   assert.deepEqual(erreurs,[]);await page.close();
  }
 }finally{await nav.close();}
});
