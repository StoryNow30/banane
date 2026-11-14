#!/usr/bin/env node
'use strict';
/* CH-126 : N+ contre N, cut par cut (conditions 1 et 2 de la garde, R3). Hors ligne, lecture seule.
 *   node chantiers/CH-126/outils/np-contre-n.cjs DOSSIER_N DOSSIER_NP
 * Refus de N : profil L1-se de source `ancre`. Refus de N+ : profil portant `reprise` (reposé ou resté différé).
 * Rend : refus de N, refus de N+, refus d'un seul côté (attendu 0), cuts NON refusés dont le profil L1-se diffère (attendu 0 : ricochets),
 * et, pour les refus restés différés sous N+, leur profil hors `reprise` comparé à celui de N (attendu identique). */
const fs = require('node:fs'), path = require('node:path');
const [A, B] = process.argv.slice(2); if (!A || !B) throw Error('usage : np-contre-n.cjs N NP');
const DUREE = /^(ms|chrono|temps|duree.*|.*Ms$)$/;
const net = (v, sans = null) => Array.isArray(v) ? v.map(x => net(x)) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => !DUREE.test(k) && k !== sans).map(k => [k, net(v[k])])) : v;
const lire = f => new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut').map(x => [x.cut, (x.profils || {})['L1-se']]));
let nN = 0, nP = 0, rep = 0; const seuls = [], ricochets = [], resteDiff = [];
for (const f of fs.readdirSync(A).filter(x => x.endsWith('.jsonl')).sort()) {
  const X = lire(path.join(A, f)), Y = lire(path.join(B, f)), lot = f.replace(/\.jsonl$/, '');
  for (const [cut, x] of X) { const y = Y.get(cut); if (!x || !y) continue;
    const rN = x.source === 'ancre', rP = !!y.reprise; if (rN) nN++; if (rP) nP++;
    if (rN !== rP) { seuls.push(`${lot}/${cut} (${rN ? 'N seul' : 'N+ seul'})`); continue; }
    if (rP) { if (y.reprise.etat === 'pose') rep++; else if (JSON.stringify(net(x)) !== JSON.stringify(net(y, 'reprise'))) resteDiff.push(`${lot}/${cut}`); continue; }
    if (JSON.stringify(net(x)) !== JSON.stringify(net(y))) ricochets.push(`${lot}/${cut} : ${x.etat}/${x.source} → ${y.etat}/${y.source}`);
  }
}
process.stdout.write([`Refus de N : ${nN} ; refus de N+ : ${nP} ; reposés par N+ : ${rep}`,
  `Refus d'un seul côté : ${seuls.length}${seuls.length ? ' : ' + seuls.join(' ; ') : ''}`,
  `Cuts non refusés changés (ricochets) : ${ricochets.length}${ricochets.length ? ' : ' + ricochets.join(' ; ') : ''}`,
  `Refus restés différés dont le profil (hors reprise) diffère de N : ${resteDiff.length}${resteDiff.length ? ' : ' + resteDiff.join(' ; ') : ''}`].join('\n') + '\n');
