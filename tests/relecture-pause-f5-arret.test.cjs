'use strict';
/* 4.9.6 (D-232, D-233) — F5 PENDANT LA RELECTURE, réglage « arrêter » (un fichier à part : chaque fichier d'essai tient en moins de 20 s) :
 *  - « pause » (par défaut) : ESV muet pendant un cut → la passe se met EN PAUSE au cut non fait, garde son point ; « Reprendre » est refusé tant qu'ESV ne répond pas,
 *    puis repart de ce cut sans repasser sur les cuts relus ;
 *  - « arret » : comme avant le 4.9.6, la passe s'arrête en erreur et rien n'est gardé. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat,cutsAllees}=require('./helpers/relecture-pause.cjs');
test('réglage « si ESV est rechargé : arrêter » : le F5 arrête la passe en erreur, comme avant ; rien n’est gardé ; pas de reprise',async()=>{
 const {b}=await lotPause({f5:'arret',esv:a=>{a.panneCapture.add(110);}});
 const p=await H.finPasse(b);
 assert.equal(p.etat,'erreur');assert.match(p.message,/Relecture arrêtée au cut 110 : Adaptateur ESV sans réponse/);
 assert.equal(H.evenements(b,'relecture-pause').length,0);assert.equal(H.evenements(b,'relecture-fin')[0].issue,'erreur');
 assert.equal('banane51RelectureReprise' in b.local.m,false,'aucun point gardé');
 await assert.rejects(b.api('relecture-reprendre'),/Aucune relecture en pause/);
});
