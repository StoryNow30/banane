'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, seconde relecture, point 1) — DEUX RELANCES de la deuxième passe : ce que lit le panneau reste juste.
 * Lot 111 à 115, 112 et 114 décidés « valider » ; le lot s'arrête sur une pose non validée (115). Relance 1 : 112 écrit, 114 refusé (la liste le dit vert, refus passager),
 * arrêt. Relance 2 : 114 encore vert, arrêt : le panneau dit « 1 posé sur 2 décidés » et propose encore « Relancer ». Relance 3 : 114 redevenu rouge, écrit. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x));

test('relances : compteurs cumulés (décidés = écrits + restants), « calcul » au départ de chaque relance, « Relancer » tant qu’il reste un cut', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true, statuts: { 114: 'valid' } });
  const vue = () => j(x.b.get('vuePanneau')().passeDifferes);
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112]);
  assert.deepEqual([vue().etat, vue().posees, vue().ecrites, vue().differes], ['arretee', 2, 1, 2]);
  const depart = await x.b.api('passe-differes-ecrire');
  assert.equal(depart.etat, 'calcul', 'au départ d’une relance, ni ancien message ni bouton');assert.equal(depart.message, null);
  await x.b.get('passeDiff').cours;
  assert.deepEqual([vue().etat, vue().posees, vue().ecrites, vue().differes], ['arretee', 2, 1, 2], 'il reste le 114 : « Relancer » reste proposé (décidés > écrits)');
  x.adapter.statuts = {};
  await x.b.api('passe-differes-ecrire'); await x.b.get('passeDiff').cours;
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112, 114]);
  assert.deepEqual([vue().etat, vue().posees, vue().ecrites, vue().differes], ['finie', 2, 2, 2]);
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin').map(e => e.cuts), [[112, 114], [112, 114], [114], [114]]);
});
