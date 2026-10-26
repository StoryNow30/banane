'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS, NIVEAU « ÉCRITURE » (tests/helpers/passe-differes.cjs : lot 111 à 115 (`deux`), les cuts 112 et 114 différés
 * puis forcés à « valider » par la GCV2 pendant la passe). Livrée allumée en écriture, sans plafond de poses : elle pose et valide sur place dans l'ESV simulé, et ne touche à rien d'autre. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');

test('écriture : livrée sans plafond de poses, tous les cuts décidés sont écrits, dans l’ordre de la décision', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true }));
  assert.deepEqual(x.pasPasse, ['goToCut', 'goToCut', 'capture', 'apply', 'validateInPlace', 'goToCut', 'goToCut', 'capture', 'apply', 'validateInPlace']);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112, 114]);
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(fin.issue, 'fin'); assert.equal(fin.ecrites, 2); assert.equal(fin.demandees, 2);
  assert.deepEqual(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes).map(q => q.identity.cut), [112, 114]);
});
