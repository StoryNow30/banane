'use strict';
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const D = require('../tools/candidate-generation-diagnostics.cjs');
const OPPOSITE_STATES = ['opposite-candidate', 'opposite-flank-only',
  'opposite-other-abstention', 'opposite-no-candidate', 'opposite-not-replayable'];
const ROOT = path.resolve(__dirname, '..');
const SHADOW = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/flank-support-shadow-v1.json')));
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/candidate-generation-diagnostics-v1.json')));
const ROWS = A.rows;
const NC = ROWS.filter(r => r.population === 'no-candidate');
const BAD = ROWS.filter(r => r.population === 'flank-only');
function keysOf(o, base = '') {
  const out = [];
  (function walk(v, p) {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) { out.push([k, `${p}.${k}`]); walk(x, `${p}.${k}`); }
  })(o, base);
  return out;
}
test('le lot ne touche ni geometry ni moteur', () => {
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  const frozen = SHADOW.engine.frozenHashes;
  assert.equal(sha('src/geometry.js'), frozen['src/geometry.js']);
  assert.equal(sha('vendor/capture-core.js'), frozen['vendor/capture-core.js']);
  assert.equal(sha('vendor/lidar.js'), frozen['vendor/lidar.js']);
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.6.0-engine-baseline.json')));
  assert.equal(sha('src/engine.js'), baseline.engine['src/engine.js']);
});
test('portes citées mot pour mot depuis geometry.js', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/geometry.js'), 'utf8');
  let last = -1;
  for (const g of D.GENERATION_GATES) {
    const idx = src.indexOf("unresolved('" + g.engineReason + "')");
    assert.ok(idx >= 0, g.engineReason);
    assert.ok(idx > last); last = idx;
  }
});
test('aucune clé humaine hors postHocEvaluation', () => {
  const interdit = /human|operator|label|final|reference|oracle|verdict|truth|error/i;
  assert.deepEqual(A.blocks.humanFreeBlocks, D.HUMAN_FREE_BLOCKS);
  for (const bloc of D.HUMAN_FREE_BLOCKS)
    for (const r of ROWS)
      for (const [k, chemin] of keysOf(r[bloc], bloc))
        assert.ok(!interdit.test(k), chemin);
});
test('2 historiques, 62 finaux, étapes observées', () => {
  assert.equal(NC.filter(r => r.corpus === 'historical-original').length, 2);
  assert.equal(NC.filter(r => r.corpus === 'final-complementary').length, 62);
  assert.deepEqual(A.answers.q2_countsPerStage.final, { 'Plan de roulement non estimable.': 62 });
  for (const r of NC.filter(x => x.corpus === 'final-complementary'))
    assert.equal(r.generationTrace.stopStage, 'running-surface-not-estimable');
});
test('hausse concentrée, pas la tranche tardive', () => {
  const bySess = A.noCandidateSummary.final.bySession;
  assert.equal(Object.keys(bySess).length, 3);
  assert.equal(bySess['d9ccb545-25db-4262-b383-794ab3272ec7'], 35);
  assert.equal(bySess['3876864f-a864-4678-b7b0-3feecc4af418'], 17);
  assert.equal(bySess['0c58c033-f2e7-4aa5-ad8c-80b081a83932'], 10);
  assert.equal(A.answers.q4_degradedSessionShare.afterLastLossless, 0);
  assert.deepEqual(A.noCandidateSummary.final.bySide, { right: 57, left: 5 });
});
test('45 flank-only : génération achevée', () => {
  assert.equal(BAD.length, 45);
  assert.equal(A.answers.q6_flankUnsatisfyingGenerationVsAbstention.generationStopped, 0);
  for (const r of BAD) {
    assert.equal(r.generationTrace.metricsPublished, true);
    assert.equal(r.candidateFamilies.noWinner, true);
  }
  assert.equal(BAD.filter(r => r.candidateFamilies.surfaceCoincidesWithSeed).length, 36);
});
test('aucun seuil choisi, rail opposé non déplacé', () => {
  assert.equal(A.comparison.classifier, null);
  assert.equal(A.comparison.chosenThreshold, null);
  for (const r of ROWS) {
    assert.equal(r.oppositeRailContext.railMoved, false);
    assert.ok(OPPOSITE_STATES.includes(r.oppositeRailContext.state));
    assert.equal(r.inputContext.failClosed, null);
  }
});
test('q7 est une liste observée', () => {
  const ids = A.answers.q7_observedGeometrySubproblems.map(p => p.id);
  assert.ok(ids.includes('running-surface-not-estimable-after-roi'));
  assert.ok(ids.includes('right-rail-part-1-cut-cluster-5083-5276'));
});
