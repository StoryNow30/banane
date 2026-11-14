/* CH-118 — inventaire des retouches de l'opérateur sur les posés d'Ariane, rail par rail (lecture seule).
 *   node chantiers/CH-118/outils/retouches.cjs J.json [J.json …] [--csv sortie.csv]
 * Entrée : tables de tools/jointure-echo-orbite.cjs (--sortie). Écart humain = pose finale de l'opérateur − pose d'Ariane,
 * repère profil du rail (longitudinal, latéral, vertical, mm). Le sens « intérieur » est calibré sur l'écartement :
 * Δécartement = écartement humain − écartement d'Ariane (invariant de repère), comparé à (lat droite − lat gauche).
 * Sortie : comptes et millimètres, numéros de cut ; aucune coordonnée absolue. */
'use strict';
const fs = require('fs');
const args = process.argv.slice(2); let csv = null; const fichiers = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--csv') csv = args[++i]; else fichiers.push(args[i]); }
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const lignes = [];
for (const f of fichiers) {
  const T = JSON.parse(fs.readFileSync(f, 'utf8')).table;
  for (const r of T) {
    if (r.classe !== 'posee' || !r.ecartHumain || r.referenceHumaine !== 'observee') continue;
    const e = r.ecartHumain; if (!e.gauche || !e.droite || e.gauche.repere !== 'profil') continue;
    lignes.push({ partie: r.partie, cut: r.cut, max: e.maxDist3dMm, g: e.gauche, dr: e.droite, etiquette: r.etiquetteEcho,
      ecAriane: r.poseAriane ? d(r.poseAriane.gauche, r.poseAriane.droite) * 1000 : null, ecHumain: r.poseHumaineFinale ? d(r.poseHumaineFinale.gauche, r.poseHumaineFinale.droite) * 1000 : null,
      stage: r.b1Ombre && r.b1Ombre.reel ? r.b1Ombre.reel.stage : '', reason: r.b1Ombre && r.b1Ombre.reel ? r.b1Ombre.reel.reason : '', duree: r.dureeVisiteS });
  }
}
module.exports = { lignes };
if (require.main === module) {
  const q = (v, p) => { const s = v.slice().sort((a, b) => a - b); if (!s.length) return null; const k = (s.length - 1) * p, lo = Math.floor(k); return s[lo] + (s[Math.ceil(k)] - s[lo]) * (k - lo); };
  const f1 = v => v == null ? '' : v.toFixed(1);
  const cl = e => e <= 2 ? 'a<=2' : e <= 5 ? 'b2-5' : e <= 10 ? 'c5-10' : e <= 50 ? 'd10-50' : 'e>50';
  const par = {}; for (const l of lignes) { const k = l.partie; (par[k] = par[k] || {})[cl(l.max)] = (par[k][cl(l.max)] || 0) + 1; }
  console.log('par partie', JSON.stringify(par));
  // calibrage du sens latéral : Δécartement contre (lat_d − lat_g)
  const cal = lignes.filter(l => l.ecAriane && l.ecHumain && l.max > 3).map(l => [l.ecHumain - l.ecAriane, l.dr.lateralMm - l.g.lateralMm]);
  const sgn = Math.sign(cal.reduce((s, [a, b]) => s + a * b, 0)); console.log('calibrage latéral, signe', sgn, 'n', cal.length, 'exemples', cal.slice(0, 5).map(x => x.map(f1).join('/')).join(' '));
  const ret = lignes.filter(l => l.max > 5 && l.max <= 50);
  console.log('retouchés 5-50 mm :', ret.length, ' juste<=2 :', lignes.filter(l => l.max <= 2).length, ' total jugés', lignes.length, ' >50 :', lignes.filter(l => l.max > 50).length);
  // composantes : par rail, latéral « vers l'intérieur » = + ; écartement ; vertical ; longitudinal
  const comp = (L, nom) => {
    const latInt = [], vert = [], lon = [], dEc = [], vertMoy = [], latMoy = [], devers = [];
    for (const l of L) {
      const iG = sgn * l.g.lateralMm, iD = -sgn * l.dr.lateralMm; latInt.push(iG, iD);
      vert.push(l.g.verticalMm, l.dr.verticalMm); lon.push(l.g.longitudinalMm, l.dr.longitudinalMm);
      dEc.push(sgn * (l.dr.lateralMm - l.g.lateralMm)); vertMoy.push((l.g.verticalMm + l.dr.verticalMm) / 2); latMoy.push(sgn * (l.g.lateralMm + l.dr.lateralMm) / 2); devers.push(l.dr.verticalMm - l.g.verticalMm);
    }
    const s = (n, v) => `${n} méd ${f1(q(v, .5))} [${f1(q(v, .25))};${f1(q(v, .75))}] moy ${f1(v.reduce((a, b) => a + b, 0) / v.length)} |méd| ${f1(q(v.map(Math.abs), .5))}`;
    console.log(`\n== ${nom} (n=${L.length})`); for (const [n, v] of [['latéral vers l\'intérieur (par rail)', latInt], ['Δécartement (+ = l\'opérateur élargit)', dEc], ['décalage latéral commun (+ = vers la droite)', latMoy], ['vertical par rail (+ = l\'opérateur remonte)', vert], ['vertical commun', vertMoy], ['dévers Δ (droite − gauche)', devers], ['longitudinal', lon]]) console.log('  ' + s(n, v));
    // composante dominante du pire rail
    const dom = { lat: 0, vert: 0, lon: 0 }; for (const l of L) { const r = l.g.dist3dMm >= l.dr.dist3dMm ? l.g : l.dr; const a = [['lat', Math.abs(r.lateralMm)], ['vert', Math.abs(r.verticalMm)], ['lon', Math.abs(r.longitudinalMm)]].sort((x, y) => y[1] - x[1]); dom[a[0][0]]++; }
    console.log('  composante dominante du pire rail', JSON.stringify(dom));
  };
  comp(ret, 'retouchés 5-50 mm'); comp(lignes.filter(l => l.max > 2 && l.max <= 5), 'entre 2 et 5 mm'); comp(lignes.filter(l => l.max <= 50), 'tous ≤ 50 mm');
  if (csv) fs.writeFileSync(csv, ['partie;cut;max;g_lon;g_lat;g_vert;d_lon;d_lat;d_vert;ec_ariane;ec_humain;stage;reason;etiquette;duree'].concat(lignes.map(l => [l.partie, l.cut, f1(l.max), f1(l.g.longitudinalMm), f1(l.g.lateralMm), f1(l.g.verticalMm), f1(l.dr.longitudinalMm), f1(l.dr.lateralMm), f1(l.dr.verticalMm), f1(l.ecAriane), f1(l.ecHumain), l.stage, l.reason || '', l.etiquette, l.duree].join(';'))).join('\n') + '\n');
}
