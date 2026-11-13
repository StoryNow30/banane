'use strict';
/* CH-119 : exploration hors ligne du Viterbi (conception), simulation séquentielle approchée : une pose vetoée n'est plus une observation « pose »
 * pour les cuts suivants (son pool reste). Les décisions locales des cuts suivants ne sont pas refaites (approximation ; le banc fera foi). */
const Z = require('./zones.cjs'), P = require('./proto.cjs'), V = require('./viterbi.cjs');
const SIDES = Z.SIDES;
const R0 = { ...V.DEFAUT, W: 8, k: 10, pMin: 0.05, rP: 1, rQ0: 0, rQ: 1, theta: 0, poolsPasses: 'tous' };
function obsDe(t, s, R, decal, avecPool) {
  const out = [], lire = (d, r, nature, p) => {
    const q = {}; for (const k of SIDES) { q[k] = Z.enRepere(t, s, k, d[k]); if (!q[k]) return; }
    out.push({ cut: s.cut, x: (q.left[0] + q.right[0]) / 2000, y: { left: q.left[1], right: q.right[1] }, z: { left: q.left[2], right: q.right[2] }, r, nature, p, d });
  };
  if (decal) lire(decal, R.rP, s === t ? 'locale' : 'pose', null);
  if (avecPool && s.pool) for (const pr of P.paires(s.pool, R.k)) if (pr.p >= R.pMin) lire(pr.d, R.rQ0 + R.rQ * pr.p, 'pool', pr.p);
  return out;
}
function analyser(lots, R = R0) {
  const res = [];
  for (const L of lots) {
    const cs = L.cuts, posee = new Map(cs.map(c => [c.cut, c.decal]));
    cs.forEach((t, it) => {
      if (t.zone !== 'adv' || !t.geo) return;
      const obs = [];
      for (let j = it - 1; j >= 0; j--) { const s = cs[j]; if (t.cut - s.cut > R.W || s.cut >= t.cut || !s.geo) continue;
        const avecPool = R.poolsPasses === 'tous' || (R.poolsPasses === 'gcv2' && (!posee.get(s.cut) || s.source === 'gcv2')) || (R.poolsPasses === 'differes' && !posee.get(s.cut));
        obs.push(...obsDe(t, s, R, posee.get(s.cut), avecPool)); }
      obs.push(...obsDe(t, t, R, t.decal, true));
      const d = V.decider(obs, t.cut, R);
      const r = { cle: L.cle, cut: t.cut, etat: t.etat, source: t.source, nPasses: new Set(obs.filter(o => o.cut < t.cut).map(o => o.cut)).size, coast: d.passe ?? -1, poseS: d.pose };
      if (t.decal && t.verite) r.mm = Math.max(Z.d3(t.decal.left, t.verite.left), Z.d3(t.decal.right, t.verite.right));
      r.classe = t.etat !== 'pose' ? 'differe' : r.mm == null ? 'pose-nj' : r.mm <= 10 ? 'juste' : r.mm <= 50 ? '10-50' : 'plus-50';
      r.veto = !!(t.decal && d.ecart != null && d.ecart > R.theta);
      if (d.alt && t.verite) r.mmAlt = Math.max(Z.d3(d.alt.d.left, t.verite.left), Z.d3(d.alt.d.right, t.verite.right));
      if (d.alt) r.altS = d.alt.best;
      if (r.veto) posee.set(t.cut, null);
      res.push(r);
    });
  }
  return res;
}
module.exports = { analyser, R0 };
if (require.main === module) {
  const lots = Z.charger(process.argv[2] || 'pool');
  const R = { ...R0, ...(process.argv[3] ? JSON.parse(process.argv[3]) : {}) };
  const res = analyser(lots, R);
  if (process.argv[4]) require('node:fs').writeFileSync(process.argv[4], JSON.stringify(res));
  const n = (k, f) => res.filter(r => r.classe === k && f(r)).length;
  console.log('R', JSON.stringify(R));
  console.log(`veto : mauvaises ${n('plus-50', r => r.veto)}/${n('plus-50', () => true)}, 10-50 ${n('10-50', r => r.veto)}/${n('10-50', () => true)}, justes ${n('juste', r => r.veto)}/${n('juste', () => true)}, posés non jugés ${n('pose-nj', r => r.veto)}/${n('pose-nj', () => true)}`);
  if (!process.env.RESUME) for (const r of res.filter(r => r.veto || r.classe === 'plus-50')) console.log(`  ${r.classe.padEnd(8)} ${r.cle} ${r.cut} ${r.source} veto ${r.veto ? 'OUI' : 'non'} coast ${r.coast.toFixed(2)} pose ${r.poseS?.toFixed(2)} n ${r.nPasses}${r.mmAlt != null ? ' alt ' + r.mmAlt.toFixed(0) + ' mm' : ''}`);
}
