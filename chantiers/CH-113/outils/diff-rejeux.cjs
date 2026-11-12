/* CH-113 — différence cut par cut entre deux rejeux du banc (même lot), jugée contre la vérité d'Écho.
 *   node chantiers/CH-113/outils/diff-rejeux.cjs AVANT.jsonl APRES.jsonl VERITE.json [profil=L1-se]
 * Pour chaque cut changé : état avant / après, écart à l'opérateur (pire rail, 3D, mm), voie choisie (décalage latéral de chaque rail depuis la
 * pose de départ, mm) et écart à la pose de départ (pire rail, 3D, mm). Aucune coordonnée absolue. */
'use strict';
const fs = require('fs'); const [fa, fb, fv, p = 'L1-se'] = process.argv.slice(2);
const lire = f => new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut').map(x => [x.cut, x]));
const A = lire(fa), B = lire(fb), V0 = JSON.parse(fs.readFileSync(fv, 'utf8')), V = V0.verite || V0;
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), z = [0, 0, 0];
const ec = (dc, m) => m ? Math.max(d(dc.left, m.left), d(dc.right, m.right)) : null;
const etat = (l) => { const x = l.profils[p]; return x && x.etat === 'pose' && x.decal ? x : null; };
const c = { pose: 0, retire: 0, deplace: 0, juste: 0, '10-50': 0, 'plus-50': 0, nonJuge: 0, degrade: 0 };
for (const [cut, a] of A) {
  const b = B.get(cut); if (!b) continue; const xa = etat(a), xb = etat(b); const mic = V[cut] && V[cut].mic;
  if (!xa && !xb) continue;
  if (xa && xb && Math.max(d(xa.decal.left, xb.decal.left), d(xa.decal.right, xb.decal.right)) <= 1) continue;
  const ea = xa ? ec(xa.decal, mic) : null, eb = xb ? ec(xb.decal, mic) : null;
  const kind = !xa ? 'POSÉ' : !xb ? 'RETIRÉ' : 'DÉPLACÉ'; c[{ 'POSÉ': 'pose', 'RETIRÉ': 'retire', 'DÉPLACÉ': 'deplace' }[kind]]++;
  if (xb) { if (eb == null) c.nonJuge++; else c[eb <= 10 ? 'juste' : eb <= 50 ? '10-50' : 'plus-50']++; if (ea != null && eb != null && ea <= 10 && eb > 20) c.degrade++; }
  const voie = xb ? `voie G ${xb.decal.left[1].toFixed(0)} D ${xb.decal.right[1].toFixed(0)} mm, départ ${Math.max(d(xb.decal.left, z), d(xb.decal.right, z)).toFixed(0)} mm` : '';
  console.log(`${cut} ${a.zone || ''} ${kind} : avant ${xa ? (ea == null ? 'posé non jugé' : ea.toFixed(1) + ' mm') : 'différé'} → après ${xb ? (eb == null ? 'posé non jugé' : eb.toFixed(1) + ' mm') + ' (' + (xb.etage || xb.source) + '/' + (xb.motif || xb.source || '') + ')' : 'différé'} ${voie}`);
}
console.log(JSON.stringify(c));
