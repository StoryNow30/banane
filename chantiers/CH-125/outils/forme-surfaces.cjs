#!/usr/bin/env node
'use strict';
/* CH-125 : à la pose finale de l'opérateur, où sont les points par rapport à chaque surface du gabarit entier (dessus, congés, flancs, âme, patin) ?
 *   node chantiers/CH-125/outils/forme-surfaces.cjs --rails DOSSIER --gabarit G.json [--lots …] [--csv S.csv] [--lecture visibles|charges]
 * Par rail jugé (hors mauvaises voies) : médiane de la distance signée des points à chaque surface (mm, + = points hors de l'acier, − = points dans
 * l'acier : contour « en enveloppe »), effectif. Rails RETOUCHÉS (plus de 2 mm sur un axe) et LAISSÉS (moins de 0,5 mm sur les deux axes) à part.
 * Hors ligne, lecture seule ; comptes et millimètres. */
const fs = require('node:fs');
const R = require('./rails.cjs'), Ch = require('./champ.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = { lots: R.LOTS_REGLABLES, lecture: 'visibles' };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--csv') o.csv = v(); else if (k === '--lecture') o.lecture = v(); else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), champ = Ch.construire(gab.contour, gab.largeur), rails = R.lire(o.rails, { lots: o.lots });
const lecture = o.lecture === 'charges' ? { origines: [0, 1], xMax: 0.5 } : { origines: [0], xMax: 0.25 };
const NOMS = ['', 'dessus', 'congé voie', 'flanc voie', 'congé champ', 'flanc champ', 'âme voie', 'âme champ', 'patin voie', 'patin champ'];
const med = N.mediane, q = N.quantile, r1 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 10;
const L = [];
for (const r of rails) {
  if (r.classeLot === 'mauvaise-voie') continue;
  const S = Ch.residus(r.pts, champ, r.finale, { ...lecture, porteeMm: 12 }), S0 = Ch.residus(r.pts, champ, r.livre, { ...lecture, porteeMm: 12 });
  L.push({ r, dl: (r.finale[0] - r.livre[0]) * 1000, dv: (r.finale[1] - r.livre[1]) * 1000, fin: S.map(s => ({ n: s.length, m: s.length ? med(s.map(p => p.d)) : null })), liv: S0.map(s => ({ n: s.length, m: s.length ? med(s.map(p => p.d)) : null })) });
}
const retouche = l => Math.abs(l.dl) > 2 || Math.abs(l.dv) > 2, laisse = l => Math.abs(l.dl) < 0.5 && Math.abs(l.dv) < 0.5;
const tab = (titre, sel, quoi, nMin) => {
  const out = [titre, '| surface | rails lus | points (médiane) | q10 | q25 | médiane | q75 | q90 | étendue q75 − q25 |', '|---|---|---|---|---|---|---|---|---|'];
  for (let s = 1; s <= 9; s++) { const v = L.filter(sel).filter(l => l[quoi][s].n >= nMin).map(l => l[quoi][s].m), n = L.filter(sel).filter(l => l[quoi][s].n >= nMin).map(l => l[quoi][s].n);
    if (v.length) out.push(`| ${NOMS[s]} | ${v.length} | ${r1(med(n))} | ${r1(q(v, .1))} | ${r1(q(v, .25))} | ${r1(med(v))} | ${r1(q(v, .75))} | ${r1(q(v, .9))} | ${r1(q(v, .75) - q(v, .25))} |`); }
  return out.join('\n');
};
const dense = l => l.fin[1].n >= 80;
const out = [`Lecture « ${o.lecture} ». Rails jugés hors mauvaises voies : ${L.length} ; retouchés ${L.filter(retouche).length} ; laissés ${L.filter(laisse).length} ; nuage dense (dessus ≥ 80 points) ${L.filter(dense).length}.`, '',
  tab('Rails RETOUCHÉS, à la pose FINALE de l\'opérateur : médiane par rail de la distance des points à la surface (mm ; − = points dans l\'acier)', retouche, 'fin', 6), '',
  tab('Rails RETOUCHÉS, à la pose LIVRÉE (avant sa retouche)', retouche, 'liv', 6), '',
  tab('Rails LAISSÉS (pose livrée = pose finale)', laisse, 'fin', 6), '',
  tab('Rails RETOUCHÉS, nuage dense, pose FINALE', l => retouche(l) && dense(l), 'fin', 6), '',
  tab('Rails RETOUCHÉS, nuage clairsemé (dessus < 80 points), pose FINALE', l => retouche(l) && !dense(l), 'fin', 6), ''];
process.stdout.write(out.join('\n') + '\n');
if (o.csv) fs.writeFileSync(o.csv, ['lot;partie;cut;cote;zone;etage;source;dLat;dVert;' + NOMS.slice(1).flatMap(n => [`n ${n}`, `fin ${n}`, `liv ${n}`]).join(';'),
  ...L.map(l => [l.r.lot, l.r.partie, l.r.cut, l.r.cote, l.r.zone, l.r.etage, l.r.source, r1(l.dl), r1(l.dv), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(s => [l.fin[s].n, r1(l.fin[s].m), r1(l.liv[s].m)])].join(';'))].join('\n') + '\n');
