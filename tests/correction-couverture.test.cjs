'use strict';
/* CH-040 — L'AURORE COUVRE TOUS LES LOTS CLOS DE LA SESSION (src/correction-liste.js, `couverture`), et non plus les seuls lots du bilan de la dernière
 * file. Session fabriquée (tests/helpers/aurore-session.cjs) : trois lots, deux files, un lot arrêté sur erreur, un lot déjà repris. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L = require('../src/correction-liste.js');
const { session, lot } = require('./helpers/aurore-session.cjs');
const { journal } = require('./helpers/correction-journal.cjs');
const cuts = l => l.entrees.map(e => e.cut).sort((a, b) => a - b);

test('deux files, un lot sur erreur : toutes les parties, dans l’ordre des départs ; le lot repris exclu', () => {
  const r = L.couverture(session());
  assert.equal(r.version, L.VERSION_COUVERTURE);
  assert.deepEqual(r.listes.map(l => l.partie), [0, 1], 'partie 0 (file 1) et partie 1 (deux lots) ; partie 2 déjà reprise');
  assert.deepEqual(cuts(r.listes[0]), [2, 3, 4], '4 suit un différé (n − 2) : R1');
  assert.deepEqual(r.listes[1].batchIds, ['B', 'C']); assert.equal(r.listes[1].batchId, 'C');
  assert.deepEqual(cuts(r.listes[1]), [10, 11, 13, 14], 'le cut 12, posé proprement par le lot C, n’est plus à poser');
  assert.deepEqual(r.comptes, { lots: 4, avantFusion: 10, apresFusion: 9, proposes: 7, lotsExclus: 1, cutsRetires: 0 });
  assert.deepEqual(r.exclus, [{ batchId: 'D', partie: 2, raison: 'aurore-terminee', correctionId: 'X', fin: 'operateur' }]);
});

test('fusion par cut : le dernier lot qui a eu le cut pour cible décide, son entrée porte son lot', () => {
  const r = L.couverture(session({ avecD: false }));
  const p1 = r.listes[1], par = Object.fromEntries(p1.entrees.map(e => [e.cut, e]));
  assert.equal(par[10].batchId, 'B'); assert.equal(par[13].batchId, 'C');
  assert.deepEqual(par[14].signaux, ['apres-differe', 'sans-appui']);
  assert.deepEqual(p1.entrees.map(e => e.rang), [1, 2, 3, 4], 'rangs continus dans la partie');
  assert.deepEqual(p1.entrees.map(e => e.groupe), ['corriger', 'corriger', 'poser', 'poser'], '« à corriger » d’abord');
  assert.deepEqual(p1.comptes, { lots: 2, aCorriger: 2, aPoser: 2 });
});

test('Aurore finie par accident (service worker redémarré) : le lot reste, seuls ses cuts corrigés ou validés sont retirés', () => {
  const r = L.couverture(session({ finD: 'sw-redemarre' }));
  assert.deepEqual(r.listes.map(l => l.partie), [0, 1, 2]);
  assert.deepEqual(cuts(r.listes[2]), [21]);
  assert.deepEqual(r.retires, [{ part: 2, cut: 20, batchId: 'D', correctionId: 'X', statut: 'corrige' }]);
  assert.equal(r.comptes.cutsRetires, 1); assert.equal(r.comptes.lotsExclus, 0);
});

test('« liste finie » exclut aussi ; une Aurore sans fin (encore ouverte) n’exclut rien', () => {
  assert.deepEqual(L.couverture(session({ finD: 'liste-finie' })).listes.map(l => l.partie), [0, 1]);
  const ev = session().filter(e => e.type !== 'correction-fin');
  assert.deepEqual(L.couverture(ev).listes.map(l => l.partie), [0, 1, 2]);
});

test('un cut repris puis ciblé de nouveau par un lot plus récent revient, avec le signal le plus récent', () => {
  const ev = session();
  lot(ev, { id: 'E', partie: 2, t: 3000, cuts: [[20, 'differe']] });
  const r = L.couverture(ev), p2 = r.listes.find(l => l.partie === 2);
  assert.deepEqual(p2.entrees.map(e => [e.cut, e.groupe, e.batchId]), [[20, 'poser', 'E']]);
  assert.deepEqual(p2.batchIds, ['E'], 'le lot D, repris, n’est plus porté');
});

test('ordre des parties : celui du premier départ, pas le numéro', () => {
  const ev = [];
  lot(ev, { id: 'P7', partie: 7, t: 0, cuts: [[1, 'differe']] });
  lot(ev, { id: 'P3', partie: 3, t: 100, cuts: [[1, 'differe']] });
  assert.deepEqual(L.couverture(ev).listes.map(l => l.partie), [7, 3]);
});

test('lot ouvert exclu ; plafond des lots (les plus récents) ; journal vide', () => {
  assert.deepEqual(L.couverture(session({ avecD: false }), { lotOuvert: 'C' }).listes[1].batchIds, ['B']);
  const ev = [];
  for (let i = 0; i < 20; i++) lot(ev, { id: 'L' + i, partie: i, t: i * 100, cuts: [[1, 'differe']] });
  const r = L.couverture(ev);
  assert.equal(r.listes.length, L.MAX_LOTS_COUVERTURE); assert.equal(r.listes[0].partie, 20 - L.MAX_LOTS_COUVERTURE);
  assert.deepEqual(L.couverture([]).listes, []);
});

test('une seule file (forme de CH-035) : mêmes listes, mêmes entrées que lot par lot', () => {
  const ev = [];
  [5, 6, 7].forEach((partie, i) => { for (const e of journal({ partie, lot: 'B' + partie })) ev.push({ ...e, timestamp: new Date(Date.parse(e.timestamp) + i * 600000).toISOString() }); });
  const r = L.couverture(ev);
  assert.deepEqual(r.listes.map(l => [l.partie, l.batchId]), [[5, 'B5'], [6, 'B6'], [7, 'B7']]);
  for (const l of r.listes) { const seul = L.construire(ev, { batchId: l.batchId });
    assert.deepEqual(l.entrees.map(({ batchId, ...x }) => x), seul.entrees, 'partie ' + l.partie); }
});
