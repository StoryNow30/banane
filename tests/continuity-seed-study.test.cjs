'use strict';
/* Étude hors ligne de l'amorce par continuité (cahier 4.8, amendement n°7) :
 * le départ d'un cut est la droite des deux cuts d'ancrage, prolongée au cut. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fitAt,studySession}=require('../tools/continuity-seed-study.cjs');

test('deux ancres précédentes : la droite est prolongée jusqu’au cut',()=>{
  assert.ok(Math.abs(fitAt([[-2,.200],[-1,.210]])-.220)<1e-12);
});

test('une seule ancre : son décalage est reporté tel quel',()=>{
  assert.equal(fitAt([[-1,.25]]),.25);
});

test('un départ inconnu est refusé',()=>{
  assert.throws(()=>studySession({records:[],clouds:[]},'x',{mode:'plus-proche-de-1435'}),/Mode inconnu/);
});

test('une session sans visite rend un bilan vide, sans erreur',()=>{
  const r=studySession({records:[],clouds:[]},'vide',{mode:'relay'});
  assert.equal(r.summary.judged,0);assert.deepEqual(r.rows,[]);
});
