#!/usr/bin/env node
'use strict';
/* CH-121 : validation croisée « un lot dehors » avec le coût figé (reglages/grille.json), sur les rejeux du banc de CH-116.
 *   node chantiers/CH-121/outils/croise.cjs --noms aj-A,aj-B,… [--ref livre] [--grille chantiers/CH-121/reglages/grille.json]
 * Pour chaque lot réglable : réglage de coût minimal sur les AUTRES lots réglables (égalité : moins de posés déplacés de plus de 0,5 mm contre la
 * référence sur ces lots, puis l'ordre de la liste), jugé sur ce lot. Puis examen : réglage choisi sur les 6 lots réglables, jugé sur 05/11.
 * Rend aussi, pour chaque lot jugé : justes passés au-delà de 10 mm, posés déplacés de plus de 30 mm, nouvelles mauvaises voies. */
const fs = require('node:fs'), path = require('node:path');
const B = require(path.join(__dirname, '../../CH-116/outils/banc.cjs'));
const a = process.argv.slice(2), o = { ref: 'livre', grille: path.join(__dirname, '../reglages/grille.json') };
for (let i = 0; i < a.length; i++) { if (a[i] === '--noms') o.noms = a[++i].split(','); else if (a[i] === '--ref') o.ref = a[++i]; else if (a[i] === '--grille') o.grille = a[++i]; else if (a[i] === '--json') o.json = a[++i]; else throw Error(a[i]); }
const G = JSON.parse(fs.readFileSync(o.grille, 'utf8'));
const J = Object.fromEntries([o.ref, ...o.noms].map(n => [n, B.juger(n, {})]));
const cles = r => `${r.cle}:${r.cut}`;
const refCut = new Map(J[o.ref].parCut.map(r => [cles(r), r]));
/* écarts par lot contre la référence */
const deltas = {};
const dist = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(p[s][0] - q[s][0], p[s][1] - q[s][1], p[s][2] - q[s][2])));
const lireRejeu = (n, k) => { const f = path.join(require(path.join(__dirname, '../../CH-116/outils/lots.cjs')).travail(), 'rejeux', n, k + '.jsonl');
  return new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut').map(x => [x.cut, x.profils['L1-se']])); };
const { LOTS, cle } = require(path.join(__dirname, '../../CH-116/outils/lots.cjs'));
for (const n of o.noms) { deltas[n] = {};
  for (const e of LOTS) { const k = cle(e), A = lireRejeu(o.ref, k), Bn = lireRejeu(n, k), t = (deltas[n][e.lot] = deltas[n][e.lot] || { bouges: 0, plus30: 0, decisions: 0 });
    for (const [cut, x] of Bn) { const y = A.get(cut); if (!y) continue; if ((x.etat === 'pose') !== (y.etat === 'pose')) { t.decisions++; continue; }
      if (x.etat === 'pose' && x.decal && y.decal) { const d = dist(x.decal, y.decal); if (d > 0.5) t.bouges++; if (d > 30) t.plus30++; } } } }
const justesDegrades = (n, lot) => J[n].parCut.filter(r => r.lot === lot && r.mm != null && r.mm > 10 && (refCut.get(cles(r)) || {}).classe === 'juste').map(r => `${r.partie}/${r.cut}`);
const nouv50 = (n, lot) => J[n].parCut.filter(r => r.lot === lot && r.classe === 'plus-50' && (refCut.get(cles(r)) || {}).classe !== 'plus-50').map(r => `${r.partie}/${r.cut}`);
const vide = { posesJuges: 0, juste: 0, '10-50': 0, 'plus-50': 0, bonsBloques: 0, differes: 0 };
const tab = (n, l) => J[n].parLot[l] || vide;
const cout = (n, l) => 100 * tab(n, l)['plus-50'] + 10 * tab(n, l)['10-50'] + 50 * justesDegrades(n, l).length + 5 * tab(n, l).bonsBloques + tab(n, l).differes;
const choisir = sur => o.noms.map((n, i) => ({ n, i, c: sur.reduce((s, l) => s + cout(n, l), 0), b: sur.reduce((s, l) => s + deltas[n][l].bouges, 0) })).sort((x, y) => x.c - y.c || x.b - y.b || x.i - y.i)[0].n;
const R = G.lotsReglables, out = [], tot = { j: 0, j10: 0, d: 0, p50: 0, deg: [], n50: [], p30: 0, dec: 0 }, totRef = { j: 0, j10: 0, d: 0, p50: 0 };
out.push('| lot jugé | réglage choisi sur les autres | jugés | ≤ 10 | 10–50 | > 50 | ≤ 10 hors > 50 | livré : ≤ 10 / 10–50 | justes passés > 10 | nouv. > 50 | déplacés > 30 mm | décisions changées |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
const ligne = (l, n, acc, accRef) => { const t = tab(n, l), r = tab(o.ref, l), dg = justesDegrades(n, l), n5 = nouv50(n, l);
  if (acc) { acc.j += t.posesJuges; acc.j10 += t.juste; acc.d += t['10-50']; acc.p50 += t['plus-50']; acc.deg.push(...dg); acc.n50.push(...n5); acc.p30 += deltas[n][l].plus30; acc.dec += deltas[n][l].decisions;
    accRef.j += r.posesJuges; accRef.j10 += r.juste; accRef.d += r['10-50']; accRef.p50 += r['plus-50']; }
  return `| ${l} | ${n} | ${t.posesJuges} | ${t.juste} | ${t['10-50']} | ${t['plus-50']} | ${(100 * t.juste / (t.juste + t['10-50'])).toFixed(1)} % | ${r.juste} / ${r['10-50']} | ${dg.join(' ') || 0} | ${n5.join(' ') || 0} | ${deltas[n][l].plus30} | ${deltas[n][l].decisions} |`; };
for (const l of R) out.push(ligne(l, choisir(R.filter(x => x !== l)), tot, totRef));
const pc = (a, b) => (100 * a / b).toFixed(1) + ' %';
out.push(`| **6 lots tenus à l'écart** | | ${tot.j} | ${tot.j10} | ${tot.d} | ${tot.p50} | ${pc(tot.j10, tot.j10 + tot.d)} | ${totRef.j10} / ${totRef.d} (${pc(totRef.j10, totRef.j10 + totRef.d)}) | ${tot.deg.length} | ${tot.n50.length} | ${tot.p30} | ${tot.dec} |`);
const nE = choisir(R), ex = G.examen;
out.push('', `Examen : réglage choisi sur les 6 lots réglables = « ${nE} », jugé une fois sur ${ex.join(', ')} :`, '');
const totE = { j: 0, j10: 0, d: 0, p50: 0, deg: [], n50: [], p30: 0, dec: 0 }, totER = { j: 0, j10: 0, d: 0, p50: 0 };
for (const l of ex) out.push(ligne(l, nE, totE, totER));
const T = { j10: tot.j10 + totE.j10, d: tot.d + totE.d }, TR = { j10: totRef.j10 + totER.j10, d: totRef.d + totER.d };
out.push('', `**7 lots (6 tenus à l'écart + examen)** : ≤ 10 hors > 50 ${T.j10} / ${T.j10 + T.d} = ${pc(T.j10, T.j10 + T.d)} (livré ${TR.j10} / ${TR.j10 + TR.d} = ${pc(TR.j10, TR.j10 + TR.d)}) ; justes passés > 10 : ${tot.deg.length + totE.deg.length} ; nouvelles > 50 : ${tot.n50.length + totE.n50.length} ; déplacés > 30 mm : ${tot.p30 + totE.p30} ; décisions changées : ${tot.dec + totE.dec}`);
out.push('', 'Coût par réglage et par lot (pour mémoire) :', '', '| réglage | ' + [...R, ...ex].join(' | ') + ' |', '|---|' + [...R, ...ex].map(() => '---').join('|') + '|', ...o.noms.map(n => `| ${n} | ${[...R, ...ex].map(l => `${cout(n, l)} (${deltas[n][l].bouges})`).join(' | ')} |`));
console.log(out.join('\n'));
