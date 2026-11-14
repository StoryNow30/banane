'use strict';
/* CH-124 : ancre de trajectoire (src/ancre-trajectoire.js). Géométrie de synthèse EXACTE (pas de petits angles) : une voie droite, une courbe à gauche
 * de rayon 200 m sur 60 m, puis droite ; un véhicule à deux pivots sur l'axe de la voie (w = 14 m) dont le point de référence est en porte-à-faux de
 * a = 4 m ; une coupe par mètre de trajectoire, perpendiculaire à sa tangente ; la liste porte, pour chaque coupe, les deux bords de la voie relevée
 * (± 718,5 mm de son axe), sauf mention. Aucune donnée de terrain. */
const test = require('node:test'), assert = require('node:assert');
const A = require('../src/ancre-trajectoire.js');

const R = 200, U0 = 200, U1 = 260, a = 4, w = 14, DEMI = 0.7185, OX = 1200.25, OY = 3400.5;
/* Axe de la voie : position et cap à l'abscisse u. */
function voie(u) {
  if (u < U0) return { x: u, y: 0, phi: 0 };
  if (u < U1) { const t = (u - U0) / R; return { x: U0 + R * Math.sin(t), y: R * (1 - Math.cos(t)), phi: t }; }
  const t = (U1 - U0) / R, x1 = U0 + R * Math.sin(t), y1 = R * (1 - Math.cos(t));
  return { x: x1 + (u - U1) * Math.cos(t), y: y1 + (u - U1) * Math.sin(t), phi: t };
}
/* Pivot lointain : point de l'axe à la corde w du pivot proche (en u), devant lui. */
function lointain(u) { let lo = u + w - 1e-9, hi = u + w + 1; const B = voie(u); const d = v => { const q = voie(v); return Math.hypot(q.x - B.x, q.y - B.y) - w; };
  lo = u + w - 0.5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (d(m) > 0) hi = m; else lo = m; } return voie((lo + hi) / 2); }
/* Trajectoire du point de référence : derrière le pivot proche de `a`, sur l'axe de la caisse. */
function reference(u) { const B = voie(u), Aq = lointain(u), ux = (Aq.x - B.x) / w, uy = (Aq.y - B.y) / w; return { x: B.x - a * ux, y: B.y - a * uy }; }
function construire({ inverse = false, fausses = [], defauts = [], n = 420 } = {}) {
  /* trajectoire dense, puis une coupe par mètre d'abscisse de la trajectoire */
  const pas = 0.02, dense = []; let s = 0, prec = null;
  for (let u = 20; u < 20 + n + 40; u += pas) { const p = reference(u); if (prec) s += Math.hypot(p.x - prec.x, p.y - prec.y); dense.push({ s, x: p.x, y: p.y, u }); prec = p; }
  const coupes = []; let j = 1;
  for (let k = 0; k < n; k++) {
    const sk = 2 + k; while (dense[j].s < sk) j++;
    const p0 = dense[j - 1], p1 = dense[j], f = (sk - p0.s) / (p1.s - p0.s), P = { x: p0.x + f * (p1.x - p0.x), y: p0.y + f * (p1.y - p0.y) };
    const q0 = dense[Math.max(0, j - 6)], q1 = dense[Math.min(dense.length - 1, j + 5)], L = Math.hypot(q1.x - q0.x, q1.y - q0.y), t = { x: (q1.x - q0.x) / L, y: (q1.y - q0.y) / L }, e = { x: -t.y, y: t.x };
    /* axe de la voie dans le plan de la coupe */
    let lo = p0.u - 10, hi = p0.u + 30; const g = v => { const c = voie(v); return (c.x - P.x) * t.x + (c.y - P.y) * t.y; };
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
    const C = voie((lo + hi) / 2), axeMm = 1000 * ((C.x - P.x) * e.x + (C.y - P.y) * e.y);
    coupes.push({ P, e, C, axeMm });
  }
  const ordre = inverse ? coupes.slice().reverse() : coupes;
  const st = [], fl = [], ed = [], verite = [];
  ordre.forEach((c, i) => {
    /* dans une liste lue à rebours, la gauche de la coupe (côté des numéros croissants) change de côté */
    const e = inverse ? { x: -c.e.x, y: -c.e.y } : c.e;
    let centre = c.C, demi = DEMI, statut = 0;
    const faux = fausses.find(x => i >= x.de && i <= x.a);
    if (faux) centre = { x: c.C.x + faux.mm / 1000 * e.x, y: c.C.y + faux.mm / 1000 * e.y };
    if (defauts.includes(i)) { centre = c.P; demi = 0.75; statut = 1; }
    st.push(statut); fl.push(statut ? 2 : 0);
    for (const sg of [1, -1]) ed.push(Math.round((centre.x + sg * demi * e.x + OX) * 1e4), Math.round((centre.y + sg * demi * e.y + OY) * 1e4), 0);
    verite.push({ axeDepuisLigneMm: 1000 * ((c.C.x - centre.x) * e.x + (c.C.y - centre.y) * e.y), axeDepuisTrajectoireMm: inverse ? -c.axeMm : c.axeMm });
  });
  return { table: { n, st, fl, ed }, verite };
}
/* Capture d'un cut : rails de départ = la ligne, en scène relative (monde − T). */
const T = [100.5, -40.25, 3];
function capture(table, cut, dL = [0, 0, 0], dR = dL) { const o = 6 * cut, p = j => [0, 1, 2].map(i => table.ed[o + j + i] / 1e4 - T[i]);
  return { rails: { left: { positionSceneRelative: p(0).map((v, i) => v + dL[i]) }, right: { positionSceneRelative: p(3).map((v, i) => v + dR[i]) } } }; }
const pose = (cap, table, cut, mm) => { const o = 6 * cut, g = Math.hypot(table.ed[o] - table.ed[o + 3], table.ed[o + 1] - table.ed[o + 4]), ex = (table.ed[o] - table.ed[o + 3]) / g, ey = (table.ed[o + 1] - table.ed[o + 4]) / g;
  return Object.fromEntries(['left', 'right'].map(s => [s, cap.rails[s].positionSceneRelative.map((v, i) => v + (i === 0 ? mm / 1000 * ex : i === 1 ? mm / 1000 * ey : 0))])); };

test('réglage figé : θ = 75 mm, a = 4 m, w = 14 m', () => {
  assert.equal(A.REGLAGE.thetaMm, 75); assert.equal(A.REGLAGE.a, 4); assert.equal(A.REGLAGE.w, 14);
});
test('le sens du véhicule est retrouvé (pivots devant, puis liste lue à rebours)', () => {
  const m1 = A.preparer(construire().table); assert.equal(m1.ok, true); assert.equal(m1.sens, 1); assert.ok(m1.rapportSens > 1.5);
  const m2 = A.preparer(construire({ inverse: true }).table); assert.equal(m2.ok, true); assert.equal(m2.sens, -1);
});
test('voie courante : l’axe prédit est sur le milieu de la ligne, courbe comprise (à 3 mm)', () => {
  for (const inverse of [false, true]) {
    const { table, verite } = construire({ inverse }), Mo = A.preparer(table); let pire = 0, courbe = 0;
    for (let c = 30; c < 390; c++) { const x = A.axe(Mo, c); assert.equal(x.muet, undefined); pire = Math.max(pire, Math.abs(x.mm)); courbe = Math.max(courbe, Math.abs(verite[c].axeDepuisTrajectoireMm)); }
    assert.ok(pire < 3, `axe à ${pire.toFixed(1)} mm du milieu de la ligne`);
    assert.ok(courbe > 150, `la courbe déporte bien l'axe de la trajectoire (${courbe.toFixed(0)} mm)`);
  }
});
test('lignes d’ESV sur une autre voie, à 150 mm à gauche, en pleine courbe : l’axe prédit reste sur la voie relevée', () => {
  const { table } = construire({ fausses: [{ de: 205, a: 212, mm: 150 }] }), Mo = A.preparer(table);
  for (let c = 205; c <= 212; c++) { const x = A.axe(Mo, c); assert.ok(Math.abs(x.mm + 150) < 4, `cut ${c} : axe à ${x.mm.toFixed(1)} mm du milieu de la ligne (attendu −150)`); }
});
test('pose par défaut d’ESV (centrée sur la trajectoire) : l’axe prédit est celui de la voie, pas la trajectoire', () => {
  const { table, verite } = construire({ defauts: [195, 208, 225] }), Mo = A.preparer(table);
  for (const c of [195, 208, 225]) { const x = A.axe(Mo, c); assert.ok(Math.abs(verite[c].axeDepuisLigneMm) > 100); assert.ok(Math.abs(x.mm - verite[c].axeDepuisLigneMm) < 4, `cut ${c} : ${x.mm.toFixed(1)} contre ${verite[c].axeDepuisLigneMm.toFixed(1)}`); }
});
test('le levier : pose sur l’autre voie refusée, pose sur la voie relevée gardée', () => {
  const { table } = construire({ fausses: [{ de: 205, a: 212, mm: 150 }] }), E = A.etat(table);
  const cap = capture(table, 208);
  const j1 = A.juger(E, 208, cap, pose(cap, table, 208, 0));
  assert.equal(j1.refus, true); assert.ok(Math.abs(j1.ecartMm - 150) < 4);
  const j2 = A.juger(E, 208, cap, pose(cap, table, 208, -150));
  assert.equal(j2.refus, false); assert.ok(Math.abs(j2.ecartMm) < 4);
  const cap2 = capture(table, 100), j3 = A.juger(E, 100, cap2, pose(cap2, table, 100, 0));
  assert.equal(j3.refus, false); assert.ok(Math.abs(j3.ecartMm) < 3);
  const j4 = A.juger(E, 100, cap2, pose(cap2, table, 100, 76)); assert.equal(j4.refus, true);
  const j5 = A.juger(E, 100, cap2, pose(cap2, table, 100, -70)); assert.equal(j5.refus, false);
});
test('l’ancre se tait : sans table, bout de liste, ligne absente, liste sans voie courante', () => {
  assert.equal(A.etat(null), null);
  const { table } = construire(), Mo = A.preparer(table);
  assert.equal(A.axe(Mo, 5).muet, 'bout-de-liste'); assert.equal(A.axe(Mo, 415).muet, 'bout-de-liste'); assert.equal(A.axe(Mo, 9999).muet, 'ligne-absente'); assert.equal(A.axe(Mo, 25).muet, undefined);
  const t2 = { ...table, fl: table.fl.map(() => 3) }; assert.equal(A.preparer(t2).ok, false); assert.equal(A.axe(A.preparer(t2), 100).muet, 'voie-courante');
  assert.equal(A.juger(A.etat(t2), 100, capture(table, 100), pose(capture(table, 100), table, 100, 0)).muet, 'voie-courante');
  const t3 = { ...table, ed: table.ed.map((v, i) => (Math.floor(i / 6) === 100 ? null : v)) }; assert.equal(A.axe(A.preparer(t3), 100).muet, 'ligne-absente');
});
test('l’ancre se tait : sens non établi et forte correction cinématique', () => {
  const { table } = construire(), Mo = A.preparer(table, { sensRapportMin: 1e9 });
  assert.equal(A.axe(Mo, 215).muet, 'sens'); assert.equal(A.axe(Mo, 100).muet, undefined);
});
test('calage : ligne réécrite (les deux rails ne donnent pas la même translation), ou translation différente de celle du lot', () => {
  const { table } = construire(), E = A.etat(table);
  for (const c of [90, 91, 92]) { const cap = capture(table, c); assert.equal(A.juger(E, c, cap, pose(cap, table, c, 0)).refus, false); }
  const capR = capture(table, 120, [0, 0.03, 0], [0, 0, 0]); assert.equal(A.juger(E, 120, capR, pose(capR, table, 120, 0)).muet, 'calage-ligne');
  const capT = capture(table, 121, [0, 0.13, 0]); assert.equal(A.juger(E, 121, capT, pose(capT, table, 121, 0)).muet, 'calage-lot');
  assert.equal(A.translation(E).n, 3);
});
