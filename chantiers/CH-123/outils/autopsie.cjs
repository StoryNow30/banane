#!/usr/bin/env node
'use strict';
/* CH-123 : autopsie des cuts hors du pool (classe effective B ou C), une ligne par cut et par rail manquant. Lecture seule.
 *   node chantiers/CH-123/outils/autopsie.cjs DOSSIER_MESURE VERITES.json [--csv F] [--resume]
 * DOSSIER_MESURE : sorties de mesure-ch123.cjs ; VERITES : fichier de verites.cjs (CH-120) pour l'étiquette du lot.
 * Cause : celle de CH-120 (rappel.cjs), puis le diagnostic de CH-123 :
 *   vide        : aucun point du nuage à la vérité (dessus 0) ;
 *   oracle-ok   : le moteur recentré SUR la vérité y trouve une cellule à 10 mm (le nuage porte le rail : il manque une graine ou un filtre l'écarte) ;
 *   oracle-loin : le moteur recentré sur la vérité n'y trouve rien à 10 mm (le moteur ne voit pas ce rail, même bien placé) ;
 *   compagnon   : (classe B) le rail manquant, ramené à l'écartement de référence depuis l'autre rail présent, tombe à 10 mm d'une cellule
 *                 du moteur qui est elle-même à 10 mm de la vérité. */
const fs = require('node:fs'), path = require('node:path');
const a = process.argv.slice(2), dir = a[0], V = JSON.parse(fs.readFileSync(a[1], 'utf8'));
const csv = a.includes('--csv') ? a[a.indexOf('--csv') + 1] : null;
const SIDES = ['left', 'right'];
const L = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean)
  .map(s => ({ ...JSON.parse(s), fichier: f.replace('.jsonl', '') }))).filter(x => !x.sansVerite && !x.exclu);
const cause = r => {
  if (r.present || (r.rech && r.rech.present)) return null;
  if (r.moteur) return 'moteur-sans-repere';
  const sout = r.soutien && r.soutien.dessus >= 5 && r.soutien.flanc >= 3;
  if (r.cadre === false) return sout ? 'hors-cadre-soutenu' : 'hors-cadre';
  if (r.fenetre === false) return sout ? 'hors-fenetre-soutenu' : 'hors-fenetre-sans-soutien';
  if (!sout) return 'sans-soutien';
  const c = r.cellule;
  if (c && c.d <= 10) return (c.comp || c.strong) ? 'tronquee' : 'cellule-ecartee-' + (c.motif || '?');
  return 'non-detecte' + (c ? (c.d <= 20 ? '-cellule-10-20' : '-cellule-loin') : '');
};
const lignes = [];
const ch120 = c => /^hors-(fenetre|cadre)/.test(c);
for (const x of L) {
  if (x.classeEffective === 'A') continue;
  const [lot8, partie] = x.fichier.split('-'), v = V[`${lot8}:${partie}:${x.cut}`] || {};
  for (const s of SIDES) {
    const r = x.rails[s], c = cause(r); if (!c) continue;
    const au = x.autopsie && x.autopsie.rails[s] || {};
    const o = au.oracle || {};
    const comp = (au.compagnon || []).filter(e => e && e.celluleVerite);
    const bc = comp.sort((p, q) => p.celluleVerite.d - q.celluleVerite.d)[0];
    const diag = r.soutien && r.soutien.dessus === 0 ? 'vide' : (Number.isFinite(o.d) && o.d <= 10 ? 'oracle-ok' : 'oracle-loin');
    const compOk = !!(bc && bc.celluleVerite.d <= 10 && bc.celluleVerite.dGraine <= 10);
    lignes.push({ lot: v.lot || lot8, partie: Number(partie), cut: x.cut, zone: x.zone, sort: x.classe, classe: x.classeEffective, rail: s, cause: c,
      terrain: x.zone === 'adv' && ch120(c) ? 'CH-120' : 'CH-123', dmin: Math.min(r.dmin ?? 1e9, r.rech && r.rech.dmin != null ? r.rech.dmin : 1e9),
      latV: au.verite ? au.verite[1] : null, vertV: au.verite ? au.verite[2] : null, dessus: r.soutien ? r.soutien.dessus : null, flanc: r.soutien ? r.soutien.flanc : null,
      cel: r.cellule ? `${r.cellule.d}mm t${r.cellule.top} f${r.cellule.faces} ${r.cellule.comp ? 'C' : ''}${r.cellule.strong ? 'S' : ''} ${r.cellule.motif || ''}`.trim() : '',
      oracle: Number.isFinite(o.d) ? `${o.d}mm t${o.top} f${o.face} r${o.ratio}${o.fort ? ' F' : ''}` : (o.moteur || o.erreur || 'rien'),
      diag, compagnon: bc ? `g${bc.dGauge} cel${bc.celluleVerite.d}/${bc.celluleVerite.dGraine} t${bc.celluleVerite.top} f${bc.celluleVerite.face} r${bc.celluleVerite.ratio}` : '',
      compOk, graines: x.recherche ? x.recherche.graines.join('+') : '', gRef: x.autopsie ? x.autopsie.gRef + (x.autopsie.refSource === 'liste' ? 'L' : 'm') : '',
      decision: x.decision ? `${x.decision.etat}/${x.decision.motif}` : '' });
  }
}
const cuts = new Set(lignes.map(l => `${l.lot}-${l.partie}:${l.cut}`));
console.log(`# Autopsie CH-123 : ${cuts.size} cuts hors du pool (B ou C), ${lignes.length} rails manquants\n`);
const compte = (titre, f) => { const m = new Map(); for (const l of lignes) { const k = f(l); m.set(k, (m.get(k) || 0) + 1); }
  console.log(`\n## ${titre}\n| clé | rails |\n|---|---|`); for (const [k, n] of [...m].sort((p, q) => q[1] - p[1])) console.log(`| ${k} | ${n} |`); };
compte('Terrain × cause', l => `${l.terrain} ${l.zone === 'adv' ? 'adv' : 'hors-adv'} ${l.cause}`);
compte('Terrain × diagnostic', l => `${l.terrain} ${l.diag}${l.classe === 'B' ? (l.compOk ? ' compagnon-ok' : ' compagnon-non') : ''}`);
compte('Cause × diagnostic (mon terrain)', l => l.terrain === 'CH-123' ? `${l.cause} → ${l.diag}` : 'CH-120');
if (a.includes('--detail')) {
  console.log('\n## Détail (une ligne par rail)\n| lot | p | cut | zone | sort | cl | rail | cause | terrain | dmin | lat/vert vérité | dessus/flanc | cellule la plus proche | oracle | diag | compagnon | graines | réf | décision |\n|' + '---|'.repeat(19));
  for (const l of lignes.sort((p, q) => (p.lot + p.partie).localeCompare(q.lot + q.partie) || p.cut - q.cut))
    console.log(`| ${l.lot} | ${l.partie} | ${l.cut} | ${l.zone} | ${l.sort} | ${l.classe} | ${l.rail[0]} | ${l.cause} | ${l.terrain} | ${l.dmin} | ${l.latV}/${l.vertV} | ${l.dessus}/${l.flanc} | ${l.cel} | ${l.oracle} | ${l.diag} | ${l.compagnon}${l.compOk ? ' ✓' : ''} | ${l.graines} | ${l.gRef} | ${l.decision} |`);
}
if (csv) { const k = Object.keys(lignes[0]); fs.writeFileSync(csv, k.join(',') + '\n' + lignes.map(l => k.map(c => String(l[c] ?? '').replace(/,/g, ';')).join(',')).join('\n') + '\n'); }
