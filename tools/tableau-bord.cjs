#!/usr/bin/env node
'use strict';
/*
 * tableau-bord.cjs — TABLEAU DE BORD 5.0, livraison B-min (module B, architecture 5.0 § a.4 ; cahier v2 § 4 ; T21a) et mesure de vitesse
 * par phase au terrain (V-a, § a.5). Hors ligne, lecture seule : les journaux des lots archivés sont lus dans leurs archives, sans extraction.
 *
 *   node tools/tableau-bord.cjs --collections DOSSIER [--populations datasets/tableau-bord/populations.json] [--md fiches/TABLEAU_BORD.md]
 *        [--json-dir datasets/tableau-bord] [--vitesse-terrain datasets/vitesse/terrain.json] [--date AAAA-MM-JJ]
 *
 * FAMILLE SANS ÉCHO seulement (B-min) : par lot archivé lisible, une ligne : cuts traités, posés par le lot, écrits par la deuxième passe
 * (compte et source : `evenements`, `manquant`, `sans-objet` ; preuve d'écriture de tools/controle-passe.cjs, jamais `serverConfirmed`),
 * différés de l'état du lot (un cut posé par la passe y reste différé, D-238), cuts laissés sans pose (différés − écrits par la passe, intervalle
 * de Wilson à 95 %), temps par cut (tools/perf-lot.cjs : cycle médian et p90 hors silences, capture ESV médiane, analyse GCV1 médiane), relecture
 * de fin de lot (mode, cuts relus, durée, ms par cut ; pauses non retranchées : la durée du journal les contient).
 * Dans le journal, une validation faite par la passe porte le numéro du lot : la ligne la retire des « posés par le lot » et la compte à part.
 * Temps du lot : fenêtre du lot coupée au premier événement de la deuxième passe ou de la relecture du même lot ; lot sans son `batch-started` dans
 * l'export (cache vidé avant) : pas de temps. Deux cycles : `cycleMedMs` (perf-lot, horodatages `cut-target-changed`) et `cycleV1MedMs` (V1 de
 * tools/perf-phases.cjs, la définition du chiffre de référence de la 4.9.0.8, 2,44 s, D-090) ; ils diffèrent par construction.
 * `avecEcho` reste null (B complet, avec l'Écho et l'autonomie, vient ensuite) ; `skipOmbre` reste null (T21b).
 * Un lot présent dans plusieurs exports (exports cumulés du cache) n'a qu'une ligne : celle de l'export où il a le plus de décisions.
 * Population : `reglage` ou `examen` si le lot est nommé dans --populations, sinon `terrain`.
 * Poste : empreinte courte du matériel déclaré par le journal (plateforme, cœurs, mémoire, rendu graphique), jamais de nom.
 * Fichiers : un JSON par version d'Ariane (`<version>.json`, un bloc par population) et `fiches/TABLEAU_BORD.md` ; V-a : `datasets/vitesse/terrain.json`.
 * Aucune coordonnée, aucun code de projet ESV, aucun identifiant de page ou de session n'est écrit ; les lots sont nommés par leurs 8 premiers caractères.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const X = require('./exports-lots.cjs');
const D = require('./diag-differes.cjs');
const P = require('./perf-lot.cjs');
const CP = require('./controle-passe.cjs');

const FORMAT = 'ariane-tableau-bord-v1', FORMAT_VITESSE = 'ariane-vitesse-terrain-v1';
const arrondi = (v, n = 0) => Number.isFinite(v) ? Math.round(v * 10 ** n) / 10 ** n : null;
/* Intervalle de Wilson à 95 % (pour cent, à 0,1 près). */
function wilson95(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [arrondi(100 * Math.max(0, (c - h) / d), 1), arrondi(100 * Math.min(1, (c + h) / d), 1)];
}
function poste(machine) {
  if (!machine || typeof machine !== 'object') return null;
  const cle = [machine.plateforme, machine.coeurs, machine.memoireGo, machine.gpu && machine.gpu.rendu].map(x => x == null ? '' : String(x)).join('|');
  return 'poste-' + crypto.createHash('sha256').update(cle).digest('hex').slice(0, 6);
}
const med = s => s && s.n ? s.median : null;

/* Les lignes (une par lot) d'un journal déjà lu. */
function lignesDuJournal(journal, { listes = [], populations = {}, exportInfo = null } = {}) {
  const lots = D.lotsDuJournal(journal), passe = new Map(CP.ecrituresPasse(journal, { listes }).map(l => [l.lotId, l])), out = [];
  for (const L of lots) {
    if (!L.decisions) continue;
    const pl = passe.get(L.id) || null;
    const ecrits = pl ? pl.cuts.filter(c => c.resultat === 'ecrit' && (c.preuveEcriture || (c.preuveListe && c.preuveListe.valide))).map(c => c.cut) : [];
    const ecritsSet = new Set(ecrits);
    const posesLot = L.cuts.filter(c => c.pose && !ecritsSet.has(c.cut)).length;
    const differesLot = L.traites - posesLot, sansPose = differesLot - ecrits.length;
    const source = pl ? pl.source : CP.versionAuMoins(L.version) ? 'manquant' : 'sans-objet';
    /* Temps : perf-lot sur la fenêtre de ce lot, coupée au début de la deuxième passe ou de la relecture (leurs navigations ne sont pas des cycles du lot). */
    const finLot = Math.min(...(journal.events || []).filter(e => e && (e.lotId === L.id || e.batchId === L.id) && /^(relecture-debut|passe-differes-ombre|passe-differes-ombre-fin)$/.test(e.type)).map(e => Date.parse(e.timestamp)).filter(Number.isFinite), Infinity);
    let perf = null;
    const aSonDebut = (journal.events || []).some(e => e && e.type === 'batch-started' && e.batch && e.batch.id === L.id);
    if (aSonDebut) try { perf = P.measure({ ...journal, events: (journal.events || []).filter(e => !(Date.parse(e && e.timestamp) >= finLot)), state: { batch: { id: L.id } } }); } catch { perf = null; }
    const v1 = perf && perf.v1 && perf.v1.available && Array.isArray(perf.v1.lots) ? perf.v1.lots.find(x => x.batchId === L.id) : null;
    const ph = perf && perf.phases && perf.phases.n ? Object.fromEntries(perf.phases.etapes.map(e => [e.id, med(e.ms)])) : null;
    const rf = (journal.events || []).filter(e => e && e.type === 'relecture-fin' && (e.lotId === L.id || e.batchId === L.id)).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0] || null;
    const relecture = rf ? { mode: rf.modeEffectif || rf.mode || null, issue: rf.issue || null, cutsRelus: Number.isFinite(rf.faits) ? rf.faits : null, corriges: Number.isFinite(rf.corriges) ? rf.corriges : null,
      dureeMs: Number.isFinite(rf.dureeMs) ? rf.dureeMs : null, msParCut: Number.isFinite(rf.dureeMs) && rf.faits ? arrondi(rf.dureeMs / rf.faits) : null } : null;
    const lp = perf && perf.lots ? perf.lots.find(x => x.lot === L.id) : null;
    out.push({ lot: L.id.slice(0, 8), partie: L.partie, version: L.version, debut: L.debut, population: populationDe(L.id, populations), poste: poste(journal.machine),
      export: exportInfo, cuts: L.traites, invalidesAuDepart: L.invalidesAuDepart, posesLot, passeEcrits: { n: ecrits.length, source, cuts: ecrits, decideesEnOmbre: pl ? pl.ombre.poserait : null, issue: pl && pl.ecriture.fin ? pl.ecriture.fin.issue : null },
      differesLot, sansPose: { n: sansPose, N: L.traites, p: L.traites ? arrondi(100 * sansPose / L.traites, 1) : null, wilson95: wilson95(sansPose, L.traites) },
      vitesseLot: perf ? { cycleMedMs: med(lp ? lp.cycleMs : perf.cycleMs), p90Ms: (lp ? lp.cycleMs : perf.cycleMs).p90 ?? null, cycles: (lp ? lp.cycleMs : perf.cycleMs).n || 0,
        cycleV1MedMs: v1 && v1.cycleMs ? arrondi(v1.cycleMs.median) : null, cycleV1P90Ms: v1 && v1.cycleMs ? arrondi(v1.cycleMs.p90) : null,
        captureMedMs: med(perf.commandesMs && perf.commandesMs.capture), analyseMedMs: med(perf.analyseMs), decisionMedMs: med(perf.decisionMs), dureeMin: lp ? arrondi(lp.dureeMin, 1) : null, silencesMin: lp ? arrondi(lp.silencesMin, 1) : null,
        phases: ph ? { n: perf.phases.n, navigationCaptureMedMs: ph['navigation-capture'], analyseMedMs: ph['analyse-gcv1'], decisionMedMs: ph['decision-lot'], poseMedMs: ph.pose,
          captureApresPoseMedMs: ph['capture-apres-pose'], validationMedMs: ph.validation, cutSuivantMedMs: ph['cut-suivant'] } : null } : null,
      relecture });
  }
  return out;
}
function populationDe(id, populations) {
  for (const [pop, prefixes] of Object.entries(populations || {})) if (Array.isArray(prefixes) && prefixes.some(p => id.startsWith(p))) return pop;
  return 'terrain';
}
/* Un lot présent dans plusieurs exports : la ligne la plus complète (plus de cuts, puis export le plus récent). */
function dedoublonner(lignes) {
  const m = new Map();
  for (const l of lignes) { const o = m.get(l.lot); if (!o || l.cuts > o.cuts || (l.cuts === o.cuts && String(l.export && l.export.nom) > String(o.export && o.export.nom))) m.set(l.lot, l); }
  return [...m.values()].sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
}
const mediane = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function blocPopulation(lignes) {
  const N = lignes.reduce((s, l) => s + l.cuts, 0), sp = lignes.reduce((s, l) => s + l.sansPose.n, 0), dl = lignes.reduce((s, l) => s + l.differesLot, 0), pe = lignes.reduce((s, l) => s + l.passeEcrits.n, 0);
  const sources = [...new Set(lignes.map(l => l.passeEcrits.source))];
  const rel = lignes.filter(l => l.relecture && l.relecture.dureeMs && l.relecture.cutsRelus);
  return { exports: lignes.map(l => ({ sha256: l.export && l.export.sha256, partie: l.partie, lotId: l.lot, cuts: l.cuts })),
    sansEcho: { sansPose: { n: sp, N, p: N ? arrondi(100 * sp / N, 1) : null, wilson95: wilson95(sp, N) },
      differes: { n: dl, N, p: N ? arrondi(100 * dl / N, 1) : null, wilson95: wilson95(dl, N), note: 'différés de l\'état du lot : les cuts écrits par la passe y restent (D-238)' },
      passeEcrits: { n: pe, source: sources.length === 1 ? sources[0] : sources.join('+') },
      vitesseLot: { cycleMedMs: mediane(lignes.map(l => l.vitesseLot && l.vitesseLot.cycleMedMs)), p90Ms: mediane(lignes.map(l => l.vitesseLot && l.vitesseLot.p90Ms)), captureMedMs: mediane(lignes.map(l => l.vitesseLot && l.vitesseLot.captureMedMs)),
        analyseMedMs: mediane(lignes.map(l => l.vitesseLot && l.vitesseLot.analyseMedMs)), poste: [...new Set(lignes.map(l => l.poste).filter(Boolean))].join(', ') || null, note: 'médiane des valeurs par lot (lots de tailles différentes : indicatif)' },
      relecture: rel.length ? { lots: rel.length, cutsRelus: rel.reduce((s, l) => s + l.relecture.cutsRelus, 0), dureeMs: rel.reduce((s, l) => s + l.relecture.dureeMs, 0),
        msParCut: arrondi(rel.reduce((s, l) => s + l.relecture.dureeMs, 0) / rel.reduce((s, l) => s + l.relecture.cutsRelus, 0)), corriges: rel.reduce((s, l) => s + (l.relecture.corriges || 0), 0), modes: [...new Set(rel.map(l => l.relecture.mode))] } : null,
      skipOmbre: null },
    avecEcho: null };
}
function parVersion(lignes, { date, commitOutil }) {
  const versions = [...new Set(lignes.map(l => l.version || 'inconnue'))].sort();
  return versions.map(v => {
    const L = lignes.filter(l => (l.version || 'inconnue') === v), pops = [...new Set(L.map(l => l.population))].sort();
    return { format: FORMAT, version: v, commit: null, commitOutil, date, populations: Object.fromEntries(pops.map(p => [p, blocPopulation(L.filter(l => l.population === p))])), lots: L };
  });
}
function vitesseTerrain(lignes) {
  return { format: FORMAT_VITESSE, note: 'V-a : une ligne par lot archivé lisible ; comparaison seulement à partie et poste égaux, sinon « non contrôlé » (architecture § a.5). Temps lus dans les journaux (tools/perf-lot.cjs).',
    lignes: lignes.filter(l => l.vitesseLot).map(l => ({ partie: l.partie, lot: l.lot, poste: l.poste, version: l.version, population: l.population, cuts: l.cuts,
      cycleMedMs: l.vitesseLot.cycleMedMs, p90Ms: l.vitesseLot.p90Ms, cycleV1MedMs: l.vitesseLot.cycleV1MedMs, cycleV1P90Ms: l.vitesseLot.cycleV1P90Ms, captureMedMs: l.vitesseLot.captureMedMs, analyseMedMs: l.vitesseLot.analyseMedMs, decisionMedMs: l.vitesseLot.decisionMedMs,
      phases: l.vitesseLot.phases, relectureMode: l.relecture ? l.relecture.mode : null, relectureMsParCut: l.relecture ? l.relecture.msParCut : null })) };
}

const s = v => v == null ? '—' : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2).replace('.', ',')} s`;
const pc = v => v == null ? '—' : String(v).replace('.', ',') + ' %';
function markdown(lignes, fichiersVersion, { illisibles = [], date }) {
  const L = ['# Tableau de bord 5.0 — B-min (famille sans Écho)', '',
    `Produit par \`node tools/tableau-bord.cjs\` le ${date} sur les collectes archivées (lecture seule). Famille **sans Écho** seulement (cahier v2 § 4, indicateurs lisibles dans un export de lot seul) ; **avec Écho : non produit** (aucun Écho complet joint par cet outil ; B complet ensuite). Chaque chiffre dit sa population ; réglage, examen et terrain ne se mélangent pas.`, '',
    'Définitions : **posés lot** = validations du lot hors cuts écrits par la passe ; **écrits passe** = `passe-differes-ecriture` « ecrit » avec écriture de validation 2xx observée ou liste d\'ESV postérieure (jamais `serverConfirmed`, fiche H) ; **différés lot** = état du lot (les cuts de la passe y restent, D-238) ; **sans pose** = différés lot − écrits passe. Temps : `tools/perf-lot.cjs` (cycle hors silences de plus de 60 s). Relecture : `relecture-fin.dureeMs / cuts relus`, pauses non retranchées.', '',
    '## Par version et population', '', '| Version | Population | Lots | Cuts | Sans pose (Wilson 95 %) | Différés lot | Écrits passe (source) | Cycle médian des lots | Relecture ms/cut |', '|---|---|---|---|---|---|---|---|---|'];
  for (const f of fichiersVersion) for (const [p, b] of Object.entries(f.populations)) {
    const se = b.sansEcho;
    L.push(`| ${f.version} | ${p} | ${b.exports.length} | ${se.sansPose.N} | ${se.sansPose.n} (${pc(se.sansPose.p)} ; ${se.sansPose.wilson95 ? se.sansPose.wilson95.map(pc).join(' – ') : '—'}) | ${se.differes.n} | ${se.passeEcrits.n} (${se.passeEcrits.source}) | ${s(se.vitesseLot.cycleMedMs)} | ${se.relecture ? s(se.relecture.msParCut) + ` (${se.relecture.cutsRelus} relus)` : '—'} |`);
  }
  L.push('', '## Une ligne par lot archivé lisible', '', '| Début (UTC) | Lot | Partie | Version | Population | Poste | Cuts | Posés lot | Écrits passe (source) | Différés lot | Sans pose | Cycle médian / p90 | Cycle V1 médian | Capture médiane | Analyse médiane | Relecture |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const l of lignes) {
    const v = l.vitesseLot, r = l.relecture;
    L.push(`| ${String(l.debut || '').slice(0, 16).replace('T', ' ')} | ${l.lot} | ${l.partie ?? '?'} | ${l.version || '?'} | ${l.population} | ${l.poste || '—'} | ${l.cuts} | ${l.posesLot} | ${l.passeEcrits.n} (${l.passeEcrits.source}) | ${l.differesLot} | ${l.sansPose.n} (${pc(l.sansPose.p)}) | ${v ? `${s(v.cycleMedMs)} / ${s(v.p90Ms)}` : '—'} | ${v ? s(v.cycleV1MedMs) : '—'} | ${v ? s(v.captureMedMs) : '—'} | ${v ? s(v.analyseMedMs) : '—'} | ${r ? `${r.mode || '?'}, ${r.cutsRelus ?? '?'} relus, ${s(r.msParCut)}/cut` : '—'} |`);
  }
  L.push('', '## Exports lus', '', 'Empreinte SHA-256 du journal lu (12 premiers caractères ici ; complète dans `datasets/tableau-bord/<version>.json`).', '');
  for (const l of lignes) L.push(`- ${l.lot} : \`${l.export && l.export.collection}\` / ${l.export && l.export.nom}, ${l.export && l.export.sha256 ? l.export.sha256.slice(0, 12) : '?'}`);
  if (illisibles.length) {
    const par = new Map(); for (const i of illisibles) par.set(i.collection, (par.get(i.collection) || 0) + 1);
    L.push('', `## Archives non lues (${illisibles.length})`, '', 'Archives 7z : aucun décompresseur sur cette machine ; leurs lots n\'ont pas de ligne.', '', ...[...par].map(([c, n]) => `- \`${c}\` : ${n} archive(s)`));
  }
  return L.join('\n') + '\n';
}

function lireTout(racine, populations) {
  const L = require('../src/liste-memoire.js'), inv = X.inventaire(racine), listes = [], lignes = [];
  for (const x of inv.lisibles.filter(y => y.type === 'liste')) { try { const d = L.decompacter(JSON.parse(X.lireEntree(x).toString('utf8'))); listes.push({ partie: d.partie, at: d.at, st: d.st }); } catch { /* ignoré */ } }
  for (const x of inv.lisibles.filter(y => y.type === 'journal')) {
    const buf = X.lireEntree(x), j = JSON.parse(buf.toString('utf8'));
    if (j.dictionaries && Array.isArray(j.events)) j.events = require('./perf-phases.cjs').resolveRefs(j.events, j.dictionaries).value;
    lignes.push(...lignesDuJournal(j, { listes, populations, exportInfo: { collection: x.collection, nom: x.nom, sha256: X.sha256(buf) } }));
  }
  return { lignes: dedoublonner(lignes), illisibles: inv.illisibles };
}
function commitOutil() { try { return require('node:child_process').execFileSync('git', ['-C', path.resolve(__dirname, '..'), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } }
function main(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) { const k = argv[i], v = () => argv[++i]; if (k === '--collections') o.collections = v(); else if (k === '--populations') o.populations = v(); else if (k === '--md') o.md = v(); else if (k === '--json-dir') o.jsonDir = v(); else if (k === '--vitesse-terrain') o.vitesse = v(); else if (k === '--date') o.date = v(); else throw Error('argument inconnu : ' + k); }
  if (!o.collections) throw Error('usage : node tools/tableau-bord.cjs --collections DOSSIER [--populations P.json] [--md S.md] [--json-dir D] [--vitesse-terrain V.json] [--date AAAA-MM-JJ]');
  const populations = o.populations ? JSON.parse(fs.readFileSync(o.populations, 'utf8')).populations || {} : {};
  const date = o.date || new Date().toISOString().slice(0, 10), { lignes, illisibles } = lireTout(o.collections, populations), fv = parVersion(lignes, { date, commitOutil: commitOutil() });
  if (o.jsonDir) { fs.mkdirSync(o.jsonDir, { recursive: true }); for (const f of fv) fs.writeFileSync(path.join(o.jsonDir, `${f.version}.json`), JSON.stringify(f, null, 1) + '\n'); }
  if (o.vitesse) { fs.mkdirSync(path.dirname(o.vitesse), { recursive: true }); fs.writeFileSync(o.vitesse, JSON.stringify({ ...vitesseTerrain(lignes), date }, null, 1) + '\n'); }
  const md = markdown(lignes, fv, { illisibles, date }); if (o.md) fs.writeFileSync(o.md, md); else process.stdout.write(md);
  return { lignes, fv };
}
module.exports = { FORMAT, FORMAT_VITESSE, wilson95, poste, lignesDuJournal, populationDe, dedoublonner, blocPopulation, parVersion, vitesseTerrain, markdown, main };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`tableau-bord : ${e.stack || e.message}\n`); process.exitCode = 1; } }
