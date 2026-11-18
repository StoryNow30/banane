'use strict';
/* CH-133 (D-366, D-367) — BORNES DE LA RELECTURE : choisir le cut de départ et de fin quand la relecture est en pause, et quand elle s'est arrêtée
 * (défaut, fin). Service worker réel, ESV simulé (tests/helpers/relecture-points-vides.cjs) : relecture « corriger » des cuts 108, 109, 110, 113, 114,
 * 115, 116 ; les cuts 113 à 115 rendent des captures sans point, même après le rechargement (`persiste` : une vraie zone sans points). Un cut écarté
 * par les bornes n'est ni visité ni écrit (jamais SKIP) ; il est compté « non relu » et listé au journal (`relecture-bornes`). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotVide,attendreEtat,cutsAllees,evenement}=require('./helpers/relecture-points-vides.cjs');
/* CH-136 : fichier découpé (le fichier d'origine durait 26 s, au-delà des 20 s par fichier du verify). */
const J=x=>JSON.parse(JSON.stringify(x));   /* objets du service worker (autre contexte vm) */

/* Relecture gardée en pause sur la série vide (après le rechargement unique de la série). */
async function pauseSurSerie(o={}){const m=await lotVide({vides:[113,114,115],persiste:true,...o});
 await evenement(m.b,'relecture-points-vides',e=>e.etape==='repris');
 await evenement(m.b,'relecture-pause',e=>e.raison==='points'&&H.evenements(m.b,'relecture-pause').length===2,20000);
 await attendreEtat(m.b,'en-pause');return m;}

test('relecture arrêtée sur la série (pause éteinte) : bornes proposées après la série, relance bornée qui finit',async()=>{
 const {b,adapter}=await lotVide({vides:[113,114,115],persiste:true,actif:false});
 const fin=await H.finPasse(b,60000);assert.equal(fin.etat,'erreur');
 const e=await b.api('relecture-etat');assert.deepEqual(J(e.passe.bornesProposees),{debut:116,fin:116});
 const a0=cutsAllees(adapter).length;
 await b.api('relecture-lancer',{debut:116,fin:116});
 const f2=await H.finPasse(b,60000);
 assert.equal(f2.etat,'finie',f2.message);assert.equal(f2.horsBornes,6);
 assert.deepEqual([...new Set(cutsAllees(adapter).slice(a0))].filter(c=>c!==115),[116],'seul 116 est relu (115 : le cut d’avant, pour l’atteindre par les boutons)');
 const bo=H.evenements(b,'relecture-bornes').at(-1);assert.equal(bo.quand,'lancement');assert.deepEqual(J(bo.cuts),[108,109,110,113,114,115]);
});
test('relance bornée après une relecture finie ; bornes refusées au lancement',async()=>{
 const {b,adapter}=await lotVide({vides:[]});
 const fin=await H.finPasse(b,60000);assert.equal(fin.etat,'finie',fin.message);
 const e=await b.api('relecture-etat');assert.deepEqual(J(e.passe.bornesProposees),{debut:108,fin:116});
 await assert.rejects(b.api('relecture-lancer',{debut:110,fin:109}),/le cut de départ \(110\) est après le cut de fin \(109\)/);
 const a0=cutsAllees(adapter).length,maj0=adapter.majEspace.length;
 await b.api('relecture-lancer',{debut:113,fin:114});
 const f2=await H.finPasse(b,60000);
 assert.equal(f2.etat,'finie',f2.message);assert.equal(f2.faits,2);assert.equal(f2.horsBornes,5);
 const vus=cutsAllees(adapter).slice(a0);assert.ok(vus.every(c=>c>=112&&c<=114),vus.join(','));
 assert.ok(adapter.majEspace.slice(maj0).every(x=>x.cut>=113&&x.cut<=114));
});
