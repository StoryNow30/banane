'use strict';
/* CH-119 : borne d'un choix différé (passé ET futur de la zone), hors ligne. Pour chaque cut ADV posé : meilleur chemin du Viterbi qui passe par
 * sa pose, contre meilleur chemin de la fenêtre [t − W, t + W] qui ne la prend pas. Observations : poses du lot (sauf celle du cut) et, au cut,
 * sa pose ; option : pools. Ce n'est PAS faisable en première passe (le futur n'est pas connu) : c'est la borne d'une reprise de fin de lot. */
const Z = require('./zones.cjs'), P = require('./proto.cjs'), V = require('./viterbi.cjs');
const SIDES = Z.SIDES;
const R0 = { ...V.DEFAUT, W: 8, k: 10, pMin: 0.05, rP: 1, rQ: 1, theta: 0, pools: false };
function obsDe(t, s, R, decal, pool, nature) {
  const out = [], lire = (d, r, nat, p) => { const q = {}; for (const k of SIDES) { q[k] = Z.enRepere(t, s, k, d[k]); if (!q[k]) return; } out.push({ cut: s.cut, x: (q.left[0] + q.right[0]) / 2000, y: { left: q.left[1], right: q.right[1] }, r, nature: nat, p, d }); };
  if (decal) lire(decal, R.rP, nature, null);
  if (pool && s.pool) for (const pr of P.paires(s.pool, R.k)) if (pr.p >= R.pMin) lire(pr.d, R.rQ * pr.p, 'pool', pr.p);
  return out;
}
const miroir = obs => obs.map(o => ({ ...o, cut: -o.cut, x: -o.x, F: undefined }));
function meilleur(obs, R) { const t = V.dp(obs, R); return t.length ? Math.max(...t.map(o => o.best)) : 0; }
const lots = Z.charger(process.argv[2] || 'pool'), R = { ...R0, ...(process.argv[3] ? JSON.parse(process.argv[3]) : {}) };
const res = [];
for (const L of lots) {
  const cs = L.cuts;
  for (const t of cs) {
    if (t.zone !== 'adv' || !t.geo || !t.decal) continue;
    const autres = [];
    for (const s of cs) { if (s === t || Math.abs(s.cut - t.cut) > R.W || !s.geo) continue; autres.push(...obsDe(t, s, R, s.decal, R.pools, 'pose')); }
    const ici = obsDe(t, t, R, t.decal, false, 'locale')[0];
    /* chemin passant par la pose : avant (dp) + après (dp en miroir) − r */
    const av = autres.filter(o => o.cut < t.cut), ap = autres.filter(o => o.cut > t.cut);
    const F = V.dp([...av, ici], R).find(o => o.nature === 'locale').best;
    const m = miroir([...ap, ici]); const B = V.dp(m, R).find(o => o.nature === 'locale').best;
    const par = F + B - ici.r, sans = meilleur(autres.map(o => ({ ...o })), R);
    const r = { cle: L.cle, cut: t.cut, source: t.source, par, sans, veto: sans - par > R.theta };
    if (t.verite) r.mm = Math.max(Z.d3(t.decal.left, t.verite.left), Z.d3(t.decal.right, t.verite.right));
    r.classe = r.mm == null ? 'pose-nj' : r.mm <= 10 ? 'juste' : r.mm <= 50 ? '10-50' : 'plus-50';
    res.push(r);
  }
}
const n = (k, f) => res.filter(r => r.classe === k && f(r)).length;
console.log('R', JSON.stringify(R));
console.log(`veto (borne passé + futur) : mauvaises ${n('plus-50', r => r.veto)}/${n('plus-50', () => true)}, 10-50 ${n('10-50', r => r.veto)}/${n('10-50', () => true)}, justes ${n('juste', r => r.veto)}/${n('juste', () => true)}, posés non jugés ${n('pose-nj', r => r.veto)}/${n('pose-nj', () => true)}`);
if (!process.env.RESUME) for (const r of res.filter(r => r.veto || r.classe === 'plus-50')) console.log(`  ${r.classe.padEnd(8)} ${r.cle} ${r.cut} ${r.source} veto ${r.veto ? 'OUI' : 'non'} par ${r.par.toFixed(2)} sans ${r.sans.toFixed(2)}`);
