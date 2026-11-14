#!/usr/bin/env node
'use strict';
/* CH-116 : deux rejeux de la garde d'octobre (banc.cjs garde) comparés cut par cut, et les refus d'un levier jugés contre les vérités de la base.
 *   CH116_TRAVAIL=… node chantiers/CH-116/outils/garde-diff.cjs --a REF --b N [--source ancre]
 * Profils base et L1-se : cuts identiques (état, source, décalages), changements d'état, poses déplacées. Pour chaque cut que N diffère avec la
 * source donnée : pose refusée (`decalRefuse`) contre la vérité (pire rail, 3D) : vraie correction (> 50 mm), 10-50, vraie faute (≤ 10 mm), non jugé. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const { travail } = require('./lots.cjs');
const base = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'base-test18.json'), 'utf8'));
const a = process.argv.slice(2), o = { source: 'ancre' };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--a') o.a = v(); else if (k === '--b') o.b = v(); else if (k === '--source') o.source = v(); else throw Error('option inconnue ' + k); }
const dist = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(...[0, 1, 2].map(i => p[s][i] - q[s][i]))));
const lire = (n, l) => new Map(fs.readFileSync(path.join(travail(), 'garde', n, `r-${l}.jsonl`), 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut').map(x => [x.cut, x]));
const sig = x => x ? JSON.stringify([x.etat, x.source, x.decal || null]) : 'absent';
let cuts = 0, identiques = 0; const etats = [], deplacees = [], refus = { correction: [], entre: [], faute: [], nonJuge: [] };
for (const l of base.lots) {
  const A = lire(o.a, l.nom), B = lire(o.b, l.nom), V = JSON.parse(fs.readFileSync(path.join(RACINE, 'datasets', 'garde-gcv2', 'verites', l.verite), 'utf8'));
  for (const [cut, la] of A) {
    const lb = B.get(cut); cuts++;
    const same = lb && ['base', 'L1-se'].every(p => sig(la.profils[p]) === sig(lb.profils[p]));
    if (same) { identiques++; continue; }
    const x = la.profils['L1-se'], y = lb && lb.profils['L1-se'], id = `${l.nom} ${cut}`;
    if (y && y.source === o.source && y.etat === 'differe') {
      const mic = V[cut] && V[cut].mic, e = mic && y.decalRefuse ? dist(y.decalRefuse, mic) : null;
      const t = `${id} (${y.origine || '?'}${y[o.source] && y[o.source].ecartMm != null ? ', axe ' + y[o.source].ecartMm + ' mm' : ''}${e != null ? ', refusée à ' + e.toFixed(1) + ' mm de la vérité' : ''})`;
      (e == null ? refus.nonJuge : e > 50 ? refus.correction : e <= 10 ? refus.faute : refus.entre).push(t); continue;
    }
    if (!x || !y || x.etat !== y.etat) { etats.push(`${id} ${x ? x.etat : '—'}→${y ? y.etat : '—'}`); continue; }
    if (x.decal && y.decal) deplacees.push(`${id} ${dist(x.decal, y.decal).toFixed(2)} mm`); else etats.push(`${id} (source ${x.source}→${y.source})`);
  }
}
const nr = Object.values(refus).reduce((s, v) => s + v.length, 0);
process.stdout.write([`Garde : « ${o.b} » contre « ${o.a} » : ${identiques}/${cuts} cuts identiques (profils base et L1-se : état, source, décalages)`,
  `refus « ${o.source} » : ${nr} ; vraies corrections (> 50 mm) ${refus.correction.length} ; 10-50 ${refus.entre.length} ; vraies fautes (≤ 10 mm) ${refus.faute.length} ; non jugés ${refus.nonJuge.length}`,
  ...Object.entries(refus).filter(([, v]) => v.length).map(([k, v]) => `  ${k} : ${v.join(' ; ')}`),
  `autres changements d'état ou de source : ${etats.length}${etats.length ? ' (' + etats.join(', ') + ')' : ''}`,
  `poses déplacées : ${deplacees.length}${deplacees.length ? ' (' + deplacees.slice(0, 20).join(', ') + ')' : ''}`].join('\n') + '\n');
