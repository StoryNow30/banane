/* CH-118 — simulation statique du levier « domaine étendu » (patch domaine-etendu.patch) sur des lots joints à l'Écho. Lecture seule.
 *   node chantiers/CH-118/outils/simuler.cjs --lot LIBELLE=J.json:T.json [--lot …] [--dzmax 13] [--separateur JSON] [--rails rails.csv] [--cuts cuts.csv]
 * Rail touché : calage refusé `shift-out-of-domain`, posé à la pose brute de GCV1 (|pose − brut| ≤ 1 mm en latéral et en vertical), |du| ≤ 8,
 * 8 < dz ≤ dzmax. Pose simulée = pose + (sign·du en latéral, dz en vertical), repère profil du rail. Les autres rails ne bougent pas : le ricochet
 * par les appuis est IGNORÉ (SUPPOSÉ petit : 1 cut sur 268 au rejeu du 14/10). `--separateur` : règle qui exclut un rail touché, objet
 * {ptsMin, topNMin, faceNMin, faceNMax, dzMax} (champ absent = pas de condition). Sortie : comptes, millimètres, numéros de cut. */
'use strict';
const fs = require('fs');
const a = process.argv.slice(2), lots = []; let dzmax = 13, sep = null, csvR = null, csvC = null;
for (let i = 0; i < a.length; i++) {
  if (a[i] === '--lot') { const [l, f] = a[++i].split('='); const [j, t] = f.split(':'); lots.push({ l, j, t }); }
  else if (a[i] === '--dzmax') dzmax = Number(a[++i]); else if (a[i] === '--separateur') sep = JSON.parse(a[++i]);
  else if (a[i] === '--rails') csvR = a[++i]; else if (a[i] === '--cuts') csvC = a[++i]; else throw Error('option ' + a[i]);
}
const q = (v, p) => { const s = v.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p, lo = Math.floor(k); return s[lo] + (s[Math.ceil(k)] - s[lo]) * (k - lo); };
const f1 = v => Number.isFinite(v) ? v.toFixed(1) : '';
const exclu = m => sep && ((sep.ptsMin != null && !(m.pts >= sep.ptsMin)) || (sep.topNMin != null && !(m.topN >= sep.topNMin)) || (sep.faceNMin != null && !(m.faceN >= sep.faceNMin)) || (sep.dzMax != null && !(m.dzMm <= sep.dzMax)) || (sep.faceNMax != null && !(m.faceN <= sep.faceNMax)));
const R = [], Cc = [], tab = [];
for (const L of lots) {
  const T = JSON.parse(fs.readFileSync(L.j, 'utf8')).table, X = JSON.parse(fs.readFileSync(L.t, 'utf8'));
  const st = { lot: L.l, poses: 0, differes: 0, juges: 0, av: [0, 0, 0], ap: [0, 0, 0], vJustesAv: [], vJustesAp: [], touches: 0, rapport: [], passes20: [], perdus10: [], gagnes10: 0, deg5: 0, accDepl: 0, zoneAig: { touches: 0, deg: 0 }, mv: { av: 0, ap: 0 } };
  for (const r of T) {
    if (r.classe === 'differee') st.differes++;
    if (r.classe !== 'posee') continue; st.poses++;
    const e = r.ecartHumain; if (!e || r.referenceHumaine !== 'observee' || !e.gauche || e.gauche.repere !== 'profil' || !e.droite) continue;
    st.juges++; const x = X[r.cut] || {}; const apres = {}; let touche = false;
    for (const [fr, s] of [['gauche', 'left'], ['droite', 'right']]) {
      const h = e[fr], m = x.rails && x.rails[s] || {}, ad = r.arianeDeplacement && r.arianeDeplacement[fr];
      const nd = m.nextDelta, brut = ad && nd && Math.abs(ad.lateralMm - nd[1] * 1000) <= 1 && Math.abs(ad.verticalMm - nd[2] * 1000) <= 1;
      const refuse = m.convRaison === 'shift-out-of-domain' && m.conv === false;
      const vise = refuse && brut && Math.abs(m.duMm) <= 8 && m.dzMm > 8 && m.dzMm <= dzmax;
      let lat = h.lateralMm, vert = h.verticalMm;
      if (refuse && brut && m.dzMm > 0) st.rapport.push(vert / m.dzMm);
      const applique = vise && !exclu(m);
      if (applique) { lat -= m.signe * m.duMm; vert -= m.dzMm; touche = true; }
      apres[fr] = { lat, vert, d3: Math.hypot(h.longitudinalMm, lat, vert) };
      if (refuse && brut) R.push({ lot: L.l, cut: r.cut, cote: s, pts: m.pts, topN: m.topN, faceN: m.faceN, dz: m.dzMm, du: m.duMm, conf: m.conf, zone: x.zone || '', stage: x.stage || '',
        vert: h.verticalMm, lat: h.lateralMm, d3: h.dist3dMm, d3ap: apres[fr].d3, applique, autreConv: (x.rails && x.rails[s === 'left' ? 'right' : 'left'] || {}).conv });
    }
    const av = e.maxDist3dMm, ap = Math.max(apres.gauche.d3, apres.droite.d3);
    const cl = v => v <= 10 ? 0 : v <= 50 ? 1 : 2; st.av[cl(av)]++; st.ap[cl(ap)]++;
    if (av <= 10) st.vJustesAv.push(e.gauche.verticalMm, e.droite.verticalMm); if (ap <= 10) st.vJustesAp.push(apres.gauche.vert, apres.droite.vert);
    if (touche) { st.touches++; const aig = /alerte|marge/.test(x.zone || ''); if (aig) { st.zoneAig.touches++; if (ap > av + 2) st.zoneAig.deg++; } }
    if (av <= 20 && ap > 20) st.passes20.push(r.cut); if (av <= 10 && ap > 10) st.perdus10.push(r.cut); if (av > 10 && ap <= 10) st.gagnes10++;
    if (ap - av > 5) st.deg5++; if (av <= 2 && ap > 2) st.accDepl++; if (av > 50) st.mv.av++; if (ap > 50) st.mv.ap++;
    Cc.push([L.l, r.cut, f1(av), f1(ap), touche].join(';'));
  }
  tab.push(st);
}
console.log('lot      posés diff jugés | ≤10 av→ap | 10-50 av→ap | >50 av→ap | vert méd justes av→ap (|v| méd) | touchés | gagnés/perdus 10 | passés >20 | dég>5 | acc dépl | rapport v/dz (n)');
const tot = { juges: 0, av: [0, 0, 0], ap: [0, 0, 0], g: 0, p: 0, p20: 0 };
for (const s of tab) {
  console.log(`${s.lot.padEnd(8)} ${String(s.poses).padStart(5)} ${String(s.differes).padStart(4)} ${String(s.juges).padStart(5)} | ${s.av[0]}→${s.ap[0]} | ${s.av[1]}→${s.ap[1]} | ${s.av[2]}→${s.ap[2]} | ${f1(q(s.vJustesAv, .5))}→${f1(q(s.vJustesAp, .5))} (${f1(q(s.vJustesAv.map(Math.abs), .5))}→${f1(q(s.vJustesAp.map(Math.abs), .5))}) | ${s.touches} (aig ${s.zoneAig.touches}, dég ${s.zoneAig.deg}) | ${s.gagnes10}/${s.perdus10.length}${s.perdus10.length ? ' [' + s.perdus10.join(' ') + ']' : ''} | ${s.passes20.length ? s.passes20.join(' ') : 0} | ${s.deg5} | ${s.accDepl} | ${f1(q(s.rapport, .5))} (${s.rapport.length})`);
  tot.juges += s.juges; for (let k = 0; k < 3; k++) { tot.av[k] += s.av[k]; tot.ap[k] += s.ap[k]; } tot.g += s.gagnes10; tot.p += s.perdus10.length; tot.p20 += s.passes20.length;
}
console.log(`TOTAL jugés ${tot.juges} | ≤10 ${tot.av[0]}→${tot.ap[0]} (${(100 * tot.av[0] / tot.juges).toFixed(1)} → ${(100 * tot.ap[0] / tot.juges).toFixed(1)} %) | 10-50 ${tot.av[1]}→${tot.ap[1]} | >50 ${tot.av[2]}→${tot.ap[2]} | gagnés ${tot.g} perdus ${tot.p} | passés >20 ${tot.p20}`);
if (csvR) { const k = Object.keys(R[0] || { lot: 0 }); fs.writeFileSync(csvR, k.join(';') + '\n' + R.map(r => k.map(c => typeof r[c] === 'number' ? f1(r[c]) : r[c]).join(';')).join('\n') + '\n'); }
if (csvC) fs.writeFileSync(csvC, 'lot;cut;avant_mm;apres_mm;touche\n' + Cc.join('\n') + '\n');
