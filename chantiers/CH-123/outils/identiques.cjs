#!/usr/bin/env node
'use strict';
/* CH-123 : deux rejeux du banc identiques cut par cut (profil L1-se : état, pose, motif, étage). Lecture seule.
 *   node chantiers/CH-123/outils/identiques.cjs DOSSIER_A DOSSIER_B */
const fs = require('node:fs'), path = require('node:path');
const [A, B] = process.argv.slice(2);
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut');
const k = o => o ? JSON.stringify([o.etat, o.decal, o.motif, o.etage]) : '';
let n = 0, d = 0; const ex = [];
for (const f of fs.readdirSync(A).filter(f => f.endsWith('.jsonl'))) {
  const b = new Map(lire(path.join(B, f)).map(x => [x.cut, x]));
  for (const x of lire(path.join(A, f))) { n++; const y = b.get(x.cut); if (k(x.profils['L1-se']) !== k(y && y.profils['L1-se'])) { d++; ex.push(f.replace('.jsonl', '') + ':' + x.cut); } }
}
console.log(`cuts ${n}, différents ${d}${d ? ' : ' + ex.slice(0, 20).join(' ') : ''}`);
process.exitCode = d ? 1 : 0;
