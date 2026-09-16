#!/usr/bin/env node
'use strict';
/* Flank Support Shadow V1.2 — instrumentation HORS LIGNE, LECTURE SEULE.
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
 *
 * V1.1 — quatre corrections, aucune n'altère les résultats du corpus historique :
 *
 *   1. INGESTION TOLÉRANTE. Une archive contient des fichiers qui ne sont pas des
 *      exports Natif — un bilan, un journal de test. Le banc ne suppose plus que
 *      tout `.json` porte `session`, `segment`, `records` et `dictionaries` : il
 *      valide la structure, ignore le reste et RAPPORTE chaque fichier écarté
 *      avec son motif. Le piège est réel : le bilan porte le bon `format` mais
 *      n'a pas de `session`, donc le format seul ne suffit pas à trancher.
 *
 *   2. DÉGRADATION LUE, PAS DÉDUITE. V1 déduisait « sans perte » de
 *      `visitStatus` / `lidarStatus`, qui ne parlent pas de perte d'événements.
 *      V1.1 lit les métadonnées réelles — `metrics.dropped`,
 *      `metrics.degradationEvents`, `metrics.degradationPeak`, et la cohérence
 *      de séquence `nextEventSeq` contre les événements exportés — détermine le
 *      DERNIER export explicitement sans perte, et marque chaque visite par
 *      rapport à cette vraie frontière.
 *
 *   3. `reliableObservation`. Le statut brut `candidate-observed` est conservé
 *      tel quel, et un second champ applique le critère observationnel
 *      historique du projet, repris VERBATIM de `src/native-session.js` — aucun
 *      critère nouveau n'est inventé. Les compteurs sont publiés deux fois :
 *      sur tous les `candidate-observed`, et sur le seul sous-ensemble fiable.
 *
 *   4. `pointsUsed`. V1 le laissait à `null` et rangeait à tort le compte de
 *      points RETENUS sous `pointsInCapture`. V1.1 sépare les deux : les points
 *      réellement fournis au moteur, et ceux qu'il retient après filtrage.
 *
 * V1.2 — correction causale minimale. AUCUN résultat géométrique ne change.
 *
 *   Une ligne d'une tranche dégradée garde ses données descriptives et son
 *   post-hoc — on ne jette rien — mais son histoire causale devient NON
 *   ADMISSIBLE, et elle ne peut plus servir d'ancre à une analyse dite propre.
 *   Les compteurs sont publiés DEUX FOIS : descriptifs complets, puis
 *   `causal-clean` seuls. Une tranche dégradée ne peut pas contaminer une
 *   statistique d'ancre en se glissant dans le passé d'une autre ligne.
 *
 *   La dégradation est donc désormais calculée AVANT l'histoire causale. Elle ne
 *   lit ni valeur humaine ni géométrie : uniquement les métadonnées d'export.
 *   Les lignes antérieures à la frontière conservent exactement leur histoire
 *   V1.1 — propriété vérifiée par test, et vraie par construction puisqu'une
 *   ligne dégradée a toujours un `visitIndex` supérieur à la frontière et ne
 *   peut donc jamais précéder une ligne admissible.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const N = require('./native-replay.cjs');

/**
 * Structure minimale d'un export Natif exploitable. Le `format` seul ne suffit
 * pas : le bilan de l'archive finale porte `banane-native-session-v3-compact`
 * sans aucune `session`. On valide donc ce dont on a besoin, pas une étiquette.
 */
const NATIVE_FORMAT = 'banane-native-session-v3-compact';
function classifyExport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'racine-non-objet';
  if (raw.format !== NATIVE_FORMAT) return `format-non-natif:${raw.format ?? 'absent'}`;
  for (const k of ['session', 'segment', 'records', 'dictionaries'])
    if (!raw[k]) return `champ-manquant:${k}`;
  if (typeof raw.session.id !== 'string' || !raw.session.id) return 'champ-manquant:session.id';
  if (!Array.isArray(raw.records)) return 'records-non-tableau';
  if (typeof raw.segment.stamp !== 'string') return 'champ-manquant:segment.stamp';
  return null;                                           // exploitable
}

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
  return { replayed: true, eligibility, failClosed: null, rail, pointsSupplied: points.length,
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
    /* `metrics.points` est le nombre de points que le moteur RETIENT après son
     * filtrage de ROI, pas le nombre qu'on lui a donné. V1 le rangeait sous
     * `pointsInCapture` et laissait `pointsUsed` à null : les deux sont
     * désormais distincts et tous deux renseignés. */
    pointsSupplied: r.pointsSupplied ?? null,
    pointsUsed: m?.points ?? null,
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
function causalHistory(row, all, { pool = null } = {}) {
  const k = row.decisionFeatures;
  const past = (pool ?? all).filter(o =>
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
 * Critère d'observation fiable — REPRIS VERBATIM du projet.
 *
 * Aucun critère nouveau n'est inventé ici. Ce sont exactement les
 * `referenceReasons` de `src/native-session.js` (une intention opérateur unique
 * et valant VALIDATE ; un état de référence présent ; une identité concordante ;
 * une fraîcheur d'association dans [0, 1500] ms ; un effet de décision observé ;
 * et, côté par côté, un état de rail présent). C'est le critère qui produit le
 * compteur `humanReliableObservationAssociations` du manifest de la collecte.
 *
 * Il est recalculé à partir des champs bruts, et non lu depuis l'éligibilité :
 * la comparaison des deux est elle-même un contrôle de cohérence.
 */
function reliableObservation(visit, side) {
  const reasons = [];
  const intents = visit.operatorIntents || [];
  const sole = intents.length === 1 ? intents[0] : null;
  const multi = intents.length > 1;
  if (!sole || sole.intent !== 'VALIDATE')
    reasons.push(multi ? 'multiple-operator-intents-observed'
      : sole?.intent === 'SKIP' ? 'operator-skip-observed' : 'validated-reference-not-observed');
  const ref = visit.humanFinalReference;
  if (!ref?.state) reasons.push('human-final-reference-missing');
  if (ref?.association?.identityMatched === false) reasons.push('human-final-reference-identity-mismatch');
  const fresh = ref?.association?.freshnessMs;
  /* EXACTEMENT le test du runtime, et rien de plus :
   *   freshnessMs === null || freshnessMs < 0 || freshnessMs > 1500
   * `undefined` n'y figure pas — et n'y tombe pas non plus, puisque
   * `undefined === null` est faux et que ses comparaisons le sont aussi. Le
   * banc ne peut donc pas l'y ajouter en se réclamant du verbatim.
   * (V1.1 l'ajoutait : c'était une divergence, corrigée en V1.3.) */
  if (fresh === null || fresh < 0 || fresh > 1500)
    reasons.push('human-final-reference-not-freshly-observed');
  if (!visit.navigationObserved) reasons.push('decision-effect-not-observed');
  if (!ref?.state?.rails?.[side]) reasons.push('human-final-rail-state-missing');
  /* Garde PROPRE AU BANC, publiée à part et jamais mêlée au critère runtime :
   * une fraîcheur absente n'est pas la même chose qu'une fraîcheur nulle, et le
   * runtime ne la voit pas. On la signale sans l'ériger en critère. */
  const benchGuards = [];
  if (fresh === undefined) benchGuards.push('freshness-undefined-not-seen-by-runtime');
  return { reliable: reasons.length === 0, reasons,
           criterion: 'src/native-session.js — referenceReasons, repris verbatim',
           runtimeTest: 'freshnessMs === null || freshnessMs < 0 || freshnessMs > 1500',
           benchGuards, benchGuardsAreNotRuntimeCriterion: true,
           freshnessMs: fresh ?? null, freshnessWindowMs: [0, 1500] };
}

/**
 * Mesure post hoc. La référence humaine est OBSERVATIONNELLE : la collecte la
 * marque `usableForTraining: false` sur 679 visites sur 679. Elle ne devient
 * pas une vérité d'entraînement ici et n'a influencé aucun bloc précédent.
 */
function postHocEvaluation(row, visit, rail, tol = TOLERANCE_ORACLE) {
  const ref = visit.humanFinalReference;
  const rel = reliableObservation(visit, row.decisionFeatures.side);
  /* Le statut BRUT est conservé tel quel ; la fiabilité observationnelle est un
   * champ SÉPARÉ, jamais une réécriture du statut. */
  const base = { humanStatus: ref?.status ?? 'absent', reliableObservation: rel,
                 tolerance: tol, toleranceIsEvaluationOnly: true };
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
 * Perte d'un export, LUE dans ses métadonnées — jamais déduite.
 *
 * V1 regardait `visitStatus` et `lidarStatus` : ces deux champs décrivent la
 * complétude d'une visite et d'une capture, pas la perte d'événements. Un export
 * peut être plein de visites « complete » et avoir perdu 65 événements.
 *
 * Un export est explicitement SANS PERTE quand les quatre signaux le disent :
 * aucun événement abandonné, aucun événement de dégradation, un pic de
 * dégradation resté à `FULL`, et une séquence d'événements sans trou.
 */
function exportLoss(raw) {
  const s = raw.session ?? {}, m = s.metrics ?? {}, et = raw.exportTrace ?? {};
  const exported = Array.isArray(raw.events) ? raw.events.length : null;
  const nextSeq = typeof s.nextEventSeq === 'number' ? s.nextEventSeq : null;
  /* Un trou de séquence est un DÉFICIT : plus d'événements exportés que la
   * séquence n'en annonce n'est pas une perte. */
  const sequenceGap = nextSeq !== null && exported !== null ? Math.max(0, nextSeq - exported) : null;
  const dropped = m.dropped ?? null, degradationEvents = m.degradationEvents ?? null;
  const degradationPeak = m.degradationPeak ?? null, degradationLevel = m.degradationLevel ?? null;
  const signals = { dropped, degradationEvents, degradationPeak, degradationLevel,
                    recoveries: m.recoveries ?? null, sendFailures: m.sendFailures ?? null,
                    interruptions: s.interruptions ?? null,
                    nextEventSeq: nextSeq, eventsExported: exported, sequenceGap,
                    allRequestedObjectsPresent: et.allRequestedObjectsPresent ?? null };
  const known = dropped !== null && degradationEvents !== null && degradationPeak !== null && sequenceGap !== null;
  const lossless = known && dropped === 0 && degradationEvents === 0
                 && degradationPeak === 'FULL' && sequenceGap === 0;
  const why = [];
  if (!known) why.push('signaux-incomplets');
  if (dropped) why.push(`dropped=${dropped}`);
  if (degradationEvents) why.push(`degradationEvents=${degradationEvents}`);
  if (degradationPeak && degradationPeak !== 'FULL') why.push(`degradationPeak=${degradationPeak}`);
  if (sequenceGap) why.push(`sequenceGap=${sequenceGap}`);
  return { lossless, reasons: why, signals,
           /* informatif, volontairement HORS du critère : il parle de la
            * complétude des objets exportés, pas de perte d'événements */
           allRequestedObjectsPresentIsInformativeOnly: true };
}

/**
 * Frontière de dégradation, par session.
 *
 * La frontière est le DERNIER export explicitement sans perte, au sens de
 * `exportLoss`. Toute visite d'indice supérieur au plus grand `visitIndex` que
 * cet export contenait est déclarée postérieure, donc écartée des analyses
 * causales. Une session dont tous les exports sont sans perte n'a pas de
 * frontière : ses lignes sont `lossless-throughout`, jamais `not-applicable`
 * par défaut silencieux.
 */
function degradationBoundaries(exports) {
  const bySession = new Map();
  for (const e of exports) {
    if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
    bySession.get(e.sessionId).push(e);
  }
  const out = new Map();
  for (const [sid, list] of bySession) {
    const sorted = list.slice().sort((a, b) => a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : 0);
    const lossless = sorted.filter(e => e.loss.lossless);
    const degraded = sorted.filter(e => !e.loss.lossless);
    const last = lossless.length ? lossless[lossless.length - 1] : null;
    out.set(sid, {
      sessionId: sid, exports: sorted.length,
      losslessExports: lossless.length, degradedExports: degraded.length,
      anyLoss: degraded.length > 0,
      lastLosslessExport: last ? { file: last.file, stamp: last.stamp, segment: last.segment,
                                   maxVisitIndex: last.maxVisitIndex } : null,
      firstDegradedExport: degraded.length ? { file: degraded[0].file, stamp: degraded[0].stamp,
                                               reasons: degraded[0].loss.reasons } : null,
      perExport: sorted.map(e => ({ file: e.file, stamp: e.stamp, segment: e.segment,
                                    records: e.records, maxVisitIndex: e.maxVisitIndex,
                                    lossless: e.loss.lossless, reasons: e.loss.reasons,
                                    signals: e.loss.signals })),
    });
  }
  return out;
}

/** Marque chaque ligne par rapport à la vraie frontière de sa session. */
function applyDegradation(rows, boundaries) {
  for (const r of rows) {
    const b = boundaries.get(r.decisionFeatures.sessionId);
    if (!b) { r.degradation = { degradedSession: false, slice: 'session-inconnue',
                                excludedFromCausalAnalysis: false, lastLosslessVisitIndex: null }; continue; }
    if (!b.anyLoss) { r.degradation = { degradedSession: false, slice: 'lossless-throughout',
                                        excludedFromCausalAnalysis: false, lastLosslessVisitIndex: null }; continue; }
    const cut = b.lastLosslessExport ? b.lastLosslessExport.maxVisitIndex : -Infinity;
    const after = r.decisionFeatures.visitIndex > cut;
    r.degradation = { degradedSession: true, lastLosslessVisitIndex: Number.isFinite(cut) ? cut : null,
                      slice: after ? 'after-last-lossless-snapshot' : 'before-last-lossless-snapshot',
                      excludedFromCausalAnalysis: after };
  }
}

/**
 * Admissibilité causale — V1.2.
 *
 * Une ligne dont `degradation.excludedFromCausalAnalysis` est vrai reste
 * DÉCRITE : ses features, son histoire descriptive et son post-hoc sont
 * conservés à l'identique. Mais :
 *
 *   · son `causalHistory.admissible` passe à faux ;
 *   · elle n'entre dans aucune statistique d'ancre « propre » ;
 *   · elle ne peut servir d'ancre à AUCUNE ligne dans l'analyse propre.
 *
 * L'analyse propre est calculée sur un vivier restreint, et non en filtrant
 * après coup : un passé dégradé ne peut donc pas s'y glisser.
 *
 * Les lignes admissibles retrouvent exactement leur histoire V1.1, parce qu'une
 * ligne dégradée a par construction un `visitIndex` postérieur à la frontière
 * et ne pouvait donc déjà pas les précéder. Vérifié par test, pas supposé.
 */
function applyCausalAdmissibility(rows) {
  const clean = rows.filter(r => r.degradation.excludedFromCausalAnalysis !== true);
  for (const row of rows) {
    const admissible = row.degradation.excludedFromCausalAnalysis !== true;
    row.causalHistory.admissible = admissible;
    row.causalHistory.admissibility = admissible
      ? { status: 'causal-clean', slice: row.degradation.slice }
      : { status: 'excluded-degraded-slice', slice: row.degradation.slice,
          note: 'ligne conservée et décrite, mais retirée de l’analyse causale et '
              + 'interdite comme ancre d’une analyse propre' };
    row.causalHistory.clean = admissible
      ? causalHistory(row, rows, { pool: clean })
      : { anchorFound: false, reason: 'ligne-non-admissible', candidatesConsidered: 0, anchor: null };
    delete row.causalHistory.clean.admissible;
  }
}

/* ------------------------------------------------------------------ pilote */

/**
 * Lecture d'un corpus. Le banc a son PROPRE lecteur : celui de
 * `tools/native-replay.cjs` suppose que tout `.json` est un export Natif et
 * planterait sur le bilan de l'archive finale. `native-replay.cjs` n'est pas
 * modifié, pour que ses résultats restent reproductibles à l'octet.
 */
function readCorpus(dir) {
  const files = fs.readdirSync(dir, { recursive: true })
    .filter(f => typeof f === 'string' && f.endsWith('.json')).sort();
  const exports_ = [], ignored = [];
  for (const f of files) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(dir, f))); }
    catch (e) { ignored.push({ file: f, reason: 'json-illisible', detail: String(e.message).slice(0, 80) }); continue; }
    const bad = classifyExport(raw);
    if (bad) { ignored.push({ file: f, reason: bad, format: raw?.format ?? null }); raw = null; continue; }
    exports_.push({ file: f, sessionId: raw.session.id, stamp: raw.segment.stamp,
                    segment: raw.segment.index ?? null, records: raw.records.length,
                    maxVisitIndex: raw.records.reduce((m, r) => Math.max(m, r.visitIndex ?? -1), -1),
                    loss: exportLoss(raw) });
    raw = null;
  }
  if (!exports_.length) throw Error('Aucun export Natif exploitable dans ' + dir);
  /* Le plus complet d'une session est le plus TARDIF, pas le plus haut en
   * indice de segment : les fichiers sans « auto- » sont des exports manuels
   * postérieurs. Constaté sur les données, pas supposé. */
  const latest = new Map();
  for (const e of exports_)
    if (!latest.has(e.sessionId) || e.stamp > latest.get(e.sessionId).stamp) latest.set(e.sessionId, e);
  return { dir, files, exports: exports_, ignored, latestPerSession: latest };
}

/** Visites dédupliquées, avec les champs nécessaires au critère observationnel. */
function readVisitsOf(corpus) {
  const visits = [];
  for (const { file } of corpus.latestPerSession.values()) {
    const raw = JSON.parse(fs.readFileSync(path.join(corpus.dir, file)));
    const deref = N.derefer(raw.dictionaries);
    for (const r of raw.records) visits.push({
      sessionId: raw.session.id, sourceFile: file,
      visitId: r.visitId, visitIndex: r.visitIndex, identity: deref(r.identity),
      status: r.status, lidarStatus: r.lidarStatus ?? null,
      multiIntent: r.multiIntent === true,
      operatorIntents: deref(r.operatorIntents ?? []),
      navigationObserved: r.navigationObserved === true,
      observedLabelCandidate: r.observedLabelCandidate ?? null,
      usableAsNativeReference: r.usableAsNativeReference === true,
      geometryEligibility: deref(r.geometryEligibility ?? null),
      railSnapshots: deref(r.railSnapshots ?? null),
      humanFinalReference: deref(r.humanFinalReference ?? null),
    });
  }
  return visits;
}

function readChunksOf(corpus, needed) {
  const out = new Map();
  for (const e of corpus.exports) {
    const raw = JSON.parse(fs.readFileSync(path.join(corpus.dir, e.file)));
    for (const c of raw.clouds ?? []) {
      if (c.format !== 'banane-native-lidar-chunk-v1') continue;
      if (!needed.has(c.chunkId) || out.has(c.chunkId)) continue;
      out.set(c.chunkId, { points: c.pointsSceneRelative, visible: c.visibleByClipBoxes ?? null });
    }
    if (out.size === needed.size) break;
  }
  return out;
}

/** Construit le shadow d'UN corpus. Les trois étages gardent leur ordre. */
function buildCorpus(dir, name) {
  const corpus = readCorpus(dir);
  const visits = readVisitsOf(corpus);
  const needed = new Set();
  for (const v of visits) for (const s of ['left', 'right']) {
    const el = v.geometryEligibility?.[s];
    if (el?.status === 'comparable-candidate') for (const id of el.chunkIds ?? []) needed.add(id);
  }
  const chunks = readChunksOf(corpus, needed);
  const rows = [], byKey = new Map(), poses = new Map();
  for (const visit of visits) for (const side of ['left', 'right']) {
    const r = replayRailExact(visit, side, chunks);
    const row = {
      corpus: name, population: population(r),
      eligibility: { status: r.eligibility, failClosed: r.failClosed,
                     reasons: visit.geometryEligibility?.[side]?.reasons ?? [] },
      decisionFeatures: r.replayed ? decisionFeatures(r, side, visit) : {
        side, status: null, abstentionReasons: [], pointsSupplied: null, pointsUsed: null,
        candidates: { seed: null, surfaceIntersection: null, alternative: null },
        target: { part: visit.identity.part, cut: visit.identity.cut, pageId: visit.identity.pageId,
                  frameId: visit.identity.frameId, shape: visit.identity.shape },
        sessionId: visit.sessionId, visitIndex: visit.visitIndex, visitId: visit.visitId,
        snapshotId: null, snapshotsAvailable: null,
        captureContext: { visitStatus: visit.status, lidarStatus: visit.lidarStatus },
      },
    };
    rows.push(row);
    byKey.set(`${visit.sessionId}|${visit.visitId}|${side}`, row);
    poses.set(row, { visit, rail: r.rail ?? null });
  }
  /* La dégradation est établie AVANT l'histoire causale : elle ne lit que des
   * métadonnées d'export, donc aucune information géométrique ni humaine. */
  const boundaries = degradationBoundaries(corpus.exports);
  applyDegradation(rows, boundaries);
  for (const row of rows) {
    row.causalHistory = causalHistory(row, rows);
    row.oppositeRailContext = oppositeRailContext(row, byKey);
  }
  applyCausalAdmissibility(rows);
  /* --- frontière : l'humain entre seulement maintenant --- */
  for (const row of rows) {
    const { visit, rail } = poses.get(row);
    row.postHocEvaluation = postHocEvaluation(row, visit, rail);
  }
  return { name, dir, corpus, visits, rows, boundaries,
           chunksNeeded: needed.size, chunksRead: chunks.size };
}



/* ------------------------------------------------------- agrégats et pilote */

const tally = (list, key) => {
  const m = {};
  for (const x of list) { const k = String(key(x)); m[k] = (m[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

/**
 * Compteurs post hoc. Publiés DEUX FOIS : sur tous les `candidate-observed`,
 * puis sur le seul sous-ensemble observationnellement fiable. Le second n'est
 * pas une correction du premier : les deux sont livrés côte à côte.
 */
function postHocCounters(rows) {
  const observed = rows.filter(r => r.postHocEvaluation.humanStatus === 'candidate-observed');
  const reliable = observed.filter(r => r.postHocEvaluation.reliableObservation.reliable);
  const block = list => ({
    rails: list.length,
    verdicts: tally(list, r => r.postHocEvaluation.verdict),
    otherCandidateFamily: tally(
      list.filter(r => r.postHocEvaluation.verdict === 'seed-insuffisant-autre-candidat-satisfaisant'),
      r => r.postHocEvaluation.best.family),
  });
  return { allCandidateObserved: block(observed), reliableObservationOnly: block(reliable),
           notCandidateObserved: rows.length - observed.length };
}

function summarise(rows, boundaries) {
  const flank = rows.filter(r => r.population === 'flank-only');
  const deg = {};
  if (boundaries) for (const [sid, b] of boundaries) {
    if (!b.anyLoss) continue;
    const mine = rows.filter(r => r.decisionFeatures.sessionId === sid);
    deg[sid] = { lastLosslessExport: b.lastLosslessExport, firstDegradedExport: b.firstDegradedExport,
                 railsBySlice: tally(mine, r => r.degradation.slice),
                 flankOnlyBySlice: tally(mine.filter(r => r.population === 'flank-only'),
                                         r => r.degradation.slice) };
  }
  return {
    rails: rows.length,
    visits: new Set(rows.map(r => `${r.decisionFeatures.sessionId}|${r.decisionFeatures.visitId}`)).size,
    sessions: new Set(rows.map(r => r.decisionFeatures.sessionId)).size,
    population: tally(rows, r => r.population),
    failClosed: tally(rows.filter(r => r.eligibility.failClosed), r => r.eligibility.failClosed),
    flankOnly: {
      rails: flank.length,
      bySide: tally(flank, r => r.decisionFeatures.side),
      byPart: tally(flank, r => r.decisionFeatures.target.part),
      anchorFound: tally(flank, r => r.causalHistory.anchorFound),
      oppositeState: tally(flank, r => r.oppositeRailContext.state),
      postHoc: postHocCounters(flank),
    },
    /* V1.2 — les DEUX jeux, côte à côte. Le second ne corrige pas le premier :
     * il répond à une autre question, sur un sous-ensemble admissible. */
    causalAnchors: {
      descriptive: { rails: rows.length, flankOnly: flank.length,
                     anchorFound: tally(flank, r => r.causalHistory.anchorFound) },
      causalClean: (() => {
        const cr = rows.filter(r => r.causalHistory.admissible);
        const cf = cr.filter(r => r.population === 'flank-only');
        return { rails: cr.length, flankOnly: cf.length,
                 anchorFound: tally(cf, r => r.causalHistory.clean.anchorFound),
                 excludedRails: rows.length - cr.length,
                 excludedFlankOnly: flank.length - cf.length };
      })(),
    },
    flankWithOthers: { rails: rows.filter(r => r.population === 'flank-with-others').length },
    engineCandidate: { rails: rows.filter(r => r.population === 'engine-candidate').length },
    noCandidate: { rails: rows.filter(r => r.population === 'no-candidate').length },
    allPopulationsPostHoc: postHocCounters(rows),
    degradationSlice: tally(rows, r => r.degradation.slice),
    degradedSessions: deg,
    note: 'aucun seuil, aucun score combiné, aucun classifieur, aucune règle, aucun gagnant',
  };
}

/**
 * Fusion « combined-day » — DÉDUPLIQUÉE, jamais fusionnée.
 *
 * Deux corpus du même jour peuvent se recouvrir. La clé d'unicité est
 * (session, visite, côté) : une ligne vue dans les deux corpus est comptée UNE
 * fois, en gardant la version du corpus historique, et le recouvrement est
 * rapporté. Aucune valeur n'est moyennée, aucune session n'est recousue.
 */
function combine(corpora) {
  const seen = new Map(), rows = [], overlap = [];
  for (const c of corpora) for (const r of c.rows) {
    const k = `${r.decisionFeatures.sessionId}|${r.decisionFeatures.visitId}|${r.decisionFeatures.side}`;
    if (seen.has(k)) { overlap.push({ key: k, keptFrom: seen.get(k), alsoIn: c.name }); continue; }
    seen.set(k, c.name); rows.push(r);
  }
  const sessions = {};
  for (const c of corpora) for (const sid of new Set(c.rows.map(r => r.decisionFeatures.sessionId)))
    (sessions[sid] ??= []).push(c.name);
  const boundaries = new Map();
  for (const c of corpora) for (const [sid, b] of c.boundaries) if (!boundaries.has(sid)) boundaries.set(sid, b);
  return { rows, overlap,
           sharedSessions: Object.entries(sessions).filter(([, v]) => v.length > 1)
             .map(([sid, v]) => ({ sessionId: sid, corpora: v })),
           sessionsByCorpus: sessions, boundaries };
}

function main() {
  const args = process.argv.slice(2);
  const out = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  const dirs = [];
  for (let i = 0; i < args.length; i++)
    if (args[i] === '--corpus') dirs.push({ name: args[i + 1], dir: args[i + 2] });
  if (!dirs.length) {
    console.error('usage : node tools/flank-support-shadow.cjs --corpus <nom> <dossier> [--corpus …] [--output f.json]');
    process.exit(2);
  }
  const frozen = N.assertFrozenEngine();
  const built = dirs.map(d => buildCorpus(d.dir, d.name));
  const combined = combine(built);
  const body = {
    format: 'banane-flank-support-shadow-v1.3',
    nature: 'instrumentation hors ligne, lecture seule — aucune politique, aucun seuil, aucune règle',
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
    reliableObservationCriterion: {
      source: 'src/native-session.js — referenceReasons, repris verbatim',
      conditions: ['intention opérateur unique valant VALIDATE', 'état de référence présent',
                   'identité concordante', 'fraîcheur d’association dans [0, 1500] ms',
                   'effet de décision observé', 'état de rail présent du côté considéré'],
      freshnessRuntimeTest: 'freshnessMs === null || freshnessMs < 0 || freshnessMs > 1500',
      undefinedIsNotInTheRuntimeTest: true,
      benchGuardsPublishedSeparately: ['freshness-undefined-not-seen-by-runtime'],
      invented: false,
    },
    oppositeStates: OPPOSITE_STATES,
    corpora: built.map(c => ({
      name: c.name, directory: path.resolve(c.dir),
      files: c.corpus.files.length, nativeExports: c.corpus.exports.length,
      ignoredSidecars: c.corpus.ignored,
      sessions: [...c.corpus.latestPerSession.keys()],
      visitsRead: c.visits.length, chunksNeeded: c.chunksNeeded, chunksRead: c.chunksRead,
      degradation: [...c.boundaries.values()],
      summary: summarise(c.rows, c.boundaries),
    })),
    combinedDay: {
      deduplicationKey: 'sessionId|visitId|side',
      merged: false, mergeNote: 'aucune session n’est recousue, aucune valeur n’est moyennée',
      overlapRows: combined.overlap.length,
      sharedSessions: combined.sharedSessions,
      sessionsByCorpus: combined.sessionsByCorpus,
      summary: summarise(combined.rows, combined.boundaries),
    },
    rows: built.flatMap(c => c.rows),
  };
  const hashed = { format: body.format, studiedAbstention: body.studiedAbstention, engine: body.engine,
                   snapshotPolicy: body.snapshotPolicy, corpora: body.corpora,
                   combinedDay: body.combinedDay, rows: body.rows };
  body.sha256 = crypto.createHash('sha256').update(JSON.stringify(hashed)).digest('hex');
  body.sha256Covers = ['format', 'studiedAbstention', 'engine', 'snapshotPolicy', 'corpora', 'combinedDay', 'rows'];
  body.generatedAt = new Date().toISOString();
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(body, null, 1)); }
  for (const c of body.corpora) {
    console.log(`\n=== ${c.name} — ${c.visitsRead} visites, ${c.nativeExports} exports, `
      + `${c.ignoredSidecars.length} fichiers ignorés`);
    console.log(JSON.stringify(c.summary, null, 1));
  }
  console.log('\n=== combined-day'); console.log(JSON.stringify(body.combinedDay, null, 1));
  console.log('\nsha256 :', body.sha256);
  if (out) console.log('écrit :', out);
}

module.exports = { FLANK_REASON, TOLERANCE_ORACLE, DEGRADED_SESSIONS, OPPOSITE_STATES,
                   exactSnapshot, replayRailExact, population, decisionFeatures, causalHistory,
                   oppositeRailContext, postHocEvaluation, reliableObservation, classifyExport, exportLoss,
                   degradationBoundaries, applyDegradation, applyCausalAdmissibility, readCorpus, readVisitsOf, buildCorpus,
                   combine, postHocCounters, summarise, norm, mag };
if (require.main === module) main();
