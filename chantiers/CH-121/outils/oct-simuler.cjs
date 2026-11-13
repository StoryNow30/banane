#!/usr/bin/env node
'use strict';
/* CH-121 : simulation statique, au cut, d'une règle verticale sur les rails refusés du 14/10 p17 (garde ; jamais utilisée pour régler).
 *   node chantiers/CH-121/outils/oct-simuler.cjs OCT.jsonl RAILS.csv 'JSON règle'
 * Règle { c, dzMax, mode: 'top50'|'top90' } : rail refusé (dz > 8) → décalage vertical = top50 + c (ou top90 + 1), appliqué si |…| ≤ dzMax.
 * Erreur du rail après = (lat, vert − décalage) ; jugement du cut au pire rail, sur les cuts dont les deux rails sont jugés. */
const fs = require('node:fs');
const O = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const t = fs.readFileSync(process.argv[3], 'utf8').trim().split('\n'), h = t[0].split(';');
const R = t.slice(1).map(l => Object.fromEntries(l.split(';').map((v, i) => [h[i], v === '' || isNaN(+v) ? v : +v])));
const regle = JSON.parse(process.argv[4] || '{}');
const r1 = v => Math.round(v * 10) / 10;
const cuts = new Map();
for (const r of R) { if (!cuts.has(r.cut)) cuts.set(r.cut, {}); cuts.get(r.cut)[r.cote] = r; }
let juges = 0, av10 = 0, ap10 = 0, gagnes = 0, perdus = 0, p20 = [], deg = [], touches = 0;
for (const [cut, c] of cuts) {
  if (!c.left || !c.right) continue; juges++;
  let a = 0, b = 0, touche = false;
  for (const s of ['left', 'right']) {
    const r = c[s], o = O.find(x => x.cut === cut && x.cote === s);
    const e0 = Math.hypot(r.lat, r.vert); a = Math.max(a, r.d3 ?? e0);
    let v = r.vert;
    if (o && o.memeDz && o.refuse) { const dz = regle.mode === 'top90' ? o.top90 + 1 : o.top50 + regle.c; if (Math.abs(dz) <= regle.dzMax) { v = r.vert - dz; touche = true; } }
    b = Math.max(b, Math.hypot(r.lat, v, (r.d3 != null ? Math.sqrt(Math.max(0, r.d3 ** 2 - r.lat ** 2 - r.vert ** 2)) : 0)));
  }
  if (touche) touches++;
  if (a <= 10) av10++; if (b <= 10) ap10++; if (a > 10 && b <= 10) gagnes++; if (a <= 10 && b > 10) perdus++;
  if (b > 20 && a <= 20) p20.push(`${cut} ${r1(a)}→${r1(b)}`); if (b > a + 5) deg.push(`${cut} ${r1(a)}→${r1(b)}`);
}
console.log(`règle ${JSON.stringify(regle)} : cuts jugés ${juges}, touchés ${touches} ; ≤ 10 mm ${av10} → ${ap10} ; gagnés ${gagnes} / perdus ${perdus} ; passés au-delà de 20 mm ${p20.length} [${p20.join(', ')}] ; dégradés de plus de 5 mm ${deg.length}`);
