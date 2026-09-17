'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const Lab = require('../tools/face-aware-arbitration-v1.cjs');
const Stab = require('../tools/u-recentering-stabilization-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const REPORT = path.join(ROOT, 'audit/face-aware-arbitration-v1.json');

function loadCorpusCapture(cut = 2856) {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  const item = index.paired.find(x => x.cut === cut) || index.paired[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
}

test('geometry-baseline.js remains frozen; A_STAR hash frozen; searchY/Z unchanged', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  assert.equal(Lab.ENGINE_Y, 0.08);
  assert.equal(Lab.ENGINE_Z, 0.04);
  assert.equal(G.DEFAULTS.minFace, 6);
  assert.equal(G.DEFAULTS.minTop, 15);
  const h = Lab.assertAStarFrozen();
  assert.equal(h, Lab.A_STAR_HASH);
  assert.equal(h, 'e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f');
});

test('default propose path still matches baseline (onCoarse inactive)', () => {
  const capture = loadCorpusCapture(2856);
  const a = B.propose(capture, 'left');
  const b = G.propose(capture, 'left');
  assert.equal(b.status, a.status);
  assert.deepEqual(b.delta, a.delta);
});

test('onCoarse does not change the selected placement', () => {
  const capture = loadCorpusCapture(2856);
  const plain = G.propose(capture, 'left', { lab: { uSeeds: [0.02], replaceOrigin: false, recenterWindow: true } });
  let n = 0;
  const hooked = G.propose(capture, 'left', {
    lab: {
      uSeeds: [0.02], replaceOrigin: false, recenterWindow: true,
      onCoarse(coarse) { n = coarse.length; },
    },
  });
  assert.ok(n > 100);
  assert.equal(hooked.status, plain.status);
  assert.deepEqual(hooked.delta, plain.delta);
  assert.equal(hooked.parameters.searchY, 0.08);
});

test('9644 is not a coded exception; the 5 cuts are listed separately', () => {
  assert.ok(Lab.KEY_9644.includes('|9644|right'));
  assert.deepEqual(Lab.CUTS_5, [5090, 5113, 5125, 5151, 5240]);
  const src = fs.readFileSync(path.join(ROOT, 'tools/face-aware-arbitration-v1.cjs'), 'utf8');
  assert.equal(src.includes('if (key === KEY_9644)'), false);
  assert.equal(src.includes('if(key===KEY_9644)'), false);
});

test('faceTier and Pareto dominance', () => {
  assert.equal(Lab.faceTier(6), 'STRONG_FACE');
  assert.equal(Lab.faceTier(3), 'PARTIAL_FACE');
  assert.equal(Lab.faceTier(0), 'WEAK_FACE');
  const a = { loss: 1, topRows: 20, faceCount: 6 };
  const b = { loss: 2, topRows: 10, faceCount: 0 };
  assert.equal(Lab.dominates(a, b), true);
  assert.equal(Lab.dominates(b, a), false);
  const c = { loss: 1, topRows: 10, faceCount: 8 };
  assert.equal(Lab.dominates(a, c), false);
  assert.equal(Lab.dominates(c, a), false);
});

test('policy A prefers STRONG_FACE over a weaker min-loss', () => {
  const pool = [
    { u: -0.008, z: -0.008, loss: 5e-6, topRows: 85, faceCount: 0, slopeLimited: false, windowOk: true, tier: 'WEAK_FACE', motif: 'flank' },
    { u: -0.021, z: -0.006, loss: 7e-6, topRows: 91, faceCount: 24, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
  ];
  const a = Lab.policyA(pool);
  assert.equal(a.status, 'candidate');
  assert.equal(a.pick.u, -0.021);
  assert.equal(a.fellThrough, false);
  const loss = Lab.policyLossFirst(pool);
  assert.equal(loss.pick.u, -0.008);
  const c = Lab.policyC(pool);
  assert.equal(c.status, 'candidate');
  assert.equal(c.pick.faceCount, 24);
});

test('policy C does not auto-publish PARTIAL_FACE', () => {
  const pool = [
    { u: 0.16, z: 0.01, loss: 4e-6, topRows: 40, faceCount: 4, slopeLimited: false, windowOk: true, tier: 'PARTIAL_FACE', motif: 'flank' },
  ];
  const c = Lab.policyC(pool);
  assert.equal(c.status, 'unresolved');
  assert.equal(c.motif, 'partial-abstain');
});

test('A_STAR seed is hypothesesA median, not prepareFrame index-median', () => {
  const cfg = Lab.aStarFrozen();
  assert.equal(cfg.searchY, 0.08);
  assert.equal(cfg.lab.replaceOrigin, false);
  assert.equal(cfg.minFace, 6);
  assert.equal(Stab.aStarConfig().searchY, 0.08);
  const U = require('../tools/u-hypothesis-lab-v1.cjs');
  const Prev = require('../tools/no-support-generator-lab-v1.cjs');
  const capture = loadCorpusCapture(2856);
  const frame = Prev.prepareFrame(capture, 'left');
  if (frame.ok) {
    const lab = Lab.aStarLab(frame);
    const expected = U.hypothesesA(frame.points)[0].u;
    assert.equal(lab.uSeeds[0], expected);
    assert.equal(lab.replaceOrigin, false);
    assert.equal(lab.recenterWindow, true);
  }
});

test('report lock', () => {
  if (!fs.existsSync(REPORT)) return;
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.format, 'face-aware-arbitration-v1');
  assert.equal(report.science.searchY, 0.08);
  assert.equal(report.science.searchZ, 0.04);
  assert.equal(report.science.minFace, 6);
  assert.equal(report.science.aStarFrozen, true);
  assert.equal(report.science.aStarHash, Lab.A_STAR_HASH);
  assert.equal(report.hashes.baselineUnchanged, true);
  assert.equal(report.science.c9644.hardcodedException, false);
  assert.equal(report.science.five.length, 5);
  assert.equal(report.science.partial22.n, 22);
  assert.equal(report.science.astarTally.candidate, 22);
  assert.equal(report.science.astarTally.flank, 27);
  assert.equal(report.science.c9644.astar.motif, 'flank');
  assert.equal(report.science.c9644.hardcodedException, false);
  assert.equal(report.science.comparisons.A.restored9644, true);
  assert.equal(report.science.comparisons.C.restored9644, true);
  assert.equal(report.science.comparisons.B.status, 'REGRESSIVE');
  assert.ok(['PROMISING', 'NEUTRAL', 'REGRESSIVE', 'INCONCLUSIVE'].includes(report.science.lotStatus));
  for (const id of ['LOSS_FIRST', 'A', 'B', 'C']) {
    assert.ok(report.science.comparisons[id]);
  }
});
