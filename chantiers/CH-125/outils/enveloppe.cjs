#!/usr/bin/env node
'use strict';
/* CH-125 : quelle statistique du dessus l'opérateur suit-il ? (hors ligne, lecture seule)
 *   node chantiers/CH-125/outils/enveloppe.cjs --rails DOSSIER --gabarit G.json [--lots …] [--bande 20]
 * À la pose finale de l'opérateur, bande du dessus de ±`bande` mm (points visibles) : pour chaque statistique candidate S du dessus (médiane,
 * centiles, k-ième point le plus haut, modèle « plan incliné le long de la voie » : centre en x = 0, pente, bout haut de la tranche, bruit résiduel),
 * l'écart (dessus du gabarit de l'opérateur − S), en mm. La statistique que l'opérateur suit est celle dont l'écart est le plus RESSERRÉ (étendue
 * q75 − q25 et écart absolu médian autour de la médiane), sur les rails RETOUCHÉS en hauteur d'abord, puis sur les rails laissés. */
const R = require('./rails.cjs'), E = require('./estimateurs.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = { lots: R.LOTS_REGLABLES, bande: 20 };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--bande') o.bande = Number(v()); else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), rails = R.lire(o.rails, { lots: o.lots }), med = N.mediane, q = N.quantile, r1 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 10;
const STATS = {
  'médiane': t => med(t.map(p => p.r)), 'q75': t => q(t.map(p => p.r), .75), 'q90': t => q(t.map(p => p.r), .9), 'q95': t => q(t.map(p => p.r), .95), 'q98': t => q(t.map(p => p.r), .98),
  '3e plus haut': t => t.map(p => p.r).sort((x, y) => y - x)[2], '5e plus haut': t => t.map(p => p.r).sort((x, y) => y - x)[4], '8e plus haut': t => t.map(p => p.r).sort((x, y) => y - x)[7],
  'plan : centre en x = 0': (t, m) => m.z0, 'plan : bout haut (|pente| × 0,25 m)': (t, m) => m.z0 + Math.abs(m.b) * 0.25, 'plan : bout haut + q90 du bruit résiduel': (t, m) => m.z0 + Math.abs(m.b) * 0.25 + m.q90r,
  'plan : bout haut à 0,20 m + q90 du bruit': (t, m) => m.z0 + Math.abs(m.b) * 0.20 + m.q90r, 'plan : centre + q90 du bruit résiduel': (t, m) => m.z0 + m.q90r,
};
const L = [];
for (const r of rails) {
  if (r.classeLot === 'mauvaise-voie') continue;
  const t = E.bandes(r.pts, gab, r.finale, { origines: [0], xMax: 0.25, bandeMm: o.bande }).top; if (t.length < 25) continue;
  const d = N.droite(t.map(p => p.x), t.map(p => p.r)); if (!d) continue;
  const res = t.map(p => p.r - d.a - d.b * p.x), m = { z0: d.a, b: d.b, q90r: q(res, .9), ep: q(res, .9) - q(res, .1), ep0: q(t.map(p => p.r), .9) - q(t.map(p => p.r), .1) };
  L.push({ r, n: t.length, m, dv: (r.finale[1] - r.livre[1]) * 1000, s: Object.fromEntries(Object.entries(STATS).map(([k, f]) => [k, -f(t, m)])) });
}
const tab = (titre, sel) => {
  const X = L.filter(sel), out = [`${titre} (${X.length} rails)`, '| statistique S du dessus | dessus de l\'opérateur − S : médiane | q25 | q75 | étendue q75 − q25 | écart absolu médian | q10 | q90 |', '|---|---|---|---|---|---|---|---|'];
  for (const k of Object.keys(STATS)) { const v = X.map(l => l.s[k]).filter(Number.isFinite), m = med(v); out.push(`| ${k} | ${r1(m)} | ${r1(q(v, .25))} | ${r1(q(v, .75))} | ${r1(q(v, .75) - q(v, .25))} | ${r1(med(v.map(x => Math.abs(x - m))))} | ${r1(q(v, .1))} | ${r1(q(v, .9))} |`); }
  return out.join('\n');
};
const ret = l => Math.abs(l.dv) > 2, lai = l => Math.abs(l.dv) < 0.5;
const out = [`Bande du dessus ±${o.bande} mm à la pose finale, points visibles, 25 points au moins. Rails : ${L.length}.`,
  `Pente du dessus le long de la voie, |mm par m| : médiane ${r1(med(L.map(l => Math.abs(l.m.b))))}, q90 ${r1(q(L.map(l => Math.abs(l.m.b)), .9))}, max ${r1(Math.max(...L.map(l => Math.abs(l.m.b))))}. Épaisseur q90 − q10 : brute ${r1(med(L.map(l => l.m.ep0)))}, pente retirée ${r1(med(L.map(l => l.m.ep)))}.`, '',
  tab('Rails RETOUCHÉS en hauteur (> 2 mm)', ret), '', tab('Rails RETOUCHÉS en hauteur, pente forte (|pente| ≥ 15 mm par m)', l => ret(l) && Math.abs(l.m.b) >= 15), '',
  tab('Rails RETOUCHÉS en hauteur, pente faible (< 15 mm par m)', l => ret(l) && Math.abs(l.m.b) < 15), '', tab('Rails LAISSÉS en hauteur (< 0,5 mm)', lai), '',
  tab('Rails LAISSÉS, pente forte', l => lai(l) && Math.abs(l.m.b) >= 15), ''];
process.stdout.write(out.join('\n') + '\n');
