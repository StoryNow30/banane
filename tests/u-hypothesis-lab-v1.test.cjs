'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const Lab = require('../tools/u-hypothesis-lab-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const POP = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/u-hypothesis-population-v1.json'), 'utf8'));
const REPORT = path.join(ROOT, 'audit/u-hypothesis-lab-v1.json');

function loadCorpusCapture(cut = 2856) {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  const item = index.paired.find(x => x.cut === cut) || index.paired[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
}

test('geometry-baseline.js remains the frozen original hash', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.equal(Lab.BASELINE_GEOMETRY_SHA, BASELINE_SHA);
});

test('DEFAULTS are unchanged vs baseline (searchY=0.08 searchZ=0.04)', () => {
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  assert.equal(Lab.ENGINE_Y, 0.08);
  assert.equal(Lab.ENGINE_Z, 0.04);
  assert.equal(Lab.ENGINE_GRID, 0.003);
  assert.equal(G.DEFAULTS.searchY, 0.08);
  assert.equal(G.DEFAULTS.searchZ, 0.04);
});

test('population lock is 53 failures + 53 controls, disjoint, includes 836/756', () => {
  const pop = Lab.loadPopulation();
  assert.equal(pop.failureKeys.length, 53);
  assert.equal(pop.controlKeys.length, 53);
  assert.equal(new Set(pop.failureKeys).size, 53);
  assert.equal(new Set(pop.controlKeys).size, 53);
  const fail = new Set(pop.failureKeys);
  for (const k of pop.controlKeys) assert.equal(fail.has(k), false);
  assert.equal(pop.excludedFamilyKeys.length, 6);
  const k836 = Object.keys(Lab.EXCEPTIONS).find(k => k.includes('|836|'));
  const k756 = Object.keys(Lab.EXCEPTIONS).find(k => k.includes('|756|'));
  assert.ok(fail.has(k836));
  assert.ok(fail.has(k756));
  assert.equal(Lab.exceptionOf(k836), 'hors-Z');
  assert.equal(Lab.exceptionOf(k756), 'hors-U+Z');
  assert.deepEqual(pop.failureKeys, POP.failureKeys);
  assert.deepEqual(pop.controlKeys, POP.controlKeys);
});

test('variants do not change searchY or searchZ', () => {
  assert.deepEqual(Object.keys(Lab.VARIANTS), ['BASELINE', 'A', 'A_NO_WINDOW', 'B', 'C']);
  const dummy = { A: [{ u: -0.14 }], B: [{ u: -0.17 }], C: [{ u: -0.17 }, { u: 0 }] };
  for (const spec of Object.values(Lab.VARIANTS)) {
    const lab = spec.buildLab(dummy);
    if (lab) {
      assert.equal(lab.searchY, undefined);
      assert.equal(lab.searchZ, undefined);
      assert.ok(Array.isArray(lab.uSeeds));
    }
  }
  assert.equal(Lab.VARIANTS.A.buildLab(dummy).recenterWindow, true);
  assert.equal(Lab.VARIANTS.A_NO_WINDOW.buildLab(dummy).recenterWindow, false);
  assert.equal(Lab.VARIANTS.A.buildLab(dummy).replaceOrigin, true);
});

test('default propose path is unchanged vs frozen baseline on corpus', () => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  for (const item of index.paired.slice(0, 6)) {
    const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
    for (const side of ['left', 'right']) {
      if (!capture.rails?.[side]) continue;
      const a = B.propose(capture, side);
      const b = G.propose(capture, side);
      assert.equal(b.status, a.status, `${item.cut} ${side}`);
      assert.deepEqual(b.delta, a.delta);
      assert.equal(b.confidence, a.confidence);
      assert.deepEqual(b.reasons, a.reasons);
      assert.equal(b.parameters.lab, undefined);
    }
  }
});

test('uSeeds + replaceOrigin + recenterWindow still matches baseline when seed is 0', () => {
  const capture = loadCorpusCapture(2856);
  const a = B.propose(capture, 'left');
  const b = G.propose(capture, 'left', { lab: { uSeeds: [0], replaceOrigin: true, recenterWindow: true } });
  assert.equal(b.status, a.status);
  assert.deepEqual(b.delta, a.delta);
  assert.ok(b.parameters.lab);
  assert.deepEqual(b.metrics.lab.uCenters, [0]);
});

test('cloudUSeed is median U of local points', () => {
  const capture = loadCorpusCapture(2856);
  const p = G.propose(capture, 'left', { lab: { cloudUSeed: true, replaceOrigin: true, recenterWindow: true } });
  assert.ok(p.parameters.lab.cloudUSeed);
  assert.ok(Array.isArray(p.metrics?.lab?.uCenters));
  assert.equal(p.metrics.lab.uCenters.length, 1);
});

test('highZSubset drops low-z ballast without a human oracle', () => {
  const points = [];
  for (let i = 0; i < 20; i++) points.push([0.00, 0.010, 0]);
  for (let i = 0; i < 20; i++) points.push([0.16, -0.06, 0]);
  const sub = Lab.highZSubset(points);
  assert.equal(sub.fallback, 'high-z-q70');
  const u = Lab.median(sub.points.map(p => p[0]));
  assert.ok(Math.abs(u) < 0.04, 'nappe haute must sit near u=0, not ballast at 0.16');
  assert.ok(sub.n >= 8);
});

test('hypothesesA is the full-cloud median', () => {
  const points = [[-0.17, 0.01, 0], [-0.16, 0.01, 0], [0.02, -0.05, 0], [0.03, -0.05, 0], [0.04, -0.08, 0]];
  const h = Lab.hypothesesA(points);
  assert.equal(h.length, 1);
  assert.equal(h[0].source, 'median-all');
  assert.equal(h[0].u, Lab.median(points.map(p => p[0])));
});

test('hypothesesB uses the high-z subset, not the full cloud', () => {
  const points = [];
  for (let i = 0; i < 12; i++) points.push([-0.17, 0.012, 0]);
  for (let i = 0; i < 12; i++) points.push([0.05, -0.07, 0]);
  const a = Lab.hypothesesA(points)[0].u;
  const b = Lab.hypothesesB(points)[0].u;
  assert.ok(Math.abs(b - (-0.17)) < 0.01, 'B must sit on the high nappe');
  assert.ok(Math.abs(a - b) > 0.05, 'A is contaminated relative to B');
});

test('densityPeaks finds two well-separated modes', () => {
  const points = [];
  for (let i = 0; i < 30; i++) points.push([-0.16 + (i % 3) * 0.004, 0.01, 0]);
  for (let i = 0; i < 30; i++) points.push([0.00 + (i % 3) * 0.004, 0.01, 0]);
  const hist = Lab.uHistogram(points);
  const peaks = Lab.densityPeaks(hist);
  assert.ok(peaks.length >= 2);
  const span = Math.max(...peaks.map(p => p.u)) - Math.min(...peaks.map(p => p.u));
  assert.ok(span > 0.08);
});

test('mergeHypotheses caps and deduplicates', () => {
  const merged = Lab.mergeHypotheses([
    { u: -0.17, score: 10, source: 'a' },
    { u: -0.165, score: 8, source: 'b' },
    { u: 0.00, score: 4, source: 'c' },
    { u: 0.08, score: 3, source: 'd' },
    { u: 0.12, score: 2, source: 'e' },
    { u: 0.16, score: 1, source: 'f' },
  ], 0.02, 5);
  assert.ok(merged.length <= 5);
  assert.ok(merged.every((h, i) => merged.slice(i + 1).every(o => Math.abs(o.u - h.u) >= 0.02)));
  assert.equal(merged[0].u, -0.17);
});

test('recenterWindow keeps searchY=0.08 and records the displaced seed', () => {
  const capture = loadCorpusCapture(2856);
  const rec = G.propose(capture, 'left', {
    lab: { uSeeds: [0.12], replaceOrigin: true, recenterWindow: true },
  });
  const frozen = G.propose(capture, 'left', {
    lab: { uSeeds: [0.12], replaceOrigin: true, recenterWindow: false },
  });
  assert.equal(G.DEFAULTS.searchY, 0.08);
  assert.equal(rec.parameters.searchY, 0.08);
  assert.equal(rec.parameters.searchZ, 0.04);
  assert.deepEqual(rec.metrics?.lab?.uCenters, [0.12]);
  assert.equal(rec.metrics.lab.recenterWindow, true);
  assert.equal(frozen.metrics.lab.recenterWindow, false);
  if (rec.status === 'candidate' && rec.delta && Math.abs(rec.delta[1]) > 0.09) {
    assert.notEqual(frozen.status, 'candidate');
    assert.match((frozen.reasons || []).join(' '), /fenêtre|Plan de roulement|Flanc|placements concurrents/);
  }
});

test('report lock after the bench: 53+53, no searchY mutation, 836/756 tagged', () => {
  if (!fs.existsSync(REPORT)) {
    assert.ok(true, 'report not generated yet — skip lock');
    return;
  }
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.format, 'u-hypothesis-lab-v1');
  assert.equal(report.branch, 'lab-u-hypothesis-v1');
  assert.equal(report.population.failureKeys.length, 53);
  assert.equal(report.population.controlKeys.length, 53);
  assert.equal(report.science.searchY, 0.08);
  assert.equal(report.science.searchZ, 0.04);
  assert.equal(report.science.notAGlobalSearchY, true);
  const tagged = report.rails.filter(r => r.exception);
  assert.equal(tagged.length, 2);
  const tags = tagged.map(r => r.exception).sort();
  assert.deepEqual(tags, ['hors-U+Z', 'hors-Z']);
  for (const id of ['BASELINE', 'A', 'B', 'C']) {
    assert.ok(report.science.comparisons[id]);
    assert.ok(['PROMISING', 'NEUTRAL', 'REGRESSIVE', 'INCONCLUSIVE'].includes(report.science.comparisons[id].status));
  }
  assert.ok(['PROMISING', 'NEUTRAL', 'REGRESSIVE', 'INCONCLUSIVE'].includes(report.science.lotStatus));
  assert.equal(report.hashes.baselineUnchanged, true);
  assert.equal(report.science.lotStatus, 'INCONCLUSIVE');
  assert.equal(report.science.comparisons.A.failures51.recovered, 22);
  assert.equal(report.science.comparisons.A_NO_WINDOW.failures51.recovered, 0);
  assert.equal(report.science.comparisons.A_NO_WINDOW.failures51.shifts['rsf→window'], 50);
  assert.equal(report.science.comparisons.C.status, 'REGRESSIVE');
  assert.equal(report.science.searchY, 0.08);
});
