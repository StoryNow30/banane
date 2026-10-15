'use strict';
/* 4.9.5.1 (D3, D-110) — une écriture de validation refusée par ESV (HTTP non 2xx ou statut 0), vue par l'observateur
 * passif, n'est plus comptée comme acceptée en silence : sans écriture réussie de la même ligne dans la fenêtre de
 * relance, événement `ecriture-refusee` et pause du lot au prochain point sûr, avis clair ; aucune attente ajoutée,
 * rien renvoyé à ESV. Cas qui mettent en pause ; ceux qui ne le doivent pas : t951-d3-sans-pause. Montage :
 * tests/helpers/d3-ecritures.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lot,AVIS}=require('./helpers/d3-ecritures.cjs');

test('500 puis rien : refus confirmé, pause avant toute pose du cut suivant, avis et événement',async()=>{
 const r=await lot({ecritures:cut=>cut===100?[{status:500}]:[{status:204}]});
 assert.equal(r.etat,'PAUSED');
 const m=AVIS.exec(r.avis);assert.ok(m,r.avis);assert.deepEqual([m[1],m[2]],['100','erreur serveur']);
 assert.equal(r.refus.length,1);const ev=r.refus[0];
 assert.deepEqual([ev.cut,ev.statut,ev.rapprochement,ev.pause,ev.lot],[100,500,'fenetre',true,r.lotId]);assert.ok(!Number.isNaN(Date.parse(ev.heure)));
 assert.equal(JSON.stringify(ev).includes('RK-'),false,'aucun identifiant de ligne dans l’événement');
 assert.deepEqual(r.traites,[100]);
 assert.deepEqual(r.journal.filter(([k,c])=>c===101&&k!=='capture'),[],'cut 101 : ni posé ni validé');
 assert.ok(r.transitions.includes('pause'),'transition B3 « pause » consignée');
 assert.equal(r.journal.filter(([k])=>k==='validation').length,1,'rien renvoyé à ESV');
});

test('statut 0 (aucune réponse) : pause, avis « pas de réponse du serveur »',async()=>{
 const r=await lot({ecritures:cut=>cut===101?[{status:0}]:[{status:204}]});
 assert.equal(r.etat,'PAUSED');assert.deepEqual(AVIS.exec(r.avis)?.slice(1),['101','pas de réponse du serveur']);
 assert.deepEqual(r.refus.map(e=>[e.cut,e.statut]),[[101,0]]);assert.deepEqual(r.traites,[100,101]);
});

test('ligne déjà vue (railPairId d’une écriture réussie) : le refus est rendu à SON cut, pas au cut en cours',async()=>{
 /* Au cut 100 : écriture réussie, ligne RK-100 = indice 100. Au cut 101 : la page voit une écriture réussie du cut 101
  * et un refus pour RK-100 (renvoi d'ESV sur l'ancienne ligne). */
 const r=await lot({ecritures:cut=>cut===100?[{status:204,rowIndex:100}]:cut===101?[{status:204},{status:500,railPairId:'traj/RK-100'}]:[{status:204}]});
 assert.equal(r.etat,'PAUSED');assert.equal(AVIS.exec(r.avis)?.[1],'100',r.avis);
 assert.deepEqual(r.refus.map(e=>[e.cut,e.rapprochement]),[[100,'railPairId']]);
});
