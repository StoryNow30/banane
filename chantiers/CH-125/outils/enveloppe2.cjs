#!/usr/bin/env node
'use strict';
/* CH-125 : enveloppe « au k-ième point » : réglage de k et de la bande, dessus et flanc (hors ligne, lecture seule).
 *   node chantiers/CH-125/outils/enveloppe2.cjs --rails DOSSIER --gabarit G.json [--lots …]
 * Dessus : écart (dessus du gabarit de l'opérateur − k-ième point le plus haut de la bande), selon k, la demi-bande et la densité du nuage.
 * Flanc : écart (flanc du gabarit de l'opérateur − k-ième point le plus côté voie de la bande du flanc), selon k. Rails RETOUCHÉS sur l'axe (> 2 mm)
 * et rails laissés (< 0,5 mm). Le meilleur k est celui dont l'écart est le plus resserré chez les retouchés. Comptes et millimètres. */
const R = require('./rails.cjs'), E = require('./estimateurs.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = { lots: R.LOTS_REGLABLES };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--lots') o.lots = v().split(','); else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), rails = R.lire(o.rails, { lots: o.lots }).filter(r => r.classeLot !== 'mauvaise-voie'), med = N.mediane, q = N.quantile, r1 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 10;
const ligne = (nom, v) => { v = v.filter(Number.isFinite); const m = med(v); return `| ${nom} | ${v.length} | ${r1(m)} | ${r1(q(v, .25))} | ${r1(q(v, .75))} | ${r1(q(v, .75) - q(v, .25))} | ${r1(med(v.map(x => Math.abs(x - m))))} | ${r1(q(v, .05))} | ${r1(q(v, .95))} |`; };
const ENT = '| statistique | rails | médiane | q25 | q75 | q75 − q25 | écart abs. médian | q5 | q95 |\n|---|---|---|---|---|---|---|---|---|';
const out = [];
for (const bande of [12, 20]) {
  const T = rails.map(r => ({ r, dv: (r.finale[1] - r.livre[1]) * 1000, t: E.bandes(r.pts, gab, r.finale, { origines: [0], xMax: 0.25, bandeMm: bande }).top.map(p => p.r).sort((x, y) => y - x) })).filter(x => x.t.length >= 15);
  for (const [nom, sel] of [['RETOUCHÉS en hauteur', x => Math.abs(x.dv) > 2], ['RETOUCHÉS, nuage clairsemé (< 80 points)', x => Math.abs(x.dv) > 2 && x.t.length < 80], ['RETOUCHÉS, nuage dense (≥ 80 points)', x => Math.abs(x.dv) > 2 && x.t.length >= 80], ['LAISSÉS en hauteur', x => Math.abs(x.dv) < 0.5]]) {
    out.push(`Dessus, demi-bande ${bande} mm, rails ${nom} : dessus de l'opérateur − statistique (mm)`, ENT);
    for (const k of [3, 5, 6, 8, 10, 12, 15, 20]) out.push(ligne(`${k}e plus haut`, T.filter(sel).map(x => -x.t[Math.min(k, x.t.length) - 1])));
    out.push(ligne('q90', T.filter(sel).map(x => -q(x.t, .9))), ligne('médiane', T.filter(sel).map(x => -med(x.t))));
    out.push(ligne('k = 4 + 3 % des points', T.filter(sel).map(x => -x.t[Math.min(x.t.length, Math.round(4 + 0.03 * x.t.length)) - 1])), ligne('k = 2 + 6 % des points', T.filter(sel).map(x => -x.t[Math.min(x.t.length, Math.round(2 + 0.06 * x.t.length)) - 1])), '');
  }
}
for (const bande of [12]) {
  const F = rails.map(r => ({ r, dl: (r.finale[0] - r.livre[0]) * 1000, f: E.bandes(r.pts, gab, r.finale, { origines: [0], xMax: 0.25, bandeMm: bande }).face.map(p => p.r).sort((x, y) => x - y),
    f2: E.bandes(r.pts, gab, r.finale, { origines: [0, 1], xMax: 0.5, bandeMm: bande }).face.map(p => p.r).sort((x, y) => x - y) }));
  for (const [nom, sel] of [['RETOUCHÉS en travers', x => Math.abs(x.dl) > 2], ['LAISSÉS en travers', x => Math.abs(x.dl) < 0.5]]) {
    out.push(`Flanc côté voie, demi-bande ${bande} mm, rails ${nom}, 6 points visibles au moins : statistique du flanc par rapport au flanc du gabarit de l'opérateur (mm, + = points vers le champignon)`, ENT);
    const X = F.filter(sel).filter(x => x.f.length >= 6);
    for (const k of [1, 2, 3, 4, 6]) out.push(ligne(`${k}e point le plus côté voie`, X.map(x => x.f[Math.min(k, x.f.length) - 1])));
    out.push(ligne('q25', X.map(x => q(x.f, .25))), ligne('médiane', X.map(x => med(x.f))), ligne('médiane, points chargés', X.map(x => med(x.f2))), ligne('3e côté voie, points chargés', X.map(x => x.f2[Math.min(3, x.f2.length) - 1])), '');
    const Y = F.filter(sel).filter(x => x.f.length < 6 && x.f2.length >= 6);
    out.push(`Même mesure, rails ${nom} à moins de 6 points de flanc visibles mais 6 au moins avec les points chargés`, ENT, ligne('médiane, points chargés', Y.map(x => med(x.f2))), ligne('3e côté voie, points chargés', Y.map(x => x.f2[2])), '');
  }
  const n6 = F.filter(x => x.f.length < 6).length, n6b = F.filter(x => x.f.length < 6 && x.f2.length >= 6).length;
  out.push(`Rails jugés à moins de 6 points de flanc visibles : ${n6} sur ${F.length} ; parmi eux, 6 points au moins avec les points chargés hors découpe : ${n6b}.`, '');
}
process.stdout.write(out.join('\n') + '\n');
