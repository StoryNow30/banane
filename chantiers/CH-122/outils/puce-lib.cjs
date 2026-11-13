'use strict';
/* CH-122 : outils d'apprentissage de la puce (hors ligne, sans dépendance). Régression logistique L2 (Newton), normalisation, jeu par cut.
 * Aucune donnée au dépôt : les rejeux et le corpus vivent dans CH116_TRAVAIL. */
const fs = require('node:fs'), path = require('node:path');
const SIDES = ['left', 'right'];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pire = (p, q) => Math.max(dist(p.left, q.left), dist(p.right, q.right));
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));

/* Jeu : une entrée par cut passé à la GCV2 dans le rejeu (candidats et traits), avec la vérité du corpus si elle existe.
 * `jugeable` = vérité utilisable pour le jugement du banc (pose finale, pas d'exclusion) ; `apprenable` = idem (D-285 exclus aussi de l'apprentissage). */
function jeu(dossierRejeu, corpus, lotsCles) {
  const C = new Map(); for (const l of lireJsonl(corpus)) C.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
  const out = [];
  for (const k of lotsCles) {
    const f = path.join(dossierRejeu, k + '.jsonl'); if (!fs.existsSync(f)) continue;
    for (const l of lireJsonl(f)) {
      if (l.type !== 'cut') continue; const o = l.profils && l.profils['L1-se']; if (!o) continue;
      /* cut passé à la GCV2 (`l1`) ou pose de la chaîne contre-expertisée (`ombre`, contexte chaîne) */
      const src = o.l1 && o.l1.puce && o.l1.puce.candidats ? o.l1 : o.ombre && o.ombre.puce && o.ombre.puce.candidats ? o.ombre : null; if (!src) continue;
      const c = C.get(`${k}:${l.cut}`), verite = c && c.poseFinale && !c.exclu ? c.poseFinale : null;
      const cands = src.puce.candidats.map(x => ({ decal: x.d, t: x.t, mm: verite ? pire(x.d, verite) : null }));
      out.push({ cle: k, lot: k.split('-')[0], cut: l.cut, zone: l.zone, etatLivre: o.etat, decalLivre: o.decal || null, verite, mmLivre: verite && o.etat === 'pose' && o.decal ? pire(o.decal, verite) : null,
        traits: src.puce.traits, contexte: src === o.ombre ? 'chaine' : 'gcv2', cands });
    }
  }
  return out;
}
function normaliser(X) {
  const p = X[0].length, moy = new Array(p).fill(0), sd = new Array(p).fill(0);
  for (const x of X) for (let j = 0; j < p; j++) moy[j] += x[j] / X.length;
  for (const x of X) for (let j = 0; j < p; j++) sd[j] += (x[j] - moy[j]) ** 2 / X.length;
  for (let j = 0; j < p; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  return { moy, sd };
}
const zst = (N, x) => x.map((v, j) => Math.max(-6, Math.min(6, (v - N.moy[j]) / N.sd[j])));
function resoudre(A, b) { /* Gauss avec pivot partiel */
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let m = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[m][c])) m = r; [M[c], M[m]] = [M[m], M[c]];
    const d = M[c][c] || 1e-12; for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}
/* Logistique L2 (intercept non pénalisé), poids par ligne `w`. Rend { coef, intercept }. */
function logistique(Z, y, lambda, w = null, iters = 30) {
  const n = Z.length, p = Z[0].length; let beta = new Array(p + 1).fill(0);
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0)), g = new Array(p + 1).fill(0);
    for (let i = 0; i < n; i++) {
      const x = Z[i]; let z = beta[p]; for (let j = 0; j < p; j++) z += beta[j] * x[j];
      const mu = 1 / (1 + Math.exp(-z)), wi = (w ? w[i] : 1), r = wi * (y[i] - mu), v = wi * Math.max(mu * (1 - mu), 1e-9);
      for (let j = 0; j < p; j++) { g[j] += r * x[j]; const vx = v * x[j]; for (let k = 0; k <= j; k++) H[j][k] += vx * x[k]; H[p][j] += vx; }
      g[p] += r; H[p][p] += v;
    }
    for (let j = 0; j < p; j++) { g[j] -= lambda * beta[j]; H[j][j] += lambda; }
    for (let j = 0; j <= p; j++) for (let k = 0; k < j; k++) H[k][j] = H[j][k];
    const step = resoudre(H, g); let m = 0; beta = beta.map((b, j) => { m = Math.max(m, Math.abs(step[j])); return b + step[j]; });
    if (m < 1e-7) break;
  }
  return { coef: beta.slice(0, p), intercept: beta[p] };
}
const predire = (mod, z) => { let s = mod.intercept; for (let j = 0; j < z.length; j++) s += mod.coef[j] * z[j]; return 1 / (1 + Math.exp(-s)); };
module.exports = { SIDES, pire, lireJsonl, jeu, normaliser, zst, logistique, predire };

/* Arbres boostés peu profonds (perte logistique, Newton par feuille), sans dépendance, déterministes. X : lignes complètes (pas de valeur manquante).
 * Rend { type:'arbres', base, arbres:[ [noeud…] ] } ; noeud interne [j, seuil, gauche, droite], feuille [valeur] ; x[j] <= seuil → gauche. */
function arbres(X, y, w, { n = 150, prof = 3, pas = 0.1, lambda = 1, minH = 1, bins = 32 } = {}) {
  const N = X.length, p = X[0].length, W = w || new Array(N).fill(1);
  const seuils = [];
  for (let j = 0; j < p; j++) { const v = X.map(x => x[j]).sort((a, b) => a - b), s = new Set();
    for (let b = 1; b < bins; b++) { const q = v[Math.floor(b * (N - 1) / bins)]; s.add(q); }
    seuils.push([...s].sort((a, b) => a - b)); }
  const B = X.map(x => x.map((v, j) => { const S = seuils[j]; let lo = 0, hi = S.length; while (lo < hi) { const m = (lo + hi) >> 1; if (v <= S[m]) hi = m; else lo = m + 1; } return lo; }));
  const sw = W.reduce((a, b) => a + b, 0), py = y.reduce((a, b, i) => a + b * W[i], 0) / sw, base = Math.log(Math.max(py, 1e-6) / Math.max(1 - py, 1e-6));
  const F = new Float64Array(N).fill(base), out = [];
  for (let t = 0; t < n; t++) {
    const g = new Float64Array(N), h = new Float64Array(N);
    for (let i = 0; i < N; i++) { const mu = 1 / (1 + Math.exp(-F[i])); g[i] = W[i] * (y[i] - mu); h[i] = W[i] * Math.max(mu * (1 - mu), 1e-9); }
    const noeuds = [];
    const construire = (idx, d) => {
      let G = 0, H = 0; for (const i of idx) { G += g[i]; H += h[i]; }
      const k = noeuds.length; noeuds.push(null);
      let best = null;
      if (d < prof && idx.length > 4) {
        for (let j = 0; j < p; j++) {
          const nb = seuils[j].length + 1, Gb = new Float64Array(nb), Hb = new Float64Array(nb);
          for (const i of idx) { Gb[B[i][j]] += g[i]; Hb[B[i][j]] += h[i]; }
          let GL = 0, HL = 0;
          for (let b = 0; b < nb - 1; b++) { GL += Gb[b]; HL += Hb[b]; const GR = G - GL, HR = H - HL;
            if (HL < minH || HR < minH) continue;
            const gain = GL * GL / (HL + lambda) + GR * GR / (HR + lambda) - G * G / (H + lambda);
            if (gain > 1e-9 && (!best || gain > best.gain)) best = { gain, j, b }; }
        }
      }
      if (!best) { noeuds[k] = [pas * G / (H + lambda)]; return k; }
      const gauche = idx.filter(i => B[i][best.j] <= best.b), droite = idx.filter(i => B[i][best.j] > best.b);
      const l = construire(gauche, d + 1), r = construire(droite, d + 1);
      noeuds[k] = [best.j, seuils[best.j][best.b], l, r]; return k;
    };
    construire([...Array(N).keys()], 0);
    for (let i = 0; i < N; i++) F[i] += feuille(noeuds, X[i]);
    out.push(noeuds);
  }
  return { type: 'arbres', base, arbres: out };
}
function feuille(noeuds, x) { let k = 0; for (;;) { const nd = noeuds[k]; if (nd.length === 1) return nd[0]; k = x[nd[0]] <= nd[1] ? nd[2] : nd[3]; } }
function predireArbres(M, x) { let s = M.base; for (const a of M.arbres) s += feuille(a, x); return 1 / (1 + Math.exp(-s)); }
module.exports.arbres = arbres; module.exports.predireArbres = predireArbres;
