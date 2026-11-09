'use strict';
const { inv4, coupe, plansBoite } = require('./vues.cjs');
const caps = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
let rootSize = 0; for (const c of caps) for (const v of Object.values(c.vues)) for (const n of v) rootSize = Math.max(rootSize, n.absMax[0] - n.absMin[0]);
const cle = n => n.absMin.map(x => x.toFixed(4)).join(',') + '|' + (n.absMax[0] - n.absMin[0]).toFixed(4);
const lvl = n => Math.round(Math.log2(rootSize / (n.absMax[0] - n.absMin[0])));
const univ = new Map(); for (const c of caps) for (const v of Object.values(c.vues)) for (const n of v) univ.set(cle(n), n);
const ex = [], vis = [], exL = {}, cube = [], visL = {};
for (const c of caps) { const V = new Set(); for (const v of Object.values(c.vues)) for (const n of v) V.add(cle(n)); if (V.size <= 4 || !c.clip[0]) continue;
  const bx = plansBoite(inv4(c.clip[0])); let e = 0, cu = 0;
  for (const [k, n] of univ) { const b = { min: n.absMin.map((x, i) => x - c.O[i]), max: n.absMax.map((x, i) => x - c.O[i]) };
    if (coupe(bx, b) && !V.has(k)) { e++; exL[lvl(n)] = (exL[lvl(n)] || 0) + 1; } }
  for (const k of V) visL[lvl(univ.get(k))] = (visL[lvl(univ.get(k))] || 0) + 1;
  ex.push(e); vis.push(V.size); }
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
console.log({ captures: ex.length, visiblesMed: q(vis, .5), visiblesP90: q(vis, .9), excesMed: q(ex, .5), excesP90: q(ex, .9), excesMax: Math.max(...ex), excesParNiveau: exL, visiblesParNiveau: visL });
