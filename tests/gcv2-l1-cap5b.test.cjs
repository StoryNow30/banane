'use strict';
/* Cap 5b — RECHERCHE RECENTRÉE EN ADV (leviers coupés par défaut) : voie absolue des voisins validés, recherche du moteur recentré sur une graine,
 * paires de cellules fortes à l'écartement de référence. Capture réelle du corpus d'essai (tests/fixtures.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L1 = require('../src/gcv2-l1.js'), L = require('../src/lot-decision.js'), { base } = require('./fixtures.cjs');
const pres = (cells, lat, vert, tol = 3) => cells.some(x => Math.hypot(x.mm[1] - lat, x.mm[2] - vert) <= tol);

test('recherche recentrée : le même champignon est retrouvé depuis des graines différentes (fenêtres déplacées, moteur inchangé)', () => {
  const a = L1.rechercheRecentree(base, { left: [0, 0], right: [0, 0] }), b = L1.rechercheRecentree(base, { left: [-40, 5], right: [30, 0] });
  for (const r of [a, b]) for (const s of ['left', 'right']) assert.ok(r[s].length, `${s} : au moins une cellule forte`);
  /* Meilleure cellule du départ (perte minimale) retrouvée depuis les graines déplacées, à 3 mm près. */
  for (const s of ['left', 'right']) { const x = a[s].find(c => c.ratio === 1); assert.ok(x && pres(b[s], x.mm[1], x.mm[2]), `${s} : ${x && x.mm} retrouvée`); }
  /* Toutes les cellules rendues sont fortes (dessus ≥ 15, flanc ≥ 6) et compétitives. */
  for (const s of ['left', 'right']) for (const x of a[s]) { assert.ok(x.top >= 15 && x.face >= 6); assert.ok(x.ratio <= 1.5); }
  assert.deepEqual(L1.rechercheRecentree(base, { left: [0, 0] }).right, undefined, 'rail sans graine : non cherché');
});

test('voie absolue : poses des voisins lues dans le repère de la pose de départ du cut ; voisin le plus proche et ajustement', () => {
  const pos = mm => Object.fromEntries(['left', 'right'].map(s => [s, L.positionOf(base.rails[s], [mm[0] / 1000, mm[1] / 1000, mm[2] / 1000])]));
  const v = c => ({ identity: { part: 1, cut: c, frameId: null }, positions: pos([(c - 100) * 1000, 20 + (100 - c) * 2, 5]) });
  const va = L1.voieAbsolue(base, 100, [v(99), v(98), v(97), v(120)], 6);
  for (const s of ['left', 'right']) {
    assert.deepEqual(va[s].proche.map(Math.round), [22, 5], `${s} : voisin le plus proche (cut 99)`);
    assert.equal(va[s].distProche, 1); assert.deepEqual(va[s].n, { avant: 3, apres: 0 }, 'hors fenêtre : ignoré');
    assert.ok(Math.abs(va[s].v[0] - 20) < 0.5 && Math.abs(va[s].v[1] - 5) < 0.5, `${s} : ajustement en 0 ${va[s].v}`);
  }
  assert.equal(L1.voieAbsolue(base, 100, [v(120)], 6), null, 'aucun voisin dans la fenêtre');
});

test('paires recentrées : seulement à l\'écartement de référence ; graines en double fusionnées', () => {
  const g = L1.ecartementDecal(base, { left: [0, -38, 6], right: [0, 29, 4] });
  const r = L1.pairesRecentrees(base, [{ nom: 'a', left: [0, 0], right: [0, 0] }, { nom: 'b', left: [1, 1], right: [0, 2] }], g, null, 10);
  assert.deepEqual(r.graines, ['a=b'], 'graine à moins de 5 mm : même recherche');
  assert.ok(r.paires.length && r.paires.every(p => Math.abs(p.dg) <= 10));
  assert.ok(r.paires.some(p => Math.abs(p.decal.left[1] + 38) < 3 && Math.abs(p.decal.right[1] - 29) < 3));
  assert.equal(L1.pairesRecentrees(base, [{ nom: 'a', left: [0, 0], right: [0, 0] }], g + 200, null, 10).paires.length, 0, 'écartement hors référence : aucune paire');
});
