'use strict';
/* UI 5.0 « Signal » DANS UN VRAI NAVIGATEUR, le mouvement (retour de la test 21) : l'écran est mis à jour EN PLACE à chaque rendu du panneau.
 * Le curseur du rail reste le même élément et glisse (sa position change, sa transition se joue) ; un nouveau différé entre seul ; une couche
 * ouverte (palette) ne rejoue pas son entrée ; le chiffre qui change le signale une fois (classe posée le temps de l'animation). Montage : tests/helpers/signal-navigateur.cjs. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,N,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');
const lot=n=>N.lot('RUNNING',{processed:Array.from({length:n},(_,i)=>({identity:{part:13,cut:4790+i},cut:4790+i,durationMs:6000+i*100})),deferred:[4796,4803].map(c=>({identity:{part:13,cut:c},cut:c})),cutStartedAt:new Date().toISOString()});
test('mise à jour en place : le curseur glisse, un nouveau différé entre, la palette ne rejoue pas son entrée',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,lot(10),{width:600,height:760});
  await page.evaluate(()=>{window.__cur=document.querySelector('#ui5 .sg-rail-cur');window.__inst=document.querySelector('#ui5 .sg-instrument');window.__left=window.__cur?.style.left;
   new MutationObserver(()=>{if(document.querySelector('#ui5 .sg-chiffre.sg-tic'))window.__tic=true;}).observe(document.getElementById('ui5'),{subtree:true,attributes:true,attributeFilter:['class']});});
  const s2=lot(14);s2.batch.deferred.push({identity:{part:13,cut:4809},cut:4809});
  await page.evaluate(e=>{window.__etat=e;},s2);await page.waitForTimeout(1600);
  const r=await page.evaluate(()=>({memeCurseur:window.__cur===document.querySelector('#ui5 .sg-rail-cur'),memeInstrument:window.__inst===document.querySelector('#ui5 .sg-instrument'),
   bouge:window.__left!==document.querySelector('#ui5 .sg-rail-cur')?.style.left,transition:getComputedStyle(document.querySelector('#ui5 .sg-rail-cur')).transitionProperty,
   tic:!!window.__tic}));
  assert.deepEqual(r,{memeCurseur:true,memeInstrument:true,bouge:true,transition:'left, background',tic:true});
  await page.keyboard.press('Control+k');await page.waitForTimeout(300);
  await page.evaluate(()=>{window.__pal=document.querySelector('#ui5 .sg-palette');});await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>window.__pal===document.querySelector('#ui5 .sg-palette')),true,'la palette n’est pas recréée à chaque rendu');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ui5-q','le champ garde la main');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
