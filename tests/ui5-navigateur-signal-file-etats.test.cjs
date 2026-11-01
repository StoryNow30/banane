'use strict';
/* CH-025 — LA FILE DE PARTIES DANS SIGNAL, DANS UN VRAI NAVIGATEUR, les états avant et pendant la file : prête, préparée (boîte ouverte), lot, deuxième
 * passe, relecture et correction ; de 360 à 600 de large, sombre puis clair : aucune erreur, rien qui déborde, contraste d'au moins 4,5:1 (ignoré s'il
 * n'y a pas de Chromium, et dit ignoré). Montage : tests/helpers/signal-navigateur.cjs, tests/helpers/signal-file.cjs. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {FILE,parLargeurs,poserEtat,verifier}=require('./helpers/signal-file.cjs');

test('file prête, préparée, puis lot, deuxième passe, relecture : l’entrée, la boîte, le bandeau et « Arrêter la file », sans débordement ni contraste faible',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM}),res={};
 try{
  const {page,erreurs}=await ouvrir(nav,FILE.prete,{width:600,height:760});
  res.prete=await parLargeurs(page);
  await page.click('#ui5 [data-act="sg:file"]');await page.waitForTimeout(200);
  await page.click('#ui5 .sg-boite [data-act="legacy:file-principal"]');await page.waitForTimeout(400);
  res.preparee=await parLargeurs(page,{boite:true});
  await page.click('#ui5 .sg-boite [data-act="sg:fermer"]');await page.waitForTimeout(150);
  for(const nom of ['lot','passe','relecture']){await poserEtat(page,FILE[nom]);res[nom]=await parLargeurs(page);}
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
 for(const [nom,r] of Object.entries(res))verifier(assert,nom,r);
 assert.equal(res.prete['600'].mot,'Prêt');assert.match(res.prete['600'].principal,/Démarrer le lot/);assert.equal(res.prete['600'].file,false);
 assert.equal(res.preparee['360'].boite,true);assert.equal(res.preparee.clair.theme,'clair');
 for(const nom of ['lot','passe','relecture'])for(const k of ['600','360']){assert.equal(res[nom][k].file,true,nom);assert.equal(res[nom][k].arreter,true,nom);assert.equal(res[nom][k].depart,false,nom+' : ni « Démarrer » ni « Nouveau lot »');}
 assert.equal(res.lot['600'].mot,'En cours');assert.equal(res.passe['600'].mot,'Rattrapage');
});
