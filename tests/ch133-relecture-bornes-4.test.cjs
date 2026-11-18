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

test('une correction interrompue non acquittée bloque la reprise et la relance, avec ou sans bornes ; acquittée, la reprise bornée part',async()=>{
 const {b,local}=await pauseSurSerie();
 const lotId=b.get('relecture').passe.lotId;
 local.m.banane50RelectureIntention=[{cut:110,part:23,lotId,origine:'relecture'}];
 for(const args of [{},{debut:116,fin:116}])
  await assert.rejects(b.api('relecture-reprendre',args),/Une correction de la relecture a été interrompue au cut 110.*J’ai contrôlé le cut 110/s);
 assert.equal(b.get('relecture').passe.etat,'en-pause');assert.equal(H.evenements(b,'relecture-bornes').length,0);
 await b.api('relecture-arreter');assert.equal(b.get('relecture').passe.etat,'arretee');
 const e=await b.api('relecture-etat');assert.equal(e.correctionInterrompue?.cut,110);
 for(const args of [{},{debut:116,fin:116}])
  await assert.rejects(b.api('relecture-lancer',args),/Une correction de la relecture a été interrompue au cut 110/);
 await b.api('relecture-acquitter',{cut:110});
 await b.api('relecture-lancer',{debut:116,fin:116});
 const f=await H.finPasse(b,60000);assert.equal(f.etat,'finie',f.message);assert.equal(f.faits,1);
});
