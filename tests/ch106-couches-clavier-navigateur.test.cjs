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

test('ouvrir une couche met le focus dedans ; Échap le rend au bouton qui l’a ouverte',{skip:absent,timeout:40000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js({...E.fin.state,fileParties:null}),{width:600,height:760});
  const actif=()=>page.evaluate(()=>{const e=document.activeElement;return {act:e?.dataset?.act||e?.id||e?.tagName,couche:!!e?.closest?.('.sg-tiroir[data-ouvert="1"],#ui5 [role="dialog"]')};});
  for(const [ouvreur,nom] of [['#ui5 .sg-menu-b','menu'],['#ui5 .sg-puce','esv'],['#ui5 .sg-poignee','tiroir']]){
   await page.focus(ouvreur);await page.keyboard.press('Enter');await page.waitForTimeout(500);
   assert.ok((await actif()).couche,`${nom} : le focus est dans la couche ouverte`);
   await page.keyboard.press('Escape');await page.waitForTimeout(500);
   assert.ok(await page.evaluate(s=>document.activeElement===document.querySelector(s),ouvreur),`${nom} : Échap rend le focus à son bouton (${JSON.stringify(await actif())})`);
  }
  /* menu, puis « Réglages » du menu : la feuille s'ouvre avec le focus ; Échap rend le focus à « ··· » */
  await page.focus('#ui5 .sg-menu-b');await page.keyboard.press('Enter');await page.waitForTimeout(400);
  await page.evaluate(()=>document.querySelector('#ui5 .sg-menu [data-act="sg:reglages"]').focus());await page.keyboard.press('Enter');await page.waitForTimeout(500);
  assert.ok(await page.evaluate(()=>!!document.activeElement?.closest?.('.sg-feuille')),'réglages : le focus est dans la feuille');
  await page.keyboard.press('Escape');await page.waitForTimeout(500);
  assert.ok(await page.evaluate(()=>document.activeElement===document.querySelector('#ui5 .sg-menu-b')),'réglages : Échap rend le focus à « ··· »');
  /* la palette : le champ a le focus et un anneau visible */
  await page.keyboard.press('Control+k');await page.waitForTimeout(400);
  const anneau=await page.evaluate(()=>{const q=document.getElementById('ui5-q');if(document.activeElement!==q)return 'pas de focus';const s=getComputedStyle(q);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0||s.boxShadow!=='none'?'':'aucun anneau';});
  assert.equal(anneau,'','le champ de la palette montre son focus');
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
