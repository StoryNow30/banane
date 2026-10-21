'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : ce qu'elle refuse et comment elle s'arrête (montage : tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer } = require('./helpers/passe-differes.cjs');

test('écriture : une relecture choisie attend la passe (elle ne la bloque pas) et part après elle', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true, relecture: 'ombre' }));
  assert.match(x.refus.raison, /pose d’Ariane attend ta validation au cut 115/, 'refus pour la pose en attente, pas pour la relecture en préparation');
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112, 114]);
  const fins = x.b.store.events.map(e => e.type).filter(t => /^(passe-differes-ecriture-fin|relecture-fin)$/.test(t));
  assert.deepEqual(fins.slice(0, 2), ['passe-differes-ecriture-fin', 'relecture-fin'], 'la relecture ne part qu’après la passe');
});
