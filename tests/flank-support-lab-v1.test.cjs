'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const Lab = require('../tools/flank-support-lab-v1.cjs');
const Proto = require('../tools/geometry-prototype-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const BASELINE_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const REPORT = path.join(ROOT, 'audit/flank-support-lab-v1.json');

function loadCorpusCapture(cut = 2856) {
  const index = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus/index.json')));
  const item = index.paired.find(x => x.cut === cut) || index.paired[0];
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus', item.lidar_file)));
}

test('geometry-baseline.js remains the frozen original hash', () => {
  assert.equal(SHA(path.join(ROOT, 'src/geometry-baseline.js')), BASELINE_SHA);
  assert.equal(Lab.BASELINE_GEOMETRY_SHA, BASELINE_SHA);
});

test('the six 4+2 keys are locked and disjoint from the 53', () => {
  assert.equal(Lab.TARGET_KEYS.length, 6);
  assert.equal(new Set(Lab.TARGET_KEYS).size, 6);
  assert.ok(Lab.TARGET_KEYS.filter(k => k.endsWith('|left')).length === 1);
  assert.ok(Lab.TARGET_KEYS.filter(k => k.endsWith('|right')).length === 5);
  assert.ok(Lab.TARGET_KEYS.some(k => k.includes('|5098|')));
  assert.ok(Lab.TARGET_KEYS.some(k => k.includes('|839|')));
});

test('A–F are independent lab flags; B only isolates minTop; DIAG is marked diagnostic', () => {
  const A = Lab.PROTOTYPES.A_FLANK_UNCHANGED.options;
  const Bv = Lab.PROTOTYPES.B_MINTOP_ISOLATED.options;
  const C = Lab.PROTOTYPES.C_ADAPTIVE_FACE.options;
  const D = Lab.PROTOTYPES.D_RELATIVE_FACE.options;
  const E = Lab.PROTOTYPES.E_PARTIAL_FACE_KEEP.options;
  const F = Lab.PROTOTYPES.F_EXPLICIT_ABSTAIN.options;
  assert.equal(A.minTop, undefined);
  assert.equal(A.minFace, undefined);
  assert.equal(A.lab.preferSupported, true);
  assert.equal(A.lab.preserveCoarseSupport, true);
  assert.equal(A.lab.adaptiveFace, undefined);
  assert.equal(Bv.minTop, 3);
  assert.equal(Bv.minFace, undefined);
  assert.equal(C.lab.adaptiveFace, true);
  assert.equal(C.minTop, undefined);
  assert.equal(D.lab.relativeFace, true);
  assert.equal(D.lab.adaptiveFace, undefined);
  assert.equal(E.lab.partialFaceKeep, true);
  assert.equal(F.lab.explicitFaceAbstain, true);
  assert.equal(Lab.PROTOTYPES.DIAG_CD_MINTHRESH.diagnostic, true);
  assert.equal(Lab.PROTOTYPES.A_FLANK_UNCHANGED.diagnostic, false);
  const flags = [C, D, E, F].map(o => Object.keys(o.lab).filter(k => k !== 'preferSupported' && k !== 'preserveCoarseSupport'));
  assert.ok(flags.every(f => f.length === 1), 'each of C–F varies a single extra flag');
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

test('lab flank flags do not alter the default path when unset', () => {
  const capture = loadCorpusCapture(2856);
  const a = G.propose(capture, 'left');
  const b = G.propose(capture, 'left', { lab: { preferSupported: true, preserveCoarseSupport: true } });
  if (a.status === 'candidate') {
    assert.equal(b.status, 'candidate');
    assert.deepEqual(b.delta, a.delta);
  }
  assert.ok(b.metrics?.lab?.flank);
  assert.equal(b.metrics.lab.adaptiveFace, undefined);
});

test('adaptive / relative / partial / abstain flags execute without throwing', () => {
  const capture = loadCorpusCapture(2856);
  for (const lab of [
    { preferSupported: true, preserveCoarseSupport: true, adaptiveFace: true },
    { preferSupported: true, preserveCoarseSupport: true, relativeFace: true },
    { preferSupported: true, preserveCoarseSupport: true, partialFaceKeep: true },
    { preferSupported: true, preserveCoarseSupport: true, explicitFaceAbstain: true },
  ]) {
    const p = G.propose(capture, 'left', { lab });
    assert.ok(p.status === 'candidate' || p.status === 'unresolved');
    assert.ok(p.parameters.lab);
  }
});

test('explicit abstain rewrites the face reason without publishing a sparse-face corpus skip', () => {
  const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, 'incidents/banane-dataset-v3-1788955914519.json')));
  const cloud = dataset.clouds.find(c => c.cut === 200);
  const base = G.propose(cloud, 'right');
  const lab = G.propose(cloud, 'right', { lab: { explicitFaceAbstain: true } });
  assert.equal(base.status, 'unresolved');
  assert.equal(lab.status, 'unresolved');
  assert.equal(lab.delta, null);
  if ((base.reasons || []).join(' ').includes('Flanc interne insuffisamment observé')) {
    assert.match(lab.reasons.join(' '), /abstention/);
    assert.doesNotMatch(lab.reasons.join(' '), /Flanc interne insuffisamment observé/);
  }
});

test('relative face scales minFace with topCount and can reject a strong rail that is face-poor', () => {
  const capture = loadCorpusCapture(2856);
  const a = G.propose(capture, 'left');
  const b = G.propose(capture, 'left', { lab: { relativeFace: true } });
  assert.ok(a.status === 'candidate' || a.status === 'unresolved');
  if (a.status !== 'candidate') return;
  const expected = Math.max(3, Math.round(G.DEFAULTS.minFace * a.metrics.topCount / G.DEFAULTS.minTop));
  if (a.metrics.faceCount >= expected && !a.top?.slopeLimited && !a.face?.slopeLimited) {
    assert.equal(b.status, 'candidate');
    assert.deepEqual(b.delta, a.delta);
  } else {
    assert.equal(b.status, 'unresolved');
    assert.match((b.reasons || []).join(' '), /Flanc interne insuffisamment observé|Inclinaison/);
  }
});

test('classifyFlankPresence distinguishes absent structure from clipping', () => {
  assert.equal(Lab.classifyFlankPresence(0, 0, 0, 4, 0), 'points-de-flanc-exclus-par-clipping');
  assert.equal(Lab.classifyFlankPresence(0, 0, 0, 0, 0), 'structure-de-flanc-absente-du-nuage-local');
  assert.equal(Lab.classifyFlankPresence(6, 6, 0, 0, 0), 'flanc-suffisant-dans-la-fenetre-moteur');
  assert.equal(Lab.classifyFlankPresence(3, 3, 0, 0, 0), 'flanc-partiel-dans-la-fenetre-moteur');
  assert.equal(Lab.classifyFlankPresence(0, 4, 0, 0, 0), 'points-dans-la-boite-z-mais-rejetes-par-la-pente');
  assert.equal(Lab.classifyFlankPresence(0, 0, 5, 0, 0), 'flanc-present-pres-du-profil-initial-hors-fenetre-u');
});

test('published flank lab report: six targets, no forced recoveries, controls measured', () => {
  assert.ok(fs.existsSync(REPORT), 'run node tools/flank-support-lab-v1.cjs first');
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.format, 'banane-flank-support-lab-v1');
  assert.equal(report.branch, 'lab-geometry-prototype-v1');
  assert.equal(report.hashes.baselineUnchanged, true);
  assert.equal(report.hashes.geometryBaselineFile, BASELINE_SHA);
  assert.deepEqual(report.targetKeys, [...Lab.TARGET_KEYS]);
  assert.equal(report.targets.length, 6);
  assert.equal(report.targets.filter(t => t.missing).length, 0);
  assert.equal(report.assembled, 221);
  assert.equal(report.baseline.rsfFailures, 59);
  assert.equal(report.baseline.engineCandidates, 162);
  assert.equal(report.baseline.rsfFamilies['aucun-support-nulle-part-sur-la-grille'], 53);
  assert.equal(report.baseline.rsfFamilies['support-ailleurs-mais-perte-nettement-superieure'], 4);
  assert.equal(report.baseline.rsfFamilies['raffinement-a-quitte-le-support'], 2);
  for (const t of report.targets) {
    assert.ok(t.rsfFamily === 'support-ailleurs-mais-perte-nettement-superieure' || t.rsfFamily === 'raffinement-a-quitte-le-support');
    assert.ok(t.criterion?.counts);
    assert.ok(t.criterion?.presence);
    assert.ok(t.criterion?.required?.minFace === 6);
  }
  const names = ['A_FLANK_UNCHANGED', 'B_MINTOP_ISOLATED', 'C_ADAPTIVE_FACE', 'D_RELATIVE_FACE', 'E_PARTIAL_FACE_KEEP', 'F_EXPLICIT_ABSTAIN'];
  for (const n of names) {
    assert.ok(report.prototypes[n], n);
    const c = report.comparisons[n];
    assert.ok(Number.isInteger(c.rsf.rsfRecovered));
    assert.ok(Number.isInteger(c.controls.controlLost));
    assert.ok(Number.isInteger(c.controls.controlChanged));
    assert.ok(Number.isInteger(c.targets.motifShift));
    assert.equal(c.targets.n, 6);
  }
  assert.equal(report.prototypes.DIAG_CD_MINTHRESH.diagnostic, true);
  if (report.science.publishedRecoveries > 0) {
    assert.ok(report.science.promising.length, 'a published recovery must be classified, not forced');
  }
  const statuses = new Set(Object.values(report.prototypes).map(p => p.status));
  for (const st of statuses) {
    assert.ok(['BASELINE', 'PROMISING', 'NEUTRAL', 'REGRESSIVE', 'INCONCLUSIVE'].includes(st), st);
  }
});

test('A does not publish the six; CD_MINTHRESH is not a candidate unless it actually publishes', () => {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.equal(report.science.publishedRecoveries, 0);
  assert.equal(report.science.promising.length, 0);
  assert.equal(report.science.lotStatus, 'INCONCLUSIVE');
  assert.equal(report.prototypes.D_RELATIVE_FACE.status, 'REGRESSIVE');
  assert.ok(report.comparisons.D_RELATIVE_FACE.controls.controlLost >= 100);
  assert.equal(report.comparisons.A_FLANK_UNCHANGED.controls.controlLost, 0);
  assert.equal(report.comparisons.B_MINTOP_ISOLATED.rsf.rsfRecovered, 0);
  assert.equal(report.science.cdMinthreshAsCandidate, false);
  assert.equal(report.science.clippingHidesEnoughFace, 0);
  const presences = report.targets.map(t => t.criterion.presence);
  assert.ok(presences.includes('structure-de-flanc-absente-du-nuage-local'));
  assert.ok(presences.includes('flanc-partiel-dans-la-fenetre-moteur'));
  const f839 = report.targets.find(t => String(t.cut) === '839');
  assert.equal(f839.prototypes.F_EXPLICIT_ABSTAIN.proposal.reason.includes('partiellement observé'), true);
  const d839 = report.targets.find(t => String(t.cut) === '839');
  assert.match(d839.prototypes.DIAG_CD_MINTHRESH.proposal.reason, /placements concurrents/);
});

test('comparable controls exist, have accepted RS+flank, prefer same session/side', () => {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  assert.ok((report.comparableControls.uniqueKeys || []).length >= 8);
  for (const t of report.targets) {
    const list = report.comparableControls.perTarget[t.key] || [];
    assert.ok(list.length >= 3, t.key);
    if (t.side === 'right' && t.sessionId.startsWith('0c58c033')) {
      assert.ok(list.some(c => c.sameSession && c.sameSide), 'right 0c58c033 should keep same-session controls');
    }
  }
});

test('previous geometry prototype lock is still valid', () => {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/geometry-prototype-v1.json'), 'utf8'));
  assert.equal(report.science.publishedRecoveries, 0);
  assert.equal(report.science.gateShifts.CD_MINTHRESH.n, 6);
  assert.equal(report.science.gateShifts.CD_MINTHRESH.published, 0);
});

test('prototype v1 helper still exports landscape used by this lab', () => {
  const capture = loadCorpusCapture();
  const land = Proto.landscape(capture, 'left');
  assert.ok(land);
  assert.ok(land.pointsLocal > 0);
});
