#!/usr/bin/env node
'use strict';
/* CH-120 : graines de l'ANCRE de CH-124 (axe de la voie déduit de la trajectoire, liste d'ESV du départ du lot), pour le générateur `genAncre`.
 * Utilise la bibliothèque de CH-124 TELLE QUELLE (copie de travail de sa branche, CH124 = dossier ; jamais copiée ni modifiée ici).
 * Par cut : axe (travers, repère « coupe » de CH-124, mm) et une graine par rail, à un demi-écartement de l'axe (DEMI_MM) de chaque côté, à la
 * hauteur de son rail de départ, en décalages [lat, vert] (mm) du repère profil de son rail de départ. Aucune pose d'Ariane ni humaine en entrée.
 *   CH124=… CH116_TRAVAIL=… node chantiers/CH-120/outils/axes.cjs corpus  > ancres-corpus.json
 *   CH124=… BANANE_LOTS=… node chantiers/CH-120/outils/axes.cjs octobre > ancres-octobre.json
 * Sortie : { "lot8:partie:cut": { axe, left:[lat,vert], right:[lat,vert] } } (millimètres ; lot8 hors dépôt seulement). */
const fs = require('node:fs'), path = require('node:path');
const W = process.env.CH124 || '/home/user/w124', O = path.join(W, 'chantiers', 'CH-124', 'outils');
const A = require(path.join(O, 'ancre.cjs')), Lb = require(path.join(O, 'lib.cjs')), T = require(path.join(O, 'trajectoire.cjs'));
const L1 = require(path.join(__dirname, '..', '..', '..', 'src', 'gcv2-l1.js'));
const DEMI_MM = 720;
function graines(rows, caps, cle8, partie, out) {
  const cal = A.calage(rows, caps); if (!cal) return 0;
  const Mo = A.modele(A.listeDeDepart(rows, caps, cal)); let n = 0;
  for (const [cut, cap] of caps) {
    const r = rows[cut]; if (!r) continue; const ax = Mo.axe(cut); if (!ax) continue;
    const rep = Lb.repere(cap), Ow = rep.O.map((v, i) => v + cal.t[i]), yM = 1000 * ((r.M[0] - Ow[0]) * rep.Y[0] + (r.M[1] - Ow[1]) * rep.Y[1]), yAxe = yM + ax.mm;
    const dep = Lb.departCoupe(cap, rep), sg = Math.sign(dep.left[1] - dep.right[1]) || 1, g = {};
    for (const s of ['left', 'right']) {
      const y = yAxe + (s === 'left' ? sg : -sg) * DEMI_MM, z = dep[s][2];
      const p = rep.O.map((v, i) => v + (rep.Y[i] * y + rep.Z[i] * z) / 1000), d = L1.decalage(cap.rails[s], p);
      if (!d) { g.ko = true; break; } g[s] = [Math.round(d[1] * 10) / 10, Math.round(d[2] * 10) / 10];
    }
    if (g.ko) continue;
    out[`${cle8}:${partie}:${cut}`] = { axe: Math.round(yAxe * 10) / 10, left: g.left, right: g.right }; n++;
  }
  return n;
}
const out = {}, mode = process.argv[2];
if (mode === 'corpus') {
  for (const e of Lb.entrees()) { const k = Lb.cle(e), m = Lb.meta(k); if (!m.liste) continue;
    const n = graines(T.lignes(m.liste), Lb.captures(k), m.lotId.slice(0, 8), e.partie, out); process.stderr.write(`${k} : ${n}\n`); }
} else if (mode === 'octobre') {
  const man = require(path.join(__dirname, '..', '..', '..', 'datasets', 'garde-gcv2', 'manifeste.json'));
  for (const l of man.lots) {
    const d = path.join(process.env.BANANE_LOTS, l.nom), partie = Number(String(l.bancPartie || l.partie).split(':')[1]);
    if (!l.fichiers.liste) { process.stderr.write(`${l.nom} : sans liste\n`); continue; }
    const caps = new Map();
    for (const f of l.fichiers.corpus) for (const c of JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')).clouds || []) if (c && Number.isInteger(c.cut) && (c.part == null || c.part === partie)) caps.set(c.cut, c);
    const n = graines(T.lignes(path.join(d, l.fichiers.liste)), caps, l.lot.slice(0, 8), partie, out); process.stderr.write(`${l.nom} : ${n}\n`);
  }
} else throw Error('mode : corpus | octobre');
process.stdout.write(JSON.stringify(out));
