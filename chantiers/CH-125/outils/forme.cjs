#!/usr/bin/env node
'use strict';
/* CH-125 : où l'opérateur pose le gabarit par rapport aux points (hors ligne, lecture seule).
 *   node chantiers/CH-125/outils/forme.cjs --rails DOSSIER --gabarit G.json [--lots …] [--csv S.csv]
 * Pour chaque rail jugé des lots réglables, à la POSE FINALE de l'opérateur : centre (médiane) de la bande du dessus et de la bande du flanc, effectifs,
 * épaisseurs. Séparé en rails RETOUCHÉS par l'opérateur sur l'axe (plus de 2 mm entre la pose livrée et la pose finale : son choix délibéré) et rails
 * LAISSÉS (moins de 0,5 mm : la pose livrée lui convenait). Trois lectures du nuage : points visibles de la coupe (ce que lit le moteur), tous les
 * points chargés (±0,5 m), tous les points chargés avec la pente le long de la voie retirée. Sorties : comptes et millimètres. */
const fs = require('node:fs');
const R = require('./rails.cjs'), E = require('./estimateurs.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = { lots: R.LOTS_REGLABLES };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--csv') o.csv = v(); else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), rails = R.lire(o.rails, { lots: o.lots });
const r1 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 10, med = N.mediane, q = N.quantile;
const LECTURES = { visibles: { origines: [0], xMax: 0.25 }, charges: { origines: [0, 1], xMax: 0.5 } };
const lignes = [];
for (const r of rails) {
  if (r.classeLot === 'mauvaise-voie') continue;
  const dl = (r.finale[0] - r.livre[0]) * 1000, dv = (r.finale[1] - r.livre[1]) * 1000, L = { lot: r.lot, partie: r.partie, cut: r.cut, cote: r.cote, zone: r.zone, etage: r.etage, source: r.source, ref: r.ref, dLat: dl, dVert: dv };
  for (const [nom, opt] of Object.entries(LECTURES)) {
    const B = E.bandes(r.pts, gab, r.finale, { ...opt, bandeMm: 12 }), t = B.top.map(p => p.r), f = B.face.map(p => p.r);
    L[nom] = { topN: t.length, faceN: f.length, top50: t.length ? med(t) : null, top90: t.length ? q(t, 0.9) : null, top10: t.length ? q(t, 0.1) : null, face50: f.length ? med(f) : null,
      penteTop: E.pente(B.top), penteFace: E.pente(B.face) };
  }
  lignes.push(L);
}
const tab = (titre, sel, val, grouper) => {
  const G = new Map(); for (const l of lignes.filter(sel)) { const v = val(l); if (v == null || !Number.isFinite(v)) continue; const g = grouper(l); if (!G.has(g)) G.set(g, []); G.get(g).push(v); }
  const out = [titre, '| groupe | rails | q10 | q25 | médiane | q75 | q90 |', '|---|---|---|---|---|---|---|'];
  const tous = [...G.values()].flat();
  for (const [g, v] of [...G.entries()].sort().concat([['**tous**', tous]])) if (v.length) out.push(`| ${g} | ${v.length} | ${r1(q(v, .1))} | ${r1(q(v, .25))} | ${r1(med(v))} | ${r1(q(v, .75))} | ${r1(q(v, .9))} |`);
  return out.join('\n');
};
const retV = l => Math.abs(l.dVert) > 2, laiV = l => Math.abs(l.dVert) < 0.5, retL = l => Math.abs(l.dLat) > 2, laiL = l => Math.abs(l.dLat) < 0.5;
const S = [];
S.push(`Rails jugés hors mauvaises voies : ${lignes.length} ; retouchés en hauteur (> 2 mm) ${lignes.filter(retV).length}, laissés (< 0,5 mm) ${lignes.filter(laiV).length} ; retouchés en travers ${lignes.filter(retL).length}, laissés ${lignes.filter(laiL).length}.`, '');
for (const nom of Object.keys(LECTURES)) {
  S.push(`## Lecture « ${nom} »`, '');
  S.push(tab(`Hauteur du gabarit de l'opérateur AU-DESSUS de la médiane du dessus (mm), rails RETOUCHÉS en hauteur, dessus ≥ 15 points, par lot`, l => retV(l) && l[nom].topN >= 15, l => -l[nom].top50, l => l.lot), '');
  S.push(tab(`Même mesure, rails LAISSÉS en hauteur, par lot`, l => laiV(l) && l[nom].topN >= 15, l => -l[nom].top50, l => l.lot), '');
  S.push(tab(`Même mesure, rails RETOUCHÉS en hauteur, par épaisseur du dessus (q90 − q10, mm)`, l => retV(l) && l[nom].topN >= 15, l => -l[nom].top50, l => { const e = l[nom].top90 - l[nom].top10; return e < 5 ? 'a < 5' : e < 8 ? 'b 5-8' : e < 11 ? 'c 8-11' : 'd ≥ 11'; }), '');
  S.push(tab(`Hauteur du gabarit de l'opérateur au-dessus du 90e centile du dessus (mm), rails RETOUCHÉS en hauteur, par épaisseur`, l => retV(l) && l[nom].topN >= 15, l => -l[nom].top90, l => { const e = l[nom].top90 - l[nom].top10; return e < 5 ? 'a < 5' : e < 8 ? 'b 5-8' : e < 11 ? 'c 8-11' : 'd ≥ 11'; }), '');
  S.push(tab(`Médiane du flanc par rapport au flanc du gabarit de l'opérateur (mm, + = points côté champignon), rails RETOUCHÉS en travers, flanc ≥ 4 points, par lot`, l => retL(l) && l[nom].faceN >= 4, l => l[nom].face50, l => l.lot), '');
  S.push(tab(`Même mesure, rails LAISSÉS en travers, flanc ≥ 4 points`, l => laiL(l) && l[nom].faceN >= 4, l => l[nom].face50, l => l.lot), '');
  S.push(tab(`Points du dessus par rail`, () => true, l => l[nom].topN, l => l.lot), '');
  S.push(tab(`Points du flanc par rail`, () => true, l => l[nom].faceN, l => l.lot), '');
  S.push(tab(`|pente du dessus le long de la voie| (mm par m), rails à 30 points de dessus au moins`, l => l[nom].topN >= 30, l => l[nom].penteTop == null ? null : Math.abs(l[nom].penteTop), l => l.zone), '');
}
process.stdout.write(S.join('\n') + '\n');
if (o.csv) fs.writeFileSync(o.csv, ['lot;partie;cut;cote;zone;etage;source;ref;dLat;dVert;topN;faceN;top50;top10;top90;face50;topN_charges;faceN_charges;top50_charges;face50_charges',
  ...lignes.map(l => [l.lot, l.partie, l.cut, l.cote, l.zone, l.etage, l.source, l.ref, r1(l.dLat), r1(l.dVert), l.visibles.topN, l.visibles.faceN, r1(l.visibles.top50), r1(l.visibles.top10), r1(l.visibles.top90), r1(l.visibles.face50),
    l.charges.topN, l.charges.faceN, r1(l.charges.top50), r1(l.charges.face50)].join(';'))].join('\n') + '\n');
