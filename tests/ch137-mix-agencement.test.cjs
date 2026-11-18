'use strict';
/* CH-137 : LA BARRE ET LES ZONES DE MIX TIENNENT DANS LEUR FENÊTRE (vrai panneau, API Chrome simulée, données fabriquées).
 * Reprises des défauts mesurés par l'audit : le menu de la Constellation sort à 320 et 600 px ; la vue fil et les bornes de
 * relecture font défiler leur zone. La vue fil reprend le contrat de CH-134 : les lignes qui ne tiennent pas sont masquées,
 * rien ne défile. La mesure MESURE de CH-104 est utilisée sans changement. Ignoré, et dit ignoré, sans Chromium. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {SCENES,ouvrirScene,MESURE}=require('../chantiers/CH-137/outils/scenes.cjs');

test('CH-137 : le menu de la Constellation reste dans la fenêtre à 320, 440 et 600 px',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 const defauts=[];
 try{
  for(const nom of ['constellation','constellation-stats'])for(const largeur of [320,440,600]){
   const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES[nom],{largeur});
   for(const x of (await page.evaluate(MESURE)).filter(x=>x.startsWith('SORT ')))defauts.push(`${nom} ${largeur} px : ${x}`);
   assert.deepEqual(erreurs,[],`${nom} ${largeur} : aucune erreur de page`);
   await ctx.close();
  }
 }finally{await nav.close();}
 assert.deepEqual(defauts,[],'aucun élément ne sort');
});

test('CH-137 : la vue fil masque ce qui ne tient pas et les bornes tiennent sans faire défiler la zone',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 const CAS=[...([320,600].map(largeur=>['vue-fil',largeur])),...([320,400,560].map(largeur=>['rel-bornes',largeur]))];
 const defauts=[];
 try{
  for(const [nom,largeur] of CAS){
   const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES[nom],{largeur});
   for(const x of (await page.evaluate(MESURE)).filter(x=>x.startsWith('ZONE A DEFILER')))defauts.push(`${nom} ${largeur} px : ${x}`);
   assert.deepEqual(erreurs,[],`${nom} ${largeur} : aucune erreur de page`);
   await ctx.close();
  }
 }finally{await nav.close();}
 assert.deepEqual(defauts,[],'la zone ne défile pas');
});
