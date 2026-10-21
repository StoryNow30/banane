'use strict';
/* Test 17, poses fausses de la partie 3:0 — garde de voie absolue (leviers `vetoVoieAbsMm` et `voieIncoherenteMm`, coupés par défaut). Cas fabriqué sur la capture
 * réelle d'essai (tests/fixtures.cjs) : la test 13 valide une paire soutenue par le nuage à (-36, 5) et (20, 5), à l'écartement de référence ; les voisins validés
 * des cuts 1 à 3 disent où est la voie. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L1 = require('../src/gcv2-l1.js'), L = require('../src/lot-decision.js'), { base } = require('./fixtures.cjs');

const h = (decal, origines, g) => ({ rang: 0, hauteur: false, origines, sousOrigines: [], decal, g, x: null });
const cas = voisinsAbs => ({ cut: 4, zone: 'adv', gMed: 1450, G0: 1500, voieRef: null, i0: { left: 0, right: 0 }, voisinsAbs,
  rails: { left: { hyps: [h([0, 0, 0], ['H0'], 1450), h([0, -36, 5], ['H1'], 1486)] }, right: { hyps: [h([0, 0, 0], ['H0'], 1450), h([0, 20, 5], ['H2'], 1470)] } } });
const MOD = { seuils: { adv: { actif: true, tau: 0.44, delta: 2 }, hors: { actif: true, tau: 0.45, delta: 3 } } };
const PR = { left: [0.2, 0.9], right: [0.2, 0.9] };
const G = L1.ecartementDecal(base, { left: [0, -36, 5], right: [0, 20, 5] });
/* Voisin du cut `c` (un mètre par cut en long), travers `lat(rail)` pour chaque rail. */
const voisin = (c, lat) => ({ identity: { part: 1, cut: c, frameId: null },
  positions: Object.fromEntries(['left', 'right'].map(s => [s, L.positionOf(base.rails[s], [c - 4, lat[s] / 1000, 5 / 1000])])) });
const decider = (voisins, lev) => { L1.reglerLeviers({ ...L1.LEVIERS_V4, ...lev }); try { return L1.deciderL1e(cas(voisins), MOD, { mm: G }, base, PR); } finally { L1.reglerLeviers(null); } };
const droite = (a, b) => [1, 2, 3].map(c => voisin(c, { left: a + b * (c - 4), right: a + 56 + b * (c - 4) }));

test('garde de voie absolue : coupée dans la v4 et dans la v5 livrée', () => {
  assert.equal(L1.LEVIERS_V4.vetoVoieAbsMm, null); assert.equal(L1.LEVIERS_V4.voieIncoherenteMm, null);
  assert.equal(L1.LEVIERS_LIVRES.vetoVoieAbsMm, null); assert.equal(L1.LEVIERS_LIVRES.voieIncoherenteMm, null);
  assert.equal(decider(droite(150, 0), {}).etat, 'valider', 'garde coupée : la paire de la test 13 est posée, même à 190 mm de la voie des voisins');
});

test('vetoVoieAbsMm : une pose validée loin de la droite ajustée des voisins n\'est pas posée', () => {
  assert.equal(decider(droite(-36, 0), { vetoVoieAbsMm: 100 }).etat, 'valider', 'voisins sur la pose : posée');
  assert.equal(decider(droite(-36 + 80, 0), { vetoVoieAbsMm: 100 }).etat, 'valider', 'voisins à 80 mm : sous le seuil');
  const d = decider(droite(-36 + 150, 0), { vetoVoieAbsMm: 100 });
  assert.equal(d.etat, 'rien'); assert.equal(d.motif, 'veto-voie-absolue'); assert.equal(d.paire, null);
  assert.equal(decider(droite(-36 + 150, 0), { vetoVoieAbsMm: 200 }).etat, 'valider', 'seuil 200 : posée');
  assert.equal(decider(null, { vetoVoieAbsMm: 100 }).etat, 'valider', 'sans voisin : la garde ne dit rien');
  assert.equal(decider([voisin(1, { left: 114, right: 170 })], { vetoVoieAbsMm: 100 }).etat, 'rien', 'un seul voisin, à 3 cuts : sa droite vaut 150 mm de plus');
  assert.equal(decider([voisin(-20, { left: 114, right: 170 })], { vetoVoieAbsMm: 100 }).etat, 'valider', 'voisin hors de la fenêtre : la garde ne dit rien');
});

test('voieIncoherenteMm : des voisins qui ne s\'accordent pas ne tranchent pas, la pose validée n\'est pas posée', () => {
  const zigzag = [1, 2, 3].map((c, i) => voisin(c, { left: -36 + [-70, 70, -70][i], right: 20 + [-70, 70, -70][i] }));
  assert.equal(decider(zigzag, { voieIncoherenteMm: 40 }).motif, 'voie-incoherente');
  assert.equal(decider(zigzag, { voieIncoherenteMm: 100 }).etat, 'valider', 'seuil 100 : posée');
  assert.equal(decider(droite(-36, 0), { voieIncoherenteMm: 40 }).etat, 'valider', 'voisins alignés : posée');
});
