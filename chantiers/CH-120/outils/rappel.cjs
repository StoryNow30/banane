#!/usr/bin/env node
'use strict';
/* CH-120 : tableaux du rappel du pool (sorties de mesure-pool.cjs). Lecture seule.
 *   node chantiers/CH-120/outils/rappel.cjs DOSSIER [--avec-courtes] [--ref DOSSIER_REF] [--csv F]
 * Classe A : bonne paire (les deux rails à 10 mm) dans le pool ; B : un rail ; C : aucun. « H » = hypothèses H0-H6 ; « eff » = H plus la
 * recherche recentrée livrée. Causes d'absence d'un rail (pool effectif). Avec --ref : cuts dont la classe change contre la référence. */
const fs = require('node:fs'), path = require('node:path');
const a = process.argv.slice(2), dir = a[0], courtes = a.includes('--avec-courtes');
const ref = a.includes('--ref') ? a[a.indexOf('--ref') + 1] : null, csv = a.includes('--csv') ? a[a.indexOf('--csv') + 1] : null;
const lire = d => fs.readdirSync(d).filter(f => f.endsWith('.jsonl')).flatMap(f => fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter(Boolean)
  .map(s => ({ ...JSON.parse(s), fichier: f.replace('.jsonl', '') })));
const garder = x => !x.sansVerite && (courtes || !x.exclu);
const L = lire(dir).filter(garder);
const SIDES = ['left', 'right'];
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
const cl = (x, k) => x[k] === 'A' ? ((k === 'classePool' ? x.admissible : x.admissibleEffective) ? 'A*' : 'A') : x[k];
const tab = (titre, f) => {
  const g = new Map();
  for (const x of L) { const k = f(x); if (k == null) continue; if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  console.log(`\n### ${titre}\n| groupe | n | H : A* / A / B / C | eff : A* / A / B / C | rappel eff (A+A*) |\n|---|---|---|---|---|`);
  for (const [k, v] of [...g].sort()) {
    const c = key => ['A*', 'A', 'B', 'C'].map(z => v.filter(x => cl(x, key) === z).length).join(' / ');
    const ra = v.filter(x => x.classeEffective === 'A').length;
    console.log(`| ${k} | ${v.length} | ${c('classePool')} | ${c('classeEffective')} | ${(100 * ra / v.length).toFixed(1)} % |`);
  }
};
console.log(`# Rappel du pool : ${dir} (${L.length} cuts jugés avec nuage${courtes ? ', D-285 compris' : ''})`);
tab('Total', () => 'tous');
tab('Par zone', x => x.zone);
tab('Par sort au lot', x => x.classe);
tab('ADV par sort', x => x.zone === 'adv' ? x.classe : null);
const causes = new Map();
for (const x of L) for (const s of SIDES) { const c = cause(x.rails[s]); if (!c) continue; const k = `${x.zone === 'adv' ? 'adv' : 'hors-adv'} ${c}`; causes.set(k, (causes.get(k) || 0) + 1); }
console.log('\n### Causes d\'absence d\'un rail (pool effectif ; rails)\n| zone, cause | rails |\n|---|---|');
for (const [k, v] of [...causes].sort((p, q) => q[1] - p[1])) console.log(`| ${k} | ${v} |`);
if (ref) {
  const R = new Map(lire(ref).filter(garder).map(x => [x.fichier + ':' + x.cut, x]));
  const ch = L.filter(x => R.has(x.fichier + ':' + x.cut) && R.get(x.fichier + ':' + x.cut).classeEffective !== x.classeEffective);
  console.log(`\n### Changements contre ${ref} : ${ch.length}`);
  const m = new Map(); for (const x of ch) { const k = `${R.get(x.fichier + ':' + x.cut).classeEffective}→${x.classeEffective} (${x.zone})`; m.set(k, (m.get(k) || 0) + 1); }
  for (const [k, v] of m) console.log(`- ${k} : ${v}`);
}
if (csv) fs.writeFileSync(csv, 'fichier,cut,zone,classe,exclu,H,eff,admEff,causeG,causeD,dminG,dminD\n' + L.map(x => [x.fichier, x.cut, x.zone, x.classe, x.exclu || '', x.classePool, x.classeEffective,
  x.admissibleEffective ?? '', cause(x.rails.left) || '', cause(x.rails.right) || '', Math.min(x.rails.left.dmin ?? 1e9, x.rails.left.rech?.dmin ?? 1e9), Math.min(x.rails.right.dmin ?? 1e9, x.rails.right.rech?.dmin ?? 1e9)].join(',')).join('\n') + '\n');
