'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('../tools/running-surface-failure-replication-v2.cjs');
const G = require('../src/geometry.js');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'audit/running-surface-failure-replication-v2.json');
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
      for (const [k, x] of Object.entries(v)) { out.push([k, `${p}.${k}`]); walk(x, `${p}.${k}`); }
  })(o, base);
  return out;
}

test('geometry, capture-core, lidar et engine restent gelés', () => {
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
  const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json')));
  assert.equal(sha('src/geometry.js'), pinned['src/geometry.js']);
  assert.equal(sha('vendor/capture-core.js'), pinned['vendor/capture-core.js']);
  assert.equal(sha('vendor/lidar.js'), pinned['vendor/lidar.js']);
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.6.0-engine-baseline.json')));
  assert.equal(sha('src/engine.js'), b.engine['src/engine.js']);
  assert.equal(b.engine['src/engine.js'], 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3');
});

test('le traceur n’est pas G.propose et cite les constantes gelées', () => {
  assert.equal(T.LITERALS.robustLineMinRows, 3);
  assert.equal(T.LITERALS.refineHalf, 0.004);
  assert.equal(G.DEFAULTS.searchY, 0.08);
  assert.equal(G.DEFAULTS.searchZ, 0.04);
  assert.equal(G.DEFAULTS.grid, 0.003);
  const src = fs.readFileSync(path.join(ROOT, 'src/geometry.js'), 'utf8');
  assert.ok(src.includes("unresolved('Plan de roulement non estimable.')"));
  const tool = fs.readFileSync(path.join(ROOT, 'tools/running-surface-failure-replication-v2.cjs'), 'utf8');
  assert.ok(tool.includes('notPropose'));
  assert.ok(!tool.includes('function propose('));
});

test('traceur = moteur sur le corpus d’incidents versionné', () => {
  const lab = T.runIncidentsLab();
  assert.equal(lab.present, true);
  assert.ok(lab.validations.length >= 10);
  assert.equal(lab.tracerOk, true);
  assert.equal(lab.divergenceCount, 0);
});

test('63 échecs Plan de roulement depuis le CGD du dépôt', () => {
  const fails = T.loadCgdFailures();
  assert.equal(fails.length, 63);
  assert.equal(fails.filter(f => f.corpus === 'final-complementary').length, 62);
  assert.equal(fails.filter(f => f.corpus === 'historical-original').length, 1);
  assert.equal(fails.filter(f => f.sessionId === T.SESSION_17).length, 17);
  assert.deepEqual(fails.reduce((o, f) => { o[f.side] = (o[f.side] || 0) + 1; return o; }, {}), { right: 58, left: 5 });
});

test('témoins sans humain, trois paliers', () => {
  const W = T.selectWitnesses(T.loadCgdFailures(), T.loadShadowPool());
  assert.equal(W.humanMatching, false);
  assert.equal(W.pairs.length, 63);
  assert.equal(W.pairs.filter(p => !p.witnessKey).length, 0);
  assert.equal(W.tiers[1], 46);
  assert.equal(W.tiers[2], 0);
  assert.equal(W.tiers[3], 17);
  assert.equal(W.distinctWitnesses, 14);
  assert.ok(W.pairs.filter(p => p.failureSession === T.SESSION_17).every(p => p.tier === 3));
});

test('artefact régénérable, pas de seuil choisi', () => {
  const A = ensureArtifact();
  assert.equal(A.format, 'banane-running-surface-failure-replication-v2');
  assert.equal(A.notPropose, true);
  assert.equal(A.population.runningSurfaceFailuresFromCgd, 63);
  assert.equal(A.incidentsLab.tracerOk, true);
  assert.equal(A.rows.length, 63);
  assert.ok(A.constants.note.includes('réglage'));
  const rebuilt = T.build();
  assert.equal(rebuilt.population.runningSurfaceFailuresFromCgd, 63);
  assert.equal(rebuilt.incidentsLab.divergenceCount, 0);
});

test('aucune clé humaine hors postHocEvaluation', () => {
  const A = ensureArtifact();
  for (const row of A.rows) {
    for (const bloc of T.HUMAN_FREE) {
      assert.ok(row[bloc], bloc);
      for (const [k, chemin] of keysOf(row[bloc], bloc))
        assert.ok(!FORBIDDEN.test(k), chemin);
    }
    assert.equal(row.postHocEvaluation.humanUsedForSearch, false);
    assert.equal(row.postHocEvaluation.humanUsedForWitness, false);
  }
});

test('si les archives Natif sont présentes, chaque rail est assemblé ou fail-closed', () => {
  const A = ensureArtifact();
  if (!A.nativeDiscovery.dirsFound.length) return;
  for (const row of A.rows) {
    assert.ok(['assembled', 'fail-closed', 'visite-absente-des-corpus-chargés'].includes(row.assembly.status), row.assembly.status);
  }
  if (A.population.fieldRowsTraced)
    assert.equal(A.summary.tracerDivergences, 0);
});
