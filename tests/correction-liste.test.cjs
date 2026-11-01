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

/* CH-037 (défaut 2, test 30) : un cut visité plusieurs fois prend son résultat le PLUS FORT parmi ses visites (corrigé > validé > ouvert > vu) ; à force
 * égale, la visite la plus récente. Données fabriquées sur la forme du cut 3250 de la partie 10 (01/11) : corrigé-validé, puis une visite sans décision,
 * puis validé sans mouvement, puis une visite sans décision ; le bilan disait « vu ». */
test('CH-037 : le résultat le plus fort parmi les visites décide (cut revisité, dernière visite sans décision)', () => {
  const r = L.construire(journal(), { partie: 5 });
  const v = (cut, label, extra = {}) => ({ identity: { part: 5, cut }, label, ...extra });
  const visites = [v(14, 'VALIDATE_CORRECTED_BOTH'), v(14, 'PASS_NO_DECISION'), v(14, 'VALIDATE_NO_MOVEMENT'), v(14, 'PASS_NO_DECISION'),
    v(15, 'VALIDATE_NO_MOVEMENT'), v(15, 'PASS_NO_DECISION'),
    v(16, 'VALIDATE_CORRECTED_LEFT_ONLY'), v(16, 'VALIDATE_CORRECTED_BOTH'),
    v(17, 'VALIDATE_NO_MOVEMENT'), v(17, null, { encours: true }),
    v(18, 'PASS_NO_DECISION'), v(18, null, { encours: true })];
  const s = Object.fromEntries(L.bilan(r.entrees, visites).lignes.map(l => [l.cut, l]));
  assert.equal(s[14].statut, 'corrige'); assert.equal(s[14].label, 'VALIDATE_CORRECTED_BOTH'); assert.equal(s[14].rails, 2); assert.equal(s[14].visites, 4);
  assert.equal(s[15].statut, 'valide'); assert.equal(s[15].label, 'VALIDATE_NO_MOVEMENT');
  assert.equal(s[16].statut, 'corrige'); assert.equal(s[16].rails, 2, 'à force égale, la plus récente');
  assert.equal(s[17].statut, 'valide', 'déjà validé : une visite rouverte ne le rabaisse pas');
  assert.equal(s[18].statut, 'en-cours', 'ouvert l’emporte sur « vu »');
  assert.ok(L.REGLE_STATUT && /plus fort/.test(L.REGLE_STATUT), 'règle écrite dans le module');
});

/* CH-037 (défaut 2) : la fusion des visites d'Écho et des étiquettes provisoires du service worker (`issues`, par visitId), une seule fonction pour
 * l'écran, la fin « liste finie » et `correction-fin`. Forme : la visite ouverte validée (Maj+Espace observé, pas encore close) ; la visite perdue avec
 * la page (`pageLost` : ni endedAt ni label dans le résumé, cut 9748 de la partie 11 le 01/11). */
test('CH-037 : visites fusionnées : la visite ouverte validée compte tout de suite, la visite perdue avec la page aussi', () => {
  const r = L.construire(journal(), { partie: 5 });
  const V = [{ visitId: 'a', identity: { part: 5, cut: 14 }, startedAt: 't1' },                                  // perdue avec la page (rechargement)
    { visitId: 'b', identity: { part: 5, cut: 15 }, startedAt: 't2', endedAt: 't3', label: 'VALIDATE_CORRECTED_BOTH' },
    { visitId: 'c', identity: { part: 5, cut: 16 }, startedAt: 't4' }];                                            // ouverte, Maj+Espace observé
  const issues = { a: 'VALIDATE_NO_MOVEMENT', c: 'VALIDATE_CORRECTED_LEFT_ONLY' };
  const F = L.visitesFusionnees(V, { issues, echoOuvert: true });
  assert.deepEqual(F.map(x => [x.identity.cut, x.label, x.encours, x.provisoire]), [[14, 'VALIDATE_NO_MOVEMENT', false, true], [15, 'VALIDATE_CORRECTED_BOTH', false, false], [16, 'VALIDATE_CORRECTED_LEFT_ONLY', true, true]]);
  const s = Object.fromEntries(L.bilan(r.entrees, F).lignes.map(l => [l.cut, l.statut]));
  assert.deepEqual([s[14], s[15], s[16]], ['valide', 'corrige', 'corrige']);
  /* Sans étiquette provisoire : la visite ouverte reste « ouvert », la perdue « vu » (le défaut constaté). */
  const s0 = Object.fromEntries(L.bilan(r.entrees, L.visitesFusionnees(V, { echoOuvert: true })).lignes.map(l => [l.cut, l.statut]));
  assert.deepEqual([s0[14], s0[16]], ['vu', 'en-cours']);
  /* Écho fermé : plus rien d'ouvert. Le libellé d'Écho, quand il existe, l'emporte toujours sur le provisoire. */
  assert.equal(L.visitesFusionnees(V, { echoOuvert: false })[2].encours, false);
  assert.equal(L.visitesFusionnees(V, { issues: { b: 'PASS_NO_DECISION' } })[1].label, 'VALIDATE_CORRECTED_BOTH');
});
