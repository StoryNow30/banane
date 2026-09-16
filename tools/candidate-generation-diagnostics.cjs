#!/usr/bin/env node
'use strict';
/* Candidate Generation Diagnostics V1 — voir CANDIDATE_GENERATION_DIAGNOSTICS_V1.md */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const DEGRADED_SESSION = '0c58c033-f2e7-4aa5-ad8c-80b081a83932';
const TOLERANCE_ORACLE = 0.010;
const SHADOW_SHA_DECLARED = '0e15a913a2fe4c3b3ca724abfe51872fe57b4c0db2f97e43efc418c166c0bee4';
const GENERATION_GATES = Object.freeze([
  { engineReason: 'Aucun point LiDAR disponible.', stage: 'lidar-points-absent' },
  { engineReason: 'Contour du profil absent.', stage: 'profile-contour-absent' },
  { engineReason: 'Sens du profil ambigu.', stage: 'profile-sign-ambiguous' },
  { engineReason: 'Contour de champignon non reconnu.', stage: 'mushroom-contour-unrecognized' },
  { engineReason: 'Trop peu de points autour du champignon.', stage: 'insufficient-points-around-mushroom' },
  { engineReason: 'Dimensions du profil hors du domaine testé.', stage: 'profile-dimensions-out-of-tested-domain' },
  { engineReason: 'Surfaces du profil non identifiées.', stage: 'profile-surfaces-unidentified' },
  { engineReason: 'Plan de roulement non estimable.', stage: 'running-surface-not-estimable' },
  { engineReason: 'Intersection hors de la fenêtre expérimentale.', stage: 'intersection-outside-experimental-window' },
]);
const HUMAN_FREE_BLOCKS = Object.freeze([
  'inputContext', 'generationTrace', 'candidateFamilies',
  'oppositeRailContext', 'degradationContext',
]);
const HUMAN_BLOCK = 'postHocEvaluation';
const norm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mag = v => Math.hypot(v[0], v[1], v[2]);
function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function sha256Obj(o) { return crypto.createHash('sha256').update(stable(o)).digest('hex'); }
function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
function loadShadow(p) {
  const A = JSON.parse(fs.readFileSync(p));
  if (A.format !== 'banane-flank-support-shadow-v1.1') throw Error('artefact shadow inattendu : ' + A.format);
  return A;
}
function gateIndex(reason) { return GENERATION_GATES.findIndex(g => g.engineReason === reason); }
function generationTrace(row) {
  const d = row.decisionFeatures;
  const reasons = d.abstentionReasons || [];
  const reason = reasons.length === 1 ? reasons[0] : (reasons.length ? reasons.join(' ') : null);
  const gi = reason ? gateIndex(reason) : -1;
  const steps = GENERATION_GATES.map((g, i) => {
    if (gi < 0) return { stage: g.stage, engineReason: g.engineReason, outcome: 'not-applicable' };
    if (i < gi) return { stage: g.stage, engineReason: g.engineReason, outcome: 'passed' };
    if (i === gi) return { stage: g.stage, engineReason: g.engineReason, outcome: 'stopped' };
    return { stage: g.stage, engineReason: g.engineReason, outcome: 'not-reached' };
  });
  const metricsPublished = d.pointsUsed !== null || d.topCount !== null || d.candidates.seed !== null;
  return {
    population: row.population, engineStatus: d.status, engineReasons: reasons, metricsPublished,
    internalsDiscardedBeforeMetrics: row.population === 'no-candidate' && gi >= 0,
    stopStage: gi >= 0 ? GENERATION_GATES[gi].stage : (metricsPublished ? 'metrics-published-generation-completed' : 'unobserved-or-compound-reason'),
    stopEngineReason: gi >= 0 ? GENERATION_GATES[gi].engineReason : reason, steps,
    pointsSupplied: d.pointsSupplied ?? null, pointsUsed: d.pointsUsed ?? null,
    topCount: d.topCount ?? null, faceCount: d.faceCount ?? null,
    topSpanBins: d.topSpanBins ?? null, faceSpanBins: d.faceSpanBins ?? null,
    residual: d.residual ?? null, templateLoss: d.templateLoss ?? null,
    coarseBestLoss: d.coarseBestLoss ?? null, alternativeLoss: d.alternativeLoss ?? null,
    lossRatio: d.lossRatio ?? null, separation: d.separation ?? null,
    seedComputedAndReturned: d.candidates.seed !== null,
    surfaceIntersectionComputedAndReturned: d.candidates.surfaceIntersection !== null,
    alternativeComputedAndReturned: d.candidates.alternative !== null,
  };
}
function inputContext(row) {
  const d = row.decisionFeatures;
  return {
    corpus: row.corpus, sessionId: d.sessionId, pageId: d.target.pageId, frameId: d.target.frameId,
    part: d.target.part, cut: d.target.cut, side: d.side, visitIndex: d.visitIndex, visitId: d.visitId,
    shape: d.target.shape, snapshotId: d.snapshotId ?? null, snapshotsAvailable: d.snapshotsAvailable ?? null,
    chunkIds: null,
    chunkIdsNote: 'non stockés dans la ligne shadow V1.1 ; le rejeu a exigé les chunkIds nommés par l’éligibilité, fail-closed si absents',
    pointsSupplied: d.pointsSupplied ?? null, eligibilityStatus: row.eligibility?.status ?? null,
    failClosed: row.eligibility?.failClosed ?? null,
    captureVisitStatus: d.captureContext?.visitStatus ?? null,
    captureLidarStatus: d.captureContext?.lidarStatus ?? null,
  };
}
function candidateFamilies(row) {
  const d = row.decisionFeatures, c = d.candidates;
  const present = ['seed', 'surfaceIntersection', 'alternative'].filter(n => c[n] !== null);
  return {
    seed: c.seed, surfaceIntersection: c.surfaceIntersection, alternative: c.alternative, present,
    absent: ['seed', 'surfaceIntersection', 'alternative'].filter(n => c[n] === null),
    seedToSurface: d.seedToSurface, seedToAlternative: d.seedToAlternative, surfaceToAlternative: d.surfaceToAlternative,
    seedMagnitudeFromInitialPose: d.seedMagnitudeFromInitialPose,
    surfaceMagnitudeFromInitialPose: d.surfaceMagnitudeFromInitialPose,
    alternativeMagnitudeFromInitialPose: d.alternativeMagnitudeFromInitialPose,
    surfaceCoincidesWithSeed: d.seedToSurface === 0, noWinner: true,
    noWinnerNote: 'aucune préférence entre seed, surfaceIntersection et alternative',
  };
}
function degradationContext(row) {
  const g = row.degradation;
  return {
    degradedSession: g.degradedSession === true, sessionIdWatched: DEGRADED_SESSION, slice: g.slice,
    excludedFromCausalAnalysis: g.excludedFromCausalAnalysis === true,
    lastLosslessVisitIndex: g.lastLosslessVisitIndex ?? null,
    afterLastLosslessIsDescriptiveOnly: g.slice === 'after-last-lossless-snapshot',
    note: g.slice === 'after-last-lossless-snapshot'
      ? 'tranche after-last-lossless-snapshot conservée descriptivement, jamais comme preuve causale propre' : null,
  };
}
function familyConfiguration(fam, postHoc) {
  const dist = { seedToSurface: fam.seedToSurface, seedToAlternative: fam.seedToAlternative, surfaceToAlternative: fam.surfaceToAlternative };
  const known = [dist.seedToSurface, dist.seedToAlternative, dist.surfaceToAlternative].filter(x => typeof x === 'number');
  const configs = [];
  if (fam.present.length < 3) configs.push('une-ou-plusieurs-familles-absentes');
  if (fam.present.length === 3 && known.length === 3 && known.every(x => x > TOLERANCE_ORACLE))
    configs.push('trois-familles-presentes-toutes-eloignees-de-la-convention');
  if (fam.present.length >= 2 && known.length && known.every(x => x <= TOLERANCE_ORACLE))
    configs.push('candidats-tres-proches-entre-eux-tous-hors-convention');
  if (typeof dist.seedToSurface === 'number' && typeof dist.seedToAlternative === 'number'
      && dist.seedToSurface <= TOLERANCE_ORACLE && dist.seedToAlternative > TOLERANCE_ORACLE)
    configs.push('seed-et-surface-proches-alternative-eloignee');
  if (typeof dist.seedToAlternative === 'number' && typeof dist.seedToSurface === 'number'
      && dist.seedToAlternative <= TOLERANCE_ORACLE && dist.seedToSurface > TOLERANCE_ORACLE)
    configs.push('seed-et-alternative-proches-surface-eloignee');
  if (fam.surfaceCoincidesWithSeed) configs.push('surface-coincidente-au-seed');
  if (!configs.length) configs.push('autre-configuration-observee');
  return { configs, distances: dist, conventionUsed: TOLERANCE_ORACLE, conventionIsEvaluationOnly: true,
    shadowVerdict: postHoc?.verdict ?? null, shadowBestFamily: postHoc?.best?.family ?? null,
    shadowBestDelta: postHoc?.best?.error ?? null, familyDeltas: postHoc?.errors ?? null };
}
function diagnoseRow(row) {
  const fam = candidateFamilies(row);
  const post = {
    humanStatus: row.postHocEvaluation.humanStatus, reliableObservation: row.postHocEvaluation.reliableObservation,
    tolerance: row.postHocEvaluation.tolerance, toleranceIsEvaluationOnly: row.postHocEvaluation.toleranceIsEvaluationOnly,
    qualified: row.postHocEvaluation.qualified, humanDeltaLocal: row.postHocEvaluation.humanDeltaLocal,
    familyDeltas: row.postHocEvaluation.errors, best: row.postHocEvaluation.best,
    shadowVerdict: row.postHocEvaluation.verdict, familyConfiguration: null,
  };
  if (row.population === 'flank-only') post.familyConfiguration = familyConfiguration(fam, row.postHocEvaluation);
  return { corpus: row.corpus, population: row.population, inputContext: inputContext(row),
    generationTrace: generationTrace(row), candidateFamilies: fam,
    oppositeRailContext: row.oppositeRailContext, degradationContext: degradationContext(row),
    postHocEvaluation: post };
}
function countBy(rows, fn) { const o = {}; for (const r of rows) { const k = String(fn(r)); o[k] = (o[k] || 0) + 1; } return o; }
function numericSummary(values) {
  const xs = values.filter(v => typeof v === 'number' && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!xs.length) return { n: 0, min: null, p25: null, median: null, p75: null, max: null };
  const at = q => xs[Math.min(xs.length - 1, Math.floor(q * (xs.length - 1)))];
  return { n: xs.length, min: xs[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: xs[xs.length - 1] };
}
function cutRanges(rows) {
  const by = {};
  for (const r of rows) { const k = r.inputContext.sessionId + '|part=' + r.inputContext.part; (by[k] ||= []).push(r.inputContext.cut); }
  return Object.fromEntries(Object.entries(by).map(([k, cuts]) => { cuts.sort((a, b) => a - b); return [k, { n: cuts.length, min: cuts[0], max: cuts[cuts.length - 1], cuts }]; }));
}
function summariseNoCandidate(rows, allRows) {
  const nc = rows.filter(r => r.population === 'no-candidate');
  const byCorpus = {};
  for (const name of ['historical-original', 'final-complementary']) {
    const mine = nc.filter(r => r.corpus === name);
    byCorpus[name] = {
      n: mine.length, byStage: countBy(mine, r => r.generationTrace.stopStage),
      byEngineReason: countBy(mine, r => r.generationTrace.stopEngineReason),
      bySession: countBy(mine, r => r.inputContext.sessionId), bySide: countBy(mine, r => r.inputContext.side),
      byPart: countBy(mine, r => r.inputContext.part), byLidarStatus: countBy(mine, r => r.inputContext.captureLidarStatus),
      byVisitStatus: countBy(mine, r => r.inputContext.captureVisitStatus),
      byDegradationSlice: countBy(mine, r => r.degradationContext.slice),
      degradedSessionCount: mine.filter(r => r.inputContext.sessionId === DEGRADED_SESSION).length,
      afterLastLosslessCount: mine.filter(r => r.degradationContext.slice === 'after-last-lossless-snapshot').length,
      oppositeState: countBy(mine, r => r.oppositeRailContext.state),
      pointsSupplied: numericSummary(mine.map(r => r.inputContext.pointsSupplied)),
      pointsUsed: numericSummary(mine.map(r => r.generationTrace.pointsUsed)),
      topCount: numericSummary(mine.map(r => r.generationTrace.topCount)),
      faceCount: numericSummary(mine.map(r => r.generationTrace.faceCount)),
      cutRanges: cutRanges(mine),
    };
  }
  const sessionsTouched = Object.keys(byCorpus['final-complementary'].bySession);
  const finalSessionsTotal = new Set(allRows.filter(r => r.corpus === 'final-complementary').map(r => r.decisionFeatures.sessionId)).size;
  return { historical: byCorpus['historical-original'], final: byCorpus['final-complementary'],
    rise: { historical: byCorpus['historical-original'].n, final: byCorpus['final-complementary'].n,
      sessionsTouchedInFinal: sessionsTouched.length, sessionsInFinalCorpus: finalSessionsTotal,
      concentratedInTwoSessions: sessionsTouched.length <= 2, concentratedInThreeSessions: sessionsTouched.length <= 3,
      dominantSide: byCorpus['final-complementary'].bySide,
      degradedSessionShare: byCorpus['final-complementary'].degradedSessionCount,
      afterLastLosslessShare: byCorpus['final-complementary'].afterLastLosslessCount,
      note: 'constat de répartition, pas une cause physique démontrée' },
    observedStagesOnly: GENERATION_GATES.map(g => g.stage) };
}
function summariseFlankUnsatisfying(diagnosed, shadowRows) {
  const bad = diagnosed.filter(r => r.population === 'flank-only');
  const byCorpus = {};
  for (const name of ['historical-original', 'final-complementary']) {
    const mine = bad.filter(r => r.corpus === name);
    byCorpus[name] = {
      n: mine.length,
      configurations: countBy(mine, r => (r.postHocEvaluation.familyConfiguration?.configs || []).join('+')),
      presentFamilies: countBy(mine, r => r.candidateFamilies.present.join(',')),
      surfaceCoincidesWithSeed: mine.filter(r => r.candidateFamilies.surfaceCoincidesWithSeed).length,
      faceCount: numericSummary(mine.map(r => r.generationTrace.faceCount)),
      topCount: numericSummary(mine.map(r => r.generationTrace.topCount)),
      pointsSupplied: numericSummary(mine.map(r => r.inputContext.pointsSupplied)),
      bySide: countBy(mine, r => r.inputContext.side), bySession: countBy(mine, r => r.inputContext.sessionId),
    };
  }
  return { total: bad.length, historical: byCorpus['historical-original'], final: byCorpus['final-complementary'],
    generationCompleted: bad.filter(r => r.generationTrace.metricsPublished).length,
    generationStopped: bad.filter(r => !r.generationTrace.metricsPublished).length,
    threeFamiliesPresent: bad.filter(r => r.candidateFamilies.present.length === 3).length,
    note: 'les 45 ont une génération achevée (metrics publiées). L’échec est post-hoc sur la convention de banc, pas un no-candidate.',
    shadowFlankOnlyTotals: {
      historical: shadowRows.filter(r => r.corpus === 'historical-original' && r.population === 'flank-only').length,
      final: shadowRows.filter(r => r.corpus === 'final-complementary' && r.population === 'flank-only').length } };
}
function compareDistributions(shadowRows) {
  const groups = {
    'no-candidate': r => r.population === 'no-candidate',
    'engine-candidate': r => r.population === 'engine-candidate',
    'flank-only-seed-satisfaisant': r => r.population === 'flank-only' && r.postHocEvaluation.verdict === 'seed-satisfaisant',
    'flank-only-aucun-satisfaisant': r => r.population === 'flank-only' && r.postHocEvaluation.verdict === 'aucun-candidat-expose-satisfaisant',
  };
  const out = {};
  for (const [name, pred] of Object.entries(groups)) {
    const mine = shadowRows.filter(pred);
    out[name] = { n: mine.length, byCorpus: countBy(mine, r => r.corpus),
      bySide: countBy(mine, r => r.decisionFeatures.side), byPart: countBy(mine, r => r.decisionFeatures.target.part),
      pointsSupplied: numericSummary(mine.map(r => r.decisionFeatures.pointsSupplied)),
      pointsUsed: numericSummary(mine.map(r => r.decisionFeatures.pointsUsed)),
      topCount: numericSummary(mine.map(r => r.decisionFeatures.topCount)),
      faceCount: numericSummary(mine.map(r => r.decisionFeatures.faceCount)),
      lidarStatus: countBy(mine, r => r.decisionFeatures.captureContext?.lidarStatus) };
  }
  return { groups: out, classifier: null, combinedScore: null, chosenThreshold: null,
    note: 'distributions descriptives seulement — aucun classifieur, aucune optimisation, aucun seuil retenu' };
}
function observedGeometryProblems(summaryNc, summaryFlank) {
  return [
    { id: 'running-surface-not-estimable-after-roi', observedOn: 'no-candidate',
      engineReason: 'Plan de roulement non estimable.',
      counts: { historical: summaryNc.historical.byEngineReason['Plan de roulement non estimable.'] || 0,
        final: summaryNc.final.byEngineReason['Plan de roulement non estimable.'] || 0 },
      meaning: 'propose() a passé les portes 1–7, lancé la recherche de gabarit, puis robustLine(topRows) a renvoyé null. metrics n’est pas publié.' },
    { id: 'intersection-outside-experimental-window', observedOn: 'no-candidate',
      engineReason: 'Intersection hors de la fenêtre expérimentale.',
      counts: { historical: summaryNc.historical.byEngineReason['Intersection hors de la fenêtre expérimentale.'] || 0, final: 0 },
      meaning: 'Un seul cas historique (part 8 / cut 9656 / left).' },
    { id: 'surface-family-collapses-to-seed-when-face-missing', observedOn: 'flank-only-aucun-satisfaisant',
      counts: { surfaceCoincidesWithSeed: summaryFlank.historical.surfaceCoincidesWithSeed + summaryFlank.final.surfaceCoincidesWithSeed },
      meaning: 'quand faceCount = 0, geometry.js laisse surfaceU/Z = best.u/z.' },
    { id: 'right-rail-part-1-cut-cluster-5083-5276', observedOn: 'no-candidate-final',
      meaning: '52 des 62 no-candidate finaux sont le rail droit de la part 1, deux sessions, cuts adjacents 5083–5276. Constat, pas une cause physique démontrée.' },
  ];
}
function build(shadow) {
  const shadowRows = shadow.rows;
  const nc = shadowRows.filter(r => r.population === 'no-candidate');
  const badFlank = shadowRows.filter(r => r.population === 'flank-only' && r.postHocEvaluation.verdict === 'aucun-candidat-expose-satisfaisant');
  const diagnosed = [...nc, ...badFlank].map(diagnoseRow);
  const noCandidateSummary = summariseNoCandidate(diagnosed, shadowRows);
  const flankUnsatisfying = summariseFlankUnsatisfying(diagnosed.filter(r => r.population === 'flank-only'), shadowRows);
  const comparison = compareDistributions(shadowRows);
  const answers = {
    q1_whyNoCandidate: { statement: 'Les 64 no-candidate sont des unresolved() sans metrics. 63 à « Plan de roulement non estimable. » ; 1 historique à « Intersection hors de la fenêtre expérimentale. ».',
      byStage: { historical: noCandidateSummary.historical.byStage, final: noCandidateSummary.final.byStage } },
    q2_countsPerStage: { historical: noCandidateSummary.historical.byEngineReason, final: noCandidateSummary.final.byEngineReason },
    q3_riseConcentratedOrGeneral: { historical: 2, final: 62, finalSessionsTouched: Object.keys(noCandidateSummary.final.bySession).length,
      finalSessionsInCorpus: 8, bySession: noCandidateSummary.final.bySession,
      reading: 'concentrée : 3 sessions sur 8 portent les 62 cas (35 + 17 + 10).' },
    q4_degradedSessionShare: { sessionId: DEGRADED_SESSION, noCandidateInDegradedSession: noCandidateSummary.final.degradedSessionCount,
      ofFinal: 62, afterLastLossless: noCandidateSummary.final.afterLastLosslessCount,
      sliceOfDegradedSessionRows: 'before-last-lossless-snapshot (10/10)',
      finalByDegradationSlice: noCandidateSummary.final.byDegradationSlice,
      reading: '10 / 62 dans la session dégradée, tous before-last-lossless. 0 after-last-lossless.' },
    q5_sideOrSessionAsymmetry: { finalBySide: noCandidateSummary.final.bySide, historicalBySide: noCandidateSummary.historical.bySide,
      finalByPart: noCandidateSummary.final.byPart, engineCandidateFinalBySide: comparison.groups['engine-candidate'].bySide,
      reading: 'asymétrie droite 57/5 sur le final.' },
    q6_flankUnsatisfyingGenerationVsAbstention: { n: 45, generationCompleted: flankUnsatisfying.generationCompleted,
      generationStopped: flankUnsatisfying.generationStopped, threeFamiliesPresent: flankUnsatisfying.threeFamiliesPresent,
      reading: '0 / 45 n’a arrêté la génération. 36 / 45 surface coïncidente au seed.' },
    q7_observedGeometrySubproblems: observedGeometryProblems(noCandidateSummary, flankUnsatisfying),
  };
  return { format: 'banane-candidate-generation-diagnostics-v1', nature: 'offline-read-only-diagnostics',
    baseCommit: '2be69e41cee6501fe5084f46236c42423bd33715', shadowFormat: shadow.format,
    shadowSha256Declared: SHADOW_SHA_DECLARED, units: shadow.units,
    evaluationConvention: { tolerance: TOLERANCE_ORACLE, usedFor: 'comptage et description post-hoc uniquement',
      neverA: ['seuil runtime', 'calibration physique', 'meilleur seuil'] },
    engine: shadow.engine, snapshotPolicy: shadow.snapshotPolicy,
    blocks: { humanFreeBlocks: HUMAN_FREE_BLOCKS, humanBlock: HUMAN_BLOCK },
    corpora: shadow.corpora.map(c => ({ name: c.name, visitsRead: c.visitsRead, sessions: c.sessions,
      ignoredSidecars: c.ignoredSidecars, nativeExports: c.nativeExports, files: c.files, population: c.summary.population })),
    degradedSession: DEGRADED_SESSION, answers, noCandidateSummary, flankUnsatisfying, comparison, rows: diagnosed };
}
function main() {
  const args = process.argv.slice(2);
  let shadowPath = path.join(ROOT, 'audit/flank-support-shadow-v1.json');
  let outPath = path.join(ROOT, 'audit/candidate-generation-diagnostics-v1.json');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--shadow') shadowPath = path.resolve(args[++i]);
    else if (args[i] === '--output') outPath = path.resolve(args[++i]);
  }
  const shadow = loadShadow(shadowPath);
  const body = { ...build(shadow) };
  body.generatedAt = new Date().toISOString();
  body.sha256Covers = 'contenu hors generatedAt et sha256';
  body.sha256 = sha256Obj({ ...body, generatedAt: null, sha256: null });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(body));
  process.stdout.write(JSON.stringify({ output: outPath, rows: body.rows.length, sha256: body.sha256 }) + '\n');
}
module.exports = {
  GENERATION_GATES, HUMAN_FREE_BLOCKS, HUMAN_BLOCK, TOLERANCE_ORACLE, DEGRADED_SESSION, SHADOW_SHA_DECLARED,
  generationTrace, inputContext, candidateFamilies, degradationContext, familyConfiguration, diagnoseRow,
  build, loadShadow, gateIndex, sha256Obj, sha256File, norm, mag,
};
if (require.main === module) main();
