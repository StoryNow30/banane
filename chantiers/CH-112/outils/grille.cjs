#!/usr/bin/env node
'use strict';
/* CH-112 : grille de réglages du signe « voie des cuts sûrs » sur tous les lots jugés, par lot, et sorties par cut.
 *   CH112_DONNEES=<dossier> node grille.cjs [--sorties dossier]   */
const fs = require('node:fs');
const path = require('node:path');
const R = require('./regle-voie.cjs');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const donnees = [];
for (const l of require('./lots.cjs')) {
  const J = JSON.parse(fs.readFileSync(l.journal, 'utf8'));
  for (const q of l.parties) donnees.push({ lot: l.lot, partie: q.partie, d: R.charger(J, q.liste, q.partie, q.jointure) });
}
const grille = [];
for (const courbure of [0, 1, 2, 3]) for (const seuil of [60, 80, 100, 120, 150]) for (const ecart of [8, 10, 12, 16, 20])
  grille.push({ methode: 'profil1', courbure, seuil, ecart, abstenuSur: false, marges: false });
const lignes = [];
for (const g of grille) {
  const parLot = {};
  for (const x of donnees) {
    const r = R.rejouer(x.d, g), b = R.bilan(r, x.d.etiquettes);
    const k = x.lot; parLot[k] = parLot[k] || { faux50: 0, faux50A: 0, faux10: 0, faux10A: 0, bons: 0, bonsA: 0, bonsZone: 0, bonsZoneA: 0, nonJ: 0, poses: 0, arrets: 0 };
    const p = parLot[k];
    for (const o of r) {
      const e = x.d.etiquettes.get(o.cut); p.poses++; if (o.arret) p.arrets++;
      if (e === null || e === undefined) { if (o.arret) p.nonJ++; continue; }
      if (e > 50) { p.faux50++; if (o.arret) p.faux50A++; }
      if (e > 10) { p.faux10++; if (o.arret) p.faux10A++; } else { p.bons++; if (o.arret) p.bonsA++; if (o.zone === 'alerte') { p.bonsZone++; if (o.arret) p.bonsZoneA++; } }
    }
  }
  lignes.push({ ...g, parLot });
}
const tot = (pl, ks) => ks.reduce((a, k) => { for (const [c, v] of Object.entries(pl[k] || {})) a[c] = (a[c] || 0) + v; return a; }, {});
const lots = [...new Set(donnees.map(x => x.lot))];
console.log('methode seuil G | 11/11 : faux50 >10 bons(zone) nonJ | autres : faux50 >10 bons(zone) nonJ');
for (const l of lignes) {
  const a = tot(l.parLot, ['11/11']), b = tot(l.parLot, lots.filter(x => x !== '11/11'));
  console.log(`K${l.courbure} ${l.seuil} ${l.ecart} | ${a.faux50A}/${a.faux50} ${a.faux10A}/${a.faux10} ${a.bonsA}/${a.bons}(${a.bonsZoneA}/${a.bonsZone}) ${a.nonJ} | ${b.faux50A}/${b.faux50} ${b.faux10A}/${b.faux10} ${b.bonsA}/${b.bons}(${b.bonsZoneA}/${b.bonsZone}) ${b.nonJ}`);
}
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(lignes));
