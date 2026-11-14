#!/usr/bin/env node
'use strict';
/* CH-123 : rappel du pool par cause du rail manquant, sur la liste figée des 128 cuts (classe B ou C au livré). Lecture seule.
 *   node chantiers/CH-123/outils/rappel-par-cause.cjs --liste LISTE_128.csv --verites V.json --rejeu-livre REJEU --eteint MESURE --reglage NOM=MESURE [--reglage …]
 * MESURE : dossiers de mesure-pool.cjs (CH-120) ; REJEU : dossier du banc (rejeu livré). Par terrain et par cause : cuts de la liste ; cuts POSÉS au
 * livré (chaîne ou GCV2 : un réglage « seulement les différés » n'y touche pas) ; par réglage, cuts passés en A et, parmi eux, ceux que le pool décide. */
const fs = require('node:fs'), path = require('node:path');
const a = process.argv.slice(2), o = { reglages: [] };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--liste') o.liste = v(); else if (k === '--verites') o.verites = v(); else if (k === '--rejeu-livre') o.rejeu = v(); else if (k === '--eteint') o.eteint = v(); else if (k === '--reglage') { const [n, d] = v().split('='); o.reglages.push({ n, d }); } else throw Error('option inconnue ' + k); }
const V = JSON.parse(fs.readFileSync(o.verites, 'utf8'));
const lire = d => new Map(fs.readdirSync(d).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => !x.sansVerite && !x.exclu)
  .map(x => { const [l8, p] = f.replace('.jsonl', '').split('-'), v = V[`${l8}:${p}:${x.cut}`]; return [`${v ? v.lot : '?'}-${p}:${x.cut}`, x]; })));
const E = lire(o.eteint), M = o.reglages.map(r => ({ n: r.n, m: lire(r.d) }));
const poses = new Set();
for (const f of fs.readdirSync(o.rejeu).filter(f => f.endsWith('.jsonl'))) { const [lot, p] = f.replace('.jsonl', '').split('-'); for (const l of fs.readFileSync(path.join(o.rejeu, f), 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s))) if (l.type === 'cut' && l.profils['L1-se'].etat === 'pose') poses.add(`${lot}-${p.slice(1)}:${l.cut}`); }
const L = fs.readFileSync(o.liste, 'utf8').trim().split('\n'), h = L[0].split(','), rows = L.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [h[i], v])));
const cuts = new Map(); for (const r of rows) { const k = `${r.lot}-${r.partie}:${r.cut}`; if (!cuts.has(k)) cuts.set(k, []); cuts.get(k).push(r); }
const T = {}, decide = x => !!(x && x.decision && x.decision.etat !== 'rien');
for (const [k, rs] of cuts) {
  const e = E.get(k); if (!e) continue;
  const terrain = rs.every(r => r.terrain === 'CH-123') ? 'CH-123' : 'CH-120', cause = [...new Set(rs.map(r => r.cause.replace(/^cellule-ecartee-.*/, 'cellule-ecartee').replace(/^non-detecte.*/, 'non-detecte')))].sort().join(' + ');
  const t = (T[`${terrain} | ${cause}`] = T[`${terrain} | ${cause}`] || { n: 0, poses: 0, r: M.map(() => [0, 0]) });
  t.n++; if (poses.has(k)) t.poses++;
  M.forEach((x, i) => { const y = x.m.get(k); if (e.classeEffective !== 'A' && y && y.classeEffective === 'A') { t.r[i][0]++; if (decide(y)) t.r[i][1]++; } });
}
const out = [`# Rappel par cause, sur les ${cuts.size} cuts de la liste figée (zones du lot)`, '', `| terrain | cause du ou des rails manquants | cuts | posés au livré | ${M.map(x => `passés en A, ${x.n} (dont décidés par le pool)`).join(' | ')} |`, `|---|---|---|---|${M.map(() => '---|').join('')}`];
const S = { n: 0, poses: 0, r: M.map(() => [0, 0]) };
for (const [k, t] of Object.entries(T).sort()) { out.push(`| ${k} | ${t.n} | ${t.poses} | ${t.r.map(x => `${x[0]} (${x[1]})`).join(' | ')} |`); S.n += t.n; S.poses += t.poses; t.r.forEach((x, i) => { S.r[i][0] += x[0]; S.r[i][1] += x[1]; }); }
out.push(`| **total** | | ${S.n} | ${S.poses} | ${S.r.map(x => `${x[0]} (${x[1]})`).join(' | ')} |`, '', `Classe B ou C à l'éteint avec les zones du lot : ${[...E.values()].filter(x => x.classeEffective !== 'A').length} cuts sur ${E.size} jugés.`);
process.stdout.write(out.join('\n') + '\n');
