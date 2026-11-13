#!/usr/bin/env node
'use strict';
/* CH-121 : profil latéral des points autour d'un rail posé (exploration). Pour chaque cut demandé : histogramme en u (pas de 2 mm, −40 à +100 mm,
 * u = 0 au flanc côté voie du gabarit posé) des points du dessus (|z| < 12 mm du dessus) et des points de flanc (z de −34 à −9 mm). Erreur de l'opérateur rappelée.
 *   node chantiers/CH-121/outils/profil-lateral.cjs CACHE.json cle:cut:cote … */
const fs = require('node:fs'), path = require('node:path');
const C = require(path.join(__dirname, '../../../vendor/capture-core.js'));
const Conv = require(path.join(__dirname, '../../../src/placement-convention.js'));
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const req of process.argv.slice(3)) {
  const [k, cut, s] = req.split(':'), it = items.find(x => x.cle === k && x.cut === +cut); if (!it) { console.log(req, 'absent'); continue; }
  const rail = it.capture.rails[s], t = Conv.template(rail), d = it.decal[s];
  const bu = t.sign * d[1] / 1000, bz = d[2] / 1000, H = {}, F = {};
  for (const p of it.capture.pointsSceneRelative) { const q = C.point(rail.sceneRelativeToProfileLocal, p); if (Math.abs(q[0]) > .5) continue;
    const lu = (t.sign * q[1] - bu) * 1000, lz = (q[2] - bz) * 1000; if (lu < -40 || lu > 100) continue; const b = 2 * Math.floor(lu / 2);
    if (Math.abs(lz) < 12) H[b] = (H[b] || 0) + 1; else if (lz < -9 && lz > -34) F[b] = (F[b] || 0) + 1; }
  const err = it.finale ? [0, 1, 2].map(i => Math.round((it.finale[s][i] - d[i]) * 10) / 10) : null;
  console.log(`${req} largeur ${Math.round(t.width * 1000)} mm ; erreur opérateur lat ${err && Math.round(t.sign * err[1] * 10) / 10} (en u), vert ${err && err[2]}`);
  let l1 = '', l2 = '', l3 = ''; for (let b = -40; b < 100; b += 2) { l1 += (b % 10 === 0 ? String(b).padStart(4) : '').padEnd(b % 10 === 0 ? 4 : 0); }
  const c = n => !n ? '.' : n < 3 ? ':' : n < 8 ? '+' : '#';
  for (let b = -40; b < 100; b += 2) { l2 += c(H[b]); l3 += c(F[b]); }
  console.log('  dessus ' + l2 + '\n  flanc  ' + l3);
}
