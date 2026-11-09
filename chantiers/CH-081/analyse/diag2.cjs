'use strict';
const { inv4, app } = require('./vues.cjs');
const caps = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
let rootSize = 0; for (const c of caps) for (const v of Object.values(c.vues)) for (const n of v) rootSize = Math.max(rootSize, n.absMax[0] - n.absMin[0]);
const lvl = n => Math.round(Math.log2(rootSize / (n.absMax[0] - n.absMin[0])));
const camDe = (c, rail) => { const m = c.cam.slice(); const off = [0,1,2].map(i => c.cam[12+i] - c.R[i]); m[12] = rail[0]+off[0]; m[13] = rail[1]+off[1]; m[14] = rail[2]+off[2]; return m; };
const ex = [], ey = [], autreRail = { oui: 0, non: 0 };
for (const c of caps) for (const [vi, rail, autre] of [['0', c.L, c.R], ['1', c.R, c.L]]) {
  const v = c.vues[vi]; if (!v) continue;
  const V = inv4(camDe(c, rail)), V2 = inv4(camDe(c, autre));
  const hw = 1 / c.proj[0], hh = 1 / c.proj[5];
  for (const n of v) { if (lvl(n) <= 2) continue;
    const corners = []; for (let i = 0; i < 8; i++) corners.push([i&1?n.absMax[0]:n.absMin[0], i&2?n.absMax[1]:n.absMin[1], i&4?n.absMax[2]:n.absMin[2]].map((x,k)=>x-c.O[k]));
    const pc = corners.map(p => app(V, p)), xs = pc.map(p=>p[0]), ys = pc.map(p=>p[1]);
    const dx = Math.max(0, Math.min(...xs) - hw, -hw - Math.max(...xs)), dy = Math.max(0, Math.min(...ys) - hh, -hh - Math.max(...ys));
    if (dx > 0 || dy > 0) { ex.push(dx); ey.push(dy);
      const pc2 = corners.map(p => app(V2, p)), x2 = pc2.map(p=>p[0]), y2 = pc2.map(p=>p[1]);
      const ok2 = Math.min(...x2) <= hw && Math.max(...x2) >= -hw && Math.min(...y2) <= hh && Math.max(...y2) >= -hh; autreRail[ok2?'oui':'non']++; }
  }
}
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(p*(s.length-1))];};
console.log({ n: ex.length, dx: [q(ex,.5),q(ex,.9),q(ex,1)], dy: [q(ey,.5),q(ey,.9),q(ey,1)], vuDepuisAutreRail: autreRail });
