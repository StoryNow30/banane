#!/usr/bin/env node
'use strict';
/*
 * metriques-version.cjs — MÉTRIQUES D'UNE VERSION sur la vérité terrain (chantier E5, plan 5.0).
 *
 * Entrée : une ou plusieurs tables de jointure Écho ↔ Orbite (tools/jointure-echo-orbite.cjs
 * --sortie table.json), chacune pouvant être suivie de son journal Orbite (pour la version
 * et le débit en cuts par heure). Lecture seule, aucune dépendance.
 *
 *   node tools/metriques-version.cjs --jointure T1.json [--journal J1.json] [--jointure T2.json …]
 *        [--journal-seul J.json …] [--version 4.9.0.12] [--json SORTIE.json] [--pause 120]
 *
 * --journal-seul J.json : sans Écho, donc sans vérité terrain. Une entrée par partie du journal ;
 * seules les métriques du journal sont données (différés, cuts par heure), jamais d'écart.
 *
 * Chaque jointure est mesurée seule (une partie ou un lot), puis toutes ensemble si
 * plusieurs. Définitions exactes : fiches/E5_METRIQUES.md. En bref (population « posée »
 * = cuts que le journal dit posés par Ariane ET dont l'Écho a observé une validation
 * humaine) :
 *   - écart 3D : par rail (gauche et droite mises ensemble) et par cut (le plus grand des deux) ;
 *   - corrigé de plus de 5 / 10 mm : écart 3D du cut STRICTEMENT supérieur au seuil ;
 *   - latéral et vertical : valeur absolue par rail, et biais (médiane signée) ;
 *   - différés : cuts différés ÷ cuts du journal ;
 *   - faux vert : cut posé corrigé de plus de 10 mm ÷ cuts posés avec référence ;
 *   - cuts par heure : cuts décidés au journal ÷ temps actif (pauses de plus de --pause s retirées).
 */
const fs = require('node:fs'), path = require('node:path');

const FORMAT = 'ariane-metriques-version-v1';
const SEUILS = [5, 10];

/* Quantile par interpolation linéaire (comme native-offline-evaluate.cjs). */
function quantile(valeurs, p) {
  const s = valeurs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const x = (s.length - 1) * p, i = Math.floor(x), f = x - i;
  return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * f : s[i];
}
const r1 = v => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
const stats = v => {
  const f = v.filter(Number.isFinite);
  return f.length ? { n: f.length, medianeMm: r1(quantile(f, .5)), p90Mm: r1(quantile(f, .9)), maxMm: r1(Math.max(...f)) } : { n: 0, medianeMm: null, p90Mm: null, maxMm: null };
};
const taux = (n, d) => (d ? { n, sur: d, pct: Math.round(n / d * 1000) / 10 } : { n, sur: d, pct: null });

function lireOptions(argv) {
  const o = { entrees: [], version: null, json: null, pause: 120 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--jointure') o.entrees.push({ jointure: argv[++i], journal: null });
    else if (a === '--journal') { if (!o.entrees.length) throw new Error('--journal doit suivre un --jointure'); o.entrees.at(-1).journal = argv[++i]; }
    else if (a === '--journal-seul') o.entrees.push({ jointure: null, journal: argv[++i], seul: true });
    else if (a === '--version') o.version = argv[++i];
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--pause') o.pause = Number(argv[++i]);
    else throw new Error(`option inconnue : ${a}`);
  }
  return o;
}

/* Distances de chaque rail et du cut, valeurs absolues latérales et verticales, signées pour le biais. */
function mesures(lignes) {
  const rails = [], cuts = [], lat = [], vert = [], latS = [], vertS = [];
  let railsSup5 = 0, railsSup10 = 0, sansRepere = 0;
  for (const l of lignes) {
    const e = l.ecartHumain;
    let maxCut = Number.isFinite(e.maxDist3dMm) ? e.maxDist3dMm : null;
    for (const r of ['gauche', 'droite']) {
      const m = e[r];
      if (!m || !Number.isFinite(m.dist3dMm)) continue;
      rails.push(m.dist3dMm);
      if (m.dist3dMm > 5) railsSup5++;
      if (m.dist3dMm > 10) railsSup10++;
      if (m.repere === 'profil' && Number.isFinite(m.lateralMm) && Number.isFinite(m.verticalMm)) {
        lat.push(Math.abs(m.lateralMm)); vert.push(Math.abs(m.verticalMm)); latS.push(m.lateralMm); vertS.push(m.verticalMm);
      } else sansRepere++;
      if (maxCut === null || m.dist3dMm > maxCut) maxCut = m.dist3dMm;
    }
    if (maxCut !== null) cuts.push(maxCut);
  }
  return { rails, cuts, lat, vert, latS, vertS, railsSup5, railsSup10, sansRepere };
}

function blocEcarts(lignes) {
  const m = mesures(lignes);
  const sup = s => m.cuts.filter(v => v > s).length;
  const moyenne = v => (v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null);
  return {
    cuts: m.cuts.length,
    ecart3dParRail: stats(m.rails),
    ecart3dParCut: stats(m.cuts),
    lateralAbsParRail: stats(m.lat),
    verticalAbsParRail: stats(m.vert),
    biaisMoyenMm: { lateral: moyenne(m.latS), vertical: moyenne(m.vertS) },
    corriges: { sup5mm: taux(sup(5), m.cuts.length), sup10mm: taux(sup(10), m.cuts.length), railsSup5mm: m.railsSup5, railsSup10mm: m.railsSup10 },
    railsSansRepereProfil: m.sansRepere,
  };
}

function blocDifferes(table) {
  const dansJournal = table.filter(l => l.dansJournal);
  const diff = dansJournal.filter(l => l.classe === 'differee');
  const parMotif = {};
  for (const l of diff) {
    const motifs = new Set();
    if (!l.motifDiffere) continue;
    for (const r of ['gauche', 'droite']) { const x = l.motifDiffere?.[r]; if (x && x.statut === 'unresolved' && x.motif) motifs.add(x.motif); }
    if (!motifs.size) motifs.add('inconnu');
    for (const k of motifs) parMotif[k] = (parMotif[k] || 0) + 1;
  }
  const classes = {};
  for (const l of dansJournal) classes[l.classe] = (classes[l.classe] || 0) + 1;
  return { cutsAuJournal: dansJournal.length, parClasse: classes, differes: taux(diff.length, dansJournal.length), parMotifDeRail: Object.fromEntries(Object.entries(parMotif).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) };
}

/* Cuts par heure depuis un journal Orbite : un cut est décidé quand il porte un validation-accepted
 * ou un defer-finalized (le plus tardif compte). Temps actif = somme des intervalles entre décisions
 * successives, hors pauses (intervalle > pause secondes). */
function debitJournal(journal, partie, pause) {
  const derniers = new Map();
  for (const e of journal.events || []) {
    if (e.type !== 'validation-accepted' && e.type !== 'defer-finalized') continue;
    if (partie !== null && e.identity?.part !== partie) continue;
    const t = Date.parse(e.timestamp), cut = e.identity?.cut;
    if (!Number.isFinite(t) || !Number.isFinite(cut)) continue;
    if (!derniers.has(cut) || t > derniers.get(cut)) derniers.set(cut, t);
  }
  const ts = [...derniers.values()].sort((a, b) => a - b);
  if (ts.length < 2) return { disponible: false, raison: 'moins de deux cuts décidés au journal', cuts: ts.length };
  let actif = 0, pauses = 0;
  for (let i = 1; i < ts.length; i++) { const d = (ts[i] - ts[i - 1]) / 1000; if (d > pause) pauses++; else actif += d; }
  const total = (ts.at(-1) - ts[0]) / 1000;
  const h = s => Math.round((ts.length - 1) / (s / 3600) * 10) / 10;
  return { disponible: true, cutsDecides: ts.length, dureeTotaleMin: Math.round(total / 6) / 10, dureeActiveMin: Math.round(actif / 6) / 10, pauses, pauseSeuilS: pause,
    cutsParHeureBrut: total > 0 ? h(total) : null, cutsParHeureActif: actif > 0 ? h(actif) : null };
}

/* Classes depuis le journal seul, une table par partie (mêmes règles que la jointure : posé = validation
 * acceptée ou pose vérifiée ; différé = différé finalisé et jamais posé ; autre = proposé sans issue). */
function tablesDuJournal(journal) {
  const parties = new Map();
  for (const e of journal.events || []) {
    const id = e.identity;
    if (!id || !Number.isFinite(id.part) || !Number.isFinite(id.cut)) continue;
    if (!['proposed', 'before-captured', 'validation-accepted', 'applied-verified', 'defer-finalized'].includes(e.type)) continue;
    if (!parties.has(id.part)) parties.set(id.part, new Map());
    const cuts = parties.get(id.part);
    const c = cuts.get(id.cut) || { posee: false, differee: false };
    if (e.type === 'validation-accepted' || e.type === 'applied-verified') c.posee = true;
    if (e.type === 'defer-finalized') c.differee = true;
    cuts.set(id.cut, c);
  }
  return [...parties].sort((a, b) => a[0] - b[0]).map(([partie, cuts]) => ({ format: 'ariane-jointure-echo-orbite-v1', table: [...cuts].sort((a, b) => a[0] - b[0]).map(([cut, c]) => ({
    partie, cut, classe: c.posee ? 'posee' : c.differee ? 'differee' : 'autre', dansEcho: false, dansJournal: true, referenceHumaine: 'absent-de-l-echo' })) }));
}

function metriquesTable(table, journal, o) {
  const lignes = table.table;
  const posees = lignes.filter(l => l.dansJournal && l.classe === 'posee');
  const poseesRef = posees.filter(l => l.referenceHumaine === 'observee' && l.ecartHumain);
  const horsJournal = lignes.filter(l => l.classe === 'hors-journal' && l.referenceHumaine === 'observee' && l.ecartHumain);
  const diffRef = lignes.filter(l => l.classe === 'differee' && l.referenceHumaine === 'observee' && l.ecartHumain);
  const ecarts = blocEcarts(poseesRef);
  const fv = ecarts.corriges.sup10mm;
  const parties = [...new Set(lignes.map(l => l.partie))].sort((a, b) => a - b);
  return {
    parties,
    version: o.version || journal?.version || null,
    posees: { cutsAuJournal: posees.length, avecReference: poseesRef.length, sansReference: posees.filter(l => l.referenceHumaine === 'sans-reference').length,
      absentsDeLEcho: posees.filter(l => l.referenceHumaine === 'absent-de-l-echo').length, ...ecarts },
    differes: blocDifferes(lignes),
    differesEcartHumain: { avecReference: diffRef.length, ...blocEcarts(diffRef) },
    fauxVerts: {
      definition: 'cut posé par Ariane, corrigé de plus de 10 mm par l\'opérateur, sur les cuts posés avec référence humaine',
      parRapportAuxPosesAvecReference: fv,
      borneBasseSurTousLesPoses: taux(fv.n, posees.length),
    },
    horsJournal: { avecReference: horsJournal.length, note: 'verts d\'extraction et autres cuts visités par l\'opérateur hors du journal ; pas des poses d\'Ariane', ...blocEcarts(horsJournal) },
    debit: journal ? debitJournal(journal, parties.length === 1 ? parties[0] : null, o.pause) : { disponible: false, raison: 'journal non fourni' },
  };
}

function metriques(entrees, options = {}) {
  const o = { version: null, pause: 120, ...options };
  const parTable = entrees.map(e => ({ source: e.nom || null, sansVeriteTerrain: !!e.seul, ...metriquesTable(e.table, e.journal, o) }));
  const sortie = { format: FORMAT, seuilsMm: SEUILS, version: o.version || parTable.map(p => p.version).find(Boolean) || null, tables: parTable };
  const versions = new Set(parTable.map(p => p.version).filter(Boolean));
  if (entrees.length > 1 && versions.size > 1) sortie.ensembleOmis = `versions différentes (${[...versions].join(', ')}) : pas de total, une version se juge seule`;
  else if (entrees.length > 1) sortie.ensemble = { source: 'toutes les jointures', ...metriquesTable({ table: entrees.flatMap(e => e.table.table) }, null, o) };
  return sortie;
}

/* ---- sortie lisible ---- */
const f = v => (v === null || v === undefined ? '—' : v.toFixed(1).replace('.', ','));
const st = s => `n=${s.n} médiane ${f(s.medianeMm)} P90 ${f(s.p90Mm)} max ${f(s.maxMm)} mm`;
const tx = t => `${t.n}/${t.sur}${t.pct === null ? '' : ` (${f(t.pct)} %)`}`;
const debitTexte = g => (g.disponible ? `Débit : ${g.cutsDecides} cuts décidés en ${f(g.dureeTotaleMin)} min (actif ${f(g.dureeActiveMin)} min, ${g.pauses} pause(s) > ${g.pauseSeuilS} s) : ${f(g.cutsParHeureBrut)} cuts/h brut, ${f(g.cutsParHeureActif)} cuts/h actif.`
  : `Débit : indisponible (${g.raison}).`);
function texte(m) {
  const L = [];
  L.push(`Métriques de version ${m.version || '(version inconnue)'} — ${m.format}`);
  if (m.ensembleOmis) L.push(`(${m.ensembleOmis})`);
  for (const t of m.tables.concat(m.ensemble ? [m.ensemble] : [])) {
    L.push('', `== ${t.source || '?'} — partie(s) ${t.parties.join(', ')}${t.version ? ` — version ${t.version}` : ''}`);
    const p = t.posees;
    if (t.sansVeriteTerrain) {
      L.push(`Journal seul, sans Écho : ${p.cutsAuJournal} cuts posés au journal ; aucun écart ni faux vert mesurable.`);
      L.push(`Différés : ${tx(t.differes.differes)} des cuts du journal (${Object.entries(t.differes.parClasse).map(([k, n]) => `${k} ${n}`).join(', ')}).`);
      L.push(debitTexte(t.debit));
      continue;
    }
    L.push(`Cuts posés par Ariane : ${p.cutsAuJournal} au journal, ${p.avecReference} avec référence humaine, ${p.sansReference} sans validation observée, ${p.absentsDeLEcho} absents de l'Écho.`);
    L.push(`  écart 3D par rail  : ${st(p.ecart3dParRail)}`);
    L.push(`  écart 3D par cut   : ${st(p.ecart3dParCut)}`);
    L.push(`  latéral |.| rail   : ${st(p.lateralAbsParRail)}`);
    L.push(`  vertical |.| rail  : ${st(p.verticalAbsParRail)}`);
    L.push(`  biais moyen signé  : latéral ${f(p.biaisMoyenMm.lateral)} mm, vertical ${f(p.biaisMoyenMm.vertical)} mm`);
    L.push(`  corrigés > 5 mm    : ${tx(p.corriges.sup5mm)} cuts (${p.corriges.railsSup5mm} rails)`);
    L.push(`  corrigés > 10 mm   : ${tx(p.corriges.sup10mm)} cuts (${p.corriges.railsSup10mm} rails)`);
    L.push(`Faux verts (posé puis corrigé > 10 mm) : ${tx(t.fauxVerts.parRapportAuxPosesAvecReference)} des posés avec référence ; borne basse ${tx(t.fauxVerts.borneBasseSurTousLesPoses)} de tous les posés.`);
    const d = t.differes;
    L.push(`Différés : ${tx(d.differes)} des cuts du journal (${Object.entries(d.parClasse).map(([k, n]) => `${k} ${n}`).join(', ')}).`);
    if (Object.keys(d.parMotifDeRail).length) L.push(`  motifs (cuts, un cut compte pour chaque motif de rail) : ${Object.entries(d.parMotifDeRail).map(([k, n]) => `${k} ${n}`).join(', ')}`);
    L.push(`  écart humain sur les différés (${t.differesEcartHumain.avecReference} avec référence) : par rail ${st(t.differesEcartHumain.ecart3dParRail)}`);
    L.push(`Hors journal (${t.horsJournal.avecReference} avec référence) : par rail ${st(t.horsJournal.ecart3dParRail)} ; corrigés > 10 mm ${tx(t.horsJournal.corriges.sup10mm)}`);
    L.push(debitTexte(t.debit));
  }
  return L.join('\n') + '\n';
}

function charger(chemin) {
  const t = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  if (t?.format !== 'ariane-jointure-echo-orbite-v1' || !Array.isArray(t.table)) throw new Error(`${path.basename(chemin)} : table de jointure attendue`);
  return t;
}

module.exports = { metriques, tablesDuJournal, texte, quantile, debitJournal, lireOptions, charger, FORMAT };

if (require.main === module) {
  let o;
  try { o = lireOptions(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (!o.entrees.length) { console.error('Usage : --jointure T.json [--journal J.json] [--jointure …] [--journal-seul J.json] [--version V] [--json SORTIE.json] [--pause 120]'); process.exit(2); }
  const entrees = o.entrees.flatMap(e => {
    const journal = e.journal ? JSON.parse(fs.readFileSync(e.journal, 'utf8')) : null;
    if (e.seul) return tablesDuJournal(journal).map(table => ({ nom: `${path.basename(e.journal)} (partie ${table.table[0]?.partie})`, table, journal, seul: true }));
    return [{ nom: path.basename(e.jointure), table: charger(e.jointure), journal }];
  });
  const m = metriques(entrees, o);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(m, null, 1));
  process.stdout.write(texte(m));
}
