'use strict';
// CH-081 (étude) : rejeu de la sélection de Potree 1.8 (caméra orthographique) sur les vues reconstituées.
const { inv4, mul4, app, frustumDe, coupe, plansBoite } = require('./vues.cjs');
const caps = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')).sort((a, b) => a.at < b.at ? -1 : 1);
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const med = a => q(a, 0.5);
const r3 = v => Math.round(v * 1000) / 1000;
// univers : tous les nœuds vus (clé = bbox absolue), niveau d'après la taille
let rootSize = 0; for (const c of caps) for (const v of Object.values(c.vues)) for (const n of v) rootSize = Math.max(rootSize, n.absMax[0] - n.absMin[0]);
const cle = n => n.absMin.map(x => x.toFixed(4)).join(',') + '|' + (n.absMax[0] - n.absMin[0]).toFixed(4);
const lvl = n => Math.round(Math.log2(rootSize / (n.absMax[0] - n.absMin[0])));
const univ = new Map(); for (const c of caps) for (const v of Object.values(c.vues)) for (const n of v) univ.set(cle(n), { absMin: n.absMin, absMax: n.absMax, pts: n.pts, l: lvl(n) });
// repère de voie d'une capture : u = travers (R-L horizontal), t = long de la voie, z
function repere(c) { const d = [c.R[0] - c.L[0], c.R[1] - c.L[1], 0], l = Math.hypot(...d); const u = d.map(x => x / l); return { u, t: [-u[1], u[0], 0] }; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const camDe = (c, rail) => { const m = c.cam.slice(); const cp = m.slice(12, 15); const off = [0, 1, 2].map(i => cp[i] - c.R[i]); m[12] = rail[0] + off[0]; m[13] = rail[1] + off[1]; m[14] = rail[2] + off[2]; return m; };
// sélection rejouée : nœuds de l'univers qui coupent le frustum ET la boîte (O absolu -> scène : soustraire O)
function selection(c, camM, clipM, proj, univers) {
  const fr = frustumDe(mul4(proj, inv4(camM))), bx = plansBoite(inv4(clipM)), out = new Set();
  for (const [k, n] of univers) { const b = { min: n.absMin.map((x, i) => x - c.O[i]), max: n.absMax.map((x, i) => x - c.O[i]) }; if (coupe(fr, b) && coupe(bx, b)) out.add(k); }
  return out;
}
const st = { vues: 0, noeudsVus: 0, vusHorsRegle: 0, regleNonVus: 0, regleNonVusParNiveau: {}, niveauMax: {}, ptsVue: [], noeudsVue: [], camOff: [], camRot: [], demiL: [], demiH: [], clipDim: [], clipOff: [], projVarie: 0 };
const proj0 = caps[0].proj;
for (const c of caps) {
  const { u, t } = repere(c);
  const cp = c.cam.slice(12, 15), off = [0, 1, 2].map(i => cp[i] - c.R[i]);
  st.camOff.push([dot(off, u), dot(off, t), off[2]]);
  const vz = c.cam.slice(8, 11); st.camRot.push(Math.acos(Math.min(1, Math.abs(dot(vz, t)))) * 180 / Math.PI);
  st.demiL.push(1 / c.proj[0]); st.demiH.push(1 / c.proj[5]);
  if (Math.abs(c.proj[0] - proj0[0]) > 1e-6 || Math.abs(c.proj[5] - proj0[5]) > 1e-3) st.projVarie++;
  if (c.clip[0]) { const U = inv4(c.clip[0]); const ctr = U.slice(12, 15), mid = [0, 1, 2].map(i => (c.L[i] + c.R[i]) / 2), d = ctr.map((x, i) => x - mid[i]);
    st.clipDim.push([Math.hypot(U[0], U[1], U[2]), Math.hypot(U[4], U[5], U[6]), Math.hypot(U[8], U[9], U[10])]); st.clipOff.push([dot(d, u), dot(d, t), d[2]]); }
  for (const [vi, rail] of [['0', c.L], ['1', c.R]]) {
    const v = c.vues[vi]; if (!v || !c.clip[+vi]) continue;
    st.vues++; st.noeudsVus += v.length; st.ptsVue.push(v.reduce((s, n) => s + n.pts, 0)); st.noeudsVue.push(v.length);
    const vus = new Set(v.map(cle)), sel = selection(c, camDe(c, rail), c.clip[+vi], c.proj, univ);
    for (const k of vus) if (!sel.has(k)) st.vusHorsRegle++;
    for (const k of sel) if (!vus.has(k)) { st.regleNonVus++; const l = univ.get(k).l; st.regleNonVusParNiveau[l] = (st.regleNonVusParNiveau[l] || 0) + 1; }
    const lm = Math.max(...v.map(lvl)); st.niveauMax[lm] = (st.niveauMax[lm] || 0) + 1;
  }
}
const res = k => [0, 1, 2].map(i => [q(st[k].map(x => x[i]), 0.05), med(st[k].map(x => x[i])), q(st[k].map(x => x[i]), 0.95)].map(r3));
console.log(JSON.stringify({
  captures: caps.length, rootSize, univers: univ.size, vues: st.vues, noeudsVus: st.noeudsVus, vusHorsRegle: st.vusHorsRegle, regleNonVus: st.regleNonVus, regleNonVusParNiveau: st.regleNonVusParNiveau,
  niveauMaxVue: st.niveauMax, ptsVue: [q(st.ptsVue, .05), med(st.ptsVue), q(st.ptsVue, .95), Math.max(...st.ptsVue)], noeudsVue: [q(st.noeudsVue, .05), med(st.noeudsVue), q(st.noeudsVue, .95)],
  camOff_u_t_z_p5_med_p95: res('camOff'), camRotDeg: [q(st.camRot, .05), med(st.camRot), q(st.camRot, .95)].map(r3),
  demiLargeur: [q(st.demiL, .05), med(st.demiL), q(st.demiL, .95)].map(r3), demiHauteur: [q(st.demiH, .05), med(st.demiH), q(st.demiH, .95)].map(r3), projVarie: st.projVarie,
  clipDim: res('clipDim'), clipOff_u_t_z: res('clipOff'),
}, null, 1));
