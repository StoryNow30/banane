'use strict';
/* UI 5.0 « Signal » (D-250) DANS UN VRAI NAVIGATEUR, en compact 360 × 480 : Signal au départ, aucune erreur, rien qui déborde (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage : tests/helpers/signal-navigateur.cjs.
 * Captures dans le dossier de SIGNAL_CAPTURES s'il est donné. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {CHROMIUM,PW,absent,N,CAPTURES,SC,ouvrir}=require('./helpers/signal-navigateur.cjs');

test('Signal au départ, en compact 360 × 480 : aucune erreur, panneau d’avant caché, sombre, rien qui déborde',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM}),res={};
 if(CAPTURES)fs.mkdirSync(CAPTURES,{recursive:true});
 try{
  for(const [taille,vue] of [['compact',{width:360,height:480}]])for(const [nom,state] of Object.entries(SC)){
   const {page,erreurs}=await ouvrir(nav,state,vue,nom==='echo'?'#native':'#automatic');
   if(nom==='fin'){await page.click('#ui5 .sg-poignee');await page.waitForTimeout(400);}
   if(CAPTURES)await page.screenshot({path:path.join(CAPTURES,`signal-${taille}-${nom}.png`)});
   res[`${taille}/${nom}`]={erreurs,...await page.evaluate(()=>{const h=document.getElementById('ui5'),f=h?.querySelector('.sg-fen');
    return {classe:h?.className,taille:h?.dataset.taille,theme:h?.dataset.theme,main:getComputedStyle(document.querySelector('main')).display,mot:f?.querySelector('.sg-mot')?.textContent,
     deborde:f?f.scrollWidth>f.clientWidth+1:true,principaux:f?.querySelectorAll('.sg-principal').length,police:getComputedStyle(f.querySelector('.sg-mot')).fontFamily};})};
   await page.close();
  }
 }finally{await nav.close();}
 for(const [k,r] of Object.entries(res)){
  assert.deepEqual(r.erreurs,[],k);assert.equal(r.classe,'u-signal',k);assert.equal(r.main,'none',k+' : le panneau d’avant est caché');
  assert.equal(r.taille,k.split('/')[0],k);assert.equal(r.theme,'sombre',k+' : sombre par défaut');assert.equal(r.deborde,false,k+' : rien ne déborde');
  assert.ok(r.principaux<=1,k+' : une action principale au plus');assert.match(r.police,/IBM Plex Sans/,k);
 }
 assert.equal(res['compact/lot'].mot,'En cours');assert.equal(res['compact/fin'].mot,'Terminé');
});

