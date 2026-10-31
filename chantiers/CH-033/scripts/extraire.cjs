#!/usr/bin/env node
'use strict';
/*
 * CH-033 : descripteurs par cut posé (H10 à H13 du protocole) pour un couple lot + Écho. Lecture seule.
 *   node extraire.cjs --lot <dossier> [--echo <dossier>] --partie N --liste <liste.json> --nom <étiquette> --sortie <fichier.jsonl>
 * La liste d'ESV est un instantané `ariane-liste-partieN-*.json` (extrait du zip, hors dépôt). La sortie contient des numéros
 * de cut : elle reste hors du dépôt `banane` (scratchpad ou banane-data). Aucune coordonnée n'est écrite : seulement des
 * écarts en mm au tracé interpolé.
 * Reprend les définitions de tools/juger-lot.cjs (cible, posé, jugé) sans les modifier.
 */
const fs = require('node:fs');
const R = '/home/user/banane/tools/';
const J = require(R + 'jointure-echo-orbite.cjs');
const Poses = require(R + 'precision-poses.cjs');
const JL = require(R + 'juger-lot.cjs');

const a = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i += 2) a[av[i].replace(/^--/, '')] = av[i + 1];
const partie = Number(a.partie);
const fini = v => Number.isFinite(v);
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };

/* --- copie conforme de juger-lot (non exporté) --- */
function lotDe(journal) {
  const ev = journal.events.filter(e => instant(e) !== null).sort((x, y) => instant(x) - instant(y));
  const departs = ev.filter(e => e.type === 'batch-started' && e.batch && e.batch.id);
  const mien = departs.filter(e => e.identity && e.identity.part === partie).pop();
  if (!mien) return null;
  const B = mien.batch.id, t0 = instant(mien);
  let fin = Infinity;
  const suivant = departs.find(e => instant(e) > t0 && e.batch.id !== B);
  if (suivant) fin = instant(suivant);
  const arret = ev.find(e => e.type === 'batch-stopped-at-end' && instant(e) > t0);
  if (arret) fin = Math.min(fin, instant(arret) + 5000);
  else { const rel = ev.find(e => e.type === 'relecture-debut' && e.batchId === B); if (rel) fin = Math.min(fin, instant(rel)); }
  return { ev, B, t0, fin };
}
function ciblesDe(lot) {
  const c = new Set();
  for (const e of lot.ev) if (e.type === 'gcv1-shadow-observed' && e.batchId === lot.B && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut)) c.add(e.identity.cut);
  for (const e of lot.ev) if (e.type === 'capture-abandoned' && e.reason === 'depart-sur-vert' && e.identity && e.identity.part === partie && instant(e) >= lot.t0 && instant(e) <= lot.t0 + 30000) c.delete(e.identity.cut);
  return c;
}
const tPose = new Map();
function posesDe(lot, cibles) {
  const p = new Set();
  for (const e of lot.ev) {
    if (e.type !== 'esv-observation' || e.kind !== 'write') continue;
    const t = instant(e); if (t < lot.t0 || t >= lot.fin) continue;
    const ok = Number.isInteger(e.status) && e.status >= 200 && e.status < 300;
    const v = e.body && e.body.ExtractionStatus === 'valid' && e.body.TreatedByOperator === true;
    if (ok && v && cibles.has(e.rowIndex)) { p.add(e.rowIndex); if (!tPose.has(e.rowIndex)) tPose.set(e.rowIndex, t); }
  }
  return p;
}
function etatPose(l) {
  if (!l || !l.dansEcho) return { etat: 'sans-echo' };
  if (l.referenceHumaine !== 'observee') return { etat: 'non-juge' };
  if (l.regleVisiteBon) return { etat: 'controle', mm: 0, latH: 0 };
  if (typeof l.base !== 'string' || !l.base.startsWith('ariane')) return { etat: 'repere' };
  const mm = l.ecartHumain && l.ecartHumain.maxDist3dMm;
  if (!fini(mm)) return { etat: 'non-juge' };
  const g = l.ecartHumain.gauche, d = l.ecartHumain.droite;
  const latH = g && d && g.repere === 'profil' && d.repere === 'profil' ? (g.lateralMm + d.lateralMm) / 2 : null;
  return { etat: 'corrige', mm, latH };
}

/* --- liste d'ESV : centres de voie (m) et écartement (mm) --- */
function lireListe(f) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const last = [null, null, null, null, null, null];
  return d.r.map(row => {
    const v = row.slice(1, 7), cur = [];
    for (let k = 0; k < 6; k++) { if (v[k] === null || v[k] === undefined) { cur.push(null); continue; } last[k] = last[k] === null ? v[k] : last[k] + v[k]; cur.push(last[k]); }
    const ok = cur.every(x => x !== null);
    const statut = row[0] % 4;
    if (!ok) return { statut, c: null };
    const L = cur.slice(0, 3).map(x => x / 1e4), Rr = cur.slice(3, 6).map(x => x / 1e4);
    return { statut, c: [(L[0] + Rr[0]) / 2, (L[1] + Rr[1]) / 2, (L[2] + Rr[2]) / 2], gauge: 1000 * Math.hypot(L[0] - Rr[0], L[1] - Rr[1], L[2] - Rr[2]) };
  });
}

/* Ajustement quadratique local (protocole § 5). Rend { lat, vert, n, hors } en mm ou null si non évaluable. */
function tracer(rows, sains, i) {
  const av = [], ap = [];
  for (let k = 1; k <= 200 && (av.length < 15 || ap.length < 15); k++) {
    if (av.length < 15 && sains.has(i - k)) av.push(i - k);
    if (ap.length < 15 && sains.has(i + k)) ap.push(i + k);
  }
  if (av.length < 5 || ap.length < 5) return { evaluable: false, nAv: av.length, nAp: ap.length };
  const js = [...av, ...ap], P = js.map(j => rows[j].c);
  const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of P) { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = [Math.cos(th), Math.sin(th)], uy = [-Math.sin(th), Math.cos(th)];
  const loc = p => [(p[0] - mx) * ux[0] + (p[1] - my) * ux[1], (p[0] - mx) * uy[0] + (p[1] - my) * uy[1], p[2]];
  const Q = P.map(loc);
  const fit = (xs, ys) => { // moindres carrés y = a + b x + c x²
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], T = [0, 0, 0];
    for (let k = 0; k < xs.length; k++) { const f = [1, xs[k], xs[k] ** 2]; for (let r = 0; r < 3; r++) { T[r] += f[r] * ys[k]; for (let c = 0; c < 3; c++) S[r][c] += f[r] * f[c]; } }
    const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(S); if (Math.abs(D) < 1e-12) return null;
    return [0, 1, 2].map(c => det(S.map((row, r) => row.map((v, cc) => cc === c ? T[r] : v))) / D);
  };
  const cy = fit(Q.map(q => q[0]), Q.map(q => q[1])), cz = fit(Q.map(q => q[0]), Q.map(q => q[2]));
  if (!cy || !cz) return { evaluable: false };
  const q = loc(rows[i].c), ev = (c, x) => c[0] + c[1] * x + c[2] * x * x;
  const resid = Q.map((qq, k) => 1000 * (qq[1] - ev(cy, qq[0])));
  const gauges = js.map(j => rows[j].gauge).sort((x, y) => x - y);
  return { evaluable: true, nAv: av.length, nAp: ap.length, latMm: 1000 * (q[1] - ev(cy, q[0])), vertMm: 1000 * (q[2] - ev(cz, q[0])),
    residuSainsMm: Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / resid.length), gaugeMedSains: gauges[Math.floor(gauges.length / 2)],
    portee: Math.max(...js.map(j => Math.abs(j - i))) };
}

const journal = Poses.lireJournalDir(a.lot);
const lot = lotDe(journal);
if (!lot) { console.error('aucun lot'); process.exit(1); }
const cibles = ciblesDe(lot), poses = posesDe(lot, cibles);
const ecrits = new Set();
for (const e of journal.events) if (e.type === 'esv-observation' && e.kind === 'write' && Number.isInteger(e.rowIndex)) {
  const p = e.identity && e.identity.part; if (p === undefined || p === null || p === partie) ecrits.add(e.rowIndex);
}
let lignes = new Map();
if (a.echo) {
  const echo = Poses.lireEcho(JL.dossiersEcho([a.echo]));
  const { table } = J.joindre(echo.records, journal, { partie, base: 'auto', poses: false, visiteSansActionBonne: true, sessions: echo.sessions || [],
    pagesPerdues: echo.pagesPerdues || [], capturesParVisite: echo.capturesParVisite || {}, evenementsEcho: echo.evenements || [] });
  for (const l of table) if (l.partie === partie) lignes.set(l.cut, l);
}
const jr = J.journalParCut(journal);
const rows = lireListe(a.liste);
const sains = new Set();
rows.forEach((r, i) => { if (r.c && r.statut === 0 && !cibles.has(i) && !ecrits.has(i)) sains.add(i); });

/* H14 (addendum) : écart latéral du centre posé à l'extrapolation / interpolation quadratique des 10 références les plus
 * proches dans ±40 cuts ; références = cuts sains (deux côtés) et posés du lot écrits AVANT ce cut et non signalés (séquentiel). */
const GRILLE14 = [30, 40, 50, 60, 80, 100, 150, 1e9];
const K14 = Number(process.env.K14 || 10), W14 = Number(process.env.W14 || 40), DEG14 = process.env.DEG14 === undefined ? null : Number(process.env.DEG14), MIN14 = Number(process.env.MIN14 || 5);
function residu14(i, refs) {
  const js = refs.slice().sort((x, y) => Math.abs(x - i) - Math.abs(y - i)).slice(0, K14);
  if (js.length < MIN14) return { ev: false, n: js.length };
  const P = js.map(j => rows[j].c);
  const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of P) { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = [Math.cos(th), Math.sin(th)], uy = [-Math.sin(th), Math.cos(th)];
  const loc = p => [(p[0] - mx) * ux[0] + (p[1] - my) * ux[1], (p[0] - mx) * uy[0] + (p[1] - my) * uy[1]];
  const Q = P.map(loc), xs = Q.map(q => q[0]), ys = Q.map(q => q[1]);
  const span = Math.max(...xs) - Math.min(...xs);
  const deg = DEG14 !== null ? DEG14 : (span > 8 ? 2 : 1); // trop court pour une courbure : droite
  const S = [], T = [];
  for (let r = 0; r <= deg; r++) { S.push(new Array(deg + 1).fill(0)); T.push(0); }
  for (let k = 0; k < xs.length; k++) { const f = [1, xs[k], xs[k] ** 2].slice(0, deg + 1); for (let r = 0; r <= deg; r++) { T[r] += f[r] * ys[k]; for (let c = 0; c <= deg; c++) S[r][c] += f[r] * f[c]; } }
  // Gauss
  const n = deg + 1, M = S.map((row, r) => [...row, T[r]]);
  for (let c = 0; c < n; c++) { let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r; [M[c], M[piv]] = [M[piv], M[c]]; if (Math.abs(M[c][c]) < 1e-12) return { ev: false, n: js.length }; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  const co = M.map((row, r) => row[n] / row[r]);
  const q = loc(rows[i].c), yhat = co.reduce((s, c, k) => s + c * q[0] ** k, 0);
  const avant = js.filter(j => j < i).length, apres = js.length - avant;
  return { ev: true, n: js.length, r: 1000 * (q[1] - yhat), avant, apres, portee: Math.max(...js.map(j => Math.abs(j - i))) };
}
const ordre = [...poses].filter(c => rows[c] && rows[c].c).sort((x, y) => tPose.get(x) - tPose.get(y) || x - y);
const h14 = new Map(); // cut -> { T: {ev, r, signale} }
for (const T of GRILLE14) {
  const acceptes = new Set();
  for (const i of ordre) {
    const refs = [];
    for (let j = i - W14; j <= i + W14; j++) if (j !== i && rows[j] && rows[j].c && (sains.has(j) || acceptes.has(j))) refs.push(j);
    const x = residu14(i, refs);
    const signale = x.ev && Math.abs(x.r) > T;
    if (!signale) acceptes.add(i);
    if (!h14.has(i)) h14.set(i, {});
    h14.get(i)[T >= 1e9 ? 'inf' : T] = { ev: x.ev, n: x.n, r: x.ev ? Math.round(x.r * 10) / 10 : null, s: signale, av: x.avant, ap: x.apres, portee: x.portee };
  }
}

const out = [];
for (const cut of [...poses].sort((x, y) => x - y)) {
  const l = lignes.get(cut), et = etatPose(l);
  const jc = [...jr.values()].length ? jr.get(`${partie}:${cut}`) || jr.get(`${partie}|${cut}`) : null;
  let dep = l && l.arianeDeplacement;
  if (!dep && jc) { const pa = J.poseAriane(jc); if (pa && pa.initial) dep = { gauche: J.ecartRail(pa.initial.gauche, pa.posee.gauche), droite: J.ecartRail(pa.initial.droite, pa.posee.droite) }; }
  const depLat = dep && dep.gauche && dep.droite && dep.gauche.repere === 'profil' && dep.droite.repere === 'profil' ? (dep.gauche.lateralMm + dep.droite.lateralMm) / 2 : null;
  const depVert = dep && dep.gauche && dep.droite && dep.gauche.repere === 'profil' && dep.droite.repere === 'profil' ? (dep.gauche.verticalMm + dep.droite.verticalMm) / 2 : null;
  const t = rows[cut] && rows[cut].c ? tracer(rows, sains, cut) : { evaluable: false };
  out.push({ nom: a.nom, partie, cut, etat: et.etat, mm: et.mm ?? null, latHumainMm: et.latH ?? null, depLatMm: depLat, depVertMm: depVert,
    gauge: rows[cut] && rows[cut].gauge || null, ...t, h14: h14.get(cut) || null });
}
fs.writeFileSync(a.sortie, out.map(o => JSON.stringify(o)).join('\n') + '\n');
const n = out.length, ev = out.filter(o => o.evaluable).length;
console.log(`${a.nom} partie ${partie} : cibles ${cibles.size}, posés ${poses.size}, sains ${sains.size}, évaluables ${ev}/${n}, déplacement connu ${out.filter(o => fini(o.depLatMm)).length}/${n}`);
