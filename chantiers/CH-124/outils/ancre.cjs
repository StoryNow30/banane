#!/usr/bin/env node
'use strict';
/* CH-124 : L'ANCRE DE TRAJECTOIRE (mesure hors ligne, lecture seule ; rien n'est commandé dans ESV ; aucun fichier de l'extension touché).
 *
 * Ce que le module calcule, avec la seule LISTE D'ESV de la partie (bords des deux rails de chaque coupe, statut, drapeaux) :
 *  1. la FORME DE LA TRAJECTOIRE du véhicule de mesure : chaque coupe est un plan perpendiculaire à la trajectoire ; le travers de la trajectoire se
 *     chemine de plan en plan (trajectoire.cjs : fermeture à 0,3 mm en médiane entre poses par défaut d'ESV, jusqu'à 200 m) ;
 *  2. l'AXE DE LA VOIE sous le véhicule, par un modèle cinématique à trois paramètres : deux pivots (bogies ou essieux) sur l'axe de la voie,
 *     distants de w, et le point de référence de la trajectoire en porte-à-faux de a au-delà du pivot proche, du côté `sens` (±1, sens des numéros
 *     de cut). Équation (petits angles), s0 = abscisse du point de référence, τ_s0(d) = écart en travers de la trajectoire en s0+d à sa tangente en s0,
 *     o(s) = écart de l'axe de la voie à la trajectoire :   o(s0 + sens·a) = g·[τ_s0(sens·(a+w)) + o(s0 + sens·(a+w))] − τ_s0(sens·a),  g = a/(a+w) ;
 *  3. la constante en travers (montage, origine du cheminement), calée LOCALEMENT sur les lignes de voie courante intactes de la liste (extraction
 *     d'ESV valide, jamais vue ni traitée, écartement plausible) : médiane du résidu dans une fenêtre de cuts.
 * Aucune pose d'Ariane, aucune pose humaine, aucun Écho n'entre dans le calcul de l'axe. Les paramètres (a, w, sens) sont ajustés par partie sur
 * ces mêmes lignes de voie courante (connues au départ de la partie).
 *
 *   node chantiers/CH-124/outils/ancre.cjs ajuster [--lots …]                : paramètres et résidus par partie (voie courante)
 *   node chantiers/CH-124/outils/ancre.cjs juger   [--lots …] [--fin] [--a A --w W] [--csv F] [--md F] : pour chaque cut jugé du corpus, écart de la pose finale de l'opérateur,
 *        de la pose du lot et de la pose de départ d'ESV à l'axe prédit (milieu des deux rails, travers, mm) ; tableaux par classe et par zone.
 *        Par défaut la liste est celle du DÉPART du lot, reconstituée (`listeDeDepart`) ; `--fin` : la liste de fin de lot telle qu'exportée.
 *        `--a`, `--w` : paramètres imposés (le sens reste ajusté par lot-partie).
 * Sorties : numéros de cut, millimètres. Aucune coordonnée, aucun identifiant. */
const fs = require('node:fs'), path = require('node:path');
const Lb = require('./lib.cjs'), T = require('./trajectoire.cjs');
const PAS = 0.25;                                   /* grille fine le long de la trajectoire (m) */
const PLEIN = { ecartMin: 1428, ecartMax: 1446 };    /* ligne de voie courante intacte : statut valide, aucun drapeau, écartement dans ces bornes (mm) */
const FENETRE = [200, 400, 800, 1600], MIN_LIGNES = 30; /* calage local de la constante : demi-fenêtres (cuts) essayées, lignes minimales */
const GRILLE = { a: [0.5, 14, 0.5], w: [2, 22, 0.5] };

/* Série d'une liste : pour chaque ligne présente, abscisse cheminée s (m), cap θ (rad, déroulé), travers o0 (mm) du milieu de la ligne par rapport
 * à la trajectoire cheminée depuis la première ligne (constante arbitraire). */
function serie(rows) {
  const idx = []; for (let i = 0; i < rows.length; i++) if (rows[i]) idx.push(i);
  const n = idx.length, s = new Float64Array(n), th = new Float64Array(n), o0 = new Float64Array(n), pos = new Int32Array(rows.length).fill(-1);
  let l = 0, cap = rows[idx[0]].cap; pos[idx[0]] = 0; th[0] = cap;
  for (let k = 1; k < n; k++) {
    const p = rows[idx[k - 1]], q = rows[idx[k]]; pos[idx[k]] = k;
    const Tp = [p.M[0] + l * p.ey[0], p.M[1] + l * p.ey[1]];
    let t = [p.n[0] + q.n[0], p.n[1] + q.n[1]]; const nt = Math.hypot(t[0], t[1]); t = [t[0] / nt, t[1] / nt];
    const lam = ((q.M[0] - Tp[0]) * q.n[0] + (q.M[1] - Tp[1]) * q.n[1]) / (t[0] * q.n[0] + t[1] * q.n[1]);
    const T2 = [Tp[0] + lam * t[0], Tp[1] + lam * t[1]];
    l = (T2[0] - q.M[0]) * q.ey[0] + (T2[1] - q.M[1]) * q.ey[1];
    s[k] = s[k - 1] + lam; let d = q.cap - cap; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; th[k] = th[k - 1] + d; cap = q.cap; o0[k] = -1000 * l;
  }
  const plein = new Uint8Array(n);
  for (let k = 0; k < n; k++) { const r = rows[idx[k]]; plein[k] = r.st === 0 && r.fl === 0 && r.ecartMm > PLEIN.ecartMin && r.ecartMm < PLEIN.ecartMax ? 1 : 0; }
  return { rows, idx, pos, n, s, th, o0, plein };
}
/* Grille fine : cap interpolé et sa primitive. */
function grille(S) {
  const s0 = S.s[0], s1 = S.s[S.n - 1], m = Math.floor((s1 - s0) / PAS) + 1, th = new Float64Array(m), I = new Float64Array(m);
  let k = 0;
  for (let j = 0; j < m; j++) { const x = s0 + j * PAS; while (k < S.n - 2 && S.s[k + 1] < x) k++; const u = (x - S.s[k]) / (S.s[k + 1] - S.s[k] || 1); th[j] = S.th[k] + u * (S.th[k + 1] - S.th[k]); }
  for (let j = 1; j < m; j++) I[j] = I[j - 1] + (th[j] + th[j - 1]) / 2 * PAS;
  return { s0, m, th, I };
}
/* Écart prédit de l'axe de la voie à la trajectoire (m), constante nulle, sur la grille fine. */
function predire(G, a, w, sens) {
  const g = a / (a + w), na = Math.round(a / PAS), nw = Math.round(w / PAS), m = G.m, o = new Float64Array(m), th = G.th, I = G.I;
  const tau = (i0, j) => (I[j] - I[i0]) - th[i0] * (j - i0) * PAS;
  if (sens > 0) { for (let i1 = m - 1; i1 >= 0; i1--) { const i0 = i1 - na, iA = i1 + nw; o[i1] = i0 < 0 || iA >= m ? 0 : g * (tau(i0, iA) + o[iA]) - tau(i0, i1); } }
  else { for (let i1 = 0; i1 < m; i1++) { const i0 = i1 + na, iA = i1 - nw; o[i1] = i0 >= m || iA < 0 ? 0 : g * (tau(i0, iA) + o[iA]) - tau(i0, i1); } }
  return o;
}
/* Prédiction aux lignes (mm, constante nulle). */
function auxLignes(S, G, o) { const out = new Float64Array(S.n); for (let k = 0; k < S.n; k++) { const x = (S.s[k] - G.s0) / PAS, j = Math.min(G.m - 2, Math.max(0, Math.floor(x))), u = x - j; out[k] = 1000 * (o[j] + u * (o[j + 1] - o[j])); } return out; }
/* Constante locale : médiane du résidu (o0 − prédit) des lignes de voie courante dans une demi-fenêtre de cuts autour de la position k. */
function constanteLocale(S, res, k) {
  for (const W of FENETRE) { const v = []; for (let j = Math.max(0, k - W); j <= Math.min(S.n - 1, k + W); j++) if (S.plein[j]) v.push(res[j]); if (v.length >= MIN_LIGNES) return { c: Lb.med(v), n: v.length, fenetre: W }; }
  return null;
}
/* Coût d'un jeu de paramètres : moyenne de min(|résidu recentré localement|, 40 mm) sur les lignes de voie courante (recentrage par blocs de 400 cuts). */
function cout(S, G, a, w, sens) {
  const p = auxLignes(S, G, predire(G, a, w, sens)); let somme = 0, nb = 0;
  for (let b = 0; b < S.n; b += 400) { const v = []; for (let k = b; k < Math.min(S.n, b + 400); k++) if (S.plein[k]) v.push(S.o0[k] - p[k]); if (v.length < 10) continue; const c = Lb.med(v); for (const x of v) { somme += Math.min(Math.abs(x - c), 40); nb++; } }
  return nb ? somme / nb : Infinity;
}
function ajuster(S, G = grille(S)) {
  let best = null;
  for (const sens of [1, -1]) for (let a = GRILLE.a[0]; a <= GRILLE.a[1] + 1e-9; a += GRILLE.a[2]) for (let w = GRILLE.w[0]; w <= GRILLE.w[1] + 1e-9; w += GRILLE.w[2]) {
    const c = cout(S, G, a, w, sens); if (!best || c < best.cout) best = { cout: c, a, w, sens };
  }
  return best;
}
/* Modèle complet d'une liste : série, paramètres, prédiction aux lignes, résidus. `params` impose (a, w, sens) au lieu de l'ajustement. */
function modele(rows, params = null) {
  const S = serie(rows), G = grille(S), P = params || ajuster(S, G), p = auxLignes(S, G, predire(G, P.a, P.w, P.sens)), res = new Float64Array(S.n);
  for (let k = 0; k < S.n; k++) res[k] = S.o0[k] - p[k];
  /* Axe prédit de la voie, en travers, par rapport au MILIEU DE LA LIGNE du cut (mm, vers la gauche) ; null sans calage local. */
  const axe = cut => { const k = S.pos[cut]; if (k == null || k < 0) return null; const c = constanteLocale(S, res, k); return c ? { mm: -(res[k] - c.c), lignes: c.n, fenetre: c.fenetre } : null; };
  return { S, G, P, p, res, axe };
}
/* Calage scène relative → monde d'un lot : médiane de (bord gauche de la liste − rail gauche de départ de la capture) sur les lignes non validées. */
function calage(rows, caps) {
  const d = [[], [], []];
  for (const [cut, c] of caps) { const r = rows[cut]; if (!r || r.fl === 3 || (r.fl & 1)) continue; for (let i = 0; i < 3; i++) d[i].push(r.L[i] - c.rails.left.positionSceneRelative[i]); }
  if (d[0].length < 1) return null;
  const t = d.map(v => Lb.med(v)); let ok = 0; for (let j = 0; j < d[0].length; j++) if (Math.hypot(d[0][j] - t[0], d[1][j] - t[1], d[2][j] - t[2]) < 5e-4) ok++;
  return { t, n: d[0].length, ok };
}
/* Liste du DÉPART du lot, reconstituée : les lignes des cuts du lot reprennent la pose de départ d'ESV lue dans la capture (rails de départ + calage),
 * sans drapeau, statut valide (le statut d'origine n'est pas connu : choix prudent, la ligne entre alors dans la voie courante si son écartement
 * est plausible, même si elle vise l'autre voie). C'est l'état que le service worker lit une fois par lot (`l1eTable`). */
function listeDeDepart(rows, caps, cal, invalide = false) {
  const out = rows.slice();
  for (const [cut, c] of caps) {
    const r = rows[cut]; if (!r) continue;
    const Lp = c.rails.left.positionSceneRelative.map((v, i) => v + cal.t[i]), Rp = c.rails.right.positionSceneRelative.map((v, i) => v + cal.t[i]);
    const dx = Lp[0] - Rp[0], dy = Lp[1] - Rp[1], g = Math.hypot(dx, dy); if (!(g > 0.5)) continue;
    const ey = [dx / g, dy / g], n = [ey[1], -ey[0]], ecartMm = 1000 * Math.hypot(dx, dy, Lp[2] - Rp[2]);
    /* `invalide` (14/11) : un cut du lot était INVALIDE au départ (le lot traite les invalides) : statut 1, hors de la voie courante, comme le service worker le voit. */
    out[cut] = { i: cut, st: invalide ? 1 : (r.fl & 1) ? 0 : r.st, fl: (r.fl & 1) ? 0 : r.fl, L: Lp, R: Rp, M: [(Lp[0] + Rp[0]) / 2, (Lp[1] + Rp[1]) / 2, (Lp[2] + Rp[2]) / 2], ey, n, ecartMm, cap: Math.atan2(n[1], n[0]),
      defaut: Math.abs(ecartMm - T.DEFAUT_MM) <= T.TOL_DEFAUT_MM };
  }
  return out;
}
const centre = p => p ? (p.left[1] + p.right[1]) / 2 : null;
/* Mesure sur le corpus. `o.fin` : liste de fin de lot telle qu'exportée (sinon liste du départ du lot reconstituée) ; `o.params` : (a, w) imposés, sens ajusté. */
function mesurer(o) {
  const co = Lb.corpus(), out = [], params = [];
  for (const e of Lb.entrees(o.lots)) {
    const k = Lb.cle(e), m = Lb.meta(k), C = co.get(k); if (!C || !m.liste) continue;
    const rowsFin = T.lignes(m.liste), caps = Lb.captures(k), cal = calage(rowsFin, caps); if (!cal) { params.push({ cle: k, calage: 'aucun' }); continue; }
    const rows = o.fin ? rowsFin : listeDeDepart(rowsFin, caps, cal, o.departInvalide === true);
    let P = null;
    if (o.params) { const S0 = serie(rows), G0 = grille(S0); P = [1, -1].map(sens => ({ a: o.params.a, w: o.params.w, sens, cout: cout(S0, G0, o.params.a, o.params.w, sens) })).sort((x, y) => x.cout - y.cout)[0]; }
    const Mo = modele(rows, P);
    params.push({ cle: k, ...Mo.P, calage: `${cal.ok}/${cal.n}` });
    for (const [cut, c] of C) {
      const cap = caps.get(cut), r = rows[cut]; if (!cap || !r) continue;
      const rep = Lb.repere(cap), ax = Mo.axe(cut); if (!ax) continue;
      /* milieu de la ligne dans le repère coupe (travers) : nul pour une liste du départ, non nul si la ligne a été réécrite */
      const Ow = rep.O.map((v, i) => v + cal.t[i]), yM = 1000 * ((r.M[0] - Ow[0]) * rep.Y[0] + (r.M[1] - Ow[1]) * rep.Y[1]);
      const yAxe = yM + ax.mm, fin = Lb.poseCoupe(cap, c.poseFinale, rep), lot = Lb.poseCoupe(cap, c.poseAriane, rep);
      out.push({ lot: c.lot, partie: c.partie, rang: c.rang, cut, zone: c.zone, classe: c.classe, exclu: c.exclu || '', sortLot: c.sortLot, etage: c.chemin.etage,
        ecartDepart: c.ecartementDepartMm, defaut: Math.abs(c.ecartementDepartMm - T.DEFAUT_MM) <= 0.06 ? 1 : 0,
        axe: +yAxe.toFixed(1), finale: fin ? +(centre(fin) - yAxe).toFixed(1) : null, lotPose: lot ? +(centre(lot) - yAxe).toFixed(1) : null, depart: +(0 - yAxe).toFixed(1),
        ecartLot: c.ecart ? c.ecart.pire3d : null, lignes: ax.lignes, fenetre: ax.fenetre });
    }
  }
  return { out, params };
}
function args(a) { const o = { mode: a[0] }; for (let i = 1; i < a.length; i++) { const k = a[i]; if (k === '--lots') o.lots = a[++i].split(','); else if (k === '--depart-invalide') o.departInvalide = true; else if (k === '--csv') o.csv = a[++i]; else if (k === '--md') o.md = a[++i]; else if (k === '--fin') o.fin = true; else if (k === '--a') o.params = { ...(o.params || {}), a: Number(a[++i]) }; else if (k === '--w') o.params = { ...(o.params || {}), w: Number(a[++i]) }; else throw Error('option inconnue ' + k); } return o; }
const q = (v, p) => { const x = Lb.quantile(v, p); return x == null ? '-' : x.toFixed(1); };
function main() {
  const o = args(process.argv.slice(2));
  if (o.mode === 'ajuster') {
    const vus = new Set();
    process.stdout.write('| partie | lignes | voie courante | sens | a (m) | w (m) | a(a+w)/2 (m²) | coût | résidu médian |mm| | q95 | q99 |\n|---|---|---|---|---|---|---|---|---|---|---|\n');
    for (const e of Lb.entrees(o.lots)) { const m = Lb.meta(Lb.cle(e)); if (!m.liste || vus.has(m.liste)) continue; vus.add(m.liste);
      const Mo = modele(T.lignes(m.liste)), v = []; for (let k = 0; k < Mo.S.n; k++) if (Mo.S.plein[k]) { const c = constanteLocale(Mo.S, Mo.res, k); if (c) v.push(Math.abs(Mo.res[k] - c.c)); }
      process.stdout.write(`| ${Lb.cle(e).replace(/-r\d+$/, '')} | ${Mo.S.n} | ${v.length} | ${Mo.P.sens > 0 ? '+' : '−'} | ${Mo.P.a} | ${Mo.P.w} | ${(Mo.P.a * (Mo.P.a + Mo.P.w) / 2).toFixed(1)} | ${Mo.P.cout.toFixed(2)} | ${q(v, 0.5)} | ${q(v, 0.95)} | ${q(v, 0.99)} |\n`); }
    return;
  }
  if (o.mode === 'juger') {
    const { out, params } = mesurer(o), L = [];
    L.push('Paramètres par lot-partie : ' + params.map(p => `${p.cle} sens ${p.sens > 0 ? '+' : '−'} a ${p.a} w ${p.w} calage ${p.calage}`).join(' ; '), '');
    const juges = out.filter(r => r.finale != null && !r.exclu);
    const tab = (titre, lignes, champ) => { const v = lignes.map(r => Math.abs(r[champ])).filter(Number.isFinite); return `| ${titre} | ${v.length} | ${q(v, 0.5)} | ${q(v, 0.9)} | ${q(v, 0.99)} | ${v.length ? Math.max(...v).toFixed(1) : '-'} | ${v.filter(x => x > 40).length} | ${v.filter(x => x > 60).length} |`; };
    L.push('### Écart en travers du milieu de la POSE FINALE de l\'opérateur à l\'axe prédit (|mm|)', '| groupe | n | médiane | q90 | q99 | max | > 40 | > 60 |', '|---|---|---|---|---|---|---|---|');
    for (const z of ['adv', 'abords', 'pn']) for (const cl of ['juste', '10-50', 'mauvaise-voie', 'differe-corrige', 'differe-juste']) { const g = juges.filter(r => r.zone === z && r.classe === cl); if (g.length) L.push(tab(`${z} ${cl}`, g, 'finale')); }
    L.push(tab('tous jugés', juges, 'finale'), '');
    const mv = juges.filter(r => r.classe === 'mauvaise-voie');
    L.push('### Les mauvaises voies du lot réel : écart du milieu à l\'axe prédit (mm, signé, vers la gauche)', '| lot | cut | étage | pose finale | pose du lot | départ ESV | désignation |', '|---|---|---|---|---|---|---|');
    let bon = 0, mauvais = 0;
    for (const r of mv) { const d = Math.abs(r.finale) < Math.abs(r.lotPose) ? 'bonne' : 'mauvaise'; if (d === 'bonne') bon++; else mauvais++; L.push(`| ${r.lot} | ${r.partie}/${r.cut} | ${r.etage} | ${r.finale} | ${r.lotPose} | ${r.depart} | ${d} |`); }
    L.push('', `Désignation (la pose finale est plus près de l'axe prédit que la pose du lot) : bonne ${bon}, mauvaise ${mauvais}, sur ${mv.length} (muet : ${30 - mv.length}).`, '');
    L.push('### Écart du milieu de la POSE DU LOT à l\'axe prédit, cuts posés jugés (|mm|)', '| groupe | n | médiane | q90 | q99 | max | > 40 | > 60 |', '|---|---|---|---|---|---|---|---|');
    for (const cl of ['juste', '10-50', 'mauvaise-voie']) { const g = juges.filter(r => r.sortLot === 'pose' && r.classe === cl); L.push(tab(cl, g, 'lotPose')); }
    const txt = L.join('\n') + '\n'; process.stdout.write(txt); if (o.md) fs.writeFileSync(o.md, txt);
    if (o.csv) fs.writeFileSync(o.csv, ['lot;partie;rang;cut;zone;classe;exclu;sortLot;etage;ecartDepartMm;defaut;axeMm;finaleMm;lotMm;departMm;ecartLotMm;lignes;fenetre', ...out.map(r => [r.lot, r.partie, r.rang, r.cut, r.zone, r.classe, r.exclu, r.sortLot, r.etage, r.ecartDepart, r.defaut, r.axe, r.finale ?? '', r.lotPose ?? '', r.depart, r.ecartLot ?? '', r.lignes, r.fenetre].join(';'))].join('\n') + '\n');
    return;
  }
  throw Error('mode : ajuster | juger');
}
module.exports = { serie, grille, predire, auxLignes, constanteLocale, cout, ajuster, modele, calage, listeDeDepart, mesurer, PAS, PLEIN, FENETRE, GRILLE };
if (require.main === module) { try { main(); } catch (e) { process.stderr.write('ancre : ' + (e.stack || e.message) + '\n'); process.exitCode = 1; } }
