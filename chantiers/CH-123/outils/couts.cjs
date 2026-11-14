#!/usr/bin/env node
'use strict';
/* CH-123 : coût standard du banc de CH-116 par réglage et par lot, et détail du choix « un lot dehors » (quel réglage est choisi sur les autres
 * lots, avec quels coûts, et ce qu'il coûte sur le lot tenu à l'écart). Lecture seule des rejeux du banc ; même juge et mêmes poids que `banc.cjs croise`.
 *   CH116_TRAVAIL=… node chantiers/CH-123/outils/couts.cjs --noms livre,a,b [--ref livre] [--examen 0511] */
const path = require('node:path');
const B = require(path.join(__dirname, '..', '..', 'CH-116', 'outils', 'banc.cjs')), { LOTS } = require(path.join(__dirname, '..', '..', 'CH-116', 'outils', 'lots.cjs'));
const a = process.argv.slice(2), o = { noms: [], ref: 'livre', examen: null };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--noms') o.noms = v().split(','); else if (k === '--ref') o.ref = v(); else if (k === '--examen') o.examen = v().split(','); else throw Error('option inconnue ' + k); }
if (!o.noms.length) throw Error('--noms livre,a,b');
const lots = [...new Set(LOTS.filter(e => !e.vierge).map(e => e.lot))], examen = o.examen || [...new Set(LOTS.filter(e => e.examen && !e.vierge).map(e => e.lot))], R = lots.filter(l => !examen.includes(l));
const J = Object.fromEntries(o.noms.map(n => [n, B.juger(n, { lots: null })])), c = (n, l) => B.cout(J[n].parLot[l], B.POIDS), s = (n, k, L) => L.reduce((x, l) => x + J[n].parLot[l][k], 0);
const out = [`# Coût standard du banc (${JSON.stringify(B.POIDS)}) : ${o.noms.join(', ')}`, '', `| réglage | ${R.join(' | ')} | somme des ${R.length} lots réglables | examen ${examen.join(', ')} |`, `|---|${R.map(() => '---|').join('')}---|---|`];
for (const n of o.noms) out.push(`| ${n} | ${R.map(l => c(n, l)).join(' | ')} | ${R.reduce((x, l) => x + c(n, l), 0)} | ${examen.reduce((x, l) => x + c(n, l), 0)} |`);
out.push('', '| réglage, lots réglables | ≤ 10 | 10–50 | > 50 | différés | reposés justes / faux | bons bloqués |', '|---|---|---|---|---|---|---|');
for (const n of o.noms) out.push(`| ${n} | ${s(n, 'juste', R)} | ${s(n, '10-50', R)} | ${s(n, 'plus-50', R)} | ${s(n, 'differes', R)} | ${s(n, 'reposesJustes', R)} / ${s(n, 'reposesFaux', R)} | ${s(n, 'bonsBloques', R)} |`);
out.push('', '## Un lot dehors', '', '| lot tenu à l\'écart | coûts sur les autres lots | choisi | coût sur le lot | coût de la référence |', '|---|---|---|---|---|');
let tot = 0, totRef = 0;
for (const l of R) { const autres = R.filter(x => x !== l), ch = o.noms.map(n => ({ n, c: autres.reduce((x, y) => x + c(n, y), 0) })).sort((p, q) => p.c - q.c); tot += c(ch[0].n, l); totRef += c(o.ref, l);
  out.push(`| ${l} | ${ch.map(x => `${x.n} ${x.c}`).join(', ')} | ${ch[0].n} | ${c(ch[0].n, l)} | ${c(o.ref, l)} |`); }
out.push(`| **somme** | | | **${tot}** | **${totRef}** |`);
process.stdout.write(out.join('\n') + '\n');
