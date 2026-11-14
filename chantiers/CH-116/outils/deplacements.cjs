#!/usr/bin/env node
'use strict';
/* CH-116 : différences cut par cut entre deux rejeux du banc (sans vérité). Hors ligne.
 *   node chantiers/CH-116/outils/deplacements.cjs --a livre --b N [--lots 1211v,1312v] [--seuil 0.5]
 * Par lot : cuts identiques (état, étage, source, raison, décalages, sort réel), changements d'état, poses déplacées de plus de `seuil` mm
 * (pire rail, 3D) : combien, médiane, le pire ; liste des changements d'état et des 10 plus gros déplacements. */
const fs = require('node:fs'), path = require('node:path');
const { LOTS, cle, travail } = require('./lots.cjs');
const a = process.argv.slice(2), o = { seuil: 0.5, lots: null };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--a') o.a = v(); else if (k === '--b') o.b = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--seuil') o.seuil = Number(v()); else throw Error('option inconnue ' + k); }
if (!o.a || !o.b) throw Error('--a REF --b REJEU');
const lire = (n, e) => { const f = path.join(travail(), 'rejeux', n, cle(e) + '.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut') : null; };
const pire = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(...[0, 1, 2].map(i => p[s][i] - q[s][i]))));
const sig = x => JSON.stringify([x.etat, x.etage, x.source, x.raison, x.decal]);
const parLot = {};
for (const e of LOTS) {
  if (o.lots ? !o.lots.includes(e.lot) : e.vierge) continue;
  const A = lire(o.a, e), B = lire(o.b, e); if (!A || !B) continue;
  const t = (parLot[e.lot] = parLot[e.lot] || { cuts: 0, identiques: 0, etats: [], depl: [] });
  const mB = new Map(B.map(l => [l.cut, l]));
  for (const la of A) {
    const lb = mB.get(la.cut); t.cuts++;
    if (!lb) { t.etats.push(`${e.partie}/${la.cut} absent`); continue; }
    const x = la.profils['L1-se'], y = lb.profils['L1-se'];
    if (sig(x) === sig(y) && JSON.stringify(la.reel) === JSON.stringify(lb.reel)) { t.identiques++; continue; }
    if (x.etat !== y.etat) { t.etats.push(`${e.partie}/${la.cut} ${x.etat}→${y.etat}`); continue; }
    if (x.decal && y.decal) { const d = pire(x.decal, y.decal); if (d > o.seuil) t.depl.push({ id: `${e.partie}/${la.cut}`, d }); }
  }
}
const med = v => { if (!v.length) return null; const s = v.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const out = [`« ${o.b} » contre « ${o.a} »`, '', `| lot | cuts | identiques | changements d'état | poses déplacées > ${o.seuil} mm | médiane (mm) | pire (mm) |`, '|---|---|---|---|---|---|---|'];
for (const [l, t] of Object.entries(parLot)) {
  const d = t.depl.map(x => x.d), w = t.depl.slice().sort((p, q) => q.d - p.d);
  out.push(`| ${l} | ${t.cuts} | ${t.identiques} | ${t.etats.length} | ${d.length} | ${d.length ? med(d).toFixed(1) : '-'} | ${w.length ? w[0].d.toFixed(1) + ' (' + w[0].id + ')' : '-'} |`);
}
for (const [l, t] of Object.entries(parLot)) {
  if (t.etats.length) out.push('', `${l}, changements d'état : ${t.etats.join(' ; ')}`);
  if (t.depl.length) out.push('', `${l}, plus gros déplacements : ${t.depl.slice().sort((p, q) => q.d - p.d).slice(0, 10).map(x => `${x.id} ${x.d.toFixed(1)}`).join(' ; ')}`);
}
process.stdout.write(out.join('\n') + '\n');
