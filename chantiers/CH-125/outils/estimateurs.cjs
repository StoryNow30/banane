'use strict';
/* CH-125 : estimateurs de la pose d'un rail sur son nuage (hors ligne ; fonctions pures, aucune référence humaine).
 * Entrées communes : `pts` = Float32Array [x, u, z, origine]… (m ; x le long de la voie, u latéral orienté vers le champignon, z vertical ; origine
 * 0 = point visible de la coupe, 1 = point chargé hors de la découpe, 2 = coupe voisine), `gab` = gabarit ({ largeur, topAt(u), faceAt(z), contour }),
 * une pose = [u, z] (m) du gabarit depuis la pose de départ. Les résidus sont rendus en millimètres.
 * Bandes : mêmes définitions que `src/placement-convention.js` (dessus : u du gabarit de 12 mm à largeur − 12 mm, écart vertical au gabarit ; flanc :
 * z du gabarit de −34 à −9 mm, écart latéral au flanc ; demi-bande 12 mm), pour que « livré refait » soit comparable au calage livré. */
const N = require('./nuage.cjs');
const q = N.quantile, med = N.mediane;

/* Résidus du dessus et du flanc à une pose. `origines` : ensemble des origines lues ; `xMax` : demi-longueur lue (m) ; `a`, `b` : pentes le long de la
 * voie (m/m) du travers et de la hauteur, retirées des points (le rail est une droite dans la tranche). Rend { top:[{r,x,u}], face:[{r,x,z}] }. */
function bandes(pts, gab, pose, { origines = [0], xMax = 0.25, a = 0, b = 0, bandeMm = 12, margeMm = 12, flancHaut = -0.009, flancBas = -0.034 } = {}) {
  const top = [], face = [], W = gab.largeur, band = bandeMm / 1000, m = margeMm / 1000, O = new Set(origines);
  for (let i = 0; i < pts.length; i += 4) {
    if (!O.has(pts[i + 3])) continue;
    const x = pts[i]; if (Math.abs(x) > xMax) continue;
    const lu = pts[i + 1] - pose[0] - a * x, lz = pts[i + 2] - pose[1] - b * x;
    if (lu > m && lu < W - m && Math.abs(lz) < band) { const z = gab.topAt(lu); if (z !== null && Math.abs(lz - z) < band) top.push({ r: (lz - z) * 1000, x, u: lu }); }
    if (lz < flancHaut && lz > flancBas && Math.abs(lu) < band) { const u = gab.faceAt(lz); if (u !== null && Math.abs(lu - u) < band) face.push({ r: (lu - u) * 1000, x, z: lz }); }
  }
  return { top, face };
}
/* Le calage livré, refait à une pose (q90 + 1 sur le dessus ; médiane − 2,6 sur le flanc dès 6 points ; domaine ± 8 mm). Constantes du module livré. */
function conventionLivree(pts, gab, pose, opt = {}) {
  const B = bandes(pts, gab, pose, opt), topN = B.top.length, faceN = B.face.length;
  if (topN < 15) return { applique: false, raison: 'top-under-observed', topN, faceN };
  const qs = (v, p) => { const s = v.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const dz = qs(B.top.map(p => p.r), 0.9) + 1.0, du = faceN >= 6 ? qs(B.face.map(p => p.r), 0.5) - 2.6 : 0;
  if (Math.abs(dz) > 8 || Math.abs(du) > 8) return { applique: false, raison: 'shift-out-of-domain', dz, du, topN, faceN };
  return { applique: true, dz, du, topN, faceN, pose: [pose[0] + du / 1000, pose[1] + dz / 1000] };
}
/* Pente robuste d'un résidu le long de la voie (mm par m), ou null. */
function pente(liste) {
  if (liste.length < 12) return null;
  const xs = liste.map(p => p.x), etendue = q(xs, 0.9) - q(xs, 0.1); if (!(etendue > 0.15)) return null;
  const d = N.droite(xs, liste.map(p => p.r)); return d ? d.b : null;
}
/* Centre robuste d'une bande par point fixe : la bande suit la pose jusqu'à ce que son centre soit nul (|centre| < 0,05 mm), 12 tours au plus.
 * `centre` : fonction (résidus triés ou non) → mm ; par défaut la médiane. Les deux axes sont itérés ensemble (le dessus dépend du travers, le flanc
 * de la hauteur). `minTop`, `minFlanc` : sous ces effectifs, l'axe n'est pas déplacé. Rend la pose au centre des bandes et ce qui l'explique. */
function centreBandes(pts, gab, pose0, opt = {}) {
  const { minTop = 15, minFlanc = 6, centre = v => med(v), vertical = true, lateral = true, pentes = false, tours = 12 } = opt;
  let pose = pose0.slice(), a = 0, b = 0, B = null, k = 0, converge = false;
  for (; k < tours; k++) {
    B = bandes(pts, gab, pose, { ...opt, a, b });
    if (pentes) { const pb = pente(B.top), pa = pente(B.face); if (pb !== null && Math.abs(pb - b * 1000) > 0.2) { b = pb / 1000; continue; } if (pa !== null && Math.abs(pa - a * 1000) > 0.2) { a = pa / 1000; continue; } }
    const cz = vertical && B.top.length >= minTop ? centre(B.top.map(p => p.r)) : 0, cu = lateral && B.face.length >= minFlanc ? centre(B.face.map(p => p.r)) : 0;
    if (Math.abs(cz) < 0.05 && Math.abs(cu) < 0.05) { converge = true; break; }
    pose = [pose[0] + cu / 1000, pose[1] + cz / 1000];
  }
  const t = B.top.map(p => p.r), f = B.face.map(p => p.r);
  return { pose, a, b, tours: k, converge, topN: t.length, faceN: f.length,
    epTop: t.length ? q(t, 0.9) - q(t, 0.1) : null, epFace: f.length ? q(f, 0.9) - q(f, 0.1) : null,
    /* incertitude du centre : 1,2533·écart-type robuste / √n (médiane d'un échantillon gaussien) */
    sigmaZ: t.length >= 5 ? 1.2533 * 1.4826 * med(t.map(v => Math.abs(v - med(t)))) / Math.sqrt(t.length) : null,
    sigmaU: f.length >= 3 ? 1.2533 * 1.4826 * med(f.map(v => Math.abs(v - med(f)))) / Math.sqrt(f.length) : null,
    deplaceVert: t.length >= minTop && vertical, deplaceLat: f.length >= minFlanc && lateral };
}

/* ------------------------------------------------------------------ gabarit entier : distance signée au contour du champignon */
/* Contour utile : le champignon du côté voie jusqu'au côté champ (z > −36 mm), polyligne ordonnée. Distance signée d'un point au contour
 * (positive hors de l'acier), point le plus proche et normale sortante. */
function contourChampignon(gab) {
  const C = gab.contour.filter(p => p[1] > -0.0365), cx = C.reduce((s, p) => s + p[0], 0) / C.length;
  /* ordonné par angle autour du centre de la tête, du flanc côté voie (bas gauche) au flanc côté champ (bas droite), par le dessus */
  const c0 = [cx, -0.02], ang = p => Math.atan2(p[1] - c0[1], p[0] - c0[0]);
  const pts = C.slice().sort((p, r) => ang(r) - ang(p)); /* angle décroissant : de π (côté voie) à 0 (côté champ) pour le haut */
  const haut = pts.filter(p => ang(p) >= -0.9 || ang(p) <= -Math.PI + 0.9);
  /* remettre dans l'ordre continu : côté voie bas → dessus → côté champ bas */
  const gauche = haut.filter(p => ang(p) <= -Math.PI + 0.9).sort((p, r) => p[1] - r[1]); /* bas vers haut, côté voie (angles proches de −π) */
  const reste = haut.filter(p => ang(p) > -Math.PI + 0.9).sort((p, r) => ang(r) - ang(p));
  return { poly: gauche.concat(reste), centre: c0 };
}
function distanceContour(K, u, z) {
  const P = K.poly; let best = Infinity, bu = 0, bz = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, L2 = dx * dx + dz * dz;
    let t = L2 > 0 ? ((u - ax) * dx + (z - az) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + t * dx, pz = az + t * dz, d2 = (u - px) ** 2 + (z - pz) ** 2;
    if (d2 < best) { best = d2; bu = px; bz = pz; }
  }
  const d = Math.sqrt(best); let nu = u - bu, nz = z - bz; const n = Math.hypot(nu, nz) || 1; nu /= n; nz /= n;
  /* signe : hors de l'acier si le point est plus loin du centre de la tête que son projeté */
  const dehors = Math.hypot(u - K.centre[0], z - K.centre[1]) >= Math.hypot(bu - K.centre[0], bz - K.centre[1]) ? 1 : -1;
  return { d: dehors * d, nu: dehors * nu, nz: dehors * nz, pu: bu, pz: bz };
}
/* Ajustement du gabarit entier (translation [u, z], pentes en option) par moindres carrés robustes repondérés (poids de Tukey, échelle `echelleMm`),
 * Gauss-Newton depuis `pose0`. Les points lus sont ceux à moins de `portéeMm` du contour posé, dans la zone visible du capteur (dessus et côté
 * voie : u du gabarit < largeur − margeChampMm, pour ne pas lire le côté champ rarement vu). Rend la pose, la covariance (mm²) et les effectifs. */
function ajusterGabarit(pts, gab, pose0, opt = {}) {
  const { origines = [0], xMax = 0.25, porteeMm = 12, echelleMm = 6, tours = 25, a = 0, b = 0, K = contourChampignon(gab), bas = -0.034, sigmaMm = 3 } = opt;
  const O = new Set(origines), W = gab.largeur; let pose = pose0.slice(), cov = null, n = 0, nTop = 0, nFlanc = 0, nCoin = 0, k = 0;
  for (; k < tours; k++) {
    let Suu = 0, Suz = 0, Szz = 0, gu = 0, gz = 0; n = 0; nTop = 0; nFlanc = 0; nCoin = 0;
    for (let i = 0; i < pts.length; i += 4) {
      if (!O.has(pts[i + 3])) continue; const x = pts[i]; if (Math.abs(x) > xMax) continue;
      const lu = pts[i + 1] - pose[0] - a * x, lz = pts[i + 2] - pose[1] - b * x;
      if (lu < -0.03 || lu > W + 0.03 || lz < bas || lz > 0.03) continue;
      const D = distanceContour(K, lu, lz), dmm = D.d * 1000; if (Math.abs(dmm) > porteeMm) continue;
      /* côté voie et dessus seulement : un projeté sur le flanc côté champ est ignoré */
      if (D.pu > W - 0.012 && D.pz < -0.004) continue;
      const w = (1 - (dmm / echelleMm) ** 2); const poids = Math.abs(dmm) < echelleMm ? w * w : 0; if (!poids) continue;
      /* résidu d = distance signée ; dérivée par rapport à la pose : −normale */
      Suu += poids * D.nu * D.nu; Suz += poids * D.nu * D.nz; Szz += poids * D.nz * D.nz; gu += poids * D.nu * dmm; gz += poids * D.nz * dmm; n++;
      if (D.pz > -0.004 && D.pu > 0.012) nTop++; else if (D.pz < -0.009) nFlanc++; else nCoin++;
    }
    const det = Suu * Szz - Suz * Suz; if (!(n >= 10) || !(det > 1e-9)) { cov = null; break; }
    const du = (Szz * gu - Suz * gz) / det, dz = (Suu * gz - Suz * gu) / det;
    cov = [[Szz / det * sigmaMm ** 2, -Suz / det * sigmaMm ** 2], [-Suz / det * sigmaMm ** 2, Suu / det * sigmaMm ** 2]];
    pose = [pose[0] + Math.max(-4, Math.min(4, du)) / 1000, pose[1] + Math.max(-4, Math.min(4, dz)) / 1000];
    if (Math.abs(du) < 0.03 && Math.abs(dz) < 0.03) break;
  }
  return { pose, cov, n, nTop, nFlanc, nCoin, tours: k, sigmaU: cov ? Math.sqrt(cov[0][0]) : null, sigmaZ: cov ? Math.sqrt(cov[1][1]) : null };
}
module.exports = { bandes, conventionLivree, pente, centreBandes, contourChampignon, distanceContour, ajusterGabarit };

/* ------------------------------------------------------------------ CH-125 : mesure « enveloppe » (ce que l'opérateur fait, mesuré par enveloppe.cjs)
 * Hauteur : le dessus du gabarit va au k-ième point le plus haut de la bande du dessus (enveloppe visuelle des points VISIBLES ; un compte absolu,
 * pas un centile), lue dans une fenêtre [−bas, +haut] mm autour de la pose reçue. `tours` > 1 : la fenêtre suit la pose (point fixe).
 * Rend la pose en hauteur, l'effectif, la pente le long de la voie (mm par m), l'épaisseur brute et l'épaisseur une fois la pente retirée. */
function enveloppeDessus(pts, gab, pose0, { origines = [0], xMax = 0.25, k = 8, basMm = 12, hautMm = 14, margeMm = 12, minTop = 15, tours = 1 } = {}) {
  const W = gab.largeur, m = margeMm / 1000, O = new Set(origines); let pose = pose0.slice(), info = null;
  for (let t = 0; t < tours; t++) {
    const L = [];
    for (let i = 0; i < pts.length; i += 4) {
      if (!O.has(pts[i + 3])) continue; const x = pts[i]; if (Math.abs(x) > xMax) continue;
      const lu = pts[i + 1] - pose[0]; if (!(lu > m && lu < W - m)) continue;
      const z = gab.topAt(lu); if (z === null) continue; const r = (pts[i + 2] - pose[1] - z) * 1000;
      if (r > -basMm && r < hautMm) L.push({ r, x });
    }
    if (L.length < minTop) return { ok: false, raison: 'dessus-peu-observe', n: L.length, pose: pose0 };
    const s = L.map(p => p.r).sort((a, b) => b - a), dz = s[Math.min(k, s.length) - 1];
    const d = N.droite(L.map(p => p.x), L.map(p => p.r)), res = d ? L.map(p => p.r - d.a - d.b * p.x) : s;
    info = { n: L.length, dz, pente: d ? d.b : null, ep: q(s, 0.9) - q(s, 0.1), epSansPente: q(res, 0.9) - q(res, 0.1), mediane: med(s), q90: q(s, 0.9),
      sousLeHaut: s.filter(v => v <= dz && v > dz - 6).length };
    pose = [pose[0], pose[1] + dz / 1000];
    if (Math.abs(dz) < 0.05) break;
  }
  return { ok: true, pose, dzTotal: (pose[1] - pose0[1]) * 1000, ...info };
}
/* Travers : le flanc du gabarit va à la médiane de la bande du flanc (points visibles ; s'il y en a moins de `minFlanc`, tous les points chargés de
 * la capture, ±0,5 m, la pente le long de la voie retirée). Fenêtre ±`bandeMm` autour de la pose reçue ; `tours` > 1 : point fixe. */
function centreFlanc(pts, gab, pose0, { minFlanc = 6, bandeMm = 12, tours = 1, charges = true, flancHaut = -0.009, flancBas = -0.034 } = {}) {
  let pose = pose0.slice(), info = null;
  const lire = (origines, xMax, a) => { const O = new Set(origines), L = [];
    for (let i = 0; i < pts.length; i += 4) { if (!O.has(pts[i + 3])) continue; const x = pts[i]; if (Math.abs(x) > xMax) continue;
      const lz = pts[i + 2] - pose[1]; if (!(lz < flancHaut && lz > flancBas)) continue; const u = gab.faceAt(lz); if (u === null) continue;
      const r = (pts[i + 1] - pose[0] - a * x - u) * 1000; if (Math.abs(r) < bandeMm) L.push({ r, x }); }
    return L; };
  for (let t = 0; t < tours; t++) {
    let L = lire([0], 0.25, 0), lecture = 'visibles', a = 0;
    if (L.length < minFlanc && charges) { let L2 = lire([0, 1], 0.5, 0); const p = pente(L2); if (p !== null) { a = p / 1000; L2 = lire([0, 1], 0.5, a); } if (L2.length >= minFlanc) { L = L2; lecture = 'charges'; } }
    if (L.length < minFlanc) return { ok: false, raison: 'flanc-peu-observe', n: L.length, pose: pose0 };
    const v = L.map(p => p.r), du = med(v);
    info = { n: L.length, lecture, du, ep: q(v, 0.9) - q(v, 0.1), sigma: 1.2533 * 1.4826 * med(v.map(x => Math.abs(x - du))) / Math.sqrt(v.length) };
    pose = [pose[0] + du / 1000, pose[1]];
    if (Math.abs(du) < 0.05) break;
  }
  return { ok: true, pose, duTotal: (pose[0] - pose0[0]) * 1000, ...info };
}
module.exports.enveloppeDessus = enveloppeDessus; module.exports.centreFlanc = centreFlanc;

/* ------------------------------------------------------------------ CH-125, niveau 2 : flanc suivi à la pose (copie STATIQUE de `flancALaPose`,
 * src/gcv2-l1.js du patch flanc-source.patch, sur le cache de rails : mêmes bandes, même médiane basse (`floor`), même point fixe).
 * Premier pas : bande de la convention ; sous 6 points, bande large de `maxMm`. Si ce premier pas vaut au moins `seuilMm`, le flanc est suivi en
 * point fixe (6 tours au plus) ; le rail prend sa place si elle reste du même côté, entre `seuilMm` et `maxMm`. Flanc propre : la pose est gardée
 * si plus du tiers des points lus l'appuient ; la place suivie n'est prise que si au moins le tiers de ses points l'appuient.
 * Rend null (rien à lire) ou { n, depart, premier, du (mm vers le champignon, ou null : pose gardée), motif }. */
function flancSuivi(pts, gab, pose0, { seuilMm = 5, maxMm = 20, tours = 6, minFlanc = 6, decalMm = -2.6, origines = [0], xMax = 0.25 } = {}) {
  const qb = v => { const s = v.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(0.5 * s.length))]; };
  const lire = (pose, bandeMm) => bandes(pts, gab, pose, { origines, xMax, ...(bandeMm ? { bandeMm } : {}) }).face.map(x => x.r);
  let f = lire(pose0, null), depart = 'bande';
  if (f.length < minFlanc) { depart = 'large'; if (maxMm > 12) f = lire(pose0, maxMm); if (f.length < minFlanc) return { n: f.length, depart, premier: null, du: null, motif: 'flanc-peu-observe' }; }
  /* flanc propre : part des points à ±3 mm de l'écart que la convention attend (−decalMm) ; plus du tiers : la pose a son flanc, elle est gardée */
  const appui = v => v.filter(x => Math.abs(x + decalMm) <= 3).length / v.length;
  const pas0 = qb(f) + decalMm, out = { n: f.length, depart, premier: pas0, appui: appui(f), du: null };
  if (!(Math.abs(pas0) >= seuilMm)) return out;
  if (appui(f) > 1 / 3) return { ...out, motif: 'pose-appuyee' };
  let pose = [pose0[0] + pas0 / 1000, pose0[1]], pas = Infinity, fixe = false;
  for (let k = 1; k <= tours; k++) {
    f = lire(pose, null); if (f.length < minFlanc) return { ...out, motif: 'flanc-perdu' };
    pas = qb(f) + decalMm; if (Math.abs(pas) < 0.05) { fixe = true; break; } if (k === tours) break;
    pose = [pose[0] + pas / 1000, pose[1]];
  }
  if (!fixe && !(Math.abs(pas) < 0.5)) return { ...out, motif: 'sans-point-fixe' };
  const du = (pose[0] - pose0[0]) * 1000;
  if (Math.sign(du) !== Math.sign(pas0) || Math.abs(du) < seuilMm) return { ...out, suivi: du, motif: 'sous-seuil' };
  if (Math.abs(du) > maxMm) return { ...out, suivi: du, motif: 'hors-borne' };
  if (appui(f) < 1 / 3) return { ...out, suivi: du, motif: 'flanc-diffus' };
  return { ...out, du };
}
module.exports.flancSuivi = flancSuivi;
