'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const Lab = require('../tools/no-support-generator-lab-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const POP = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/no-support-population-v1.json'), 'utf8'));
const REPORT = path.join(ROOT, 'audit/no-support-generator-lab-v1.json');

function loadCorpusCapture(cut = 2856) {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  const item = index.paired.find(x => x.cut === cut) || index.paired[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
}

test('geometry-baseline.js remains the frozen original hash', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.equal(Lab.BASELINE_GEOMETRY_SHA, BASELINE_SHA);
});

test('DEFAULTS are unchanged vs baseline', () => {
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  assert.equal(Lab.ENGINE_Y, 0.08);
  assert.equal(Lab.ENGINE_Z, 0.04);
  assert.equal(Lab.ENGINE_GRID, 0.003);
});

test('population lock is exactly 53 failures, disjoint from the 6', () => {
  const pop = Lab.loadPopulation();
  assert.equal(pop.failureKeys.length, 53);
  assert.equal(new Set(pop.failureKeys).size, 53);
  assert.equal(pop.excludedFamilyKeys.length, 6);
  const fail = new Set(pop.failureKeys);
  for (const k of pop.excludedFamilyKeys) assert.equal(fail.has(k), false);
  assert.ok(pop.failureKeys.every(k => k.includes('|')));
  assert.equal(pop.failureKeys.filter(k => k.endsWith('|left')).length, 3);
  assert.equal(pop.failureKeys.filter(k => k.endsWith('|right')).length, 50);
  assert.deepEqual(pop.failureKeys, POP.failureKeys);
});

test('A–E are diagnostic spacing tests, not engine prototypes', () => {
  assert.deepEqual(Object.keys(Lab.EXPERIMENTS), ['A_ENGINE', 'B_DENSE', 'C_EXT_Z', 'D_EXT_U', 'E_EXT_UZ']);
  assert.equal(Lab.EXPERIMENTS.A_ENGINE.grid, 0.003);
  assert.equal(Lab.EXPERIMENTS.B_DENSE.grid, 0.001);
  assert.equal(Lab.EXPERIMENTS.B_DENSE.searchY, 0.08);
  assert.equal(Lab.EXPERIMENTS.B_DENSE.searchZ, 0.04);
  assert.equal(Lab.EXPERIMENTS.C_EXT_Z.searchZ, 0.10);
  assert.equal(Lab.EXPERIMENTS.C_EXT_Z.searchY, 0.08);
  assert.equal(Lab.EXPERIMENTS.D_EXT_U.searchY, 0.20);
  assert.equal(Lab.EXPERIMENTS.D_EXT_U.searchZ, 0.04);
  assert.equal(Lab.EXPERIMENTS.E_EXT_UZ.searchY, 0.20);
  assert.equal(Lab.EXPERIMENTS.E_EXT_UZ.searchZ, 0.10);
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

test('offline frame + A scan on a corpus rail finds engine support', () => {
  const capture = loadCorpusCapture(2856);
  const frame = Lab.prepareFrame(capture, 'left');
  assert.equal(frame.ok, true);
  const A = Lab.scanGrid(frame, Lab.EXPERIMENTS.A_ENGINE);
  assert.ok(A.nCells > 1000);
  assert.ok(A.nSupported >= 3, 'corpus left should have running-surface support on the engine grid');
  const Bscan = Lab.scanGrid(frame, Lab.EXPERIMENTS.B_DENSE);
  assert.ok(Bscan.nSupported >= A.nSupported);
  const cls = Lab.classifyRail({
    A_ENGINE: A,
    B_DENSE: Bscan,
    C_EXT_Z: Lab.scanGrid(frame, Lab.EXPERIMENTS.C_EXT_Z),
    D_EXT_U: Lab.scanGrid(frame, Lab.EXPERIMENTS.D_EXT_U),
    E_EXT_UZ: Lab.scanGrid(frame, Lab.EXPERIMENTS.E_EXT_UZ),
  }, A.lossBest.loss, 'control');
  assert.equal(cls.category, 'ENGINE_SUPPORT_PRESENT');
});

test('classifyRail: empty scans → NO_SUPPORT_FOUND for a failure', () => {
  const empty = { nSupported: 0, hits: [], supportBest: null };
  const cls = Lab.classifyRail({
    A_ENGINE: empty, B_DENSE: empty, C_EXT_Z: empty, D_EXT_U: empty, E_EXT_UZ: empty,
  }, 1e-4, 'failure');
  assert.equal(cls.category, 'NO_SUPPORT_FOUND');
});

test('classifyRail: dense in-domain hit → SUPPORT_BETWEEN_GRID', () => {
  const empty = { nSupported: 0, hits: [], supportBest: null };
  const hit = { u: 0.01, z: 0.002, topRows: 8, loss: 1e-5, binsTop: 4, faceCount: 6, outsideU: false, outsideZ: false };
  const cls = Lab.classifyRail({
    A_ENGINE: empty,
    B_DENSE: { nSupported: 1, hits: [hit], supportBest: hit },
    C_EXT_Z: empty, D_EXT_U: empty, E_EXT_UZ: empty,
  }, 1e-4, 'failure');
  assert.equal(cls.category, 'SUPPORT_BETWEEN_GRID');
});

test('classifyRail: only outside Z → SUPPORT_OUTSIDE_Z', () => {
  const empty = { nSupported: 0, hits: [], supportBest: null };
  const hit = { u: 0.01, z: 0.07, topRows: 8, loss: 1e-5, binsTop: 4, faceCount: 6, outsideU: false, outsideZ: true };
  const cls = Lab.classifyRail({
    A_ENGINE: empty, B_DENSE: empty,
    C_EXT_Z: { nSupported: 1, hits: [hit], supportBest: hit },
    D_EXT_U: empty, E_EXT_UZ: empty,
  }, 1e-4, 'failure');
  assert.equal(cls.category, 'SUPPORT_OUTSIDE_Z');
});

test('classifyRail: high-loss 3-point accident → IMPLAUSIBLE', () => {
  const empty = { nSupported: 0, hits: [], supportBest: null };
  const hit = { u: 0.01, z: 0.002, topRows: 3, loss: 0.02, binsTop: 1, faceCount: 0, outsideU: false, outsideZ: false };
  const cls = Lab.classifyRail({
    A_ENGINE: empty,
    B_DENSE: { nSupported: 1, hits: [hit], supportBest: hit },
    C_EXT_Z: empty, D_EXT_U: empty, E_EXT_UZ: empty,
  }, 1e-6, 'failure');
  assert.equal(cls.category, 'SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE');
});

test('classifyRail: best hit outside U wins over weaker outside-Z structure', () => {
  const empty = { nSupported: 0, hits: [], supportBest: null };
  const weakZ = { u: 0.01, z: 0.09, topRows: 4, loss: 6e-4, binsTop: 3, faceCount: 0, outsideU: false, outsideZ: true };
  const strongU = { u: -0.16, z: 0.006, topRows: 26, loss: 8e-5, binsTop: 7, faceCount: 4, outsideU: true, outsideZ: false };
  const cls = Lab.classifyRail({
    A_ENGINE: empty, B_DENSE: empty,
    C_EXT_Z: { nSupported: 1, hits: [weakZ], supportBest: weakZ },
    D_EXT_U: { nSupported: 1, hits: [strongU], supportBest: strongU },
    E_EXT_UZ: empty,
  }, 1e-3, 'failure');
  assert.equal(cls.category, 'SUPPORT_OUTSIDE_U');
  assert.equal(cls.competingOutsideZ, true);
  assert.equal(cls.bestHit.topRows, 26);
});

test('pickControls is deterministic, same n, disjoint from 53 and 6', () => {
  const proto = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/geometry-prototype-v1.json'), 'utf8'));
  const a = Lab.pickControls(proto.rows.BASELINE, POP.failureKeys, POP.excludedFamilyKeys, 53);
  const b = Lab.pickControls(proto.rows.BASELINE, POP.failureKeys, POP.excludedFamilyKeys, 53);
  assert.equal(a.length, 53);
  assert.deepEqual(a.map(x => x.key), b.map(x => x.key));
  const fail = new Set(POP.failureKeys);
  const six = new Set(POP.excludedFamilyKeys);
  for (const c of a) {
    assert.equal(fail.has(c.key), false);
    assert.equal(six.has(c.key), false);
  }
  assert.ok(a.filter(c => c.sameSession).length >= 10, 'same-session controls are taken first');
  assert.ok(a.filter(c => c.sameSide).length >= 40);
});

test('result lock: 53 failures classified, no engine prototype published', (t) => {
  if (!fs.existsSync(REPORT)) {
    t.skip('rapport encore absent — exécuter tools/no-support-generator-lab-v1.cjs');
    return;
  }
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.nature, 'offline-diagnostic');
  assert.equal(report.hashes.baselineUnchanged, true);
  const failures = report.rails.filter(r => r.role === 'failure');
  const controls = report.rails.filter(r => r.role === 'control');
  assert.equal(failures.length, 53);
  assert.equal(controls.length, 53);
  const cats = new Set(failures.map(r => r.classification?.category));
  for (const c of cats) {
    assert.ok(Lab.CATEGORIES.includes(c), `unexpected failure category ${c}`);
  }
  assert.equal(report.science.notEnginePrototypes, true);
  assert.equal(failures.filter(r => r.classification?.category === 'ENGINE_SUPPORT_PRESENT').length, 0);
  const by = {};
  for (const r of failures) by[r.classification.category] = (by[r.classification.category] || 0) + 1;
  assert.equal(by.SUPPORT_OUTSIDE_U, 51);
  assert.equal(by.SUPPORT_OUTSIDE_Z, 1);
  assert.equal(by.SUPPORT_OUTSIDE_UZ, 1);
  assert.equal(by.NO_SUPPORT_FOUND || 0, 0);
  assert.equal(by.SUPPORT_BETWEEN_GRID || 0, 0);
  assert.ok(failures.every(r => (r.scans?.A_ENGINE?.nSupported || 0) === 0));
  assert.ok(failures.every(r => (r.scans?.B_DENSE?.nSupported || 0) === 0));
  assert.equal(controls.filter(r => r.classification?.category === 'ENGINE_SUPPORT_PRESENT').length, 53);
  assert.equal(report.science.notEnginePrototypes, true);
  assert.ok(fs.existsSync(path.join(ROOT, 'NO_SUPPORT_GENERATOR_LAB_V1.md')));
});
