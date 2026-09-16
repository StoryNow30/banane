#!/usr/bin/env node
'use strict';
/* Candidate Generation Diagnostics V1 — HORS LIGNE, LECTURE SEULE.
 *
 * Objet : comprendre POURQUOI la génération de candidats échoue, sans rien
 * changer à `G.propose`. Deux questions, tenues séparées :
 *
 *   1. les rails `no-candidate` — 2 dans le corpus historique, 62 dans l'archive
 *      finale : à quelle ÉTAPE EXACTE le moteur sort-il, et où cela se
 *      concentre-t-il ?
 *   2. les rails `flank-only` dont aucun candidat exposé n'est satisfaisant :
 *      est-ce une limite de GÉNÉRATION, ou autre chose ?
 *
 * CE FICHIER NE MODIFIE NI NE RÉIMPLÉMENTE LA GÉOMÉTRIE. Il appelle
 * `G.propose` sans options et lit ce qu'il RETOURNE. Aucun seuil n'est proposé,
 * aucune règle, aucune politique, aucun correctif.
 *
 * L'ÉTAPE DE SORTIE N'EST PAS DEVINÉE. `src/geometry.js` renvoie, pour chaque
 * abandon, un message distinct par point de sortie. Ces messages sont donc
 * l'instrumentation elle-même : le banc les lit tels quels et NE REGROUPE PAS
 * plusieurs causes sous un vague « no-candidate ». La table `EXIT_STAGES`
 * associe chaque message à sa ligne et à ce que le moteur avait déjà calculé —
 * elle est vérifiée contre le source par test.
 *
 * CE QUE LE MOTEUR N'EXPOSE PAS, LE BANC NE L'INVENTE PAS. À un abandon
 * précoce, `propose` ne renvoie ni `metrics`, ni `top`, ni `face` : le placement
 * interne de la recherche n'est donc pas observable. Le banc le dit, et se
 * rabat sur des descripteurs d'ENTRÉE et sur les compteurs de couverture que la
 * collecte a elle-même enregistrés (`qualification.coverage`) — des données
 * réelles, pas une ré-exécution déguisée du filtrage.
 *
 * UNITÉS de scène, jamais des millimètres. `0.010` reste une convention
 * d'ÉVALUATION de banc, jamais un seuil.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const G = require('../src/geometry.js');
const N = require('./native-replay.cjs');
const F = require('./flank-support-shadow.cjs');

const ROOT = path.resolve(__dirname, '..');
const TOLERANCE_ORACLE = 0.010;
const norm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Les points de sortie de `src/geometry.js`, dans l'ordre du code.
 *
 * `after` dit ce que le moteur avait DÉJÀ fait quand il a abandonné : c'est la
 * clé du diagnostic, car un abandon après la recherche de gabarit ne se soigne
 * pas au même endroit qu'un abandon avant le filtrage de ROI.
 */
const EXIT_STAGES = [
  { reason: 'Aucun point LiDAR disponible.', stage: 'entree', after: 'rien',
    meaning: 'aucun point n’a été fourni au moteur' },
  { reason: 'Contour du profil absent.', stage: 'contour', after: 'rien',
    meaning: 'le profil ne porte aucun contour exploitable' },
  { reason: 'Sens du profil ambigu.', stage: 'contour', after: 'lecture du contour',
    meaning: 'le signe du profil ne peut pas être déterminé' },
  { reason: 'Contour de champignon non reconnu.', stage: 'contour', after: 'lecture du contour',
    meaning: 'moins de 6 sommets au-dessus de la limite de tête' },
  { reason: 'Trop peu de points autour du champignon.', stage: 'roi', after: 'filtrage de ROI',
    meaning: 'moins de 8 points retenus dans la fenêtre locale' },
  { reason: 'Dimensions du profil hors du domaine testé.', stage: 'contour', after: 'filtrage de ROI',
    meaning: 'largeur de tête hors du domaine testé' },
  { reason: 'Surfaces du profil non identifiées.', stage: 'ancres', after: 'filtrage de ROI',
    meaning: 'moins de 3 ancres de dessus ou de flanc dans le gabarit' },
  { reason: 'Plan de roulement non estimable.', stage: 'ajustement-post-recherche',
    after: 'recherche de gabarit TERMINÉE',
    meaning: 'moins de 3 points dans la bande du plan de roulement AUTOUR du placement '
           + 'que la recherche venait de choisir' },
  { reason: 'Intersection hors de la fenêtre expérimentale.', stage: 'ajustement-post-recherche',
    after: 'recherche de gabarit et plan de roulement',
    meaning: 'l’intersection des nappes tombe hors de la fenêtre de recherche' },
];
/**
 * Deux sorties de `geometry.js` ne portent pas un message unique.
 *
 *   · la branche `unsupported` JOINT par un espace jusqu'à trois messages
 *     d'appui manquant : elle survient APRÈS que les métriques complètes ont
 *     été construites, donc les trois familles de candidats existent déjà ;
 *   · l'ambiguïté de gabarit sort juste après, pour la même raison.
 *
 * Les traiter comme « inconnu » serait précisément le regroupement vague que ce
 * lot doit éviter.
 */
const SUPPORT_MESSAGES = [
  'Plan de roulement insuffisamment observé.',
  'Flanc interne insuffisamment observé.',
  'Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.',
];
const AMBIGUITY_MESSAGE = 'Plusieurs placements concurrents du champignon sont géométriquement plausibles.';
const STAGE_OF_SINGLE = new Map(EXIT_STAGES.map(e => [e.reason, e]));

/** Étape de sortie d'un abandon, message unique ou joint. */
function stageOf(reason) {
  const direct = STAGE_OF_SINGLE.get(reason);
  if (direct) return direct;
  if (reason === AMBIGUITY_MESSAGE)
    return { reason, stage: 'ambiguite-gabarit', after: 'métriques complètes construites',
             meaning: 'plusieurs placements concurrents : les trois familles existent déjà' };
  const parts = SUPPORT_MESSAGES.filter(m => reason.includes(m));
  if (parts.length && parts.join(' ') === reason)
    return { reason, stage: 'appuis-manquants', after: 'métriques complètes construites',
             meaning: `appui(s) manquant(s) : ${parts.length} — les trois familles existent déjà`,
             missingSupports: parts };
  return null;
}
const STAGE_OF = { get: stageOf };

/** Descripteurs d'ENTRÉE — lus, jamais recalculés à partir d'une décision. */
function inputDescriptors(visit, side, el, chunks) {
  const ids = el?.chunkIds ?? [];
  const cov = [], sources = [];
  let supplied = 0, nullVisibility = 0;
  for (const id of ids) {
    const c = chunks.get(id);
    if (!c) continue;
    supplied += c.points.length;
    if (c.visible) nullVisibility += c.visible.filter(v => v === null).length;
    if (c.coverage) cov.push(c.coverage);
    if (c.sourceNodes) sources.push(...c.sourceNodes.map(n => n.source ?? null));
  }
  const sum = k => cov.reduce((a, x) => a + (x?.[k] ?? 0), 0);
  const snap = (visit.railSnapshots?.[side] ?? []).find(s => s.snapshotId === el?.snapshotId);
  const contours = snap?.rail?.profileContours ?? [];
  return {
    chunks: ids.length, pointsSupplied: supplied, nullVisibility,
    /* compteurs de couverture ENREGISTRÉS PAR LA COLLECTE, pas recalculés ici */
    coverageFromCollection: {
      pointsInRoi: cov.length ? sum('pointsInRoi') : null,
      pointsInEngineUsefulRoi: cov.length ? sum('pointsInEngineUsefulRoi') : null,
      longitudinalBins: cov.length ? Math.max(...cov.map(x => x?.longitudinalBins ?? 0)) : null,
      longitudinalSpan: cov.length ? Math.max(...cov.map(x => x?.longitudinalSpan ?? 0)) : null,
      criteria: cov[0]?.criteria ?? null,
    },
    contourCount: contours.length,
    contourVertices: contours.map(c => c.verticesSceneRelative?.length ?? 0),
    maxContourVertices: contours.length ? Math.max(...contours.map(c => c.verticesSceneRelative?.length ?? 0)) : null,
    sourceNodeKinds: [...new Set(sources)],
    captureContext: { visitStatus: visit.status, lidarStatus: visit.lidarStatus ?? null },
  };
}

/**
 * Diagnostic d'un rail. `propose` est rappelé tel quel : on ne relit pas le
 * shadow, on réobserve le moteur, pour que l'étape de sortie soit celle qu'il
 * produit réellement.
 */
function diagnoseRail(visit, side, chunks) {
  const el = visit.geometryEligibility?.[side];
  if (el?.status !== 'comparable-candidate') return null;
  const r = F.replayRailExact(visit, side, chunks);
  if (!r.replayed) return null;
  const p = r.proposal;
  const exitReason = p.status === 'candidate' ? null : (p.reasons || []).join(' ');
  const stage = p.status === 'candidate' ? null : STAGE_OF.get(exitReason) ?? null;
  const built = p.metrics ? {
    seed: p.metrics.seed ? [0, ...p.metrics.seed] : null,
    surfaceIntersection: p.metrics.surfaceIntersection ? [0, ...p.metrics.surfaceIntersection] : null,
    alternative: p.metrics.templateAmbiguity?.alternative ? [0, ...p.metrics.templateAmbiguity.alternative] : null,
  } : { seed: null, surfaceIntersection: null, alternative: null };
  return {
    corpusKey: `${visit.sessionId}|${visit.visitId}|${side}`,
    sessionId: visit.sessionId, visitId: visit.visitId, visitIndex: visit.visitIndex, side,
    target: { part: visit.identity.part, cut: visit.identity.cut,
              pageId: visit.identity.pageId, frameId: visit.identity.frameId },
    status: p.status,
    exit: p.status === 'candidate' ? { reason: null, stage: 'aucun-abandon', after: null, meaning: null }
      : { reason: exitReason, stage: stage?.stage ?? 'inconnu', after: stage?.after ?? null,
          meaning: stage?.meaning ?? null, recognised: Boolean(stage) },
    /* ce que le moteur avait construit AVANT d'abandonner — null quand il n'a
     * rien exposé, jamais une valeur reconstituée */
    builtBeforeGivingUp: built,
    engineExposedMetrics: Boolean(p.metrics),
    topSupport: p.top ? { count: p.top.count, residual: p.top.residual, slopeLimited: p.top.slopeLimited } : null,
    faceSupport: p.face ? { count: p.face.count, residual: p.face.residual, slopeLimited: p.face.slopeLimited } : null,
    pointsUsed: p.metrics?.points ?? null,
    input: inputDescriptors(visit, side, el, chunks),
  };
}

/* ------------------------------------- classement post hoc des flank-only ---
 * La référence humaine n'entre QUE dans cette section, et seulement pour les
 * rails déjà classés par le shadow. Elle n'intervient dans aucun diagnostic
 * d'étape ci-dessus.                                                         */

const UNSATISFIED_CLASSES = [
  'famille-absente',
  'candidats-concordants-tous-faux',
  'familles-divergentes-toutes-fausses',
  'hors-fenetre-de-recherche',
  'correction-humaine-ambigue',
];

/**
 * Pourquoi aucun candidat exposé n'est satisfaisant ?
 *
 * L'ordre des tests est explicite et les catégories sont EXCLUSIVES. Aucune ne
 * propose de correctif : elles décrivent où se situe l'obstacle.
 *
 * `hors-fenetre-de-recherche` compare le déplacement humain aux bornes de
 * recherche `searchY` / `searchZ` du moteur gelé. Ce n'est pas un seuil nouveau :
 * ce sont ses propres bornes, citées, et un placement au-delà ne POUVAIT pas
 * être produit — c'est une limite de génération démontrable.
 */
function classifyUnsatisfied(row, ambiguousCuts, cfg = G.DEFAULTS) {
  const human = row.postHocEvaluation.humanDeltaLocal;
  const cands = row.decisionFeatures.candidates;
  const present = Object.entries(cands).filter(([, v]) => v);
  const key = `${row.decisionFeatures.target.part}/${row.decisionFeatures.target.cut}`;
  const errors = Object.fromEntries(present.map(([n, v]) => [n, norm(v, human)]));
  const spread = present.length > 1
    ? Math.max(...present.flatMap(([, a], i) => present.slice(i + 1).map(([, b]) => norm(a, b))))
    : 0;
  const outOfWindow = Math.abs(human[1]) > cfg.searchY || Math.abs(human[2]) > cfg.searchZ;
  const detail = { errors, spread, familiesPresent: present.map(([n]) => n),
                   humanMagnitude: Math.hypot(...human),
                   searchWindow: { searchY: cfg.searchY, searchZ: cfg.searchZ },
                   humanY: Math.abs(human[1]), humanZ: Math.abs(human[2]) };
  if (ambiguousCuts.has(key))
    return { classe: 'correction-humaine-ambigue', detail: { ...detail, ambiguousCut: key } };
  if (outOfWindow)
    return { classe: 'hors-fenetre-de-recherche', detail };
  if (present.length < 3)
    return { classe: 'famille-absente', detail };
  /* Tous faux : la question devient « le moteur hésitait-il ? ». Des candidats
   * serrés et tous faux, c'est une erreur SYSTÉMATIQUE de placement ; des
   * candidats dispersés et tous faux, c'est une génération qui rate la cible. */
  return spread <= Math.min(...Object.values(errors))
    ? { classe: 'candidats-concordants-tous-faux', detail }
    : { classe: 'familles-divergentes-toutes-fausses', detail };
}

/**
 * Cuts dont la référence humaine est contredite par une autre visite du MÊME
 * cut. C'est le cas 1/2891, généralisé : deux observations du même cut qui
 * divergent de plus que la convention d'évaluation.
 */
function ambiguousHumanCuts(rows, tol = TOLERANCE_ORACLE) {
  /* LIMITE À CONNAÎTRE. Ce détecteur ne voit que les visites REJOUABLES : une
   * contradiction dont la seconde visite est `excluded` lui échappe. C'est
   * exactement le cas du cut 1/2891, dont les deux références humaines droites
   * divergent de 9,851e-3 alors que sa seconde visite n'est pas rejouable. Un
   * comptage à zéro ne signifie donc PAS « aucune contradiction n'existe ».
   */
  const byCut = new Map();
  for (const r of rows) {
    const h = r.postHocEvaluation.humanDeltaLocal;
    if (!h) continue;
    const k = `${r.decisionFeatures.target.part}/${r.decisionFeatures.target.cut}|${r.decisionFeatures.side}`;
    if (!byCut.has(k)) byCut.set(k, []);
    byCut.get(k).push({ row: r, human: h });
  }
  const out = new Map();
  for (const [k, list] of byCut) {
    if (list.length < 2) continue;
    let max = 0;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++)
      max = Math.max(max, norm(list[i].human, list[j].human));
    if (max > tol) out.set(k.split('|')[0], { visits: list.length, maxDisagreement: max });
  }
  return out;
}

/* ------------------------------------------------------------------ pilote */

const tally = (list, key) => {
  const m = {};
  for (const x of list) { const k = String(key(x)); m[k] = (m[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const quantiles = v => {
  const a = v.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const q = p => a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))];
  return { n: a.length, min: a[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: a[a.length - 1] };
};

/** Concentration d'un ensemble de rails, sur tous les axes demandés. */
function concentration(rails) {
  const cuts = rails.map(r => r.target.cut).sort((a, b) => a - b);
  return {
    bySession: tally(rails, r => r.sessionId),
    bySide: tally(rails, r => r.side),
    byPart: tally(rails, r => r.target.part),
    byExitStage: tally(rails, r => r.exit.stage),
    byExitReason: tally(rails, r => r.exit.reason ?? '(aucun)'),
    bySourceNodeKind: tally(rails, r => r.input.sourceNodeKinds.join(',') || '(aucun)'),
    byChunkCount: tally(rails, r => r.input.chunks),
    byLidarStatus: tally(rails, r => String(r.input.captureContext.lidarStatus)),
    pointsSupplied: quantiles(rails.map(r => r.input.pointsSupplied)),
    pointsInRoiFromCollection: quantiles(rails.map(r => r.input.coverageFromCollection.pointsInRoi)),
    pointsInEngineUsefulRoi: quantiles(rails.map(r => r.input.coverageFromCollection.pointsInEngineUsefulRoi)),
    maxContourVertices: quantiles(rails.map(r => r.input.maxContourVertices)),
    cutRange: cuts.length ? { min: cuts[0], max: cuts[cuts.length - 1] } : null,
  };
}

function run(corpora) {
  const shadow = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/flank-support-shadow-v1.json')));
  const perCorpus = [];
  for (const { name, dir } of corpora) {
    const corpus = F.readCorpus(dir);
    const visits = F.readVisitsOf(corpus);
    const needed = new Set();
    for (const v of visits) for (const s of ['left', 'right']) {
      const el = v.geometryEligibility?.[s];
      if (el?.status === 'comparable-candidate') for (const id of el.chunkIds ?? []) needed.add(id);
    }
    /* On relit les chunks en gardant la couverture et les nœuds sources : le
     * shadow ne les conservait pas, et ce sont eux qui portent la provenance. */
    const chunks = new Map();
    for (const e of corpus.exports) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, e.file)));
      const deref = N.derefer(raw.dictionaries);
      for (const c of raw.clouds ?? []) {
        if (c.format !== 'banane-native-lidar-chunk-v1') continue;
        if (!needed.has(c.chunkId) || chunks.has(c.chunkId)) continue;
        chunks.set(c.chunkId, { points: c.pointsSceneRelative, visible: c.visibleByClipBoxes ?? null,
          coverage: deref(c.qualification?.coverage ?? null),
          sourceNodes: deref(c.acquisition?.sourceNodes ?? null) });
      }
      if (chunks.size === needed.size) break;
    }
    const rails = [];
    for (const v of visits) for (const side of ['left', 'right']) {
      const d = diagnoseRail(v, side, chunks);
      if (d) { d.corpus = name; rails.push(d); }
    }
    perCorpus.push({ name, dir, rails });
  }
  const all = perCorpus.flatMap(c => c.rails);
  const byKey = new Map(all.map(r => [`${r.corpus}|${r.corpusKey}`, r]));
  /* rattachement au shadow, pour les populations et le post-hoc */
  const shadowRows = shadow.rows.map(r => ({
    row: r,
    key: `${r.corpus}|${r.decisionFeatures.sessionId}|${r.decisionFeatures.visitId}|${r.decisionFeatures.side}`,
  }));
  const noCandidate = [], flankUnsatisfied = [];
  const ambiguous = ambiguousHumanCuts(shadow.rows);
  for (const { row, key } of shadowRows) {
    const d = byKey.get(key);
    if (row.population === 'no-candidate' && d) noCandidate.push(d);
    if (row.population === 'flank-only'
        && row.postHocEvaluation.verdict === 'aucun-candidat-expose-satisfaisant') {
      flankUnsatisfied.push({ corpus: row.corpus,
        sessionId: row.decisionFeatures.sessionId, visitIndex: row.decisionFeatures.visitIndex,
        side: row.decisionFeatures.side, target: row.decisionFeatures.target,
        diagnostics: d ? { exit: d.exit, input: d.input } : null,
        ...classifyUnsatisfied(row, ambiguous) });
    }
  }
  /* comparaison des rails RÉUSSIS, pour savoir si l'échec est une particularité
   * ou le régime général de l'archive */
  const succeeded = all.filter(r => r.status === 'candidate');
  return { shadow, perCorpus, all, noCandidate, flankUnsatisfied, succeeded, ambiguous };
}

function summarise(res) {
  const nc = res.noCandidate, fu = res.flankUnsatisfied;
  const byCorpus = n => nc.filter(r => r.corpus === n);
  return {
    railsDiagnosed: res.all.length,
    exitStages: tally(res.all.filter(r => r.status !== 'candidate'), r => r.exit.stage),
    exitReasons: tally(res.all.filter(r => r.status !== 'candidate'), r => r.exit.reason),
    noCandidate: {
      rails: nc.length,
      byCorpus: tally(nc, r => r.corpus),
      byExitReason: tally(nc, r => r.exit.reason),
      byExitStage: tally(nc, r => r.exit.stage),
      concentration: concentration(nc),
      perCorpusConcentration: Object.fromEntries(
        res.perCorpus.map(c => [c.name, byCorpus(c.name).length ? concentration(byCorpus(c.name)) : null])),
      comparedToSucceeded: {
        succeededRails: res.succeeded.length,
        pointsSupplied: quantiles(res.succeeded.map(r => r.input.pointsSupplied)),
        pointsInEngineUsefulRoi: quantiles(res.succeeded.map(r => r.input.coverageFromCollection.pointsInEngineUsefulRoi)),
        bySide: tally(res.succeeded, r => r.side),
        bySession: tally(res.succeeded, r => r.sessionId),
      },
    },
    flankUnsatisfied: {
      rails: fu.length,
      byCorpus: tally(fu, r => r.corpus),
      byClass: tally(fu, r => r.classe),
      byClassAndCorpus: Object.fromEntries(UNSATISFIED_CLASSES.map(c =>
        [c, tally(fu.filter(x => x.classe === c), r => r.corpus)])),
      humanMagnitude: quantiles(fu.map(r => r.detail.humanMagnitude)),
      spread: quantiles(fu.map(r => r.detail.spread)),
    },
    ambiguousHumanCuts: {
      detected: [...res.ambiguous.entries()]
        .map(([cut, v]) => ({ cut, ...v })).sort((a, b) => b.maxDisagreement - a.maxDisagreement),
      scope: 'visites REJOUABLES uniquement',
      knownBlindSpot: 'une contradiction dont la seconde visite est « excluded » échappe à ce '
        + 'détecteur — c’est le cas du cut 1/2891, dont les références humaines droites divergent '
        + 'de 9,851e-3 : un comptage à zéro ne signifie donc pas qu’aucune contradiction n’existe',
    },
    note: 'aucun seuil, aucune règle, aucun correctif — description seulement',
  };
}

function main() {
  const args = process.argv.slice(2), corpora = [];
  for (let i = 0; i < args.length; i++) if (args[i] === '--corpus') corpora.push({ name: args[i + 1], dir: args[i + 2] });
  const out = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  if (!corpora.length) { console.error('usage : --corpus <nom> <dossier> [--corpus …] [--output f.json]'); process.exit(2); }
  const frozen = N.assertFrozenEngine();
  const res = run(corpora);
  const summary = summarise(res);
  const body = {
    format: 'banane-candidate-generation-diagnostics-v1',
    nature: 'diagnostic hors ligne, lecture seule — G.propose inchangé, aucune règle, aucun seuil',
    engine: { version: '4.6.0', geometryMethod: G.DEFAULTS.method, parameters: G.DEFAULTS,
              frozenHashes: frozen, calledWithoutOptions: true },
    exitStages: EXIT_STAGES,
    compositeExits: { supportMessages: SUPPORT_MESSAGES, ambiguityMessage: AMBIGUITY_MESSAGE,
      note: 'la branche « unsupported » joint ses messages par un espace ; elle sort APRÈS '
          + 'la construction des métriques, donc les trois familles existent déjà' },
    unsatisfiedClasses: UNSATISFIED_CLASSES,
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified; never millimetres',
    evaluationConvention: { tolerance: TOLERANCE_ORACLE, usedFor: 'comptage uniquement' },
    corpora: corpora.map(c => ({ name: c.name, directory: path.resolve(c.dir) })),
    summary,
    noCandidateRails: res.noCandidate,
    flankUnsatisfiedRails: res.flankUnsatisfied,
  };
  const hashed = { format: body.format, engine: body.engine, exitStages: body.exitStages,
                   summary: body.summary, noCandidateRails: body.noCandidateRails,
                   flankUnsatisfiedRails: body.flankUnsatisfiedRails };
  body.sha256 = crypto.createHash('sha256').update(JSON.stringify(hashed)).digest('hex');
  body.sha256Covers = ['format', 'engine', 'exitStages', 'summary', 'noCandidateRails', 'flankUnsatisfiedRails'];
  body.generatedAt = new Date().toISOString();
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(body, null, 1)); }
  console.log(JSON.stringify(summary, null, 1));
  console.log('sha256 :', body.sha256);
  if (out) console.log('écrit :', out);
}

module.exports = { EXIT_STAGES, STAGE_OF, stageOf, SUPPORT_MESSAGES, AMBIGUITY_MESSAGE, UNSATISFIED_CLASSES, inputDescriptors, diagnoseRail,
                   classifyUnsatisfied, ambiguousHumanCuts, concentration, quantiles, tally,
                   run, summarise, TOLERANCE_ORACLE };
if (require.main === module) main();
