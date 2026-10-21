'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, relecture adversariale, points 2 à 4) — CHAQUE GARDE D'ÉCRITURE DE LA DEUXIÈME PASSE, une par essai (tests/helpers/passe-differes.cjs :
 * lot 111 à 115, 112 et 114 différés puis décidés « valider » en fin de lot ; le lot s'arrête sur une pose non validée, l'opérateur la valide, la passe est relancée).
 * Chaque essai rougit si la garde est retirée. Aucune garde ne laisse partir une pose ni une validation vers ESV, sauf la preuve de validation (pose envoyée, gardée, à contrôler). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const fin = x => ev(x.b, 'passe-differes-ecriture-fin').at(-1);

test('le cut n’est posé qu’atteint par un pas (boutons d’ESV), jamais juste après un saut de la carte', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  const aller = x.adapter.goToCut.bind(x.adapter);
  x.adapter.goToCut = async (t, o, id) => ({ ...await aller(t, o, id), chemin: 'evenement' });
  await relancer(x);
  assert.deepEqual(x.pasPasse, ['goToCut', 'goToCut'], 'saut au cut d’avant, puis pas demandé ; rien de lu ni d’écrit');
  assert.equal(fin(x).issue, 'refuse'); assert.match(fin(x).raison, /atteint par la carte \(saut\) : pas de pose juste après un saut/);
});
