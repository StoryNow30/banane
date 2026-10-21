'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : ce qu'elle refuse et comment elle s'arrête (montage : tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x));

test('écriture : un cut que la liste d’ESV dit vert n’est jamais écrasé ; la passe s’arrête à la première pose non écrite', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true, statuts: { 112: 'valid' } }));
  assert.deepEqual(x.pasPasse, ['goToCut', 'goToCut', 'capture'], 'lectures seulement : ni pose ni validation, et le cut 114 n’est pas visité');
  const e = ev(x.b, 'passe-differes-ecriture'); assert.deepEqual(e.map(q => [q.identity.cut, q.resultat]), [[112, 'refuse']]); assert.match(e[0].raison, /valid.*pas un cut rouge, rien n’est écrasé/);
  assert.equal(ev(x.b, 'passe-differes-ecriture-fin').at(-1).issue, 'refuse');
  assert.equal(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes).length, 0);
  assert.deepEqual([j(x.b.get('vuePanneau')().passeDifferes)].map(v => [v.etat, v.ecrites]), [['arretee', 0]]);
});
