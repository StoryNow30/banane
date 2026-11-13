'use strict';
/* CH-125 : champ de distance au contour ENTIER du rail (champignon, âme, patin), pour ajuster le gabarit comme l'opérateur le fait : sur toute la
 * section vue par le capteur. Hors ligne ; fonctions pures ; aucune référence humaine.
 * Le contour du gabarit (polygone fermé, sens trigonométrique, [u, z] en mètres, u orienté vers le champignon, 0 au flanc côté voie) est découpé en
 * SURFACES : seules celles qu'un capteur placé au-dessus de la voie peut voir portent des points.
 *   1 dessus (table de roulement, hors congés) · 2 congé côté voie · 3 flanc côté voie · 4 congé côté champ · 5 flanc côté champ
 *   6 âme côté voie · 7 âme côté champ · 8 dessus du patin côté voie · 9 dessus du patin côté champ · 0 surfaces non vues (dessous du champignon,
 *   chant et dessous du patin) : un point dont le plus proche voisin du contour est là n'est pas lu.
 * Le champ est échantillonné au demi-millimètre : pour chaque cellule, distance signée au contour (mm, + hors de l'acier), normale sortante, surface. */
const PAS = 0.0005;
const SURFACES = Object.freeze({ dessus: 1, congeVoie: 2, flancVoie: 3, congeChamp: 4, flancChamp: 5, ameVoie: 6, ameChamp: 7, patinVoie: 8, patinChamp: 9 });

function classer(mu, mz, nu, nz, W) {
  /* milieu du segment (m), normale sortante */
  if (mz > -0.0045 && mu > 0.012 && mu < W - 0.012) return 1;
  if (mz > -0.0125 && mu <= 0.012) return 2;
  if (mz > -0.0125 && mu >= W - 0.012) return 4;
  if (mz <= -0.0125 && mz > -0.0375 && mu < 0.006 && nu < -0.7) return 3;
  if (mz <= -0.0125 && mz > -0.0375 && mu > W - 0.006 && nu > 0.7) return 5;
  if (mz < -0.050 && mz > -0.123 && nu < -0.9) return 6;
  if (mz < -0.050 && mz > -0.123 && nu > 0.9) return 7;
  if (mz < -0.1265 && mz > -0.1425 && nz > 0.6) return nu < 0 || mu < 0.032 ? 8 : 9;
  return 0;
}
/* Construit le champ à partir du contour (liste [u, z] en m, polygone fermé). */
function construire(contour, largeur) {
  const K = contour, n = K.length, seg = [];
  /* sens du polygone (aire signée) : positif = trigonométrique */
  let aire = 0; for (let i = 0; i < n; i++) { const a = K[i], b = K[(i + 1) % n]; aire += a[0] * b[1] - b[0] * a[1]; }
  const s = aire >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = K[i], b = K[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (!(L > 1e-9)) continue;
    const nu = s * dz / L, nz = -s * dx / L;
    seg.push({ ax: a[0], az: a[1], dx, dz, L2: L * L, nu, nz, cl: classer((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, nu, nz, largeur) });
  }
  const u0 = -0.062, u1 = 0.126, z0 = -0.172, z1 = 0.026, nu_ = Math.round((u1 - u0) / PAS) + 1, nz_ = Math.round((z1 - z0) / PAS) + 1;
  const D = new Float32Array(nu_ * nz_), NU = new Float32Array(nu_ * nz_), NZ = new Float32Array(nu_ * nz_), CL = new Uint8Array(nu_ * nz_);
  for (let j = 0; j < nz_; j++) for (let i = 0; i < nu_; i++) {
    const u = u0 + i * PAS, z = z0 + j * PAS; let best = Infinity, bs = null, bt = 0;
    for (const g of seg) { let t = ((u - g.ax) * g.dx + (z - g.az) * g.dz) / g.L2; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = g.ax + t * g.dx - u, pz = g.az + t * g.dz - z, d2 = px * px + pz * pz; if (d2 < best) { best = d2; bs = g; bt = t; } }
    const px = bs.ax + bt * bs.dx, pz = bs.az + bt * bs.dz, d = Math.sqrt(best), cote = (u - px) * bs.nu + (z - pz) * bs.nz >= 0 ? 1 : -1, k = j * nu_ + i;
    D[k] = cote * d * 1000; CL[k] = bs.cl;
    /* normale : celle du segment (surface lisse) ; au-delà d'un sommet, la direction du point au contour */
    if (d > 1e-6 && (bt === 0 || bt === 1)) { NU[k] = cote * (u - px) / d; NZ[k] = cote * (z - pz) / d; } else { NU[k] = bs.nu; NZ[k] = bs.nz; }
  }
  return { u0, z0, nu: nu_, nz: nz_, pas: PAS, D, NU, NZ, CL, largeur, lire(u, z) { const i = Math.round((u - u0) / PAS), j = Math.round((z - z0) / PAS); if (i < 0 || j < 0 || i >= nu_ || j >= nz_) return -1; return j * nu_ + i; } };
}
/* Résidus par surface à une pose : pour chaque point lu, distance signée au contour posé (mm), surface, abscisse. `portee` : demi-bande (mm). */
function residus(pts, champ, pose, { origines = [0], xMax = 0.25, a = 0, b = 0, porteeMm = 12 } = {}) {
  const O = new Set(origines), out = []; for (let s = 0; s < 10; s++) out.push([]);
  for (let i = 0; i < pts.length; i += 4) {
    if (!O.has(pts[i + 3])) continue; const x = pts[i]; if (Math.abs(x) > xMax) continue;
    const k = champ.lire(pts[i + 1] - pose[0] - a * x, pts[i + 2] - pose[1] - b * x); if (k < 0) continue;
    const cl = champ.CL[k], d = champ.D[k]; if (!cl || Math.abs(d) > porteeMm) continue;
    out[cl].push({ d, x, nu: champ.NU[k], nz: champ.NZ[k] });
  }
  return out;
}
/* Ajustement robuste du gabarit entier : translation [u, z] qui annule les résidus pondérés (Tukey, échelle `echelleMm`) des surfaces de `surfaces`
 * (poids par surface), Gauss-Newton depuis `pose0`, pas borné à 3 mm par tour. `decalages` : décalage de convention par surface (mm, + = le
 * contour posé hors des points), retiré du résidu : la pose rendue est alors directement celle de la convention. Rend la pose, la covariance
 * (mm², pour un bruit de `sigmaMm` par point), les effectifs par surface et le résidu médian par surface à la pose rendue. */
function ajuster(pts, champ, pose0, opt = {}) {
  const { origines = [0], xMax = 0.25, a = 0, b = 0, porteeMm = 12, echelleMm = 6, tours = 30, sigmaMm = 3, poids = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0, 7: 0, 8: 1, 9: 1 }, decalages = null, axes = 'uz' } = opt;
  const O = new Set(origines); let pose = pose0.slice(), cov = null, n = 0, k = 0, converge = false; const compte = new Array(10).fill(0);
  for (; k < tours; k++) {
    let Suu = 0, Suz = 0, Szz = 0, gu = 0, gz = 0; n = 0; compte.fill(0);
    for (let i = 0; i < pts.length; i += 4) {
      if (!O.has(pts[i + 3])) continue; const x = pts[i]; if (Math.abs(x) > xMax) continue;
      const c = champ.lire(pts[i + 1] - pose[0] - a * x, pts[i + 2] - pose[1] - b * x); if (c < 0) continue;
      const cl = champ.CL[c], w0 = poids[cl] || 0; if (!w0) continue;
      const d = champ.D[c] + (decalages ? decalages[cl] || 0 : 0); if (Math.abs(d) > porteeMm) continue;
      const t = d / echelleMm; if (Math.abs(t) >= 1) continue; const w = w0 * (1 - t * t) ** 2, nu = champ.NU[c], nz = champ.NZ[c];
      Suu += w * nu * nu; Suz += w * nu * nz; Szz += w * nz * nz; gu += w * nu * d; gz += w * nz * d; n++; compte[cl]++;
    }
    let du = 0, dz = 0;
    if (axes === 'z') { if (!(Szz > 1e-6)) { cov = null; break; } dz = gz / Szz; cov = [[Infinity, 0], [0, sigmaMm ** 2 / Szz]]; }
    else if (axes === 'u') { if (!(Suu > 1e-6)) { cov = null; break; } du = gu / Suu; cov = [[sigmaMm ** 2 / Suu, 0], [0, Infinity]]; }
    else { const det = Suu * Szz - Suz * Suz; if (!(n >= 8) || !(det > 1e-6)) { cov = null; break; }
      du = (Szz * gu - Suz * gz) / det; dz = (Suu * gz - Suz * gu) / det; cov = [[Szz / det * sigmaMm ** 2, -Suz / det * sigmaMm ** 2], [-Suz / det * sigmaMm ** 2, Suu / det * sigmaMm ** 2]]; }
    const borne = v => Math.max(-3, Math.min(3, v));
    pose = [pose[0] + borne(du) / 1000, pose[1] + borne(dz) / 1000];
    if (Math.abs(du) < 0.02 && Math.abs(dz) < 0.02) { converge = true; break; }
  }
  return { pose, cov, n, compte: compte.slice(), tours: k, converge, sigmaU: cov ? Math.sqrt(cov[0][0]) : null, sigmaZ: cov ? Math.sqrt(cov[1][1]) : null };
}
module.exports = { construire, residus, ajuster, SURFACES, PAS };
