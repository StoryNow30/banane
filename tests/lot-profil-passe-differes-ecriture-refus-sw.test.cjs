'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : ce qu'elle refuse et comment elle s'arrête (montage : tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x));

/* D-363 (opérateur, 17/11) : un refus AVANT toute pose dans ESV n'arrête plus la passe : elle passe au cut suivant (10 écritures au plus, inchangé).
 * Avant (D-237) : arrêt au premier refus ; terrain du 16/11, partie 27 : un refus « cible hors de la vue » au premier cut, 0 écrit sur 10 demandés. */
test('écriture : un cut que la liste d’ESV dit vert n’est jamais écrasé ; la passe passe au cut suivant (D-363)', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true, statuts: { 112: 'valid' } }));
  assert.deepEqual(x.pasPasse.slice(0, 3), ['goToCut', 'goToCut', 'capture'], '112 : lectures seulement, ni pose ni validation');
  assert.equal(x.pasPasse.filter(c => c === 'validateInPlace').length, 1, 'une seule validation : celle du 114');
  const e = ev(x.b, 'passe-differes-ecriture'); assert.deepEqual(e.map(q => [q.identity.cut, q.resultat]), [[112, 'refuse'], [114, 'ecrit']]); assert.match(e[0].raison, /valid.*pas un cut rouge, rien n’est écrasé/);
  assert.equal(e[0].avantPose, true);
  const f = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(f.issue, 'refuse', 'liste parcourue, un refus : la passe se dit arrêtée sur lui'); assert.match(f.raison, /pas un cut rouge/); assert.equal(f.ecrites, 1); assert.equal(f.refusees, 1);
  assert.deepEqual(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes).map(q => q.identity.cut), [114]);
  assert.deepEqual([j(x.b.get('vuePanneau')().passeDifferes)].map(v => [v.etat, v.ecrites]), [['arretee', 1]], '« Relancer » reste offert pour le cut refusé');
});
