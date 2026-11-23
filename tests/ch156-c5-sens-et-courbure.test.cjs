'use strict';
/* CH-156 (Lot C5, D-380 / D-381) :
 *  1. Levée du mutisme de sens (`muet: 'sens'`) sur les longues parties peu sinueuses :
 *     - par `rapportSensCourbe` (coût cinématique évalué sur les seules coupes de voie courante en courbe `max(|pP|,|pM|) >= 10 mm`,
 *       sans dilution par des milliers de coupes droites où `pP ≈ pM ≈ 0`) ;
 *     - et support optionnel de `trajAzimuth` (azimut de trajectoire en radians ou degrés) s'il est présent sur la table ;
 *     - tout en restant prudemment muet si `sensCourbe !== sensGlobal` ou si `sensRapportMin: 1e9` est forcé.
 *  2. Garde pure de flèche / courbure longitudinale sur 5 coupes (`jugerCourbure`) :
 *     - détecte et refuse une pose erronée en hauteur ou tordue dans l'axe (ex. +85 mm en vertical alors que l'écart latéral à l'axe est 0 mm),
 *       pondérée par la courbure cinématique `dθ/ds` de `ancre-trajectoire.js` ;
 *     - laisse passer à 100 % une voie lisse ou en courbe régulière (0 faux positif).
 * Toutes les données sont 100 % synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../src/ancre-trajectoire.js');
const L = require('../src/lot-decision.js');
const { base } = require('./fixtures.cjs');

const a = 4, w = 14, DEMI = 0.7185, OX = 500, OY = 1000;

function construirePartieLonguePeuSinueuse({ nDroiteAvant = 2200, nCourbe = 45, nDroiteApres = 2200, rayon = 480, bruitMm = 9.0, inverse = false } = {}) {
  const U0 = nDroiteAvant, U1 = nDroiteAvant + nCourbe, n = nDroiteAvant + nCourbe + nDroiteApres;
  function voie(u) {
    if (u < U0) return { x: u, y: 0, phi: 0 };
    if (u < U1) { const t = (u - U0) / rayon; return { x: U0 + rayon * Math.sin(t), y: rayon * (1 - Math.cos(t)), phi: t }; }
    const t = (U1 - U0) / rayon, x1 = U0 + rayon * Math.sin(t), y1 = rayon * (1 - Math.cos(t));
    return { x: x1 + (u - U1) * Math.cos(t), y: y1 + (u - U1) * Math.sin(t), phi: t };
  }
  function lointain(u) {
    const B = voie(u); let lo = u + w - 0.5, hi = u + w + 1;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2, q = voie(m); if (Math.hypot(q.x - B.x, q.y - B.y) - w > 0) hi = m; else lo = m; }
    return voie((lo + hi) / 2);
  }
  function reference(u) { const B = voie(u), Aq = lointain(u), ux = (Aq.x - B.x) / w, uy = (Aq.y - B.y) / w; return { x: B.x - a * ux, y: B.y - a * uy }; }

  const pas = 0.05, dense = []; let s = 0, prec = null;
  for (let u = 20; u < 20 + n + 40; u += pas) { const p = reference(u); if (prec) s += Math.hypot(p.x - prec.x, p.y - prec.y); dense.push({ s, x: p.x, y: p.y, u }); prec = p; }
  const coupes = []; let j = 1;
  for (let k = 0; k < n; k++) {
    const sk = 2 + k; while (dense[j].s < sk) j++;
    const p0 = dense[j - 1], p1 = dense[j], f = (sk - p0.s) / (p1.s - p0.s), P = { x: p0.x + f * (p1.x - p0.x), y: p0.y + f * (p1.y - p0.y) };
    const q0 = dense[Math.max(0, j - 4)], q1 = dense[Math.min(dense.length - 1, j + 4)], L2 = Math.hypot(q1.x - q0.x, q1.y - q0.y);
    const t = { x: (q1.x - q0.x) / L2, y: (q1.y - q0.y) / L2 }, e = { x: -t.y, y: t.x };
    let lo = p0.u - 10, hi = p0.u + 30;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2, c = voie(m); if ((c.x - P.x) * t.x + (c.y - P.y) * t.y > 0) hi = m; else lo = m; }
    const C = voie((lo + hi) / 2);
    coupes.push({ P, e, C, az: Math.atan2(t.y, t.x) });
  }
  const ordre = inverse ? coupes.slice().reverse() : coupes;
  const st = [], fl = [], ed = [], az = [];
  ordre.forEach((c, i) => {
    const e = inverse ? { x: -c.e.x, y: -c.e.y } : c.e;
    const bruit = ((i * 73) % 19 - 9) / 9 * (bruitMm / 1000);
    const cx = c.C.x + bruit * e.x, cy = c.C.y + bruit * e.y;
    st.push(0); fl.push(0);
    az.push(c.az);
    for (const sg of [1, -1]) ed.push(Math.round((cx + sg * DEMI * e.x + OX) * 1e4), Math.round((cy + sg * DEMI * e.y + OY) * 1e4), 0);
  });
  return { n, st, fl, ed, az };
}

test('CH-156 (C5a) : une longue partie peu sinueuse (courbe courte diluée par 3,6 km de droite) n\'est plus muette sur le sens', () => {
  for (const inverse of [false, true]) {
    const t = construirePartieLonguePeuSinueuse({ inverse });
    const Mo = A.preparer(t);
    assert.equal(Mo.ok, true);
    assert.equal(Mo.sens, inverse ? -1 : 1, 'vrai sens retrouvé');
    assert.ok(Mo.rapportSensGlobal < 1.10, `le rapport global dilué était bien < 1.10 (${Mo.rapportSensGlobal?.toFixed(3)})`);
    assert.ok(Mo.rapportSens >= 1.10, `le rapport sur les coupes en courbe lève le mutisme (${Mo.rapportSens.toFixed(3)})`);
    const ax = A.axe(Mo, 2222);
    assert.equal(ax.muet, undefined, 'plus aucun mutisme sens dans la courbe');
    assert.ok(Math.abs(ax.mm) <= 10, `axe précis dans la courbe malgré le bruit ±9 mm (${ax.mm.toFixed(1)} mm)`);
  }
});

test('CH-156 (C5a) : support optionnel de trajAzimuth pour orienter le sens sur une partie purement droite', () => {
  const t = construirePartieLonguePeuSinueuse({ nDroiteAvant: 200, nCourbe: 0, nDroiteApres: 200, rayon: 1e9, bruitMm: 1.0, inverse: true });
  const Mo = A.preparer({ n: t.n, st: t.st, fl: t.fl, ed: t.ed, trajAzimuth: t.az });
  assert.equal(Mo.ok, true);
  assert.equal(Mo.sens, -1, 'trajAzimuth oriente sans ambiguïté sens = -1 sur une partie purement droite');
});

test('CH-156 (C5b) : jugerCourbure détecte une faute en hauteur ou de gauchissement dans l\'axe sur 5 coupes et laisse passer une voie régulière', () => {
  assert.equal(typeof A.jugerCourbure, 'function', 'jugerCourbure doit être exposée par src/ancre-trajectoire.js');

  const t = construirePartieLonguePeuSinueuse({ nDroiteAvant: 120, nCourbe: 60, nDroiteApres: 120, bruitMm: 0.5 });
  const E = A.etat(t);
  const pL0 = base.rails.left.positionSceneRelative, pR0 = base.rails.right.positionSceneRelative;
  const dx = pL0[0] - pR0[0], dy = pL0[1] - pR0[1], g0 = Math.hypot(dx, dy), nx = dy / g0, ny = -dx / g0;

  /* 4 coupes voisines (98, 99, 101, 102) alignées le long de la normale `n` : */
  const voisins = [98, 99, 101, 102].map(c => ({
    identity: { part: 1, cut: c, frameId: null },
    positions: {
      left: [pL0[0] + (c - 100) * nx, pL0[1] + (c - 100) * ny, pL0[2]],
      right: [pR0[0] + (c - 100) * nx, pR0[1] + (c - 100) * ny, pR0[2]],
    },
  }));
  const cap100 = { identity: { part: 1, cut: 100, frameId: null }, rails: base.rails };

  const jSain = A.jugerCourbure(E, 100, cap100, { left: pL0.slice(), right: pR0.slice() }, voisins);
  assert.equal(jSain.refus, false, 'une pose alignée avec ses 4 voisins sur 5 coupes passe');

  const posFauteAxe = {
    left: L.positionOf(base.rails.left, [0, 0, 0.085]),
    right: L.positionOf(base.rails.right, [0, 0, 0.085]),
  };
  const jFaute = A.jugerCourbure(E, 100, cap100, posFauteAxe, voisins);
  assert.equal(jFaute.refus, true, 'une pose à +85 mm en hauteur par rapport aux 4 voisins consécutifs est refusée par jugerCourbure');
  assert.ok(Math.abs(jFaute.flecheVertMm) > 60);
});
