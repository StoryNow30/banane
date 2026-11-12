/* CH-113 — fidélité d'un rejeu du banc : profil (L1-se par défaut) contre le sort RÉEL du lot, cut par cut.
 *   node chantiers/CH-113/outils/fidelite.cjs R.jsonl [profil]
 * Décision identique = même état (posé / non posé) ; pose identique = décision identique et pire rail à 1 mm au plus (3D, repère profil). */
'use strict';
const fs = require('fs'); const [f, p = 'L1-se'] = process.argv.slice(2);
const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut');
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let n = 0, dec = 0, poses = 0, posesId = 0; const ecarts = [];
for (const l of L) {
  n++; const r = l.reel || {}, x = (l.profils || {})[p] || {}; const rp = !!r.pose, xp = x.etat === 'pose';
  if (rp !== xp) { ecarts.push(`${l.cut}: réel ${rp ? 'posé' : 'non posé (' + (r.motif || r.etage || '') + ')'} / ${p} ${x.etat}`); continue; }
  dec++; if (!rp) continue; poses++;
  if (!r.decal || !x.decal) { ecarts.push(`${l.cut}: pose sans décalage`); continue; }
  const e = Math.max(d(r.decal.left, x.decal.left), d(r.decal.right, x.decal.right));
  if (e <= 1) posesId++; else ecarts.push(`${l.cut}: pose différente de ${e.toFixed(1)} mm (étage réel ${r.etage}, rejeu ${x.etage || x.source})`);
}
console.log(`${p} : décisions identiques ${dec}/${n} ; poses identiques à 1 mm ${posesId}/${poses}`);
for (const e of ecarts) console.log('  ' + e);
