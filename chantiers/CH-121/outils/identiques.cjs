#!/usr/bin/env node
'use strict';
/* CH-121 : deux rejeux du banc identiques, cut par cut (profil L1-se : état, source, étage, pose, motif ; temps de calcul exclus).
 *   node chantiers/CH-121/outils/identiques.cjs NOM_A NOM_B */
const fs = require('node:fs'), path = require('node:path');
const { LOTS, cle, travail } = require(path.join(__dirname, '../../CH-116/outils/lots.cjs'));
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut');
const net = p => p ? JSON.stringify({ e: p.etat, s: p.source, g: p.etage, d: p.decal, m: p.motif ?? null, l: p.l1 ? { e: p.l1.etat, m: p.l1.motif } : null }) : null;
let n = 0, id = 0; const diff = [];
for (const e of LOTS) { const k = cle(e), A = lire(path.join(travail(), 'rejeux', process.argv[2], k + '.jsonl')), B = new Map(lire(path.join(travail(), 'rejeux', process.argv[3], k + '.jsonl')).map(x => [x.cut, x]));
  for (const a of A) { n++; const b = B.get(a.cut); if (b && net(a.profils['L1-se']) === net(b.profils['L1-se'])) id++; else diff.push(`${k}/${a.cut}`); } }
console.log(`${id} / ${n} cuts identiques${diff.length ? ' ; différents : ' + diff.slice(0, 30).join(' ') : ''}`);
