'use strict';
/* CH-119 : prototype hors ligne du choix de voie global sur la zone (lecture du rejeu « pool »). Rien n'est commandé ; sert à concevoir. */
const Z = require('./zones.cjs');
const SIDES = Z.SIDES;
const fini = v => typeof v === 'number' && Number.isFinite(v);
/* Paires permises d'un pool (comme `meilleurePaire`), triées par produit des probabilités ; au plus `k`. */
function paires(pool, k = 20) {
  const out = [], L = pool.rails.left, R = pool.rails.right;
  L.forEach((hl, i) => R.forEach((hr, j) => {
    const g = fini(pool.G0) && fini(hl.g) && fini(hr.g) ? pool.G0 + (hl.g - pool.G0) + (hr.g - pool.G0) : null;
    const ok = (fini(g) && ((fini(pool.gMed) && Math.abs(g - pool.gMed) <= 15) || (g >= 1420 && g <= 1470))) || (i === pool.i0.left && j === pool.i0.right);
    if (ok) out.push({ i, j, p: (hl.p ?? 0) * (hr.p ?? 0), d: { left: hl.d, right: hr.d } });
  }));
  out.sort((a, b) => b.p - a.p);
  /* doublons à 3 mm */
  const u = [];
  for (const x of out) if (!u.some(y => SIDES.every(s => Z.d3(y.d[s], x.d[s]) < 3))) u.push(x);
  return u.slice(0, k);
}
/* Observations d'un cut source lues dans le repère du cut cible : [{ x, y:{left,right}, z:{left,right}, w, nature }] */
function observations(cible, src, R) {
  const obs = [], lire = (d, w, nature, p) => {
    const q = {}; for (const s of SIDES) { q[s] = Z.enRepere(cible, src, s, d[s]); if (!q[s]) return; }
    obs.push({ cut: src.cut, x: (q.left[0] + q.right[0]) / 2000, y: { left: q.left[1], right: q.right[1] }, z: { left: q.left[2], right: q.right[2] }, w, nature, p, d });
  };
  if (src.decal) lire(src.decal, R.wPose, 'pose', null);
  if (src.pool && R.pool) for (const pr of paires(src.pool, R.k)) if (pr.p >= R.pMin) lire(pr.d, R.wPool0 + R.wPoolP * pr.p, 'pool', pr.p);
  return obs;
}
/* Ajustement d'une voie : yL = aL + b x + c x², yR = aR + b x + c x² ; zs = ds + e x (moindres carrés pondérés). */
function ajuster(pts, quad) {
  // inconnues : aL, aR, b, c (latéral) ; dL, dR, e (vertical)
  const nL = quad ? 4 : 3;
  const A = Array.from({ length: nL }, () => new Float64Array(nL)), B = new Float64Array(nL);
  const Av = Array.from({ length: 3 }, () => new Float64Array(3)), Bv = new Float64Array(3);
  for (const o of pts) for (const s of SIDES) {
    const row = [s === 'left' ? 1 : 0, s === 'right' ? 1 : 0, o.x]; if (quad) row.push(o.x * o.x);
    for (let i = 0; i < nL; i++) { B[i] += row[i] * o.y[s]; for (let j = 0; j < nL; j++) A[i][j] += row[i] * row[j]; }
    const rv = [s === 'left' ? 1 : 0, s === 'right' ? 1 : 0, o.x];
    for (let i = 0; i < 3; i++) { Bv[i] += rv[i] * o.z[s]; for (let j = 0; j < 3; j++) Av[i][j] += rv[i] * rv[j]; }
  }
  const sol = resoudre(A, B), solv = resoudre(Av, Bv);
  if (!sol) return null;
  const c = quad ? sol[3] : 0;
  return { aL: sol[0], aR: sol[1], b: sol[2], c, dL: solv ? solv[0] : null, dR: solv ? solv[1] : null, e: solv ? solv[2] : 0,
    y: (s, x) => (s === 'left' ? sol[0] : sol[1]) + sol[2] * x + c * x * x, z: (s, x) => solv ? (s === 'left' ? solv[0] : solv[1]) + solv[2] * x : null };
}
function resoudre(A, B) {
  const n = B.length, M = A.map((r, i) => [...r, B[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    if (Math.abs(M[p][i]) < 1e-9) return null; [M[i], M[p]] = [M[p], M[i]];
    for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
const ecartObs = (v, o) => Math.max(...SIDES.map(s => Math.abs(v.y(s, o.x) - o.y[s]))), ecartVert = (v, o) => Math.max(...SIDES.map(s => Math.abs(v.z(s, o.x) - o.z[s])));
/* Score d'une voie : par cut, la meilleure observation à `tol` (latéral) et `tolV` (vertical) ; sinon 0. */
function score(v, parCut, R) {
  let S = 0; const choix = new Map();
  for (const [cut, obs] of parCut) {
    let best = null;
    for (const o of obs) if (ecartObs(v, o) <= R.tol && ecartVert(v, o) <= R.tolV && (!best || o.w > best.w)) best = o;
    if (best) { S += best.w; choix.set(cut, best); }
  }
  return { S, choix };
}
/* Voies candidates : graines (observations de poids ≥ wGraine) prises 2 à 2 (droite) et 3 à 3 (courbe) sur des cuts distincts ; raffinement par les inliers. */
function voies(parCut, R) {
  const graines = []; for (const obs of parCut.values()) for (const o of obs) if (o.w >= R.wGraine) graines.push(o);
  const cand = [], vus = new Set();
  const ajoute = pts => {
    const quad = new Set(pts.map(p => p.cut)).size >= 3 && (Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x))) >= R.empanQuad;
    let v = ajuster(pts, quad); if (!v) return;
    for (let it = 0; it < 2; it++) { const sc = score(v, parCut, R); const inl = [...sc.choix.values()]; if (inl.length < 2) break; const v2 = ajuster(inl, new Set(inl.map(p => p.cut)).size >= 3 && (Math.max(...inl.map(p => p.x)) - Math.min(...inl.map(p => p.x))) >= R.empanQuad); if (!v2) break; v = v2; }
    if (Math.abs(v.c) > R.cMax) return;
    const k = Math.round(v.y('left', 0) / 5) + ',' + Math.round(v.y('right', 0) / 5) + ',' + Math.round(v.b * 10);
    if (vus.has(k)) return; vus.add(k);
    const sc = score(v, parCut, R); cand.push({ v, S: sc.S, choix: sc.choix });
  };
  for (let i = 0; i < graines.length; i++) for (let j = i + 1; j < graines.length; j++) {
    if (graines[i].cut === graines[j].cut) continue;
    ajoute([graines[i], graines[j]]);
  }
  cand.sort((a, b) => b.S - a.S);
  return cand;
}
module.exports = { paires, observations, ajuster, score, voies, ecartObs };
