#!/usr/bin/env node
'use strict';
/* CH-120 : deux rejeux du banc identiques cut par cut (profil L1-se : état, source, étage, motif de la GCV2, pose à 0,01 mm) ? Hors ligne.
 *   node chantiers/CH-120/outils/identiques.cjs NOM_A NOM_B   (dossiers $CH116_TRAVAIL/rejeux/NOM) */
const fs = require('node:fs'), path = require('node:path');
const T = process.env.CH116_TRAVAIL || path.join(process.env.HOME, 'ch116');
const [A, B] = process.argv.slice(2);
const lire = (n, f) => fs.readFileSync(path.join(T, 'rejeux', n, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(o => o.type === 'cut');
const cle = o => { const p = o.profils['L1-se'] || {}; return JSON.stringify([p.etat, p.source, p.etage ?? null, p.l1 ? p.l1.motif ?? null : null, p.decal ? ['left', 'right'].map(s => p.decal[s].map(v => Math.round(v * 100))) : null]); };
let n = 0, diff = 0; const ex = [];
for (const f of fs.readdirSync(path.join(T, 'rejeux', A)).filter(f => f.endsWith('.jsonl'))) {
  const a = lire(A, f), b = new Map(lire(B, f).map(o => [o.cut, o]));
  for (const o of a) { n++; const q = b.get(o.cut); if (!q || cle(o) !== cle(q)) { diff++; if (ex.length < 10) ex.push(`${f} ${o.cut} : ${cle(o)} ≠ ${q ? cle(q) : 'absent'}`); } }
}
console.log(`${A} contre ${B} : ${n - diff} / ${n} cuts identiques`); for (const e of ex) console.log('  ' + e);
process.exitCode = diff ? 1 : 0;
