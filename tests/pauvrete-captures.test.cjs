'use strict';
/* CH-053-C : chantiers/CH-053/pauvrete-captures.cjs sur captures SYNTHÉTIQUES (forme du lecteur v2, rien du terrain). */
const test = require('node:test'), assert = require('node:assert/strict');
const { analyser } = require('../chantiers/CH-053/pauvrete-captures.cjs');
const T = s => new Date(Date.UTC(2031, 4, 1, 8, 0, s)).toISOString();
const obs = (retenus, sauves, visibles, raisons = [], clipLoss = {}) => ({ pointsRetained: retenus, checkpointedPoints: sauves, pointsVisibleForEngine: visibles,
  coverage: { status: raisons.length ? 'insufficient' : 'qualified-candidate', pointsInRoi: visibles, exclusionReasons: raisons }, clipLoss });
const cap = (debut, fin, term, ro, trace = {}) => ({ format: 'banane-native-lidar-capture-v2', startedAt: T(debut), completedAt: T(debut + .4), termination: term ? { code: term } : null,
  status: term ? 'partial-interrupted' : 'complete-loaded-buffers', trace: { pointsRead: 5000, pointsAvailableInBuffers: 9000, ...trace }, railObservations: ro });
test('A : points perdus sur CLIP_CHANGED et borne haute du reclassement ; B : pauvreté des captures complètes', () => {
  const clouds = [
    cap(1, 0, 'CLIP_CHANGED', { left: obs(2500, 0, 0), right: obs(2300, 0, 0) }),                // 2 rails récupérables en borne haute
    cap(2, 0, 'CLIP_CHANGED', { left: obs(40, 0, 0), right: obs(3000, 2048, 2048) }),             // 1 rail pauvre, 1 rail déjà sauvegardé
    cap(10, 0, null, { left: obs(900, 900, 100, ['engine-useful-point-count-below-minimum'], { nearFaceDropped: 300 }), right: obs(500, 500, 500) }),
    cap(11, 0, null, { left: obs(0, 0, 0, ['roi-point-count-below-minimum']) }),
  ];
  const r = analyser(clouds).toutes;
  assert.equal(r.A_clipChanged.rails, 4); assert.equal(r.A_clipChanged.railsSansAucunPointSauvegarde, 3); assert.equal(r.A_clipChanged.bornehauteRecuperableParReclassement, 2);
  assert.equal(r.B_finNormaleNonQualifiee.rails, 2); assert.equal(r.B_finNormaleNonQualifiee.railsSansAucunPointRetenu, 1);
  assert.equal(r.B_finNormaleNonQualifiee.railsOuLaDecoupeCacheLaMajorite, 1);
  assert.deepEqual(r.B_finNormaleNonQualifiee.raisonsCouverture, { 'engine-useful-point-count-below-minimum': 1, 'roi-point-count-below-minimum': 1 });
  assert.deepEqual(r.finsDeCapture, { CLIP_CHANGED: 2, 'sans-fin-anormale': 2 });
});
test('coupure : avant/après un instant', () => {
  const clouds = [cap(1, 0, 'CLIP_CHANGED', { left: obs(2500, 0, 0) }), cap(100, 0, 'CLIP_CHANGED', { left: obs(300, 0, 0) })];
  const r = analyser(clouds, { coupure: T(50) });
  assert.equal(r.avant.A_clipChanged.pointsPerdus.mediane, 2500); assert.equal(r.apres.A_clipChanged.pointsPerdus.mediane, 300);
});
