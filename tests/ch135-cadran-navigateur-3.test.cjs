'use strict';
/* CH-135 (D-368) : CADRAN DANS LE VRAI PANNEAU (panel.html, API Chrome simulée, données fabriquées ; ignoré sans Chromium, et dit ignoré).
 *  - Réglages → « Interface : Cadran » : le panneau passe en Cadran sans recharger la page, la feuille de réglages reste ouverte, le choix est gardé
 *    (`banane51Interface`) ; retour à « Instrument » de même ;
 *  - un choix gardé « cadran » ouvre le panneau en Cadran ;
 *  - les mêmes clics envoient les mêmes messages qu'en instrument (aucun message nouveau vers le service worker) ;
 *  - polices IBM Plex embarquées, aucune erreur de page. Scènes : chantiers/CH-135/outils/scenes.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const navigateur=require('./esv-maquette/navigateur.cjs');
const CHROMIUM=navigateur.executable(),absent=navigateur.indisponible()||false;
const {SCENES,ouvrirScene}=require('../chantiers/CH-135/outils/scenes.cjs');

/* Découpé à l'intégration de la clôture (18/11) : le fichier entier durait plus de 20 s, la limite du verify par fichier. Partie 3 sur 5. */
/* Équivalents en Cadran des essais de l'instrument qui lisent l'anneau (Revue T21 R6, CH-115 « chiffre qui roule ») : la fenêtre et la voie restent
 * les mêmes nœuds d'un rendu à l'autre ; un nouveau cut change les compteurs et la voie, sans copie d'un ancien chiffre dans le panneau. */
test('CH-135 : mise à jour en place : la voie n’est pas recréée chaque seconde, un nouveau cut la fait avancer, aucune copie de chiffre',{skip:absent,timeout:30000},async()=>{
 const {chromium}=require(navigateur.modulePlaywright()),nav=await chromium.launch({executablePath:CHROMIUM});
 try{
  const {ctx,page,erreurs}=await ouvrirScene(nav,SCENES.cours,{});
  await page.evaluate(()=>{window.__fen=document.querySelector('#ui5 .sg-fen');window.__voie=document.querySelector('#ui5 .cd-voie');});
  await page.waitForTimeout(2600);
  assert.deepEqual(await page.evaluate(()=>[window.__fen.isConnected,window.__voie.isConnected]),[true,true],'même fenêtre, même voie après plusieurs rendus');
  const avant=await page.evaluate(()=>({n:document.querySelectorAll('#ui5 .cd-tr.cd-pose').length,t:document.querySelector('#ui5 .sg-trio dd').textContent}));
  const s=await page.evaluate(()=>window.ArianePanel.state());
  const b=s.batch,p=[...(b.processed||[])],dernier=p.at(-1);
  await page.evaluate(x=>{window.ArianePanel.state().batch.processed.push(x);window.ArianeUi5.maj(true);},{...dernier,cut:(dernier?.cut??0)+1,identity:{...(dernier?.identity||{}),cut:(dernier?.identity?.cut??0)+1}});
  await page.waitForTimeout(500);
  const apres=await page.evaluate(()=>({n:document.querySelectorAll('#ui5 .cd-tr.cd-pose').length,t:document.querySelector('#ui5 .sg-trio dd').textContent,copie:!!document.querySelector('#ui5 .sg-roule')}));
  assert.notDeepEqual(apres,{...avant,copie:false},'un cut de plus se voit');assert.equal(apres.copie,false,'aucune copie dans le panneau dessiné');
  assert.deepEqual(erreurs,[]);await ctx.close();
 }finally{await nav.close();}
});
