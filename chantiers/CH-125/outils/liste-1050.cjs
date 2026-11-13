#!/usr/bin/env node
'use strict';
/* CH-125 : les posés jugés de 10 à 50 mm du rejeu livré, rail par rail, avec ce que le nuage dit à la pose livrée (hors ligne, lecture seule).
 *   node chantiers/CH-125/outils/liste-1050.cjs --rails DOSSIER --gabarit G.json [--lots …] [--seuil 10]
 * Par rail : erreur (pose finale − pose livrée, travers orienté vers le champignon et hauteur, mm), points du dessus et du flanc lus par le calage
 * livré à cette pose, centre du dessus et du flanc (médianes, mm, par rapport au gabarit posé), points chargés hors découpe. */
const R = require('./rails.cjs'), E = require('./estimateurs.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = { lots: R.LOTS_REGLABLES, seuil: 10 };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--seuil') o.seuil = Number(v()); else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), rails = R.lire(o.rails, { lots: o.lots }), r1 = v => v == null || !Number.isFinite(v) ? '-' : Math.round(v * 10) / 10, med = N.mediane;
const C = new Map();
for (const r of rails) { const k = `${r.lot} ${r.partie}/${r.cut}`; if (!C.has(k)) C.set(k, []); C.get(k).push(r); }
console.log('lot partie/cut | zone | source/étage | pire rail mm | par rail : côté, erreur [travers, hauteur], dessus n / centre / q90, flanc n / centre ; avec les points chargés : dessus n, flanc n / centre');
let n = 0;
for (const [k, rs] of C) {
  const e = rs.map(r => [(r.finale[0] - r.livre[0]) * 1000, (r.finale[1] - r.livre[1]) * 1000]), mm = Math.round(Math.max(...e.map(x => Math.hypot(x[0], x[1]))) * 10) / 10;
  if (!(mm > o.seuil && mm <= 50)) continue; n++;
  const d = rs.map((r, i) => { const B = E.bandes(r.pts, gab, r.livre, { origines: [0], xMax: 0.25 }), B2 = E.bandes(r.pts, gab, r.livre, { origines: [0, 1], xMax: 0.5 });
    const t = B.top.map(p => p.r), f = B.face.map(p => p.r), f2 = B2.face.map(p => p.r);
    return `${r.cote[0]} [${r1(e[i][0])}, ${r1(e[i][1])}] dessus ${t.length}/${r1(t.length ? med(t) : null)}/${r1(t.length ? N.quantile(t, .9) : null)} flanc ${f.length}/${r1(f.length ? med(f) : null)} ; chargés ${B2.top.length}, ${f2.length}/${r1(f2.length ? med(f2) : null)}`; });
  console.log(`${k} | ${rs[0].zone} | ${rs[0].source}${rs[0].passe ? '-passe' : ''}/${rs[0].etage} | ${mm} | ${d.join(' || ')}`);
}
console.log(`${n} cuts de ${o.seuil} à 50 mm`);
