#!/usr/bin/env node
'use strict';
/* Running Surface Failure Replication V1 — hors ligne, lecture seule.
 * Traceur INDÉPENDANT. notPropose: ce n'est pas G.propose.
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const G = require('../src/geometry.js');
const CORE = require('./_rsf-core.cjs');
const {
  LITERALS, HUMAN_FREE_BLOCKS, HUMAN_BLOCK, REASON_RUNNING, SESSION_17, DEGRADED_SESSION,
  independentTrace, validateAgainstPropose, runIncidentsLab, loadCgdFailures, loadShadowPool,
  selectWitnesses, frozenHashes, classifyTraced, indexNativeCaptures, sha256Obj, quantile
} = CORE;
function build() {
  const hashes = frozenHashes();
  const fails = loadCgdFailures();
  const pool = loadShadowPool();
  const witnesses = selectWitnesses(fails, pool);
  const lab = runIncidentsLab();
  const nativeIdx = indexNativeCaptures();
  const shadowByKey = new Map(pool.map(p => [`${p.sessionId}|${p.visitId}|${p.side}`, p]));
  const witnessByFail = new Map(witnesses.pairs.map(p => [p.failureKey, p]));
  const rows = [];
  for (const f of fails) {
    const key = `${f.sessionId}|${f.visitId}|${f.side}`;
    const sh = shadowByKey.get(key);
    const w = witnessByFail.get(key);
    const native = nativeIdx.get(`${f.sessionId}|${f.visitId}`);
    let traced = null;
    let validation = { status: 'capture-absent-from-clone', ok: null, divergences: [] };
    if (native?.capture?.rails?.[f.side]) {
      traced = independentTrace(native.capture, f.side);
      validation = validateAgainstPropose(native.capture, f.side);
      validation.status = validation.ok ? 'matched-engine' : 'tracer-divergence';
    }
    const cls = classifyTraced(traced);
    rows.push({
      identity: {
        corpus: f.corpus, sessionId: f.sessionId, visitId: f.visitId, visitIndex: f.visitIndex,
        side: f.side, part: f.part, cut: f.cut, pageId: f.pageId, frameId: f.frameId, key,
      },
      engineObserved: {
        reason: f.exitReason, stage: f.exitStage, engineExposedMetrics: f.engineExposedMetrics,
        pointsSupplied: f.pointsSupplied, pointsInEngineUsefulRoi: f.pointsInEngineUsefulRoi,
        lidarStatus: f.lidarStatus, visitStatus: f.visitStatus, chunks: f.chunks,
        maxContourVertices: f.maxContourVertices, shadowPopulation: sh?.population ?? null,
        shadowPointsUsed: sh?.pointsUsed ?? null, shadowTemplateLoss: sh?.templateLoss ?? null,
      },
      traceValidation: validation,
      coarseSearch: traced ? {
        best: traced.coarseBest, topRows: traced.topRowsCoarse, topFit: traced.topFitCoarse,
        cells: traced.coarseCells, alreadyUnsupported: traced.topRowsCoarse < LITERALS.robustLineMinRows,
      } : { best: null, topRows: null, topFit: null, cells: null, alreadyUnsupported: null, reason: 'capture-absent-from-clone' },
      refinedSearch: traced ? {
        best: traced.refinedBest, topRows: traced.topRowsRefined, topFit: traced.topFitRefined,
        displacement: traced.coarseToRefined, cells: traced.refinedCells,
        unsupported: traced.topRowsRefined < LITERALS.robustLineMinRows,
      } : { best: null, topRows: null, topFit: null, displacement: null, cells: null, unsupported: null, reason: 'capture-absent-from-clone' },
      topSupport: traced ? {
        coarse: traced.topRowsCoarse, refined: traced.topRowsRefined, faceRowsRefined: traced.faceRowsRefined,
        topAnchors: traced.topAnchors?.count ?? null, faceAnchors: traced.faceAnchors?.count ?? null,
        localPoints: traced.pointsRetained, sign: traced.sign, width: traced.width, seed: traced.seed,
      } : { coarse: null, refined: null, faceRowsRefined: null, topAnchors: null, faceAnchors: null, localPoints: null, sign: null, width: null, seed: null },
      localLandscape: traced ? {
        fieldsSeparated: true, neighborhoodSupported: traced.neighborhood?.supportedInNeighborhood ?? null,
        neighborhoodCells: traced.neighborhood?.cells ?? null, templateLossBest: traced.templateLossRefined,
        topSupportBest: traced.topRowsRefined, note: 'templateLoss et topSupportCount restent deux champs distincts',
      } : { fieldsSeparated: true, neighborhoodSupported: null, neighborhoodCells: null, templateLossBest: null, topSupportBest: null, reason: 'capture-absent-from-clone' },
      nearestSupportValidPlacement: traced ? traced.nearestSupportValid : { exists: null, reason: 'capture-absent-from-clone' },
      sessionSideContext: {
        sessionId: f.sessionId, side: f.side, isSession17: f.sessionId === SESSION_17,
        isDegradedSession: f.sessionId === DEGRADED_SESSION, witnessTier: w?.tier ?? null,
        witnessKey: w?.witnessKey ?? null, witnessCut: w?.witnessCut ?? null,
        witnessTopCount: w?.witnessTopCount ?? null, witnessTemplateLoss: w?.witnessTemplateLoss ?? null,
        observedFamily: cls.family,
      },
      degradationContext: {
        slice: sh?.slice ?? null, degradedSession: sh?.degradedSession ?? null,
        excludedFromCausalAnalysis: sh?.excludedFromCausalAnalysis ?? null, lidarStatus: f.lidarStatus,
      },
      postHocEvaluation: {
        observationalOnly: true, humanUsedForSearch: false, humanUsedForWitness: false,
        humanUsedForNeighbor: false, humanUsedForFamily: false,
        note: 'aucune référence humaine n’entre dans ce lot',
      },
    });
  }
  const incidentRows = [];
  for (const v of lab.validations) {
    const tr = lab.traces.find(t => t.cut === v.cut && t.side === v.side);
    incidentRows.push({
      identity: { source: 'incidents-versioned', cut: v.cut, part: v.part, side: v.side, visitId: v.visitId },
      engineObserved: { status: v.engineStatus, reasons: v.engineReasons },
      traceValidation: { status: v.ok ? 'matched-engine' : 'tracer-divergence', ok: v.ok, divergences: v.divergences },
      coarseSearch: tr ? { best: tr.coarseBest, topRows: tr.topRowsCoarse, alreadyUnsupported: tr.topRowsCoarse < LITERALS.robustLineMinRows } : null,
      refinedSearch: tr ? { best: tr.refinedBest, topRows: tr.topRowsRefined, displacement: tr.coarseToRefined, unsupported: tr.topRowsRefined < LITERALS.robustLineMinRows } : null,
      topSupport: tr ? { coarse: tr.topRowsCoarse, refined: tr.topRowsRefined, faceRowsRefined: tr.faceRowsRefined, sign: tr.sign, seed: tr.seed } : null,
      localLandscape: tr ? { neighborhoodSupported: tr.neighborhood?.supportedInNeighborhood ?? null, neighborhoodCells: tr.neighborhood?.cells ?? null, fieldsSeparated: true } : null,
      nearestSupportValidPlacement: tr ? tr.nearestSupportValid : null,
      sessionSideContext: { source: 'incidents-versioned', side: v.side },
      degradationContext: { slice: null },
      postHocEvaluation: { observationalOnly: true, humanUsedForSearch: false, note: 'laboratoire incidents ; pas une référence des 63' },
    });
  }
  const tracedField = rows.filter(r => r.traceValidation.status === 'matched-engine' || r.traceValidation.status === 'tracer-divergence');
  const q1 = tracedField.filter(r => r.coarseSearch.alreadyUnsupported === true).length;
  const q2 = tracedField.filter(r => r.coarseSearch.alreadyUnsupported === false && r.refinedSearch.unsupported === true).length;
  const q3 = tracedField.filter(r => r.nearestSupportValidPlacement?.exists === true).length;
  const q4 = tracedField.filter(r => r.nearestSupportValidPlacement?.exists === false).length;
  const dLosses = tracedField.filter(r => r.nearestSupportValidPlacement?.exists === true && Number.isFinite(r.nearestSupportValidPlacement.dLoss)).map(r => r.nearestSupportValidPlacement.dLoss).sort((a, b) => a - b);
  const labDloss = lab.traces.filter(t => t.nearestSupportValid?.exists && Number.isFinite(t.nearestSupportValid.dLoss)).map(t => t.nearestSupportValid.dLoss).sort((a, b) => a - b);
  const families = {};
  for (const r of rows) families[r.sessionSideContext.observedFamily] = (families[r.sessionSideContext.observedFamily] || 0) + 1;
  const bySession = {}, bySide = {}, byCorpus = {}, byPart = {}, bySlice = {};
  for (const r of rows) {
    bySession[r.identity.sessionId] = (bySession[r.identity.sessionId] || 0) + 1;
    bySide[r.identity.side] = (bySide[r.identity.side] || 0) + 1;
    byCorpus[r.identity.corpus] = (byCorpus[r.identity.corpus] || 0) + 1;
    byPart[String(r.identity.part)] = (byPart[String(r.identity.part)] || 0) + 1;
    const sl = r.degradationContext.slice || 'unknown';
    bySlice[sl] = (bySlice[sl] || 0) + 1;
  }
  const session17Pool = pool.filter(p => p.sessionId === SESSION_17);
  const session17Pops = {};
  for (const p of session17Pool) session17Pops[p.population] = (session17Pops[p.population] || 0) + 1;
  const labSigns = {};
  for (const t of lab.traces) {
    const k = `${t.side}:${t.sign}`;
    labSigns[k] = (labSigns[k] || 0) + 1;
  }
  const answers = {
    q1_coarseAlreadyUnsupported: { field63Traced: tracedField.length, count: tracedField.length ? q1 : null, note: tracedField.length ? null : 'les 63 rails terrain n’ont pas de capture dans le clone ; le laboratoire incidents est séparé', incidentsLab: lab.traces.filter(t => t.topRowsCoarse < LITERALS.robustLineMinRows).length },
    q2_lostOnlyAfterRefinement: { field63Traced: tracedField.length, count: tracedField.length ? q2 : null, incidentsLab: lab.traces.filter(t => t.topRowsCoarse >= LITERALS.robustLineMinRows && t.topRowsRefined < LITERALS.robustLineMinRows).length },
    q3_nearestExists: { field63Traced: tracedField.length, count: tracedField.length ? q3 : null, incidentsLab: lab.traces.filter(t => t.nearestSupportValid?.exists).length },
    q4_nearestAbsent: { field63Traced: tracedField.length, count: tracedField.length ? q4 : null, incidentsLab: lab.traces.filter(t => t.nearestSupportValid && !t.nearestSupportValid.exists).length },
    q5_dLossDistribution: { field63: { n: dLosses.length, min: dLosses[0] ?? null, p25: quantile(dLosses, 0.25), median: quantile(dLosses, 0.5), p75: quantile(dLosses, 0.75), max: dLosses[dLosses.length - 1] ?? null }, incidentsLab: { n: labDloss.length, min: labDloss[0] ?? null, p25: quantile(labDloss, 0.25), median: quantile(labDloss, 0.5), p75: quantile(labDloss, 0.75), max: labDloss[labDloss.length - 1] ?? null }, notASelectionRule: true },
    q6_families: { identityClusters: { bySession, bySide, byCorpus, byPart, bySlice }, landscapeFamiliesOnTraced: families, note: tracedField.length ? 'familles paysage mesurées sur captures disponibles' : 'familles paysage non mesurées sur les 63 ; grappes d’identité publiées séparément' },
    q7_sideSignature: { fieldFailuresBySide: bySide, incidentsSignBySide: labSigns, mirrorBugClaimed: false, note: 'signe incidents = Math.sign(median(y local)) ; gauche tend vers +1, droite vers -1 sur ce corpus. Pas une preuve de bug miroir.' },
    q8_session17: { sessionId: SESSION_17, fieldCount: bySession[SESSION_17] || 0, shadowPopulations: session17Pops, engineCandidateInSession: session17Pops['engine-candidate'] || 0, witnessTiersForThose17: witnesses.pairs.filter(p => p.failureSession === SESSION_17).reduce((o, p) => { o[p.tier] = (o[p.tier] || 0) + 1; return o; }, {}), distinguished: (session17Pops['engine-candidate'] || 0) === 0, note: 'distinction objective : zéro engine-candidate dans l’ombre pour cette session. Aucune cause capteur déduite.' },
    q9_mechanismForPrototype: 'selection-par-perte-de-gabarit-sans-contrainte-de-support-de-roulement',
  };
  const artifact = {
    format: 'banane-running-surface-failure-replication-v1',
    nature: 'offline-independent-tracer-read-only',
    notPropose: true,
    baseCommit: '3256d8b329bfa9a9ab13a6b93f2ac78d786f9096',
    engineReferenceV46: 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3',
    reasonStudied: REASON_RUNNING,
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified',
    constants: { defaults: { ...G.DEFAULTS }, literals: LITERALS, note: 'aucune constante n’est un réglage de ce lot' },
    hashes,
    blocks: { humanFreeBlocks: HUMAN_FREE_BLOCKS, isolatedObservationalBlock: HUMAN_BLOCK },
    witnessMethod: witnesses.method,
    population: { runningSurfaceFailuresFromCgd: fails.length, windowFailuresExcluded: 1, byCorpus, bySession, bySide, byPart, bySlice, witnesses: witnesses.tiers, distinctWitnesses: witnesses.distinctWitnesses, nativeCapturesIndexed: nativeIdx.size, fieldRowsTraced: tracedField.length },
    incidentsLab: { present: lab.present, captureCount: lab.captureCount, railCount: lab.validations.length, tracerOk: lab.tracerOk, divergenceCount: lab.divergenceCount, validations: lab.validations },
    answers, rows, incidentWitnessRows: incidentRows, generatedAt: new Date().toISOString(),
  };
  const { generatedAt, sha256, ...cover } = artifact;
  artifact.sha256Covers = Object.keys(cover).sort();
  artifact.sha256 = sha256Obj(cover);
  artifact.summary = { failuresListed: fails.length, failuresTraced: tracedField.length, witnesses: witnesses.tiers, questions: { q1: answers.q1_coarseAlreadyUnsupported.count, q2: answers.q2_lostOnlyAfterRefinement.count, q3: answers.q3_nearestExists.count, q4: answers.q4_nearestAbsent.count, q9: answers.q9_mechanismForPrototype }, tracerDivergences: lab.divergenceCount + rows.reduce((n, r) => n + (r.traceValidation.divergences?.length || 0), 0) };
  return artifact;
}
function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--output');
  const out = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, 'audit/running-surface-failure-replication-v1.json');
  const A = build();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(A, null, 1));
  process.stdout.write(JSON.stringify({ output: out, sha256: A.sha256, failures: A.population.runningSurfaceFailuresFromCgd, traced: A.population.fieldRowsTraced, incidentsOk: A.incidentsLab.tracerOk, divergences: A.summary.tracerDivergences, q9: A.answers.q9_mechanismForPrototype }, null, 2) + '\n');
}
module.exports = Object.assign({}, CORE, { build });
if (require.main === module) main();
