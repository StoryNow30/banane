'use strict';
/* CH-025 — LA FILE DE PARTIES DANS SIGNAL, DANS UN VRAI NAVIGATEUR, les états de changement et de fin : changement de partie, file arrêtée avec alerte
 * (lot clos, puis lot encore ouvert), file finie ; de 360 à 600 de large, sombre puis clair : aucune erreur, rien qui déborde, contraste d'au moins 4,5:1
 * (ignoré s'il n'y a pas de Chromium, et dit ignoré). Montage : tests/helpers/signal-navigateur.cjs, tests/helpers/signal-file.cjs. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHROMIUM,PW,absent,ouvrir}=require('./helpers/signal-navigateur.cjs');
const {FILE,parLargeurs,poserEtat,verifier}=require('./helpers/signal-file.cjs');

test('changement de partie, arrêt avec alerte, arrêt pendant un lot ouvert, fin : l’écran de la file, l’alerte et le bilan, sans débordement ni contraste faible',{skip:absent,timeout:19000},async()=>{
 const {chromium}=require(PW),nav=await chromium.launch({executablePath:CHROMIUM}),res={};
 try{
  const {page,erreurs}=await ouvrir(nav,FILE.changement,{width:600,height:760});
  res.changement=await parLargeurs(page);
  for(const nom of ['arret','arretLotOuvert','fin']){await poserEtat(page,FILE[nom]);res[nom]=await parLargeurs(page);}
  assert.deepEqual(erreurs,[]);
 }finally{await nav.close();}
 for(const [nom,r] of Object.entries(res))verifier(assert,nom,r);
 const c=res.changement['600'];assert.equal(c.mot,'Changement de partie');assert.equal(c.arreter,true);assert.equal(c.depart,false);
 const a=res.arret['360'];assert.equal(a.mot,'File arrêtée');assert.match(a.alerte,/la page d’ESV ne change pas de partie/);assert.equal(a.bilan,1);assert.match(a.principal,/Préparer la reprise · 1 partie restante/);
 const o=res.arretLotOuvert['600'];assert.equal(o.mot,'ESV ne répond plus','le lot ouvert garde l’écran');assert.equal(o.file,true,'la file passe dans le bandeau');
 const f=res.fin['600'];assert.equal(f.mot,'File terminée');assert.equal(f.bilan,2);assert.match(f.principal,/Fermer le bilan/);
});
