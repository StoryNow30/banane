'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS, NIVEAU « ÉCRITURE » (tests/helpers/passe-differes.cjs : lot 111 à 115 (`deux`), les cuts 112 et 114 différés
 * puis forcés à « valider » par la GCV2 pendant la passe). Livrée allumée en écriture, sans plafond de poses : elle pose et valide sur place dans l'ESV simulé, et ne touche à rien d'autre. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, ev } = require('./helpers/passe-differes.cjs');

test('départ automatique : le lot finit sur un cut différé (aucune pose d’Ariane n’attend), la passe part seule et écrit, sans action du panneau', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, sansPoints: [112, 113], fin: 113 });
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin').map(e => e.cuts), [[112]]);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112]);
  assert.deepEqual(ev(x.b, 'passe-differes-ecriture-fin').map(e => e.issue), ['fin'], 'une seule écriture, partie seule');
  assert.deepEqual(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes).map(q => q.identity.cut), [112]);
});
