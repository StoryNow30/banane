'use strict';
/* CH-133 (D-366, D-367) — BORNES DE LA RELECTURE : choisir le cut de départ et de fin quand la relecture est en pause, et quand elle s'est arrêtée
 * (défaut, fin). Service worker réel, ESV simulé (tests/helpers/relecture-points-vides.cjs) : relecture « corriger » des cuts 108, 109, 110, 113, 114,
 * 115, 116 ; les cuts 113 à 115 rendent des captures sans point, même après le rechargement (`persiste` : une vraie zone sans points). Un cut écarté
 * par les bornes n'est ni visité ni écrit (jamais SKIP) ; il est compté « non relu » et listé au journal (`relecture-bornes`). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotVide,attendreEtat,cutsAllees,evenement}=require('./helpers/relecture-points-vides.cjs');
const J=x=>JSON.parse(JSON.stringify(x));   /* objets du service worker (autre contexte vm) */

/* Relecture gardée en pause sur la série vide (après le rechargement unique de la série). */
async function pauseSurSerie(o={}){const m=await lotVide({vides:[113,114,115],persiste:true,...o});
 await evenement(m.b,'relecture-points-vides',e=>e.etape==='repris');
 await evenement(m.b,'relecture-pause',e=>e.raison==='points'&&H.evenements(m.b,'relecture-pause').length===2,20000);
 await attendreEtat(m.b,'en-pause');return m;}

test('pause sur une vraie série vide : le message dit l’issue, les bornes proposées commencent après la série',async()=>{
 const {b}=await pauseSurSerie();
 const p=b.get('relecture').passe;
 assert.match(p.message,/relecture gardée en pause au cut 113\. Recharge ESV \(F5\) puis reprends, ou reprends après la série \(cut 116\)/,p.message);
 const e=await b.api('relecture-etat');
 assert.deepEqual(J(e.passe.bornesProposees),{debut:116,fin:116});
});

test('reprise du cut 116 au cut 116 : la passe sort de la série et finit ; 113 à 115 ne sont plus relus, rien n’y est écrit',async()=>{
 const {b,adapter}=await pauseSurSerie();
 const allees0=cutsAllees(adapter).length,maj0=adapter.majEspace.length,pose0=adapter.applyArgs.length,ev0=H.evenements(b,'relecture-ombre').length;
 await b.api('relecture-reprendre',{debut:116,fin:116});
 const fin=await H.finPasse(b,60000);
 assert.equal(fin.etat,'finie',fin.message);
 /* En « corriger », un vert corrigeable est atteint par les boutons d'ESV : la passe passe par le cut d'avant (115) sans le relire (aucune capture). */
 assert.deepEqual(H.evenements(b,'relecture-ombre').slice(ev0).map(e=>e.identity.cut),[116],'seul 116 est relu après la reprise');
 assert.deepEqual(cutsAllees(adapter).slice(allees0).filter(c=>c>=113&&c<=114),[],'113 et 114 jamais visités');
 assert.ok(cutsAllees(adapter).slice(allees0).includes(116),'116 relu');
 assert.deepEqual(adapter.majEspace.slice(maj0).map(x=>x.cut).filter(c=>c>=113&&c<=115),[]);
 assert.deepEqual(adapter.applyArgs.slice(pose0).map(x=>x.cut).filter(c=>c>=113&&c<=115),[]);
 const bo=H.evenements(b,'relecture-bornes');assert.equal(bo.length,1);
 assert.equal(bo[0].debut,116);assert.equal(bo[0].fin,116);assert.equal(bo[0].ecartes,3);assert.deepEqual(J(bo[0].cuts),[113,114,115]);assert.equal(bo[0].quand,'reprise');
 assert.equal(fin.horsBornes,3);assert.match(fin.message,/3 cuts non relus \(hors des bornes\)/,fin.message);
 const r=H.evenements(b,'relecture-fin').at(-1);assert.equal(r.horsBornes,3);
 assert.ok(!b.commands.some(c=>/skip/i.test(c.type||c.command||'')),'jamais SKIP');
});

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
