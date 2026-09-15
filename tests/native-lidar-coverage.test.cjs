const { test } = require('node:test'), assert = require('node:assert/strict');
const N = require('../src/native-lidar.js');

const settings = {
  ...N.DEFAULTS,
  bounds: N.DEFAULTS.bounds.slice(), usefulBounds: N.DEFAULTS.usefulBounds.slice(),
  coverage: { ...N.DEFAULTS.coverage },
};
const ok = { valid: true }, assoc = 'same-target-and-rail-pose';

/* Générateur déterministe : mêmes jeux à chaque exécution. */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function dataset(n, seed, spread) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    out.push([
      (r() - 0.5) * 2 * spread,          // latéral, pilote bins et étendue
      (r() - 0.5) * 0.8,                  // parfois hors usefulBounds (0,18)
      (r() - 0.5) * 0.5,                  // parfois hors usefulBounds (0,10)
    ]);
  }
  return out;
}

test('l’accumulateur donne exactement le même verdict que le balayage complet', () => {
  for (const [n, seed, spread] of [[50, 1, 0.5], [200, 2, 0.5], [1000, 3, 0.5], [1000, 4, 0.05], [3000, 5, 0.02], [5000, 6, 0.5]]) {
    const points = dataset(n, seed, spread);
    const parBalayage = N.coverage(points, settings, ok, assoc, null);
    const acc = N.coverageAccumulator(settings);
    for (const p of points) acc.add(p);
    const parAgregats = N.coverageFrom(acc, settings, ok, assoc, null);
    assert.deepEqual(parAgregats, parBalayage, `jeu n=${n} seed=${seed} spread=${spread}`);
  }
});

test('qualifies() concorde avec le statut complet quand les conditions de base tiennent', () => {
  for (const [n, seed, spread] of [[100, 11, 0.5], [500, 12, 0.5], [500, 13, 0.03], [2000, 14, 0.5], [2000, 15, 0.01]]) {
    const acc = N.coverageAccumulator(settings);
    for (const p of dataset(n, seed, spread)) acc.add(p);
    const complet = N.coverageFrom(acc, settings, ok, assoc, null).status === 'qualified-candidate';
    assert.equal(acc.qualifies(), complet, `jeu n=${n} seed=${seed} spread=${spread}`);
  }
});

test('les causes d’exclusion restent nommées à l’identique', () => {
  const tasse = N.coverageAccumulator(settings);
  for (const p of dataset(2000, 21, 0.02)) tasse.add(p);   // étendue trop faible
  const r = N.coverageFrom(tasse, settings, ok, assoc, null);
  assert.equal(r.status, 'insufficient');
  assert.ok(r.exclusionReasons.includes('longitudinal-span-insufficient'));
  assert.ok(r.exclusionReasons.includes('longitudinal-coverage-insufficient'));

  const vide = N.coverageAccumulator(settings);
  const r2 = N.coverageFrom(vide, settings, ok, assoc, null);
  assert.ok(r2.exclusionReasons.includes('roi-point-count-below-minimum'));
  assert.ok(r2.exclusionReasons.includes('engine-useful-point-count-below-minimum'));
  assert.equal(r2.longitudinalSpan, 0, 'étendue nulle sur un accumulateur vide, jamais -Infinity');
});

test('un transformé invalide ou une association douteuse restent bloquants', () => {
  const acc = N.coverageAccumulator(settings);
  for (const p of dataset(3000, 31, 0.5)) acc.add(p);
  assert.equal(N.coverageFrom(acc, settings, ok, assoc, null).status, 'qualified-candidate');
  assert.equal(N.coverageFrom(acc, settings, { valid: false }, assoc, null).status, 'insufficient');
  assert.equal(N.coverageFrom(acc, settings, ok, 'autre-cible', null).status, 'insufficient');
  assert.ok(N.coverageFrom(acc, settings, ok, assoc, { code: 'VIEW_CHANGED' })
    .exclusionReasons.includes('capture-interrupted-before-stable-boundary'));
});

test('un très grand échantillon ne fait plus exploser la pile', () => {
  // L'ancienne implémentation faisait Math.max(...xs) : au-delà d'environ
  // 125 000 arguments, V8 lève RangeError et la capture échouait.
  const gros = dataset(200000, 41, 0.5);
  assert.doesNotThrow(() => N.coverage(gros, settings, ok, assoc, null));
  const r = N.coverage(gros, settings, ok, assoc, null);
  assert.equal(r.pointsInRoi, 200000);
  assert.ok(r.pointsInEngineUsefulRoi > 0);
});

test('le coût d’évaluation ne dépend plus du volume déjà accumulé', () => {
  const acc = N.coverageAccumulator(settings);
  for (const p of dataset(200, 51, 0.02)) acc.add(p);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) acc.qualifies();
  const petit = Number(process.hrtime.bigint() - t0);

  for (const p of dataset(50000, 52, 0.02)) acc.add(p);
  const t1 = process.hrtime.bigint();
  for (let i = 0; i < 2000; i++) acc.qualifies();
  const gros = Number(process.hrtime.bigint() - t1);

  // 250 fois plus de points accumulés ne doit pas coûter un ordre de grandeur.
  assert.ok(gros < petit * 10 + 5e6, `petit ${petit}ns, gros ${gros}ns`);
});
