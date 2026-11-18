'use strict';
/* CH-134 (D-368) — LA DIRECTION A « INSTRUMENT » DANS LE VRAI PANNEAU ET LA VUE « FIL » DU LOT, DANS UN VRAI NAVIGATEUR (ignoré, et dit ignoré, sans Chromium).
 *  - Allure A par défaut, à 600 px : un grand anneau centré (210 px), une seule action pleine (44 px, toute la largeur), les autres en liens
 *    discrets ; pas de carte sous la tuile d'état ; la trace des cuts derrière « Détails » ;
 *  - le bouton « Vue fil » bascule sans recharger : `data-vue="fil"` sur la fenêtre, le fil des cuts à l'écran (le plus récent en haut), les
 *    actions collées en bas ; le choix est gardé dans chrome.storage.local (`banane51VueLot`), relu à l'ouverture ; aucun message nouveau ;
 *  - retour à « Vue instrument ».
 * Montage : tests/helpers/signal-navigateur.cjs. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');

test('allure A par défaut à 600 px : grand anneau centré, une action pleine, secondaires en liens, pas de carte, trace derrière « Détails »',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,SC.lot,{width:600,height:760});await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const q=s=>document.querySelector(s),cs=e=>getComputedStyle(e),an=q('#ui5 .sg-tu-etat .sg-anneau'),t=q('#ui5 .sg-tu-etat'),A=q('#ui5 .sg-actions'),p=q('#ui5 .sg-actions>.sg-principal'),s2=q('#ui5 .sg-actions>.sg-secondaire');
   const ra=an.getBoundingClientRect(),rt=t.getBoundingClientRect(),rp=p.getBoundingClientRect(),rA=A.getBoundingClientRect(),fil=q('#ui5 .sg-tu-fil');
   return {anneau:Math.round(ra.width),centre:Math.abs((ra.left+ra.right)/2-(rt.left+rt.right)/2),fond:cs(t).backgroundColor,ombre:cs(t).boxShadow,
    pleine:Math.round(rp.height),largeur:rp.width/(rA.width-parseFloat(cs(A).paddingLeft)-parseFloat(cs(A).paddingRight)),lien:s2?cs(s2).textDecorationLine:'',
    trace:fil?cs(fil).display:'absente',vue:q('#ui5 .sg-fen').dataset.vue||''};});
  assert.equal(r.anneau,210);assert.ok(r.centre<2,`anneau centré (${r.centre})`);
  assert.equal(r.fond,'rgba(0, 0, 0, 0)');assert.equal(r.ombre,'none');
  assert.equal(r.pleine,44);assert.ok(r.largeur>0.98,`action pleine sur toute la largeur (${r.largeur})`);assert.equal(r.lien,'underline');
  assert.equal(r.trace,'none');assert.equal(r.vue,'');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('« Vue fil » : bascule sans recharger, fil à l’écran, actions en bas, choix gardé et relu, aucun message nouveau ; retour « Vue instrument »',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,SC.lot,{width:600,height:760});await page.waitForTimeout(400);
  const appels=await page.evaluate(()=>[...new Set(window.__appels)]);
  const b=page.locator('#ui5 [data-act="sg:vue-lot"]');
  assert.equal(await b.getAttribute('aria-label'),'Vue fil');
  await page.evaluate(()=>{window.__marque=1;});await b.click();await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const q=s=>document.querySelector(s),fen=q('#ui5 .sg-fen'),fil=q('#ui5 .sg-tu-fil'),li=[...document.querySelectorAll('#ui5 .sg-tu-fil .sg-fil li')],A=q('#ui5 .sg-actions').getBoundingClientRect();
   return {vue:fen.dataset.vue,marque:window.__marque,fil:fil?getComputedStyle(fil).display:'absente',lignes:li.filter(x=>x.getBoundingClientRect().height>=20).length,cuts:li.map(x=>+x.dataset.k.slice(1)),
    bas:Math.round(innerHeight-A.bottom),label:q('#ui5 [data-act="sg:vue-lot"]').getAttribute('aria-label'),garde:window.__ecrits.some(o=>o.banane51VueLot==='fil')};});
  assert.equal(r.vue,'fil');assert.equal(r.marque,1,'sans recharger');assert.notEqual(r.fil,'none');assert.ok(r.lignes>=5,`des lignes lisibles (${r.lignes})`);
  assert.deepEqual(r.cuts,[...r.cuts].sort((x,y)=>y-x),'le plus récent en haut');assert.ok(r.bas<=1,`actions collées en bas (${r.bas})`);
  assert.equal(r.label,'Vue instrument');assert.ok(r.garde,'gardé dans chrome.storage.local');
  assert.deepEqual(await page.evaluate(a=>[...new Set(window.__appels)].filter(x=>!a.includes(x)),appels),[],'aucune sorte de message nouvelle');
  /* relu à l'ouverture : le stockage simulé est vidé au rechargement, on le remplit avant */
  await page.addInitScript(()=>{const g=window.chrome.storage.local.get;window.chrome.storage.local.get=async k=>({...(await g(k)),banane51VueLot:'fil'});});
  await page.reload();await page.waitForTimeout(900);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-fen').dataset.vue),'fil','relu à l’ouverture');
  await page.click('#ui5 [data-act="sg:vue-lot"]');await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.querySelector('#ui5 .sg-fen').dataset.vue||''),'','retour à la vue instrument');
  assert.ok(await page.evaluate(()=>window.__ecrits.some(o=>o.banane51VueLot==='instrument')));
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
