#!/usr/bin/env node
'use strict';
/* CH-116 : refus d'un levier de refus (source donnée, ex. `ancre` de CH-124), jugés contre la vérité du corpus. Hors ligne.
 *   node chantiers/CH-116/outils/refus.cjs --a REF --b REJEU --lot L --corpus C.jsonl [--source ancre]
 * Pour chaque cut que REJEU diffère avec cette source : la pose refusée (`decalRefuse`) contre la pose finale de l'opérateur (pire rail, 3D) :
 * vraie correction (> 50 mm), entre 10 et 50, vraie faute (≤ 10 mm), non jugé. Puis les décisions d'état changées HORS des cuts refusés, et l'état de l'en-tête. */
const fs = require('node:fs'), path = require('node:path');
const { LOTS, cle, travail } = require('./lots.cjs');
const a = process.argv.slice(2), o = { source: 'ancre' };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--a') o.a = v(); else if (k === '--b') o.b = v(); else if (k === '--lot') o.lot = v(); else if (k === '--corpus') o.corpus = v(); else if (k === '--source') o.source = v(); else throw Error('option inconnue ' + k); }
const C = new Map(fs.readFileSync(o.corpus, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).map(c => [`${c.partie}/${c.cut}`, c]));
const dist = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(...[0, 1, 2].map(i => p[s][i] - q[s][i]))));
const lire = (n, e) => fs.readFileSync(path.join(travail(), 'rejeux', n, cle(e) + '.jsonl'), 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const out = [], cat = { correction: [], entre: [], faute: [], nonJuge: [] }, hors = [], entetes = [];
for (const e of LOTS.filter(x => x.lot === o.lot)) {
  const A = new Map(lire(o.a, e).filter(x => x.type === 'cut').map(l => [l.cut, l])), LB = lire(o.b, e), h = LB.find(x => x.type === 'entete');
  const an = h && (h[o.source] || (h.l1e && h.l1e[o.source]));
  entetes.push(`p${e.partie} : ${an ? `actif ${an.actif}${an.raison ? ', raison ' + an.raison : ''}` : 'en-tête sans ' + o.source}`);
  for (const l of LB.filter(x => x.type === 'cut')) {
    const y = l.profils['L1-se'], x = A.get(l.cut) && A.get(l.cut).profils['L1-se'], id = `${e.partie}/${l.cut}`;
    if (y && y.source === o.source && y.etat === 'differe') {
      const c = C.get(id), j = c && c.poseFinale && !c.exclu && y.decalRefuse ? dist(y.decalRefuse, c.poseFinale) : null;
      const t = `${id} (${y.origine || '?'}, ${y[o.source] && y[o.source].ecartMm != null ? 'écart à l\'axe ' + y[o.source].ecartMm + ' mm' : ''}${j != null ? ', pose refusée à ' + j.toFixed(1) + ' mm de la pose finale' : ''})`;
      (j == null ? cat.nonJuge : j > 50 ? cat.correction : j <= 10 ? cat.faute : cat.entre).push(t);
      continue;
    }
    if (x && y && x.etat !== y.etat) hors.push(`${id} ${x.etat}→${y.etat}`);
  }
}
out.push(`Refus « ${o.source} » de ${o.b} contre ${o.a}, lot ${o.lot}`, `En-têtes : ${entetes.join(' ; ')}`,
  `Refus : ${cat.correction.length + cat.entre.length + cat.faute.length + cat.nonJuge.length} ; vraies corrections (> 50 mm) ${cat.correction.length} ; 10-50 ${cat.entre.length} ; vraies fautes (≤ 10 mm) ${cat.faute.length} ; non jugés ${cat.nonJuge.length}`);
for (const [k, v] of Object.entries(cat)) if (v.length) out.push(`  ${k} : ${v.join(' ; ')}`);
out.push(`Décisions d'état changées hors des cuts refusés : ${hors.length}${hors.length ? ' (' + hors.join(', ') + ')' : ''}`);
process.stdout.write(out.join('\n') + '\n');
