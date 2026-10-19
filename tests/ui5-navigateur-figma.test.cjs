'use strict';
/* (Un fichier par présentation : chacun doit tenir dans les 20 secondes que verify laisse à un fichier d'essais.)
 * 4.9.5 test 10-ui — L'HABILLAGE DANS UN VRAI NAVIGATEUR (Chromium fourni par l'environnement ; ignoré s'il est absent, et dit ignoré, pas réussi).
 * panel.html est chargé depuis le disque avec une API Chrome simulée qui répond `view` par un état fabriqué ; rien n'est envoyé à ESV.
 *  1. aucune erreur de page, pour les trois présentations, au repos, en lot, en incident, en Écho et à l'accueil ;
 *  2. un clic sur le bouton principal de l'habillage envoie au service worker EXACTEMENT les mêmes messages que le clic sur le bouton d'origine (« Pause », puis l'export complet). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const CHROMIUM=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',PW=process.env.PLAYWRIGHT_PATH||'/opt/node-tools/node_modules/playwright';
const absent=!fs.existsSync(CHROMIUM)||!fs.existsSync(PW)?'Chromium ou Playwright absent : essai de navigateur ignoré':false;
const N=require('../tools/ui5-navigateur.cjs');
const v=process.env.UI5_VARIANTE||path.basename(__filename).match(/ui5-navigateur-(\w+)\.test/)?.[1];
test(`${v} : aucune erreur de page sur les états du panneau, un clic sur l’habillage clique le bon bouton`,{skip:absent,timeout:60000},async()=>{
 const sortie=fs.mkdtempSync(path.join(os.tmpdir(),'ui5-nav-'));
 try{const r=await N.lancer(sortie,[v]);
  assert.deepEqual(r.erreurs,[]);
  assert.equal(r.resultat[`${v}/lot`].ui5,true);assert.ok(r.resultat[`${v}/lot`].taille>500);
  assert.ok(r.resultat[`${v}/clic-principal`].appels.includes('pause'),`le clic sur « ${r.resultat[`${v}/clic-principal`].texte} » doit envoyer « pause »`);
  assert.ok(r.resultat[`${v}/reglages`].listes>=5);
 }finally{fs.rmSync(sortie,{recursive:true,force:true});}
});
test(`${v} : mêmes messages au service worker par l’habillage et par le bouton d’origine (pause, puis export complet d’un lot fini)`,{skip:absent,timeout:60000},async()=>{
 const sel=v==='raycast'?'#ui5 .o.s':'#ui5 .btn.p';
 const [pause,exp]=await N.comparerClics(v,[{etat:N.lot('RUNNING'),idLegacy:'pause',selecteur:sel},{etat:N.lot('COMPLETED',{stoppedAtEnd:null}),idLegacy:'export-tout',selecteur:sel}]);
 assert.deepEqual(pause.habillage,pause.origine,'pause');assert.ok(pause.origine.includes('pause'));
 assert.ok(exp.origine.length>0,'l’export d’origine parle au service worker');assert.deepEqual(exp.habillage,exp.origine,'export');
});
