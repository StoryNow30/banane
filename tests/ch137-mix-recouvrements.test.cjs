'use strict';
/* CH-137 : LES ACTIONS DE MIX RESTENT CLIQUABLES dans le vrai panneau (panel.html, API Chrome simulée, données fabriquées).
 * Reprises des défauts mesurés par l'audit : « Ouvrir » et « Examiner » sous le pied ou une autre ligne dans Aurore et le tiroir,
 * dernière borne de la relecture sous les actions à 320 px. La mesure RECOUVRE de l'audit est utilisée sans changement.
 * Ignoré, et dit ignoré, sans Chromium. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {SCENES,ouvrirScene,RECOUVRE}=require('../chantiers/CH-137/outils/scenes.cjs');

test('CH-137 : Aurore, le tiroir et les bornes ne laissent aucun contrôle recouvert',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 const CAS=[...([320,400,440,600,720].map(largeur=>['aurore',largeur])),...([320,360].map(largeur=>['tiroir',largeur])),['rel-bornes',320]];
 const defauts=[];
 try{
  for(const [nom,largeur] of CAS){
   const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES[nom],{largeur});
   for(const x of await page.evaluate(RECOUVRE))defauts.push(`${nom} ${largeur} px : ${x}`);
   assert.deepEqual(erreurs,[],`${nom} ${largeur} : aucune erreur de page`);
   await ctx.close();
  }
 }finally{await nav.close();}
 assert.deepEqual(defauts,[],'chaque contrôle reçoit le clic en son centre');
});
