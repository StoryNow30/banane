'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), fonction pure.
 * Données : décalages [long, lat, vert] (mm, repère profil de la pose de départ) des poses de la passe au banc de T21a sur la partie 0 du 23/10
 * (fiches/EXAMEN_PASSE_PARTIE0.md § 1 et § 4) ; la plus proche pose de la chaîne normale est mise à la distance mesurée par l'examen. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../src/garde-passe-appuis.js');
const S = require('../src/settings.js');
const R = A.reglage(S.lot.passeDifferes.gardeAppuis, S.passeDifferesDefaut.gardeAppuis);
const pose = (cut, l, r, appui) => ({ cut, decal: { left: [0, l[0], l[1]], right: [0, r[0], r[1]] }, cutsNormaux: appui === null ? [] : [cut - appui] });
/* Les cinq poses fausses (150 à 266 mm de l'opérateur) : plus proche appui de la chaîne normale du tableau § 4 ; D recalculé sur les décalages arrondis au dixième
 * (48,0, 27,4, 54,1, 71,8 et 92,1 mm sur les décalages exacts du banc). */
const FAUSSES = [
  [1135, [-48.0, 2.5], [-12.4, 0.8], 5, 48.1],
  [1328, [1.9, -1.3], [-22.6, -15.6], 28, 27.5],
  [1329, [49.4, -22.0], [-14.4, -42.4], 27, 54.1],
  [1331, [70.0, -15.8], [0, 0], 25, 71.8],
  [1332, [90.0, -19.4], [40.1, 4.5], 24, 92.1],
];

test('réglage livré : actif, 100 mm, 4 cuts (src/settings.js)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(S.passeDifferesDefaut.gardeAppuis)), { actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 });
  assert.equal(S.lot.passeDifferes.gardeAppuis, S.passeDifferesDefaut.gardeAppuis);
  assert.ok(Object.isFrozen(S.passeDifferesDefaut.gardeAppuis));
  assert.deepEqual(R, { ok: true, actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 });
});

test('les cinq poses fausses de la partie 0 (1135, 1328, 1329, 1331, 1332) sont refusées : « rien », motif garde-appuis', () => {
  for (const [cut, l, r, appui, D] of FAUSSES) {
    const g = A.juger(pose(cut, l, r, appui), R);
    assert.deepEqual(g, { bloque: true, motif: 'garde-appuis', deplacementMm: D, appuiNormalCuts: appui }, 'cut ' + cut);
  }
});

test('1350 (D 43,8 mm, appui de la chaîne normale à 1 cut) passe ; les poses loin du départ passent sans regarder les appuis', () => {
  assert.deepEqual(A.juger(pose(1350, [0.8, 2.1], [-43.8, 1.5], 1), R), { bloque: false, motif: 'appui-normal', deplacementMm: 43.8, appuiNormalCuts: 1 });
  /* 901 du lot 2 (D 200 mm, chaîne normale à 455 cuts) : juste à 0,5 mm ; la garde ne regarde pas les appuis au-delà de 100 mm. */
  assert.deepEqual(A.juger(pose(901, [-200.0, 0], [-199.0, 0], 455), R), { bloque: false, motif: 'loin-du-depart', deplacementMm: 200, appuiNormalCuts: 455 });
  assert.equal(A.juger(pose(901, [-200.0, 0], [-199.0, 0], null), R).bloque, false, 'loin du départ, même sans aucun appui');
});

test('cas limites : 100 mm (strict), 4 cuts passe, 5 cuts refusé, aucun appui refusé, avant ou après le cut', () => {
  const p = (D, appui) => A.juger(pose(500, [D, 0], [0, 0], appui), R);
  assert.equal(p(100, null).bloque, false, 'D = 100 mm : n’est pas « à moins de 100 mm »');
  assert.equal(p(100, null).motif, 'loin-du-depart');
  assert.equal(p(99.99, 5).bloque, true, 'D = 99,99 mm, appui à 5 cuts');
  assert.equal(p(99.99, 4).bloque, false, 'appui à 4 cuts : passe');
  assert.equal(p(10, 5).bloque, true); assert.equal(p(10, 4).bloque, false);
  assert.equal(p(10, null).bloque, true, 'aucune pose de la chaîne normale dans le lot');
  assert.equal(p(10, null).appuiNormalCuts, null);
  /* Le plus proche, avant ou après ; le cut lui-même ne compte pas ; une valeur illisible est ignorée. */
  assert.equal(A.appuiNormalCuts(500, [490, 504, 520]), 4); assert.equal(A.appuiNormalCuts(500, [496, 512]), 4);
  assert.equal(A.appuiNormalCuts(500, [500, 506]), 6); assert.equal(A.appuiNormalCuts(500, [null, '501', 1.5, 507]), 7);
  assert.equal(A.juger({ cut: 500, decal: { left: [0, 10, 0], right: [0, 0, 0] }, cutsNormaux: [504] }, R).bloque, false, 'appui après le cut, à 4');
  assert.equal(A.juger({ cut: 500, decal: { left: [0, 10, 0], right: [0, 0, 0] }, cutsNormaux: [505, 495] }, R).bloque, true, 'avant et après, à 5');
  /* Déplacement : norme 3D, pire rail ; le décalage longitudinal compte. */
  assert.equal(A.deplacementMm({ left: [60, 80, 0], right: [0, 0, 0] }), 100);
  assert.equal(A.juger({ cut: 1, decal: { left: [60, 80, 0], right: [0, 0, 0] }, cutsNormaux: [] }, R).bloque, false);
});

test('seules les poses de la chaîne normale sont des appuis : les poses de la GCV2 dans le lot et celles de la passe ne comptent pas', () => {
  /* 1135 : 1134 (GCV2 dans le lot, 135 mm faux) à 1 cut ; la passe a posé 1136 ; la chaîne normale est à 1140 (5 cuts). L'appelant ne passe que la chaîne normale. */
  const lot = [{ cut: 1134, source: 'gcv2' }, { cut: 1136, source: 'passe' }, { cut: 1140, source: 'chaine' }, { cut: 1110, source: 'chaine' }];
  const normaux = lot.filter(p => p.source === 'chaine').map(p => p.cut);
  const g = A.juger({ cut: 1135, decal: { left: [0, -48.0, 2.5], right: [0, -12.4, 0.8] }, cutsNormaux: normaux }, R);
  assert.equal(g.bloque, true); assert.equal(g.appuiNormalCuts, 5);
  assert.equal(A.juger({ cut: 1135, decal: { left: [0, -48.0, 2.5], right: [0, -12.4, 0.8] }, cutsNormaux: lot.map(p => p.cut) }, R).bloque, false,
    'si on comptait la GCV2 dans le lot ou la passe, la pose fausse passerait');
});

test('réglage : clé absente = livré, clé par clé ; false ou actif:false coupe la garde ; toute valeur illisible : ok:false (la passe est coupée)', () => {
  const D = S.passeDifferesDefaut.gardeAppuis;
  assert.deepEqual(A.reglage(undefined, D), R); assert.deepEqual(A.reglage({}, D), R);
  assert.deepEqual(A.reglage({ deplacementMaxMm: 60 }, D), { ...R, deplacementMaxMm: 60 });
  assert.deepEqual(A.reglage({ appuiNormalMaxCuts: 0 }, D), { ...R, appuiNormalMaxCuts: 0 });
  assert.equal(A.reglage(false, D).actif, false); assert.equal(A.reglage({ actif: false }, D).actif, false);
  const coupee = A.juger(pose(1328, [1.9, -1.3], [-22.6, -15.6], 28), A.reglage(false, D));
  assert.deepEqual(coupee, { bloque: false, motif: 'garde-coupee', deplacementMm: 27.5, appuiNormalCuts: 28 }, 'coupée : mesurée, jamais bloquante');
  for (const v of [true, null, 'oui', 1, [], [{}]]) assert.equal(A.reglage(v, D).ok, false, JSON.stringify(v));
  for (const v of [{ actif: 'true' }, { actif: 1 }, { deplacementMaxMm: 0 }, { deplacementMaxMm: -5 }, { deplacementMaxMm: '100' }, { deplacementMaxMm: NaN }, { deplacementMaxMm: null },
    { appuiNormalMaxCuts: -1 }, { appuiNormalMaxCuts: 2.5 }, { appuiNormalMaxCuts: '4' }, { appuiNormalMaxCuts: null }]) assert.equal(A.reglage(v, D).ok, false, JSON.stringify(v));
  assert.deepEqual(A.reglage(undefined), R, 'sans défaut passé : celui du module, égal au livré');
});

test('décalage illisible ou réglage illisible : refus (la garde ne laisse passer que ce qu’elle a mesuré)', () => {
  for (const decal of [null, {}, { left: [0, 1, 2] }, { left: [0, 1], right: [0, 0, 0] }, { left: [0, NaN, 0], right: [0, 0, 0] }, { left: [0, '1', 0], right: [0, 0, 0] }]) {
    const g = A.juger({ cut: 7, decal, cutsNormaux: [6] }, R); assert.equal(g.bloque, true, JSON.stringify(decal)); assert.equal(g.deplacementMm, null);
  }
  assert.equal(A.juger(pose(1350, [0.8, 2.1], [-43.8, 1.5], 1), { ok: false }).bloque, true);
});
