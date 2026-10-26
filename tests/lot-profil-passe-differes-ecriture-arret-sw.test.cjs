'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : ce qu'elle refuse et comment elle s'arrête (montage : tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');

test('écriture : « Arrêter » du panneau arrête la passe avant le cut suivant', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true, opts: { arreterApres: 112 } }));
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112], 'le 114 n’est pas écrit');
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(fin.issue, 'arret'); assert.equal(fin.ecrites, 1); assert.equal(fin.demandees, 2);
});
