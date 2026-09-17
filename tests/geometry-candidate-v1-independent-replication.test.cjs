'use strict';
/* Garde-fous de la réplication indépendante Geometry Candidate V1.
 * Ne valide pas la justesse géométrique du candidat : seulement le contrat
 * d'artefact (hashes gelés, population, SHA de sortie, interdits). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const T = require('../tools/geometry-candidate-v1-independent-replication.cjs');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'audit/geometry-candidate-v1-independent-replication.json');
const A = JSON.parse(fs.readFileSync(ART, 'utf8'));

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

test('fichiers runtime gelés — geometry.js et capture-core.js inchangés', () => {
  const h = T.assertFrozen();
  assert.equal(h['src/geometry.js'],
    '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53');
  assert.equal(h['vendor/capture-core.js'],
    '2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054');
  assert.equal(h.match, true);
  assert.deepEqual(A.frozenHashes['src/geometry.js'], h['src/geometry.js']);
});

test('aucun réglage inventé hors consigne', () => {
  assert.equal(T.SPEC.aStar.searchY, 0.08);
  assert.equal(T.SPEC.aStar.searchZ, 0.04);
  assert.equal(T.SPEC.aStar.minTop, 15);
  assert.equal(T.SPEC.aStar.minFace, 6);
  assert.equal(T.SPEC.aStar.replaceOrigin, false);
  assert.equal(T.SPEC.aStar.recenterWindow, true);
  assert.equal(T.SPEC.s1.minTemplateLossRatio, 1.5);
  assert.equal(T.SPEC.s1.competitiveLossRatio, 1.5);
  assert.equal(T.SPEC.s1.publish, 'STRONG_ONLY');
  assert.equal(A.noRuntimeChange, true);
  assert.equal(A.noTuning, true);
  assert.equal(A.noHumanOracleBeforeFreeze, true);
});

test('population figée 239 = 63 RSF + 176 contrôles', () => {
  assert.equal(A.population.total, 239);
  assert.equal(A.population.failures, 63);
  assert.equal(A.population.controls, 176);
  assert.equal(A.population.assembled, 239);
  assert.equal(A.population.failClosedMissing, 0);
  assert.equal(A.rows.length, 239);
  const fail = A.rows.filter(r => r.identity.cohort === 'failure');
  const ctrl = A.rows.filter(r => r.identity.cohort === 'control');
  assert.equal(fail.length, 63);
  assert.equal(ctrl.length, 176);
});

test('V4.6 baseline reproduite sur la capsule : 63 unresolved / 176 candidate', () => {
  assert.equal(A.beforeOracle.v46.failuresUnresolved, 63);
  assert.equal(A.beforeOracle.v46.controlsPublished, 176);
});

test('SHA de sortie gelé — identities / statuts / u,z / S1', () => {
  assert.equal(A.sha256,
    '86780db9dc6aae85e2d9be58ecb1af2ff46dee6d7f19216369817f2e79a83909');
  const recomputed = sha256(Buffer.from(JSON.stringify({
    format: A.format,
    specInterpreted: A.specInterpreted,
    population: A.population,
    beforeOracle: A.beforeOracle,
    identities: A.rows.map(r => ({
      key: r.identity.key,
      v46: r.v46.status,
      cand: r.candidate.status,
      u: r.candidate.u,
      z: r.candidate.z,
      responsible: r.candidate.responsible,
      s1: r.candidate.s1Activated,
    })),
  }), 'utf8'));
  assert.equal(recomputed, A.sha256);
});

test('aucune publication PARTIAL/WEAK', () => {
  assert.equal(A.beforeOracle.candidate.publishedPartialWeak, 0);
  for (const r of A.rows) {
    if (r.candidate.status === 'candidate') {
      assert.equal(r.candidate.strength, 'STRONG', r.identity.railKey);
    }
  }
});

test('compteurs gelés avant oracle — 23 recoveries, 167 contrôles, 0 S1, 199 A_STAR changed', () => {
  const C = A.beforeOracle.candidate;
  assert.equal(C.recoveries, 23);
  assert.equal(C.controlsPublished, 167);
  assert.equal(C.controlsLost, 9);
  assert.equal(C.s1Activations, 0);
  assert.equal(C.aStarChanged, 199);
  assert.equal(C.responsible.A_STAR, 238);
  assert.equal(C.responsible.SUPPORT_FALLBACK_15, 1);
  assert.equal(C.recoveryKeys.length, 23);
  assert.equal(C.lostKeys.length, 9);
});

test('identités 63 RSF uniques et lockées', () => {
  const fail = A.rows.filter(r => r.identity.cohort === 'failure');
  const keys = fail.map(r => r.identity.railKey);
  assert.equal(new Set(keys).size, 63);
  for (const r of fail) {
    assert.ok(r.identity.payloadSha256 && r.identity.payloadSha256.length === 64);
    assert.ok(r.identity.snapshotId);
  }
});
