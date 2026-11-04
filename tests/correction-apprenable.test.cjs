'use strict';
/* CH-049-B — l'enregistrement d'apprentissage d'une correction de l'Aurore (src/correction-liste.js, `apprenabilite`).
 * Critères de CH-049 : (1) état initial qualifié des deux rails, (2) pose humaine finale, (3) nuage retrouvable (captureId),
 * (4) intention non ambiguë. Les formes d'enregistrement sont celles d'un export Écho v5 (banane-native-visit-v2). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L = require('../src/correction-liste.js');

const rail = (cap, status = 'comparable-candidate', reasons = []) => ({ status, captureId: cap, chunkIds: [cap + ':0'], points: 900, reasons });
const complet = (surcharge = {}) => ({
  visitId: 'v1', status: 'complete', partialReasons: [], multiIntent: false, intentCollapse: null,
  operatorIntents: [{ intent: 'VALIDATE' }], humanFinalReference: { status: 'candidate-observed' },
  lidarCaptureIds: ['c1'], geometryEligibility: { left: rail('c1'), right: rail('c1') }, ...surcharge });

test('un enregistrement complet est apprenable, sans perte', () => {
  assert.deepEqual(L.apprenabilite(complet()), { apprenable: true, pertes: [] });
});
test('état initial non qualifié : la perte nomme le rail', () => {
  const r = complet({ geometryEligibility: { left: rail('c1'), right: rail('c1', 'excluded', ['checkpoint-not-qualified']) } });
  assert.deepEqual(L.apprenabilite(r), { apprenable: false, pertes: ['etat-initial-droite'] });
  const d = complet({ geometryEligibility: { left: rail(null, 'excluded'), right: rail(null, 'excluded') } });
  assert.deepEqual(L.apprenabilite(d).pertes.filter(p => p.startsWith('etat-initial')), ['etat-initial-gauche', 'etat-initial-droite']);
});
test('pose humaine finale absente', () => {
  assert.deepEqual(L.apprenabilite(complet({ humanFinalReference: null })).pertes, ['reference-humaine']);
  assert.deepEqual(L.apprenabilite(complet({ humanFinalReference: { status: 'absent' } })).pertes, ['reference-humaine']);
});
test('nuage non retrouvable : aucun captureId stocké, ou captureId du rail absent de la visite', () => {
  assert.deepEqual(L.apprenabilite(complet({ lidarCaptureIds: [] })).pertes, ['nuage']);
  assert.deepEqual(L.apprenabilite(complet({ lidarCaptureIds: ['autre'] })).pertes, ['nuage']);
});
test('intention ambiguë : plusieurs validations ou intention repliée', () => {
  assert.deepEqual(L.apprenabilite(complet({ multiIntent: true })).pertes, ['intention-ambigue']);
  assert.deepEqual(L.apprenabilite(complet({ operatorIntents: [{ intent: 'VALIDATE' }, { intent: 'VALIDATE' }] })).pertes, ['intention-ambigue']);
  assert.deepEqual(L.apprenabilite(complet({ intentCollapse: { reason: 'x' } })).pertes, ['intention-ambigue']);
});
test('pas de validation, pas d\'enregistrement ; entrée absente ou illisible : perte nommée, jamais d\'exception', () => {
  assert.deepEqual(L.apprenabilite(complet({ operatorIntents: [] })).pertes, ['sans-validation']);
  assert.deepEqual(L.apprenabilite(null), { apprenable: false, pertes: ['enregistrement-absent'] });
  assert.deepEqual(L.apprenabilite({}).apprenable, false);
});
test('bilan : chaque ligne porte la visite retenue et son verdict d\'apprentissage quand les enregistrements sont fournis', () => {
  const entrees = [{ part: 5, cut: 7, groupe: 'corriger', signaux: ['differe'] }];
  const visites = [{ visitId: 'v1', identity: { part: 5, cut: 7 }, label: 'VALIDATE_CORRECTED_BOTH', encours: false }];
  const b = L.bilan(entrees, visites, { v1: complet() });
  assert.equal(b.lignes[0].visitId, 'v1'); assert.equal(b.lignes[0].apprenable, true); assert.deepEqual(b.lignes[0].pertes, []);
  assert.equal(b.comptes.apprenables, 1);
  const b2 = L.bilan(entrees, visites, { v1: complet({ lidarCaptureIds: [] }) });
  assert.deepEqual(b2.lignes[0].pertes, ['nuage']); assert.equal(b2.comptes.apprenables, 0);
  const b3 = L.bilan(entrees, visites);
  assert.ok(!('apprenable' in b3.lignes[0]), 'sans enregistrements, le bilan reste celui d\'avant');
});
