'use strict';
const { inv4, mul4, frustumDe, coupe, plansBoite } = require('./vues.cjs');
const caps = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
let rootSize = 0; for (const c of caps) for (const v of Object.values(c.vues)) for (const n of v) rootSize = Math.max(rootSize, n.absMax[0] - n.absMin[0]);
const lvl = n => Math.round(Math.log2(rootSize / (n.absMax[0] - n.absMin[0])));
const camDe = (c, rail) => { const m = c.cam.slice(); const off = [0,1,2].map(i => c.cam[12+i] - c.R[i]); m[12] = rail[0]+off[0]; m[13] = rail[1]+off[1]; m[14] = rail[2]+off[2]; return m; };
const out = {};
for (const c of caps) for (const [vi, rail] of [['0', c.L], ['1', c.R]]) {
  const v = c.vues[vi]; if (!v || !c.clip[+vi]) continue;
  const fr = frustumDe(mul4(c.proj, inv4(camDe(c, rail)))), bx = plansBoite(inv4(c.clip[+vi]));
  for (const n of v) { const b = { min: n.absMin.map((x,i)=>x-c.O[i]), max: n.absMax.map((x,i)=>x-c.O[i]) };
    const f = coupe(fr, b), k = coupe(bx, b); if (f && k) continue; const key = `v${vi} L${lvl(n)} ${f?'':'F'}${k?'':'C'}`; out[key] = (out[key]||0)+1; }
}
console.log(out);
