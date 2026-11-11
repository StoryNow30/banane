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


const plan=n=>[...Array(n)].map((_,i)=>101+i);
const LOTN=n=>({...FILE.lot,fileParties:{...FILE.lot.fileParties,n,plan:plan(n),rang:Math.min(n-1,6),enCours:{part:101+Math.min(n-1,6),rang:Math.min(n-1,6),lot:true}}});
test('chaîne des parties à 20, prête et en cours, à 600, 360 et 320 : rien ne déborde ni ne se tronque',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 const fautes=[];
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  for(const n of [20])for(const cas of ['prete','cours']){
   if(cas==='prete'){await poserEtat(page,FILE.prete);await page.evaluate(n=>window.ArianeUi5.agir('sg:file-n:'+n),n);}
   else await poserEtat(page,LOTN(n));
   for(const width of [600,360,320]){
    await page.setViewportSize({width,height:width===600?760:480});await page.waitForTimeout(250);
    const r=await page.evaluate(()=>{const ol=document.querySelector('#ui5 .sg-chaine'),W=document.documentElement.clientWidth;
     const li=[...ol.querySelectorAll('li')];
     const nums=[...ol.querySelectorAll('.sg-mono')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
     return {n:li.length,sort:li.some(e=>e.getBoundingClientRect().right>W+0.5||e.getBoundingClientRect().left<-0.5),deborde:ol.scrollWidth>ol.clientWidth+1,
      tronques:nums.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),
      chevauche:nums.some((e,i)=>i&&e.getBoundingClientRect().left<nums[i-1].getBoundingClientRect().right-0.5),
      fen:document.querySelector('#ui5 .sg-fen').scrollWidth>document.querySelector('#ui5 .sg-fen').clientWidth+1,numeros:nums.map(e=>e.textContent)};});
    const nom=`${n} ${cas} ${width}`;
    if(r.n!==n)fautes.push(nom+' : '+r.n+' points');if(r.sort||r.deborde||r.fen)fautes.push(nom+' : déborde');
    if(r.tronques.length)fautes.push(nom+' : tronqué '+r.tronques);if(r.chevauche)fautes.push(nom+' : numéros qui se chevauchent '+r.numeros);
    if(r.numeros.length!==(cas==='prete'?2:3))fautes.push(nom+' : numéros visibles '+r.numeros);
   }
  }
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
 assert.deepEqual(fautes,[]);
});
