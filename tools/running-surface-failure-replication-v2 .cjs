#!/usr/bin/env node
'use strict';
/* Running Surface Failure Replication V2 — exécution capsule RSF V1.
 * Traceur INDÉPENDANT (préexistant à la capsule). Ce n'est pas G.propose.
 * Résultats q1–q9 produits sans appeler le traceur embarqué de la capsule.
 *
 * Adaptateur autorisé : Cap.loadRails + Cap.captureFromPayload.
 * captureFromPayload concatène points + visible dans l'ordre des chunks et
 * pose rails[side] = railInitialState. Aucune métrique Running Surface.
 *
 * Constantes = G.DEFAULTS + littéraux geometry.js. Aucun seuil choisi.
 * Aucune valeur humaine hors postHocEvaluation.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const Cap = require('./banane-capsule.cjs');

const ROOT = path.resolve(__dirname, '..');
const REASON_RUNNING = 'Plan de roulement non estimable.';
const DEGRADED_SESSION = '0c58c033-f2e7-4aa5-ad8c-80b081a83932';
const SESSION_17 = '3876864f-a864-4678-b7b0-3feecc4af418';
const LOSSLESS_FRONTIER_VISIT_INDEX = 245;
const CAPSULE_ID = 'rsf-v1';
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
const EXPECTED_CAPSULE_SHA = 'a8bb638f63e415ddf5bfede627f869a564c8af9afd68c556c2af2f943dcbdbb9';

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
  return { ok: divergences.length === 0, divergences, engine: pub, tracer: { exitReason: tr.exitReason, pointsRetained: tr.pointsRetained, sign: tr.sign, topAnchors: tr.topAnchors, faceAnchors: tr.faceAnchors, coarseBest: tr.coarseBest, refinedBest: tr.refinedBest, topRowsCoarse: tr.topRowsCoarse, topRowsRefined: tr.topRowsRefined, seed: tr.seed, nearestExists: tr.nearestSupportValid?.exists ?? null }, trace: tr };
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
  const p = path.join(ROOT, 'audit/candidate-generation-diagnostics-v1.json');
  if (!fs.existsSync(p)) return [];
  const cgd = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (cgd.noCandidateRails || []).filter(r => r.exit?.reason === REASON_RUNNING).map(r => ({
    corpus: r.corpus, sessionId: r.sessionId, visitId: r.visitId, visitIndex: r.visitIndex, side: r.side,
    part: r.target?.part ?? null, cut: r.target?.cut ?? null, pageId: r.target?.pageId ?? null, frameId: r.target?.frameId ?? null,
    exitReason: r.exit.reason, exitStage: r.exit.stage,
  }));
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

function selectWitnesses(fails, controls) {
  const method = [
    'tier-1: même session + même côté + cut le plus proche',
    'tier-2: même session + même côté',
    'tier-3: même côté dans une session saine (hors session-17 et hors session dégradée)',
  ];
  const healthy = s => s !== SESSION_17 && s !== DEGRADED_SESSION;
  const pairs = [];
  const used = new Map();
  for (const f of fails) {
    const key = `${f.sessionId}|${f.visitId}|${f.side}`;
    let pick = null, tier = null, note = null;
    const sameSessionSide = controls.filter(c => c.sessionId === f.sessionId && c.side === f.side);
    if (sameSessionSide.length) {
      const byCut = sameSessionSide.slice().sort((a, b) => Math.abs((a.cut ?? 0) - (f.cut ?? 0)) - Math.abs((b.cut ?? 0) - (f.cut ?? 0)));
      pick = byCut[0];
      tier = 1;
      note = 'même session + même côté + cut le plus proche';
    } else {
      const sameSession = controls.filter(c => c.sessionId === f.sessionId);
      if (sameSession.length) {
        pick = sameSession[0];
        tier = 2;
        note = 'même session, côté différent';
      } else {
        const far = controls.filter(c => c.side === f.side && healthy(c.sessionId));
        if (far.length) {
          far.sort((a, b) => Math.abs((a.cut ?? 0) - (f.cut ?? 0)) - Math.abs((b.cut ?? 0) - (f.cut ?? 0)));
          pick = far[0];
          tier = 3;
          note = 'repli session saine même côté';
        }
      }
    }
    pairs.push({
      failureKey: key, failureCut: f.cut, failureSide: f.side, failureSession: f.sessionId,
      tier, note, witnessKey: pick ? `${pick.sessionId}|${pick.visitId}|${pick.side}` : null,
      witnessSession: pick?.sessionId ?? null, witnessCut: pick?.cut ?? null, witnessSide: pick?.side ?? null,
      witnessVisitId: pick?.visitId ?? null, witnessVisitIndex: pick?.visitIndex ?? null,
    });
    if (pick) used.set(`${pick.sessionId}|${pick.visitId}|${pick.side}`, true);
  }
  return {
    method, humanMatching: false, geometricMetricsUsed: false, pool: 'capsule-controls-176',
    pairs, distinctWitnesses: used.size,
    tiers: {
      1: pairs.filter(p => p.tier === 1).length,
      2: pairs.filter(p => p.tier === 2).length,
      3: pairs.filter(p => p.tier === 3).length,
      unmatched: pairs.filter(p => !p.witnessKey).length,
    },
  };
}

function slimFit(fit) {
  if (!fit) return null;
  return { slope: fit.slope, intercept: fit.intercept, residual: fit.residual, count: fit.count, slopeLimited: fit.slopeLimited };
}

function verticalFrom(tr) {
  const cfg = G.DEFAULTS;
  if (!tr || !tr.localZ || !tr.refinedBest) {
    return { formulation: 'désaccord vertical relatif observé entre nuage transformé et pose/placement de profil', localZMedian: null, refinedBestZ: null, coarseBestZ: null, cloudMinusPlacementZ: null };
  }
  return {
    formulation: 'désaccord vertical relatif observé entre nuage transformé et pose/placement de profil',
    localZMedian: tr.localZ.median,
    refinedBestZ: tr.refinedBest.z,
    coarseBestZ: tr.coarseBest.z,
    cloudMinusPlacementZ: tr.localZ.median - tr.refinedBest.z,
    searchZBound: cfg.searchZ,
    distanceToSearchZBound: cfg.searchZ - Math.abs(tr.refinedBest.z),
    onSearchZBound: Math.abs(Math.abs(tr.refinedBest.z) - cfg.searchZ) < 1e-12,
  };
}

function identityOf(payload) {
  const k = payload.key;
  return {
    corpus: k.corpus, cohort: k.cohort, sessionId: k.sessionId, visitId: k.visitId,
    visitIndex: k.visitIndex, side: k.side, part: k.part, cut: k.cut,
    pageId: payload.target?.pageId ?? null, frameId: payload.target?.frameId ?? null,
    snapshotId: payload.snapshot?.snapshotId ?? null,
    archive: payload.provenance?.archive ?? null,
    payloadSha256: payload.payloadSha256,
    key: `${k.sessionId}|${k.visitId}|${k.side}`,
  };
}

function rowFrom(payload, traced, validation, cls, witness) {
  const id = identityOf(payload);
  const f = payload.key;
  const beforeFrontier = f.sessionId === DEGRADED_SESSION && f.visitIndex < LOSSLESS_FRONTIER_VISIT_INDEX;
  const afterFrontier = f.sessionId === DEGRADED_SESSION && f.visitIndex >= LOSSLESS_FRONTIER_VISIT_INDEX;
  return {
    identity: id,
    engineObserved: {
      cohort: f.cohort,
      engineStatus: validation.engine.status,
      engineReasons: validation.engine.reasons,
      pointsRetained: traced.pointsRetained,
      pointsSupplied: payload.provenance?.pointsSupplied ?? null,
    },
    assembly: {
      status: 'capsule-payload',
      ok: true,
      adapter: 'captureFromPayload',
      adapterComputesRunningSurface: false,
      snapshotId: payload.snapshot?.snapshotId ?? null,
      chunkCount: payload.chunkRefs?.length ?? payload.chunks?.length ?? null,
      pointsSupplied: payload.provenance?.pointsSupplied ?? null,
      payloadSha256: payload.payloadSha256,
    },
    traceValidation: {
      status: validation.ok ? 'matched-engine' : 'tracer-divergence',
      ok: validation.ok,
      divergences: validation.divergences,
    },
    coarseSearch: { best: traced.coarseBest, topRows: traced.topRowsCoarse, topFit: slimFit(traced.topFitCoarse), cells: traced.coarseCells, alreadyUnsupported: traced.topRowsCoarse == null ? null : traced.topRowsCoarse < LITERALS.robustLineMinRows },
    refinedSearch: { best: traced.refinedBest, topRows: traced.topRowsRefined, topFit: slimFit(traced.topFitRefined), displacement: traced.coarseToRefined, unsupported: traced.topRowsRefined == null ? null : traced.topRowsRefined < LITERALS.robustLineMinRows },
    topSupport: { coarse: traced.topRowsCoarse, refined: traced.topRowsRefined, faceRowsRefined: traced.faceRowsRefined, topAnchors: traced.topAnchors, faceAnchors: traced.faceAnchors, localPoints: traced.pointsRetained, sign: traced.sign, width: traced.width, seed: traced.seed },
    localLandscape: { fieldsSeparated: true, neighborhoodSupported: traced.neighborhoodSupported, neighborhoodCells: traced.neighborhoodCells, gridSupportedFraction: traced.gridSupportedFraction, templateLossBest: traced.templateLossRefined },
    nearestSupportValidPlacement: traced.nearestSupportValid,
    verticalAgreement: verticalFrom(traced),
    sessionSideContext: {
      sessionId: f.sessionId, side: f.side, archive: payload.provenance?.archive ?? null,
      isSession17: f.sessionId === SESSION_17,
      isDegradedSession: f.sessionId === DEGRADED_SESSION,
      beforeLosslessFrontier: beforeFrontier,
      afterLosslessFrontier: afterFrontier,
      witnessTier: witness?.tier ?? null,
      witnessKey: witness?.witnessKey ?? null,
      observedFamily: cls.family,
      observedMotifs: cls.labels,
    },
    degradationContext: {
      sessionId: f.sessionId,
      visitIndex: f.visitIndex,
      losslessFrontierVisitIndex: LOSSLESS_FRONTIER_VISIT_INDEX,
      frontierSource: 'flank-support-shadow-v1.1-locked-visitIndex-245',
      slice: f.sessionId === DEGRADED_SESSION ? (beforeFrontier ? 'before-last-lossless' : 'degraded-tail') : 'not-degraded-session',
    },
    postHocEvaluation: { observationalOnly: true, humanUsedForSearch: false, humanUsedForWitness: false, humanUsedForNeighbor: false, humanUsedForFamily: false, note: 'aucune référence humaine n’entre dans ce lot' },
  };
}

function scanHumanPayloads(rails) {
  const hits = [];
  for (const r of rails) {
    const found = Cap.findHumanKeys({
      railInitialState: r.railInitialState, chunks: r.chunks,
      target: r.target, snapshot: r.snapshot, provenance: r.provenance, key: r.key,
    });
    if (found.length) hits.push({ part: r.key.part, cut: r.key.cut, side: r.key.side, found });
  }
  return { railsScanned: rails.length, leakRails: hits.length, hits };
}

function countBy(rows, fn) {
  const o = {};
  for (const r of rows) {
    const k = fn(r);
    o[k] = (o[k] || 0) + 1;
  }
  return o;
}

function verticalStats(rows) {
  return {
    bestZ: stats(rows.map(r => r.refinedSearch.best?.z)),
    coarseBestZ: stats(rows.map(r => r.coarseSearch.best?.z)),
    refinedBestZ: stats(rows.map(r => r.refinedSearch.best?.z)),
    localZMedian: stats(rows.map(r => r.verticalAgreement.localZMedian)),
    cloudMinusPlacementZ: stats(rows.map(r => r.verticalAgreement.cloudMinusPlacementZ)),
    distanceToSearchZBound: stats(rows.map(r => r.verticalAgreement.distanceToSearchZBound)),
    gridSupportedFraction: stats(rows.map(r => r.localLandscape.gridSupportedFraction)),
    topRowsCoarse: stats(rows.map(r => r.topSupport.coarse)),
    topRowsRefined: stats(rows.map(r => r.topSupport.refined)),
    nearSearchZBound: rows.filter(r => r.verticalAgreement.onSearchZBound).length,
    notASelectionRule: true,
  };
}

function replayPayload(payload) {
  const side = payload.key.side;
  const capture = Cap.captureFromPayload(payload);
  const validation = validateAgainstPropose(capture, side);
  const traced = validation.trace;
  const cls = classifyMechanism(traced);
  return { capturePoints: capture.pointsSceneRelative.length, traced, validation, cls };
}

function build() {
  const hashes = frozenHashes();
  const loaded = Cap.loadRails(CAPSULE_ID);
  const manifest = loaded.manifest;
  const rails = loaded.rails;
  const humanScan = scanHumanPayloads(rails);
  if (humanScan.leakRails) throw new Error('fuite humaine capsule : ' + JSON.stringify(humanScan.hits));
  if (manifest.deterministicSha256 !== EXPECTED_CAPSULE_SHA)
    throw new Error('SHA capsule inattendu : ' + manifest.deterministicSha256);

  const failures = rails.filter(r => r.key.cohort === 'failure');
  const controls = rails.filter(r => r.key.cohort === 'control');
  if (failures.length !== 63 || controls.length !== 176)
    throw new Error(`population capsule ${failures.length}/${controls.length} != 63/176`);

  const cgd = loadCgdFailures();
  const cgdKeys = new Set(cgd.map(f => `${f.sessionId}|${f.visitId}|${f.side}`));
  const failKeys = failures.map(f => `${f.key.sessionId}|${f.key.visitId}|${f.key.side}`);
  const identityLock = {
    cgdPresent: cgd.length === 63,
    cgdCount: cgd.length,
    capsuleFailureKeys: failKeys.length,
    missingInCgd: cgd.length ? failKeys.filter(k => !cgdKeys.has(k)) : null,
    extraInCgd: cgd.length ? [...cgdKeys].filter(k => !failKeys.includes(k)) : null,
  };

  const lab = runIncidentsLab();

  const controlIdents = controls.map(p => ({
    sessionId: p.key.sessionId, visitId: p.key.visitId, visitIndex: p.key.visitIndex,
    side: p.key.side, part: p.key.part, cut: p.key.cut,
  }));
  const failIdents = failures.map(p => ({
    sessionId: p.key.sessionId, visitId: p.key.visitId, visitIndex: p.key.visitIndex,
    side: p.key.side, part: p.key.part, cut: p.key.cut,
  }));
  const witnesses = selectWitnesses(failIdents, controlIdents);
  const witnessByFail = new Map(witnesses.pairs.map(p => [p.failureKey, p]));

  const failureRows = [];
  const controlRows = [];
  let compared = 0, divergencesTotal = 0;
  const divergenceExamples = [];

  for (const payload of controls) {
    const { traced, validation, cls } = replayPayload(payload);
    compared += 1;
    divergencesTotal += validation.divergences.length;
    if (!validation.ok && divergenceExamples.length < 12)
      divergenceExamples.push({ key: identityOf(payload).key, divergences: validation.divergences });
    controlRows.push(rowFrom(payload, traced, validation, cls, null));
  }
  for (const payload of failures) {
    const { traced, validation, cls } = replayPayload(payload);
    compared += 1;
    divergencesTotal += validation.divergences.length;
    if (!validation.ok && divergenceExamples.length < 12)
      divergenceExamples.push({ key: identityOf(payload).key, divergences: validation.divergences });
    const w = witnessByFail.get(`${payload.key.sessionId}|${payload.key.visitId}|${payload.key.side}`);
    failureRows.push(rowFrom(payload, traced, validation, cls, w));
  }

  const families = countBy(failureRows, r => r.sessionSideContext.observedFamily);
  const controlFamilies = countBy(controlRows, r => r.sessionSideContext.observedFamily);

  const q1 = failureRows.filter(r => r.sessionSideContext.observedFamily === 'aucun-placement-supporté-dans-espace-exploré').length;
  const q2 = failureRows.filter(r => r.sessionSideContext.observedFamily === 'support-ailleurs-loss-supérieure').length;
  const q3 = failureRows.filter(r => r.sessionSideContext.observedFamily === 'support-perdu-après-raffinement').length;
  const q4 = failureRows.filter(r => r.sessionSideContext.observedFamily === 'support-présent-au-best-refined').length;
  const q5 = failureRows.filter(r => r.sessionSideContext.observedFamily === 'autre-observé').length;
  const motifs = {
    noneSupported: failureRows.filter(r => (r.sessionSideContext.observedMotifs || []).includes('aucun-placement-supporté-dans-espace-exploré')).length,
    higherLoss: failureRows.filter(r => (r.sessionSideContext.observedMotifs || []).includes('support-ailleurs-loss-supérieure')).length,
    lostAfterRefinement: failureRows.filter(r => (r.sessionSideContext.observedMotifs || []).includes('support-perdu-après-raffinement')).length,
    supportAtRefinedBest: failureRows.filter(r => (r.sessionSideContext.observedMotifs || []).includes('support-présent-au-best-refined')).length,
  };

  const answers = {
    exclusivePriority: [
      'aucun-placement-supporté-dans-espace-exploré',
      'support-perdu-après-raffinement',
      'support-ailleurs-loss-supérieure',
      'support-présent-au-best-refined',
      'autre-observé',
    ],
    q1_noneSupportedInExploredGrid: { field63Traced: failureRows.length, count: q1 },
    q2_supportedElsewhereHigherLoss: { field63Traced: failureRows.length, count: q2, motifCount: motifs.higherLoss },
    q3_lostOnlyAfterRefinement: { field63Traced: failureRows.length, count: q3, motifCount: motifs.lostAfterRefinement },
    q4_supportAtRefinedBest: { field63Traced: failureRows.length, count: q4 },
    q5_otherObserved: { field63Traced: failureRows.length, count: q5 },
    exclusiveSum: q1 + q2 + q3 + q4 + q5,
    q_vertical_failures: verticalStats(failureRows),
    q_vertical_controls: verticalStats(controlRows),
    q6_witnessComparison: {
      method: witnesses.method,
      humanMatching: false,
      geometricMetricsUsed: false,
      pool: witnesses.pool,
      tiers: witnesses.tiers,
      distinctWitnesses: witnesses.distinctWitnesses,
      failureFamilies: families,
      previousShadowTiersPublishedNotAsserted: { 1: 46, 2: 0, 3: 17 },
    },
    q7_sideSignature: {
      fieldFailuresBySide: countBy(failureRows, r => r.identity.side),
      controlsBySide: countBy(controlRows, r => r.identity.side),
      tracedBySide: countBy(failureRows, r => r.identity.side),
      signBySideFailures: countBy(failureRows, r => `${r.identity.side}:${r.topSupport.sign}`),
      signBySideControls: countBy(controlRows, r => `${r.identity.side}:${r.topSupport.sign}`),
      mirrorBugClaimed: false,
    },
    q8_session17: {
      sessionId: SESSION_17,
      fieldCount: failureRows.filter(r => r.identity.sessionId === SESSION_17).length,
      controlCount: controlRows.filter(r => r.identity.sessionId === SESSION_17).length,
      distinguished: controlRows.filter(r => r.identity.sessionId === SESSION_17).length === 0,
    },
    q9_clusterPart1Right5083_5276: (() => {
      const cluster = failureRows.filter(r => r.identity.part === 1 && r.identity.side === 'right' && r.identity.cut >= 5083 && r.identity.cut <= 5276);
      return {
        n: cluster.length,
        traced: cluster.length,
        sessions: [...new Set(cluster.map(r => r.identity.sessionId))],
        familyCounts: countBy(cluster, r => r.sessionSideContext.observedFamily),
        archives: countBy(cluster, r => r.identity.archive),
      };
    })(),
    session0c58c033: {
      sessionId: DEGRADED_SESSION,
      losslessFrontierVisitIndex: LOSSLESS_FRONTIER_VISIT_INDEX,
      failures: {
        total: failureRows.filter(r => r.identity.sessionId === DEGRADED_SESSION).length,
        beforeFrontier: failureRows.filter(r => r.sessionSideContext.beforeLosslessFrontier).length,
        afterFrontier: failureRows.filter(r => r.sessionSideContext.afterLosslessFrontier).length,
      },
      controls: {
        total: controlRows.filter(r => r.identity.sessionId === DEGRADED_SESSION).length,
        beforeFrontier: controlRows.filter(r => r.sessionSideContext.beforeLosslessFrontier).length,
        afterFrontier: controlRows.filter(r => r.sessionSideContext.afterLosslessFrontier).length,
      },
    },
  };

  const tracerValidation = {
    source: 'G.propose vs independentTrace',
    notCapTrace: true,
    incidents: { railsCompared: lab.validations.length, divergences: lab.divergenceCount, ok: lab.tracerOk },
    capsuleRailsCompared: compared,
    capsuleDivergences: divergencesTotal,
    capsuleOk: divergencesTotal === 0,
    noToleranceAddedAfterObservation: true,
    divergenceExamples,
    controlsCompared: controlRows.length,
    failuresCompared: failureRows.length,
  };

  const artifact = {
    format: 'banane-running-surface-failure-replication-v2-capsule',
    nature: 'offline-independent-tracer-read-only-on-research-capsule',
    notPropose: true,
    notCapTrace: true,
    captureFromPayloadRole: 'concatène chunks.points + visibleByClipBoxes dans l’ordre des chunkRefs ; pose rails[side]=railInitialState ; ne calcule aucune métrique Running Surface',
    capsuleId: CAPSULE_ID,
    capsuleCommit: '52d4f529557641dd34d1c2296722e937c48702d0',
    tracerSourceCommit: '4e7a546a1e5394686deb6c61fa691a601632554f',
    engineReferenceV46: 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3',
    reasonStudied: REASON_RUNNING,
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified',
    archivesExpected: ARCHIVES,
    capsuleVerify: {
      rails: rails.length, failures: failures.length, controls: controls.length,
      shards: manifest.shards.length,
      deterministicSha256: manifest.deterministicSha256,
      humanScan,
    },
    constants: { defaults: { ...G.DEFAULTS }, literals: LITERALS, note: 'aucune constante n’est un réglage de ce lot' },
    hashes,
    blocks: { humanFreeBlocks: HUMAN_FREE, isolatedObservationalBlock: 'postHocEvaluation' },
    identityLock,
    tracerValidation,
    witnessMethod: witnesses.method,
    population: {
      field63Traced: failureRows.length,
      controlsTraced: controlRows.length,
      byArchiveFailures: countBy(failureRows, r => r.identity.archive),
      byArchiveControls: countBy(controlRows, r => r.identity.archive),
      bySessionFailures: countBy(failureRows, r => r.identity.sessionId),
      bySessionControls: countBy(controlRows, r => r.identity.sessionId),
      bySideFailures: countBy(failureRows, r => r.identity.side),
      bySideControls: countBy(controlRows, r => r.identity.side),
      witnesses: witnesses.tiers,
      distinctWitnesses: witnesses.distinctWitnesses,
    },
    incidentsLab: { present: lab.present, captureCount: lab.captureCount, railCount: lab.validations.length, tracerOk: lab.tracerOk, divergenceCount: lab.divergenceCount, validations: lab.validations },
    answers,
    families,
    controlFamilies,
    failureRows,
    controlRows,
    generatedAt: new Date().toISOString(),
  };
  const { generatedAt, sha256, ...cover } = artifact;
  artifact.sha256Covers = Object.keys(cover).sort();
  artifact.sha256 = sha256Obj(cover);
  artifact.summary = {
    field63Traced: failureRows.length,
    controlsTraced: controlRows.length,
    families,
    controlFamilies,
    witnesses: witnesses.tiers,
    questions: { q1, q2, q3, q4, q5, exclusiveSum: q1 + q2 + q3 + q4 + q5 },
    motifs,
    tracerDivergences: lab.divergenceCount + divergencesTotal,
    capsuleOk: divergencesTotal === 0,
  };
  return artifact;
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--output');
  const out = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, 'audit/running-surface-failure-replication-v2-capsule.json');
  const A = build();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(A, null, 1));
  process.stdout.write(JSON.stringify({
    output: out, sha256: A.sha256,
    field63Traced: A.population.field63Traced,
    controlsTraced: A.population.controlsTraced,
    families: A.summary.families,
    questions: A.summary.questions,
    witnesses: A.summary.witnesses,
    incidentsOk: A.incidentsLab.tracerOk,
    capsuleOk: A.summary.capsuleOk,
    divergences: A.summary.tracerDivergences,
  }, null, 2) + '\n');
}

module.exports = {
  LITERALS, HUMAN_FREE, REASON_RUNNING, SESSION_17, DEGRADED_SESSION, ARCHIVES,
  LOSSLESS_FRONTIER_VISIT_INDEX, EXPECTED_CAPSULE_SHA,
  independentTrace, validateAgainstPropose, runIncidentsLab, loadCgdFailures,
  selectWitnesses, classifyMechanism, captureFromPayload: Cap.captureFromPayload,
  build, frozenHashes,
};
if (require.main === module) main();
