'use strict';
/* Test 24, décision de l'opérateur du 28/10 (D-259) — LA DEUXIÈME PASSE EST LIVRÉE ALLUMÉE EN ÉCRITURE, plafonnée à 10 cuts par lot : un lot sans aucun réglage enregistré écrit.
 * Un lot par fichier (durée des essais, 20 s par fichier). Service worker réel, ESV simulé (tests/helpers/passe-differes.cjs). Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');

test('lot sans réglage enregistré (livré D-259) : la passe écrit, plafonnée à 10 cuts, chaque cut est posé et validé sur place', async () => {
  const x = await lotPasse({ passe: {}, deux: true });
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112, 114]);
  assert.equal(ev(x.b, 'passe-differes-ecriture').length, 2);
  assert.equal(x.b.get('vuePanneau')().passeDifferes.mode, 'ecriture');
});
