'use strict';
/* 4.9.5.1 (D3, D-110) — écritures de validation : les cas qui NE mettent PAS le lot en pause (relance réussie d'ESV,
 * écritures réussies, observateur absent, réglage « off », échec d'une autre ligne), et aucune attente ajoutée.
 * Montage : tests/helpers/d3-ecritures.cjs ; cas de pause : t951-d3-ecriture-refusee. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lot,fini}=require('./helpers/d3-ecritures.cjs');

test('500 puis 204 de la même ligne dans la fenêtre (relance d’ESV) : rien',async()=>{
 const r=await lot({ecritures:cut=>cut===100?[{status:500},{status:204,attempt:2,apresMs:15}]:[{status:204}]});
 assert.ok(fini(r.etat),r.etat);assert.equal(r.refus.length,0);assert.deepEqual(r.traites,[100,101,102]);
});

test('204 seulement : rien',async()=>{
 const r=await lot({ecritures:()=>[{status:204}]});
 assert.ok(fini(r.etat),r.etat);assert.equal(r.refus.length,0);assert.deepEqual(r.traites,[100,101,102]);
});

test('pas d’observateur (aucune observation), ou réglage « off » : comportement de la 4.9.0, le lot va au bout',async()=>{
 for(const o of [{observateur:false},{reglage:{ecritureRefusee:'off'}}]){
  const r=await lot({ecritures:cut=>cut===100?[{status:500}]:[{status:204}],...o});
  assert.ok(fini(r.etat),r.etat);assert.equal(r.refus.length,0);assert.deepEqual(r.traites,[100,101,102]);}
});

test('écriture d’une autre ligne en échec : pas de pause sur le mauvais cut',async()=>{
 /* (a) ligne connue par son indice, hors des cuts validés par le lot ; (b) corps sans ExtractionStatus (« vu » du cut
  * suivant) ; (c) écriture commencée hors de toute fenêtre de validation. */
 const r=await lot({ecritures:cut=>cut===100?[{status:204},{status:500,rowIndex:57,railPairId:'traj/RK-57'},
   {status:500,railPairId:'traj/RK-101',body:{SeenByOperator:true}},{status:503,railPairId:'traj/RK-9',debutMs:Date.now()-60000}]:[{status:204}]});
 assert.ok(fini(r.etat),r.etat);assert.equal(r.refus.length,0);assert.deepEqual(r.traites,[100,101,102]);
});
