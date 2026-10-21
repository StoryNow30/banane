'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : ce qu'elle refuse et comment elle s'arrête (montage : tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, ev } = require('./helpers/passe-differes.cjs');

test('écriture : une relecture en pause tient ESV, la passe n’y écrit pas', async () => {
  const x = await lotPasse({ passe: { passes: 1 } });
  x.b.get('relecture').passe = { etat: 'en-pause' };
  x.adapter.identity.cut = 116;
  await assert.rejects(x.b.api('passe-differes-ecrire'), /Relecture en pause/, 'le panneau ne la relance pas');
  /* La garde de la passe elle-même (départ automatique en fin de lot) : */
  await x.b.get('passeDiffEcrireDemande')(); await x.b.get('passeDiff').cours;
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(fin.issue, 'refus-depart'); assert.match(fin.raison, /relecture est en cours ou en pause/);
  assert.deepEqual(x.adapter.enPlace, []);
});
