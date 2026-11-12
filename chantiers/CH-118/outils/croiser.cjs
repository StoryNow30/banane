/* CH-118 — croise, rail par rail, la retouche de l'opérateur (jointure) et les traits du moteur (traits-journal).
 *   node chantiers/CH-118/outils/croiser.cjs --paire J.json:T.json [--paire …] [--csv rails.csv]
 * Rail retouché = écart 3D du rail > 5 mm ; contraste = rails ≤ 2 mm. Lecture seule ; millimètres et numéros de cut. */
'use strict';
const fs = require('fs');
const a = process.argv.slice(2), paires = []; let csv = null;
for (let i = 0; i < a.length; i++) { if (a[i] === '--paire') paires.push(a[++i].split(':')); else if (a[i] === '--csv') csv = a[++i]; }
const rails = [];
for (const [fj, ft] of paires) {
  const T = JSON.parse(fs.readFileSync(fj, 'utf8')).table, X = JSON.parse(fs.readFileSync(ft, 'utf8'));
  for (const r of T) {
    if (r.classe !== 'posee' || !r.ecartHumain || r.referenceHumaine !== 'observee' || !r.ecartHumain.gauche || r.ecartHumain.gauche.repere !== 'profil') continue;
    if (r.ecartHumain.maxDist3dMm > 50) continue; // mauvaise voie : CH-117
    const x = X[r.cut] || {};
    for (const [fr, s] of [['gauche', 'left'], ['droite', 'right']]) {
      const h = r.ecartHumain[fr], m = x.rails && x.rails[s] || {}, ad = r.arianeDeplacement && r.arianeDeplacement[fr];
      rails.push({ partie: r.partie, cut: r.cut, cote: s, d3: h.dist3dMm, lat: h.lateralMm, vert: h.verticalMm, max: r.ecartHumain.maxDist3dMm,
        stage: x.stage || '', zone: x.zone || '', conv: m.conv, convRaison: m.convRaison || '', du: m.duMm, dz: m.dzMm, pts: m.pts, palier: m.palier || '', conf: m.conf, faible: m.faible,
        statut: m.statut || '', ecPred: x.ecartementPreditMm, adLat: ad && ad.lateralMm, nLat: m.nextDelta ? m.nextDelta[1] * 1000 : null, nVert: m.nextDelta ? m.nextDelta[2] * 1000 : null, adVert: ad && ad.verticalMm, signe: m.signe });
    }
  }
}
module.exports = { rails };
if (require.main === module) {
  const f1 = v => v == null || !Number.isFinite(v) ? '' : v.toFixed(1);
  const q = (v, p) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return NaN; const k = (s.length - 1) * p, lo = Math.floor(k); return s[lo] + (s[Math.ceil(k)] - s[lo]) * (k - lo); };
  const groupe = (nom, f) => { const R = rails.filter(f); const ret = R.filter(r => r.d3 > 5), ok = R.filter(r => r.d3 <= 2);
    console.log(`${nom.padEnd(44)} rails ${String(R.length).padStart(4)} · retouchés>5 ${String(ret.length).padStart(3)} (${(100 * ret.length / Math.max(1, R.length)).toFixed(0)} %) · ≤2 ${ok.length} · vert méd retouchés ${f1(q(ret.map(r => r.vert), .5))}`); };
  groupe('tous', () => true);
  groupe('calage convention appliqué', r => r.conv === true);
  groupe('calage refusé : shift-out-of-domain', r => r.convRaison === 'shift-out-of-domain');
  for (const rs of [...new Set(rails.map(r => r.convRaison))]) if (rs && rs !== 'shift-out-of-domain') groupe('calage refusé : ' + rs, r => r.convRaison === rs);
  groupe('refusé hors domaine, dz > +5', r => r.convRaison === 'shift-out-of-domain' && r.dz > 5);
  groupe('refusé hors domaine, |dz| ≤ 5', r => r.convRaison === 'shift-out-of-domain' && Math.abs(r.dz) <= 5);
  for (const p of [...new Set(rails.map(r => r.palier))]) groupe('palier ' + (p || '?'), r => r.palier === p);
  for (const s of [...new Set(rails.map(r => r.stage))]) groupe('chemin ' + (s || '?'), r => r.stage === s);
  for (const z of [...new Set(rails.map(r => r.zone))]) groupe('zone ' + (z || '?'), r => r.zone === z);
  // retouche verticale contre dz proposé et refusé
  const hd = rails.filter(r => r.convRaison === 'shift-out-of-domain' && Number.isFinite(r.dz));
  console.log('\nrails à calage refusé hors domaine : vert opérateur contre dz proposé');
  for (const r of hd.filter(r => r.d3 > 5 || r.dz > 5).sort((a, b) => b.dz - a.dz)) console.log(`  p${r.partie}/${r.cut} ${r.cote.padEnd(5)} dz ${f1(r.dz).padStart(6)} du ${f1(r.du).padStart(6)} | opérateur vert ${f1(r.vert).padStart(6)} lat ${f1(r.lat).padStart(6)} 3D ${f1(r.d3).padStart(5)} | pose−brut lat ${f1(r.adLat - r.nLat)} vert ${f1(r.adVert - r.nVert)} | ${r.stage} ${r.zone} ${r.palier} pts ${r.pts}`);
  if (csv) { const k = Object.keys(rails[0]); fs.writeFileSync(csv, k.join(';') + '\n' + rails.map(r => k.map(c => typeof r[c] === 'number' ? f1(r[c]) : r[c]).join(';')).join('\n') + '\n'); }
}
