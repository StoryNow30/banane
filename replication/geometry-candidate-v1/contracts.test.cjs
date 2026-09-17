'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const R = require('./run.cjs');
const G = require('./pinned/src/geometry.js');
const B = require('./pinned/src/geometry-baseline.js');
const FAA = require('./pinned/tools/face-aware-arbitration-v1.cjs');
const CSA = require('./pinned/tools/competitive-support-arbitration-v1.cjs');
const U = require('./pinned/tools/u-hypothesis-lab-v1.cjs');
const Next = require('./pinned/tools/geometry-engine-next-v0.cjs');

const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const CAP = __dirname;

test('pinned copies are byte-identical to the 0dbcb7a sources in this repo', () => {
  const pairs = [
    ['src/geometry.js', 'pinned/src/geometry.js'],
    ['src/geometry-baseline.js', 'pinned/src/geometry-baseline.js'],
    ['vendor/capture-core.js', 'pinned/vendor/capture-core.js'],
    ['tools/geometry-engine-next-v0.cjs', 'pinned/tools/geometry-engine-next-v0.cjs'],
    ['tools/face-aware-arbitration-v1.cjs', 'pinned/tools/face-aware-arbitration-v1.cjs'],
    ['tools/competitive-support-arbitration-v1.cjs', 'pinned/tools/competitive-support-arbitration-v1.cjs'],
    ['tools/materialized-native.cjs', 'pinned/tools/materialized-native.cjs'],
    ['tools/u-hypothesis-lab-v1.cjs', 'pinned/tools/u-hypothesis-lab-v1.cjs'],
    ['audit/rsf-population-v1.json', 'pinned/audit/rsf-population-v1.json'],
  ];
  const root = path.resolve(CAP, '../..');
  for (const [src, pin] of pairs) {
    assert.equal(SHA(path.join(root, src)), SHA(path.join(CAP, pin)), src);
  }
});

test('A_STAR / S1 / DEFAULTS frozen; no new threshold in run.cjs', () => {
  const h = R.assertContracts();
  assert.equal(h.aStar, 'e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f');
  assert.equal(h.composition, '0ea0824fb9e0b763d575ee95784475632f7fe2fd18e684b68e9f765106b6b27a');
  assert.equal(h.geometry, '77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503');
  assert.equal(G.DEFAULTS.searchY, 0.08);
  assert.equal(G.DEFAULTS.searchZ, 0.04);
  assert.equal(G.DEFAULTS.minFace, 6);
  assert.equal(G.DEFAULTS.minTop, 15);
  assert.equal(G.DEFAULTS.minTemplateLossRatio, 1.5);
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  const lab = FAA.aStarLab({ points: [[0.04, 0], [0.05, 0], [0.06, 0]], uMedian: 0.05 });
  assert.equal(lab.replaceOrigin, false);
  assert.equal(lab.recenterWindow, true);
  assert.equal(lab.uSeeds.length, 1);
  const src = fs.readFileSync(path.join(CAP, 'run.cjs'), 'utf8');
  assert.equal(src.includes('minFace = 5'), false);
  assert.equal(src.includes('searchY = 0.12'), false);
  assert.equal(Next.COMPOSITION.excluded.includes('S2'), true);
});

test('hypothesesA is median of all local points; lossRatio treats Lmin≤0', () => {
  const h = U.hypothesesA([[0.02, 0], [0.04, 0], [0.10, 0]]);
  assert.equal(h[0].u, 0.04);
  assert.equal(h[0].source, 'median-all');
  assert.equal(CSA.lossRatio(0, 0), 1);
  assert.equal(CSA.lossRatio(1, 0), Infinity);
  assert.equal(CSA.lossRatio(3, 2), 1.5);
  assert.equal(CSA.inCompetitive({ loss: 3 }, 2), true);
  assert.equal(CSA.inCompetitive({ loss: 3.0001 }, 2), false);
  assert.equal(FAA.qualifyStrong({ topRows: 15, faceCount: 6, slopeLimited: false, windowOk: true }), true);
  assert.equal(FAA.qualifyStrong({ topRows: 15, faceCount: 5, slopeLimited: false, windowOk: true }), false);
});

test('lock is 239 = 63+176; run refuses a missing dataset', () => {
  const lock = Next.loadLock239();
  assert.equal(lock.n, 239);
  assert.equal(lock.failureKeys.length, 63);
  assert.equal(lock.controlKeys.length, 176);
  assert.throws(() => R.replay('/no/such/dataset', path.join(CAP, 'nope.json')), /dataset introuvable/);
});

test('capsule must not embed expected scientific identities', () => {
  const files = ['run.cjs', 'README_REPLICATION.md', 'candidate-v1-config.json', 'DEFINITIONS.md'];
  for (const f of files) {
    const t = fs.readFileSync(path.join(CAP, f), 'utf8');
    assert.equal(t.includes('humanFinalReference'), false, f);
    assert.equal(t.includes('RECOVERED_CORRECT'), false, f);
  }
});
