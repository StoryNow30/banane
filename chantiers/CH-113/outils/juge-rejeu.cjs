/* CH-113 — juge d'un rejeu du banc (tools/banc-differes.cjs rejouer) contre une vérité d'Écho (tools/garde-gcv2.cjs verite).
 * Hors ligne, lecture seule. Une seule définition (celle de tools/juge-poses-faux.cjs) : écart = pire des deux rails, distance 3D (mm)
 * entre la pose et la pose finale de l'opérateur, dans le repère profil de la pose de départ du lot ; juste ≤ 10 mm ; mauvaise voie > 50 mm.
 * Le sort RÉEL du lot (`reel`) est jugé avec la même vérité, à côté de chaque profil (fidélité du rejeu).
 *
 *   node chantiers/CH-113/outils/juge-rejeu.cjs --rejeu R.jsonl --verite V.json [--rejeu … --verite …] [--profils reel,L1-se] [--plages a-b,c-d]
 *        [--csv par-cut.csv] [--json resume.json]
 * Sortie : des comptes, des millimètres, des numéros de cut. Aucune coordonnée absolue. */
'use strict';
const fs = require('fs');
const args = process.argv.slice(2), rejeux = [], verites = []; let profils = ['reel', 'L1-se'], csv = null, json = null, plages = null;
for (let i = 0; i < args.length; i++) {
  const k = args[i], v = () => args[++i];
  if (k === '--rejeu') rejeux.push(v()); else if (k === '--verite') verites.push(v()); else if (k === '--profils') profils = v().split(',');
  else if (k === '--csv') csv = v(); else if (k === '--json') json = v(); else if (k === '--plages') plages = v().split(',').map(s => s.split('-').map(Number));
  else throw Error('option inconnue ' + k);
}
if (!rejeux.length || rejeux.length !== verites.length) throw Error('--rejeu R --verite V (autant de chaque)');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ecart = (decal, mic) => Math.max(dist(decal.left, mic.left), dist(decal.right, mic.right));
const classe = e => e == null ? 'non-juge' : e <= 10 ? 'juste' : e <= 50 ? '10-50' : 'plus-50';
function poseDe(l, p) {
  if (p === 'reel') return l.reel && l.reel.pose && l.reel.decal ? { decal: l.reel.decal, etage: l.reel.etage } : null;
  const x = l.profils && l.profils[p];
  if (!x || x.etat !== 'pose' || !x.decal) return null;
  return { decal: x.decal, etage: x.etage || x.source, passe: !!(x.passe2 && x.passe2.passe) };
}
const lignesCsv = [['partie', 'cut', 'zone', 'points', 'verite', ...profils.flatMap(p => [p + '_etat', p + '_mm', p + '_etage'])].join(';')];
const resume = {};
for (let k = 0; k < rejeux.length; k++) {
  const L = fs.readFileSync(rejeux[k], 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
  const V = JSON.parse(fs.readFileSync(verites[k], 'utf8')); const ver = V.verite || V;
  const ent = L.find(l => l.type === 'entete'); const partie = ent ? ent.partie : rejeux[k];
  for (const l of L.filter(x => x.type === 'cut')) {
    if (plages && !plages.some(([a, b]) => l.cut >= a && l.cut <= b)) continue;
    const v = ver[l.cut]; const mic = v && v.mic;
    const row = [partie, l.cut, l.zone || '', l.points == null ? '' : l.points, mic ? 'oui' : 'non'];
    for (const p of profils) {
      const r = (resume[p] = resume[p] || { cuts: 0, poses: 0, differes: 0, differesJuges: 0, juste: 0, '10-50': 0, 'plus-50': 0, 'non-juge': 0, liste50: [], liste10: [] });
      r.cuts++;
      const po = poseDe(l, p);
      if (!po) { r.differes++; if (mic) r.differesJuges++; row.push('differe', '', ''); continue; }
      r.poses++;
      const e = mic ? ecart(po.decal, mic) : null, c = classe(e); r[c]++;
      if (c === 'plus-50') r.liste50.push(`${partie}/${l.cut}`); if (c === '10-50') r.liste10.push(`${partie}/${l.cut}`);
      row.push('pose', e == null ? '' : e.toFixed(1), po.etage || '');
    }
    lignesCsv.push(row.join(';'));
  }
}
for (const p of profils) {
  const r = resume[p]; const j = r.juste + r['10-50'] + r['plus-50'];
  console.log(`${p.padEnd(8)} cuts ${r.cuts} · posés ${r.poses} (jugés ${j} : ≤10 ${r.juste}, 10-50 ${r['10-50']}, >50 ${r['plus-50']}, non jugés ${r['non-juge']}) · différés ${r.differes} (avec vérité ${r.differesJuges})`);
  if (r.liste50.length) console.log(`         > 50 mm : ${r.liste50.join(' ')}`);
  if (r.liste10.length) console.log(`         10-50 mm : ${r.liste10.join(' ')}`);
}
if (csv) fs.writeFileSync(csv, lignesCsv.join('\n') + '\n');
if (json) fs.writeFileSync(json, JSON.stringify(resume, null, 1));
