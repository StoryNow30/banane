#!/usr/bin/env node
'use strict';
/* CH-121 : jugement « un lot dehors » de la grille 3 : chaque lot jugé UNE fois, par le rejeu de son pli (aj3-<lot>), 05/11 par aj3-final ; contre le livré.
 *   node chantiers/CH-121/outils/juger-plis.cjs [--ref livre] [--csv PAR-CUT.csv]
 * Tableau par lot : posés jugés, ≤ 10, 10–50, > 50, ≤ 10 hors > 50 (et livré), gagnés / perdus à 10 mm, justes passés au-delà de 10 mm, nouvelles > 50,
 * posés déplacés (> 0,5 mm ; > 30 mm), décisions changées ; totaux à 6 lots (réglables) et à 7 lots. */
const fs = require('node:fs'), path = require('node:path');
const { LOTS, cle, travail } = require(path.join(__dirname, '../../CH-116/outils/lots.cjs'));
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const a = process.argv.slice(2); let ref = 'livre', csv = null;
for (let i = 0; i < a.length; i++) { if (a[i] === '--ref') ref = a[++i]; else if (a[i] === '--csv') csv = a[++i]; else throw Error(a[i]); }
const corpus = new Map(lireJsonl(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl')).map(l => [`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l]));
const dist = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(p[s][0] - q[s][0], p[s][1] - q[s][1], p[s][2] - q[s][2])));
const r1 = v => Math.round(v * 10) / 10;
const source = lot => (process.env.CH121_SOURCE_UNIQUE || (lot === '0511' ? 'aj3-final' : 'aj3-' + lot));
const T = () => ({ juges: 0, j10: 0, d1050: 0, p50: 0, rj10: 0, rd1050: 0, rp50: 0, gagnes: [], perdus: [], n50: [], bouges: 0, plus30: 0, decisions: [] });
const par = {}, lignes = ['cle;cut;livre_etat;livre_mm;reglage_etat;reglage_mm;deplacement_mm'];
for (const e of LOTS) {
  const k = cle(e), f = path.join(travail(), 'rejeux', source(e.lot), k + '.jsonl'); if (!fs.existsSync(f)) { console.log(`manque ${source(e.lot)}/${k}`); continue; }
  const R = new Map(lireJsonl(path.join(travail(), 'rejeux', ref, k + '.jsonl')).filter(x => x.type === 'cut').map(x => [x.cut, x.profils['L1-se']]));
  const t = (par[e.lot] = par[e.lot] || T());
  for (const x of lireJsonl(f).filter(x => x.type === 'cut')) {
    const p = x.profils['L1-se'], q = R.get(x.cut), c = corpus.get(`${k}:${x.cut}`); if (!q) continue;
    const pp = p.etat === 'pose' && p.decal, qp = q.etat === 'pose' && q.decal;
    if (!!pp !== !!qp) t.decisions.push(`${e.partie}/${x.cut}`);
    let depl = null; if (pp && qp) { depl = dist(p.decal, q.decal); if (depl > 0.5) t.bouges++; if (depl > 30) t.plus30++; }
    const juge = c && c.poseFinale && !c.exclu; let mA = null, mB = null;
    if (juge) {
      if (qp) { mA = r1(dist(q.decal, c.poseFinale)); if (mA <= 10) t.rj10++; else if (mA <= 50) t.rd1050++; else t.rp50++; }
      if (pp) { mB = r1(dist(p.decal, c.poseFinale)); t.juges++; if (mB <= 10) t.j10++; else if (mB <= 50) t.d1050++; else t.p50++; }
      if (mA != null && mB != null) { if (mA > 10 && mA <= 50 && mB <= 10) t.gagnes.push(`${e.partie}/${x.cut} ${r1(mA)}→${r1(mB)}`); if (mA <= 10 && mB > 10) t.perdus.push(`${e.partie}/${x.cut} ${r1(mA)}→${r1(mB)}`); if (mA <= 50 && mB > 50) t.n50.push(`${e.partie}/${x.cut}`); }
      if (mA == null && mB != null && mB > 50) t.n50.push(`${e.partie}/${x.cut}`);
    }
    if (csv && (juge || (depl != null && depl > 0.5))) lignes.push([k, x.cut, q.etat, mA == null ? '' : r1(mA), p.etat, mB == null ? '' : r1(mB), depl == null ? '' : r1(depl)].join(';'));
  }
}
const pc = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—';
const ligne = (n, t) => `| ${n} | ${t.juges} | ${t.j10} | ${t.d1050} | ${t.p50} | ${pc(t.j10, t.j10 + t.d1050)} | ${pc(t.rj10, t.rj10 + t.rd1050)} (${t.rj10}/${t.rj10 + t.rd1050}) | ${t.gagnes.length} / ${t.perdus.length} | ${t.n50.length} | ${t.bouges} | ${t.plus30} | ${t.decisions.length} |`;
const somme = ts => ts.reduce((a, t) => { for (const k of Object.keys(a)) a[k] = Array.isArray(a[k]) ? a[k].concat(t[k]) : a[k] + t[k]; return a; }, T());
const reg = ['0411', '0611', '0811a', '0811b', '1111', '1211'];
const out = ['| lot (réglage de son pli) | posés jugés | ≤ 10 | 10–50 | > 50 | ≤ 10 hors > 50 | livré | gagnés / perdus | nouv. > 50 | posés déplacés | > 30 mm | décisions changées |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const l of [...reg, '0511']) if (par[l]) out.push(ligne(`${l} (${source(l)})`, par[l]));
out.push(ligne('**6 lots réglables**', somme(reg.map(l => par[l]).filter(Boolean))), ligne('**7 lots (avec l\'examen 05/11)**', somme([...reg, '0511'].map(l => par[l]).filter(Boolean))));
const tout = somme(Object.values(par));
out.push('', `gagnés : ${tout.gagnes.join(', ')}`, `perdus : ${tout.perdus.join(', ') || 'aucun'}`, `nouvelles > 50 : ${tout.n50.join(', ') || 'aucune'}`, `décisions changées : ${tout.decisions.join(', ') || 'aucune'}`);
console.log(out.join('\n'));
if (csv) fs.writeFileSync(csv, lignes.join('\n') + '\n');
