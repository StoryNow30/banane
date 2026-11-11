'use strict';
/* CH-104 — LA PUCE ESV DANS LA BARRE, MESURÉE DANS UN VRAI NAVIGATEUR (ignoré, et dit ignoré, sans Chromium). Relevés de l'intégrateur et de la
 * relecture critique (11/11) : avec quatre onglets et un nom d'onglet long, le bouton « ··· » sortait de 13 px à 320 de large ; à 480, en panne,
 * « ESV ne répond plus » était coupé par l'ellipse. Règle : c'est le nom de l'onglet qui cède la place (jusqu'à ne garder que la pastille), jamais le
 * bouton « ··· » ni le mot d'alerte, écrit en entier à toute largeur (dans la puce, ou sur la ligne sous la barre). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir,SC}=require('./helpers/signal-navigateur.cjs');
const LARGEURS=[[320,480],[360,480],[480,640],[560,760],[600,760]];
const LONG='Validation des rails — campagne du printemps — partie 13';
async function monter(nav,etat,titre){
 const sig=await ouvrir(nav,{...etat,fileParties:null},{width:600,height:760});
 await sig.page.addInitScript(t=>{const f=window.chrome.runtime.sendMessage;
  window.chrome.runtime.sendMessage=async m=>m.action==='list-tabs'?{result:[{id:1,title:t,pret:true,utilise:true,index:0,windowId:1,active:true}]}:f(m);},titre);
 await sig.page.reload();await sig.page.waitForTimeout(1500);
 return sig;
}
const MESURE=()=>{const f=document.querySelector('#ui5 .sg-fen'),m=f.querySelector('.sg-menu-b').getBoundingClientRect(),p=f.querySelector('.sg-puce'),b=f.querySelector('.sg-bascule').getBoundingClientRect(),pr=p.getBoundingClientRect();
 const tx=p.querySelector('.sg-tx'),l=f.querySelector('.sg-barre-etat'),lv=!!l&&l.getClientRects().length>0;
 return {deborde:f.scrollWidth-f.clientWidth,menuDroite:Math.round(m.right-innerWidth),menuLarge:Math.round(m.width),chevauche:pr.left<b.right-.5||m.left<pr.right-.5,onglets:f.querySelectorAll('.sg-bascule [role="tab"]').length,
  pastille:p.querySelector('i').getBoundingClientRect().width>0,puceEntiere:tx.scrollWidth<=tx.clientWidth+1,texte:[...tx.children].find(x=>x.getClientRects().length)?.textContent||'',
  ligne:lv?l.textContent:'',ligneEntiere:lv?l.scrollWidth<=l.clientWidth+1:false,infobulle:p.title};};

test('nom d’onglet long, quatre onglets, de 320 à 600 : rien ne sort, « ··· » reste entier, le nom cède la place',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await monter(nav,SC.lot,LONG);
  for(const [w,h] of LARGEURS){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(250);const r=await page.evaluate(MESURE);
   assert.equal(r.onglets,4,w+' : quatre onglets');
   assert.ok(r.deborde<=0,`${w} : .sg-fen ne déborde pas (${r.deborde} px)`);
   assert.ok(r.menuDroite<=0&&r.menuLarge>=26,`${w} : « ··· » entier dans la fenêtre (${r.menuDroite} px, ${r.menuLarge} de large)`);
   assert.equal(r.chevauche,false,w+' : la puce ne chevauche ni les onglets ni « ··· »');
   assert.equal(r.pastille,true,w+' : la pastille reste');
   assert.match(r.infobulle,/campagne du printemps/,w+' : le nom entier reste dans l’infobulle');}
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});

test('ESV ne répond plus, de 320 à 600 : le mot d’alerte est écrit en entier (puce ou ligne sous la barre), rien ne sort',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {page,erreurs}=await monter(nav,SC.incident,LONG);
  for(const [w,h] of LARGEURS){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(250);const r=await page.evaluate(MESURE);
   const dansPuce=r.texte==='ESV ne répond plus'&&r.puceEntiere,dansLigne=r.ligne==='ESV ne répond plus'&&r.ligneEntiere;
   assert.ok(dansPuce||dansLigne,`${w} : « ESV ne répond plus » en entier quelque part dans la barre : ${JSON.stringify(r)}`);
   assert.ok(r.deborde<=0&&r.menuDroite<=0,`${w} : rien ne sort (${r.deborde} px, « ··· » ${r.menuDroite} px)`);
   assert.equal(r.chevauche,false,w+' : pas de chevauchement');}
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
});
