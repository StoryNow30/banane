'use strict';
/* CH-104 — LE MOUVEMENT DU PANNEAU GRAPHITE, DANS UN VRAI NAVIGATEUR (ignoré, et dit ignoré, sans Chromium). Demande de l'intégrateur du 11/11 :
 *  - l'anneau GLISSE d'une valeur à l'autre (transition de `stroke-dasharray` sur le même `<circle>`, seule exception écrite à « déplacements et opacités ») ;
 *  - la chaîne de la Constellation : quand une partie se termine, le trait vers la suivante se remplit (`transform`), la coche se pose, le cercle entre ;
 *  - les étapes du lot : la coche se pose, le trait se remplit ;
 *  - rien de tout cela sous « réduire les animations ».
 * Montage : tests/helpers/signal-navigateur.cjs ; états fabriqués de chantiers/CH-104/outils/capturer.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {E}=require('../chantiers/CH-104/outils/capturer.cjs');
const js=x=>JSON.parse(JSON.stringify(x));
/* Les animations en cours dans #ui5 : élément (ou pseudo-élément), nom ou propriété. */
const ANIMS=()=>document.getAnimations().filter(a=>document.getElementById('ui5').contains(a.effect?.target)).map(a=>({sur:(a.effect.target.getAttribute('class')||a.effect.target.tagName.toLowerCase())+(a.effect.pseudoElement||''),
 partie:a.effect.target.closest('[data-partie]')?.dataset.partie||'',nom:a.animationName||'',prop:a.transitionProperty||'',duree:a.effect.getTiming().duration}));
const rattrapage=n=>{const s=js(E.rattrapage.state);s.passeDifferes.ecrites=n;return s;};
const P=(part,rang)=>({part,rang,issueLot:'fin',motifs:['fin-normale'],resume:{poses:80+rang,differes:4},passe:null,relecture:{issue:'finie',corriges:2},alertes:[]});
const file=rang=>({current:{identity:{part:13+rang,cut:0}},busy:false,manual:{status:'IDLE'},native:{status:'IDLE',visits:[],incomplete:[]},batch:null,
 fileParties:{id:'file-1',etat:'relecture',n:5,plan:[13,14,15,16,17],rang,enCours:{part:13+rang,rang,lot:true},changement:null,bilan:Array.from({length:rang},(_,i)=>P(13+i,i)),motifFin:null,alerte:null,reprises:0}});

test('l’anneau glisse : même cercle, transition de stroke-dasharray, 0,6 à 0,8 s ; rien sous « réduire les animations »',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  for(const calme of [false,true]){
   const {page,erreurs}=await ouvrir(nav,rattrapage(1),{width:600,height:760});
   if(calme)await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForTimeout(700);
   const avant=await page.evaluate(()=>{window.__arc=document.querySelector('#ui5 .sg-tu-etat .sg-arc');return {trace:window.__arc.getAttribute('stroke-dasharray'),pct:document.querySelector('#ui5 .sg-anneau .sg-chiffre').textContent};});
   assert.equal(avant.pct,'33');
   await page.evaluate(s=>{window.__etat={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...s};},rattrapage(2));
   await page.waitForFunction(t=>document.querySelector('#ui5 .sg-tu-etat .sg-arc').getAttribute('stroke-dasharray')!==t,avant.trace,{timeout:4000});
   const etat=await page.evaluate(`(()=>{const A=${ANIMS.toString()};return {meme:window.__arc===document.querySelector('#ui5 .sg-tu-etat .sg-arc'),pct:document.querySelector('#ui5 .sg-anneau .sg-chiffre').textContent,anims:A().filter(a=>/sg-arc/.test(a.sur))};})()`);
   assert.equal(etat.meme,true,'le morph garde le même <circle> : sans cela rien ne glisse');
   assert.equal(etat.pct,'67');
   if(calme)assert.deepEqual(etat.anims,[],'« réduire les animations » : l’anneau ne glisse pas');
   else{assert.equal(etat.anims.length,1,'une transition, sur l’arc : '+JSON.stringify(etat.anims));assert.equal(etat.anims[0].prop,'stroke-dasharray');assert.ok(etat.anims[0].duree>=600&&etat.anims[0].duree<=800,'durée '+etat.anims[0].duree);}
   assert.deepEqual(erreurs,[]);await page.close();
  }
 }finally{await nav.close();}
});

test('Constellation, partie suivante : mêmes points, le trait se remplit (transform), la coche se pose, le cercle entre ; rien sous « réduire les animations »',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  for(const calme of [false,true]){
   const {page,erreurs}=await ouvrir(nav,file(1),{width:600,height:760});
   if(calme)await page.emulateMedia({reducedMotion:'reduce'});
   await page.evaluate(()=>window.ArianeUi5.agir('sg:onglet-file'));await page.waitForTimeout(900);
   const avant=await page.evaluate(()=>{window.__li=[...document.querySelectorAll('#ui5 .sg-chaine li')];return window.__li.map(x=>x.dataset.etat+':'+x.dataset.partie);});
   assert.deepEqual(avant,['faite:13','en-cours:14','a-venir:15','a-venir:16','a-venir:17']);
   await page.evaluate(s=>{window.__etat={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...s};},file(2));
   await page.waitForFunction(()=>document.querySelector('#ui5 .sg-chaine li[data-partie="15"]')?.dataset.etat==='en-cours',null,{timeout:4000});
   const r=await page.evaluate(`(()=>{const A=${ANIMS.toString()};const L=[...document.querySelectorAll('#ui5 .sg-chaine li')];return {memes:L.every((x,i)=>x===window.__li[i]),etats:L.map(x=>x.dataset.etat+':'+x.dataset.partie),
    anims:A().filter(a=>a.partie&&!/sg-pouls/.test(a.nom)).map(a=>a.partie+' '+a.sur.replace(/^.*?(::|$)/,'$1')+' '+(a.nom||a.prop)).sort()};})()`);
   assert.equal(r.memes,true,'les points de la chaîne restent les mêmes éléments');
   assert.deepEqual(r.etats,['faite:13','faite:14','en-cours:15','a-venir:16','a-venir:17']);
   if(calme)assert.deepEqual(r.anims,[]);
   else assert.deepEqual(r.anims,['14 ::after sg-coche','15 ::after transform','15 ::before sg-pose'],'coche de la partie faite, trait vers la suivante, cercle de la partie en cours');
   assert.deepEqual(erreurs,[]);await page.close();
  }
 }finally{await nav.close();}
});

test('étapes du lot : de la pose au rattrapage, la coche se pose et le trait se remplit ; seules des propriétés permises sont animées',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,js(E.cours.state),{width:600,height:760});await page.waitForTimeout(800);
  /* CH-115 (D-353) : les étapes du lot sont repliées par défaut ; le geste « Détails » de la tuile les ouvre (une animation ne joue pas sur un élément caché) */
  await page.click('#ui5 [data-act="sg:details"]');await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#ui5 .sg-zone:not(.sg-sort) .sg-etapes li')].map(x=>x.dataset.etape)),['actif','a-venir','a-venir']);
  await page.evaluate(s=>{window.__etat={connection:{status:'ready',observedAt:'t',message:null,tabId:1},...s};},rattrapage(1));
  await page.waitForFunction(()=>document.querySelector('#ui5 .sg-zone:not(.sg-sort) .sg-etapes li')?.dataset.etape==='fait',null,{timeout:4000});
  const r=await page.evaluate(`(()=>{const A=${ANIMS.toString()};const tout=A();return {etapes:[...document.querySelectorAll('#ui5 .sg-zone:not(.sg-sort) .sg-etapes li')].map(x=>x.dataset.etape),
   coche:tout.some(a=>a.nom==='sg-coche'&&/::after$/.test(a.sur)),trait:tout.some(a=>a.prop==='transform'&&/::after$/.test(a.sur)),
   interdites:document.getAnimations().filter(a=>document.getElementById('ui5').contains(a.effect?.target)).flatMap(a=>a.effect.getKeyframes().flatMap(k=>Object.keys(k))).filter(k=>!['offset','easing','composite','computedOffset','transform','opacity','color','strokeDasharray'].includes(k))};})()`);
  assert.deepEqual(r.etapes,['fait','actif','a-venir']);
  assert.equal(r.coche,true,'la coche de la pose se pose');
  assert.equal(r.trait,true,'le trait vers le rattrapage se remplit');
  assert.deepEqual([...new Set(r.interdites)],[],'rien d’autre que transform, opacity, color et le tracé de l’anneau n’est animé');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
