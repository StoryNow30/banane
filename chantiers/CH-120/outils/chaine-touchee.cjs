#!/usr/bin/env node
'use strict';
/* CH-120 : poses de la CHAÎNE (source « lot » ou « l1s-… » au rejeu de référence) que le rejeu change (état ou pose à plus de 0,5 mm), jugées
 * contre le corpus (pire rail 3D, pose finale). Hors ligne.   node chantiers/CH-120/outils/chaine-touchee.cjs NOM [REF=livre] */
const fs = require('node:fs'), path = require('node:path');
const T = process.env.CH116_TRAVAIL || path.join(process.env.HOME, 'ch116');
const [N, R = 'livre'] = process.argv.slice(2);
const corpus = new Map(fs.readFileSync(path.join(T, 'corpus.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse).map(c => [`${c.lot}-p${c.partie}-r${c.rang}:${c.cut}`, c]));
const lire = (n, f) => new Map(fs.readFileSync(path.join(T, 'rejeux', n, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(o => o.type === 'cut').map(o => [o.cut, o.profils['L1-se']]));
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), pire = (p, q) => Math.max(d3(p.left, q.left), d3(p.right, q.right));
let n = 0, ch = 0; const out = [];
for (const f of fs.readdirSync(path.join(T, 'rejeux', R)).filter(f => f.endsWith('.jsonl'))) {
  const a = lire(R, f), b = lire(N, f), k = f.replace('.jsonl', '');
  for (const [cut, p] of a) {
    if (!(p.etat === 'pose' && (p.source === 'lot' || String(p.source).startsWith('l1s')))) continue;
    n++; const q = b.get(cut);
    const meme = q && q.etat === 'pose' && q.decal && pire(p.decal, q.decal) <= 0.5;
    if (meme) continue; ch++;
    const c = corpus.get(`${k}:${cut}`), v = c && c.poseFinale && c.classe !== 'non-juge' && !c.exclu ? c.poseFinale : null;
    const e = x => x && x.etat === 'pose' && x.decal && v ? Math.round(pire(x.decal, v) * 10) / 10 : null;
    out.push(`${k} ${cut} : ${p.source} ${e(p) ?? 'non jugé'} mm → ${q ? q.etat + '/' + q.source : 'absent'} ${e(q) ?? ''}`);
  }
}
console.log(`${N} contre ${R} : poses de la chaîne ${n}, changées ${ch}`); for (const l of out) console.log('  ' + l);
