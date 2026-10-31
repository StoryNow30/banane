'use strict';
/* CH-028 — la liste de cuts à corriger (src/correction-liste.js), sur un journal fabriqué (tests/helpers/correction-journal.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L = require('../src/correction-liste.js');
const { journal } = require('./helpers/correction-journal.cjs');

test('population : cibles, posés (passe comprise) et différés restants, comme juger-lot', () => {
  const r = L.construire(journal(), { partie: 5 });
  assert.equal(r.trouve, true); assert.equal(r.batchId, 'B1');
  assert.deepEqual({ c: r.comptes.cibles, p: r.comptes.poses, d: r.comptes.differes }, { c: 10, p: 9, d: 1 });
});

test('signaux : chaque cut entre pour ses raisons, et seulement elles', () => {
  const r = L.construire(journal(), { partie: 5 });
  const par = Object.fromEntries(r.entrees.map(e => [e.cut, e]));
  assert.deepEqual(Object.keys(par).map(Number).sort((a, b) => a - b), [13, 14, 15, 16, 17, 18, 19]);
  assert.deepEqual(par[14].signaux, ['passe-ecrite']); assert.equal(par[14].details['passe-ecrite'].decalMm, 38.4);
  assert.deepEqual(par[15].signaux, ['apres-differe', 'sans-appui']); assert.deepEqual(par[15].details['apres-differe'].differes, [14, 13]);
  assert.deepEqual(par[16].signaux, ['apres-differe'], 'deux appuis : pas « sans appui »');
  assert.deepEqual(par[17].signaux, ['sans-appui'], 'posé par le lot sans appui');
  assert.deepEqual(par[18].signaux, ['relecture']); assert.equal(par[18].details.relecture.pireMm, 7.3);
  assert.deepEqual(par[19].signaux, ['garde-suivant']);
  assert.deepEqual(par[13].signaux, ['differe']); assert.equal(par[13].groupe, 'poser'); assert.equal(par[13].details.differe.motif, 'candidat');
  assert.ok(!par[12], 'corrigé par la relecture : n’entre pas'); assert.ok(!par[40], 'vert d’avant le lot : n’entre pas');
});

test('ordre : « à corriger » d’abord, du signal le plus fort au plus faible, puis « à poser » ; rangs continus', () => {
  const r = L.construire(journal(), { partie: 5 });
  assert.deepEqual(r.entrees.map(e => e.cut), [14, 15, 16, 17, 19, 18, 13]);
  assert.deepEqual(r.entrees.map(e => e.rang), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual({ a: r.comptes.aCorriger, p: r.comptes.aPoser }, { a: 6, p: 1 });
});

test('sans lot de la partie : liste vide, rien inventé', () => {
  const r = L.construire(journal(), { partie: 9 });
  assert.equal(r.trouve, false); assert.deepEqual(r.entrees, []);
});

test('un lot choisi par son identifiant ; un lot fermé au départ ne masque pas le vrai lot', () => {
  const ev = journal();
  ev.push({ type: 'batch-started', timestamp: '2026-10-31T11:00:00Z', batch: { id: 'B2' }, identity: { part: 5, cut: 30 } });
  ev.push({ type: 'gcv1-shadow-observed', timestamp: '2026-10-31T11:00:01Z', batchId: 'B2', identity: { part: 5, cut: 30 }, lotObservation: {} });
  assert.equal(L.construire(ev, { partie: 5 }).batchId, 'B1', 'le lot le plus décidé');
  assert.equal(L.construire(ev, { batchId: 'B2' }).batchId, 'B2');
});

test('statut lu dans les visites d’Écho (la dernière visite du cut décide) et bilan', () => {
  const r = L.construire(journal(), { partie: 5 });
  const v = (cut, label, extra = {}) => ({ identity: { part: 5, cut }, label, ...extra });
  const visites = [v(14, 'PASS_NO_DECISION'), v(14, 'VALIDATE_CORRECTED_BOTH'), v(15, 'VALIDATE_NO_MOVEMENT'), v(16, 'VALIDATE_CORRECTED_LEFT'), v(17, null), v(18, null, { encours: true })];
  const b = L.bilan(r.entrees, visites);
  const s = Object.fromEntries(b.lignes.map(l => [l.cut, l]));
  assert.equal(s[14].statut, 'corrige'); assert.equal(s[14].rails, 2); assert.equal(s[14].visites, 2);
  assert.equal(s[15].statut, 'valide'); assert.equal(s[16].statut, 'corrige'); assert.equal(s[16].rails, 1);
  assert.equal(s[17].statut, 'vu'); assert.equal(s[18].statut, 'en-cours'); assert.equal(s[19].statut, 'a-faire');
  assert.deepEqual(b.comptes, { total: 7, 'a-faire': 2, 'en-cours': 1, corrige: 2, valide: 1, vu: 1, traites: 3 });
});

test('module pur : aucune API de navigateur ni d’écriture', () => {
  const src = require('node:fs').readFileSync(require.resolve('../src/correction-liste.js'), 'utf8');
  assert.doesNotMatch(src, /chrome\.|document\.|fetch\(|putEvent|sendMessage|validerMajEspace|skipAndNext|validateAndNext/);
});
