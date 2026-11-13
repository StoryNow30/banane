'use strict';
/* CH-121 : étage d'ajustement fin de la pose sur le profil du rail (exploration ; le patch reprend ce code).
 * Chaque rail séparément, à sa pose finale `decal` (mm, repère profil de la pose de départ, [long, lat, vert]) :
 *  - points du nuage dans le repère du gabarit posé (u latéral vers le champignon, u = 0 au flanc côté voie ; z vertical, 0 au dessus) ;
 *  - VERTICAL : points de dessus (u dans le champignon, |z| < bande) ; épaisseur e = q90 − q10 ; hauteur estimée = q50 + c ;
 *    bouge si topN ≥ minTop, e ≤ epMax, |dz| ≥ tolV, |dz| ≤ dzMax ;
 *  - LATÉRAL : points de flanc (z de −34 à −9 mm sous le dessus) ; recherche du flanc dans ±largeur (histogramme), position = médiane du paquet + faceOff ;
 *    bouge si faceN ≥ minFace, un seul paquet (pas deux minimums), |du| ≥ tolL, |du| ≤ duMax ;
 *  - écartement de la paire après : dans [gMin, gMax] et changé de gMaxDelta au plus, sinon le latéral n'est pas appliqué.
 * Le gabarit est celui de `placement-convention.js` (contour du champignon de la capture). */
const path = require('node:path');
const C = require(path.join(__dirname, '../../../../vendor/capture-core.js'));
const Conv = require(path.join(__dirname, '../../../../src/placement-convention.js'));
const SIDES = ['left', 'right'];
const DEF = { domaine: 8, mode: null, c: 4.4, minTop: 15, epMax: 15, tolV: 4, dzMax: 13, lat: false, minFace: 6, tolL: 3, duMax: 20, scanMm: 25, faceOff: -2.6, binMm: 2, gMin: 1425, gMax: 1475, gMaxDelta: 25, vert: true };
const q = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function lirePoints(capture, s, d, R = DEF) {
  const rail = capture.rails[s], t = Conv.template(rail); if (!t) return null;
  const bu = t.sign * d[1] / 1000, bz = d[2] / 1000, pts = capture.pointsSceneRelative || [], vis = capture.visibleByClipBoxes;
  const top = [], faceZ = [];
  for (let i = 0; i < pts.length; i++) {
    if (vis && vis[i] === false) continue; const p = pts[i]; if (!Array.isArray(p)) continue;
    const qq = C.point(rail.sceneRelativeToProfileLocal, p); if (!(Math.abs(qq[0]) <= .5 && (R.fenetreDepart ? Math.abs(qq[1]) < .18 && Math.abs(qq[2]) < .10 : Math.abs(qq[1] - d[1] / 1000) < .18 && Math.abs(qq[2] - d[2] / 1000) < .10))) continue;
    const lu = t.sign * qq[1] - bu, lz = qq[2] - bz;
    if (lu > .012 && lu < t.width - .012 && Math.abs(lz) < .012) { const z = t.topAt(lu); if (z !== null && Math.abs(lz - z) < .012) top.push((lz - z) * 1000); }
    if (lz < -.009 && lz > -.034 && Math.abs(lu) < (R.scanMm + 12) / 1000) { const u = t.faceAt(lz); if (u !== null) faceZ.push((lu - u) * 1000); }
  }
  return { t, top, face: faceZ };
}
/* Paquets de points de flanc : histogramme en pas de binMm sur ±scanMm ; rend les paquets (pics séparés par un creux). */
function paquets(face, R) {
  const w = R.binMm, n = Math.ceil(2 * R.scanMm / w), h = new Array(n).fill(0);
  for (const v of face) { const k = Math.floor((v + R.scanMm) / w); if (k >= 0 && k < n) h[k]++; }
  const out = []; let cur = null;
  for (let k = 0; k < n; k++) { if (h[k] > 0) { if (!cur) cur = { a: k, b: k, n: 0 }; cur.b = k; cur.n += h[k]; } else if (cur) { out.push(cur); cur = null; } }
  if (cur) out.push(cur);
  return out.map(p => ({ ...p, lo: -R.scanMm + p.a * w, hi: -R.scanMm + (p.b + 1) * w }));
}
function ajuster(capture, decal, reglage = {}) {
  const R = { ...DEF, ...reglage }, out = { left: decal.left.slice(), right: decal.right.slice() }, info = {}, lat = {};
  for (const s of SIDES) {
    const P = lirePoints(capture, s, decal[s], R); if (!P) { info[s] = 'gabarit'; continue; }
    const I = (info[s] = { topN: P.top.length });
    if (R.vert && P.top.length >= R.minTop) {
      const ep = q(P.top, .9) - q(P.top, .1), dz = q(P.top, .5) + R.c; I.ep = Math.round(ep * 10) / 10; I.dz = Math.round(dz * 10) / 10;
      const dz90 = q(P.top, .9) + 1; I.dz90 = Math.round(dz90 * 10) / 10;
      if (R.mode === 'conv') {
        /* convention refaite à la pose (q90 + 1) dans son domaine ; hors domaine, médiane + c si la bande est nette */
        const v = Math.abs(dz90) <= R.domaine ? dz90 : (ep <= R.epMax && Math.abs(dz) <= R.dzMax ? dz : null);
        if (v != null && Math.abs(v) >= R.tolV) { out[s][2] = decal[s][2] + v; I.v = Math.round(v * 10) / 10; }
      } else if (ep <= R.epMax && Math.abs(dz) >= R.tolV && Math.abs(dz) <= R.dzMax && (R.dz90Min == null || Math.abs(dz90) > R.dz90Min)) { out[s][2] = decal[s][2] + dz; I.v = 1; }
    }
    if (R.lat) {
      const pk = R.bande ? [{ lo: -12, hi: 12, n: P.face.filter(v => Math.abs(v) < 12).length }] : paquets(P.face, R).filter(p => p.n >= 2); I.faceN = P.face.length; I.paquets = pk.length;
      if (pk.length === 1 && pk[0].n >= R.minFace) {
        const vs = P.face.filter(v => v >= pk[0].lo && v < pk[0].hi), du = q(vs, .5) + R.faceOff;
        if (Math.abs(du) >= R.tolL && Math.abs(du) <= R.duMax) lat[s] = P.t.sign * du;
      }
    }
  }
  if (R.lat && Object.keys(lat).length) {
    const g0 = gauge(capture, decal), nd = { left: out.left.slice(), right: out.right.slice() };
    for (const s of SIDES) if (lat[s] != null) nd[s][1] = decal[s][1] + lat[s];
    const g1 = gauge(capture, nd);
    if (g1 >= R.gMin && g1 <= R.gMax && Math.abs(g1 - g0) <= R.gMaxDelta) { for (const s of SIDES) if (lat[s] != null) { out[s][1] = nd[s][1]; info[s].l = Math.round(lat[s] * 10) / 10; } }
    else info.ecartement = Math.round(g1);
  }
  return { decal: out, info };
}
const L = require(path.join(__dirname, '../../../../src/lot-decision.js'));
function gauge(capture, d) { const p = s => L.positionOf(capture.rails[s], d[s].map(v => v / 1000)); return 1000 * C.distance(p('left'), p('right')); }
module.exports = { ajuster, DEF, lirePoints, paquets };
/* `iter` lectures successives, chacune à la pose rendue par la précédente ; le déplacement total reste borné par rail (latMaxTotal, vertMaxTotal). */
const unePasse = module.exports.ajuster;
module.exports.ajuster = function (capture, decal, reglage = {}) {
  const n = reglage.iter || 1; let d = decal, info = [];
  for (let k = 0; k < n; k++) { const r = unePasse(capture, d, reglage); info.push(r.info); if (r.decal.left.every((v, i) => v === d.left[i]) && r.decal.right.every((v, i) => v === d.right[i])) break; d = r.decal; }
  if (n > 1) for (const s of SIDES) { const dl = d[s][1] - decal[s][1], dv = d[s][2] - decal[s][2];
    if (Math.abs(dl) > (reglage.latMaxTotal ?? 20) || Math.abs(dv) > (reglage.vertMaxTotal ?? 13)) d = { ...d, [s]: decal[s].slice() }; }
  return { decal: d, info: n > 1 ? info : info[0] };
};
