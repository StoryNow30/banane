'use strict';
/* CH-096, défaut 2 — ARRÊT DEMANDÉ PENDANT UNE POSE RECLIQUÉE : AUCUN CLIC DE POSE APRÈS L'ARRÊT.
 * `clickPosition` (src/adapter-page.js) reclique jusqu'à trois fois quand ESV pose à plus de 1 mm de la cible. Dès le deuxième essai,
 * le `catch` de l'attente avalait toute erreur, y compris « Action interrompue. » (« Arrêter ») : la boucle passait à l'essai suivant et
 * envoyait un clic de plus. ESV simulé de tests/helpers/esv-clic.cjs, qui pose de travers (3 mm) à chaque clic du rail gauche ; l'arrêt
 * arrive juste après le deuxième clic. `CH096_SANS_PATCH=1` : adaptateur sans le patch (rouge). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('./helpers/esv-clic.cjs'),A=require('./helpers/ch096.cjs'),K=require('../src/core.js');
const ADAPTATEUR=A.fichier('src/adapter-page.js');
const PROPOSITIONS={left:{delta:[0,.012,.003]},right:{delta:[0,-.01,.004]}};
/* Une pose dont ESV décale le rail gauche à chaque clic ; `arretApres` : rang du clic gauche après lequel « Arrêter » est envoyé. */
async function pose({arretApres=null}={}){
 const G=H.geometrie(),f=H.esvClic({adapter:ADAPTATEUR.chemin});
 f.poser({cut:H.cutDuMode('reference'),rails:G.rails,vues:G.vues,active:'right',decalageEsv:{left:{d:[0,0,.003],fois:9}}});
 const canevas=f.ctx.viewer.renderer.domElement,envoyer=canevas.dispatchEvent;let arret=null,clicsGauche=0,apresArret=0;
 canevas.dispatchEvent=e=>{const r=envoyer(e);
  if(e.type==='click'&&f.cote()==='left'){clicsGauche++;if(arret)apresArret++;
   if(clicsGauche===arretApres)arret=f.call('cancel');}
  return r;};
 const before=await f.call('state');let erreur=null;
 try{await f.call('apply',before,PROPOSITIONS);}catch(e){erreur=e.message;}
 if(arret)await arret;
 return {erreur,clicsGauche,apresArret,clics:f.journal.filter(j=>j.quoi==='canevas'&&j.type==='click').map(j=>j.cote)};}
test('l\'adaptateur chargé porte le patch de CH-096 (sauf CH096_SANS_PATCH=1)',()=>{
 assert.ok(['porté','appliqué','écarté','retiré'].includes(ADAPTATEUR.etat),'patch : '+ADAPTATEUR.etat);assert.equal(ADAPTATEUR.avecPatch,!A.SANS);});
test('montage : sans arrêt, ESV qui pose de travers reçoit les trois clics puis la pose est refusée (inchangé)',async()=>{
 const r=await pose();
 assert.equal(r.clicsGauche,3);assert.match(r.erreur,/Le clic n’a pas produit le déplacement demandé pour left : rail posé à .* mm de la cible/);});
test('arrêt après le DEUXIÈME clic : aucun troisième clic, la pose rend « Action interrompue. »',async()=>{
 const r=await pose({arretApres:2});
 assert.equal(r.apresArret,0,'clic(s) de pose après l\'arrêt : '+JSON.stringify(r.clics));
 assert.equal(r.clicsGauche,2);assert.equal(r.erreur,'Action interrompue.');});
test('arrêt après le PREMIER clic : aucun autre clic (déjà vrai avant la correction)',async()=>{
 const r=await pose({arretApres:1});
 assert.equal(r.apresArret,0,JSON.stringify(r.clics));assert.equal(r.erreur,'Action interrompue.');});
