#!/usr/bin/env node
'use strict';
/* CH-121 : lecture de mesure.cjs. Par source de pose : erreur par rail (lat, vert) contre ce que propose le calage refait à la pose (duConv, dzConv).
 *   node chantiers/CH-121/outils/lire-mesure.cjs M.jsonl */
const fs = require('node:fs');
const L = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const grp = new Map();
for (const l of L) { if (l.pire == null || l.pire > 50) continue; const k = `${l.source}/${l.etage}`; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(l); }
console.log('| source/étage | posés | ≤10 | rails | |err lat| méd | |err vert| méd | |lat − sign·duConv| méd | |vert − dzConv| méd | rails duConv nul (faceN<6) |');
for (const [k, ls] of grp) {
  const rails = ls.flatMap(l => ['left', 'right'].map(s => l.rails[s])).filter(r => r.nuage && r.nuage.ok);
  const lat = rails.map(r => Math.abs(r.err[1])), ver = rails.map(r => Math.abs(r.err[2]));
  const rl = rails.filter(r => r.nuage.duConv != null).map(r => Math.abs(r.err[1] - r.nuage.sign * r.nuage.duConv));
  const rv = rails.filter(r => r.nuage.topN >= 15).map(r => Math.abs(r.err[2] - r.nuage.dzConv));
  console.log(`| ${k} | ${ls.length} | ${ls.filter(l => l.pire <= 10).length} | ${rails.length} | ${r1(med(lat))} | ${r1(med(ver))} | ${r1(med(rl))} | ${r1(med(rv))} | ${rails.filter(r => r.nuage.duConv == null).length} |`);
}
/* Les posés de 10 à 50 mm : le calage refait les ramènerait-il ? */
console.log('\nPosés de 10 à 50 mm : pire rail, erreur [lat, vert], calage refait [sign·du, dz], points dessus/flanc');
for (const l of L.filter(l => l.pire > 10 && l.pire <= 50)) {
  const s = ['left', 'right'].reduce((a, b) => Math.hypot(...l.rails[a].err) >= Math.hypot(...l.rails[b].err) ? a : b), r = l.rails[s], n = r.nuage || {};
  console.log(`${l.cle} ${l.cut} ${l.zone} ${l.source}/${l.etage} ${l.pire} mm ${s} err [${r.err[1]}, ${r.err[2]}] calage [${n.duConv == null ? '—' : r1(n.sign * n.duConv)}, ${n.dzConv}] ${n.topN}/${n.faceN}`);
}
