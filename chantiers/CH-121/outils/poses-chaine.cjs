#!/usr/bin/env node
'use strict';
/* CH-121 : poses de la CHAÎNE (source `lot` du rejeu : premier passage, fenêtre, choix, passage à niveau) déplacées par un réglage de l'étage, contre le livré.
 *   node chantiers/CH-121/outils/poses-chaine.cjs NOM_REGLAGE [--ref livre]
 * Par source : posés déplacés (> 0,5 mm), déplacement médian et maximal (pire rail 3D), part du vertical ; parmi les jugés : mieux / pire (> 0,5 mm), classes. */
const fs = require('node:fs'), path = require('node:path');
const { LOTS, cle, travail } = require(path.join(__dirname, '../../CH-116/outils/lots.cjs'));
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut');
const nom = process.argv[2], ref = process.argv.includes('--ref') ? process.argv[process.argv.indexOf('--ref') + 1] : 'livre';
const corpus = new Map();
for (const l of fs.readFileSync(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse)) corpus.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pire = (p, q) => Math.max(d3(p.left, q.left), d3(p.right, q.right));
const r1 = v => Math.round(v * 10) / 10, med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const G = {};
for (const e of LOTS) {
  const k = cle(e), fA = path.join(travail(), 'rejeux', nom, k + '.jsonl'); if (!fs.existsSync(fA)) continue;
  const R = new Map(lire(path.join(travail(), 'rejeux', ref, k + '.jsonl')).map(x => [x.cut, x.profils['L1-se']]));
  for (const x of lire(fA)) {
    const p = x.profils['L1-se'], q = R.get(x.cut); if (!q || p.etat !== 'pose' || q.etat !== 'pose' || !p.decal || !q.decal) continue;
    const dep = pire(p.decal, q.decal); if (dep <= 0.5) continue;
    const g = (G[q.source] = G[q.source] || { n: 0, deps: [], vertSeul: 0, juges: 0, mieux: 0, pire: 0, egal: 0, lots: {}, passe10: [], sous10: [] });
    g.n++; g.deps.push(dep); g.lots[e.lot] = (g.lots[e.lot] || 0) + 1;
    if (['left', 'right'].every(s => Math.abs(p.decal[s][0] - q.decal[s][0]) < 0.05 && Math.abs(p.decal[s][1] - q.decal[s][1]) < 0.05)) g.vertSeul++;
    const c = corpus.get(`${k}:${x.cut}`);
    if (c && c.poseFinale && !c.exclu) { g.juges++; const a = r1(pire(q.decal, c.poseFinale)), b = r1(pire(p.decal, c.poseFinale));
      if (b < a - 0.5) g.mieux++; else if (b > a + 0.5) g.pire++; else g.egal++;
      if (a <= 10 && b > 10) g.passe10.push(`${k}/${x.cut} ${a}→${b}`); if (a > 10 && b <= 10) g.sous10.push(`${k}/${x.cut} ${a}→${b}`); }
  }
}
for (const [s, g] of Object.entries(G)) console.log(`${s} : ${g.n} posés déplacés (${JSON.stringify(g.lots)}), médiane ${r1(med(g.deps))} mm, max ${r1(Math.max(...g.deps))} mm, en hauteur seule ${g.vertSeul} ; jugés ${g.juges} : mieux ${g.mieux}, pire ${g.pire}, égal (±0,5) ${g.egal} ; passés sous 10 mm ${g.sous10.length} [${g.sous10.join(', ')}] ; passés au-delà de 10 mm ${g.passe10.length} [${g.passe10.join(', ')}]`);
