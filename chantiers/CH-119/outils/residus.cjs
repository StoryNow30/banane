'use strict';
/* CH-119 : loi des résidus d'ordre 2 de la VÉRITÉ (poses finales de l'opérateur) le long des zones, par écart en cuts. Hors ligne.
 * Pour trois cuts jugés q < p < o d'un même lot-partie (écarts ≤ 8), tous trois lus dans le repère de o : résidu latéral (pire rail) de o
 * contre la droite (q, p) prolongée. Et, pour comparaison, le même résidu de la pose FAUSSE (> 50 mm) de o contre la droite de vérité (q, p). */
const Z = require('./zones.cjs');
const SIDES = Z.SIDES;
const lots = Z.charger(process.argv[2] || 'pool');
const parG = {}, faux = {};
for (const L of lots) {
  const cs = L.cuts.filter(c => c.verite && c.geo).sort((a, b) => a.cut - b.cut);
  for (let k = 2; k < cs.length; k++) {
    const o = cs[k];
    for (let j = k - 1; j >= 1 && o.cut - cs[j].cut <= 8; j--) for (let i = j - 1; i >= 0 && cs[j].cut - cs[i].cut <= 8; i--) {
      const p = cs[j], q = cs[i];
      const lit = (c, d) => { const r = {}; for (const s of SIDES) r[s] = Z.enRepere(o, c, s, d[s]); return r; };
      const Q = lit(q, q.verite), Pp = lit(p, p.verite), O = lit(o, o.verite);
      const AGG = process.env.AGG === "min" ? Math.min : Math.max;
      const res = D => AGG(...SIDES.map(s => { const dx1 = Pp[s][0] - Q[s][0], dx2 = D[s][0] - Pp[s][0]; return Math.abs(D[s][1] - (Pp[s][1] + (Pp[s][1] - Q[s][1]) * dx2 / dx1)); }));
      const g = o.cut - p.cut, g1 = p.cut - q.cut, key = `${g}`;
      if (process.env.G1MAX && g1 > +process.env.G1MAX) continue;
      (parG[key] = parG[key] || []).push({ r: res(O), g1, zone: o.zone });
      if (o.decal && Math.max(Z.d3(o.decal.left, o.verite.left), Z.d3(o.decal.right, o.verite.right)) > 50) (faux[key] = faux[key] || []).push(res(lit(o, o.decal)));
      break; /* un seul q (le plus proche) par (p, o) */
    }
  }
}
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))] : null; };
console.log('| écart g | n vérité | médiane | q90 | q99 | max | n vérité ADV | q99 ADV | max ADV | résidus des poses fausses (min, médiane) |\n|---|---|---|---|---|---|---|---|---|---|');
for (const g of Object.keys(parG).sort((a, b) => a - b)) {
  const a = parG[g].map(x => x.r), adv = parG[g].filter(x => x.zone === 'adv').map(x => x.r), f = faux[g] || [];
  console.log(`| ${g} | ${a.length} | ${q(a, .5).toFixed(1)} | ${q(a, .9).toFixed(1)} | ${q(a, .99).toFixed(1)} | ${Math.max(...a).toFixed(1)} | ${adv.length} | ${adv.length ? q(adv, .99).toFixed(1) : '-'} | ${adv.length ? Math.max(...adv).toFixed(1) : '-'} | ${f.length ? Math.min(...f).toFixed(0) + ', ' + q(f, .5).toFixed(0) + ' (' + f.length + ')' : '-'} |`);
}
