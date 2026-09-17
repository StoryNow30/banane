'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const Lab = require('../tools/geometry-prototype-v1.cjs');
const N = require('../tools/materialized-native.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';

function loadCorpusCapture(cut = 2856) {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  const item = index.paired.find(x => x.cut === cut) || index.paired[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
}

test('geometry-baseline.js is the frozen original hash', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.equal(Lab.BASELINE_GEOMETRY_SHA, BASELINE_SHA);
});

test('DEFAULTS are unchanged vs baseline', () => {
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
});

test('default propose path matches frozen baseline on corpus captures', () => {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  for (const item of index.paired.slice(0, 6)) {
    const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
    for (const side of ['left', 'right']) {
      if (!capture.rails?.[side]) continue;
      const a = B.propose(capture, side);
      const b = G.propose(capture, side);
      assert.equal(b.status, a.status, `${item.cut} ${side} status`);
      assert.deepEqual(b.delta, a.delta, `${item.cut} ${side} delta`);
      assert.equal(b.confidence, a.confidence);
      assert.deepEqual(b.reasons, a.reasons);
      if (a.metrics && b.metrics) {
        assert.deepEqual(b.metrics.seed, a.metrics.seed);
        assert.equal(b.metrics.templateLoss, a.metrics.templateLoss);
        assert.equal(b.metrics.lab, undefined);
      }
      assert.equal(b.parameters.lab, undefined);
    }
  }
});

test('searchZ override is identifiable without lab', () => {
  const capture = loadCorpusCapture();
  const a = G.propose(capture, 'left');
  const b = G.propose(capture, 'left', { searchZ: 0.08 });
  assert.equal(b.parameters.searchZ, 0.08);
  assert.equal(a.parameters.searchZ, G.DEFAULTS.searchZ);
});

test('lab.cloudZSeed marks parameters.lab and does not throw', () => {
  const capture = loadCorpusCapture();
  const p = G.propose(capture, 'left', { lab: { cloudZSeed: true } });
  assert.ok(p.parameters.lab);
  assert.equal(p.parameters.lab.cloudZSeed, true);
  assert.ok(p.metrics?.lab || p.status === 'unresolved');
});

test('lab.preferSupported keeps a supported corpus candidate', () => {
  const capture = loadCorpusCapture(2856);
  const base = B.propose(capture, 'left');
  const lab = G.propose(capture, 'left', { lab: { preferSupported: true } });
  if (base.status === 'candidate') {
    assert.equal(lab.status, 'candidate');
    assert.deepEqual(lab.delta, base.delta);
  }
});

test('invalid searchZ still rejected', () => {
  const capture = loadCorpusCapture();
  assert.throws(() => G.propose(capture, 'left', { searchZ: 0.2 }), /Paramètre géométrique invalide/);
});

test('named prototypes are documented and disjoint enough to ablate', () => {
  const names = Object.keys(Lab.PROTOTYPES);
  assert.ok(names.includes('BASELINE'));
  assert.ok(names.includes('A_SEARCHZ_008'));
  assert.ok(names.includes('B_CLOUD_Z_SEED'));
  assert.ok(names.includes('B_LOCK_CLOUD_Z'));
  assert.ok(names.includes('C_PREFER_SUPPORT'));
  assert.ok(names.includes('D_PRESERVE_COARSE'));
  assert.ok(names.includes('CD'));
  assert.ok(names.includes('BC'));
  assert.ok(names.includes('P_PAIR_Z'));
  assert.equal(Lab.PROTOTYPES.P_PAIR_Z.pair, true);
  assert.ok(!Lab.PROTOTYPES.BC.pair);
});

test('materialized dataset root is the published native v4.6 view', () => {
  assert.equal(N.REF.head, 'd541686d3a98569125cdbdb261ef121c9f533d6a');
  assert.ok(fs.existsSync(path.join(N.DEFAULT_ROOT, 'manifest.json')));
  const man = JSON.parse(fs.readFileSync(path.join(N.DEFAULT_ROOT, 'manifest.json'), 'utf8'));
  assert.equal(man.datasetId, 'native-v4.6-2026-09-16');
  assert.ok(man.files.length >= 40);
});

test('landscape tracer returns a family on a corpus capture', () => {
  const capture = loadCorpusCapture();
  const land = Lab.landscape(capture, 'left');
  assert.ok(land);
  assert.ok(land.pointsLocal > 0);
});

test('RSF population lock has the 239 established rails', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/rsf-population-v1.json'), 'utf8'));
  assert.equal(lock.n, 239);
  assert.equal(lock.failures, 63);
  assert.equal(lock.controls, 176);
  assert.equal(lock.rails.length, 239);
  const keys = new Set(lock.rails.map(r => r.visitId + '|' + r.side));
  assert.equal(keys.size, 239);
});

test('published result lock: zero recoveries, coverage 221/239, families 53/4/2', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/geometry-prototype-v1.json'), 'utf8'));
  assert.equal(report.assembled, 221);
  assert.equal(report.skipped.length, 18);
  assert.equal(report.baseline.rsfFailures, 59);
  assert.equal(report.baseline.engineCandidates, 162);
  assert.equal(report.baseline.rsfFamilies['aucun-support-nulle-part-sur-la-grille'], 53);
  assert.equal(report.baseline.rsfFamilies['support-ailleurs-mais-perte-nettement-superieure'], 4);
  assert.equal(report.baseline.rsfFamilies['raffinement-a-quitte-le-support'], 2);
  assert.equal(report.hashes.baselineUnchanged, true);
  assert.equal(report.hashes.geometryBaselineFile, BASELINE_SHA);
  for (const [name, c] of Object.entries(report.comparisons)) {
    assert.equal(c.rsf.rsfRecovered, 0, name + ' recovered');
    assert.equal(c.rsf.rsfStill, 59, name + ' still');
  }
  assert.equal(report.prototypes.A_SEARCHZ_008.status, 'REGRESSIVE');
  assert.equal(report.prototypes.A_SEARCHZ_010.status, 'REGRESSIVE');
  assert.equal(report.prototypes.A_TOPBAND_024.status, 'REGRESSIVE');
  assert.equal(report.prototypes.B_CLOUD_Z_SEED.status, 'REGRESSIVE');
  assert.equal(report.prototypes.B_LOCK_CLOUD_Z.status, 'REGRESSIVE');
  assert.equal(report.prototypes.C_PREFER_SUPPORT.status, 'NEUTRAL');
  assert.equal(report.prototypes.D_PRESERVE_COARSE.status, 'NEUTRAL');
  assert.equal(report.prototypes.CD.status, 'NEUTRAL');
  assert.equal(report.prototypes.CD_MINTHRESH.status, 'NEUTRAL');
  assert.equal(report.prototypes.E_SUPPORT_PENALTY.status, 'NEUTRAL');
  assert.equal(report.prototypes.F_MULTI_MINIMA.status, 'NEUTRAL');
  assert.equal(report.prototypes.G_STRICT_AMBIGUITY.status, 'REGRESSIVE');
  assert.equal(report.prototypes.BC.status, 'REGRESSIVE');
  assert.equal(report.prototypes.BC_LOCK.status, 'NEUTRAL');
  assert.equal(report.prototypes.BCD.status, 'REGRESSIVE');
  assert.equal(report.prototypes.BCDG.status, 'REGRESSIVE');
  assert.equal(report.prototypes.P_PAIR_Z.status, 'REGRESSIVE');
});

test('science lock: INCONCLUSIVE, CD_MINTHRESH moves 6 gates and publishes 0', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/geometry-prototype-v1.json'), 'utf8'));
  const science = report.science || Lab.deriveScience(report);
  assert.equal(science.lotStatus, 'INCONCLUSIVE');
  assert.equal(science.publishedRecoveries, 0);
  assert.equal(science.promising.length, 0);
  assert.equal(science.coverage.skippedFailures, 4);
  assert.equal(science.coverage.skippedControls, 14);
  const gate = science.gateShifts.CD_MINTHRESH;
  assert.equal(gate.n, 6);
  assert.equal(gate.published, 0);
  assert.equal(gate.reasonCounts['Plan de roulement non estimable.'], 53);
  assert.equal(gate.reasonCounts['Flanc interne insuffisamment observé.'], 4);
  assert.ok(science.keepAsDiagnostic.includes('C_PREFER_SUPPORT'));
  assert.ok(science.dropAsCandidate.includes('B_CLOUD_Z_SEED'));
  assert.ok(!science.keepAsDiagnostic.includes('A_SEARCHZ_008'));
});

test('A is REGRESSIVE and C/D are NEUTRAL on the published comparisons', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/geometry-prototype-v1.json'), 'utf8'));
  assert.ok(report.comparisons.A_SEARCHZ_008.controls.controlLost >= 1);
  assert.equal(report.comparisons.C_PREFER_SUPPORT.controls.controlLost, 0);
  assert.equal(report.comparisons.C_PREFER_SUPPORT.controls.controlChanged, 0);
  assert.equal(report.comparisons.D_PRESERVE_COARSE.controls.controlLost, 0);
  assert.equal(report.comparisons.D_PRESERVE_COARSE.controls.controlChanged, 0);
  assert.equal(report.comparisons.B_CLOUD_Z_SEED.controls.controlChanged, 76);
});
