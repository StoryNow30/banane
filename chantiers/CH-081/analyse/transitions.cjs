'use strict';
// CH-081 (étude) : par passage d'une coupe à la suivante, nœuds nouveaux (non vus dans les W captures d'avant), et couverture de chaque zone candidate.
const { inv4, coupe, plansBoite } = require('./vues.cjs');
const [, , fic, fenetresJson, Wstr] = process.argv;
const caps = JSON.parse(require('fs').readFileSync(fic, 'utf8')).sort((a, b) => a.at < b.at ? -1 : 1);
const fen = JSON.parse(fenetresJson); // [[debutISO, finISO, mode], ...]
const W = Number(Wstr || 1e9);
let rootSize = 0; for (const c of caps) for (const v of Object.values(c.vues)) for (const n of v) rootSize = Math.max(rootSize, n.absMax[0] - n.absMin[0]);
const cle = n => n.absMin.map(x => x.toFixed(4)).join(',') + '|' + (n.absMax[0] - n.absMin[0]).toFixed(4);
const lvl = n => Math.round(Math.log2(rootSize / (n.absMax[0] - n.absMin[0])));
const mode = at => (fen.find(([a, b]) => at >= a && at <= b) || [0, 0, 'autre'])[2];
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const classe = s => s === 0 ? '0 (même coupe)' : s === 1 ? '1' : s >= 2 && s <= 10 ? '2-10' : s > 10 && s <= 50 ? '11-50' : s > 50 ? '>50' : 'arrière';
const cubeCoupe = (b, rails, r) => rails.some(p => [0, 1, 2].every(i => b.min[i] <= p[i] + r && b.max[i] >= p[i] - r));
const agg = {};
const vusAvant = []; // fenêtre glissante d'ensembles
for (let k = 0; k < caps.length; k++) {
  const c = caps[k];
  const vis = new Map(); for (const v of Object.values(c.vues)) for (const n of v) vis.set(cle(n), n);
  const vide = vis.size <= 4;
  if (k > 0 && !vide && caps[k - 1].part === c.part) {
    const deja = new Set(); for (const s of vusAvant.slice(-W)) for (const x of s) deja.add(x);
    const nouv = [...vis].filter(([x]) => !deja.has(x)).map(([, n]) => n);
    const rel = n => ({ min: n.absMin.map((x, i) => x - c.O[i]), max: n.absMax.map((x, i) => x - c.O[i]) });
    const bx = c.clip[0] ? plansBoite(inv4(c.clip[0])) : null;
    const g = agg[mode(c.at) + ' | ' + classe(c.cut - caps[k - 1].cut)] ||= { n: 0, nouv: [], pts: [], cube075: 0, cube15: 0, boite: 0, tot: 0, lvlMax: [], parNiveau: {} };
    g.n++; g.nouv.push(nouv.length); g.pts.push(nouv.reduce((s, n) => s + n.pts, 0)); g.tot += nouv.length;
    for (const n of nouv) { const b = rel(n); if (cubeCoupe(b, [c.L, c.R], 0.75)) g.cube075++; if (cubeCoupe(b, [c.L, c.R], 1.5)) g.cube15++; if (bx && coupe(bx, b)) g.boite++; g.parNiveau[lvl(n)] = (g.parNiveau[lvl(n)] || 0) + 1; }
  }
  if (!vide) vusAvant.push(new Set(vis.keys()));
}
const out = {};
for (const [k, g] of Object.entries(agg).sort()) out[k] = { passages: g.n, nouveauxMed: q(g.nouv, .5), nouveauxP90: q(g.nouv, .9), ptsMed: q(g.pts, .5), nouveauxTot: g.tot, couvertsCube075: g.cube075, couvertsCube15: g.cube15, couvertsBoite: g.boite, parNiveau: g.parNiveau };
console.log(JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"'));
