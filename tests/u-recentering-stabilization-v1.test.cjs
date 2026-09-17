'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const U = require('../tools/u-hypothesis-lab-v1.cjs');
const Lab = require('../tools/u-recentering-stabilization-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const REPORT = path.join(ROOT, 'audit/u-recentering-stabilization-v1.json');

function loadCorpusCapture(cut = 2856) {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  const item = index.paired.find(x => x.cut === cut) || index.paired[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
}

test('geometry-baseline.js remains frozen', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.equal(Lab.BASELINE_GEOMETRY_SHA, BASELINE_SHA);
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  assert.equal(Lab.ENGINE_Y, 0.08);
  assert.equal(Lab.ENGINE_Z, 0.04);
});

test('population 53+53, 5146 is the 51st slope rail, 2269 is the remaining RSF', () => {
  const pop = U.loadPopulation();
  assert.equal(pop.failureKeys.length, 53);
  assert.equal(pop.controlKeys.length, 53);
  assert.ok(pop.failureKeys.includes(Lab.SLOPE_51));
  assert.ok(pop.failureKeys.includes(Lab.RSF_51));
  assert.ok(Lab.SLOPE_51.includes('|5146|right'));
  assert.ok(Lab.RSF_51.includes('|2269|left'));
  assert.equal(Lab.LOST_A.length, 2);
  assert.ok(Lab.LOST_A.some(k => k.includes('|2731|')));
  assert.ok(Lab.LOST_A.some(k => k.includes('|9644|')));
});

test('A_ORIGIN_PRESERVE is the only delta vs A: replaceOrigin false', () => {
  const dummy = { A: [{ u: -0.14 }] };
  const a = Lab.VARIANTS.A.buildLab(dummy);
  const p = Lab.VARIANTS.A_ORIGIN_PRESERVE.buildLab(dummy);
  assert.deepEqual(a.uSeeds, p.uSeeds);
  assert.equal(a.recenterWindow, true);
  assert.equal(p.recenterWindow, true);
  assert.equal(a.replaceOrigin, true);
  assert.equal(p.replaceOrigin, false);
  assert.equal(a.searchY, undefined);
  assert.equal(p.searchY, undefined);
});

test('replaceOrigin false keeps origin in uCenters', () => {
  const capture = loadCorpusCapture(2856);
  const withReplace = G.propose(capture, 'left', { lab: { uSeeds: [0.03], replaceOrigin: true, recenterWindow: true } });
  const keep = G.propose(capture, 'left', { lab: { uSeeds: [0.03], replaceOrigin: false, recenterWindow: true } });
  assert.deepEqual(withReplace.metrics.lab.uCenters, [0.03]);
  assert.ok(keep.metrics.lab.uCenters.includes(0));
  assert.ok(keep.metrics.lab.uCenters.includes(0.03));
  assert.equal(keep.parameters.searchY, 0.08);
});

test('default propose path still matches baseline', () => {
  const capture = loadCorpusCapture(2856);
  const a = B.propose(capture, 'left');
  const b = G.propose(capture, 'left');
  assert.equal(b.status, a.status);
  assert.deepEqual(b.delta, a.delta);
});

test('tallyMotifs 22+27+1+1 = 51', () => {
  const rows = [
    ...Array.from({ length: 22 }, (_, i) => ({ variants: { A: { motif: 'candidate' } }, key: 'c' + i, cut: i, side: 'right' })),
    ...Array.from({ length: 27 }, (_, i) => ({ variants: { A: { motif: 'flank' } }, key: 'f' + i, cut: i, side: 'right' })),
    { variants: { A: { motif: 'rsf' } }, key: Lab.RSF_51, cut: 2269, side: 'left' },
    { variants: { A: { motif: 'slope' } }, key: Lab.SLOPE_51, cut: 5146, side: 'right' },
  ];
  const t = Lab.tallyMotifs(rows, 'A');
  assert.equal(t.sum, 51);
  assert.equal(t.counts.candidate, 22);
  assert.equal(t.counts.flank, 27);
  assert.equal(t.counts.rsf, 1);
  assert.equal(t.counts.slope, 1);
});

test('flankBucket maps face counts to A/B/C', () => {
  assert.equal(Lab.flankBucket({ compact: { faceCount: 0 }, presence: 'structure-de-flanc-absente-du-nuage-local', failing: {} }), 'A');
  assert.equal(Lab.flankBucket({ compact: { faceCount: 2 }, presence: 'flanc-clairseme-sous-robustLine', failing: { flankSparse: true } }), 'B');
  assert.equal(Lab.flankBucket({ compact: { faceCount: 4 }, presence: 'flanc-partiel-dans-la-fenetre-moteur', failing: { flankSparse: true } }), 'C');
  assert.equal(Lab.flankBucket({ compact: { faceCount: 6 }, failing: { ambiguity: true } }), 'D');
});

test('A_STAR config does not widen searchY', () => {
  const cfg = Lab.aStarConfig();
  assert.equal(cfg.searchY, 0.08);
  assert.equal(cfg.searchZ, 0.04);
  assert.equal(cfg.lab.replaceOrigin, false);
  assert.equal(cfg.lab.recenterWindow, true);
  assert.equal(cfg.notAGlobalSearchY, true);
  const h = Lab.hashConfig(cfg);
  assert.equal(h.length, 64);
});

test('report lock: 51 closed, searchY unchanged, Gate 1 recorded', () => {
  if (!fs.existsSync(REPORT)) return;
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.format, 'u-recentering-stabilization-v1');
  assert.equal(report.science.accounting.n, 51);
  assert.equal(report.science.accounting.sumA, 51);
  assert.equal(report.science.accounting.closed, true);
  assert.equal(report.science.accounting.A.candidate, 22);
  assert.equal(report.science.accounting.A.flank, 27);
  assert.equal(report.science.accounting.A.rsf, 1);
  assert.equal(report.science.accounting.A.slope, 1);
  assert.equal(report.science.searchY, 0.08);
  assert.equal(report.science.searchZ, 0.04);
  assert.ok(['PASS', 'STOP'].includes(report.science.gate1.status));
  assert.ok(['PROMISING', 'NEUTRAL', 'REGRESSIVE', 'INCONCLUSIVE'].includes(report.science.lotStatus));
  assert.equal(report.hashes.baselineUnchanged, true);
  if (report.science.gate1.pass) {
    assert.ok(report.science.aStar);
    assert.equal(report.science.aStar.searchY, 0.08);
    assert.equal(report.science.aStar.lab.replaceOrigin, false);
    assert.equal(report.science.flank27.n, 27);
    assert.equal(report.science.posthoc22.n, report.science.tallyPreserve.candidate);
    assert.equal(report.science.gate1.keptRecoveries, 22);
    assert.equal(report.science.gate1.recoveredLostControls.length, 1);
    assert.ok(report.science.gate1.recoveredLostControls[0].includes('|2731|'));
    assert.equal(report.science.gate1.stillLostControls.length, 1);
    assert.ok(report.science.gate1.stillLostControls[0].understood);
    assert.equal(report.science.flank27.byBucket.C, 22);
    assert.equal(report.science.flank27.byBucket.B, 5);
    assert.equal(report.science.flank27.byBucket.A, 0);
    assert.equal(report.science.posthoc22.nAvailable, 22);
    assert.equal(report.science.posthoc22.nWithin010, 19);
    assert.equal(report.science.posthoc22.nWithin020, 3);
    assert.equal(report.science.posthoc22.nFar, 0);
    assert.equal(report.science.lotStatus, 'INCONCLUSIVE');
    assert.equal(report.science.controlsPreserve.displacedGross, 0);
  } else {
    assert.equal(report.science.aStar, null);
  }
});
