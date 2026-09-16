#!/usr/bin/env node
'use strict';
/* Flank Support Shadow V1 — instrumentation HORS LIGNE, LECTURE SEULE.
 *
 * Objet : étudier les abstentions du moteur gelé dont le SEUL motif est
 * « Flanc interne insuffisamment observé. ». Ce fichier n'est pas une politique,
 * ne choisit aucun seuil, ne fabrique aucun candidat, ne déplace aucun rail et
 * ne s'exécute jamais dans l'extension.
 *
 * IL NE MODIFIE RIEN. Il importe `src/geometry.js` et `vendor/capture-core.js`
 * — gelés depuis 4.4.0, empreintes vérifiées au démarrage — et réutilise les
 * fonctions de lecture de `tools/native-replay.cjs`. Il ne touche ni au moteur,
 * ni au cerveau, ni à Pair Arbitration, ni à aucun paramètre. `propose` est
 * appelé SANS options : ses DEFAULTS s'appliquent.
 *
 * QUATRE BLOCS SÉPARÉS PAR LIGNE, et l'ordre compte :
 *
 *   decisionFeatures      ce que le moteur avait sous les yeux à la décision
 *   causalHistory         uniquement du passé strict, même côté et même cible
 *   oppositeRailContext   l'état de l'autre rail, sans jamais le déplacer
 *   ---- frontière ----   aucune valeur humaine au-dessus de cette ligne
 *   postHocEvaluation     la référence humaine, et elle seule, entre ici
 *
 * La frontière est VÉRIFIÉE PAR TEST, récursivement sur les clés : une mesure
 * humaine ne pourrait entrer dans les trois premiers blocs que sous un faux nom.
 *
 * FAIL CLOSED SUR LE SNAPSHOT. `geometryEligibility[side].snapshotId` nomme un
 * snapshot précis. S'il est introuvable, le rail est REFUSÉ — jamais de repli
 * silencieux sur le dernier snapshot disponible, qui porterait une autre pose et
 * fausserait tout ce qui suit.
 *
 * UNITÉS. Unités de scène, `physicalCalibrationStatus: not-independently-verified`.
 * Jamais converties en millimètres, jamais une cote physique. `0.010` est une
 * convention d'ÉVALUATION de banc : elle sert à COMPTER, jamais à décider, et
 * n'est pas une calibration.
 *
 * AUCUN GAGNANT N'EST DÉSIGNÉ. Pas de seuil retenu, pas de score combiné, pas de
 * classifieur, pas de fenêtre causale maximale, pas de préférence de famille.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const N = require('./native-replay.cjs');

const ROOT = path.resolve(__dirname, '..');
/** Motif d'abstention étudié, cité MOT POUR MOT depuis `src/geometry.js`. */
const FLANK_REASON = 'Flanc interne insuffisamment observé.';
/** Convention d'ÉVALUATION du banc. Jamais un seuil runtime, jamais une cote. */
const TOLERANCE_ORACLE = 0.010;
/**
 * Session annoncée comme signalant des événements perdus. Elle est traitée
 * comme un PARAMÈTRE, pas comme un fait : le banc vérifie sa présence et le
 * déclare. Voir `degradationContext`.
 */
const DEGRADED_SESSIONS = ['0c58c033-f2e7-4aa5-ad8c-80b081a83932'];

const norm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mag = v => Math.hypot(v[0], v[1], v[2]);

/* ---------------------------------------------------------------- population */

/**
 * Le snapshot EXACT nommé par l'éligibilité, ou rien.
 *
 * `tools/native-replay.cjs` retombait ici sur le dernier snapshot disponible
 * quand l'identifiant ne correspondait à rien. Ce repli est supprimé : deux
 * snapshots d'un même rail peuvent porter des poses différentes — c'est
 * précisément ce qu'a montré le cut 1/2891 — et un repli silencieux
 * déplacerait la pose de référence sans que personne ne le voie.
 */
function exactSnapshot(visit, side) {
  const el = visit.geometryEligibility?.[side];
  const snaps = visit.railSnapshots?.[side];
  if (!el?.snapshotId) return { ok: false, reason: 'snapshotId-absent', snapshot: null };
  if (!Array.isArray(snaps) || !snaps.length) return { ok: false, reason: 'aucun-snapshot', snapshot: null };
  const hit = snaps.filter(s => s.snapshotId === el.snapshotId);
  if (hit.length !== 1)
    return { ok: false, reason: hit.length ? 'snapshotId-ambigu' : 'snapshotId-introuvable', snapshot: null };
  return { ok: true, reason: null, snapshot: hit[0], available: snaps.length };
}

/** Rejeu d'un rail sur son snapshot exact. Aucune valeur humaine n'est lue. */
function replayRailExact(visit, side, chunks) {
  const el = visit.geometryEligibility?.[side] ?? null;
  const eligibility = el?.status ?? 'absent';
  if (eligibility !== 'comparable-candidate')
    return { replayed: false, eligibility, failClosed: null, proposal: null };
  const snap = exactSnapshot(visit, side);
  if (!snap.ok) return { replayed: false, eligibility, failClosed: snap.reason, proposal: null };
  const rail = snap.snapshot.rail;
  if (!rail) return { replayed: false, eligibility, failClosed: 'pose-absente-du-snapshot', proposal: null };
  const points = [], visible = [];
  for (const id of el.chunkIds ?? []) {
    const c = chunks.get(id);
    if (!c) return { replayed: false, eligibility, failClosed: 'chunk-nomme-absent', proposal: null };
    for (let i = 0; i < c.points.length; i++) { points.push(c.points[i]); visible.push(c.visible ? c.visible[i] : true); }
  }
  if (!points.length) return { replayed: false, eligibility, failClosed: 'aucun-point', proposal: null };
  return { replayed: true, eligibility, failClosed: null, rail,
           snapshotId: el.snapshotId, snapshotsAvailable: snap.available,
           proposal: G.propose({ rails: { [side]: rail }, pointsSceneRelative: points,
                                 visibleByClipBoxes: visible }, side) };
}

/**
 * Population d'un rail. « flank-only » exige que le motif d'abstention soit
 * EXACTEMENT celui étudié : `geometry.js` joint plusieurs motifs par un espace
 * quand plusieurs appuis manquent, et un rail qui manque aussi de plan de
 * roulement n'est pas le même objet d'étude.
 */
function population(r) {
  if (!r.replayed) return r.failClosed ? 'not-replayable-fail-closed' : 'not-replayable';
  const p = r.proposal;
  if (p.status === 'candidate') return 'engine-candidate';
  if (!p.metrics) return 'no-candidate';
  const reasons = p.reasons || [];
  if (reasons.length === 1 && reasons[0] === FLANK_REASON) return 'flank-only';
  if (reasons.length === 1 && reasons[0].includes(FLANK_REASON)) return 'flank-with-others';
  return reasons.some(x => x.includes(FLANK_REASON)) ? 'flank-with-others' : 'other-abstention';
}

/* ============================ 1. decisionFeatures ==========================
 * Ce que le moteur avait sous les yeux. AUCUNE valeur humaine, aucune donnée
 * future, aucun autre côté.                                                  */

function decisionFeatures(r, side, visit) {
  const p = r.proposal, m = p?.metrics ?? null, ta = m?.templateAmbiguity ?? null;
  const cand = c => c ? [0, c[0], c[1]] : null;
  const seed = cand(m?.seed), surface = cand(m?.surfaceIntersection), alternative = cand(ta?.alternative);
  return {
    side,
    status: p?.status ?? null,
    abstentionReasons: p?.status === 'candidate' ? [] : (p?.reasons ?? []),
    confidence: p?.confidence ?? null,
    /* appui géométrique observé */
    topCount: m?.topCount ?? null, topSpanBins: m?.topSpanBins ?? null,
    faceCount: m?.faceCount ?? null, faceSpanBins: m?.faceSpanBins ?? null,
    pointsInCapture: m?.points ?? null, pointsUsed: null,
    residual: m?.residual ?? null,
    topResidual: r.proposal?.top?.residual ?? null,
    faceResidual: r.proposal?.face?.residual ?? null,
    topSlopeLimited: r.proposal?.top?.slopeLimited ?? null,
    faceSlopeLimited: r.proposal?.face?.slopeLimited ?? null,
    /* ajustement de gabarit */
    templateLoss: m?.templateLoss ?? null,
    coarseBestLoss: ta?.coarseBestLoss ?? null,
    alternativeLoss: ta?.alternativeLoss ?? null,
    lossRatio: ta?.lossRatio ?? null,
    separation: ta?.separation ?? null,
    /* les trois familles RÉELLEMENT exposées, sans aucune préférence */
    candidates: { seed, surfaceIntersection: surface, alternative },
    /* écarts entre familles — exposés, jamais arbitrés */
    seedToSurface: seed && surface ? norm(seed, surface) : null,
    seedToAlternative: seed && alternative ? norm(seed, alternative) : null,
    surfaceToAlternative: surface && alternative ? norm(surface, alternative) : null,
    /* amplitude du seed par rapport à la pose initiale : le seed EST un
     * déplacement exprimé dans le repère local, donc sa norme est l'amplitude */
    seedMagnitudeFromInitialPose: seed ? mag(seed) : null,
    surfaceMagnitudeFromInitialPose: surface ? mag(surface) : null,
    alternativeMagnitudeFromInitialPose: alternative ? mag(alternative) : null,
    /* identité — aucune valeur mesurée */
    target: { part: visit.identity.part, cut: visit.identity.cut,
              pageId: visit.identity.pageId, frameId: visit.identity.frameId,
              shape: visit.identity.shape },
    sessionId: visit.sessionId, visitIndex: visit.visitIndex, visitId: visit.visitId,
    snapshotId: r.snapshotId ?? null, snapshotsAvailable: r.snapshotsAvailable ?? null,
    /* contexte de collecte, tel qu'exporté — pas une mesure */
    captureContext: { visitStatus: visit.status, lidarStatus: visit.lidarStatus },
  };
}

/* ============================ 2. causalHistory =============================
 * Uniquement du PASSÉ STRICT, sur la MÊME cible et le MÊME côté.             */

/**
 * Ancre moteur antérieure. Six égalités obligatoires — session, page, frame,
 * part, côté — plus `visitIndex` STRICTEMENT antérieur, plus un moteur
 * réellement `candidate`.
 *
 * UNE ABSTENTION N'EST JAMAIS UNE ANCRE, même répétée à l'identique : une suite
 * d'abstentions stables ne prouve rien sur le placement, elle prouve seulement
 * que le moteur a refusé plusieurs fois.
 *
 * AUCUNE FENÊTRE MAXIMALE N'EST CHOISIE. Les écarts sont exposés ; les valeurs
 * 1/2/3/5/10/20/40 déjà regardées sont du développement, pas des seuils.
 */
function causalHistory(row, all) {
  const k = row.decisionFeatures;
  const past = all.filter(o =>
    o.decisionFeatures.sessionId === k.sessionId &&
    o.decisionFeatures.target.pageId === k.target.pageId &&
    o.decisionFeatures.target.frameId === k.target.frameId &&
    o.decisionFeatures.target.part === k.target.part &&
    o.decisionFeatures.side === k.side &&
    o.decisionFeatures.visitIndex < k.visitIndex &&
    o.population === 'engine-candidate');
  if (!past.length) return { anchorFound: false, reason: 'aucun-candidat-moteur-anterieur',
                             candidatesConsidered: 0, anchor: null };
  const a = past.reduce((b, o) => o.decisionFeatures.visitIndex > b.decisionFeatures.visitIndex ? o : b);
  const mine = k.candidates, his = a.decisionFeatures.candidates;
  const applied = a.decisionFeatures.candidates.seed;   // le moteur applique sa graine
  return {
    anchorFound: true, candidatesConsidered: past.length,
    anchor: {
      cut: a.decisionFeatures.target.cut,
      visitIndex: a.decisionFeatures.visitIndex,
      visitId: a.decisionFeatures.visitId,
      cutGap: k.target.cut - a.decisionFeatures.target.cut,
      visitIndexGap: k.visitIndex - a.decisionFeatures.visitIndex,
      anchorStatus: a.decisionFeatures.status,
      anchorConfidence: a.decisionFeatures.confidence,
      anchorLossRatio: a.decisionFeatures.lossRatio,
      anchorSeed: applied,
      /* distance de CHAQUE famille courante au placement moteur antérieur —
       * trois nombres exposés, aucun n'est préféré */
      distanceFromAnchor: {
        seed: mine.seed && applied ? norm(mine.seed, applied) : null,
        surfaceIntersection: mine.surfaceIntersection && applied ? norm(mine.surfaceIntersection, applied) : null,
        alternative: mine.alternative && applied ? norm(mine.alternative, applied) : null,
      },
      anchorCandidates: his,
    },
    windowChosen: null,
    windowNote: 'aucune fenêtre maximale n’est retenue : les écarts sont exposés bruts',
  };
}

/* ========================= 3. oppositeRailContext ==========================
 * L'état de l'autre rail. AUCUN rail n'est déplacé, ici ni ailleurs.         */

const OPPOSITE_STATES = ['opposite-candidate', 'opposite-flank-only', 'opposite-other-abstention',
                         'opposite-no-candidate', 'opposite-not-replayable'];

function oppositeRailContext(row, byVisitSide) {
  const k = row.decisionFeatures;
  const other = k.side === 'left' ? 'right' : 'left';
  const o = byVisitSide.get(`${k.sessionId}|${k.visitId}|${other}`);
  if (!o) return { side: other, state: 'opposite-not-replayable', reason: 'rail-absent', features: null };
  const state =
    o.population === 'engine-candidate' ? 'opposite-candidate' :
    o.population === 'flank-only' ? 'opposite-flank-only' :
    o.population === 'no-candidate' ? 'opposite-no-candidate' :
    o.population.startsWith('not-replayable') ? 'opposite-not-replayable' : 'opposite-other-abstention';
  return {
    side: other, state, population: o.population,
    railMoved: false,
    note: 'état exposé pour permettre d’évaluer PLUS TARD une architecture de type '
        + 'lock-resolved-rail ; aucun rail n’est déplacé par ce banc',
    /* `?? null` partout : un champ absent et un champ `undefined` se
     * sérialisent différemment, et le shadow doit rester identique à
     * lui-même après un aller-retour JSON. Vérifié par le test de
     * déterminisme. */
    features: o.decisionFeatures ? {
      status: o.decisionFeatures.status ?? null,
      lossRatio: o.decisionFeatures.lossRatio ?? null,
      faceCount: o.decisionFeatures.faceCount ?? null,
      topCount: o.decisionFeatures.topCount ?? null,
      confidence: o.decisionFeatures.confidence ?? null,
      candidates: o.decisionFeatures.candidates,
    } : null,
  };
}

/* ======================= FRONTIÈRE — l'humain entre ici ====================
 * Tout ce qui précède a été construit sans aucune valeur humaine.            */

/**
 * Mesure post hoc. La référence humaine est OBSERVATIONNELLE : la collecte la
 * marque `usableForTraining: false` sur 679 visites sur 679. Elle ne devient
 * pas une vérité d'entraînement ici et n'a influencé aucun bloc précédent.
 */
function postHocEvaluation(row, visit, rail, tol = TOLERANCE_ORACLE) {
  const ref = visit.humanFinalReference;
  const base = { humanStatus: ref?.status ?? 'absent', tolerance: tol,
                 toleranceIsEvaluationOnly: true };
  if (!rail) return { ...base, qualified: false, verdict: 'reference-non-qualifiable' };
  if (!ref || ref.status !== 'candidate-observed')
    return { ...base, qualified: false, verdict: 'reference-absente-ou-ambigue' };
  const side = row.decisionFeatures.side;
  const finalRail = ref.state?.rails?.[side];
  const a = rail.profileOriginSceneRelative, b = finalRail?.profileOriginSceneRelative;
  if (!a || !b) return { ...base, qualified: false, verdict: 'reference-non-qualifiable' };
  const human = N.move(rail.sceneRelativeToProfileLocal, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  const cands = row.decisionFeatures.candidates, errors = {};
  for (const [n, d] of Object.entries(cands)) errors[n] = d ? norm(d, human) : null;
  const measured = Object.entries(errors).filter(([, v]) => v !== null);
  if (!measured.length) return { ...base, qualified: true, humanDeltaLocal: human, errors,
                                 best: null, verdict: 'aucun-candidat-expose' };
  const [bestName, bestErr] = measured.sort((x, y) => x[1] - y[1])[0];
  const seedOk = errors.seed !== null && errors.seed <= tol;
  return {
    ...base, qualified: true, humanDeltaLocal: human, errors,
    best: { family: bestName, error: bestErr },
    verdict: seedOk ? 'seed-satisfaisant'
           : bestErr <= tol ? 'seed-insuffisant-autre-candidat-satisfaisant'
           : 'aucun-candidat-expose-satisfaisant',
  };
}

/* --------------------------------------------------- sessions dégradées */

/**
 * Tranche de dégradation.
 *
 * La consigne nomme une session signalant des événements perdus. Le banc ne la
 * croit pas sur parole : il vérifie sa présence et publie le résultat. Si elle
 * est absente, ou si aucune perte n'est constatée, chaque ligne est marquée
 * `not-applicable` — jamais mélangée en silence à une tranche tardive.
 *
 * Quand une perte existe, la frontière est le DERNIER snapshot explicitement
 * sans perte, et chaque ligne est marquée `before-last-lossless-snapshot` ou
 * `after-last-lossless-snapshot`.
 */
function degradationContext(rows, sessionsSeen, degraded = DEGRADED_SESSIONS) {
  const report = degraded.map(id => {
    const present = sessionsSeen.has(id);
    return { sessionId: id, present,
             note: present ? null
                 : 'session ABSENTE de la collecte lue — aucune ligne ne peut lui être rattachée' };
  });
  const boundary = new Map();
  for (const id of degraded) {
    if (!sessionsSeen.has(id)) continue;
    const mine = rows.filter(r => r.decisionFeatures.sessionId === id && r.population !== 'not-replayable');
    const lossless = mine.filter(r => r.decisionFeatures.captureContext.lidarStatus === null
                                   || r.decisionFeatures.captureContext.visitStatus === 'complete');
    boundary.set(id, lossless.length
      ? Math.max(...lossless.map(r => r.decisionFeatures.visitIndex)) : -Infinity);
  }
  for (const r of rows) {
    const id = r.decisionFeatures.sessionId;
    if (!boundary.has(id)) {
      r.degradation = { degradedSession: false, slice: 'not-applicable',
                        excludedFromCausalAnalysis: false };
      continue;
    }
    const b = boundary.get(id);
    const after = r.decisionFeatures.visitIndex > b;
    r.degradation = { degradedSession: true, lastLosslessVisitIndex: b,
                      slice: after ? 'after-last-lossless-snapshot' : 'before-last-lossless-snapshot',
                      excludedFromCausalAnalysis: after };
  }
  return report;
}

/* ------------------------------------------------------------------ pilote */

function build(dir) {
  const frozen = N.assertFrozenEngine();
  const index = N.indexCollection(dir);
  const visits = N.readVisits(dir, index);
  const needed = new Set();
  for (const v of visits) for (const s of ['left', 'right']) {
    const el = v.geometryEligibility?.[s];
    if (el?.status === 'comparable-candidate') for (const id of el.chunkIds ?? []) needed.add(id);
  }
  const chunks = N.readNeededChunks(dir, index, needed);

  /* étape 1 — rejeu et features, sans aucune valeur humaine */
  const rows = [], railsByKey = new Map(), poses = new Map();
  for (const visit of visits) for (const side of ['left', 'right']) {
    const r = replayRailExact(visit, side, chunks);
    const pop = population(r);
    const row = {
      population: pop,
      eligibility: { status: r.eligibility, failClosed: r.failClosed,
                     reasons: visit.geometryEligibility?.[side]?.reasons ?? [] },
      decisionFeatures: r.replayed ? decisionFeatures(r, side, visit) : {
        side, status: null, abstentionReasons: [], candidates: { seed: null, surfaceIntersection: null, alternative: null },
        target: { part: visit.identity.part, cut: visit.identity.cut, pageId: visit.identity.pageId,
                  frameId: visit.identity.frameId, shape: visit.identity.shape },
        sessionId: visit.sessionId, visitIndex: visit.visitIndex, visitId: visit.visitId,
        snapshotId: null, snapshotsAvailable: null,
        captureContext: { visitStatus: visit.status, lidarStatus: visit.lidarStatus },
      },
    };
    rows.push(row);
    railsByKey.set(`${visit.sessionId}|${visit.visitId}|${side}`, row);
    poses.set(row, { visit, rail: r.rail ?? null });
  }
  /* étape 2 — histoire causale et rail opposé, toujours sans humain */
  for (const row of rows) {
    row.causalHistory = causalHistory(row, rows);
    row.oppositeRailContext = oppositeRailContext(row, railsByKey);
  }
  const degradationReport = degradationContext(rows, new Set(visits.map(v => v.sessionId)));
  /* étape 3 — SEULEMENT MAINTENANT, la référence humaine */
  for (const row of rows) {
    const { visit, rail } = poses.get(row);
    row.postHocEvaluation = postHocEvaluation(row, visit, rail);
  }
  return { frozen, index, rows, degradationReport, chunksNeeded: needed.size, chunksRead: chunks.size };
}

const tally = (list, key) => {
  const m = {};
  for (const x of list) { const k = String(key(x)); m[k] = (m[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

function summarise(rows) {
  const flank = rows.filter(r => r.population === 'flank-only');
  return {
    rails: rows.length,
    population: tally(rows, r => r.population),
    failClosed: tally(rows.filter(r => r.eligibility.failClosed), r => r.eligibility.failClosed),
    flankOnly: {
      rails: flank.length,
      bySide: tally(flank, r => r.decisionFeatures.side),
      byPart: tally(flank, r => r.decisionFeatures.target.part),
      anchorFound: tally(flank, r => r.causalHistory.anchorFound),
      oppositeState: tally(flank, r => r.oppositeRailContext.state),
      postHocVerdict: tally(flank, r => r.postHocEvaluation.verdict),
    },
    allPopulationsPostHoc: tally(rows, r => r.postHocEvaluation.verdict),
    degradationSlice: tally(rows, r => r.degradation.slice),
    note: 'aucun seuil, aucun score combiné, aucun classifieur, aucun gagnant',
  };
}

function main() {
  const dir = process.argv[2];
  if (!dir) { console.error('usage : node tools/flank-support-shadow.cjs <dossier-collecte> [--output f.json]'); process.exit(2); }
  const { frozen, rows, degradationReport, index, chunksNeeded, chunksRead } = build(dir);
  const body = {
    format: 'banane-flank-support-shadow-v1',
    nature: 'instrumentation hors ligne, lecture seule — aucune politique, aucun seuil, aucun runtime',
    studiedAbstention: FLANK_REASON,
    engine: { version: '4.6.0', geometryMethod: G.DEFAULTS.method, parameters: G.DEFAULTS,
              frozenHashes: frozen, calledWithoutOptions: true },
    snapshotPolicy: { exactOnly: true, fallbackToLastSnapshot: false,
                      note: 'snapshotId introuvable ⇒ rail refusé, jamais de repli silencieux' },
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified; never millimetres',
    evaluationConvention: { tolerance: TOLERANCE_ORACLE, usedFor: 'comptage uniquement',
                            neverA: ['seuil runtime', 'calibration physique'] },
    blocks: { humanFreeBlocks: ['decisionFeatures', 'causalHistory', 'oppositeRailContext'],
              humanBlock: 'postHocEvaluation' },
    collection: { directory: path.resolve(dir), files: index.files.length, chunksNeeded, chunksRead },
    degradedSessions: degradationReport,
    oppositeStates: OPPOSITE_STATES,
    summary: summarise(rows),
    rows,
  };
  /* Déterminisme : l'empreinte porte sur le contenu, l'horodatage en est exclu. */
  const hashed = { format: body.format, studiedAbstention: body.studiedAbstention,
                   engine: body.engine, snapshotPolicy: body.snapshotPolicy,
                   summary: body.summary, rows: body.rows };
  body.sha256 = crypto.createHash('sha256').update(JSON.stringify(hashed)).digest('hex');
  body.sha256Covers = ['format', 'studiedAbstention', 'engine', 'snapshotPolicy', 'summary', 'rows'];
  body.generatedAt = new Date().toISOString();
  const out = process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : null;
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(body, null, 1)); }
  console.log(JSON.stringify(body.summary, null, 1));
  console.log('sha256 du contenu :', body.sha256);
  if (out) console.log('écrit :', out);
}

module.exports = { FLANK_REASON, TOLERANCE_ORACLE, DEGRADED_SESSIONS, OPPOSITE_STATES,
                   exactSnapshot, replayRailExact, population, decisionFeatures, causalHistory,
                   oppositeRailContext, postHocEvaluation, degradationContext, build, summarise, norm, mag };
if (require.main === module) main();
