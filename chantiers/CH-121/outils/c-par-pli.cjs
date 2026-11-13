#!/usr/bin/env node
'use strict';
/* CH-121 : constante c de l'étage (hauteur = médiane du dessus + c) apprise PAR PLI, sur les seuls lots d'apprentissage du pli (D-352, rappel de l'intégrateur).
 * Population fixée a priori : rails posés et jugés (pire rail ≤ 50 mm) du rejeu livré dont la convention serait refusée à la pose (q90 + 1 > 8 mm, ≥ 15 points
 * de dessus) ; c = médiane de (correction verticale de l'opérateur − q50). Sortie : c par pli (lot tenu à l'écart) et pour l'examen (6 lots réglables).
 *   node chantiers/CH-121/outils/c-par-pli.cjs MESURE.jsonl */
const fs = require('node:fs');
const L = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const reglables = ['0411', '0611', '0811a', '0811b', '1111', '1211'];
const med = a => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const rails = [];
for (const l of L) { if (l.pire == null || l.pire > 50) continue; for (const s of ['left', 'right']) { const x = l.rails[s], n = x.nuage; if (!n || !n.ok || n.topN < 15 || !x.err) continue; if (n.top90 + 1 > 8) rails.push({ lot: l.lot, r: x.err[2] - n.top50 }); } }
const out = {};
for (const dehors of [...reglables, '0511']) { const appr = reglables.filter(l => l !== dehors), v = rails.filter(x => appr.includes(x.lot)).map(x => x.r); out[dehors] = { c: Math.round(med(v) * 10) / 10, n: v.length }; }
console.log(JSON.stringify(out));
