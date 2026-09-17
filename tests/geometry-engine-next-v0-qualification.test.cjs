'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const FAA = require('../tools/face-aware-arbitration-v1.cjs');
const Next = require('../tools/geometry-engine-next-v0.cjs');
const Q = require('../tools/geometry-engine-next-v0-qualification.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const REPORT = path.join(ROOT, 'audit/geometry-engine-next-v0-qualification.json');
const FROZEN = path.join(ROOT, 'audit/geometry-engine-next-v0.json');

test('engine frozen; A_STAR frozen; S1 unchanged; no new threshold', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  assert.equal(G.DEFAULTS.searchY, 0.08);
  assert.equal(G.DEFAULTS.searchZ, 0.04);
  assert.equal(G.DEFAULTS.minFace, 6);
  assert.equal(G.DEFAULTS.minTop, 15);
  assert.equal(G.DEFAULTS.minTemplateLossRatio, 1.5);
  const h = FAA.assertAStarFrozen();
  assert.equal(h, Next.A_STAR_HASH);
  const frozen = JSON.parse(fs.readFileSync(FROZEN, 'utf8'));
  assert.equal(SHA(path.join(ROOT, 'src/geometry.js')), frozen.hashes.geometry);
  assert.equal(Next.COMPOSITION_HASH, frozen.hashes.composition);
  const src = fs.readFileSync(path.join(ROOT, 'tools/geometry-engine-next-v0-qualification.cjs'), 'utf8');
  assert.equal(src.includes('minFace = 5') || src.includes('minFace: 5'), false);
  assert.equal(src.includes('searchY = 0.12'), false);
  assert.ok(src.includes('CSA.policyS1') || src.includes('Next.analyseAssembled') || src.includes('CSA.analyseRail'));
});

test('9644 is not a coded exception; 5146 contract is observational', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/geometry-engine-next-v0-qualification.cjs'), 'utf8');
  assert.equal(src.includes('if (key === KEY_9644)'), false);
  assert.equal(src.includes('if(key===KEY_5146)'), false);
  const deep = {
    ok: true,
    astar: { slopeLimited: true, u: 0.16, z: 0.01 },
    next: {
      topRows: 39, faceCount: 9, slopeLimited: false, motif: 'candidate',
      windowOk: true, loss: 8e-6, u: 0.156, z: 0.014,
    },
    lmin: 6e-6,
  };
  const a = Q.classify5146(deep);
  assert.equal(a.kind, 'VALID_ALTERNATIVE');
  const bypass = Q.classify5146({ ...deep, next: { ...deep.next, slopeLimited: true } });
  assert.equal(bypass.kind, 'CONTRACT_BYPASS');
});

test('oracle labels do not invent millimetres', () => {
  assert.equal(Q.qualifyOracle('candidate-observed', [0, 0.01, 0]), 'QUALIFIED');
  assert.equal(Q.qualifyOracle('candidate-timing-uncertain', [0, 0, 0]), 'AMBIGUOUS');
  assert.equal(Q.qualifyOracle(null, null), 'UNAVAILABLE');
  assert.equal(Q.vsHuman(0.004, 0.034, 'QUALIFIED'), 'IMPROVED');
  assert.equal(Q.vsHuman(0.034, 0.004, 'QUALIFIED'), 'REGRESSED');
  assert.equal(Q.vsHumanGrid(0.0048, 0.0042, 'QUALIFIED'), 'EQUIVALENT');
  assert.equal(Q.bandOf(0.009), 'le10');
  assert.equal(Q.bandOf(0.011), 'b10_20');
  assert.equal(Q.bandOf(0.03), 'b20_50');
  assert.equal(Q.bandOf(0.13), 'gt50');
});

test('report lock', () => {
  if (!fs.existsSync(REPORT)) return;
  const q = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(q.format, 'geometry-engine-next-v0-qualification');
  assert.equal(q.science.searchY, 0.08);
  assert.equal(q.science.minFace, 6);
  assert.equal(q.science.minTemplateLossRatio, 1.5);
  assert.equal(q.science.noNewThreshold, true);
  assert.equal(q.science.engineUntouched, true);
  assert.equal(q.hashes.baselineUnchanged, true);
  assert.ok(['PROMOTE_TO_GEOMETRY_CANDIDATE_V1', 'KEEP_IN_LAB', 'REGRESSIVE', 'INCONCLUSIVE'].includes(q.verdict.verdict));
  assert.equal(q.parity.n, 239);
  if (q.parity.pass) {
    assert.equal(q.coverage.assembled, 239);
    assert.equal(q.audit5146.kind === 'VALID_ALTERNATIVE' || q.audit5146.kind === 'CONTRACT_BYPASS', true);
    assert.equal(q.audit154.s1Activated, false);
    assert.equal(q.recoveries.n, 25);
    assert.equal(q.s1Four.n, 4);
  }
});
