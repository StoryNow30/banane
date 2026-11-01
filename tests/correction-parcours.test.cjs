'use strict';
/* CH-035 — PARCOURS DE L'AURORE SUR PLUSIEURS PARTIES (src/correction-liste.js, `parcours`) : ordre par partie (celui de la Constellation) puis par cut
 * croissant ; « suivant » = premier cut à faire de la partie affichée après le cut courant, puis les parties suivantes, puis retour au début ; état
 * de chaque partie (à faire, en cours, faite). Module pur ; données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const CL = require('../src/correction-liste.js');
const L = (partie, cuts) => ({ partie, lignes: cuts.map(([cut, statut = 'a-faire']) => ({ part: partie, cut, statut })) });

test('ordre : par partie (ordre de la Constellation), puis par cut croissant, sans doublon', () => {
  const p = CL.parcours([L(4, [[30], [12], [20]]), L(2, [[7], [3]]), L(4, [[12]])], {});
  assert.equal(p.version, CL.VERSION_PARCOURS);
  assert.deepEqual(p.ordre.map(x => [x.part, x.cut]), [[4, 12], [4, 20], [4, 30], [2, 3], [2, 7]]);
});

test('suivant : la partie affichée d’abord, après le cut courant ; puis la partie suivante ; puis le début', () => {
  const listes = [L(2, [[3], [7]]), L(3, [[1], [5], [9]]), L(4, [[2]])];
  assert.deepEqual(CL.parcours(listes, { partieAffichee: 3 }).suivant, { part: 3, cut: 1 });
  assert.deepEqual(CL.parcours(listes, { partieAffichee: 3, courant: { part: 3, cut: 5 } }).suivant, { part: 3, cut: 9 });
  assert.deepEqual(CL.parcours(listes, { partieAffichee: 3, courant: { part: 3, cut: 9 } }).suivant, { part: 3, cut: 1 }, 'retour dans la même partie');
  const faites3 = [L(2, [[3], [7]]), L(3, [[1, 'corrige'], [5, 'valide'], [9, 'vu']]), L(4, [[2]])];
  assert.deepEqual(CL.parcours(faites3, { partieAffichee: 3, courant: { part: 3, cut: 9 } }).suivant, { part: 4, cut: 2 }, 'partie suivante');
  const fin = [L(2, [[3], [7, 'corrige']]), L(3, [[1, 'corrige']]), L(4, [[2, 'valide']])];
  assert.deepEqual(CL.parcours(fin, { partieAffichee: 4 }).suivant, { part: 2, cut: 3 }, 'retour au début de la Constellation');
  assert.equal(CL.parcours([L(2, [[3, 'corrige']])], { partieAffichee: 2 }).suivant, null, 'rien à faire');
  assert.deepEqual(CL.parcours([L(2, [[3], [7]]), L(4, [[2]])], { partieAffichee: 2, courant: { part: 2, cut: 7 } }).suivant, { part: 2, cut: 3 }, 'le cut ouvert, pas encore visité par Écho, n’est jamais le suivant');
  assert.deepEqual(CL.parcours([L(2, [[7]]), L(4, [[2]])], { partieAffichee: 2, courant: { part: 2, cut: 7 } }).suivant, { part: 4, cut: 2 });
  assert.deepEqual(CL.parcours(listes, { partieAffichee: 9 }).suivant, { part: 2, cut: 3 }, 'partie affichée hors liste : le début');
});

test('état par partie : à faire, en cours (cut ouvert ou partie entamée), faite', () => {
  const p = CL.parcours([L(2, [[3, 'corrige'], [7, 'vu']]), L(3, [[1, 'corrige'], [5]]), L(4, [[2]]), L(5, [[8, 'en-cours']])], { courant: { part: 5, cut: 8 } });
  assert.deepEqual(p.parties.map(x => [x.partie, x.etat, x.faits, x.total]), [[2, 'faite', 1, 2], [3, 'en-cours', 1, 2], [4, 'a-faire', 0, 1], [5, 'en-cours', 0, 1]]);
});

/* Vue de Signal (src/ui5.js, `instantane`) : convention de CH-036 relayée par l'intégrateur (01/11) : `entreParties` et `passage`. */
test('vue : réglage éteint → entreParties false, passage null ; allumé → état par partie, passage en cours puis refusé', async () => {
  const { monter } = require('./helpers/ui5-page.cjs');
  const E = [{ part: 5, cut: 14, groupe: 'corriger', signaux: ['passe-ecrite'], details: {}, rang: 1 }], E6 = [{ part: 6, cut: 3, groupe: 'corriger', signaux: ['passe-ecrite'], details: {}, rang: 1 }];
  const C = extra => ({ id: 'C1', etat: 'ouverte', creeA: '2026-11-01T10:00:00Z', listes: [{ batchId: 'B5', partie: 5, entrees: E }, { batchId: 'B6', partie: 6, entrees: E6 }], ...extra });
  const etat = c => ({ batch: { id: 'B6', state: 'COMPLETED', scope: { part: 6 }, processed: [], deferred: [] }, current: { identity: { part: 5, cut: 14 } }, connection: { status: 'ready', tabId: 12 },
    native: { status: 'RUNNING', visits: [], correction: { id: 'C1' } }, correction: c });
  const p = await monter({ etat: etat(C()) });
  let s = p.ui.instantane(etat(C())).correction;
  assert.equal(s.entreParties, false); assert.equal(s.passage, null); assert.equal(s.parcours, undefined, 'éteint : rien de plus');
  s = p.ui.instantane(etat(C({ entreParties: true }))).correction;
  assert.equal(s.entreParties, true); assert.equal(s.passage, null);
  const J = x => JSON.parse(JSON.stringify(x));   /* objets nés dans le contexte de la page simulée */
  assert.deepEqual(J(s.parcours.parties.map(x => [x.partie, x.etat])), [[5, 'a-faire'], [6, 'a-faire']]);
  assert.deepEqual(J(s.parcours.suivant), { part: 5, cut: 14 });
  s = p.ui.instantane(etat(C({ entreParties: true, changement: { de: 5, vers: 6, cut: 3 } }))).correction;
  assert.deepEqual({ ...s.passage, texte: undefined }, { etat: 'en-cours', vers: 6, texte: undefined });
  s = p.ui.instantane(etat(C({ entreParties: true, passage: { etat: 'refuse', vers: 6, texte: 'Partie 6 non ouverte dans ESV : …' } }))).correction;
  assert.deepEqual({ ...s.passage }, { etat: 'refuse', vers: 6, texte: 'Partie 6 non ouverte dans ESV : …' });
});
