#!/usr/bin/env node
'use strict';
/* CH-124 : la trajectoire du véhicule de mesure lue dans la liste d'ESV (hors ligne, lecture seule).
 * Hypothèse à l'essai (H-traj) : quand l'extraction d'ESV échoue, la pose de départ est une pose « par défaut » (écartement 1 500,0 mm)
 * centrée sur la trajectoire ; chaque coupe est un plan perpendiculaire à la tangente de cette trajectoire. Si c'est vrai, la position en travers
 * de la trajectoire se CHEMINE d'une coupe à la suivante par la seule géométrie des plans (les deux bords d'une ligne de la liste sont dans le plan
 * de sa coupe, quels que soient les rails visés), et le cheminement parti d'une pose par défaut doit retomber sur la pose par défaut suivante.
 *   node chantiers/CH-124/outils/trajectoire.cjs fermeture [--lots …]   : erreur de fermeture entre poses par défaut, par distance en cuts
 *   node chantiers/CH-124/outils/trajectoire.cjs profil --cle K --de A --a B : par cut, statut, écartement, travers de la trajectoire cheminée (mm)
 * Sorties : numéros de cut, millimètres, degrés. Aucune coordonnée. */
const fs = require('node:fs'), path = require('node:path');
const Lb = require('./lib.cjs');
const LM = require(path.join(Lb.RACINE, 'src', 'liste-memoire.js'));
const DEFAUT_MM = 1500, TOL_DEFAUT_MM = 0.06;

/* Lignes de la liste : plan de chaque coupe en plan (2D) et milieu des bords. */
function lignes(fichier) {
  const t = LM.decompacter(JSON.parse(fs.readFileSync(fichier, 'utf8'))), out = new Array(t.n).fill(null);
  for (let i = 0; i < t.n; i++) {
    const e = t.ed.slice(6 * i, 6 * i + 6); if (e.some(v => v == null || !Number.isFinite(v))) continue;
    const Lp = [e[0] / 1e4, e[1] / 1e4, e[2] / 1e4], Rp = [e[3] / 1e4, e[4] / 1e4, e[5] / 1e4];
    const dx = Lp[0] - Rp[0], dy = Lp[1] - Rp[1], g = Math.hypot(dx, dy); if (!(g > 0.5)) continue;
    const ey = [dx / g, dy / g], n = [ey[1], -ey[0]]; /* ey : vers la gauche ; n = ey × Z */
    out[i] = { i, st: t.st[i], fl: t.fl[i], L: Lp, R: Rp, M: [(Lp[0] + Rp[0]) / 2, (Lp[1] + Rp[1]) / 2, (Lp[2] + Rp[2]) / 2], ey, n,
      ecartMm: 1000 * Math.hypot(dx, dy, Lp[2] - Rp[2]), cap: Math.atan2(n[1], n[0]) };
    out[i].defaut = Math.abs(out[i].ecartMm - DEFAUT_MM) <= TOL_DEFAUT_MM;
  }
  return out;
}
/* Cheminement : travers l (m, vers la gauche, depuis le milieu M de la ligne) de la trajectoire dans le plan b, parti du travers la dans le plan a. */
function cheminer(rows, a, la, b) {
  let l = la, i = a; const pas = b > a ? 1 : -1;
  while (i !== b) {
    const p = rows[i], q = rows[i + pas]; if (!p || !q) return null;
    const T = [p.M[0] + l * p.ey[0], p.M[1] + l * p.ey[1]];
    let t = [p.n[0] + q.n[0], p.n[1] + q.n[1]]; const nt = Math.hypot(t[0], t[1]); t = [t[0] / nt, t[1] / nt];
    const den = t[0] * q.n[0] + t[1] * q.n[1]; if (Math.abs(den) < 0.5) return null;
    const lam = ((q.M[0] - T[0]) * q.n[0] + (q.M[1] - T[1]) * q.n[1]) / den;
    const T2 = [T[0] + lam * t[0], T[1] + lam * t[1]];
    l = (T2[0] - q.M[0]) * q.ey[0] + (T2[1] - q.M[1]) * q.ey[1]; i += pas;
  }
  return l;
}
function args(a) { const o = { mode: a[0] }; for (let i = 1; i < a.length; i++) { const k = a[i]; if (k === '--lots') o.lots = a[++i].split(','); else if (k === '--cle') o.cle = a[++i]; else if (k === '--de') o.de = Number(a[++i]); else if (k === '--a') o.a = Number(a[++i]); else throw Error('option inconnue ' + k); } return o; }
function main() {
  const o = args(process.argv.slice(2));
  if (o.mode === 'fermeture') {
    const vus = new Set(), classes = [[1, 1], [2, 3], [4, 6], [7, 12], [13, 25], [26, 50], [51, 100], [101, 200]], acc = classes.map(() => []); let nDef = 0, nLignes = 0;
    for (const e of Lb.entrees(o.lots)) {
      const m = Lb.meta(Lb.cle(e)); if (!m.liste || vus.has(m.liste)) continue; vus.add(m.liste);
      const rows = lignes(m.liste), def = rows.filter(r => r && r.defaut).map(r => r.i); nDef += def.length; nLignes += rows.filter(Boolean).length;
      const parListe = classes.map(() => []);
      for (let x = 0; x < def.length; x++) for (let y = x + 1; y < def.length && def[y] - def[x] <= 200; y++) {
        const l = cheminer(rows, def[x], 0, def[y]); if (l == null) continue;
        const d = def[y] - def[x], c = classes.findIndex(([p, q]) => d >= p && d <= q); if (c >= 0) { acc[c].push(1000 * l); parListe[c].push(1000 * l); }
      }
      process.stdout.write(`${Lb.cle(e).replace(/-r\d+$/, '')} : ${rows.filter(Boolean).length} lignes, ${def.length} poses par défaut ; fermeture médiane |mm| par distance : ${classes.map(([p, q], c) => `${p}-${q}:${parListe[c].length ? Lb.med(parListe[c].map(Math.abs)).toFixed(1) + ' (' + parListe[c].length + ')' : '-'}`).join('  ')}\n`);
    }
    process.stdout.write(`\nTOTAL : ${nLignes} lignes, ${nDef} poses par défaut\n| distance (cuts) | paires | médiane |mm| | q90 | max |\n|---|---|---|---|---|\n`);
    classes.forEach(([p, q], c) => { const v = acc[c].map(Math.abs); if (v.length) process.stdout.write(`| ${p}-${q} | ${v.length} | ${Lb.med(v).toFixed(1)} | ${Lb.quantile(v, 0.9).toFixed(1)} | ${Math.max(...v).toFixed(1)} |\n`); });
    return;
  }
  if (o.mode === 'profil') {
    const m = Lb.meta(o.cle), rows = lignes(m.liste); let depart = null;
    for (let i = o.de; i <= o.a; i++) if (rows[i] && rows[i].defaut) { depart = i; break; }
    if (depart == null) throw Error('aucune pose par défaut dans la plage');
    for (let i = o.de; i <= o.a; i++) { const r = rows[i]; if (!r) { process.stdout.write(`${i} absent\n`); continue; }
      const l = cheminer(rows, depart, 0, i), prev = rows[i - 1];
      process.stdout.write(`${i} st ${r.st} fl ${r.fl} écart ${r.ecartMm.toFixed(1)}${r.defaut ? ' DÉFAUT' : ''} ; milieu de la ligne par rapport à la trajectoire cheminée depuis ${depart} : ${l == null ? '?' : (-1000 * l).toFixed(1)} mm ; dcap ${prev ? ((r.cap - prev.cap) * 180 / Math.PI).toFixed(3) : '-'}°\n`); }
    return;
  }
  throw Error('mode : fermeture | profil');
}
module.exports = { lignes, cheminer, DEFAUT_MM, TOL_DEFAUT_MM };
if (require.main === module) { try { main(); } catch (e) { process.stderr.write('trajectoire : ' + e.message + '\n'); process.exitCode = 1; } }
