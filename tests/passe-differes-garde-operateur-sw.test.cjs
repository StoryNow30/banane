'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, relecture adversariale, points 2 à 4) — CHAQUE GARDE D'ÉCRITURE DE LA DEUXIÈME PASSE, une par essai (tests/helpers/passe-differes.cjs :
 * lot 111 à 115, 112 et 114 différés puis décidés « valider » en fin de lot ; le lot s'arrête sur une pose non validée, l'opérateur la valide, la passe est relancée).
 * Chaque essai rougit si la garde est retirée. Aucune garde ne laisse partir une pose ni une validation vers ESV, sauf la preuve de validation (pose envoyée, gardée, à contrôler). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const ecrit = x => x.pasPasse.filter(c => c === 'apply' || c === 'validateInPlace');
const fin = x => ev(x.b, 'passe-differes-ecriture-fin').at(-1);

test('cut rouge mais « traité par un opérateur » dans la liste d’ESV : jamais écrasé (D-363 : la passe passe au suivant)', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  x.adapter.operateur = [112];
  await relancer(x);
  /* D-363 : la garde ne vaut que pour le 112 ; la passe passe ensuite au 114, qui s'écrit. Avant (D-237) : arrêt, rien d'écrit. */
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [114], '112 jamais validé'); assert.equal(ecrit(x).filter(c => c === 'apply').length, 1, 'une seule pose : celle du 114');
  assert.match(fin(x).raison, /invalid, traité par un opérateur/);
});
