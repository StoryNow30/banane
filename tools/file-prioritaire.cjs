#!/usr/bin/env node
'use strict';
/*
 * file-prioritaire.cjs — CH-053-S (cible T2) : SIMULATION hors ligne de l'ordre de travail de l'opérateur, et FILE PRIORITAIRE des cuts à corriger.
 * Lecture seule, aucune dépendance, aucune écriture hors `--json`.
 *
 *   node tools/file-prioritaire.cjs simuler --table T.json [--table …] --echo DOSSIER [--saut S] [--plancher P] [--taux-defaut] [--json SORTIE.json]
 *   node tools/file-prioritaire.cjs file    --table T.json [--table …] [--echo DOSSIER] [--verts V.json] [--critere informatif|avec-traits] [--ordre rendement|balayage] [--json SORTIE.json]
 *   node tools/file-prioritaire.cjs echantillon --table T.json --partie N --taille 125 --graine G [--json SORTIE.json]
 *
 * simuler : compare, sur les cuts que l'opérateur a visités (seuls à avoir un résultat connu), l'ordre ACTUEL (ordre réel des visites) à la FILE
 *   (src/file-prioritaire.js) : informatifs (paire qualifiée ET correction de plus de 10 mm), temps de visite, informatifs par minute. Les taux de classe
 *   de chaque partie sont appris SANS cette partie (validation croisée par partie). Un saut vers un cut non voisin coûte `--saut` secondes
 *   `--taux-defaut` : juge la file avec les taux mesurés le 04/11 (src/file-prioritaire.js), sans rien apprendre de la partie jugée (parties réservées).
 *   (6 s par défaut : écart mesuré entre visites après saut et visites voisines, le 04/11). Sorties : comptes, secondes, rapports ; aucun numéro de cut.
 * file : la file d'une partie, d'après les tables de jointure (classe, motif de différé) ; les cuts déjà jugés par l'Écho (`--echo`) sont écartés ;
 *   les verts viennent de `--verts` (liste [{part, cut, score}] de src/verts-a-controler.js). Sortie avec numéros de cut : elle reste hors dépôt.
 */
const fs = require('node:fs'), path = require('node:path');
const F = require('../src/file-prioritaire.js');

const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const r2 = v => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const COUT_SAUT_DEFAUT_S = 6, VISITE_COURTE_S = 1.5, SEUIL_INFORMATIF_MM = 10, COUT_VISITE_MAX_S = 120;
const HORS_CONTRAT = 'gauge-out-of-contract/gauge-out-of-contract';

/* Un candidat synthétique de la classe donnée (la simulation range des cuts dont la classe est connue). */
function candidatDe(o) {
  const c = { part: o.part, cut: o.cut };
  switch (o.classe) {
    case 'D-contrat': return { ...c, source: 'differe', motif: HORS_CONTRAT };
    case 'D-sanspoints': return { ...c, source: 'differe', motif: 'input/input' };
    case 'D-points': return { ...c, source: 'differe', motif: 'candidate/candidate' };
    case 'vert-fort': return { ...c, source: 'vert', score: 3 };
    case 'vert-moyen': return { ...c, source: 'vert', score: 1.5 };
    case 'vert-faible': return { ...c, source: 'vert', score: 0.5 };
    case 'vert-inconnu': return { ...c, source: 'vert', score: null };
    default: return { ...c, source: 'posee' };
  }
}
const coutBase = (o, saut) => Math.max(o.coutS - (o.sautReel || 0) * saut, Math.min(0.5, o.coutS));

/* Temps d'un parcours : coût de base de chaque cut, plus `saut` à l'entrée de chaque plage (changement de partie ou cut non voisin). */
function parcours(liste, saut) {
  let t = 0, prec = null, inf = 0;
  for (const o of liste) { t += coutBase(o, saut) + (!prec || prec.part !== o.part || Math.abs(o.cut - prec.cut) > 1 ? saut : 0); if (o.informatif) inf++; prec = o; }
  return { cuts: liste.length, informatifs: inf, tempsS: r1(t), parMin: t > 0 ? r1(inf / t * 60) : 0 };
}

function simuler(obs, { coutSaut = COUT_SAUT_DEFAUT_S, plancher = F.PLANCHER_PAR_MIN, tauxFixes = null } = {}) {
  const parties = [...new Set(obs.map(o => o.part))].sort((a, b) => a - b);
  const actuelListe = obs.slice().sort((a, b) => a.premiereVisite - b.premiereVisite);
  const tActuel = actuelListe.reduce((a, o) => a + o.coutS, 0), infActuel = actuelListe.filter(o => o.informatif).length;
  const actuel = { cuts: actuelListe.length, informatifs: infActuel, tempsS: r1(tActuel), parMin: tActuel > 0 ? r1(infActuel / tActuel * 60) : 0 };
  const file = [], tete = [];
  for (const p of parties) {
    /* `tauxFixes` : jugement d'une partie réservée, les taux (appris ailleurs) ne bougent pas ; sinon validation croisée par partie. */
    const taux = tauxFixes || F.apprendreTaux(obs.filter(o => o.part !== p));
    const deP = obs.filter(o => o.part === p), parCle = new Map(deP.map(o => [o.cut, o]));
    const R = F.ordonner(deP.map(candidatDe), { taux, plancherParMin: plancher });
    for (const e of R.entrees) {
      const o = parCle.get(e.cut); file.push(o);
      if (Number.isFinite(e.details.attenduParMin) && e.details.attenduParMin >= plancher) tete.push(o);
    }
  }
  const avec = (l) => { const x = parcours(l, coutSaut); return { ...x, rapport: actuel.parMin > 0 ? r2(x.parMin / actuel.parMin) : null, partInformatifs: infActuel ? r2(x.informatifs / infActuel) : null }; };
  const infos = actuelListe.filter(o => o.informatif);
  const tB = infos.reduce((a, o) => a + coutBase(o, coutSaut), 0);
  const borne = { cuts: infos.length, informatifs: infos.length, tempsS: r1(tB), parMin: tB > 0 ? r1(infos.length / tB * 60) : 0 };
  const F1 = avec(file);
  const balayage = tete.slice().sort((a, b) => a.part - b.part || a.cut - b.cut);
  return { coutSautS: coutSaut, plancherParMin: plancher, tauxFixes: !!tauxFixes, actuel, file: F1, tete: avec(tete), teteBalayage: avec(balayage), borne,
    perdus: { informatifs: infActuel - F1.informatifs, cuts: actuel.cuts - F1.cuts, tempsEconomiseS: r1(tActuel - F1.tempsS) } };
}

/* Effet de la règle d'étiquetage : les validations sans mouvement de moins de 1,5 s sortent des références (réflexe). */
function effetEtiquetage(refs) {
  const compte = l => ({ references: l.length, apprenables: l.filter(r => r.qualifiee).length, informatifs: l.filter(r => r.qualifiee && r.mm > SEUIL_INFORMATIF_MM).length });
  const reflexe = r => r.etiquette === 'VALIDATE_NO_MOVEMENT' && Number.isFinite(r.dureeVisiteS) && r.dureeVisiteS < VISITE_COURTE_S;
  const ret = refs.filter(reflexe), reste = refs.filter(r => !reflexe(r));
  const avant = compte(refs), apres = compte(reste);
  const part = c => (c.references ? r1(c.informatifs / c.references * 100) : null);
  const tx = c => (c.references ? r1(c.apprenables / c.references * 100) : null);
  return { avant: { ...avant, partInformatifsPct: part(avant), tauxApprenablesPct: tx(avant) }, apres: { ...apres, partInformatifsPct: part(apres), tauxApprenablesPct: tx(apres) },
    retirees: ret.length, retireesQualifiees: ret.filter(r => r.qualifiee).length, retireesInformatives: ret.filter(r => r.qualifiee && r.mm > SEUIL_INFORMATIF_MM).length };
}

/* Plus petit nombre de posés jugés dont k fautes (plus de 50 mm) laissent la borne haute de Wilson (95 %) à 3 % ou moins (D-223). */
function wilsonHaut(k, n) { const z = 1.96, p = k / n, d = 1 + z * z / n; return (p + z * z / (2 * n) + z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; }
function tailleD223(k, budget = 0.03) { let n = Math.max(1, k + 1); while (wilsonHaut(k, n) > budget) n++; return n; }

/* Tirage au sort reproductible (graine entière) de `n` cuts parmi `cuts`, rendus dans l'ordre des cuts : l'échantillon de la séance Écho des posés. */
function echantillonPoses(cuts, n, graine, { ordreDuTirage = false } = {}) {
  let s = (graine >>> 0) || 1;
  const alea = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...new Set(cuts)].sort((x, y) => x - y);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const t = a.slice(0, Math.max(0, Math.min(n, a.length)));
  return ordreDuTirage ? t : t.sort((x, y) => x - y);
}

/* ------------------------------------------------------------------ lecture des exports */
const motifs = l => (l.motifDiffere ? [l.motifDiffere.gauche && l.motifDiffere.gauche.motif, l.motifDiffere.droite && l.motifDiffere.droite.motif].map(x => x || '-').join('/') : '-');
const ecartMax = l => (l.ecartHumain && Number.isFinite(l.ecartHumain.maxDist3dMm) ? l.ecartHumain.maxDist3dMm : null);
const SOURCE_JOURNAL = l => (l.classe === 'differee' ? 'differe' : l.classe === 'hors-journal' ? 'vert' : 'posee');

/* Union des segments Écho : visites (une par record) et instantanés de la liste d'ESV (le plus ancien par partie). */
function lireEcho(dossiers) {
  const V = require('./lire-volumes.cjs');
  const recs = new Map(), snaps = {};
  const deref = doc => { const dict = doc.dictionaries || {}; const r = x => { if (!x || typeof x !== 'object') return x; if (typeof x.__ref === 'string') { const i = x.__ref.lastIndexOf(':'); const d = dict[x.__ref.slice(0, i)]; return d ? r(d[+x.__ref.slice(i + 1)]) : x; } if (Array.isArray(x)) return x.map(r); const o = {}; for (const [k, v] of Object.entries(x)) o[k] = r(v); return o; }; return r; };
  for (const d of dossiers) {
    const fichiers = fs.statSync(d).isDirectory() ? fs.readdirSync(d).filter(f => /\.(zip|json)$/i.test(f)).sort().map(f => path.join(d, f)) : [d];
    for (const f of fichiers) for (const e of V.entrees(f)) {
      if (!/\.json$/.test(e.nom)) continue;
      let doc; try { doc = JSON.parse(e.lire()); } catch { continue; }
      if (/liste/.test(e.nom)) { if (doc && doc.format === 'ariane-liste-instantane-1' && Number.isInteger(doc.partie) && (!snaps[doc.partie] || doc.at < snaps[doc.partie].at)) snaps[doc.partie] = doc; continue; }
      if (!Array.isArray(doc.records)) continue;
      const D = deref(doc);
      for (const r0 of doc.records) { const r = D(r0); const id = r.recordId || r.id; if (!id) continue; const p = recs.get(id); if (!p || String(r.updatedAt || '') >= String(p.updatedAt || '')) recs.set(id, r); }
    }
  }
  const visites = [...recs.values()].filter(r => r.identity && Number.isInteger(r.identity.part) && Number.isInteger(r.identity.cut))
    .map(r => ({ part: r.identity.part, cut: r.identity.cut, t0: Date.parse(r.startedAt), t1: Date.parse(r.endedAt) })).filter(v => Number.isFinite(v.t0) && Number.isFinite(v.t1)).sort((a, b) => a.t0 - b.t0);
  return { visites, snaps };
}

/* Scores de « verts à contrôler » par partie, d'après l'instantané de la liste et les cuts du lot (lignes de la table). */
function scoresVerts(snaps, lignesTable) {
  const LM = require('../src/liste-memoire.js'), VC = require('../src/verts-a-controler.js');
  const out = new Map();
  for (const [p, s] of Object.entries(snaps)) {
    const lot = lignesTable.filter(l => l.partie === +p && l.dansJournal && (l.classe === 'posee' || l.classe === 'differee')).map(l => ({ cut: l.cut, differe: l.classe === 'differee' }));
    const C = VC.classer({ partie: +p, lignes: VC.lignesDeInstantane(LM.decompacter(s)), lot, zonesPN: [], posees: [] }, { touteLaPartie: true });
    for (const v of C.verts) out.set(`${p}:${v.i}`, v.score);
  }
  return out;
}

function construireJeu(tables, dossiersEcho) {
  const R = require('./rendement-apprentissage.cjs');
  const T = tables.flatMap(t => t.table), tab = new Map(T.map(l => [`${l.partie}:${l.cut}`, l]));
  const elig = R.lireEligibilite(dossiersEcho), { visites, snaps } = lireEcho(dossiersEcho), score = scoresVerts(snaps, T);
  const parCut = new Map(); let prec = null, sauts = 0, voisines = 0;
  for (const v of visites) {
    const k = `${v.part}:${v.cut}`, d = Math.min(COUT_VISITE_MAX_S, (v.t1 - v.t0) / 1000);
    const saut = !prec || prec.part !== v.part || Math.abs(v.cut - prec.cut) > 1;
    if (prec) { if (saut) sauts++; else voisines++; }
    const o = parCut.get(k) || { part: v.part, cut: v.cut, coutS: 0, sautReel: 0, premiereVisite: v.t0 };
    o.coutS += d; if (saut && prec) o.sautReel++; parCut.set(k, o); prec = v;
  }
  const obs = [], ignores = [];
  for (const [k, o] of parCut) {
    const l = tab.get(k); if (!l) { ignores.push(k); continue; }
    const ref = l.referenceHumaine === 'observee', mm = ecartMax(l);
    const cl = F.classe({ source: SOURCE_JOURNAL(l), motif: l.classe === 'differee' ? motifs(l) : null, score: score.get(k) });
    obs.push({ ...o, classe: cl, informatif: ref && elig.get(k) === true && mm > SEUIL_INFORMATIF_MM, avecTraits: ref && l.classe === 'differee' && motifs(l) !== 'input/input' });
  }
  const refs = T.filter(l => l.referenceHumaine === 'observee').map(l => ({ etiquette: l.etiquetteEcho, dureeVisiteS: l.dureeVisiteS, qualifiee: elig.get(`${l.partie}:${l.cut}`) === true, mm: ecartMax(l) }));
  /* Validations manuelles sans Écho : différés du lot que la liste d'ESV donne valides et traités par l'opérateur, sans aucune référence Écho. */
  const LM = require('../src/liste-memoire.js'), sansEcho = {};
  for (const [p, s] of Object.entries(snaps)) {
    const dec = LM.decompacter(s);
    const d = T.filter(l => l.partie === +p && l.classe === 'differee');
    sansEcho[p] = { differes: d.length, validesTraitesSansReference: d.filter(l => l.referenceHumaine !== 'observee' && dec.st[l.cut] === 0 && (dec.fl[l.cut] & 1) === 1).length, instantane: s.at };
  }
  return { obs, refs, ignores: ignores.length, sautsReels: { sauts, voisines, instantanes: Object.keys(snaps).length }, sansEcho, dureeVisitesS: r1(visites.reduce((a, v) => a + Math.min(COUT_VISITE_MAX_S, (v.t1 - v.t0) / 1000), 0)) };
}

/* ------------------------------------------------------------------ CLI */
function lireArguments(argv) {
  const a = { cmd: argv[0], tables: [], echo: [], saut: COUT_SAUT_DEFAUT_S, plancher: F.PLANCHER_PAR_MIN, json: null, verts: null, tauxDefaut: false, partie: null, taille: 125, graine: null, critere: 'informatif', ordre: 'rendement' };
  for (let i = 1; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--table') a.tables.push(argv[++i]); else if (x === '--echo') a.echo.push(argv[++i]);
    else if (x === '--saut') a.saut = Number(argv[++i]); else if (x === '--plancher') a.plancher = Number(argv[++i]);
    else if (x === '--json') a.json = argv[++i]; else if (x === '--verts') a.verts = argv[++i]; else if (x === '--critere') a.critere = argv[++i]; else if (x === '--taux-defaut') a.tauxDefaut = true; else if (x === '--ordre') a.ordre = argv[++i]; else if (x === '--partie') a.partie = Number(argv[++i]); else if (x === '--taille') a.taille = Number(argv[++i]); else if (x === '--graine') a.graine = Number(argv[++i]);
    else throw Error(`option inconnue : ${x}`);
  }
  if (!['simuler', 'file', 'echantillon'].includes(a.cmd)) throw Error('commande : simuler | file | echantillon');
  if (!a.tables.length) throw Error('donner au moins une --table (sortie de tools/jointure-echo-orbite.cjs)');
  if (a.cmd === 'simuler' && !a.echo.length) throw Error('simuler demande --echo');
  return a;
}
const f1 = v => String(v).replace('.', ',');
function texteSimulation(S, J) {
  const L = [`Simulation de l'ordre de travail (${J.obs.length} cuts visités, ${J.ignores} hors table ; saut ${S.coutSautS} s ; plancher ${S.plancherParMin}/min ; ${S.tauxFixes ? 'taux fixes du 04/11, rien appris de ces parties' : 'taux appris sans la partie jugée'}).`];
  for (const [n, k] of [['actuel (ordre réel)', 'actuel'], ['file complète', 'file'], ['tête de file', 'tete'], ['tête en balayage', 'teteBalayage'], ['borne haute', 'borne']]) {
    const x = S[k];
    L.push(`  ${n.padEnd(20)} ${String(x.cuts).padStart(4)} cuts, ${String(x.informatifs).padStart(3)} informatifs, ${String(x.tempsS).padStart(6)} s, ${f1(x.parMin).padStart(5)}/min${x.rapport != null ? `, ×${f1(x.rapport)}, ${Math.round(100 * x.partInformatifs)} % des informatifs gardés` : ''}`);
  }
  L.push(`  perdus par la file : ${S.perdus.informatifs} informatifs, ${S.perdus.cuts} visites, ${S.perdus.tempsEconomiseS} s économisées`);
  return L.join('\n');
}

function executer(argv) {
  const a = lireArguments(argv);
  const tables = a.tables.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  if (a.cmd === 'simuler') {
    const J = construireJeu(tables, a.echo);
    const sorties = {};
    for (const s of [...new Set([0, 1, 2, 3, 4, a.saut, 2 * a.saut])].sort((x, y) => x - y)) sorties[s] = simuler(J.obs, { coutSaut: s, plancher: a.plancher, tauxFixes: a.tauxDefaut ? F.TAUX_DEFAUT : null });
    const classes = F.apprendreTaux(J.obs);
    const R = { format: 'ariane-file-prioritaire-simulation-v1', saut: a.saut, simulation: sorties, classes, etiquetage: effetEtiquetage(J.refs),
      sautsReels: J.sautsReels, tempsVisitesS: J.dureeVisitesS, sansEcho: J.sansEcho, d223: { zero: tailleD223(0), un: tailleD223(1), deux: tailleD223(2) } };
    for (const s of Object.keys(sorties)) console.log(texteSimulation(sorties[s], J) + '\n');
    console.log('Saut (s) → rapport file / tête / tête en balayage : ' + Object.entries(sorties).map(([s, x]) => `${s} s : ×${f1(x.file.rapport)} / ×${f1(x.tete.rapport)} / ×${f1(x.teteBalayage.rapport)}`).join(' ; ') + '\n');
    console.log('Classes (cuts visités) :'); for (const [k, t] of Object.entries(classes)) console.log(`  ${k.padEnd(14)} n ${t.n}, informatifs ${t.informatifs} (avec traits ${t.avecTraits}), ${t.coutS} s, ${f1(t.parMin)}/min`);
    console.log('Étiquetage :', JSON.stringify(R.etiquetage));
    console.log('Sans Écho (liste ESV) :', JSON.stringify(R.sansEcho));
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(R, null, 1));
    return R;
  }
  if (a.cmd === 'echantillon') {
    if (!Number.isInteger(a.partie) || !Number.isInteger(a.graine)) throw Error('echantillon demande --partie N et --graine G (entier annoncé AVANT d’ouvrir le tirage)');
    const poses = tables.flatMap(t => t.table).filter(l => l.partie === a.partie && l.classe === 'posee' && l.referenceHumaine !== 'observee').map(l => l.cut);
    const E = { format: 'ariane-echantillon-poses-1', partie: a.partie, graine: a.graine, posesDisponibles: poses.length, taille: Math.min(a.taille, poses.length), cuts: echantillonPoses(poses, a.taille, a.graine), tirage: echantillonPoses(poses, a.taille, a.graine, { ordreDuTirage: true }) };
    console.log(`Partie ${a.partie} : ${E.taille} posés tirés sur ${E.posesDisponibles} (graine ${a.graine}) : ${F.plages(E.cuts).slice(0, 200)}`);
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(E, null, 1));
    return E;
  }
  const T = tables.flatMap(t => t.table);
  const juges = new Set(T.filter(l => l.referenceHumaine === 'observee').map(l => `${l.partie}:${l.cut}`));
  const cands = T.filter(l => (l.classe === 'differee' && l.dansJournal) || l.classe === 'posee').filter(l => l.dansJournal).map(l => ({ part: l.partie, cut: l.cut, source: SOURCE_JOURNAL(l), motif: l.classe === 'differee' ? motifs(l) : null }));
  if (a.verts) for (const v of JSON.parse(fs.readFileSync(a.verts, 'utf8'))) cands.push({ part: v.part, cut: v.cut, source: 'vert', score: v.score });
  const Rf = F.ordonner(cands, { jugesDeja: juges, critere: a.critere, ordre: a.ordre, plancherParMin: a.plancher });
  console.log(`File : ${Rf.entrees.length} cuts, ${Rf.ecartes.length} écartés (sous le plancher), ${Rf.dejaJuges} déjà jugés.`);
  const par = {}; for (const e of Rf.entrees) { par[e.signaux[0]] = par[e.signaux[0]] || []; par[e.signaux[0]].push(e.cut); }
  for (const [k, c] of Object.entries(par)) console.log(`  ${k} : ${c.length} (${f1(Rf.taux[k] ? Rf.taux[k].parMin : '—')}/min) ${F.plages(c).slice(0, 160)}`);
  if (a.json) fs.writeFileSync(a.json, JSON.stringify(Rf, null, 1));
  return Rf;
}

module.exports = { echantillonPoses, simuler, parcours, effetEtiquetage, tailleD223, wilsonHaut, lireEcho, scoresVerts, construireJeu, lireArguments, executer, COUT_SAUT_DEFAUT_S };
if (require.main === module) { try { executer(process.argv.slice(2)); } catch (e) { console.error(String(e && e.message || e)); process.exit(1); } }
