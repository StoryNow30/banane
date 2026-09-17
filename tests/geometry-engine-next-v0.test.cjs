'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const Lab = require('../tools/geometry-engine-next-v0.cjs');
const FAA = require('../tools/face-aware-arbitration-v1.cjs');
const CSA = require('../tools/competitive-support-arbitration-v1.cjs');
const U = require('../tools/u-hypothesis-lab-v1.cjs');
const N = require('../tools/materialized-native.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const REPORT = path.join(ROOT, 'audit/geometry-engine-next-v0.json');

test('geometry-baseline frozen; A_STAR frozen; composition frozen; no new threshold', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.deepEqual(G.DEFAULTS, B.DEFAULTS);
  assert.equal(Lab.ENGINE_Y, 0.08);
  assert.equal(Lab.ENGINE_Z, 0.04);
  assert.equal(G.DEFAULTS.minFace, 6);
  assert.equal(G.DEFAULTS.minTop, 15);
  assert.equal(G.DEFAULTS.minTemplateLossRatio, 1.5);
  assert.equal(Lab.RATIO, 1.5);
  assert.equal(FAA.assertAStarFrozen(), Lab.A_STAR_HASH);
  assert.equal(Lab.COMPOSITION.engine, 'GEOMETRY_ENGINE_NEXT_V0');
  assert.equal(Lab.COMPOSITION.support.id, 'S1');
  assert.deepEqual(Lab.COMPOSITION.excluded, ['S2']);
  assert.equal(Lab.COMPOSITION.aStar.hash, Lab.A_STAR_HASH);
  assert.equal(Lab.COMPOSITION_HASH, crypto.createHash('sha256').update(JSON.stringify(Lab.COMPOSITION)).digest('hex'));
  assert.equal(typeof N.loadNeededChunksComplete, 'function');
});

test('S1 is reused, not reimplemented; 9644 is not a coded exception', () => {
  assert.equal(Lab.policyS1 || CSA.policyS1, CSA.policyS1);
  const src = fs.readFileSync(path.join(ROOT, 'tools/geometry-engine-next-v0.cjs'), 'utf8');
  assert.equal(src.includes('if (key === KEY_9644)'), false);
  assert.equal(src.includes('if(key===KEY_9644)'), false);
  assert.ok(src.includes('CSA.policyS1') || src.includes('CSA.applyPolicies') || src.includes('CSA.analyseRail'));
  assert.equal(src.includes('minFace = 5') || src.includes('minFace: 5'), false);
  assert.equal(src.includes('searchY: 0.12'), false);
});

test('lock 239 is 63 failures + 176 controls', () => {
  const lock = Lab.loadLock239();
  assert.equal(lock.n, 239);
  assert.equal(lock.failureKeys.length, 63);
  assert.equal(lock.controlKeys.length, 176);
});

test('classifyPair covers the registered labels', () => {
  assert.equal(Lab.classifyPair({ status: 'unresolved', motif: 'flank' }, { status: 'candidate', motif: 'candidate', delta: [0, 0.01, 0] }), 'RECOVERED');
  assert.equal(Lab.classifyPair({ status: 'candidate', delta: [0, 0, 0] }, { status: 'unresolved', motif: 'flank' }), 'LOST');
  assert.equal(Lab.classifyPair({ status: 'candidate', delta: [0, 0, 0] }, { status: 'unresolved', motif: 'ambiguity' }), 'NEW_AMBIGUITY');
  assert.equal(Lab.classifyPair({ status: 'candidate', delta: [0, 0, 0] }, { status: 'candidate', delta: [0, 0, 0] }), 'UNCHANGED_GOOD');
  assert.equal(Lab.classifyPair({ status: 'unresolved', motif: 'flank' }, { status: 'unresolved', motif: 'flank' }), 'UNCHANGED_UNRESOLVED');
  assert.equal(Lab.classifyPair({ status: 'candidate', delta: [0, 0, 0] }, { status: 'candidate', delta: [0, 0.004, 0] }), 'MOVED');
  assert.equal(Lab.classifyPair({ status: 'candidate', delta: [0, 0, 0] }, { status: 'candidate', delta: [0, 0.05, 0] }), 'DIFFERENT_CANDIDATE');
});

test('report lock', () => {
  if (!fs.existsSync(REPORT)) return;
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.format, 'geometry-engine-next-v0');
  assert.equal(report.science.searchY, 0.08);
  assert.equal(report.science.searchZ, 0.04);
  assert.equal(report.science.minFace, 6);
  assert.equal(report.science.minTemplateLossRatio, 1.5);
  assert.equal(report.science.noNewThreshold, true);
  assert.equal(report.science.aStarFrozen, true);
  assert.equal(report.science.s2Excluded, true);
  assert.equal(report.science.compositionHash, Lab.COMPOSITION_HASH);
  assert.equal(report.hashes.baselineUnchanged, true);
  assert.equal(report.parity.pass, true);
  assert.equal(report.parity.astar.pass, true);
  assert.equal(report.parity.s1.pass, true);
  assert.equal(report.parity.gate.restored9644, true);
  assert.equal(report.parity.gate.published5, 0);
  assert.equal(report.parity.gate.publishedFar, 0);
  assert.equal(report.parity.gate.displacedAlreadyStrong, 0);
  assert.equal(report.coverage.assembled, 239);
  assert.equal(report.coverage.skipped, 0);
  assert.equal(report.science.publishedWeak, 0);
  assert.equal(report.science.displacedAlreadyStrong, 0);
  assert.ok(['PROMISING', 'NEUTRAL', 'REGRESSIVE', 'INCONCLUSIVE'].includes(report.science.lotStatus));
  const src = fs.readFileSync(path.join(ROOT, 'tools/geometry-engine-next-v0.cjs'), 'utf8');
  assert.ok(src.includes('CSA.analyseRail'));
  assert.equal(/uSeeds[\s\S]{0,80}human/.test(src), false);
});
