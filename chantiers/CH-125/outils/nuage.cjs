'use strict';
/* CH-125 : lecture du nuage autour d'un rail, dans le repère profil (hors ligne, lecture seule).
 * Sert à toutes les mesures du chantier : points du rail avec leur abscisse le long de la voie, gabarit du champignon, bandes du dessus et du flanc.
 * Repère (celui de `src/geometry-candidate-v1.js` et de `src/placement-convention.js`) : x le long de la voie (m, 0 = plan de coupe), u latéral orienté
 * vers le champignon (u = 0 au flanc côté voie), z vertical. Mètres en interne. Aucune référence humaine n'entre ici. */
const path = require('node:path');
const RACINE = process.env.CH125_CODE || path.join(__dirname, '..', '..', '..');
const C = require(path.join(RACINE, 'vendor', 'capture-core.js'));
const Conv = require(path.join(RACINE, 'src', 'placement-convention.js'));

/* Points visibles du rail `side` : [x, u, z] (u orienté), dans la fenêtre du moteur (|x| ≤ 0,5 ; |u brut| < 0,18 ; |z| < 0,10), décalés de `centre`
 * (décalage publié [0, sign·u, z], m) si `fenetreCentree` : la fenêtre suit alors la pose au lieu de la pose de départ d'ESV. */
function pointsRail(capture, side, { centre = null, demiLargeur = 0.18, demiHauteur = 0.10, demiLongueur = 0.5 } = {}) {
  const rail = capture.rails[side], t = Conv.template(rail);
  if (!t) return null;
  const cu = centre ? t.sign * centre[1] : 0, cz = centre ? centre[2] : 0, out = [];
  const P = capture.pointsSceneRelative, V = capture.visibleByClipBoxes, M = rail.sceneRelativeToProfileLocal;
  for (let i = 0; i < P.length; i++) {
    if (V && V[i] === false) continue;
    const s = P[i]; if (!Array.isArray(s) || !s.every(Number.isFinite)) continue;
    const q = C.point(M, s), u = t.sign * q[1];
    if (Math.abs(q[0]) <= demiLongueur && Math.abs(u - cu) < demiLargeur && Math.abs(q[2] - cz) < demiHauteur) out.push([q[0], u, q[2]]);
  }
  return { sign: t.sign, largeur: t.width, gabarit: t, points: out };
}
/* Contour du champignon [u, z] (m), tel que le moteur le lit (partie haute, z > −40 mm). */
function contour(rail) {
  const k = rail.profileContours.reduce((a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  const shape = k.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const ys = shape.map(p => p[1]).sort((a, b) => a - b), sign = Math.sign(ys[ys.length >> 1]);
  return shape.map(p => [sign * p[1], p[2]]);
}
const quantile = (v, p) => { if (!v.length) return NaN; const s = v.slice().sort((a, b) => a - b), i = (s.length - 1) * p, b = Math.floor(i); return s[b] + (s[Math.min(b + 1, s.length - 1)] - s[b]) * (i - b); };
const mediane = v => quantile(v, 0.5);
/* Droite robuste y = a + b·x (Theil-Sen sur un sous-échantillon, médiane des résidus). */
function droite(xs, ys) {
  const n = xs.length; if (n < 8) return null;
  const pas = Math.max(1, Math.floor(n / 60)), pentes = [];
  for (let i = 0; i < n; i += pas) for (let j = i + pas; j < n; j += pas) { const dx = xs[j] - xs[i]; if (Math.abs(dx) > 0.03) pentes.push((ys[j] - ys[i]) / dx); }
  if (pentes.length < 6) return null;
  const b = mediane(pentes), a = mediane(ys.map((y, i) => y - b * xs[i]));
  return { a, b };
}
module.exports = { pointsRail, contour, quantile, mediane, droite, RACINE, C, Conv };
