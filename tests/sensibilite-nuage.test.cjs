'use strict';
/* CH-012 : sensibilité du nuage (ce que les points permettent de situer). Données synthétiques à bruit connu. */
const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../tools/sensibilite-nuage.cjs');
const G = require('../src/geometry-candidate-v1.js');

function alea(g) { let s = g >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r()); }

/* Champignon synthétique (mètres) : plan de roulement z=0 pour u de 0 à 0,07, flanc interne u=0 de z=0 à −0,04. */
function contour() {
  const v = [];
  for (let u = 0; u <= 0.0701; u += 0.005) v.push([u, 0]);
  for (let z = -0.005; z >= -0.0401; z -= 0.005) v.push([0, z]);
  return v;
}
/* Nuage : surface du champignon décalée de (du, dz), bruit gaussien sigma (m) sur u et z. */
function nuage(sigma, du, dz, graine) {
  const r = alea(graine), pts = [];
  for (let i = 0; i < 1500; i++) {
    const x = (r() - 0.5) * 0.6;
    if (r() < 0.6) pts.push([0.075 * r() + du + sigma * gauss(r), dz + sigma * gauss(r), x]);
    else pts.push([du + sigma * gauss(r), -0.045 * r() + dz + sigma * gauss(r), x]);
  }
  return pts;
}
function capture(pts) {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return { rails: { left: { sceneRelativeToProfileLocal: I, profileContours: [{ verticesSceneRelative: contour().map(([u, z]) => [0, u, z]) }] } },
    pointsSceneRelative: pts.map(([u, z, x]) => [x, u, z]) };
}

test('X, le pourcentage du meilleur score, est écrit avant la mesure', () => {
  assert.equal(S.PARAMETRES.xPourCent, 10);
  assert.equal(S.PARAMETRES.pasMm, 0.5);
  assert.equal(S.PARAMETRES.etendueMm, 10);
});

test('parité avec propose : même perte du modèle à la graine de propose', () => {
  const c = capture(nuage(0.001, 0.004, -0.002, 7));
  const p = G.propose(c, 'left', {});
  assert.ok(p.metrics && Number.isFinite(p.metrics.templateLoss), 'propose rend templateLoss');
  const prof = S.profilDe(c, 'left');
  const [u, z] = p.metrics.seed;
  const L = S.perte(prof, u, z);
  assert.ok(Math.abs(L - p.metrics.templateLoss) <= 1e-7 * (Math.abs(u) + Math.abs(z)) + 1e-12, `${L} contre ${p.metrics.templateLoss}`);
});

test('le minimum de la perte retrouve le décalage injecté (à 1 mm)', () => {
  const c = capture(nuage(0.0008, 0.004, -0.002, 11));
  const r = S.sensibilite(S.profilDe(c, 'left'));
  assert.ok(Math.abs(r.argminMm.u - 4) <= 1 && Math.abs(r.argminMm.z + 2) <= 1, JSON.stringify(r.argminMm));
});

test('la dispersion du minimum grandit avec le bruit du nuage, par axe (rééchantillonnage reproductible)', () => {
  const pf = sig => S.profilDe(capture(nuage(sig, 0, 0, 3).slice(0, 500)), 'left');
  const fin = S.incertitude(pf(0.0005)), gros = S.incertitude(pf(0.004));
  assert.ok(gros.sdMm.u > fin.sdMm.u, `u ${gros.sdMm.u} > ${fin.sdMm.u}`);
  assert.ok(gros.sdMm.z > fin.sdMm.z, `z ${gros.sdMm.z} > ${fin.sdMm.z}`);
  assert.deepEqual(S.incertitude(pf(0.004)), gros);
});

test('nuage insuffisant : rendu non estimable, rien d\'inventé', () => {
  const r = S.sensibilite(S.profilDe(capture(nuage(0.001, 0, 0, 1).slice(0, 4)), 'left'));
  assert.equal(r.statut, 'non-estimable');
  assert.equal(r.largeurMm, null);
  assert.equal(S.incertitude(null).statut, 'non-estimable');
});
