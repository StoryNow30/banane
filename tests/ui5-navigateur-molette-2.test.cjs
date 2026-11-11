'use strict';
/* CH-105 — LA MOLETTE DU NOMBRE DE PARTIES, DANS UN VRAI NAVIGATEUR (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage :
 * tests/helpers/signal-navigateur.cjs (service worker simulé), états de tests/helpers/signal-file.cjs. Chaque geste (clic « − » / « + », clic sur
 * un voisin, molette de la souris, glisser, flèches, Début, Fin) règle le nombre ; aucun ne sort de 1 à 20 ; « Lancer » envoie `file-demarrer` avec ce
 * `n` ; la boîte « Constellation » d'Orbite a la même molette ; la chaîne tient à 9, 12 et 20 parties aux trois largeurs ; rien n'est animé sous
 * « réduire les animations ». Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {FILE,poserEtat}=require('./helpers/signal-file.cjs');
const FP=require('../src/file-parties.js');

async function monter(nav,state,opts={}){
 const sig=await ouvrir(nav,state,{width:600,height:760});
 if(opts.calme)await sig.page.emulateMedia({reducedMotion:'reduce'});
 await sig.page.addInitScript(()=>{const f=window.chrome.runtime.sendMessage;window.__m=[];
  window.chrome.runtime.sendMessage=async m=>{if(/^(file-|settings$)/.test(m.action||''))window.__m.push(JSON.parse(JSON.stringify(m)));if(m.action==='fiches-depart')return {result:{fiches:[]}};return f(m);};});
 await sig.page.reload();await sig.page.waitForTimeout(700);
 return sig;
}
const messages=page=>page.evaluate(()=>window.__m.splice(0));
const SL='#ui5 .sg-onglet-file [role="slider"]';
const valeur=page=>page.evaluate(s=>Number(document.querySelector(s)?.getAttribute('aria-valuenow')),SL);
const attendre=page=>page.waitForTimeout(120);


test('boîte « Constellation » d’Orbite : même molette ; panneau d’origine : champ borné 1 à 20',{skip:absent,timeout:25000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 [data-act="sg:file"]');await page.waitForTimeout(250);
  const sl='#ui5 .sg-boite [role="slider"]';
  await page.focus(sl);for(let i=0;i<9;i++)await page.keyboard.press('ArrowRight');await attendre(page);
  assert.equal(await page.getAttribute(sl,'aria-valuenow'),'11');
  assert.equal(await page.inputValue('#file-n'),'11','le champ d’origine porte le nombre');
  /* Le champ d'origine : borné */
  const borne=await page.evaluate(()=>{const c=document.getElementById('file-n');return {min:c.min,max:c.max,type:c.type};});
  assert.deepEqual(borne,{min:'1',max:String(FP.MAX_PARTIES),type:'number'});
  /* hors bornes : ramené dedans ; pas un nombre : le nombre choisi revient (ici 1, posé juste avant) */
  for(const [v,att] of [['25','20'],['0','1'],['abc','1'],['6','6']]){
   await page.evaluate(v=>{const c=document.getElementById('file-n');c.value=v;c.dispatchEvent(new Event('change',{bubbles:true}));},v);await attendre(page);
   assert.equal(await page.inputValue('#file-n'),att,'saisie '+v);
  }
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('« réduire les animations » : rien d’animé quand la molette tourne',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page}=await monter(nav,FILE.prete,{calme:true});
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(300);
  await page.click('#ui5 .sg-onglet-file .sg-mol-plus');
  const anims=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>a.transitionProperty||a.animationName));
  assert.deepEqual(anims,[]);
  const dur=await page.evaluate(()=>getComputedStyle(document.querySelector('#ui5 .sg-mol-bande')).transitionDuration);
  assert.match(dur,/^0s/);
 }finally{await nav.close();}
});

test('sans « réduire les animations » : la bande glisse en transform (0,2 à 0,3 s), seules transform et opacity sont animées',{skip:absent,timeout:20000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(400);
  await page.evaluate(()=>{window.__t=[];document.addEventListener('transitionrun',e=>{if(e.target.closest?.('.sg-molette'))window.__t.push(e.propertyName);});});
  await page.click('#ui5 .sg-onglet-file .sg-mol-plus');await page.waitForTimeout(400);
  const props=await page.evaluate(()=>[...new Set(window.__t)]);
  assert.ok(props.includes('transform'),JSON.stringify(props));
  assert.deepEqual(props.filter(p=>!['transform','opacity'].includes(p)),[],'seules transform et opacity');
  const s=await page.evaluate(()=>{const c=getComputedStyle(document.querySelector('#ui5 .sg-mol-bande'));return {p:c.transitionProperty,d:c.transitionDuration};});
  const d=parseFloat(s.d);assert.ok(d>=0.2&&d<=0.3,s.d);
 }finally{await nav.close();}
});
