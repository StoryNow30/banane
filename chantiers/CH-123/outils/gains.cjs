#!/usr/bin/env node
'use strict';
/* CH-123 : rappel d'un réglage contre le livré, sur les 747 cuts jugés et sur les 128 (classe B/C au livré). Lecture seule.
 *   node chantiers/CH-123/outils/gains.cjs MESURE_LIVRE MESURE_REGLAGE LISTE_128.csv [--detail] [--verites V.json]
 * Rend : cuts des 128 passés en A (par terrain, zone, cause), cuts A du livré sortis de A (doivent être 0), origines des rails qui entrent.
 * `--verites` (fichier de verites.cjs de CH-120) : un cut hors de la liste est nommé par l'étiquette de son lot, jamais par le début de son identifiant. */
const fs = require('node:fs'), path = require('node:path');
const [ref, dir, liste] = process.argv.slice(2), detail = process.argv.includes('--detail');
const iv = process.argv.indexOf('--verites'), V = iv > 0 ? JSON.parse(fs.readFileSync(process.argv[iv + 1], 'utf8')) : null;
/* « lot8-partie:cut » → « étiquette-partie:cut » ; sans vérités : « ?-partie:cut ». */
const nom = k => { const [f, cut] = k.split(':'), [lot8, partie] = f.split('-'), v = V && V[`${lot8}:${partie}:${cut}`]; return `${v ? v.lot : '?'}-${partie}:${cut}`; };
const lire = d => new Map(fs.readdirSync(d).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter(Boolean)
  .map(s => JSON.parse(s)).filter(x => !x.sansVerite && !x.exclu).map(x => [f.replace('.jsonl', '') + ':' + x.cut, x])));
const R = lire(ref), N = lire(dir);
const L = fs.readFileSync(liste, 'utf8').trim().split('\n'), h = L[0].split(','), rows = L.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [h[i], v])));
const info = new Map();
for (const r of rows) { const k = `${r.lot}-${r.partie}:${r.cut}`; if (!info.has(k)) info.set(k, []); info.get(k).push(r); }
/* clé fichier → étiquette : via la ligne de mesure (même cut, même partie) */
const parCut = new Map(); for (const [k, x] of R) { const [f] = k.split(':'); parCut.set(`${f.split('-')[1]}:${x.cut}`, (parCut.get(`${f.split('-')[1]}:${x.cut}`) || []).concat(k)); }
const absents = [...R.keys()].filter(k => !N.has(k)).length;
let passes = [], sortis = [];
for (const [k, x] of R) {
  const y = N.get(k); if (!y) continue;
  if (x.classeEffective !== 'A' && y.classeEffective === 'A') passes.push([k, x, y]);
  if (x.classeEffective === 'A' && y.classeEffective !== 'A') sortis.push([k, x, y]);
}
const etiq = (k, x) => { const p = k.split(':')[0].split('-')[1]; for (const [ik, rs] of info) if (ik.endsWith(`-${p}:${x.cut}`) && rs[0].zone === x.zone) return { ik, rs }; return null; };
const cpt = {}; const orig = {};
for (const [k, x, y] of passes) {
  const e = etiq(k, x), t = e ? (e.rs.every(r => r.terrain === 'CH-123') ? 'CH-123' : 'CH-120') : '?';
  const key = `${t} ${x.zone === 'adv' ? 'adv' : 'hors-adv'} ${x.classeEffective}→A`; cpt[key] = (cpt[key] || 0) + 1;
  for (const s of ['left', 'right']) if (!(x.rails[s].present || (x.rails[s].rech && x.rails[s].rech.present))) { const o = (y.rails[s].originesPresentes || []).join('+') || 'recherche'; orig[o] = (orig[o] || 0) + 1; }
}
console.log(`# Rappel : ${dir} contre ${ref}\n`);
console.log(`cuts jugés comparés : ${[...R.keys()].filter(k => N.has(k)).length} (absents du réglage : ${absents})`);
console.log(`A au livré : ${[...R.values()].filter(x => x.classeEffective === 'A').length} ; au réglage : ${[...N.values()].filter(x => x.classeEffective === 'A').length}`);
console.log(`**Passés en A : ${passes.length}** ; **sortis de A : ${sortis.length}**\n`);
console.log('| terrain, zone, passage | cuts |\n|---|---|'); for (const [k, v] of Object.entries(cpt).sort()) console.log(`| ${k} | ${v} |`);
console.log('\n| origine du rail entré | rails |\n|---|---|'); for (const [k, v] of Object.entries(orig).sort((a, b) => b[1] - a[1])) console.log(`| ${k} | ${v} |`);
if (sortis.length) { console.log('\nSortis de A :'); for (const [k, x, y] of sortis) console.log(`- ${nom(k)} ${x.zone} ${x.classe} → ${y.classeEffective}`); }
if (detail) { console.log('\nPassés en A :'); for (const [k, x, y] of passes) { const e = etiq(k, x); console.log(`- ${e ? e.ik : nom(k)} ${x.zone} ${x.classe} ${x.classeEffective}→A ; décision ${x.decision && x.decision.etat}/${x.decision && x.decision.motif} → ${y.decision && y.decision.etat}/${y.decision && y.decision.motif}`); } }
