'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, relecture adversariale, points 2 à 4) — CHAQUE GARDE D'ÉCRITURE DE LA DEUXIÈME PASSE, une par essai (tests/helpers/passe-differes.cjs :
 * lot 111 à 115, 112 et 114 différés puis décidés « valider » en fin de lot ; le lot s'arrête sur une pose non validée, l'opérateur la valide, la passe est relancée).
 * Chaque essai rougit si la garde est retirée. Aucune garde ne laisse partir une pose ni une validation vers ESV, sauf la preuve de validation (pose envoyée, gardée, à contrôler). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const fin = x => ev(x.b, 'passe-differes-ecriture-fin').at(-1);

test('validation envoyée mais compteur « N on M treated » inchangé : non prouvée, la pose reste, la passe s’arrête', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true, opts: { sansEffet: true } });
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112], 'le 114 n’est pas visité');
  assert.equal(fin(x).issue, 'incertain'); assert.match(fin(x).raison, /compteur ou cut affiché inattendus/);
  assert.deepEqual(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes), [], 'rien n’est compté');
});
