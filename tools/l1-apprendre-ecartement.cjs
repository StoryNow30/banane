#!/usr/bin/env node
'use strict';
/*
 * l1-apprendre-ecartement.cjs — APPRENTISSAGE DE LA DÉCISION DES DIFFÉRÉS (L1-e) SUR TOUS LES ÉCHOS (fiches/L1_APPRENTISSAGE.md). Étude HORS LIGNE.
 *
 *   node tools/l1-apprendre-ecartement.cjs evaluer  --diag D.jsonl [--diag …] [--json R.json]     (validation croisée par partie + apprentissage complet)
 *   node tools/l1-apprendre-ecartement.cjs exporter --diag D.jsonl [--diag …] --date AAAA-MM-JJ --sortie datasets/gcv2-l1e-parametres.json
 *
 * Entrée : les cas des différés que la GCV2 examine, avec toutes leurs hypothèses (tools/l1-diag-hypotheses.cjs) et, pour les cas jugés, la pose
 * finale de l'opérateur. ESSAI ÉCARTÉ (fiches/L1_APPRENTISSAGE.md § 4) ; modèle : `tools/l1-apprendre-ecartement-modele.cjs` : candidats (paires d'hypothèses, et la même paire
 * ramenée à l'écartement de convention en déplaçant le rail le moins probable), traits, score logistique, seuil. Ici on APPREND :
 *   (l'écartement de convention n'est pas appris : 1 435 mm, règle métier « écartement », fiches/REGLES_METIER.md ; les Échos le confirment) ;
 *   - les coefficients du score (régression logistique L2, étiquette : paire à 10 mm au plus de l'opérateur, sur les deux rails) ;
 *   - le seuil τ : la plus grande couverture, sur les parties d'apprentissage (validation croisée interne par partie), telle que les poses
 *     validées aient au moins 90 % d'erreurs à 10 mm au plus et au plus 2 % d'erreurs de plus de 50 mm (la test 13 en fait 4,3 % sur les
 *     mêmes différés jugés).
 * Évaluation : chaque partie jugée est décidée par un modèle appris SANS elle (et sans aucun cas de sa partie) ; le modèle complet est rapporté à part
 * (« dans l'échantillon »). Sortie : des comptes, des millimètres, des numéros de partie ; aucune coordonnée.
 */
const fs = require('node:fs');
const E = require('./l1-apprendre-ecartement-modele.cjs');

const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const med = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const SIDES = ['left', 'right'];
const LAMBDA = 3, PRECISION = 0.9, MAUVAISES_MAX = 0.02, MAUVAISE_MM = 50, JUSTE_MM = 10;

function lireDiag(fichiers) {
  const out = [];
  for (const f of fichiers) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim()) out.push(JSON.parse(l));
  return out;
}
const erreur = (paire, mic) => Math.max(...SIDES.map(s => Math.hypot(...paire[s].map((v, i) => v - mic[s][i]))));
/* Écartement final de l'opérateur (même approximation linéaire que les candidats). */
const ecartementMic = c => fini(c.G0) ? E.ecartementDecal(c, c.micDecal) : null;

/* ------------------------------------------------------------------ régression logistique L2 (Newton, petites dimensions) */
function ajuster(X, y, lambda = LAMBDA, w0 = null) {
  const p = X[0].length, n = X.length;
  const mu = new Array(p).fill(0), sd = new Array(p).fill(1);
  for (let j = 0; j < p; j++) { let s = 0; for (const x of X) s += x[j]; mu[j] = s / n; let v = 0; for (const x of X) v += (x[j] - mu[j]) ** 2; sd[j] = Math.sqrt(v / n) || 1; }
  const Z = X.map(x => [1, ...x.map((v, j) => (v - mu[j]) / sd[j])]);
  const q = p + 1, w = new Array(q).fill(0);
  if (w0) for (let j = 0; j < q; j++) w[j] = w0[j];
  for (let it = 0; it < 60; it++) {
    const g = new Array(q).fill(0), H = Array.from({ length: q }, () => new Array(q).fill(0));
    for (let i = 0; i < n; i++) {
      let z = 0; for (let j = 0; j < q; j++) z += w[j] * Z[i][j];
      const pr = 1 / (1 + Math.exp(-z)), r = pr - y[i], h = pr * (1 - pr);
      for (let j = 0; j < q; j++) { g[j] += r * Z[i][j]; for (let k = 0; k <= j; k++) H[j][k] += h * Z[i][j] * Z[i][k]; }
    }
    for (let j = 1; j < q; j++) { g[j] += lambda * w[j]; H[j][j] += lambda; }
    for (let j = 0; j < q; j++) for (let k = j + 1; k < q; k++) H[j][k] = H[k][j];
    const d = resoudre(H, g);
    let pas = 0; for (let j = 0; j < q; j++) { w[j] -= d[j]; pas = Math.max(pas, Math.abs(d[j])); }
    if (pas < 1e-8) break;
  }
  /* Coefficients sur les traits bruts : z = b + Σ c_j x_j. */
  const coef = new Array(p).fill(0); let b = w[0];
  for (let j = 0; j < p; j++) { coef[j] = w[j + 1] / sd[j]; b -= w[j + 1] * mu[j] / sd[j]; }
  return { intercept: b, coefficients: coef };
}
function resoudre(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const v = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / v; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}

/* ------------------------------------------------------------------ apprentissage sur un ensemble de cas jugés */
function apprendre(cas, { lambda = LAMBDA, seuil = true } = {}) {
  const juges = cas.filter(c => c.juge);
  const reglage = { ...E.REGLAGE_DEFAUT };
  const X = [], y = [];
  for (const c of juges) { const sou = E.soutienDuDiagnostic(c), ctx = E.contexte(c, reglage);
    for (const k of E.candidats(c, reglage)) { const sup = E.soutienCandidat(k, sou); if (k.ramenee && !(sup[k.rail].dessus >= reglage.soutienDessus && sup[k.rail].flanc >= reglage.soutienFlanc)) continue;
      X.push(E.traits(c, k, reglage, sup, ctx)); y.push(erreur(k.paire, c.micDecal) <= JUSTE_MM ? 1 : 0); } }
  const modele = ajuster(X, y, lambda);
  const P = { format: E.FORMAT, version: E.VERSION, reglage, noms: E.NOMS_TRAITS.slice(), modele, tau: null };
  if (seuil) P.tau = choisirTau(juges, P);
  return P;
}
/* Seuil : validation croisée interne par partie sur les cas d'apprentissage ; on retient le plus petit τ (le plus de poses) qui tient la précision. */
function choisirTau(juges, P) {
  const parties = [...new Set(juges.map(c => c.partie))];
  const scores = [];
  if (parties.length >= 3) {
    for (const pt of parties) {
      const m = apprendre(juges.filter(c => c.partie !== pt), { seuil: false });
      for (const c of juges.filter(c => c.partie === pt)) { const d = E.choisir(c, { ...m, tau: 0 }, E.soutienDuDiagnostic(c)); if (d.candidat) scores.push({ s: d.score, e: erreur(d.candidat.paire, c.micDecal) }); }
    }
  } else for (const c of juges) { const d = E.choisir(c, { ...P, tau: 0 }, E.soutienDuDiagnostic(c)); if (d.candidat) scores.push({ s: d.score, e: erreur(d.candidat.paire, c.micDecal) }); }
  scores.sort((a, b) => b.s - a.s);
  let tau = 1, ok = 0, mauvaises = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].e > MAUVAISE_MM) mauvaises++;
    if (scores[i].e <= JUSTE_MM) ok++;
    const n = i + 1;
    if (ok / n >= PRECISION && mauvaises / n <= MAUVAISES_MAX && (n === scores.length || scores[i + 1].s < scores[i].s)) tau = scores[i].s;
  }
  return arrondi(tau, 4);
}

/* ------------------------------------------------------------------ évaluation */
function compterDecisions(cas, decide) {
  const r = { examines: cas.length, actions: 0, jugesActions: 0, justes: 0, plus10: 0, plus50: 0, erreurs: [], juges: 0, jugesLaisses: 0 };
  for (const c of cas) {
    const d = decide(c);
    if (c.juge) r.juges++;
    if (!d) { if (c.juge) r.jugesLaisses++; continue; }
    r.actions++;
    if (!c.juge) continue;
    const e = erreur(d, c.micDecal); r.jugesActions++; r.erreurs.push(e);
    if (e <= JUSTE_MM) r.justes++; else r.plus10++;
    if (e > MAUVAISE_MM) r.plus50++;
  }
  r.erreurMediane = arrondi(med(r.erreurs), 1); delete r.erreurs;
  r.laisses = r.examines - r.actions;
  return r;
}
const decisionTest13 = c => c.etat === 'valider' && c.choix ? c.choix : null;
const decisionModele = P => c => { const d = E.choisir(c, P, E.soutienDuDiagnostic(c)); return d.agir ? d.candidat.paire : null; };

function evaluer(cas) {
  const parties = [...new Set(cas.filter(c => c.juge).map(c => c.partie))].sort();
  const par = {};
  for (const pt of [...new Set(cas.map(c => c.partie))].sort()) {
    const ici = cas.filter(c => c.partie === pt);
    const P = parties.includes(pt) ? apprendre(cas.filter(c => c.partie !== pt)) : apprendre(cas);
    par[pt] = { horsApprentissage: parties.includes(pt), test13: compterDecisions(ici, decisionTest13), nouveau: compterDecisions(ici, decisionModele(P)), Gc: P.reglage.ecartementConventionMm, tau: P.tau };
  }
  const complet = apprendre(cas);
  const dans = {};
  for (const pt of Object.keys(par)) dans[pt] = compterDecisions(cas.filter(c => c.partie === pt), decisionModele(complet));
  return { parties: par, dansEchantillon: dans, complet };
}

function args(argv) {
  const o = { mode: argv[0], diag: [] };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => argv[++i];
    if (k === '--diag') o.diag.push(val()); else if (k === '--json') o.json = val(); else if (k === '--sortie') o.sortie = val(); else if (k === '--date') o.date = val();
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
function main(argv) {
  const a = args(argv), cas = lireDiag(a.diag);
  if (a.mode === 'evaluer') {
    const R = evaluer(cas);
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(R, null, 1) + '\n');
    for (const [pt, r] of Object.entries(R.parties)) process.stdout.write(`${pt}${r.horsApprentissage ? '' : ' (sans vérité)'} Gc ${r.Gc} τ ${r.tau}\n  test 13 : ${JSON.stringify(r.test13)}\n  nouveau : ${JSON.stringify(r.nouveau)}\n  dans l'échantillon : ${JSON.stringify(R.dansEchantillon[pt])}\n`);
  } else if (a.mode === 'exporter') {
    if (!a.sortie || !a.date) throw Error('exporter --diag … --date AAAA-MM-JJ --sortie P.json');
    const P = apprendre(cas);
    P.date = a.date; P.parties = [...new Set(cas.filter(c => c.juge).map(c => c.partie))].sort(); P.jugés = cas.filter(c => c.juge).length;
    fs.writeFileSync(a.sortie, JSON.stringify(P, null, 1) + '\n');
    process.stdout.write(JSON.stringify({ Gc: P.reglage.ecartementConventionMm, tau: P.tau, parties: P.parties }) + '\n');
  } else throw Error('mode : evaluer | exporter');
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); } }
module.exports = { ajuster, apprendre, choisirTau, compterDecisions, evaluer, erreur };
