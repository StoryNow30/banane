'use strict';
/* CH-119 : exploration hors ligne (conception). Pour chaque cut ADV jugé du rejeu « pool » : voie globale de la zone (cuts passés du lot à W cuts
 * au plus + pool du cut), écart de la pose locale à cette voie, marge contre la voie rivale (à plus de 50 mm), écart de la voie à la vérité. */
const Z = require('./zones.cjs'), P = require('./proto.cjs');
const SIDES = Z.SIDES;
const R0 = { W: 12, k: 12, pMin: 0.0, wPose: 2, wPool0: 0.2, wPoolP: 1, pool: true, tol: 15, tolV: 40, wGraine: 0.6, empanQuad: 4, cMax: 15 };
function analyser(lots, R = R0, filtre = () => true) {
  const res = [];
  for (const L of lots) {
    const cs = L.cuts;
    cs.forEach((t, it) => {
      if (t.zone !== 'adv' || !t.geo || !filtre(L, t)) return;
      const parCut = new Map();
      for (let j = it - 1; j >= 0; j--) { const s = cs[j]; if (Math.abs(s.cut - t.cut) > R.W) continue; if (!s.geo) continue; const o = P.observations(t, s, R); if (o.length) parCut.set(s.cut, o); }
      const o0 = t.pool ? P.observations(t, { ...t, decal: null }, R) : []; if (o0.length) parCut.set(t.cut, o0);
      const cand = P.voies(parCut, R);
      const T1 = cand[0] || null;
      const y0 = v => ({ left: [0, v.y('left', 0), v.z('left', 0)], right: [0, v.y('right', 0), v.z('right', 0)] });
      const lat = (v, d) => Math.max(...SIDES.map(s => Math.abs(v.y(s, 0) - d[s][1])));
      let T2 = null; if (T1) T2 = cand.find(c => lat(c.v, y0(T1.v)) > 50) || null;
      const r = { cle: L.cle, cut: t.cut, etat: t.etat, source: t.source, n: parCut.size };
      if (t.decal && t.verite) r.mm = Math.max(Z.d3(t.decal.left, t.verite.left), Z.d3(t.decal.right, t.verite.right));
      r.classe = t.etat !== 'pose' ? 'differe' : r.mm == null ? 'pose-nj' : r.mm <= 10 ? 'juste' : r.mm <= 50 ? '10-50' : 'plus-50';
      if (T1) {
        r.S1 = T1.S; r.S2 = T2 ? T2.S : 0; r.marge = r.S1 - r.S2;
        if (t.decal) r.ecartPose = lat(T1.v, t.decal);
        if (t.decal && T2) r.ecartPose2 = lat(T2.v, t.decal);
        if (t.verite) r.ecartVrai = lat(T1.v, t.verite);
        const c0 = T1.choix.get(t.cut); r.obs0 = c0 ? { p: c0.p, d: c0.d } : null;
        if (c0 && t.verite) r.mmObs0 = Math.max(Z.d3(c0.d.left, t.verite.left), Z.d3(c0.d.right, t.verite.right));
        r.nInl = T1.choix.size;
      }
      res.push(r);
    });
  }
  return res;
}
module.exports = { analyser, R0 };
if (require.main === module) {
  const lots = Z.charger(process.argv[2] || 'pool');
  const R = { ...R0, ...(process.argv[3] ? JSON.parse(process.argv[3]) : {}) };
  const res = analyser(lots, R, (L, t) => !!t.verite || t.etat === 'pose');
  if (process.argv[4]) { require('node:fs').writeFileSync(process.argv[4], JSON.stringify(res)); }
  console.log('R', JSON.stringify(R));
  for (const th of [0, 1, 2, 3, 5]) { const v = r => r.ecartPose > 50 && r.marge >= th; console.log(`marge ≥ ${th} : veto mauvaises ${res.filter(r => r.classe === 'plus-50' && v(r)).length}/29, 10-50 ${res.filter(r => r.classe === '10-50' && v(r)).length}, justes ${res.filter(r => r.classe === 'juste' && v(r)).length}, posés non jugés ${res.filter(r => r.classe === 'pose-nj' && v(r)).length}/${res.filter(r => r.classe === 'pose-nj').length}`); }
  if (process.env.RESUME) process.exit(0);
  const f = x => x == null ? '   .' : x.toFixed(0).padStart(4);
  for (const k of ['plus-50', '10-50', 'juste', 'differe']) {
    const g = res.filter(r => r.classe === k && (k !== 'differe' || r.cle));
    console.log(`\n== ${k} (${g.length})`);
    if (k === 'juste' || k === 'differe') {
      const h = (fn, lab) => { const b = {}; for (const r of g) { const v = fn(r); b[v] = (b[v] || 0) + 1; } console.log(lab, JSON.stringify(b)); };
      h(r => r.ecartPose == null ? 'na' : r.ecartPose <= 15 ? '<=15' : r.ecartPose <= 30 ? '<=30' : r.ecartPose <= 50 ? '<=50' : '>50', 'écart pose/voie');
      h(r => r.ecartVrai == null ? 'na' : r.ecartVrai <= 15 ? '<=15' : r.ecartVrai <= 30 ? '<=30' : r.ecartVrai <= 50 ? '<=50' : '>50', 'écart voie/vérité');
      for (const r of g.filter(r => r.ecartPose > 30)) console.log(`  ${r.cle} ${r.cut} ${r.source} pose/voie ${f(r.ecartPose)} pose/rivale ${f(r.ecartPose2)} voie/vrai ${f(r.ecartVrai)} marge ${r.marge?.toFixed(2)} n ${r.n}`);
    } else for (const r of g) console.log(`  ${r.cle} ${r.cut} ${r.source} mm ${f(r.mm)} pose/voie ${f(r.ecartPose)} pose/rivale ${f(r.ecartPose2)} voie/vrai ${f(r.ecartVrai)} marge ${r.marge?.toFixed(2)} obs0 ${r.obs0 ? (r.obs0.p.toFixed(2) + ' à ' + f(r.mmObs0)) : '-'} n ${r.n} inl ${r.nInl}`);
  }
}
