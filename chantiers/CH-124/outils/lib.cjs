'use strict';
/* CH-124 : outils communs de mesure (hors ligne, lecture seule). Données : dossier de travail du banc de CH-116 (CH116_TRAVAIL, hors dépôt).
 * Rien n'est écrit au dépôt par ce module ; les sorties des outils ne portent que des numéros de cut, des millimètres et des degrés.
 * Repère « coupe » d'un cut : origine au milieu des deux rails de la pose de départ d'ESV, X = normale du plan de coupe (axe long du profil,
 * horizontal), Z = verticale de la scène, Y = Z × X (travers). Unités : mètres en entrée (scène relative), millimètres en sortie. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const C = require(path.join(RACINE, 'vendor', 'capture-core.js'));
const { LOTS, cle, travail } = require(path.join(RACINE, 'chantiers', 'CH-116', 'outils', 'lots.cjs'));
const SIDES = ['left', 'right'];
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const meta = k => JSON.parse(fs.readFileSync(path.join(travail(), 'meta', k + '.json'), 'utf8'));
const entrees = (lots = null) => LOTS.filter(e => lots ? lots.includes(e.lot) : !e.vierge);
function corpus() {
  const f = process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl'), m = new Map();
  for (const l of lireJsonl(f)) { const k = `${l.lot}-p${l.partie}-r${l.rang}`; if (!m.has(k)) m.set(k, new Map()); m.get(k).set(l.cut, l); }
  return m;
}
/* Captures réduites d'un lot-partie : Map cut → capture (la dernière si un cut en a plusieurs). */
function captures(k, filtre = null) {
  const out = new Map();
  for (const f of [].concat(meta(k).captures)) {
    let doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const c of doc.clouds || []) if (c && Number.isInteger(c.cut) && (!filtre || filtre(c.cut))) out.set(c.cut, c);
    doc = null;
  }
  return out;
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
/* Position de scène d'un décalage [long, lat, vert] (mm) depuis le rail de départ (comme L.positionOf). */
function positionDe(rail, mm) {
  const P = rail.profileLocalToSceneRelative, w = C.point(P, mm.map(v => v / 1000)), o = C.point(P, [0, 0, 0]);
  return rail.positionSceneRelative.map((v, i) => v + w[i] - o[i]);
}
/* Repère « coupe » : { O, X, Y, Z } en scène relative ; versCoupe(p) rend [x, y, z] en mm. */
function repere(cap) {
  const L = cap.rails.left, R = cap.rails.right, M = L.profileLocalToSceneRelative;
  let X = unit([M[0], M[1], M[2]]);
  const up = [0, 0, 1];
  X = unit(sub(X, mul(up, dot(X, up)))); /* X horizontal */
  const Z = up, Y = cross(Z, X);
  const O = mul(add(L.positionSceneRelative, R.positionSceneRelative), 0.5);
  const versCoupe = p => { const d = sub(p, O); return [1000 * dot(d, X), 1000 * dot(d, Y), 1000 * dot(d, Z)]; };
  return { O, X, Y, Z, versCoupe, capDeg: Math.atan2(X[1], X[0]) * 180 / Math.PI };
}
/* Points du nuage dans le repère coupe (mm), avec intensité si présente. */
function pointsCoupe(cap, rep = repere(cap)) {
  const P = cap.pointsSceneRelative, n = P.length, x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
  for (let i = 0; i < n; i++) { const q = rep.versCoupe(P[i]); x[i] = q[0]; y[i] = q[1]; z[i] = q[2]; }
  return { n, x, y, z, intensite: cap.attributes && cap.attributes.intensity || null, visible: cap.visibleByClipBoxes || null };
}
/* Pose (décalages mm par rail, repère profil du rail de départ) → positions des deux rails dans le repère coupe (mm). */
function poseCoupe(cap, decal, rep = repere(cap)) {
  if (!decal) return null; const o = {};
  for (const s of SIDES) { if (!decal[s]) return null; o[s] = rep.versCoupe(positionDe(cap.rails[s], decal[s])); }
  return o;
}
const departCoupe = (cap, rep = repere(cap)) => Object.fromEntries(SIDES.map(s => [s, rep.versCoupe(cap.rails[s].positionSceneRelative)]));
const med = a => { const s = Array.from(a).filter(Number.isFinite).sort((p, q) => p - q); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (a, q) => { const s = Array.from(a).filter(Number.isFinite).sort((p, r) => p - r); if (!s.length) return null; const i = (s.length - 1) * q, b = Math.floor(i); return s[b] + (s[Math.min(b + 1, s.length - 1)] - s[b]) * (i - b); };
module.exports = { RACINE, C, LOTS, cle, travail, SIDES, lireJsonl, meta, entrees, corpus, captures, dot, sub, add, mul, cross, unit, positionDe, repere, pointsCoupe, poseCoupe, departCoupe, med, quantile };
