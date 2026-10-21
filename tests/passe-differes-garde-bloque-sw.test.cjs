'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, relecture adversariale, points 2 à 4) — CHAQUE GARDE D'ÉCRITURE DE LA DEUXIÈME PASSE, une par essai (tests/helpers/passe-differes.cjs :
 * lot 111 à 115, 112 et 114 différés puis décidés « valider » en fin de lot ; le lot s'arrête sur une pose non validée, l'opérateur la valide, la passe est relancée).
 * Chaque essai rougit si la garde est retirée. Aucune garde ne laisse partir une pose ni une validation vers ESV, sauf la preuve de validation (pose envoyée, gardée, à contrôler). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, K } = require('./helpers/passe-differes.cjs');
const ecrit = x => x.pasPasse.filter(c => c === 'apply' || c === 'validateInPlace');
const fin = x => ev(x.b, 'passe-differes-ecriture-fin').at(-1);

test('cut bloqué par un résultat incertain archivé : rien n’est écrit', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  x.b.get('engine').s.blockedTargets = [K.key({ ...x.adapter.identity, cut: 112 })];
  await relancer(x);
  assert.deepEqual(ecrit(x), []); assert.match(fin(x).raison, /cible bloquée par un résultat incertain archivé/);
});
