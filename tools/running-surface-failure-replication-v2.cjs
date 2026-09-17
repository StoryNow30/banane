#!/usr/bin/env node
'use strict';
/* Running Surface Failure Replication V2 — hors ligne, lecture seule.
 * Traceur INDÉPENDANT. Ce n'est pas G.propose.
 * Constantes = G.DEFAULTS + littéraux geometry.js. Aucun seuil choisi.
 * Snapshot fail-closed. Aucune valeur humaine hors postHocEvaluation.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const N = require('./native-replay.cjs');
const F = require('./flank-support-shadow.cjs');

const ROOT = path.resolve(__dirname, '..');
const REASON_RUNNING = 'Plan de roulement non estimable.';
const DEGRADED_SESSION = '0c58c033-f2e7-4aa5-ad8c-80b081a83932';
const SESSION_17 = '3876864f-a864-4678-b7b0-3feecc4af418';
const HUMAN_FREE = Object.freeze([
  'identity', 'engineObserved', 'assembly', 'traceValidation',
  'coarseSearch', 'refinedSearch', 'topSupport', 'localLandscape',
  'nearestSupportValidPlacement', 'verticalAgreement', 'sessionSideContext',
  'degradationContext',
]);
const LITERALS = Object.freeze({
  source: 'src/geometry.js propose()',
  refineHalf: 0.004, refineStep: 0.001,
  headZ: -0.04, headWidthZ: -0.012,
  roiX: 0.5, roiY: 0.18, roiZ: 0.10,
  minPointsAroundMushroom: 8, minHeadVertices: 6,
  widthLo: 0.025, widthHi: 0.12,
  topAnchorStart: 0.012, topAnchorStep: 0.006, topAnchorNear: 0.004,
  faceAnchorStart: -0.014, faceAnchorEnd: -0.033, faceAnchorStep: -0.004, faceAnchorNear: 0.004,
  minAnchors: 3, lossCap: 0.025 * 0.025,
  topRowInner: 0.012, robustLineMinRows: 3,
  faceDropLo: 0.009, faceDropHi: 0.034,
});
const ARCHIVES = Object.freeze({
  historical: { name: 'banane-native-v4.6-2026-09-16.7z', sha256: '32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0', bytes: 34509008 },
  finalComplement: { name: 'banane-native-v4.6-2026-09-16-final.7z', sha256: '7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66', bytes: 56657500 },
});

function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function sha256Obj(o) { return crypto.createHash('sha256').update(stable(o)).digest('hex'); }
function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
function nearEq(a, b, eps = 1e-12) {
  if (a === b) return true;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  if (!Number.isFinite(a) && !Number.isFinite(b)) return true;
  return Math.abs(a - b) <= eps;
}
function vecEq(a, b, eps = 1e-12) {
  if (a == null && b == null) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((x, i) => nearEq(x, b[i], eps));
}
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}
function stats(arr) {
  const s = arr.filter(Number.isFinite).slice().sort((a, b) => a - b);
  return { n: s.length, min: s[0] ?? null, p25: quantile(s, 0.25), median: quantile(s, 0.5), p75: quantile(s, 0.75), max: s.length ? s[s.length - 1] : null };
}

function frozenHashes() {
  const out = { present: {}, expected: {}, match: {} };
  const p440 = path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json');
  const map = JSON.parse(fs.readFileSync(p440));
  for (const [rel, want] of Object.entries(map)) {
    if (!/geometry\.js$|capture-core\.js$|lidar\.js$/.test(rel)) continue;
    const got = fs.existsSync(path.join(ROOT, rel)) ? sha256File(path.join(ROOT, rel)) : null;
    out.expected[rel] = want; out.present[rel] = got; out.match[rel] = got === want;
  }
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.6.0-engine-baseline.json')));
  out.engineV46Expected = b.engine['src/engine.js'];
  out.engineV46Present = fs.existsSync(path.join(ROOT, 'src/engine.js')) ? sha256File(path.join(ROOT, 'src/engine.js')) : null;
  out.engineV46Match = out.engineV46Present === out.engineV46Expected;
  out.defaults = { ...G.DEFAULTS };
  return out;
}

function topRowsAt(points, u, z, width, topBand) {
  return points.filter(p => p[0] > u + LITERALS.topRowInner
    && p[0] < u + width - LITERALS.topRowInner
    && Math.abs(p[1] - z) < topBand).map(p => [p[0], p[1]]);
}

function independentTrace(capture, side, options = {}) {
  const cfg = { ...G.DEFAULTS, ...options, method: G.DEFAULTS.method };
  const rail = capture.rails?.[side];
  const out = {
    tracer: 'running-surface-failure-replication-v2', notPropose: true, side,
    exitReason: null, sign: null, width: null, pointsRetained: null,
    topAnchors: null, faceAnchors: null, coarseBest: null, refinedBest: null,
    coarseToRefined: null, topRowsCoarse: null, topRowsRefined: null,
    topFitCoarse: null, topFitRefined: null, faceRowsRefined: null,
    seed: null, templateLossCoarse: null, templateLossRefined: null,
    alternative: null, nearestSupportValid: null, neighborhoodSupported: null,
    neighborhoodCells: null, coarseCells: null, localZ: null, gridSupportedFraction: null,
  };
  if (!rail) { out.exitReason = 'profil-absent'; return out; }
  if (!capture.pointsSceneRelative?.length) { out.exitReason = 'Aucun point LiDAR disponible.'; return out; }
  const contour = rail.profileContours?.reduce(
    (a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  if (!contour) { out.exitReason = 'Contour du profil absent.'; return out; }
  const shape = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(G.median(shape.map(p => p[1])));
  out.sign = sign;
  if (!sign) { out.exitReason = 'Sens du profil ambigu.'; return out; }
  const vertices = shape.map(p => [sign * p[1], p[2]]);
  const head = vertices.filter(p => p[1] > LITERALS.headZ);
  if (head.length < LITERALS.minHeadVertices) { out.exitReason = 'Contour de champignon non reconnu.'; return out; }
  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes?.[i] === false) continue;
    if (!Array.isArray(capture.pointsSceneRelative[i]) || !capture.pointsSceneRelative[i].every(Number.isFinite)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, capture.pointsSceneRelative[i]);
    if (q.every(Number.isFinite) && Math.abs(q[0]) <= LITERALS.roiX && Math.abs(q[1]) < LITERALS.roiY && Math.abs(q[2]) < LITERALS.roiZ)
      points.push([sign * q[1], q[2], q[0]]);
  }
  out.pointsRetained = points.length;
  if (points.length < LITERALS.minPointsAroundMushroom) { out.exitReason = 'Trop peu de points autour du champignon.'; return out; }
  const zs = points.map(p => p[1]).sort((a, b) => a - b);
  out.localZ = { median: G.median(zs), min: zs[0], max: zs[zs.length - 1], n: zs.length };
  const width = Math.max(...head.filter(p => p[1] > LITERALS.headWidthZ).map(p => p[0]));
  out.width = width;
  if (!(width > LITERALS.widthLo && width < LITERALS.widthHi)) { out.exitReason = 'Dimensions du profil hors du domaine testé.'; return out; }
  const topAnchors = [];
  for (let u = LITERALS.topAnchorStart; u < width - LITERALS.topAnchorStart; u += LITERALS.topAnchorStep) {
    const near = head.filter(p => Math.abs(p[0] - u) < LITERALS.topAnchorNear);
    if (near.length) topAnchors.push([u, Math.max(...near.map(p => p[1]))]);
  }
  const faceAnchors = [];
  for (let z = LITERALS.faceAnchorStart; z >= LITERALS.faceAnchorEnd; z += LITERALS.faceAnchorStep) {
    const near = head.filter(p => Math.abs(p[1] - z) < LITERALS.faceAnchorNear);
    if (near.length) faceAnchors.push([Math.min(...near.map(p => p[0])), z]);
  }
  out.topAnchors = topAnchors.length; out.faceAnchors = faceAnchors.length;
  if (topAnchors.length < LITERALS.minAnchors || faceAnchors.length < LITERALS.minAnchors) {
    out.exitReason = 'Surfaces du profil non identifiées.'; return out;
  }
  function loss(anchors, u, z) {
    return G.median(anchors.map(a => {
      let best = LITERALS.lossCap;
      for (const p of points) {
        const d = (p[0] - u - a[0]) ** 2 + (p[1] - z - a[1]) ** 2;
        if (d < best) best = d;
      }
      return best;
    }));
  }
  function scoreAt(u, z) { return loss(topAnchors, u, z) + loss(faceAnchors, u, z) + 1e-7 * (Math.abs(u) + Math.abs(z)); }

  let best = { loss: Infinity, u: 0, z: 0 };
  const coarse = [];
  function search(cu, cz, ry, rz, step, retain) {
    for (let u = cu - ry; u <= cu + ry + 1e-10; u += step)
      for (let z = cz - rz; z <= cz + rz + 1e-10; z += step) {
        const score = scoreAt(u, z);
        if (retain) coarse.push({ loss: score, u, z });
        if (score < best.loss) best = { loss: score, u, z };
      }
  }
  search(0, 0, cfg.searchY, cfg.searchZ, cfg.grid, true);
  const coarseBest = { ...best };
  let alternative = null;
  for (const cand of coarse) {
    if (Math.hypot(cand.u - coarseBest.u, cand.z - coarseBest.z) < cfg.alternativeSeparation) continue;
    if (!alternative || cand.loss < alternative.loss) alternative = cand;
  }
  search(best.u, best.z, LITERALS.refineHalf, LITERALS.refineHalf, LITERALS.refineStep, false);
  const refinedBest = { ...best };
  const topCoarse = topRowsAt(points, coarseBest.u, coarseBest.z, width, cfg.topBand);
  const topRef = topRowsAt(points, refinedBest.u, refinedBest.z, width, cfg.topBand);
  out.coarseBest = { u: coarseBest.u, z: coarseBest.z, loss: coarseBest.loss };
  out.refinedBest = { u: refinedBest.u, z: refinedBest.z, loss: refinedBest.loss };
  out.coarseToRefined = {
    du: refinedBest.u - coarseBest.u, dz: refinedBest.z - coarseBest.z,
    distance: Math.hypot(refinedBest.u - coarseBest.u, refinedBest.z - coarseBest.z),
    dLoss: refinedBest.loss - coarseBest.loss,
  };
  out.topRowsCoarse = topCoarse.length; out.topRowsRefined = topRef.length;
  out.topFitCoarse = G.robustLine(topCoarse);
  out.topFitRefined = G.robustLine(topRef);
  out.seed = [sign * refinedBest.u, refinedBest.z];
  out.templateLossCoarse = coarseBest.loss; out.templateLossRefined = refinedBest.loss;
  out.alternative = alternative ? { u: alternative.u, z: alternative.z, loss: alternative.loss } : null;
  if (out.topFitRefined) {
    out.faceRowsRefined = points.filter(p => {
      const drop = out.topFitRefined.slope * p[0] + out.topFitRefined.intercept - p[1];
      return drop > LITERALS.faceDropLo && drop < LITERALS.faceDropHi && Math.abs(p[0] - refinedBest.u) < cfg.faceBand;
    }).length;
  } else out.faceRowsRefined = 0;

  const neighborhood = [];
  for (let u = refinedBest.u - LITERALS.refineHalf; u <= refinedBest.u + LITERALS.refineHalf + 1e-10; u += LITERALS.refineStep)
    for (let z = refinedBest.z - LITERALS.refineHalf; z <= refinedBest.z + LITERALS.refineHalf + 1e-10; z += LITERALS.refineStep) {
      const n = topRowsAt(points, u, z, width, cfg.topBand).length;
      neighborhood.push({ u, z, loss: scoreAt(u, z), topSupportCount: n });
    }
  out.neighborhoodCells = neighborhood.length;
  out.neighborhoodSupported = neighborhood.filter(n => n.topSupportCount >= LITERALS.robustLineMinRows).length;

  const explored = coarse.map(c => ({ stage: 'coarse', u: c.u, z: c.z, loss: c.loss, topSupportCount: topRowsAt(points, c.u, c.z, width, cfg.topBand).length }))
    .concat(neighborhood.map(n => ({ stage: 'refined-grid', ...n })));
  const supported = explored.filter(c => c.topSupportCount >= LITERALS.robustLineMinRows);
  out.coarseCells = coarse.length;
  out.gridSupportedFraction = explored.length ? supported.length / explored.length : null;
  let nearest = null;
  for (const c of supported) {
    const dist = Math.hypot(c.u - refinedBest.u, c.z - refinedBest.z);
    const dLoss = c.loss - refinedBest.loss;
    if (!nearest || dist < nearest.distance || (dist === nearest.distance && dLoss < nearest.dLoss))
      nearest = { exists: true, stage: c.stage, u: c.u, z: c.z, distance: dist, dLoss, topSupportCount: c.topSupportCount, templateLoss: c.loss };
  }
  out.nearestSupportValid = nearest || { exists: false, stage: null, u: null, z: null, distance: null, dLoss: null, topSupportCount: null, templateLoss: null };
  out.exitReason = out.topFitRefined ? 'traceur-au-dela-de-robustLine' : REASON_RUNNING;
  return out;
}

function validateAgainstPropose(capture, side) {
  const engine = G.propose(capture, side);
  const tr = independentTrace(capture, side);
  const divergences = [];
  const pub = {
    status: engine.status, reasons: engine.reasons || [],
    points: engine.metrics?.points ?? null,
    topCount: engine.top?.count ?? engine.metrics?.topCount ?? null,
    faceCount: engine.face?.count ?? engine.metrics?.faceCount ?? null,
    seed: engine.metrics?.seed ?? null,
    templateLoss: engine.metrics?.templateLoss ?? null,
    coarseBestLoss: engine.metrics?.templateAmbiguity?.coarseBestLoss ?? null,
  };
  if (pub.points != null && pub.points !== tr.pointsRetained) divergences.push({ field: 'pointsRetained', engine: pub.points, tracer: tr.pointsRetained });
  if (pub.seed && tr.seed && !vecEq(pub.seed, tr.seed)) divergences.push({ field: 'seed', engine: pub.seed, tracer: tr.seed });
  if (pub.templateLoss != null && !nearEq(pub.templateLoss, tr.templateLossRefined, 1e-15)) divergences.push({ field: 'templateLoss', engine: pub.templateLoss, tracer: tr.templateLossRefined });
  if (pub.coarseBestLoss != null && !nearEq(pub.coarseBestLoss, tr.templateLossCoarse, 1e-15)) divergences.push({ field: 'coarseBestLoss', engine: pub.coarseBestLoss, tracer: tr.templateLossCoarse });
  if (pub.topCount != null && pub.topCount !== tr.topRowsRefined) divergences.push({ field: 'topRowsRefined', engine: pub.topCount, tracer: tr.topRowsRefined });
  if (engine.status === 'unresolved' && engine.reasons?.[0] === REASON_RUNNING && tr.exitReason !== REASON_RUNNING)
    divergences.push({ field: 'exitReason', engine: engine.reasons[0], tracer: tr.exitReason });
  if (engine.status === 'candidate' && tr.topFitRefined == null)
    divergences.push({ field: 'topFitRefined', engine: 'candidate', tracer: null });
  return { ok: divergences.length === 0, divergences, engine: pub, tracer: { exitReason: tr.exitReason, pointsRetained: tr.pointsRetained, sign: tr.sign, topAnchors: tr.topAnchors, faceAnchors: tr.faceAnchors, coarseBest: tr.coarseBest, refinedBest: tr.refinedBest, topRowsCoarse: tr.topRowsCoarse, topRowsRefined: tr.topRowsRefined, seed: tr.seed, nearestExists: tr.nearestSupportValid?.exists ?? null } };
}

function loadIncidentCaptures() {
  const file = path.join(ROOT, 'tests/incidents/banane-dataset-v3-1788955914519.json');
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (raw.clouds || []).filter(c => c.pointsSceneRelative && c.rails);
}
function runIncidentsLab() {
  const captures = loadIncidentCaptures();
  const validations = [];
  for (const cap of captures) for (const side of ['left', 'right']) {
    if (!cap.rails?.[side]) continue;
    const v = validateAgainstPropose(cap, side);
    validations.push({ cut: cap.cut, side, engineStatus: v.engine.status, engineReasons: v.engine.reasons, ok: v.ok, divergences: v.divergences, tracer: v.tracer });
  }
  return { present: captures.length > 0, captureCount: captures.length, validations, tracerOk: validations.length > 0 && validations.every(v => v.ok), divergenceCount: validations.reduce((n, v) => n + v.divergences.length, 0) };
}

function loadCgdFailures() {
  const cgd = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/candidate-generation-diagnostics-v1.json'), 'utf8'));
  return (cgd.noCandidateRails || []).filter(r => r.exit?.reason === REASON_RUNNING).map(r => ({
    corpus: r.corpus, sessionId: r.sessionId, visitId: r.visitId, visitIndex: r.visitIndex, side: r.side,
    part: r.target?.part ?? null, cut: r.target?.cut ?? null, pageId: r.target?.pageId ?? null, frameId: r.target?.frameId ?? null,
    exitReason: r.exit.reason, exitStage: r.exit.stage, engineExposedMetrics: r.engineExposedMetrics,
    pointsSupplied: r.input?.pointsSupplied ?? null,
    pointsInEngineUsefulRoi: r.input?.coverageFromCollection?.pointsInEngineUsefulRoi ?? null,
    lidarStatus: r.input?.captureContext?.lidarStatus ?? null,
    snapshotId: null,
  }));
}

function candidateDirs() {
  const raw = [
    process.env.BANANE_NATIVE_DIR,
    process.env.BANANE_NATIVE_HISTORICAL,
    process.env.BANANE_NATIVE_FINAL,
    path.join(ROOT, 'datasets/native-v46'),
    path.join(ROOT, 'datasets/native-v46/historical'),
    path.join(ROOT, 'datasets/native-v46/final'),
    '/tmp/native-v46', '/tmp/native-v46/historical', '/tmp/native-v46/final',
    path.join(ROOT, 'datasets/native/reference/Banane'),
  ].filter(Boolean);
  const out = [];
  for (const d of raw) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    const jsons = fs.readdirSync(d).filter(f => f.endsWith('.json'));
    if (!jsons.length) continue;
    out.push(d);
  }
  return [...new Set(out)];
}

function loadNativeCorpora() {
  const dirs = candidateDirs();
  const corpora = [];
  for (const dir of dirs) {
    try { corpora.push({ dir, ...F.readCorpus(dir) }); }
    catch (e) { corpora.push({ dir, loadError: String(e.message || e), latestPerSession: new Map(), exports: [] }); }
  }
  return { dirs, corpora };
}

function indexVisits(corpora) {
  const byKey = new Map();
  for (const corpus of corpora) {
    if (!corpus.latestPerSession || !corpus.dir) continue;
    let visits;
    try { visits = F.readVisitsOf(corpus); } catch { continue; }
    for (const v of visits) {
      const key = `${v.sessionId}|${v.visitId}`;
      if (!byKey.has(key)) byKey.set(key, { visit: v, corpus });
    }
  }
  return byKey;
}

function assembleExact(visit, side, corpus) {
  const el = visit.geometryEligibility?.[side] ?? null;
  const snap = F.exactSnapshot(visit, side);
  if (!snap.ok) return { ok: false, failClosed: snap.reason, capture: null, pointsSupplied: 0, snapshotId: el?.snapshotId ?? null };
  const rail = snap.snapshot.rail;
  if (!rail) return { ok: false, failClosed: 'pose-absente-du-snapshot', capture: null, pointsSupplied: 0, snapshotId: el.snapshotId };
  const ids = el?.chunkIds ?? [];
  if (!ids.length) return { ok: false, failClosed: 'chunkIds-absents', capture: null, pointsSupplied: 0, snapshotId: el.snapshotId };
  const needed = new Set(ids);
  const chunks = F.readChunksOf(corpus, needed);
  const points = [], visible = [];
  for (const id of ids) {
    const c = chunks.get(id);
    if (!c) return { ok: false, failClosed: 'chunk-nomme-absent', capture: null, pointsSupplied: 0, snapshotId: el.snapshotId, missingChunk: id };
    for (let i = 0; i < c.points.length; i++) { points.push(c.points[i]); visible.push(c.visible ? c.visible[i] : true); }
  }
  if (!points.length) return { ok: false, failClosed: 'aucun-point', capture: null, pointsSupplied: 0, snapshotId: el.snapshotId };
  return {
    ok: true, failClosed: null, snapshotId: el.snapshotId, snapshotsAvailable: snap.available,
    chunkCount: ids.length, pointsSupplied: points.length,
    capture: { rails: { [side]: rail }, pointsSceneRelative: points, visibleByClipBoxes: visible },
  };
}

function classifyMechanism(tr) {
  if (!tr || tr.topRowsCoarse == null) return { family: 'untraced', labels: [] };
  const labels = [];
  const none = tr.nearestSupportValid?.exists !== true && tr.topRowsCoarse < LITERALS.robustLineMinRows && tr.topRowsRefined < LITERALS.robustLineMinRows;
  if (none) labels.push('aucun-placement-supporté-dans-espace-exploré');
  if (tr.topRowsCoarse >= LITERALS.robustLineMinRows && tr.topRowsRefined < LITERALS.robustLineMinRows)
    labels.push('support-perdu-après-raffinement');
  if (tr.nearestSupportValid?.exists && tr.nearestSupportValid.dLoss > 0 && tr.topRowsRefined < LITERALS.robustLineMinRows)
    labels.push('support-ailleurs-loss-supérieure');
  if (tr.topRowsRefined >= LITERALS.robustLineMinRows) labels.push('support-présent-au-best-refined');
  let family = 'autre-observé';
  if (labels.includes('aucun-placement-supporté-dans-espace-exploré')) family = 'aucun-placement-supporté-dans-espace-exploré';
  else if (labels.includes('support-perdu-après-raffinement')) family = 'support-perdu-après-raffinement';
  else if (labels.includes('support-ailleurs-loss-supérieure')) family = 'support-ailleurs-loss-supérieure';
  else if (labels.includes('support-présent-au-best-refined')) family = 'support-présent-au-best-refined';
  return { family, labels };
}

function loadShadowPool() {
  const file = path.join(ROOT, 'audit/flank-support-shadow-v1.json');
  if (!fs.existsSync(file)) return [];
  const shadow = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (shadow.rows || []).map(r => ({
    corpus: r.corpus, population: r.population,
    sessionId: r.decisionFeatures.sessionId, visitId: r.decisionFeatures.visitId,
    visitIndex: r.decisionFeatures.visitIndex, side: r.decisionFeatures.side,
    part: r.decisionFeatures.target?.part ?? null, cut: r.decisionFeatures.target?.cut ?? null,
    status: r.decisionFeatures.status, templateLoss: r.decisionFeatures.templateLoss,
    topCount: r.decisionFeatures.topCount, faceCount: r.decisionFeatures.faceCount,
    seed: r.decisionFeatures.candidates?.seed ?? null,
    slice: r.degradation?.slice ?? null, degradedSession: r.degradation?.degradedSession ?? null,
    excludedFromCausalAnalysis: r.degradation?.excludedFromCausalAnalysis ?? null,
  }));
}

function selectWitnesses(fails, pool) {
  const method = [
    'tier-1: même session + même côté + population engine-candidate + cut le plus proche',
    'tier-2: même session + même côté + engine-candidate restant',
    'tier-3: même côté + engine-candidate dans session saine (hors session-17 et hors session dégradée)',
  ];
  const candidates = pool.filter(p => p.population === 'engine-candidate');
  const healthy = s => s !== SESSION_17 && s !== DEGRADED_SESSION;
  const pairs = [];
  const used = new Map();
  for (const f of fails) {
    const key = `${f.sessionId}|${f.visitId}|${f.side}`;
    let pick = null, tier = null, note = null;
    const same = candidates.filter(c => c.sessionId === f.sessionId && c.side === f.side);
    if (same.length) {
      same.sort((a, b) => Math.abs((a.cut ?? 0) - (f.cut ?? 0)) - Math.abs((b.cut ?? 0) - (f.cut ?? 0)));
      pick = same[0]; tier = 1; note = 'même session + même côté + cut le plus proche';
    } else {
      const far = candidates.filter(c => c.side === f.side && healthy(c.sessionId));
      if (far.length) {
        far.sort((a, b) => Math.abs((a.cut ?? 0) - (f.cut ?? 0)) - Math.abs((b.cut ?? 0) - (f.cut ?? 0)));
        pick = far[0]; tier = 3; note = 'repli session saine même côté';
      }
    }
    pairs.push({
      failureKey: key, failureCut: f.cut, failureSide: f.side, failureSession: f.sessionId,
      tier, note, witnessKey: pick ? `${pick.sessionId}|${pick.visitId}|${pick.side}` : null,
      witnessSession: pick?.sessionId ?? null, witnessCut: pick?.cut ?? null, witnessSide: pick?.side ?? null,
      witnessVisitId: pick?.visitId ?? null, witnessTopCount: pick?.topCount ?? null, witnessTemplateLoss: pick?.templateLoss ?? null,
    });
    if (pick) used.set(`${pick.sessionId}|${pick.visitId}|${pick.side}`, true);
  }
  return { method, humanMatching: false, pairs, distinctWitnesses: used.size, tiers: { 1: pairs.filter(p => p.tier === 1).length, 2: pairs.filter(p => p.tier === 2).length, 3: pairs.filter(p => p.tier === 3).length, unmatched: pairs.filter(p => !p.witnessKey).length } };
}

function slimFit(fit) {
  if (!fit) return null;
  return { slope: fit.slope, intercept: fit.intercept, residual: fit.residual, count: fit.count, slopeLimited: fit.slopeLimited };
}

function build() {
  const hashes = frozenHashes();
  const fails = loadCgdFailures();
  const pool = loadShadowPool();
  const witnesses = selectWitnesses(fails, pool);
  const lab = runIncidentsLab();
  const native = loadNativeCorpora();
  const visitIndex = indexVisits(native.corpora);
  const shadowByKey = new Map(pool.map(p => [`${p.sessionId}|${p.visitId}|${p.side}`, p]));
  const witnessByFail = new Map(witnesses.pairs.map(p => [p.failureKey, p]));

  const rows = [];
  for (const f of fails) {
    const key = `${f.sessionId}|${f.visitId}|${f.side}`;
    const sh = shadowByKey.get(key);
    const w = witnessByFail.get(key);
    const hit = visitIndex.get(`${f.sessionId}|${f.visitId}`);
    let assembly = { status: native.dirs.length ? 'visite-absente-des-corpus-chargés' : 'archives-natives-absentes-du-clone', failClosed: null, ok: false };
    let traced = null, validation = { status: assembly.status, ok: null, divergences: [] };
    if (hit) {
      const assembled = assembleExact(hit.visit, f.side, hit.corpus);
      if (!assembled.ok) {
        assembly = { status: 'fail-closed', failClosed: assembled.failClosed, ok: false, snapshotId: assembled.snapshotId };
        validation = { status: 'fail-closed', ok: null, divergences: [], failClosed: assembled.failClosed };
      } else {
        assembly = { status: 'assembled', failClosed: null, ok: true, snapshotId: assembled.snapshotId, chunkCount: assembled.chunkCount, pointsSupplied: assembled.pointsSupplied, snapshotsAvailable: assembled.snapshotsAvailable, sourceDir: hit.corpus.dir };
        traced = independentTrace(assembled.capture, f.side);
        validation = validateAgainstPropose(assembled.capture, f.side);
        validation.status = validation.ok ? 'matched-engine' : 'tracer-divergence';
      }
    }
    const cls = classifyMechanism(traced);
    const cfg = G.DEFAULTS;
    rows.push({
      identity: { corpus: f.corpus, sessionId: f.sessionId, visitId: f.visitId, visitIndex: f.visitIndex, side: f.side, part: f.part, cut: f.cut, pageId: f.pageId, frameId: f.frameId, key },
      engineObserved: { reason: f.exitReason, stage: f.exitStage, engineExposedMetrics: f.engineExposedMetrics, pointsSupplied: f.pointsSupplied, pointsInEngineUsefulRoi: f.pointsInEngineUsefulRoi, lidarStatus: f.lidarStatus, shadowPopulation: sh?.population ?? null },
      assembly,
      traceValidation: validation,
      coarseSearch: traced ? { best: traced.coarseBest, topRows: traced.topRowsCoarse, topFit: slimFit(traced.topFitCoarse), cells: traced.coarseCells, alreadyUnsupported: traced.topRowsCoarse < LITERALS.robustLineMinRows } : { best: null, topRows: null, alreadyUnsupported: null, reason: assembly.status },
      refinedSearch: traced ? { best: traced.refinedBest, topRows: traced.topRowsRefined, topFit: slimFit(traced.topFitRefined), displacement: traced.coarseToRefined, unsupported: traced.topRowsRefined < LITERALS.robustLineMinRows } : { best: null, topRows: null, unsupported: null, reason: assembly.status },
      topSupport: traced ? { coarse: traced.topRowsCoarse, refined: traced.topRowsRefined, faceRowsRefined: traced.faceRowsRefined, topAnchors: traced.topAnchors, faceAnchors: traced.faceAnchors, localPoints: traced.pointsRetained, sign: traced.sign, width: traced.width, seed: traced.seed } : { coarse: null, refined: null, sign: null, seed: null },
      localLandscape: traced ? { fieldsSeparated: true, neighborhoodSupported: traced.neighborhoodSupported, neighborhoodCells: traced.neighborhoodCells, gridSupportedFraction: traced.gridSupportedFraction, templateLossBest: traced.templateLossRefined } : { fieldsSeparated: true, gridSupportedFraction: null, reason: assembly.status },
      nearestSupportValidPlacement: traced ? traced.nearestSupportValid : { exists: null, reason: assembly.status },
      verticalAgreement: traced && traced.localZ ? {
        formulation: 'désaccord vertical relatif observé',
        localZMedian: traced.localZ.median,
        refinedBestZ: traced.refinedBest.z,
        coarseBestZ: traced.coarseBest.z,
        cloudMinusPlacementZ: traced.localZ.median - traced.refinedBest.z,
        searchZBound: cfg.searchZ,
        distanceToSearchZBound: cfg.searchZ - Math.abs(traced.refinedBest.z),
        onSearchZBound: Math.abs(Math.abs(traced.refinedBest.z) - cfg.searchZ) < 1e-12,
      } : { formulation: 'désaccord vertical relatif observé', localZMedian: null, refinedBestZ: null, cloudMinusPlacementZ: null, reason: assembly.status },
      sessionSideContext: { sessionId: f.sessionId, side: f.side, isSession17: f.sessionId === SESSION_17, isDegradedSession: f.sessionId === DEGRADED_SESSION, witnessTier: w?.tier ?? null, witnessKey: w?.witnessKey ?? null, observedFamily: cls.family, observedMotifs: cls.labels },
      degradationContext: { slice: sh?.slice ?? null, degradedSession: sh?.degradedSession ?? null, excludedFromCausalAnalysis: sh?.excludedFromCausalAnalysis ?? null, lidarStatus: f.lidarStatus },
      postHocEvaluation: { observationalOnly: true, humanUsedForSearch: false, humanUsedForWitness: false, humanUsedForNeighbor: false, humanUsedForFamily: false, note: 'aucune référence humaine n’entre dans ce lot' },
    });
  }

  const traced = rows.filter(r => r.traceValidation.status === 'matched-engine' || r.traceValidation.status === 'tracer-divergence');
  const failClosed = rows.filter(r => r.assembly.status === 'fail-closed');
  const families = {};
  for (const r of rows) {
    const fam = r.sessionSideContext.observedFamily;
    families[fam] = (families[fam] || 0) + 1;
  }
  const bySession = {}, bySide = {}, byCorpus = {}, byPart = {}, bySlice = {};
  for (const r of rows) {
    bySession[r.identity.sessionId] = (bySession[r.identity.sessionId] || 0) + 1;
    bySide[r.identity.side] = (bySide[r.identity.side] || 0) + 1;
    byCorpus[r.identity.corpus] = (byCorpus[r.identity.corpus] || 0) + 1;
    byPart[String(r.identity.part)] = (byPart[String(r.identity.part)] || 0) + 1;
    bySlice[r.degradationContext.slice || 'unknown'] = (bySlice[r.degradationContext.slice || 'unknown'] || 0) + 1;
  }
  const session17Pops = {};
  for (const p of pool.filter(x => x.sessionId === SESSION_17)) session17Pops[p.population] = (session17Pops[p.population] || 0) + 1;

  const q1 = traced.filter(r => r.sessionSideContext.observedFamily === 'aucun-placement-supporté-dans-espace-exploré').length;
  const q2 = traced.filter(r => (r.sessionSideContext.observedMotifs || []).includes('support-ailleurs-loss-supérieure')).length;
  const q3 = traced.filter(r => (r.sessionSideContext.observedMotifs || []).includes('support-perdu-après-raffinement')).length;
  const q4 = traced.filter(r => r.nearestSupportValidPlacement?.exists === true).length;

  const answers = {
    q1_noneSupportedInExploredGrid: { field63Traced: traced.length, count: traced.length ? q1 : null },
    q2_supportedElsewhereHigherLoss: { field63Traced: traced.length, count: traced.length ? q2 : null },
    q3_lostOnlyAfterRefinement: { field63Traced: traced.length, count: traced.length ? q3 : null },
    q4_nearestExists: { field63Traced: traced.length, count: traced.length ? q4 : null },
    q5_distributions: {
      bestZ: stats(traced.map(r => r.refinedSearch.best?.z)),
      coarseBestZ: stats(traced.map(r => r.coarseSearch.best?.z)),
      refinedBestZ: stats(traced.map(r => r.refinedSearch.best?.z)),
      localZMedian: stats(traced.map(r => r.verticalAgreement.localZMedian)),
      cloudMinusPlacementZ: stats(traced.map(r => r.verticalAgreement.cloudMinusPlacementZ)),
      distanceToSearchZBound: stats(traced.map(r => r.verticalAgreement.distanceToSearchZBound)),
      gridSupportedFraction: stats(traced.map(r => r.localLandscape.gridSupportedFraction)),
      nearSearchZBound: traced.filter(r => r.verticalAgreement.onSearchZBound).length,
      notASelectionRule: true,
    },
    q6_witnessComparison: {
      method: witnesses.method,
      humanMatching: false,
      tiers: witnesses.tiers,
      distinctWitnesses: witnesses.distinctWitnesses,
      failureFamilies: families,
      note: 'témoins = engine-candidate, jamais une référence humaine',
    },
    q7_sideSignature: {
      fieldFailuresBySide: bySide,
      tracedBySide: traced.reduce((o, r) => { o[r.identity.side] = (o[r.identity.side] || 0) + 1; return o; }, {}),
      signBySide: traced.reduce((o, r) => { const k = `${r.identity.side}:${r.topSupport.sign}`; o[k] = (o[k] || 0) + 1; return o; }, {}),
      mirrorBugClaimed: false,
    },
    q8_session17: {
      sessionId: SESSION_17,
      fieldCount: bySession[SESSION_17] || 0,
      shadowPopulations: session17Pops,
      engineCandidateInSession: session17Pops['engine-candidate'] || 0,
      distinguished: (session17Pops['engine-candidate'] || 0) === 0,
    },
    q9_clusterPart1Right5083_5276: (() => {
      const cluster = rows.filter(r => r.identity.part === 1 && r.identity.side === 'right' && r.identity.cut >= 5083 && r.identity.cut <= 5276);
      return { n: cluster.length, traced: cluster.filter(r => r.traceValidation.status === 'matched-engine' || r.traceValidation.status === 'tracer-divergence').length, sessions: [...new Set(cluster.map(r => r.identity.sessionId))], familyCounts: cluster.reduce((o, r) => { o[r.sessionSideContext.observedFamily] = (o[r.sessionSideContext.observedFamily] || 0) + 1; return o; }, {}) };
    })(),
  };

  const artifact = {
    format: 'banane-running-surface-failure-replication-v2',
    nature: 'offline-independent-tracer-read-only',
    notPropose: true,
    baseCommit: '3256d8b329bfa9a9ab13a6b93f2ac78d786f9096',
    engineReferenceV46: 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3',
    reasonStudied: REASON_RUNNING,
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified',
    archivesExpected: ARCHIVES,
    constants: { defaults: { ...G.DEFAULTS }, literals: LITERALS, note: 'aucune constante n’est un réglage de ce lot' },
    hashes,
    blocks: { humanFreeBlocks: HUMAN_FREE, isolatedObservationalBlock: 'postHocEvaluation' },
    witnessMethod: witnesses.method,
    nativeDiscovery: { dirsTriedLogic: 'BANANE_NATIVE_* + datasets/native-v46 + /tmp/native-v46', dirsFound: native.dirs, visitKeysIndexed: visitIndex.size },
    population: {
      runningSurfaceFailuresFromCgd: fails.length, windowFailuresExcluded: 1,
      byCorpus, bySession, bySide, byPart, bySlice,
      witnesses: witnesses.tiers, distinctWitnesses: witnesses.distinctWitnesses,
      fieldRowsTraced: traced.length, fieldRowsFailClosed: failClosed.length,
      fieldRowsArchiveAbsent: rows.filter(r => r.assembly.status === 'archives-natives-absentes-du-clone').length,
      fieldRowsVisitAbsent: rows.filter(r => r.assembly.status === 'visite-absente-des-corpus-chargés').length,
    },
    incidentsLab: { present: lab.present, captureCount: lab.captureCount, railCount: lab.validations.length, tracerOk: lab.tracerOk, divergenceCount: lab.divergenceCount, validations: lab.validations },
    answers,
    rows,
    generatedAt: new Date().toISOString(),
  };
  const { generatedAt, sha256, ...cover } = artifact;
  artifact.sha256Covers = Object.keys(cover).sort();
  artifact.sha256 = sha256Obj(cover);
  artifact.summary = {
    failuresListed: fails.length, failuresTraced: traced.length, failClosed: failClosed.length,
    families, witnesses: witnesses.tiers,
    questions: { q1: answers.q1_noneSupportedInExploredGrid.count, q2: answers.q2_supportedElsewhereHigherLoss.count, q3: answers.q3_lostOnlyAfterRefinement.count, q4: answers.q4_nearestExists.count },
    tracerDivergences: lab.divergenceCount + rows.reduce((n, r) => n + (r.traceValidation.divergences?.length || 0), 0),
  };
  return artifact;
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--output');
  const out = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, 'audit/running-surface-failure-replication-v2.json');
  const A = build();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(A, null, 1));
  process.stdout.write(JSON.stringify({
    output: out, sha256: A.sha256, failures: A.population.runningSurfaceFailuresFromCgd,
    traced: A.population.fieldRowsTraced, failClosed: A.population.fieldRowsFailClosed,
    archiveAbsent: A.population.fieldRowsArchiveAbsent, incidentsOk: A.incidentsLab.tracerOk,
    divergences: A.summary.tracerDivergences, families: A.summary.families,
  }, null, 2) + '\n');
}

module.exports = {
  LITERALS, HUMAN_FREE, REASON_RUNNING, SESSION_17, DEGRADED_SESSION, ARCHIVES,
  independentTrace, validateAgainstPropose, runIncidentsLab, loadCgdFailures,
  selectWitnesses, loadShadowPool, build, frozenHashes, assembleExact, classifyMechanism,
};
if (require.main === module) main();
