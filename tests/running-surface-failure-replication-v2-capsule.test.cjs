'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('../tools/running-surface-failure-replication-v2.cjs');
const G = require('../src/geometry.js');
const Cap = require('../tools/banane-capsule.cjs');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'audit/running-surface-failure-replication-v2-capsule.json');
const FORBIDDEN = /humanFinal|humanDelta|operatorIntent|oracle|truth|trainingTarget|finalObserved|trainingExclusion/i;

function ensureArtifact() {
  if (!fs.existsSync(ART)) {
    const A = T.build();
    fs.mkdirSync(path.dirname(ART), { recursive: true });
    fs.writeFileSync(ART, JSON.stringify(A, null, 1));
  }
  return JSON.parse(fs.readFileSync(ART));
}
function keysOf(o, base = '') {
  const out = [];
  (function walk(v, p) {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) { out.push([k, `${p}.${k}`]); walk(x, `${p}.${k}`); }
  })(o, base);
  return out;
}

test('geometry, capture-core, lidar et engine restent gelés', () => {
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json')));
  assert.equal(sha('src/geometry.js'), pinned['src/geometry.js']);
  assert.equal(sha('src/geometry.js'), '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53');
  assert.equal(sha('vendor/capture-core.js'), pinned['vendor/capture-core.js']);
  assert.equal(sha('vendor/lidar.js'), pinned['vendor/lidar.js']);
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.6.0-engine-baseline.json')));
  assert.equal(sha('src/engine.js'), b.engine['src/engine.js']);
  assert.equal(b.engine['src/engine.js'], 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3');
});

test('le traceur n’est pas G.propose ni Cap.trace et cite les constantes gelées', () => {
  assert.equal(T.LITERALS.robustLineMinRows, 3);
  assert.equal(T.LITERALS.refineHalf, 0.004);
  assert.equal(G.DEFAULTS.searchY, 0.08);
  assert.equal(G.DEFAULTS.searchZ, 0.04);
  assert.equal(G.DEFAULTS.grid, 0.003);
  const src = fs.readFileSync(path.join(ROOT, 'src/geometry.js'), 'utf8');
  assert.ok(src.includes("unresolved('Plan de roulement non estimable.')"));
  const tool = fs.readFileSync(path.join(ROOT, 'tools/running-surface-failure-replication-v2.cjs'), 'utf8');
  assert.ok(tool.includes('notPropose'));
  assert.ok(tool.includes('notCapTrace'));
  assert.ok(!tool.includes('function propose('));
  assert.ok(!/Cap\.trace\s*\(/.test(tool));
});

test('capsule verify : 239 / 63 / 176 et SHA déterministe', () => {
  const { manifest, rails } = Cap.loadRails('rsf-v1');
  assert.equal(rails.length, 239);
  assert.equal(rails.filter(r => r.key.cohort === 'failure').length, 63);
  assert.equal(rails.filter(r => r.key.cohort === 'control').length, 176);
  assert.equal(manifest.shards.length, 6);
  assert.equal(manifest.deterministicSha256, T.EXPECTED_CAPSULE_SHA);
});

test('traceur = moteur sur le corpus d’incidents versionné', () => {
  const lab = T.runIncidentsLab();
  assert.equal(lab.present, true);
  assert.ok(lab.validations.length >= 10);
  assert.equal(lab.tracerOk, true);
  assert.equal(lab.divergenceCount, 0);
});

test('63 identités failure capsule, lock CGD si présent', () => {
  const fails = Cap.loadRails('rsf-v1').rails.filter(r => r.key.cohort === 'failure');
  assert.equal(fails.length, 63);
  assert.equal(fails.filter(f => f.key.corpus === 'final-complementary').length, 62);
  assert.equal(fails.filter(f => f.key.corpus === 'historical-original').length, 1);
  assert.equal(fails.filter(f => f.key.sessionId === T.SESSION_17).length, 17);
  assert.deepEqual(fails.reduce((o, f) => { o[f.key.side] = (o[f.key.side] || 0) + 1; return o; }, {}), { right: 58, left: 5 });
  const cgd = T.loadCgdFailures();
  if (cgd.length) {
    assert.equal(cgd.length, 63);
    const a = new Set(fails.map(f => `${f.key.sessionId}|${f.key.visitId}|${f.key.side}`));
    const b = new Set(cgd.map(f => `${f.sessionId}|${f.visitId}|${f.side}`));
    assert.equal(a.size, 63);
    for (const k of a) assert.ok(b.has(k), k);
  }
});

test('témoins sans humain, pool = 176 controls capsule', () => {
  const { rails } = Cap.loadRails('rsf-v1');
  const fails = rails.filter(r => r.key.cohort === 'failure').map(p => p.key);
  const ctls = rails.filter(r => r.key.cohort === 'control').map(p => p.key);
  const W = T.selectWitnesses(fails, ctls);
  assert.equal(W.humanMatching, false);
  assert.equal(W.geometricMetricsUsed, false);
  assert.equal(W.pairs.length, 63);
  assert.equal(W.tiers.unmatched, 0);
  assert.ok(W.pairs.filter(p => p.failureSession === T.SESSION_17).every(p => p.tier === 3));
});

test('artefact : 63+176 tracés, familles exclusives, pas de seuil', () => {
  const A = ensureArtifact();
  assert.equal(A.format, 'banane-running-surface-failure-replication-v2-capsule');
  assert.equal(A.notPropose, true);
  assert.equal(A.notCapTrace, true);
  assert.equal(A.population.field63Traced, 63);
  assert.equal(A.population.controlsTraced, 176);
  assert.equal(A.failureRows.length, 63);
  assert.equal(A.controlRows.length, 176);
  assert.equal(A.summary.questions.exclusiveSum, 63);
  assert.equal(A.incidentsLab.tracerOk, true);
  assert.equal(A.tracerValidation.capsuleOk, true);
  assert.ok(A.constants.note.includes('réglage'));
  for (const row of A.failureRows) {
    assert.notEqual(row.sessionSideContext.observedFamily, 'untraced');
    assert.notEqual(row.coarseSearch.best, null);
  }
});

test('aucune clé humaine hors postHocEvaluation', () => {
  const A = ensureArtifact();
  for (const row of A.failureRows.concat(A.controlRows)) {
    for (const bloc of T.HUMAN_FREE) {
      assert.ok(row[bloc], bloc);
      for (const [k, chemin] of keysOf(row[bloc], bloc))
        assert.ok(!FORBIDDEN.test(k), chemin);
    }
    assert.equal(row.postHocEvaluation.humanUsedForSearch, false);
    assert.equal(row.postHocEvaluation.humanUsedForWitness, false);
  }
});
