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

test('bornes refusées en clair : inversées, hors partie, non entières, sans cut à relire ; la passe reste en pause',async()=>{
 const {b}=await pauseSurSerie();
 await assert.rejects(b.api('relecture-reprendre',{debut:116,fin:113}),/le cut de départ \(116\) est après le cut de fin \(113\)/);
 await assert.rejects(b.api('relecture-reprendre',{debut:113,fin:999}),/hors de la partie/);
 await assert.rejects(b.api('relecture-reprendre',{debut:-1,fin:116}),/hors de la partie|entiers/);
 await assert.rejects(b.api('relecture-reprendre',{debut:113.5,fin:116}),/entiers/);
 await assert.rejects(b.api('relecture-reprendre',{debut:117,fin:150}),/aucun cut de la relecture entre le cut 117 et le cut 150/);
 assert.equal(b.get('relecture').passe.etat,'en-pause');assert.equal(H.evenements(b,'relecture-bornes').length,0);
});
test('reprise sans bornes : comme avant (repart au cut gardé)',async()=>{
 const {b,adapter}=await pauseSurSerie();const a0=cutsAllees(adapter).length;
 await b.api('relecture-reprendre',{});
 await evenement(b,'relecture-pause',e=>e.raison==='points'&&H.evenements(b,'relecture-pause').length===3,20000);
 assert.equal(cutsAllees(adapter).slice(a0)[0],113);
});
