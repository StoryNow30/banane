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

test('molette : chaque geste règle le nombre, sans sortir de 1 à 20 ; Lancer envoie file-demarrer avec n (7, 12, 20)',{skip:absent,timeout:40000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  assert.equal(await page.getAttribute(SL,'aria-valuemax'),String(FP.MAX_PARTIES),'borne haute = MAX_PARTIES');
  assert.equal(await page.getAttribute(SL,'aria-valuemin'),'1');assert.equal(await page.getAttribute(SL,'aria-label'),'Nombre de parties');
  assert.equal(await valeur(page),2,'valeur par défaut d’aujourd’hui');
  /* « + » et « − » */
  for(let i=0;i<5;i++){await page.click('#ui5 .sg-onglet-file .sg-mol-plus');await attendre(page);}
  assert.equal(await valeur(page),7);
  assert.match(await page.textContent('#ui5 .sg-actions .sg-principal'),/Lancer la Constellation · 7 parties/);
  assert.match(await page.textContent('#ui5 .sg-constel-t .sg-chiffre'),/7 parties/,'la tuile du haut suit');
  await page.click('#ui5 .sg-actions .sg-principal');await page.waitForTimeout(400);
  let m=await messages(page);assert.deepEqual(m.map(x=>x.action),['settings','file-demarrer']);assert.equal(m[1].args.n,7);
  await poserEtat(page,FILE.prete);await page.waitForTimeout(200);
  /* clavier : Fin, Début, flèches */
  await page.focus(SL);await page.keyboard.press('End');await attendre(page);assert.equal(await valeur(page),20,'Fin');
  await page.keyboard.press('ArrowRight');await attendre(page);assert.equal(await valeur(page),20,'pas au-delà de 20');
  assert.equal(await page.isDisabled('#ui5 .sg-onglet-file .sg-mol-plus'),true,'« + » éteint à 20');
  await page.keyboard.press('Home');await attendre(page);assert.equal(await valeur(page),1,'Début');
  await page.keyboard.press('ArrowLeft');await attendre(page);assert.equal(await valeur(page),1,'pas sous 1');
  assert.equal(await page.isDisabled('#ui5 .sg-onglet-file .sg-mol-moins'),true,'« − » éteint à 1');
  for(let i=0;i<11;i++)await page.keyboard.press('ArrowRight');await attendre(page);assert.equal(await valeur(page),12,'flèches');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('role')),'slider','le focus reste sur la molette');
  await page.click('#ui5 .sg-actions .sg-principal');await page.waitForTimeout(400);
  m=await messages(page);assert.equal(m.find(x=>x.action==='file-demarrer').args.n,12);
  await poserEtat(page,FILE.prete);await page.waitForTimeout(200);
  /* molette de la souris : un cran = un pas, la zone derrière ne défile pas */
  const box=await page.locator(SL).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  const zone=()=>page.evaluate(()=>document.querySelector('#ui5 .sg-page')?.scrollTop||0),z0=await zone();
  await page.mouse.wheel(0,100);await page.waitForTimeout(150);assert.equal(await valeur(page),13,'un cran vers le bas = +1');
  await page.mouse.wheel(0,-100);await page.waitForTimeout(150);assert.equal(await valeur(page),12,'un cran vers le haut = −1');
  for(let i=0;i<15;i++){await page.mouse.wheel(0,100);await page.waitForTimeout(40);}
  await page.waitForTimeout(150);assert.equal(await valeur(page),20,'la molette ne passe pas 20');
  assert.equal(await zone(),z0,'la zone derrière n’a pas défilé');
  /* glisser : vers la gauche fait monter, accroche sur le plus proche */
  for(let i=0;i<10;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(40);}
  await page.waitForTimeout(150);assert.equal(await valeur(page),10);
  const cell=await page.evaluate(()=>document.querySelector('#ui5 .sg-onglet-file .sg-mol-n').getBoundingClientRect().width);
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();
  for(let i=1;i<=10;i++)await page.mouse.move(cx-i*cell*0.32,cy);
  await page.mouse.up();await page.waitForTimeout(200);
  assert.equal(await valeur(page),13,'glisser de 3,2 cases à gauche : 13 (accroche)');
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+cell*40,cy,{steps:8});await page.mouse.up();await page.waitForTimeout(200);
  assert.equal(await valeur(page),1,'glisser loin à droite : borné à 1');
  /* clic sur un voisin, puis 20 et Lancer */
  await page.click('#ui5 .sg-onglet-file [data-act="sg:file-n:2"]');await attendre(page);assert.equal(await valeur(page),2,'clic sur un voisin');
  await page.focus(SL);await page.keyboard.press('End');await attendre(page);
  await page.click('#ui5 .sg-actions .sg-principal');await page.waitForTimeout(400);
  m=await messages(page);assert.equal(m.find(x=>x.action==='file-demarrer').args.n,20);
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

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

const plan=n=>[...Array(n)].map((_,i)=>101+i);
const LOTN=n=>({...FILE.lot,fileParties:{...FILE.lot.fileParties,n,plan:plan(n),rang:Math.min(n-1,6),enCours:{part:101+Math.min(n-1,6),rang:Math.min(n-1,6),lot:true}}});
test('chaîne des parties à 9, 12 et 20, prête et en cours, à 600, 360 et 320 : rien ne déborde ni ne se tronque',{skip:absent,timeout:60000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 const fautes=[];
 try{
  const {page,erreurs}=await monter(nav,FILE.prete);
  await page.click('#ui5 .sg-bascule [data-act="sg:onglet-file"]');await page.waitForTimeout(200);
  for(const n of [9,12,20])for(const cas of ['prete','cours']){
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
