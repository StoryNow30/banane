#!/usr/bin/env node
'use strict';
/* CH-121 : quel estimateur de la hauteur du rail suit l'opérateur, en octobre (14/10 p17) comme en novembre (banc CH-116) ?
 *   node chantiers/CH-121/outils/estimateurs-vert.cjs OCT.jsonl MESURE.jsonl
 * Cible T = correction verticale de l'opérateur depuis la pose où les quantiles sont lus (octobre : pose brute ; novembre : pose du rejeu). */
const fs = require('node:fs');
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const r1 = v => Math.round(v * 10) / 10;
const oct = lire(process.argv[2]).filter(r => r.memeDz && r.topN >= 15).map(r => ({ era: 'oct', T: r.refuse ? r.vertOp : r.vertOp + r.dz, refuse: r.refuse, ...r }));
const nov = [];
for (const l of lire(process.argv[3])) for (const s of ['left', 'right']) { const x = l.rails[s], n = x.nuage; if (!n || !n.ok || n.topN < 15 || !x.err || l.pire > 50) continue;
  nov.push({ era: 'nov', T: x.err[2], refuse: n.dzConv > 8, top50: n.top50, top90: n.top90, topN: n.topN, faceN: n.faceN, lot: l.lot }); }
console.log(`rails : octobre ${oct.length} (refusés ${oct.filter(r => r.refuse).length}) ; novembre ${nov.length} (dz refait > 8 : ${nov.filter(r => r.refuse).length})`);
for (const [nom, f] of [['top90+1', r => r.top90 + 1], ['top50+k', r => r.top50], ['(top50+top90)/2', r => (r.top50 + r.top90) / 2]]) {
  for (const [jeu, R] of [['oct tous', oct], ['oct refusés', oct.filter(r => r.refuse)], ['nov tous', nov], ['nov dz>8', nov.filter(r => r.refuse)]]) {
    const res = R.map(r => r.T - f(r));
    console.log(`${nom.padEnd(16)} ${jeu.padEnd(12)} n=${R.length}  T − est. médiane ${r1(med(res))}  |écart| méd ${r1(med(res.map(v => Math.abs(v - med(res)))))}  T méd ${r1(med(R.map(r => r.T)))}`);
  }
}
/* Étalement du dessus (top90 − top50) par époque */
for (const [jeu, R] of [['oct', oct], ['nov', nov]]) console.log(`${jeu} : top90 − top50 médiane ${r1(med(R.map(r => r.top90 - r.top50)))} ; topN médiane ${med(R.map(r => r.topN))} ; faceN ${med(R.map(r => r.faceN))}`);
for (const [jeu, R] of [['oct refusés', oct.filter(r => r.refuse)], ['nov dz>8', nov.filter(r => r.refuse)]]) console.log(`${jeu} : top90 − top50 médiane ${r1(med(R.map(r => r.top90 - r.top50)))} ; topN ${med(R.map(r => r.topN))} ; T/(top90+1) ${r1(med(R.map(r => r.T / (r.top90 + 1))) * 100) / 100}`);
