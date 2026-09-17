'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const Lab = require('../tools/competitive-support-arbitration-v1.cjs');
const FAA = require('../tools/face-aware-arbitration-v1.cjs');
const U = require('../tools/u-hypothesis-lab-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const REPORT = path.join(ROOT, 'audit/competitive-support-arbitration-v1.json');

function loadCorpusCapture(cut = 2856) {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  const item = index.paired.find(x => x.cut === cut) || index.paired[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
}

test('geometry-baseline frozen; A_STAR hash frozen; no new threshold', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  assert.equal(Lab.ENGINE_Y, 0.08);
  assert.equal(Lab.ENGINE_Z, 0.04);
  assert.equal(G.DEFAULTS.minFace, 6);
  assert.equal(G.DEFAULTS.minTop, 15);
  assert.equal(G.DEFAULTS.minTemplateLossRatio, 1.5);
  assert.equal(Lab.RATIO, 1.5);
  const h = FAA.assertAStarFrozen();
  assert.equal(h, Lab.A_STAR_HASH);
  assert.equal(h, 'e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f');
});

test('aStarLab uses hypothesesA, not prepareFrame index-median', () => {
  const capture = loadCorpusCapture(2856);
  const Prev = require('../tools/no-support-generator-lab-v1.cjs');
  const frame = Prev.prepareFrame(capture, 'left');
  const lab = FAA.aStarLab(frame);
  const hA = U.hypothesesA(frame.points)[0].u;
  assert.equal(lab.uSeeds[0], hA);
  assert.equal(lab.replaceOrigin, false);
  assert.equal(lab.recenterWindow, true);
});

test('9644 is not a coded exception', () => {
  assert.ok(Lab.KEY_9644.includes('|9644|right'));
  assert.deepEqual(Lab.CUTS_5, [5090, 5113, 5125, 5151, 5240]);
  const src = fs.readFileSync(path.join(ROOT, 'tools/competitive-support-arbitration-v1.cjs'), 'utf8');
  assert.equal(src.includes('if (key === KEY_9644)'), false);
  assert.equal(src.includes('if(key===KEY_9644)'), false);
});

test('S1 does not change an already-qualified A_STAR candidate', () => {
  const astar = { status: 'candidate', motif: 'candidate', topRows: 40, faceCount: 8, slopeLimited: false, loss: 1e-6, seed: [0.01, 0], reason: null };
  const pool = [
    { u: 0.01, z: 0, loss: 1e-6, topRows: 40, faceCount: 8, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
    { u: 0.04, z: 0, loss: 1.2e-6, topRows: 50, faceCount: 20, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
  ];
  const view = Lab.competitiveView(pool, 1e-6);
  const s1 = Lab.policyS1(astar, pool, { sign: 1 }, view);
  assert.equal(s1.activated, false);
  assert.equal(s1.changed, false);
  assert.equal(s1.status, 'candidate');
  assert.equal(s1.pick.u, 0.01);
});

test('S1 excludes a STRONG with ratio > 1.5 and keeps unresolved', () => {
  const astar = { status: 'unresolved', motif: 'flank', topRows: 30, faceCount: 4, slopeLimited: false, loss: 1e-6, seed: [0.16, 0.01], reason: 'Flanc interne insuffisamment observé.' };
  const pool = [
    { u: 0.16, z: 0.01, loss: 1e-6, topRows: 30, faceCount: 4, slopeLimited: false, windowOk: true, tier: 'PARTIAL_FACE', motif: 'flank' },
    { u: 0.14, z: 0.00, loss: 20e-6, topRows: 16, faceCount: 11, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
  ];
  const view = Lab.competitiveView(pool, 1e-6);
  assert.equal(view.nStrongCompetitive, 0);
  const s1 = Lab.policyS1(astar, pool, { sign: -1 }, view);
  assert.equal(s1.status, 'unresolved');
  assert.equal(s1.motif, 'flank');
  assert.equal(s1.changed, false);
  assert.equal(s1.nStrongCompetitive, 0);
});

test('S1 selects the unique competitive STRONG (9644-shaped, not hardcoded)', () => {
  const astar = { status: 'unresolved', motif: 'flank', topRows: 85, faceCount: 0, slopeLimited: false, loss: 5.28e-6, seed: [-0.00795, -0.008], reason: 'Flanc interne insuffisamment observé.' };
  const pool = [
    { u: 0.00795, z: -0.008, loss: 5.28e-6, topRows: 85, faceCount: 0, slopeLimited: false, windowOk: false, tier: 'WEAK_FACE', motif: 'flank' },
    { u: 0.021, z: -0.006, loss: 6.91e-6, topRows: 91, faceCount: 24, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
    { u: 0.00895, z: -0.007, loss: 7.92e-6, topRows: 81, faceCount: 9, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
  ];
  const lmin = 5.28e-6;
  assert.ok(Lab.inCompetitive(pool[1], lmin));
  assert.ok(Lab.lossRatio(pool[1].loss, lmin) < 1.5);
  const view = Lab.competitiveView(pool, lmin);
  assert.equal(view.nStrongCompetitive, 2);
  assert.equal(view.nClusters, 1);
  const s1 = Lab.policyS1(astar, pool, { sign: -1 }, view);
  assert.equal(s1.status, 'candidate');
  assert.equal(s1.pick.faceCount, 24);
  assert.equal(s1.changed, true);
  const s2 = Lab.policyS2(astar, pool, { sign: -1 }, view);
  assert.equal(s2.status, 'candidate');
  assert.equal(s2.pick.faceCount, 24);
});

test('S1 is ambiguous when two competitive STRONG clusters are spatially distinct', () => {
  const astar = { status: 'unresolved', motif: 'flank', topRows: 20, faceCount: 4, slopeLimited: false, loss: 1e-6, seed: [0, 0], reason: 'x' };
  const pool = [
    { u: 0, z: 0, loss: 1e-6, topRows: 20, faceCount: 4, slopeLimited: false, windowOk: true, tier: 'PARTIAL_FACE', motif: 'flank' },
    { u: 0.00, z: 0.001, loss: 1.1e-6, topRows: 30, faceCount: 8, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
    { u: 0.05, z: 0.001, loss: 1.2e-6, topRows: 30, faceCount: 9, slopeLimited: false, windowOk: true, tier: 'STRONG_FACE', motif: 'candidate' },
  ];
  const view = Lab.competitiveView(pool, 1e-6);
  assert.equal(view.nClusters, 2);
  const s1 = Lab.policyS1(astar, pool, { sign: 1 }, view);
  assert.equal(s1.motif, 'ambiguity');
  assert.equal(s1.status, 'unresolved');
  const s2 = Lab.policyS2(astar, pool, { sign: 1 }, view);
  assert.equal(s2.motif, 'ambiguity');
});

test('report lock', () => {
  if (!fs.existsSync(REPORT)) return;
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.format, 'competitive-support-arbitration-v1');
  assert.equal(report.science.searchY, 0.08);
  assert.equal(report.science.searchZ, 0.04);
  assert.equal(report.science.minFace, 6);
  assert.equal(report.science.minTemplateLossRatio, 1.5);
  assert.equal(report.science.noNewThreshold, true);
  assert.equal(report.science.aStarFrozen, true);
  assert.equal(report.science.aStarHash, Lab.A_STAR_HASH);
  assert.equal(report.hashes.baselineUnchanged, true);
  assert.equal(report.parity.pass, true);
  assert.equal(report.parity.faaVsStab.pass, true);
  assert.equal(report.parity.currentVsFaa.pass, true);
  assert.equal(report.science.c9644.hardcodedException, false);
  assert.equal(report.science.five.length, 5);
  assert.equal(report.science.partial22.n, 22);
  assert.equal(report.science.astarTally.candidate, 22);
  assert.equal(report.science.astarTally.flank, 27);
  assert.ok(['PROMISING', 'NEUTRAL', 'REGRESSIVE', 'INCONCLUSIVE'].includes(report.science.lotStatus));
  for (const id of ['S1', 'S2']) assert.ok(report.science.comparisons[id]);
  assert.equal(report.science.comparisons.S1.controls.activatedOnStrong, 0);
  assert.equal(report.science.comparisons.S1.publishedFar, 0);
});
