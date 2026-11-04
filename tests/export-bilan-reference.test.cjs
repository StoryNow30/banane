'use strict';
/* CH-049-C : dans « Tout télécharger », le bilan réécrit les événements du journal (mesuré le 04/11, lot des parties 6-15 : 131 379 événements du bilan =
 * 131 377 du journal + 2 insérés, mêmes octets, même ordre ; 20,5 Mo compressés sur les 21,7 Mo du volume du bilan). `evenementsParReference` remplace la
 * copie par une référence au journal (+ les ajouts) ; `rehydraterEvenements` la relit à l'identique. Hors de portée → null (on garde la liste entière).
 * Fonctions pures, non branchées dans le panneau : la décision revient à l'intégrateur (les outils d'analyse lisent bilan.events). Données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const X = require('../src/native-export.js');

const ev = n => ({ eventId: 'e' + n, timestamp: '2026-11-04T10:00:' + String(n % 60).padStart(2, '0') + 'Z', type: n % 5 ? 'adapter-progress' : 'phase-timing-pli', detail: { n, texte: 'x'.repeat(30) } });
const journal = Array.from({ length: 300 }, (_, i) => ev(i));

test('bilan = journal + insertions : référence puis relecture identique', () => {
  const bilan = journal.slice(); bilan.splice(120, 0, { eventId: 'extra1', type: 'phase-timing' }); bilan.splice(250, 0, { eventId: 'extra2', type: 'phase-timing' });
  const r = X.evenementsParReference(bilan, journal);
  assert.ok(r);
  assert.equal(r.total, 302);
  assert.deepEqual(r.ajouts.map(a => a.position), [120, 250]);
  assert.ok(JSON.stringify(r).length < 400, 'la référence est minuscule');
  assert.deepEqual(X.rehydraterEvenements(r, journal), bilan);
});

test('bilan identique au journal : aucun ajout', () => {
  const r = X.evenementsParReference(journal.slice(), journal);
  assert.deepEqual(r.ajouts, []);
  assert.deepEqual(X.rehydraterEvenements(r, journal), journal);
});

test('insertions en tête et en queue', () => {
  const bilan = [{ eventId: 'debut' }, ...journal, { eventId: 'fin' }];
  const r = X.evenementsParReference(bilan, journal);
  assert.deepEqual(X.rehydraterEvenements(r, journal), bilan);
});

test('événement modifié, retiré ou réordonné : pas de référence (null), on garde la liste entière', () => {
  const modifie = journal.slice(); modifie[40] = { ...modifie[40], detail: { n: 40, texte: 'changé' } };
  assert.equal(X.evenementsParReference(modifie, journal), null);
  assert.equal(X.evenementsParReference(journal.slice(0, 100).concat(journal.slice(101)), journal), null);
  assert.equal(X.evenementsParReference(journal.slice().reverse(), journal), null);
});

test('rehydrater refuse un autre journal (taille ou contenu) plutôt que de deviner', () => {
  const bilan = journal.slice(); bilan.splice(10, 0, { eventId: 'x' });
  const r = X.evenementsParReference(bilan, journal);
  assert.throws(() => X.rehydraterEvenements(r, journal.slice(1)), /journal/);
  const autre = journal.slice(); autre[5] = { ...autre[5], type: 'autre' };
  assert.throws(() => X.rehydraterEvenements(r, autre), /journal/);
});
