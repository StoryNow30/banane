'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('../tools/running-surface-failure-replication.cjs');
const G = require('../src/geometry.js');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'audit/running-surface-failure-replication-v1.json');
const FORBIDDEN = /human|reference|operator|oracle|truth|final|label/i;

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
      for (const [k, x] of Object.entries(v)) {
        out.push([k, `${p}.${k}`]);
        walk(x, `${p}.${k}`);
      }
  })(o, base);
  return out;
}

test('geometry, capture-core et engine restent les fichiers gelés du dépôt', () => {
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  const p440 = path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json');
  assert.ok(fs.existsSync(p440));
  const pinned = JSON.parse(fs.readFileSync(p440));
  const files = pinned.files || pinned;
  assert.equal(sha('src/geometry.js'), files['src/geometry.js']);
  assert.equal(sha('vendor/capture-core.js'), files['vendor/capture-core.js']);
  if (files['vendor/lidar.js']) assert.equal(sha('vendor/lidar.js'), files['vendor/lidar.js']);
  const p46 = path.join(ROOT, 'audit/v4.6.0-engine-baseline.json');
  const b = JSON.parse(fs.readFileSync(p46));
  assert.equal(sha('src/engine.js'), b.engine['src/engine.js']);
  assert.equal(b.engine['src/engine.js'], 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3');
});

test('le traceur n’est pas G.propose et cite uniquement les constantes gelées', () => {
  assert.equal(T.LITERALS.robustLineMinRows, 3);
  assert.equal(T.LITERALS.refineHalf, 0.004);
  assert.equal(T.LITERALS.refineStep, 0.001);
  assert.equal(G.DEFAULTS.searchY, 0.08);
  assert.equal(G.DEFAULTS.searchZ, 0.04);
  assert.equal(G.DEFAULTS.grid, 0.003);
  assert.equal(G.DEFAULTS.topBand, 0.012);
  const src = fs.readFileSync(path.join(ROOT, 'src/geometry.js'), 'utf8');
  assert.ok(src.includes("unresolved('Plan de roulement non estimable.')"));
  assert.ok(src.includes('search(best.u,best.z,.004,.004,.001)'));
  const tool = fs.readFileSync(path.join(ROOT, 'tools/running-surface-failure-replication.cjs'), 'utf8');
  assert.ok(tool.includes('notPropose'));
  assert.ok(!tool.includes('function propose('));
});

test('traceur = moteur sur le corpus d’incidents versionné, 0 divergence', () => {
  const lab = T.runIncidentsLab();
  assert.equal(lab.present, true);
  assert.ok(lab.validations.length >= 10);
  assert.equal(lab.tracerOk, true);
  assert.equal(lab.divergenceCount, 0);
  for (const v of lab.validations) {
    assert.equal(v.ok, true, JSON.stringify(v.divergences));
    assert.equal(v.divergences.length, 0);
  }
});

test('63 échecs Plan de roulement listés depuis le CGD du dépôt', () => {
  const fails = T.loadCgdFailures();
  assert.equal(fails.length, 63);
  assert.equal(fails.filter(f => f.corpus === 'final-complementary').length, 62);
  assert.equal(fails.filter(f => f.corpus === 'historical-original').length, 1);
  assert.equal(fails.filter(f => f.sessionId === T.SESSION_17).length, 17);
  assert.deepEqual(
    fails.reduce((o, f) => { o[f.side] = (o[f.side] || 0) + 1; return o; }, {}),
    { right: 58, left: 5 },
  );
  assert.ok(fails.every(f => f.exitReason === T.REASON_RUNNING));
});

test('témoins sans référence humaine, méthode à trois paliers publiée', () => {
  const fails = T.loadCgdFailures();
  const pool = T.loadShadowPool();
  const W = T.selectWitnesses(fails, pool);
  assert.equal(W.humanMatching, false);
  assert.equal(W.method.length, 3);
  assert.equal(W.pairs.length, 63);
  assert.equal(W.pairs.filter(p => !p.witnessKey).length, 0);
  const session17 = W.pairs.filter(p => p.failureSession === T.SESSION_17);
  assert.equal(session17.length, 17);
  assert.ok(session17.every(p => p.tier === 3));
});

test('artefact régénérable, 63 rails, pas de seuil choisi', () => {
  const A = ensureArtifact();
  assert.equal(A.format, 'banane-running-surface-failure-replication-v1');
  assert.equal(A.notPropose, true);
  assert.equal(A.population.runningSurfaceFailuresFromCgd, 63);
  assert.equal(A.incidentsLab.tracerOk, true);
  assert.ok(A.constants.note.includes('réglage'));
  assert.equal(typeof A.answers.q9_mechanismForPrototype, 'string');
  assert.ok(!A.answers.q9_mechanismForPrototype.includes('='));
  assert.equal(A.rows.length, 63);
  const rebuilt = T.build();
  assert.equal(rebuilt.population.runningSurfaceFailuresFromCgd, 63);
  assert.equal(rebuilt.incidentsLab.divergenceCount, 0);
});

test('aucune clé humaine hors postHocEvaluation', () => {
  const A = ensureArtifact();
  assert.deepEqual(A.blocks.humanFreeBlocks, T.HUMAN_FREE_BLOCKS);
  for (const row of A.rows) {
    for (const bloc of T.HUMAN_FREE_BLOCKS) {
      assert.ok(row[bloc], bloc);
      for (const [k, chemin] of keysOf(row[bloc], bloc))
        assert.ok(!FORBIDDEN.test(k), chemin);
    }
    assert.ok(row.postHocEvaluation);
    assert.equal(row.postHocEvaluation.humanUsedForSearch, false);
    assert.equal(row.postHocEvaluation.humanUsedForWitness, false);
  }
});
