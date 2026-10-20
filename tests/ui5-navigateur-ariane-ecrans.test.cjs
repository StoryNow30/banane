'use strict';
/* 4.9.6 test 1 — LA PRÉSENTATION « ARIANE » DANS UN VRAI NAVIGATEUR (Chromium fourni par l'environnement ; ignoré s'il est absent, et dit ignoré, pas réussi).
 * panel.html est chargé depuis le disque avec une API Chrome simulée qui répond `view` par un état fabriqué ; rien n'est envoyé à ESV.
 *  1. aucune erreur de page sur les cinq écrans (accueil, Orbite, Écho, Revue, Réglages), au repos, en lot, en pause, en incident et en fin de lot ;
 *     la pastille dit l'état du lot, Écho est indisponible pendant un lot ;
 *  2. un clic sur l'habillage envoie au service worker EXACTEMENT les mêmes messages que le clic sur le bouton d'origine (« Pause » de l'accueil,
 *     puis « Exporter le dossier » d'un lot fini). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const CHROMIUM=process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',PW=process.env.PLAYWRIGHT_PATH||'/opt/node-tools/node_modules/playwright';
const absent=!fs.existsSync(CHROMIUM)||!fs.existsSync(PW)?'Chromium ou Playwright absent : essai de navigateur ignoré':false;
const N=require('../tools/ui5-navigateur.cjs');
/* (Un fichier par partie de l'essai : chacun doit tenir dans les 20 secondes que verify laisse à un fichier d'essais.) */
test('Ariane : Écho, Revue et Réglages s’ouvrent sans erreur, en lot et après le lot ; Écho est indisponible pendant un lot',{skip:absent,timeout:60000},async()=>{
 const r=await N.capturerAriane(null,['lot','fin'],['accueil','echo','revue','reglages'],{width:1180,height:800},300);
 assert.deepEqual(r.erreurs,[]);
 for(const k of Object.keys(r.resultat))assert.equal(r.resultat[k].vue,k.split('/')[1],k);
 assert.match(r.resultat['lot/echo'].etat,/Indisponible pendant un lot/);
});
