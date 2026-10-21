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

test('voisins cohérents (cap 6, coupé) : une pose isolée sur une autre voie n\'est plus le voisin le plus proche', () => {
  const pos = mm => Object.fromEntries(['left', 'right'].map(s => [s, L.positionOf(base.rails[s], [mm[0] / 1000, mm[1] / 1000, mm[2] / 1000])]));
  const v = (c, lat) => ({ identity: { part: 1, cut: c, frameId: null }, positions: pos([(c - 100) * 1000, lat, 5]) });
  const voisins = [v(99, -120), v(96, 140), v(95, 141), v(102, 110), v(103, 108)];
  const sans = L1.voieAbsolue(base, 100, voisins, 6), avec = L1.voieAbsolue(base, 100, voisins, 6, 3, { parCutMm: 40, baseMm: 15 });
  assert.equal(Math.round(sans.left.proche[0]), -120, 'sans le levier : la pose isolée est le voisin le plus proche');
  assert.equal(avec.left.distProche, 2); assert.equal(Math.round(avec.left.proche[0]), 110, 'avec : le plus proche des voisins cohérents');
  assert.equal(L1.voieAbsolue(base, 100, [v(99, -120), v(102, 110)], 6, 3, { parCutMm: 40, baseMm: 15 }).left.distProche, 1, 'moins de trois voisins : inchangé');
  assert.equal(L1.LEVIERS_LIVRES.voisinsCoherents, false);
});

/* Cap 5b — gardes sur la correction d'écartement (leviers coupés par défaut). Cas fabriqué sur la capture réelle d'essai : rails soutenus par le nuage
 * à (-36, 5) et (20, 5) ; la test 13 valide cette paire (p 0,81). */
function casSoutenu(zone) {
  const h = (decal, origines, g) => ({ rang: 0, hauteur: false, origines, sousOrigines: [], decal, g, x: null });
  return { cut: 4, zone, gMed: 1450, G0: 1500, voieRef: null, i0: { left: 0, right: 0 },
    rails: { left: { hyps: [h([0, 0, 0], ['H0'], 1450), h([0, -36, 5], ['H1'], 1486)] }, right: { hyps: [h([0, 0, 0], ['H0'], 1450), h([0, 20, 5], ['H2'], 1470)] } } };
}
const MOD = { seuils: { abords: { actif: true, tau: 0.44, delta: 2 }, adv: { actif: true, tau: 0.44, delta: 2 }, hors: { actif: true, tau: 0.45, delta: 3 } } };
const PR = { left: [0.2, 0.9], right: [0.2, 0.9] };
const decider = (zone, dg, lev) => { const g = L1.ecartementDecal(base, { left: [0, -36, 5], right: [0, 20, 5] }); L1.reglerLeviers(lev);
  try { return L1.deciderL1e(casSoutenu(zone), MOD, { mm: g + dg }, base, PR); } finally { L1.reglerLeviers(null); } };

test('anomalieNonCorrigeePMin : anomalie sans correction possible, paire de la test 13 gardée si p assez haut et nuage favorable ; coupé par défaut', () => {
  assert.equal(decider('adv', 25, null).motif, 'anomalie-non-corrigee', 'défaut : rien');
  const d = decider('adv', 25, { anomalieNonCorrigeePMin: 0.8 });
  assert.equal(d.etat, 'valider'); assert.deepEqual(d.paire.left.decal, [0, -36, 5]); assert.equal(d.correction.appliquee, false);
  assert.equal(decider('adv', 25, { anomalieNonCorrigeePMin: 0.9 }).motif, 'anomalie-non-corrigee', 'p 0,81 sous le seuil 0,9');
  /* Garde de voie : le voisin validé le plus proche (cut 3) doit être à 35 mm au plus, en travers, sur chaque rail. */
  const pos = (lat, vert) => Object.fromEntries(['left', 'right'].map(s => [s, L.positionOf(base.rails[s], [-1, lat[s] / 1000, vert / 1000])]));
  const voisin = lat => ({ identity: { part: 1, cut: 3, frameId: null }, positions: pos(lat, 5) });
  const g = L1.ecartementDecal(base, { left: [0, -36, 5], right: [0, 20, 5] });
  const avec = (voisins, lev) => { L1.reglerLeviers({ anomalieNonCorrigeePMin: 0.8, ...lev }); try { const k = { ...casSoutenu('adv'), voisinsAbs: voisins }; return L1.deciderL1e(k, MOD, { mm: g + 25 }, base, PR); } finally { L1.reglerLeviers(null); } };
  assert.equal(avec(null, { anomalieNonCorrigeeVoieMm: 35 }).motif, 'anomalie-non-corrigee', 'sans voisin : pas gardée');
  assert.equal(avec([voisin({ left: -26, right: 25 })], { anomalieNonCorrigeeVoieMm: 35 }).etat, 'valider', 'voisin à 10 et 5 mm');
  assert.equal(avec([voisin({ left: -26, right: 62 })], { anomalieNonCorrigeeVoieMm: 35 }).motif, 'anomalie-non-corrigee', 'voisin à 42 mm sur le rail droit : refusée');
  assert.equal(avec([voisin({ left: -26, right: 62 })], {}).etat, 'valider', 'sans la garde de voie : gardée (garde coupée)');
});

test('corrigeValideZones : hors des zones listées, la paire validée par la test 13 n\'est pas corrigée par l\'écartement ; coupé par défaut', () => {
  const dflt = decider('abords', -15, null); assert.equal(dflt.correction.appliquee, true, 'défaut : corrigée');
  const ab = decider('abords', -15, { corrigeValideZones: ['adv'] });
  assert.equal(ab.etat, 'valider'); assert.equal(ab.correction.appliquee, false); assert.deepEqual(ab.paire.left.decal, [0, -36, 5]); assert.deepEqual(ab.paire.right.decal, [0, 20, 5]);
  assert.equal(decider('adv', -15, { corrigeValideZones: ['adv'] }).correction.appliquee, true, 'en ADV : corrigée comme avant');
});

/* Cap 5b — rechPaireTopMin et rechContraRatioMax (coupés par défaut). Cas fabriqué : un voisin validé à la place des rails soutenus ; la recherche recentrée
 * trouve une paire dont le dessus est de 67 points. */
test('rechPaireTopMin : plancher de soutien de dessus de la paire retenue ; coupé par défaut', () => {
  const g = L1.ecartementDecal(base, { left: [0, -36, 5], right: [0, 20, 5] });
  const pos = (lat, vert) => Object.fromEntries(['left', 'right'].map(s => [s, L.positionOf(base.rails[s], [-1, lat[s] / 1000, vert / 1000])]));
  const k = { ...casSoutenu('adv'), voisinsAbs: [{ identity: { part: 1, cut: 3, frameId: null }, positions: pos({ left: -36, right: 20 }, 5) }] };
  const avec = lev => { L1.reglerLeviers({ rechercheADV: true, ...lev }); try { return L1.deciderL1e(k, MOD, { mm: g }, base, { left: [0.2, 0.1], right: [0.2, 0.1] }); } finally { L1.reglerLeviers(null); } };
  assert.equal(avec({}).motif, 'recherche-adv', 'défaut : la paire (dessus 67) est posée');
  assert.equal(avec({ rechPaireTopMin: 60 }).motif, 'recherche-adv', 'plancher 60 : dessus 67, posée');
  assert.equal(avec({ rechPaireTopMin: 100 }).etat, 'rien', 'plancher 100 : dessus 67, refusée');
});

test('rechContraRatioMax : découple le rapport des cellules qui contredisent du rapport de la paire (cellules rendues au filtre le plus large)', () => {
  const g = L1.ecartementDecal(base, { left: [0, -36, 5], right: [0, 20, 5] });
  const k = casSoutenu('adv');
  const diag = lev => { L1.reglerLeviers({ rechercheADV: true, diag: true, rechercheDiag: true, ...lev }); try { return L1.deciderL1e(k, MOD, { mm: g }, base, { left: [0.2, 0.1], right: [0.2, 0.1] }).diag.recherche.cellules; } finally { L1.reglerLeviers(null); } };
  const n = c => c.left.length + c.right.length, strict = diag({ rechRatioMax: 1.0 }), large = diag({ rechRatioMax: 1.0, rechContraRatioMax: 2 });
  assert.ok(n(large) >= n(strict), 'rapport de contradiction 2 : au moins les cellules du filtre strict');
  assert.ok(large.left.concat(large.right).every(c => c[2] <= 2) && strict.left.concat(strict.right).every(c => c[2] <= 1));
});

test('rechSauteProcheMm : une pose validée à 2,5 mm du voisin validé le plus proche n\'est pas cherchée ; coupé par défaut', () => {
  const g = L1.ecartementDecal(base, { left: [0, -36, 5], right: [0, 20, 5] });
  const pos = (lat, vert) => Object.fromEntries(['left', 'right'].map(s => [s, L.positionOf(base.rails[s], [-1, lat[s] / 1000, vert / 1000])]));
  const voisin = lat => [{ identity: { part: 1, cut: 3, frameId: null }, positions: pos(lat, 5) }];
  const avec = (lat, lev) => { L1.reglerLeviers({ rechercheADV: true, diag: true, rechercheDiag: true, ...lev }); try { return L1.deciderL1e({ ...casSoutenu('adv'), voisinsAbs: voisin(lat) }, MOD, { mm: g }, base, { left: [0.2, 0.9], right: [0.2, 0.9] }); } finally { L1.reglerLeviers(null); } };
  assert.ok(avec({ left: -36, right: 20 }, {}).diag.recherche, 'défaut : recherche faite');
  const sauté = avec({ left: -36, right: 20 }, { rechSauteProcheMm: 2.5 });
  assert.equal(sauté.diag.recherche, undefined, 'voisin à 0 mm : recherche sautée'); assert.equal(sauté.etat, 'valider');
  assert.ok(avec({ left: -30, right: 20 }, { rechSauteProcheMm: 2.5 }).diag.recherche, 'voisin à 6 mm : recherche faite');
});
