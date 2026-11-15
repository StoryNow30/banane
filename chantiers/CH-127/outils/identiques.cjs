#!/usr/bin/env node
'use strict';
/* CH-126 : deux rejeux du banc identiques cut par cut ? (éteint = N). Hors ligne, lecture seule.
 *   node chantiers/CH-126/outils/identiques.cjs DOSSIER_A DOSSIER_B [--profil L1-se]
 * DOSSIER : un dossier de rejeux du banc (rejeux/<nom>/ ou garde/<nom>/), fichiers *.jsonl appariés par nom.
 * Compare, pour chaque cut, la ligne entière du rejeu (tous les profils, ou le seul profil demandé), sans les champs de durée (ms, chrono, temps).
 * Sortie : par fichier, cuts comparés, identiques, différents (les 10 premiers listés), cuts présents d'un seul côté. */
const fs = require('node:fs'), path = require('node:path');
const a = process.argv.slice(2), dirs = a.filter(x => !x.startsWith('--')), iP = a.indexOf('--profil'), profil = iP >= 0 ? a[iP + 1] : null;
if (dirs.length < 2) throw Error('usage : identiques.cjs A B [--profil P]');
const [A, B] = dirs.filter(d => d !== profil);
const DUREE = /^(ms|chrono|temps|duree.*|.*Ms$|t0|horodatage)$/;
const net = v => Array.isArray(v) ? v.map(net) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => !DUREE.test(k)).map(k => [k, net(v[k])])) : v;
const lire = f => new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut').map(x => [x.cut, x]));
let tC = 0, tI = 0, tD = 0, tS = 0; const L = [];
for (const f of fs.readdirSync(A).filter(x => x.endsWith('.jsonl')).sort()) {
  const fb = path.join(B, f); if (!fs.existsSync(fb)) { L.push(`${f} : absent de B`); continue; }
  const X = lire(path.join(A, f)), Y = lire(fb); let c = 0, i = 0; const d = []; let seul = 0;
  for (const [cut, x] of X) { const y = Y.get(cut); if (!y) { seul++; continue; } c++;
    const kx = JSON.stringify(net(profil ? (x.profils || {})[profil] : x)), ky = JSON.stringify(net(profil ? (y.profils || {})[profil] : y));
    if (kx === ky) i++; else d.push(cut); }
  for (const cut of Y.keys()) if (!X.has(cut)) seul++;
  tC += c; tI += i; tD += d.length; tS += seul;
  L.push(`${f} : ${c} comparés, ${i} identiques, ${d.length} différents${d.length ? ' (' + d.slice(0, 10).join(', ') + (d.length > 10 ? ', …' : '') + ')' : ''}${seul ? `, ${seul} d'un seul côté` : ''}`);
}
L.push(`TOTAL : ${tC} comparés, ${tI} identiques, ${tD} différents, ${tS} d'un seul côté`);
process.stdout.write(L.join('\n') + '\n');
