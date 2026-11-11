'use strict';
/* CH-107 — LA RELECTURE NE COURT PLUS SUR DES CAPTURES VIDES (bug du 11/11, partie 15 : ESV n'affichait plus les points, la relecture défilait).
 * Service worker réel, ESV simulé (tests/helpers/relecture-points-vides.cjs) : les cuts 113, 114 et 115 rendent des captures sans point. La décision
 * de 114 et 115 est remplacée par une pose (montage) qui ne lit pas les points : sans la garde, la relecture « corriger » les écrirait. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotVide,attendreEtat,cutsAllees,evenement}=require('./helpers/relecture-points-vides.cjs');

test('série de 3 cuts vides : pause au PREMIER cut vide, rechargement, reprise à ce cut ; les cuts vides sont relus, aucune correction sur un cut vide',async()=>{
 const {b,adapter}=await lotVide({vides:[113,114,115]});
 const pause=await evenement(b,'relecture-pause');
 assert.equal(pause.raison,'points');assert.equal(pause.cut,113,'pause au premier cut vide de la série');
 await evenement(b,'relecture-points-vides',e=>e.etape==='repris');
 const fin=await H.finPasse(b,60000);
 assert.equal(fin.etat,'finie',fin.message);assert.equal(adapter.rechargements,1,'un seul rechargement');
 const ev=H.evenements(b,'relecture-ombre');
 assert.deepEqual(ev.map(e=>e.identity.cut),[108,109,110,113,114,115,113,114,115,116],'les cuts de la série sont relus après la reprise');
 /* Aucun cut à capture vide n'est corrigé ; une fois les points revenus, 114 et 115 le sont. */
 const vides=ev.slice(3,6);for(const e of vides){assert.notEqual(e.action,'corrige',`cut ${e.identity.cut} vide`);assert.equal(e.skipOmbre?.capturesVides>0,true);}
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109,114,115],'corrections écrites : seulement sur des captures pleines');
 assert.equal(fin.faits,7,'chaque cut compté une fois');assert.equal(fin.corriges,3);
 const etapes=H.evenements(b,'relecture-points-vides').map(e=>e.etape);assert.deepEqual(etapes,['detecte','recharge','repris']);
 assert.equal(H.evenements(b,'relecture-reprise')[0].raisonPause,'points');
 /* Rien n'est posé pendant la série : les seules poses de la relecture sont celles des trois corrections (après le lot, qui en pose deux). */
 assert.deepEqual(adapter.applyArgs.slice(2).map(x=>x.cut),[109,114,115]);
 assert.equal(cutsAllees(adapter).filter(c=>c===113).length,2,'113 visité deux fois : dans la série, puis à la reprise');
});
test('la série recommence après le rechargement : la relecture reste en pause au premier cut vide, avec la consigne ; aucune correction',async()=>{
 const {b,adapter}=await lotVide({vides:[113,114,115],persiste:true});
 await evenement(b,'relecture-points-vides',e=>e.etape==='repris');
 await evenement(b,'relecture-pause',e=>e.raison==='points'&&H.evenements(b,'relecture-pause').length===2,20000);
 const p=await attendreEtat(b,'en-pause');
 assert.equal(p.pauseRaison,'points');assert.equal(p.cut,113);
 assert.match(p.message,/ESV n’affiche plus les points/);assert.match(p.message,/Recharge ESV \(F5\) puis reprends la relecture/);
 await H.attendre(300);assert.equal(adapter.rechargements,1,'une fois par série au plus');assert.equal(b.get('relecture').passe.etat,'en-pause');
 assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109],'aucune correction sur un cut vide');
 const etat=await b.api('relecture-etat');assert.equal(etat.passe.pauseRaison,'points');
});
test('pause et reprise éteintes : la relecture s’arrête à la série, avec la consigne ; aucune correction sur un cut vide, aucun rechargement',async()=>{
 const {b,adapter}=await lotVide({vides:[113,114,115],actif:false});
 const fin=await H.finPasse(b,60000);
 assert.equal(fin.etat,'erreur');assert.ok(fin.message.startsWith('Relecture arrêtée au cut 113 : ESV n’affiche plus les points (3 cuts de suite sans point, dès le cut 113). 4 cuts non relus, du cut 113 au cut 116 ; rien n’a été écrit sur ces cuts. Recharge ESV (F5) puis relance la relecture'),fin.message);
 assert.equal(fin.faits,3,'les cuts de la série ne comptent pas comme relus');
 assert.equal(adapter.rechargements,0);assert.deepEqual(adapter.majEspace.map(x=>x.cut),[109]);
 assert.deepEqual(H.evenements(b,'relecture-points-vides').map(e=>[e.etape,e.action]),[['detecte','arret']]);
 assert.deepEqual(H.evenements(b,'relecture-ombre').map(e=>e.identity.cut),[108,109,110,113,114,115]);
});
