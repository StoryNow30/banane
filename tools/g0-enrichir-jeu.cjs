#!/usr/bin/env node
'use strict';
/*
 * g0-enrichir-jeu.cjs — enrichit un jeu `ariane-jeu-apprentissage-v1` (tools/jeu-apprentissage.cjs) avec l'extension
 * « g0-traits-v1 » lue par tools/apprentissage-g0.cjs (lot G0, plan 5.0). Hors ligne, lecture seule, aucune dépendance
 * externe, rien sous src/. AUCUNE coordonnée absolue n'est écrite : seulement des millimètres, des comptes et des numéros
 * de cut.
 *
 *   node tools/g0-enrichir-jeu.cjs --partie N --jeu jeu.jsonl --journal ariane-journal-v4-*.json
 *        [--m6 table-m6.json] [--echo chemin[,chemin…]] --sortie jeu-enrichi.jsonl
 *
 * Ajouts (tous des traits d'Ariane ou de la pose de départ, jamais de la référence humaine) :
 *  - `traits.g0` pour chaque cut du journal :
 *      rails.{gauche,droite} : dzMm, duMm, conventionAppliquee, lossRatio, topRows, faceCount, nClusters,
 *        nStrongCompetitive, nPool, slopeLimited, partialFlankUsed, s1Change, ecartementPrevuMm, classeEcartement
 *        (dernière observation GCV1 en ombre du cut, événement `gcv1-shadow-observed`) ;
 *      distRougeMin / Avant / Apres : distance (en cuts) au rouge le plus proche, les rouges étant tous les cuts du
 *        journal (posés, différés, autres) ; groupeTaille, groupeRang, groupeDistBord : grappe de rouges (liaison simple,
 *        trou ≤ 5 cuts) ;
 *      ecartementPoseMm, ecartVoisinsMm, sansVoisins, horsBandeMm, scoreM6 : table de tools/coherence-voisins.cjs
 *        (--m6, sortie `--sortie` de cet outil), pour les cuts posés ;
 *  - `contexte.ecartementInitialMm` (tous les cuts de l'Écho) : écartement des deux rails à la première visite, avant
 *    toute action de l'opérateur ; `contexte.deniveleLocalMm` : écart absolu entre le dénivelé des deux rails du cut et
 *    la médiane de ce dénivelé sur les cuts voisins (±10) : un rail dont la hauteur saute sort de la médiane.
 *    Attention : pour un rouge, la pose de départ d'ESV est le gabarit (écartement 1 500 mm) ; pour un cut posé
 *    puis relu, c'est la pose d'Ariane. Ces deux traits ne valent que pour les verts d'extraction (hors journal).
 */
const fs = require('node:fs');
const J = require('./jointure-echo-orbite.cjs');

const fini = Number.isFinite;
const r1 = v => fini(v) ? Math.round(v * 10) / 10 : null;
const r2 = v => fini(v) ? Math.round(v * 100) / 100 : null;
const mediane = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function railG0(r) {
  if (!r) return null;
  const nx = r.next || {}, cal = r.conventionCalibration || {}, v46 = r.v46 || {}, as = r.astar || {}, comp = r.competitive || {};
  return {
    dzMm: r2(cal.dzMm), duMm: r2(cal.duMm),
    conventionAppliquee: typeof cal.applied === 'boolean' ? cal.applied : null,
    lossRatio: r2(as.lossRatio ?? v46.lossRatio),
    topRows: fini(nx.topRows) ? nx.topRows : (v46.topRows ?? null),
    faceCount: fini(nx.faceCount) ? nx.faceCount : (v46.faceCount ?? null),
    nClusters: nx.nClusters ?? comp.nClusters ?? null,
    nStrongCompetitive: nx.nStrongCompetitive ?? comp.nStrongCompetitive ?? null,
    nPool: comp.nPool ?? null,
    slopeLimited: typeof nx.slopeLimited === 'boolean' ? nx.slopeLimited : (typeof as.slopeLimited === 'boolean' ? as.slopeLimited : null),
    partialFlankUsed: typeof r.partialFlankUsed === 'boolean' ? r.partialFlankUsed : null,
    s1Change: typeof r.s1Changed === 'boolean' ? r.s1Changed : null,
    ecartementPrevuMm: r2(r.pairGauge && r.pairGauge.predictedMm),
    classeEcartement: r.pairGauge && r.pairGauge.gaugeClass || null,
  };
}

/* Dernière observation GCV1 par cut et ensemble des cuts du journal (les « rouges »). */
function lireJournalG0(journal, partie) {
  const shadow = new Map(), cuts = new Set();
  for (const e of journal.events) {
    const id = e.identity;
    if (!id || id.part !== partie || !Number.isInteger(id.cut)) continue;
    if (e.type === 'proposed' || e.type === 'before-captured' || e.type === 'validation-accepted' || e.type === 'defer-finalized') cuts.add(id.cut);
    if (e.type === 'gcv1-shadow-observed' && e.shadow && e.shadow.rails) { shadow.set(id.cut, e); cuts.add(id.cut); }
  }
  return { shadow, rouges: [...cuts].sort((a, b) => a - b) };
}
function groupes(rouges) {
  const grp = new Map();
  let g = [];
  const clore = () => { g.forEach((c, k) => grp.set(c, { taille: g.length, rang: k, distBord: Math.min(k, g.length - 1 - k) })); g = []; };
  for (const c of rouges) { if (g.length && c - g[g.length - 1] > 5) clore(); g.push(c); }
  clore();
  return grp;
}
function distance(rouges, c) {
  let av = null, ap = null;
  for (const x of rouges) { if (x < c) av = c - x; else if (x > c) { ap = x - c; break; } }
  const m = Math.min(av ?? Infinity, ap ?? Infinity);
  return { av, ap, min: m === Infinity ? null : m };
}

/* Pose de départ à la première visite de l'Écho : écartement et dénivelé des deux rails (mm). */
function lireEchoG0(records, sessions, partie) {
  const par = J.echoParCut(records, sessions), ecart = new Map(), dz = new Map();
  for (const c of par.values()) {
    if (c.partie !== partie) continue;
    const v = c.visites[0], i = v && (v.initialObserved || v.firstObserved);
    const L = i && i.rails && i.rails.left && i.rails.left.positionSceneRelative, R = i && i.rails && i.rails.right && i.rails.right.positionSceneRelative;
    if (!L || !R || L.length < 3 || R.length < 3) continue;
    ecart.set(c.cut, r1(1000 * Math.hypot(L[0] - R[0], L[1] - R[1], L[2] - R[2])));
    dz.set(c.cut, 1000 * (L[2] - R[2]));
  }
  const cuts = [...dz.keys()].sort((a, b) => a - b), deniv = new Map();
  for (const c of cuts) {
    const v = cuts.filter(x => x !== c && Math.abs(x - c) <= 10).map(x => dz.get(x));
    if (v.length >= 3) deniv.set(c, r1(Math.abs(dz.get(c) - mediane(v))));
  }
  return { ecart, deniv };
}

/* Enrichit une liste de lignes déjà lues (entête + cuts). Rend les lignes enrichies. */
function enrichir(lignes, { partie, journal, m6 = null, echo = null }) {
  const { shadow, rouges } = journal ? lireJournalG0(journal, partie) : { shadow: new Map(), rouges: [] };
  const grp = groupes(rouges), tableM6 = new Map((m6 && m6.table || []).map(x => [x.cut, x]));
  const e = echo ? lireEchoG0(echo.records, echo.sessions, partie) : { ecart: new Map(), deniv: new Map() };
  let nTraits = 0, nEcho = 0;
  const sortie = lignes.map(r => {
    if (r.type !== 'cut' || r.partie !== partie) return r;
    const o = { ...r };
    if (e.ecart.has(r.cut)) { o.contexte = { ...(r.contexte || {}), ecartementInitialMm: e.ecart.get(r.cut), ...(e.deniv.has(r.cut) ? { deniveleLocalMm: e.deniv.get(r.cut) } : {}) }; nEcho++; }
    if (r.traits) {
      const sh = shadow.get(r.cut), m = tableM6.get(r.cut), d = distance(rouges, r.cut), gp = grp.get(r.cut) || {};
      const g0 = {
        version: 'g0-traits-v1',
        rails: sh ? { gauche: railG0(sh.shadow.rails.left), droite: railG0(sh.shadow.rails.right) } : null,
        distRougeMin: d.min, distRougeAvant: d.av, distRougeApres: d.ap,
        groupeTaille: gp.taille ?? null, groupeRang: gp.rang ?? null, groupeDistBord: gp.distBord ?? null,
        ecartementPoseMm: m ? m.ecartementMm : null, ecartVoisinsMm: m ? m.ecartVoisinsMm : null, sansVoisins: m ? !!m.sansVoisins : null,
        horsBandeMm: m ? m.horsBandeMm : null, scoreM6: m ? m.score : null,
      };
      o.traits = { ...r.traits, g0 }; nTraits++;
    }
    return o;
  });
  if (sortie[0] && sortie[0].type === 'entete') sortie[0] = { ...sortie[0], extensionG0: { version: 'g0-traits-v1', partie, cutsEnrichis: nTraits, cutsAvecPoseDeDepart: nEcho, rougesAuJournal: rouges.length, observationsGcv1: shadow.size,
    note: 'traits.g0 : GCV1 en ombre, M6, grappes de rouges du journal complet ; contexte.ecartementInitialMm et deniveleLocalMm : première visite de l\'Écho. Aucune coordonnée absolue.' } };
  return sortie;
}

function lireArguments(argv) {
  const o = { partie: null, jeu: null, journal: null, m6: null, echo: null, sortie: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--partie') o.partie = Number(argv[++i]);
    else if (a === '--jeu') o.jeu = argv[++i];
    else if (a === '--journal') o.journal = argv[++i];
    else if (a === '--m6') o.m6 = argv[++i];
    else if (a === '--echo') o.echo = argv[++i].split(',').filter(Boolean);
    else if (a === '--sortie') o.sortie = argv[++i];
    else throw new Error(`option inconnue : ${a}`);
  }
  if (!Number.isInteger(o.partie) || !o.jeu || !o.sortie) throw new Error('--partie N, --jeu fichier.jsonl et --sortie fichier.jsonl requis');
  return o;
}
function executer(argv) {
  const o = lireArguments(argv);
  const lignes = fs.readFileSync(o.jeu, 'utf8').split('\n').filter(l => l.trim()).map(JSON.parse);
  const journal = o.journal ? J.lireJournal(o.journal) : null;
  const m6 = o.m6 ? JSON.parse(fs.readFileSync(o.m6, 'utf8')) : null;
  const echo = o.echo ? J.lireEcho(o.echo) : null;
  const sortie = enrichir(lignes, { partie: o.partie, journal, m6, echo });
  fs.writeFileSync(o.sortie, sortie.map(l => JSON.stringify(l)).join('\n') + '\n');
  const h = sortie[0] && sortie[0].extensionG0;
  return `partie ${o.partie} : ${h ? h.cutsEnrichis : 0} cuts enrichis (traits.g0), ${h ? h.cutsAvecPoseDeDepart : 0} avec pose de départ à l'Écho, ${h ? h.rougesAuJournal : 0} rouges au journal.\n`;
}

module.exports = { enrichir, lireJournalG0, lireEchoG0, groupes, distance, railG0, executer, lireArguments };

if (require.main === module) {
  try { process.stdout.write(executer(process.argv.slice(2))); }
  catch (e) { process.stderr.write(`g0-enrichir-jeu : ${e.message}\n`); process.exit(2); }
}
