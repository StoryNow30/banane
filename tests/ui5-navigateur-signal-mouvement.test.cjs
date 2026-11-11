'use strict';
/* UI 5.0 « Signal » DANS UN VRAI NAVIGATEUR, le mouvement (retour de la test 21) : l'écran est mis à jour EN PLACE à chaque rendu du panneau.
 * L'anneau (`.sg-anneau`, son `circle.sg-arc`) reste le même élément pendant que son chiffre change (CH-104 : le rail et son curseur n'existent plus ; sans total, l'arc tourne : animation `sg-tourne`) ; un nouveau différé entre seul ; une couche
 * ouverte (palette) ne rejoue pas son entrée ; le chiffre qui change le signale une fois (classe posée le temps de l'animation). Montage : tests/helpers/signal-navigateur.cjs. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,N,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');
const lot=n=>N.lot('RUNNING',{processed:Array.from({length:n},(_,i)=>({identity:{part:13,cut:4790+i},cut:4790+i,durationMs:6000+i*100})),deferred:[4796,4803].map(c=>({identity:{part:13,cut:c},cut:c})),cutStartedAt:new Date().toISOString()});
test('mise à jour en place : l’anneau reste le même et son chiffre change, un nouveau différé entre, la palette ne rejoue pas son entrée',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await ouvrir(nav,lot(10),{width:600,height:760});
  await page.evaluate(()=>{window.__cur=document.querySelector('#ui5 .sg-anneau');window.__arc=document.querySelector('#ui5 .sg-anneau .sg-arc');window.__inst=document.querySelector('#ui5 .sg-instrument');window.__chiffre=document.querySelector('#ui5 .sg-anneau .sg-chiffre').textContent;
   new MutationObserver(()=>{if(document.querySelector('#ui5 .sg-chiffre.sg-tic'))window.__tic=true;}).observe(document.getElementById('ui5'),{subtree:true,attributes:true,attributeFilter:['class']});});
  const s2=lot(14);s2.batch.deferred.push({identity:{part:13,cut:4809},cut:4809});
  await page.evaluate(e=>{window.__etat=e;},s2);await page.waitForTimeout(1600);
  const r=await page.evaluate(()=>({memeAnneau:window.__cur===document.querySelector('#ui5 .sg-anneau'),memeArc:window.__arc===document.querySelector('#ui5 .sg-anneau .sg-arc'),memeInstrument:window.__inst===document.querySelector('#ui5 .sg-instrument'),
   avant:window.__chiffre,apres:document.querySelector('#ui5 .sg-anneau .sg-chiffre').textContent,mouvement:getComputedStyle(document.querySelector('#ui5 .sg-anneau svg')).animationName,
   tic:!!window.__tic}));
  assert.deepEqual(r,{memeAnneau:true,memeArc:true,memeInstrument:true,avant:'11',apres:'15',mouvement:'sg-tourne',tic:true});
  await page.keyboard.press('Control+k');await page.waitForTimeout(300);
  await page.evaluate(()=>{window.__pal=document.querySelector('#ui5 .sg-palette');});await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>window.__pal===document.querySelector('#ui5 .sg-palette')),true,'la palette n’est pas recréée à chaque rendu');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ui5-q','le champ garde la main');
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
