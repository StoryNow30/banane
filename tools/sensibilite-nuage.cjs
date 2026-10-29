#!/usr/bin/env node
'use strict';
/*
 * sensibilite-nuage.cjs — ce que le nuage de points permet de situer autour d'une pose de référence (CH-012). Lecture seule.
 *
 * Pour un rail, on décale le gabarit du champignon autour de la pose de référence (repère profil de cette pose) et on
 * lit le critère d'appui de la GCV2 : la perte du gabarit de `src/geometry-candidate-v1.js` (médiane, sur les ancres du plan
 * de roulement puis du flanc interne, de la distance au carré au point le plus proche, plafonnée à 25 mm). La formule est
 * reproduite ici sans modifier ce module (il ne l'exporte pas) ; l'essai de parité la compare à `propose` (templateLoss).
 *
 * Zone indiscernable : décalages contigus au minimum où le score s = racine(perte) reste sous
 *   (1 + X/100) × max(s_min, plancher), avec X = 10 % et un plancher de 0,5 mm, ÉCRITS ICI AVANT TOUTE MESURE.
 * Largeur = longueur de cette zone le long de l'axe latéral (u) et de l'axe vertical (z), les deux autres coordonnées au minimum.
 *
 * Constat sur nuage synthétique (avant toute donnée réelle) : cette largeur n'est pas monotone avec le bruit (la distance au
 * point le plus proche sature quand le nuage est dense, la largeur suit le plancher et la densité). Elle est donc rendue à titre
 * indicatif ; la statistique principale est la dispersion du minimum quand on rééchantillonne les points (`incertitude` :
 * écart type par axe et demi-largeur à 95 %, 40 réplicats, graine 20261029, écrits ici avant toute mesure réelle). Limite : les
 * points sont rééchantillonnés un à un, la corrélation le long de la voie n'est pas prise en compte (sous-estime la dispersion).
 *
 * Réserve (à reprendre dans le rapport) : borne basse de ce que le nuage permet de situer, pour CE critère. Sans rapport
 * avec la perception, l'ancrage ou le biais de l'opérateur ; le bruit de sa pose se lit dans les poses voisines
 * (fiches/BRUIT_REFERENCE.md § 5), pas ici. Aucune sortie ne contient de coordonnée absolue.
 */
const PARAMETRES = Object.freeze({ xPourCent: 10, plancherMm: 0.5, pasMm: 0.5, etendueMm: 10, minPoints: 8, replicats: 40, graine: 20261029 });
const mediane = a => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y), i = b.length >> 1; return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2; };

/* Profil (têtes, ancres, points) lu comme `propose` : mêmes filtres, mêmes ancres. Rend null si le profil est inutilisable. */
function profilDe(capture, side) {
  const C = require('../vendor/capture-core.js');
  const rail = capture.rails && capture.rails[side];
  if (!rail || !capture.pointsSceneRelative || !capture.pointsSceneRelative.length) return null;
  const contour = (rail.profileContours || []).reduce((a, b) => ((b.verticesSceneRelative || []).length > ((a && a.verticesSceneRelative) || []).length ? b : a), null);
  if (!contour) return null;
  const shape = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(mediane(shape.map(p => p[1])));
  if (!sign) return null;
  const head = shape.map(p => [sign * p[1], p[2]]).filter(p => p[1] > -0.04);
  if (head.length < 6) return null;
  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes && capture.visibleByClipBoxes[i] === false) continue;
    const s = capture.pointsSceneRelative[i];
    if (!Array.isArray(s) || !s.every(Number.isFinite)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, s);
    if (q.every(Number.isFinite) && Math.abs(q[0]) <= 0.5 && Math.abs(q[1]) < 0.18 && Math.abs(q[2]) < 0.10) points.push([sign * q[1], q[2]]);
  }
  const width = Math.max(...head.filter(p => p[1] > -0.012).map(p => p[0]));
  const top = [], face = [];
  for (let u = 0.012; u < width - 0.012; u += 0.006) {
    const near = head.filter(p => Math.abs(p[0] - u) < 0.004);
    if (near.length) top.push([u, Math.max(...near.map(p => p[1]))]);
  }
  for (let z = -0.014; z >= -0.033; z -= 0.004) {
    const near = head.filter(p => Math.abs(p[1] - z) < 0.004);
    if (near.length) face.push([Math.min(...near.map(p => p[0])), z]);
  }
  if (!(width > 0.025 && width < 0.12) || points.length < PARAMETRES.minPoints || top.length < 3 || face.length < 3) return null;
  return { points, top, face };
}

function perteAncres(ancres, points, u, z) {
  return mediane(ancres.map(a => {
    let best = 0.025 * 0.025;
    for (const p of points) { const d = (p[0] - u - a[0]) ** 2 + (p[1] - z - a[1]) ** 2; if (d < best) best = d; }
    return best;
  }));
}
/* Perte du gabarit décalé de (u, z) mètres : plan de roulement + flanc, comme `propose` (sans son terme de départage 1e-7). */
const perte = (prof, u, z) => perteAncres(prof.top, prof.points, u, z) + perteAncres(prof.face, prof.points, u, z);

function sensibilite(prof, options = {}) {
  const P = { ...PARAMETRES, ...options };
  if (!prof) return { statut: 'non-estimable', largeurMm: null, argminMm: null };
  const n = Math.round(P.etendueMm / P.pasMm), N = 2 * n + 1;
  const s = [];
  let min = { s: Infinity, i: 0, j: 0 };
  for (let i = 0; i < N; i++) {
    s.push([]);
    for (let j = 0; j < N; j++) {
      const u = (i - n) * P.pasMm / 1000, z = (j - n) * P.pasMm / 1000;
      const v = 1000 * Math.sqrt(perte(prof, u, z));
      s[i].push(v);
      if (v < min.s) min = { s: v, i, j };
    }
  }
  const seuil = (1 + P.xPourCent / 100) * Math.max(min.s, P.plancherMm);
  const etendue = (get, k0) => {
    let a = k0, b = k0;
    while (a > 0 && get(a - 1) <= seuil) a--;
    while (b < N - 1 && get(b + 1) <= seuil) b++;
    return { a, b, bord: a === 0 || b === N - 1 };
  };
  const eu = etendue(i => s[i][min.j], min.i), ez = etendue(j => s[min.i][j], min.j);
  const largeur = e => Math.round((e.b - e.a + 1) * P.pasMm * 100) / 100;
  return {
    statut: eu.bord || ez.bord ? 'zone-hors-fenetre' : 'ok',
    largeurMm: { u: largeur(eu), z: largeur(ez) },
    argminMm: { u: (min.i - n) * P.pasMm, z: (min.j - n) * P.pasMm },
    scoreMinMm: Math.round(min.s * 1000) / 1000, scoreReferenceMm: Math.round(s[n][n] * 1000) / 1000,
    seuilMm: Math.round(seuil * 1000) / 1000, points: prof.points.length,
  };
}

function aleatoire(graine) {
  let s = (graine >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* Minimum de la perte par recherche grossière (1 mm, ±6 mm) puis fine (0,25 mm, ±1 mm autour du grossier). */
function minimum(prof) {
  let b = { v: Infinity, u: 0, z: 0 };
  const cherche = (cu, cz, r, pas) => {
    for (let u = cu - r; u <= cu + r + 1e-12; u += pas) for (let z = cz - r; z <= cz + r + 1e-12; z += pas) {
      const v = perte(prof, u / 1000, z / 1000);
      if (v < b.v) b = { v, u, z };
    }
  };
  cherche(0, 0, 6, 1);
  cherche(b.u, b.z, 1, 0.25);
  return b;
}
/* Dispersion du minimum quand on rééchantillonne les points (avec remise) : ce que le nuage fixe de la pose, par axe, en mm. */
function incertitude(prof, options = {}) {
  const P = { ...PARAMETRES, ...options };
  if (!prof) return { statut: 'non-estimable', sdMm: null, demiLargeur95Mm: null };
  const r = aleatoire(P.graine), n = prof.points.length, us = [], zs = [];
  for (let k = 0; k < P.replicats; k++) {
    const pts = Array.from({ length: n }, () => prof.points[Math.floor(r() * n)]);
    const m = minimum({ ...prof, points: pts });
    us.push(m.u); zs.push(m.z);
  }
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
  const demi = a => { const b = a.slice().sort((x, y) => x - y), q = p => b[Math.min(b.length - 1, Math.max(0, Math.round(p * (b.length - 1))))]; return (q(0.975) - q(0.025)) / 2; };
  const arr = v => Math.round(v * 100) / 100;
  return { statut: 'ok', replicats: P.replicats, sdMm: { u: arr(sd(us)), z: arr(sd(zs)) }, demiLargeur95Mm: { u: arr(demi(us)), z: arr(demi(zs)) } };
}

module.exports = { PARAMETRES, profilDe, perte, sensibilite, incertitude, minimum };
