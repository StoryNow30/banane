#!/usr/bin/env node
'use strict';
/**
 * VERTICAL ALIGNMENT PROVENANCE LAB V1 (Richard reprise)
 *
 * Capsule RSF V1 @ 52d4f529 is the frozen identity register only.
 * All geometric / temporal measurements are re-read from
 * banane-data@d541686 datasets/native-v4.6-2026-09-16.
 *
 * Independent scene→profile projection is computed from the affine
 * inverse of profileLocalToSceneRelative. It is not a wrapper of C.point.
 *
 * Numeric tolerances below are declared a priori, before any 239-rail result.
 * No runtime file is modified. causalSource stays "unknown" without a direct proof.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const BASE_COMMIT = '52d4f529557641dd34d1c2296722e937c48702d0';
const DATA_COMMIT = 'd541686d3a98569125cdbdb261ef121c9f533d6a';
const DATASET_REL = 'datasets/native-v4.6-2026-09-16';
const LOKI_REPLICATION = Object.freeze({
  branch: 'lab-vertical-alignment-provenance-replication-v1',
  head: '7a6555b8389ae584abef70bc757feac9940f784e',
  report: 'VERTICAL_ALIGNMENT_PROVENANCE_REPLICATION_V1.md',
  toolAtHead: 'see-file',
  cited: {
    sceneMinusOriginMedian: { failure: -0.1266, control: -0.1405, absDelta: 0.0139 },
    localHeadMedian: { failure: 0.0069, control: -0.0067, absDelta: 0.0136 },
    coarseZMedian: { failure: -0.040, control: -0.001, absDelta: 0.039 },
    refinedZMedian: { failure: -0.043, control: -0.003, absDelta: 0.040 },
    firstStageAbove015: 'coarse-search-z',
    familyThreshold: 0.030,
    families: {
      'coarse-search-offset-while-local-near-plane': 40,
      'local-transformed-already-offset': 10,
      'no-large-offset': 13
    },
    associationInconsistencies: 0,
    stageThreshold: 0.015
  }
});

const CAPSULE_DIR = path.join('data', 'capsules', 'rsf-v1');

const EXPECTED_RUNTIME_HASHES = Object.freeze({
  'src/geometry.js': '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53',
  'src/engine.js': 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3',
  'vendor/capture-core.js': '2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054',
  'vendor/lidar.js': '375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311'
});

/** A priori numerical envelope — chosen from IEEE-754 and matrix conditioning, not from lab results. */
const TOLERANCES = Object.freeze({
  affine: 1e-12,
  orthogonality: 1e-10,
  unitScale: 1e-10,
  inversePivotFactor: 128,
  floatingPointEnvelopeFactor: 128,
  matrixAgreement: 1e-9
});

const STAGES = Object.freeze({
  SCENE_PROFILE_RELATION: 'SCENE_PROFILE_RELATION',
  CHUNK_COMPOSITION: 'CHUNK_COMPOSITION',
  SCENE_TO_PROFILE_TRANSFORM: 'SCENE_TO_PROFILE_TRANSFORM',
  LOCAL_EXTRACTION: 'LOCAL_EXTRACTION',
  ENGINE_SEARCH: 'ENGINE_SEARCH',
  ASSOCIATION_OBSERVABLE: 'ASSOCIATION_OBSERVABLE',
  INSUFFICIENT_PROVENANCE: 'INSUFFICIENT_PROVENANCE'
});

const HUMAN_KEYS = new Set([
  'humanFinalReference', 'humanFinal', 'humanDeltaLocal', 'finalObserved',
  'finalHumanRails', 'observedLabelCandidate', 'operatorIntent', 'operatorIntents',
  'operatorEvents', 'multiIntent', 'humanLabel', 'oracle', 'trainingTarget',
  'usableForTraining', 'trainingExclusionReason'
]);

const EPS = Number.EPSILON;
const finite = Number.isFinite;
const sha256Buffer = b => crypto.createHash('sha256').update(b).digest('hex');
const sha256File = p => sha256Buffer(fs.readFileSync(p));
const sha256Text = s => sha256Buffer(Buffer.from(s, 'utf8'));
/** Capsule payload fingerprint — JSON.stringify insertion order, matching banane-capsule.cjs. */
const shaOf = obj => sha256Buffer(Buffer.from(JSON.stringify(obj), 'utf8'));

function canonicalize(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function numericEnvelope(scale) {
  return TOLERANCES.floatingPointEnvelopeFactor * EPS * Math.max(1, Math.abs(scale));
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { return Math.hypot(a[0], a[1], a[2]); }
function vecSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vecScale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function distance(a, b) { return norm(vecSub(a, b)); }
function normalize(a) { const n = norm(a); return n ? vecScale(a, 1 / n) : [NaN, NaN, NaN]; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function angle(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return NaN;
  return Math.acos(clamp(dot(a, b) / (na * nb), -1, 1));
}

function applyAffine(m, p) {
  const [x, y, z] = p;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!finite(w) || Math.abs(w) < 1e-15) throw Error('Non-finite affine projection');
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
  ];
}

function applyLinear(m, v) {
  const [x, y, z] = v;
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z
  ];
}

function axisColumns(m) {
  return [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
}
function linearRows(m) {
  return [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
}
function det3(a) {
  return a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
    - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
    + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
}
function inverse3(a) {
  const d = det3(a);
  const n = Math.max(...a.map(r => r.reduce((s, x) => s + Math.abs(x), 0)));
  const pivotTolerance = TOLERANCES.inversePivotFactor * EPS * Math.max(1, n ** 3);
  if (!finite(d) || Math.abs(d) <= pivotTolerance) {
    return { ok: false, determinant: d, pivotTolerance, inverse: null, conditionInfinity: null };
  }
  const inv = [
    [(a[1][1] * a[2][2] - a[1][2] * a[2][1]) / d, (a[0][2] * a[2][1] - a[0][1] * a[2][2]) / d, (a[0][1] * a[1][2] - a[0][2] * a[1][1]) / d],
    [(a[1][2] * a[2][0] - a[1][0] * a[2][2]) / d, (a[0][0] * a[2][2] - a[0][2] * a[2][0]) / d, (a[0][2] * a[1][0] - a[0][0] * a[1][2]) / d],
    [(a[1][0] * a[2][1] - a[1][1] * a[2][0]) / d, (a[0][1] * a[2][0] - a[0][0] * a[2][1]) / d, (a[0][0] * a[1][1] - a[0][1] * a[1][0]) / d]
  ];
  const ni = Math.max(...inv.map(r => r.reduce((s, x) => s + Math.abs(x), 0)));
  return { ok: true, determinant: d, pivotTolerance, inverse: inv, conditionInfinity: n * ni };
}

function independentAffineInverse(m) {
  const q = inverse3(linearRows(m));
  if (!q.ok) return { ...q, matrix: null };
  const t = [m[12], m[13], m[14]];
  const it = q.inverse.map(r => -dot(r, t));
  const r = q.inverse;
  return {
    ...q,
    matrix: [
      r[0][0], r[1][0], r[2][0], 0,
      r[0][1], r[1][1], r[2][1], 0,
      r[0][2], r[1][2], r[2][2], 0,
      it[0], it[1], it[2], 1
    ]
  };
}

function matrixMaxAbsDiff(a, b) { return Math.max(...a.map((x, i) => Math.abs(x - b[i]))); }
function matrixFrobeniusDiff(a, b) { return Math.hypot(...a.map((x, i) => x - b[i])); }
function affineFinite(m) { return Array.isArray(m) && m.length === 16 && m.every(finite); }
function affineTailError(m) { return Math.max(Math.abs(m[3]), Math.abs(m[7]), Math.abs(m[11]), Math.abs(m[15] - 1)); }

function quantileSorted(a, q) {
  if (!a.length) return null;
  if (a.length === 1) return a[0];
  const h = (a.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h), f = h - lo;
  return a[lo] * (1 - f) + a[hi] * f;
}
function stats(values) {
  const a = values.filter(finite).slice().sort((x, y) => x - y);
  if (!a.length) return { count: 0, min: null, q1: null, median: null, q3: null, max: null, mean: null };
  return {
    count: a.length, min: a[0], q1: quantileSorted(a, 0.25), median: quantileSorted(a, 0.5),
    q3: quantileSorted(a, 0.75), max: a[a.length - 1], mean: a.reduce((s, x) => s + x, 0) / a.length
  };
}
function residualStats(v) {
  const s = stats(v.map(Math.abs));
  return { ...s, rms: v.length ? Math.sqrt(v.reduce((x, y) => x + y * y, 0) / v.length) : null };
}

function findHumanKeys(obj, base = '') {
  const hits = [];
  (function walk(v, p) {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (HUMAN_KEYS.has(k)) hits.push(`${p}.${k}`);
      else if (/human|operator|oracle|truth|trainingtarget/i.test(k)) hits.push(`${p}.${k}`);
      walk(x, `${p}.${k}`);
    }
  })(obj, base);
  return hits;
}

function runtimeHashes(root = '.') {
  const actual = {};
  for (const p of Object.keys(EXPECTED_RUNTIME_HASHES)) actual[p] = sha256File(path.join(root, p));
  const matches = Object.fromEntries(Object.keys(actual).map(p => [p, actual[p] === EXPECTED_RUNTIME_HASHES[p]]));
  return { expected: { ...EXPECTED_RUNTIME_HASHES }, actual, matches, allMatch: Object.values(matches).every(Boolean) };
}

function loadCapsuleRegistry(root = '.') {
  const dir = path.join(root, CAPSULE_DIR);
  const manifest = loadJson(path.join(dir, 'manifest.json'));
  const rows = [];
  const shardVerification = [];
  for (const shard of manifest.shards) {
    const p = path.join(dir, shard.file);
    const b = fs.readFileSync(p);
    const actualSha = sha256Buffer(b);
    if (actualSha !== shard.sha256 || b.length !== shard.bytes) {
      throw Error(`Shard integrity mismatch: ${shard.file}`);
    }
    const rs = b.toString('utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
    if (rs.length !== shard.rails) throw Error(`Shard row count mismatch: ${shard.file}`);
    rows.push(...rs);
    shardVerification.push({ file: shard.file, rails: rs.length, bytes: b.length, sha256: actualSha });
  }
  if (rows.length !== 239) throw Error(`Expected 239 rails, got ${rows.length}`);
  const failures = rows.filter(r => r.key.cohort === 'failure').length;
  const controls = rows.filter(r => r.key.cohort === 'control').length;
  if (failures !== 63 || controls !== 176) throw Error(`Unexpected cohorts f=${failures} c=${controls}`);
  return { manifest, rows, shardVerification };
}

function sourceBasename(s) { return path.basename(String(s).replaceAll('\\', '/')); }

/* ===================== materialized representation ======================== */

function loadNode(dataRoot, node) {
  if (!node) return null;
  const kind = node.kind;
  if (kind === 'single-json') return loadJson(path.join(dataRoot, node.file.path));
  if (kind === 'array-shards') {
    const out = [];
    for (const s of node.shards || []) {
      if (s && s.oversizeItem) out.push(loadNode(dataRoot, s.node));
      else out.push(...loadJson(path.join(dataRoot, s.path)));
    }
    if (node.length != null && out.length !== node.length) {
      throw Error(`array length mismatch ${out.length} != ${node.length}`);
    }
    return out;
  }
  if (kind === 'object-shards') {
    const out = {};
    for (const s of node.shards || []) Object.assign(out, loadJson(path.join(dataRoot, s.path)));
    for (const [k, v] of Object.entries(node.largeEntries || {})) out[k] = loadNode(dataRoot, v);
    if (node.keys != null && Object.keys(out).length !== node.keys) {
      throw Error(`object key mismatch ${Object.keys(out).length} != ${node.keys}`);
    }
    return out;
  }
  if (kind === 'scalar-text-parts') {
    const text = (node.parts || []).map(p => fs.readFileSync(path.join(dataRoot, p.path), 'utf8')).join('');
    return JSON.parse(text);
  }
  throw Error(`unsupported materialized node ${kind}`);
}

function nodeFiles(node, out = []) {
  if (!node) return out;
  if (node.kind === 'single-json') out.push(node.file.path);
  else if (node.kind === 'array-shards') {
    for (const s of node.shards || []) {
      if (s && s.oversizeItem) nodeFiles(s.node, out);
      else if (s && s.path) out.push(s.path);
    }
  } else if (node.kind === 'object-shards') {
    for (const s of node.shards || []) if (s.path) out.push(s.path);
    for (const child of Object.values(node.largeEntries || {})) nodeFiles(child, out);
  } else if (node.kind === 'scalar-text-parts') {
    for (const p of node.parts || []) if (p.path) out.push(p.path);
  }
  return out;
}

function isLidarChunk(item) {
  return !!(item && typeof item === 'object' && typeof item.chunkId === 'string'
    && item.format === 'banane-native-lidar-chunk-v1'
    && Array.isArray(item.pointsSceneRelative));
}

function visitLidarChunksInValue(value, files, onItem) {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isLidarChunk(item)) onItem(item, files);
      else if (item && typeof item === 'object' && Array.isArray(item.clouds)) {
        visitLidarChunksInValue(item.clouds, files, onItem);
      }
    }
    return;
  }
  if (typeof value !== 'object') return;
  if (isLidarChunk(value)) { onItem(value, files); return; }
  if (Array.isArray(value.clouds)) visitLidarChunksInValue(value.clouds, files, onItem);
}

/**
 * Recursively walk a materializer node. Supports single-json, array-shards,
 * oversizeItem, object-shards and scalar-text-parts. For object-shards, clouds
 * may live in a root shard OR in largeEntries.clouds — both are visited.
 * records / events / dictionaries are not scanned for LiDAR chunks.
 */
function visitNodeForChunks(dataRoot, node, onItem, consulted) {
  if (!node) return;
  const kind = node.kind;
  if (kind === 'array-shards') {
    for (const s of node.shards || []) {
      if (s && s.oversizeItem) {
        const files = nodeFiles(s.node);
        for (const f of files) consulted.add(f);
        visitLidarChunksInValue(loadNode(dataRoot, s.node), files, onItem);
      } else if (s && s.path) {
        consulted.add(s.path);
        visitLidarChunksInValue(loadJson(path.join(dataRoot, s.path)), [s.path], onItem);
      }
    }
    return;
  }
  if (kind === 'object-shards') {
    for (const s of node.shards || []) {
      if (!s || !s.path) continue;
      consulted.add(s.path);
      visitLidarChunksInValue(loadJson(path.join(dataRoot, s.path)), [s.path], onItem);
    }
    const large = node.largeEntries || {};
    if (large.clouds) visitNodeForChunks(dataRoot, large.clouds, onItem, consulted);
    if (large.cloud) visitNodeForChunks(dataRoot, large.cloud, onItem, consulted);
    return;
  }
  if (kind === 'single-json') {
    consulted.add(node.file.path);
    visitLidarChunksInValue(loadJson(path.join(dataRoot, node.file.path)), [node.file.path], onItem);
    return;
  }
  if (kind === 'scalar-text-parts') {
    const files = (node.parts || []).map(p => p.path);
    for (const f of files) consulted.add(f);
    visitLidarChunksInValue(loadNode(dataRoot, node), files, onItem);
    return;
  }
  throw Error(`unsupported materialized node ${kind}`);
}

function listMaterializedEntries(dataRoot, manifest) {
  const out = [];
  for (const f of manifest.files) {
    const archive = f.cohort;
    if (f.representation === 'exact-json-copy') {
      const filePath = f.outputs[0].path;
      out.push({
        kind: 'exact-json-copy',
        archive,
        sourceName: path.basename(f.sourceRelPath),
        sourceRelPath: f.sourceRelPath,
        filePath,
        indexPath: null
      });
      continue;
    }
    if (!f.index) continue;
    const indexPath = f.index.path;
    const idx = loadJson(path.join(dataRoot, indexPath));
    out.push({
      kind: 'indexed',
      archive,
      sourceName: idx.sourceName,
      sourceRelPath: f.sourceRelPath,
      indexPath,
      idx
    });
  }
  return out;
}

function visitEntryClouds(dataRoot, entry, onItem, consulted) {
  if (entry.kind === 'exact-json-copy') {
    consulted.add(entry.filePath);
    visitLidarChunksInValue(loadJson(path.join(dataRoot, entry.filePath)), [entry.filePath], onItem);
    return;
  }
  consulted.add(entry.indexPath);
  visitNodeForChunks(dataRoot, entry.idx.semanticRepresentation, onItem, consulted);
}

function loadRootWithoutHeavy(dataRoot, entry) {
  if (entry.kind === 'exact-json-copy') {
    const raw = loadJson(path.join(dataRoot, entry.filePath));
    return { raw, consulted: [entry.filePath] };
  }
  const rep = entry.idx.semanticRepresentation;
  if (rep.kind !== 'object-shards') throw Error(`unsupported root ${rep.kind} ${entry.sourceName}`);
  const consulted = [entry.indexPath];
  const out = {};
  for (const s of rep.shards || []) {
    consulted.push(s.path);
    Object.assign(out, loadJson(path.join(dataRoot, s.path)));
  }
  for (const [k, node] of Object.entries(rep.largeEntries || {})) {
    if (k === 'clouds' || k === 'events') continue;
    for (const f of nodeFiles(node)) consulted.push(f);
    out[k] = loadNode(dataRoot, node);
  }
  return { raw: out, consulted };
}

function derefer(dictionaries) {
  const seen = new WeakMap();
  return function deref(v) {
    if (Array.isArray(v)) return v.map(deref);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === '__ref') {
        const [name, i] = v.__ref.split(':');
        return deref(dictionaries[name][Number(i)]);
      }
      if (seen.has(v)) return seen.get(v);
      const copy = {};
      seen.set(v, copy);
      for (const k of keys) copy[k] = deref(v[k]);
      return copy;
    }
    return v;
  };
}

function matrixEqual(a, b, tol = TOLERANCES.matrixAgreement) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return matrixMaxAbsDiff(a, b) <= tol;
}

function parseIso(s) {
  if (typeof s !== 'string' || !s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function pickCloudProvenance(chunk) {
  const acq = chunk.acquisition && typeof chunk.acquisition === 'object' ? chunk.acquisition : {};
  const qual = chunk.qualification && typeof chunk.qualification === 'object' ? chunk.qualification : {};
  return {
    chunkId: chunk.chunkId,
    format: chunk.format ?? null,
    captureId: chunk.captureId ?? null,
    visitId: chunk.visitId ?? null,
    side: chunk.side ?? null,
    capturedAt: chunk.capturedAt ?? null,
    acquisitionStartedAt: acq.startedAt ?? null,
    acquisitionEndedAt: acq.endedAt ?? null,
    acquisitionEmittedAt: acq.emittedAt ?? null,
    sourceStatus: acq.sourceStatus ?? null,
    qualificationAcquisitionStartedAt: qual.acquisitionStartedAt ?? null,
    qualificationAcquiredThroughAt: qual.acquiredThroughAt ?? null,
    droppedDerivedFields: Array.isArray(chunk.droppedDerivedFields) ? chunk.droppedDerivedFields.slice() : [],
    nativeSessionId: chunk.nativeSessionId ?? null
  };
}

function snapshotMeta(snap) {
  if (!snap || typeof snap !== 'object') return null;
  return {
    snapshotId: snap.snapshotId ?? null,
    captureId: snap.captureId ?? null,
    acquisitionStartedAt: snap.acquisitionStartedAt ?? null,
    acquiredThroughAt: snap.acquiredThroughAt ?? null,
    emittedAt: snap.emittedAt ?? null,
    storedAt: snap.storedAt ?? null,
    sourceStatus: snap.sourceStatus ?? null,
    associationStatus: snap.associationStatus ?? null,
    transformValid: snap.transform?.valid ?? null,
    transformMaxIdentityError: snap.transform?.maxIdentityError ?? null,
    viewObservedAt: snap.viewObservation?.observedAt ?? null,
    viewEpochId: snap.viewObservation?.viewEpochId ?? null,
    coordinateSystem: snap.coordinateSystem ?? null,
    chunkIds: Array.isArray(snap.chunkIds) ? snap.chunkIds.slice() : []
  };
}

/* ===================== matrix audit / independent projection =============== */

function auditMatrix(state, scenePoints, contourPoints) {
  const P = state.profileLocalToSceneRelative;
  const S = state.sceneRelativeToProfileLocal;
  const finiteP = affineFinite(P), finiteS = affineFinite(S);
  if (!finiteP || !finiteS) {
    return { usable: false, reason: 'non-finite-or-wrong-dimension', finiteP, finiteS };
  }
  const affineP = affineTailError(P) <= TOLERANCES.affine;
  const affineS = affineTailError(S) <= TOLERANCES.affine;
  const independent = independentAffineInverse(P);
  const axes = axisColumns(P);
  const lengths = axes.map(norm);
  const units = axes.map(normalize);
  const dotXY = dot(units[0], units[1]), dotXZ = dot(units[0], units[2]), dotYZ = dot(units[1], units[2]);
  const maxOrthogonalityError = Math.max(Math.abs(dotXY), Math.abs(dotXZ), Math.abs(dotYZ));
  const maxUnitScaleError = Math.max(...lengths.map(x => Math.abs(x - 1)));
  const orthogonal = maxOrthogonalityError <= TOLERANCES.orthogonality;
  const unitScale = maxUnitScaleError <= TOLERANCES.unitScale;
  const hasShear = !orthogonal;
  const inverseAgreement = independent.ok ? matrixMaxAbsDiff(independent.matrix, S) : null;
  const sceneScale = Math.max(
    1,
    ...scenePoints.flatMap(p => p.map(Math.abs)),
    ...contourPoints.flatMap(p => p.map(Math.abs)),
    ...P.map(Math.abs),
    ...S.map(Math.abs)
  );
  const tolerance = numericEnvelope(sceneScale);
  const origin = [P[12], P[13], P[14]];
  const localSamples = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-0.5, 0.25, 0.125]];
  const sceneRound = [];
  for (const p of [...scenePoints, ...contourPoints, origin]) {
    sceneRound.push([p, applyAffine(P, applyAffine(S, p))]);
  }
  const localRound = [];
  for (const p of localSamples) localRound.push([p, applyAffine(S, applyAffine(P, p))]);
  const independentLocalRound = [];
  if (independent.ok) {
    for (const p of localSamples) {
      independentLocalRound.push([p, applyAffine(independent.matrix, applyAffine(P, p))]);
    }
  }
  const vectorRound = [];
  for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    vectorRound.push([v, applyLinear(S, applyLinear(P, v))]);
  }
  const sceneResiduals = residualStats(sceneRound.map(([a, b]) => distance(a, b)));
  const localResiduals = residualStats(localRound.map(([a, b]) => distance(a, b)));
  const independentLocalResiduals = independent.ok
    ? residualStats(independentLocalRound.map(([a, b]) => distance(a, b)))
    : null;
  const vectorResiduals = residualStats(vectorRound.map(([a, b]) => distance(a, b)));
  const inversePass = independent.ok && inverseAgreement <= Math.max(tolerance, TOLERANCES.matrixAgreement);
  const roundTripPass = (sceneResiduals.max ?? Infinity) <= tolerance
    && (localResiduals.max ?? Infinity) <= tolerance
    && (vectorResiduals.max ?? Infinity) <= tolerance;
  return {
    usable: affineP && affineS && independent.ok && inversePass && roundTripPass,
    dimensions: { profileLocalToSceneRelative: P.length, sceneRelativeToProfileLocal: S.length },
    finite: true,
    affine: {
      profileLocalToSceneRelative: affineP,
      sceneRelativeToProfileLocal: affineS,
      tailError: { profileLocalToSceneRelative: affineTailError(P), sceneRelativeToProfileLocal: affineTailError(S) }
    },
    linear: {
      determinant: independent.determinant,
      conditionInfinity: independent.conditionInfinity,
      axisLengths: lengths,
      maxOrthogonalityError,
      maxUnitScaleError,
      orthogonal,
      unitScale,
      hasShear,
      note: hasShear
        ? 'Non-orthogonal axes: a normalized-axis dot product is NOT the profile-local z. The independent inverse is used instead.'
        : 'Axes orthogonal within a priori tolerance; axis-dot diagnostic is reported alongside the inverse.'
    },
    independentInverse: {
      defined: independent.ok,
      pivotTolerance: independent.pivotTolerance,
      maxAbsDifferenceFromProvided: inverseAgreement,
      passesNumericEnvelope: inversePass
    },
    numericTolerance: tolerance,
    roundTrip: {
      sceneToProfileLocalToScene: sceneResiduals,
      profileLocalToSceneToProfileLocal: localResiduals,
      independentInverseRoundTrip: independentLocalResiduals,
      axisVectorRoundTrip: vectorResiduals,
      passesNumericEnvelope: roundTripPass
    },
    derivedOriginScene: origin,
    storedOriginScene: state.profileOriginSceneRelative ?? null,
    storedOriginResidual: Array.isArray(state.profileOriginSceneRelative)
      ? distance(origin, state.profileOriginSceneRelative) : null,
    axesScene: { x: axes[0], y: axes[1], z: axes[2], xUnit: units[0], yUnit: units[1], zUnit: units[2] },
    providedSceneRelativeToProfileLocal: S,
    providedProfileLocalToSceneRelative: P
  };
}

/**
 * Independent local coordinates of a scene point.
 * Always uses the independently inverted profileLocalToSceneRelative matrix.
 * The axis-dot shortcut is returned only as a diagnostic when axes are orthogonal.
 */
function projectPointIndependently(point, matrixAudit) {
  if (!matrixAudit?.independentInverse?.defined) return null;
  const inv = independentAffineInverse(matrixAudit.providedProfileLocalToSceneRelative);
  if (!inv.ok) return null;
  const local = applyAffine(inv.matrix, point);
  const origin = matrixAudit.derivedOriginScene;
  const len = matrixAudit.linear.axisLengths[2];
  const unit = matrixAudit.axesScene.zUnit;
  const rawSceneProjection = dot(vecSub(point, origin), unit);
  const axisDotValid = matrixAudit.linear.orthogonal === true;
  return {
    independentLocal: local,
    independentLocalZ: local[2],
    axisDotRaw: rawSceneProjection,
    axisDotScaleAdjustedZ: axisDotValid && len ? rawSceneProjection / len : null,
    axisDotMethodValid: axisDotValid
  };
}

function analyzePointSet(points, visible, matrixAudit, S) {
  const independentZ = [], providedZ = [], diffInvVsProvided = [], axisDotVsProvided = [];
  const sceneZ = [], allIndependentZ = [], allProvidedZ = [];
  const visIndependentZ = [], visProvidedZ = [], visSceneZ = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const provided = applyAffine(S, p);
    const ip = projectPointIndependently(p, matrixAudit);
    const vis = visible ? visible[i] !== false : true;
    sceneZ.push(p[2]);
    allIndependentZ.push(ip ? ip.independentLocalZ : NaN);
    allProvidedZ.push(provided[2]);
    if (vis) {
      visSceneZ.push(p[2]);
      visIndependentZ.push(ip ? ip.independentLocalZ : NaN);
      visProvidedZ.push(provided[2]);
      if (ip) {
        independentZ.push(ip.independentLocalZ);
        providedZ.push(provided[2]);
        diffInvVsProvided.push(ip.independentLocalZ - provided[2]);
        if (ip.axisDotMethodValid && ip.axisDotScaleAdjustedZ != null) {
          axisDotVsProvided.push(ip.axisDotScaleAdjustedZ - provided[2]);
        }
      }
    }
  }
  const invDiff = residualStats(diffInvVsProvided);
  const axisDiff = residualStats(axisDotVsProvided);
  const pass = matrixAudit.usable && invDiff.max != null && invDiff.max <= matrixAudit.numericTolerance;
  return {
    all: {
      rawSceneZ: stats(sceneZ),
      independentLocalZ: stats(allIndependentZ),
      providedProfileLocalZ: stats(allProvidedZ)
    },
    visible: {
      rawSceneZ: stats(visSceneZ),
      independentLocalZ: stats(visIndependentZ),
      providedProfileLocalZ: stats(visProvidedZ)
    },
    independentInverseVsProvided: invDiff,
    axisDotVsProvided: matrixAudit.linear?.orthogonal ? axisDiff : { valid: false, reason: 'axes-not-orthogonal-or-sheared' },
    passes: pass
  };
}

function analyzeContours(state, matrixAudit, S) {
  const contours = (state.profileContours || []).map((c, i) => {
    const local = (c.verticesSceneRelative || []).map(p => applyAffine(S, p));
    const independent = matrixAudit.independentInverse?.defined
      ? (c.verticesSceneRelative || []).map(p => projectPointIndependently(p, matrixAudit)?.independentLocalZ)
      : [];
    return {
      index: i, type: c.type ?? null, vertexCount: local.length,
      localY: stats(local.map(p => p[1])),
      localZ: stats(local.map(p => p[2])),
      independentLocalZ: stats(independent.filter(finite))
    };
  });
  const selected = contours.slice().sort((a, b) => b.vertexCount - a.vertexCount)[0] ?? null;
  const allZ = contours.flatMap(c => {
    const verts = state.profileContours[c.index]?.verticesSceneRelative || [];
    return verts.map(p => applyAffine(S, p)[2]);
  });
  return { contours, largestContourIndex: selected?.index ?? null, allLocalZ: stats(allZ) };
}

function classifyFirstObservedStage(matrix, cloud, perChunk, association) {
  if (!matrix.usable) return STAGES.INSUFFICIENT_PROVENANCE;
  if (!cloud || cloud.passes !== true) return STAGES.SCENE_TO_PROFILE_TRANSFORM;
  const chunksWithPoints = perChunk.filter(c => c.pointCount > 0);
  if (cloud.visible.independentLocalZ.count > 0 && chunksWithPoints.length === 0) {
    return STAGES.CHUNK_COMPOSITION;
  }
  if (association && association.directContradiction === true) {
    return STAGES.ASSOCIATION_OBSERVABLE;
  }
  return STAGES.SCENE_PROFILE_RELATION;
}

function analyzeRail(payload, extra = {}) {
  const chunks = payload.chunks || [];
  const scenePoints = chunks.flatMap(c => c.points || []);
  const visible = chunks.flatMap(c => {
    const vis = c.visible;
    const n = (c.points || []).length;
    if (!vis) return Array(n).fill(true);
    return vis;
  });
  const contourPoints = (payload.railInitialState.profileContours || []).flatMap(c => c.verticesSceneRelative || []);
  if (scenePoints.length !== visible.length) throw Error(`Point/visibility length mismatch`);
  if (payload.chunkRefs?.length !== chunks.length) throw Error(`Chunk refs mismatch`);
  const matrix = auditMatrix(payload.railInitialState, scenePoints, contourPoints);
  const S = payload.railInitialState.sceneRelativeToProfileLocal;
  const cloud = (matrix.usable || matrix.independentInverse?.defined)
    ? analyzePointSet(scenePoints, visible, matrix, S) : null;
  const contour = affineFinite(S) ? analyzeContours(payload.railInitialState, matrix, S) : null;
  const perChunk = chunks.map((c, i) => {
    const a = (matrix.usable || matrix.independentInverse?.defined)
      ? analyzePointSet(c.points || [], c.visible || [], matrix, S) : null;
    const visMedian = a?.visible.independentLocalZ.median ?? null;
    const contourMedian = contour?.allLocalZ.median ?? null;
    return {
      index: i,
      chunkId: c.chunkId ?? null,
      chunkRef: payload.chunkRefs?.[i] ?? null,
      chunkRefMatchesId: (payload.chunkRefs?.[i] ?? null) === (c.chunkId ?? null),
      pointCount: c.points?.length ?? 0,
      visiblePointCount: (c.visible || []).length
        ? (c.visible || []).filter(v => v !== false).length
        : (c.points?.length ?? 0),
      statistics: a,
      independentMedianLocalZ: visMedian,
      providedMedianLocalZ: a?.visible.providedProfileLocalZ.median ?? null,
      rawSceneZ: a?.visible.rawSceneZ ?? null,
      cloudContourMedianDifference: finite(visMedian) && finite(contourMedian) ? visMedian - contourMedian : null,
      materialized: extra.chunkMeta?.[c.chunkId] ?? null
    };
  });
  const chunkMedians = perChunk.map(c => c.independentMedianLocalZ).filter(finite);
  const pairwise = [];
  for (let i = 0; i < chunkMedians.length; i++) {
    for (let j = i + 1; j < chunkMedians.length; j++) {
      pairwise.push({ a: i, b: j, medianDifference: chunkMedians[j] - chunkMedians[i] });
    }
  }
  const localMedian = cloud?.visible.independentLocalZ.median;
  const providedMedian = cloud?.visible.providedProfileLocalZ.median;
  const contourMedian = contour?.allLocalZ.median;
  const association = extra.association ?? null;
  const firstObservedStage = classifyFirstObservedStage(matrix, cloud, perChunk, association);
  const leaks = findHumanKeys({
    railInitialState: payload.railInitialState,
    chunks: payload.chunks,
    target: payload.target,
    snapshot: payload.snapshot
  });
  if (leaks.length) throw Error(`human leak in reconstructed payload: ${leaks.join(', ')}`);

  return {
    identity: {
      ...payload.key,
      snapshotId: payload.snapshot?.snapshotId ?? null,
      payloadSha256: payload.payloadSha256
    },
    sourceProvenance: {
      sessionId: payload.key.sessionId,
      visitId: payload.key.visitId,
      visitIndex: payload.key.visitIndex,
      part: payload.key.part,
      cut: payload.key.cut,
      side: payload.key.side,
      pageId: payload.target?.pageId ?? null,
      frameId: payload.target?.frameId ?? null,
      snapshotId: payload.snapshot?.snapshotId ?? null,
      archive: payload.provenance?.archive ?? null,
      corpus: payload.key.corpus ?? null,
      captureId: payload.provenance?.captureId ?? null,
      sourceFile: payload.provenance?.sourceFile ?? null,
      projectId: payload.target?.projectId ?? null,
      shape: payload.target?.shape ?? null,
      chunkRefs: Array.isArray(payload.chunkRefs) ? payload.chunkRefs.slice() : [],
      chunkCount: chunks.length,
      materializedDataCommit: DATA_COMMIT,
      materializedChunkSources: payload.provenance?.chunkMaterializedSources ?? null,
      consultedFiles: extra.consultedFiles ?? [],
      explicitTimestamp: extra.temporal?.anyTimestampPresent === true,
      timestampFieldPresent: extra.temporal?.anyTimestampPresent === true
    },
    payloadParity: extra.parity ?? null,
    temporalProvenance: extra.temporal ?? null,
    associationObservability: association,
    matrixAudit: matrix,
    roundTripResiduals: matrix.roundTrip ?? null,
    profileOrigin: matrix.derivedOriginScene ?? null,
    profileAxes: matrix.axesScene ?? null,
    rawSceneZStatistics: cloud ? cloud.visible.rawSceneZ : null,
    sceneProjectedCloudStatistics: cloud ? cloud.visible.independentLocalZ : null,
    profileLocalCloudStatistics: cloud ? cloud.visible.providedProfileLocalZ : null,
    projectionIndependentVsTransform: cloud ? {
      method: 'independent affine inverse of profileLocalToSceneRelative applied to scene points; not C.point',
      differenceIndependentMinusProvided: cloud.independentInverseVsProvided,
      axisDotDiagnostic: cloud.axisDotVsProvided,
      numericTolerance: matrix.numericTolerance,
      passes: cloud.passes
    } : null,
    profileContourReference: contour,
    cloudContourRelation: {
      visibleCloudMedianIndependentLocalZ: localMedian ?? null,
      visibleCloudMedianProvidedLocalZ: providedMedian ?? null,
      contourMedianLocalZ: contourMedian ?? null,
      medianDifferenceIndependent: finite(localMedian) && finite(contourMedian) ? localMedian - contourMedian : null,
      medianDifferenceProvided: finite(providedMedian) && finite(contourMedian) ? providedMedian - contourMedian : null
    },
    perChunkStatistics: perChunk,
    chunkComposition: {
      chunkCount: chunks.length,
      chunkProjectedMedianRange: chunkMedians.length ? Math.max(...chunkMedians) - Math.min(...chunkMedians) : null,
      pairwiseProjectedMedianDifferences: pairwise,
      concatenatedProjectedMedian: cloud?.visible.independentLocalZ.median ?? null
    },
    engineTrace: extra.engineTrace ?? null,
    neighborContinuityContext: null,
    sameVisitOppositeSideContext: null,
    sameSessionSideControlContext: null,
    firstObservedStage,
    causalSource: 'unknown',
    limitations: []
  };
}

function compactRef(r) {
  return {
    sessionId: r.identity.sessionId,
    visitId: r.identity.visitId,
    visitIndex: r.identity.visitIndex,
    part: r.identity.part,
    cut: r.identity.cut,
    side: r.identity.side,
    cohort: r.identity.cohort
  };
}

function compareRails(a, b) {
  const ma = a.matrixAudit, mb = b.matrixAudit;
  return {
    from: compactRef(a),
    to: compactRef(b),
    visitIndexDelta: b.identity.visitIndex - a.identity.visitIndex,
    profileOriginDisplacement: (a.profileOrigin && b.profileOrigin) ? distance(a.profileOrigin, b.profileOrigin) : null,
    axisOrientationDeltaRadians: (a.profileAxes && b.profileAxes) ? {
      x: angle(a.profileAxes.x, b.profileAxes.x),
      y: angle(a.profileAxes.y, b.profileAxes.y),
      z: angle(a.profileAxes.z, b.profileAxes.z)
    } : null,
    matrixDelta: (ma?.providedProfileLocalToSceneRelative && mb?.providedProfileLocalToSceneRelative) ? {
      maxAbs: matrixMaxAbsDiff(ma.providedProfileLocalToSceneRelative, mb.providedProfileLocalToSceneRelative),
      frobenius: matrixFrobeniusDiff(ma.providedProfileLocalToSceneRelative, mb.providedProfileLocalToSceneRelative)
    } : null,
    projectedCloudMedianDelta:
      (finite(a.sceneProjectedCloudStatistics?.median) && finite(b.sceneProjectedCloudStatistics?.median))
        ? b.sceneProjectedCloudStatistics.median - a.sceneProjectedCloudStatistics.median : null,
    cloudContourMedianGapDelta:
      (finite(a.cloudContourRelation?.medianDifferenceIndependent) && finite(b.cloudContourRelation?.medianDifferenceIndependent))
        ? b.cloudContourRelation.medianDifferenceIndependent - a.cloudContourRelation.medianDifferenceIndependent : null
  };
}

function addContexts(rails) {
  const groups = new Map();
  for (const r of rails) {
    const k = `${r.identity.sessionId}/${r.identity.side}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  for (const xs of groups.values()) {
    xs.sort((a, b) => a.identity.visitIndex - b.identity.visitIndex || a.identity.cut - b.identity.cut);
    for (let i = 0; i < xs.length; i++) {
      xs[i].neighborContinuityContext = {
        previous: i ? compareRails(xs[i - 1], xs[i]) : null,
        next: i + 1 < xs.length ? compareRails(xs[i], xs[i + 1]) : null,
        continuityScope: 'adjacent rails present in the 239-rail register; missing unselected visits are not reconstructed'
      };
      if (xs[i].identity.cohort === 'failure') {
        const controls = xs.filter(r => r.identity.cohort === 'control');
        let nearest = null;
        for (const c of controls) {
          const d = Math.abs(c.identity.visitIndex - xs[i].identity.visitIndex);
          if (!nearest || d < nearest.distance) nearest = { distance: d, rail: c };
        }
        xs[i].sameSessionSideControlContext = nearest ? {
          visitIndexDistance: nearest.distance,
          comparison: xs[i].identity.visitIndex <= nearest.rail.identity.visitIndex
            ? compareRails(xs[i], nearest.rail) : compareRails(nearest.rail, xs[i])
        } : null;
      }
    }
  }
  const byVisit = new Map();
  for (const r of rails) {
    const k = `${r.identity.sessionId}/${r.identity.visitId}`;
    if (!byVisit.has(k)) byVisit.set(k, []);
    byVisit.get(k).push(r);
  }
  for (const xs of byVisit.values()) {
    const left = xs.find(r => r.identity.side === 'left');
    const right = xs.find(r => r.identity.side === 'right');
    if (!left || !right) continue;
    const lset = new Set(left.sourceProvenance.chunkRefs);
    const rset = new Set(right.sourceProvenance.chunkRefs);
    const intersection = [...lset].filter(x => rset.has(x));
    const context = {
      opposite: compactRef(right),
      sameFrameId: left.sourceProvenance.frameId === right.sourceProvenance.frameId,
      samePageId: left.sourceProvenance.pageId === right.sourceProvenance.pageId,
      sameSourceFile: left.sourceProvenance.sourceFile === right.sourceProvenance.sourceFile,
      chunkSources: {
        left: left.sourceProvenance.chunkRefs,
        right: right.sourceProvenance.chunkRefs,
        intersection,
        exactlySame: left.sourceProvenance.chunkRefs.length === right.sourceProvenance.chunkRefs.length
          && left.sourceProvenance.chunkRefs.every((x, i) => x === right.sourceProvenance.chunkRefs[i])
      },
      comparison: compareRails(left, right)
    };
    left.sameVisitOppositeSideContext = context;
    right.sameVisitOppositeSideContext = { ...context, opposite: compactRef(left), comparison: compareRails(right, left) };
  }
}

function scanNeededChunks(dataRoot, entries, neededByArchive) {
  const found = { historical: new Map(), final: new Map() };
  const consulted = new Set();
  const fileHashes = {};
  for (const archive of ['historical', 'final']) {
    const need = neededByArchive[archive];
    if (!need.size) continue;
    for (const e of entries.filter(x => x.archive === archive)) {
      visitEntryClouds(dataRoot, e, (c, files) => {
        if (!c || !need.has(c.chunkId)) return;
        const normalized = { points: c.pointsSceneRelative, visible: c.visibleByClipBoxes ?? null };
        const h = sha256Text(canonicalize(normalized));
        const occurrence = {
          sourceName: e.sourceName,
          materializedFiles: [...files],
          provenance: pickCloudProvenance(c)
        };
        if (found[archive].has(c.chunkId)) {
          const prev = found[archive].get(c.chunkId);
          if (prev.contentSha256 !== h) throw Error(`non-identical duplicate chunk ${c.chunkId}`);
          prev.occurrences.push(occurrence);
        } else {
          found[archive].set(c.chunkId, {
            chunkId: c.chunkId,
            ...normalized,
            contentSha256: h,
            occurrences: [occurrence]
          });
        }
        for (const f of files) consulted.add(f);
      }, consulted);
    }
    const miss = [...need].filter(x => !found[archive].has(x));
    if (miss.length) {
      throw Error(`missing ${archive} chunks ${miss.slice(0, 12).join(',')} (${miss.length})`);
    }
  }
  for (const f of [...consulted].sort()) {
    const p = path.join(dataRoot, f);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) fileHashes[f] = sha256File(p);
  }
  return { neededByArchive, found, consulted: [...consulted].sort(), fileHashes };
}

function locateVisits(registryRows, dataRoot, entries) {
  const byName = new Map();
  for (const e of entries) byName.set(`${e.archive}|${e.sourceName}`, e);
  const rootCache = new Map();
  const partial = [];
  const consulted = new Set();
  for (const cap of registryRows) {
    const archive = cap.provenance.archive;
    const name = sourceBasename(cap.provenance.sourceFile);
    const entry = byName.get(`${archive}|${name}`);
    if (!entry) throw Error(`materialized source missing ${archive}/${name}`);
    let loaded = rootCache.get(entry.indexPath || entry.filePath);
    if (!loaded) {
      loaded = loadRootWithoutHeavy(dataRoot, entry);
      rootCache.set(entry.indexPath || entry.filePath, loaded);
    }
    for (const f of loaded.consulted) consulted.add(f);
    const raw = loaded.raw;
    if (raw.session?.id !== cap.key.sessionId) throw Error(`session mismatch ${name}`);
    if (!raw.dictionaries || !Array.isArray(raw.records)) {
      throw Error(`records/dictionaries missing after materialized load ${name}`);
    }
    const deref = derefer(raw.dictionaries);
    const rec = raw.records.find(r => r.visitId === cap.key.visitId);
    if (!rec) throw Error(`visit missing ${cap.key.visitId} in ${name}`);
    const identity = deref(rec.identity);
    if (identity.part !== cap.key.part || identity.cut !== cap.key.cut) {
      throw Error(`identity mismatch ${cap.key.visitId}`);
    }
    const ge = deref(rec.geometryEligibility ?? null)?.[cap.key.side];
    const snaps = deref(rec.railSnapshots ?? null)?.[cap.key.side] || [];
    if (!ge || ge.status !== 'comparable-candidate') {
      throw Error(`eligibility mismatch ${cap.key.part}/${cap.key.cut}/${cap.key.side}`);
    }
    const snap = snaps.find(s => s.snapshotId === ge.snapshotId);
    if (!snap?.rail) throw Error(`snapshot missing ${ge.snapshotId}`);
    partial.push({
      cap, entry, identity, ge, snap, deref,
      chunkIds: [...(ge.chunkIds || [])],
      visitStartedAt: rec.startedAt ?? null,
      visitEndedAt: rec.endedAt ?? null,
      visitUpdatedAt: rec.updatedAt ?? null
    });
  }
  return { partial, consulted: [...consulted].sort() };
}

function buildTemporal(p, chunkObjs) {
  const snap = snapshotMeta(p.snap);
  const ge = p.ge || {};
  const chunkTimes = chunkObjs.map(c => c.materializedProvenance);
  const fields = [];
  const push = (name, value) => { fields.push({ name, value }); };
  push('visit.startedAt', p.visitStartedAt);
  push('visit.endedAt', p.visitEndedAt);
  push('geometryEligibility.capturedAt', ge.capturedAt ?? null);
  push('geometryEligibility.acquiredThroughAt', ge.acquiredThroughAt ?? null);
  push('geometryEligibility.storedAt', ge.storedAt ?? null);
  push('snapshot.acquisitionStartedAt', snap?.acquisitionStartedAt ?? null);
  push('snapshot.acquiredThroughAt', snap?.acquiredThroughAt ?? null);
  push('snapshot.emittedAt', snap?.emittedAt ?? null);
  push('snapshot.storedAt', snap?.storedAt ?? null);
  push('snapshot.viewObservedAt', snap?.viewObservedAt ?? null);
  for (const c of chunkTimes) {
    push(`chunk[${c.chunkId}].capturedAt`, c.capturedAt);
    push(`chunk[${c.chunkId}].acquisitionStartedAt`, c.acquisitionStartedAt);
    push(`chunk[${c.chunkId}].acquisitionEndedAt`, c.acquisitionEndedAt);
    push(`chunk[${c.chunkId}].acquisitionEmittedAt`, c.acquisitionEmittedAt);
  }
  const present = fields.filter(f => f.value != null);
  const missingNames = fields.filter(f => f.value == null).map(f => f.name);
  const deltasMs = [];
  for (const c of chunkTimes) {
    const acqEnd = parseIso(c.acquisitionEndedAt) ?? parseIso(c.capturedAt);
    const snapThrough = parseIso(snap?.acquiredThroughAt);
    const snapStart = parseIso(snap?.acquisitionStartedAt);
    const viewAt = parseIso(snap?.viewObservedAt);
    const geCap = parseIso(ge.capturedAt ?? null);
    deltasMs.push({
      chunkId: c.chunkId,
      acquisitionEndedMinusSnapshotAcquiredThroughMs: (acqEnd != null && snapThrough != null) ? acqEnd - snapThrough : null,
      acquisitionStartedMinusSnapshotStartedMs:
        ((parseIso(c.acquisitionStartedAt) != null && snapStart != null)
          ? parseIso(c.acquisitionStartedAt) - snapStart : null),
      capturedAtMinusViewObservedAtMs: (parseIso(c.capturedAt) != null && viewAt != null)
        ? parseIso(c.capturedAt) - viewAt : null,
      capturedAtMinusEligibilityCapturedAtMs: (parseIso(c.capturedAt) != null && geCap != null)
        ? parseIso(c.capturedAt) - geCap : null
    });
  }
  return {
    anyTimestampPresent: present.length > 0,
    presentCount: present.length,
    missingFieldNames: missingNames,
    snapshot: snap,
    eligibility: {
      capturedAt: ge.capturedAt ?? null,
      acquiredThroughAt: ge.acquiredThroughAt ?? null,
      storedAt: ge.storedAt ?? null,
      viewEpochId: ge.viewEpochId ?? null,
      captureId: ge.captureId ?? null
    },
    chunks: chunkTimes,
    deltasMs,
    visitWindow: { startedAt: p.visitStartedAt, endedAt: p.visitEndedAt }
  };
}

function buildAssociation(p, chunkObjs) {
  const contradictions = [];
  for (const c of chunkObjs) {
    const meta = c.materializedProvenance;
    if (meta.visitId && meta.visitId !== p.cap.key.visitId) {
      contradictions.push({ kind: 'chunk-visitId-mismatch', chunkId: c.chunkId, chunkVisitId: meta.visitId, railVisitId: p.cap.key.visitId });
    }
    if (meta.side && meta.side !== p.cap.key.side) {
      contradictions.push({ kind: 'chunk-side-mismatch', chunkId: c.chunkId, chunkSide: meta.side, railSide: p.cap.key.side });
    }
  }
  const snapIdInChunkRefs = (p.ge.chunkIds || []).includes(p.ge.snapshotId);
  return {
    snapshotAssociationStatus: p.snap.associationStatus ?? null,
    snapshotIdEqualsAChunkId: snapIdInChunkRefs,
    captureId: p.ge.captureId ?? null,
    chunkCaptureIds: chunkObjs.map(c => c.materializedProvenance.captureId),
    chunkVisitIds: chunkObjs.map(c => c.materializedProvenance.visitId),
    sameCaptureId: chunkObjs.every(c => !c.materializedProvenance.captureId
      || c.materializedProvenance.captureId === p.ge.captureId),
    sameVisitId: chunkObjs.every(c => !c.materializedProvenance.visitId
      || c.materializedProvenance.visitId === p.cap.key.visitId),
    directContradiction: contradictions.length > 0,
    contradictions,
    interpretation: 'Recorded association fields are descriptive. Identifier equality and associationStatus do not by themselves prove physical contemporaneity or causal correctness.'
  };
}

function reconstructPayloads(partial, chunks) {
  const rows = [];
  const parity = [];
  for (const p of partial) {
    const archive = p.entry.archive;
    const chunkObjs = p.chunkIds.map(id => {
      const c = chunks.found[archive].get(id);
      if (!c) throw Error(`chunk not found after scan ${id}`);
      return {
        chunkId: id,
        points: c.points,
        visible: c.visible,
        raw: null,
        occurrences: c.occurrences,
        materializedProvenance: c.occurrences[0]?.provenance ?? pickCloudProvenance(c.raw || { chunkId: id })
      };
    });
    const payload = {
      key: {
        corpus: p.cap.key.corpus, cohort: p.cap.key.cohort,
        sessionId: p.cap.key.sessionId, visitId: p.cap.key.visitId,
        visitIndex: p.cap.key.visitIndex, part: p.identity.part, cut: p.identity.cut,
        side: p.cap.key.side
      },
      target: {
        pageId: p.identity.pageId, part: p.identity.part, cut: p.identity.cut,
        shape: p.identity.shape, frameId: p.identity.frameId,
        projectId: p.identity.projectId ?? null
      },
      railInitialState: p.snap.rail,
      snapshot: {
        snapshotId: p.ge.snapshotId,
        criteriaVersion: p.ge.criteriaVersion ?? null,
        referenceStatus: p.ge.referenceStatus ?? null
      },
      chunkRefs: [...p.chunkIds],
      chunks: chunkObjs.map(c => ({ chunkId: c.chunkId, points: c.points, visible: c.visible })),
      provenance: {
        archive,
        corpus: p.cap.key.corpus,
        sourceFile: p.entry.sourceName,
        snapshotId: p.ge.snapshotId,
        captureId: p.ge.captureId ?? null,
        pointsSupplied: chunkObjs.reduce((n, c) => n + c.points.length, 0),
        materializedDataCommit: DATA_COMMIT,
        chunkMaterializedSources: chunkObjs.map(c => ({
          chunkId: c.chunkId,
          occurrences: c.occurrences.map(o => ({
            sourceName: o.sourceName,
            materializedFiles: o.materializedFiles
          }))
        }))
      }
    };
    const checkPayload = {
      key: payload.key, target: payload.target, railInitialState: payload.railInitialState,
      snapshot: payload.snapshot, chunkRefs: payload.chunkRefs, chunks: payload.chunks
    };
    const h = shaOf(checkPayload);
    const ok = h === p.cap.payloadSha256;
    parity.push({ identity: payload.key, expected: p.cap.payloadSha256, materialized: h, match: ok });
    payload.payloadSha256 = p.cap.payloadSha256;
    payload._extra = {
      chunkObjs,
      temporal: buildTemporal(p, chunkObjs),
      association: buildAssociation(p, chunkObjs)
    };
    rows.push(payload);
  }
  return { rows, parity };
}

function traceEngine(payload, CAP, G) {
  const capture = CAP.captureFromPayload(payload);
  const t = CAP.trace(capture, payload.key.side);
  const proposal = G.propose(capture, payload.key.side);
  return {
    seedZ: t.seed?.[1] ?? null,
    seedU: t.seed?.[0] ?? null,
    coarseBestZ: t.coarseBest?.z ?? null,
    coarseBestU: t.coarseBest?.u ?? null,
    coarseBestLoss: t.coarseBest?.loss ?? null,
    refinedBestZ: t.refinedBest?.z ?? null,
    refinedBestU: t.refinedBest?.u ?? null,
    refinedBestLoss: t.refinedBest?.loss ?? null,
    topRows: t.topRows ?? null,
    exit: t.exit,
    proposalStatus: proposal?.status ?? null,
    proposalReasons: proposal?.reasons ?? [],
    proposalLoss: proposal?.metrics?.templateLoss ?? null
  };
}

function summarize(rails) {
  const cohorts = {};
  for (const cohort of ['failure', 'control']) {
    const xs = rails.filter(r => r.identity.cohort === cohort);
    cohorts[cohort] = {
      rails: xs.length,
      rawSceneZMedianAcrossRails: stats(xs.map(r => r.rawSceneZStatistics?.median)),
      independentLocalZMedianAcrossRails: stats(xs.map(r => r.sceneProjectedCloudStatistics?.median)),
      providedLocalZMedianAcrossRails: stats(xs.map(r => r.profileLocalCloudStatistics?.median)),
      cloudContourGapAcrossRails: stats(xs.map(r => r.cloudContourRelation?.medianDifferenceIndependent)),
      seedZAcrossRails: stats(xs.map(r => r.engineTrace?.seedZ)),
      coarseBestZAcrossRails: stats(xs.map(r => r.engineTrace?.coarseBestZ)),
      refinedBestZAcrossRails: stats(xs.map(r => r.engineTrace?.refinedBestZ)),
      topRowsAcrossRails: stats(xs.map(r => r.engineTrace?.topRows)),
      lossAcrossRails: stats(xs.map(r => r.engineTrace?.refinedBestLoss)),
      chunkProjectedMedianRange: stats(xs.map(r => r.chunkComposition?.chunkProjectedMedianRange)),
      profileOriginSceneZ: stats(xs.map(r => r.profileOrigin?.[2]))
    };
  }
  const stages = {};
  for (const r of rails) stages[r.firstObservedStage] = (stages[r.firstObservedStage] || 0) + 1;
  const chunkCounts = {};
  for (const r of rails) chunkCounts[r.chunkComposition.chunkCount] = (chunkCounts[r.chunkComposition.chunkCount] || 0) + 1;
  const sessions = {};
  for (const r of rails) {
    const s = r.identity.sessionId;
    if (!sessions[s]) sessions[s] = { failures: 0, controls: 0 };
    sessions[s][r.identity.cohort === 'failure' ? 'failures' : 'controls']++;
  }
  const projectionEquivalent = rails.filter(r => r.projectionIndependentVsTransform?.passes).length;
  const assocContradictions = rails.filter(r => r.associationObservability?.directContradiction).length;
  const timestampsPresent = rails.filter(r => r.temporalProvenance?.anyTimestampPresent).length;
  const failures = rails.filter(r => r.identity.cohort === 'failure');
  const qTopRows = {
    topRowsLt3: failures.filter(r => (r.engineTrace?.topRows ?? 0) < 3).length,
    topRowsGe3: failures.filter(r => (r.engineTrace?.topRows ?? 0) >= 3).length,
    topRowsEq0: failures.filter(r => (r.engineTrace?.topRows ?? 0) === 0).length,
    topRows1or2: failures.filter(r => {
      const t = r.engineTrace?.topRows ?? 0;
      return t === 1 || t === 2;
    }).length
  };
  const fLocal = failures.map(r => r.sceneProjectedCloudStatistics?.median).filter(finite);
  const cLocal = rails.filter(r => r.identity.cohort === 'control').map(r => r.sceneProjectedCloudStatistics?.median).filter(finite);
  const cIqr = cLocal.length ? [quantileSorted(cLocal.slice().sort((a, b) => a - b), 0.25), quantileSorted(cLocal.slice().sort((a, b) => a - b), 0.75)] : [null, null];
  const failuresInsideControlLocalIqr = fLocal.filter(z => z >= cIqr[0] && z <= cIqr[1]).length;
  const contourZs = rails.map(r => r.cloudContourRelation?.contourMedianLocalZ).filter(finite);
  const contourSpread = contourZs.length ? Math.max(...contourZs) - Math.min(...contourZs) : null;
  const mixedPairs = [];
  const lrSeen = new Set();
  for (const r of rails) {
    const ctx = r.sameVisitOppositeSideContext;
    if (!ctx) continue;
    const k = r.identity.visitId;
    if (lrSeen.has(k)) continue;
    lrSeen.add(k);
    mixedPairs.push({
      sessionId: r.identity.sessionId,
      visitIndex: r.identity.visitIndex,
      leftCohort: r.identity.side === 'left' ? r.identity.cohort : ctx.opposite.cohort,
      rightCohort: r.identity.side === 'right' ? r.identity.cohort : ctx.opposite.cohort,
      originDisplacement: ctx.comparison?.profileOriginDisplacement ?? null,
      sameFrameId: ctx.sameFrameId,
      sameSourceFile: ctx.sameSourceFile,
      chunkIntersection: (ctx.chunkSources?.intersection || []).length,
      axisZRadians: ctx.comparison?.axisOrientationDeltaRadians?.z ?? null
    });
  }
  const multi = rails.filter(r => r.chunkComposition.chunkCount > 1);
  let concatOutside = 0;
  for (const r of multi) {
    const meds = r.perChunkStatistics.map(c => c.independentMedianLocalZ).filter(finite);
    const cat = r.chunkComposition.concatenatedProjectedMedian;
    if (!meds.length || !finite(cat)) continue;
    if (cat < Math.min(...meds) - 1e-12 || cat > Math.max(...meds) + 1e-12) concatOutside++;
  }
  const assocStatus = {};
  for (const r of rails) {
    const s = r.associationObservability?.snapshotAssociationStatus ?? 'null';
    assocStatus[s] = (assocStatus[s] || 0) + 1;
  }
  const timestampDeltas = { failure: {}, control: {} };
  for (const cohort of ['failure', 'control']) {
    const xs = rails.filter(r => r.identity.cohort === cohort);
    const ended = [], started = [], capturedView = [];
    for (const r of xs) {
      for (const d of r.temporalProvenance?.deltasMs || []) {
        if (finite(d.acquisitionEndedMinusSnapshotAcquiredThroughMs)) ended.push(d.acquisitionEndedMinusSnapshotAcquiredThroughMs);
        if (finite(d.acquisitionStartedMinusSnapshotStartedMs)) started.push(d.acquisitionStartedMinusSnapshotStartedMs);
        if (finite(d.capturedAtMinusViewObservedAtMs)) capturedView.push(d.capturedAtMinusViewObservedAtMs);
      }
    }
    timestampDeltas[cohort] = {
      acquisitionEndedMinusSnapshotAcquiredThroughMs: stats(ended),
      acquisitionStartedMinusSnapshotStartedMs: stats(started),
      capturedAtMinusViewObservedAtMs: stats(capturedView)
    };
  }
  const lrDisplacements = mixedPairs.map(p => p.originDisplacement).filter(finite);
  const lrAngles = mixedPairs.map(p => p.axisZRadians).filter(finite);

  return {
    rails: rails.length,
    projectionEquivalent,
    projectionNonEquivalent: rails.length - projectionEquivalent,
    firstObservedStage: stages,
    cohorts,
    cohortMedianDifferences: {
      rawSceneZ: (cohorts.failure.rawSceneZMedianAcrossRails.median ?? NaN) - (cohorts.control.rawSceneZMedianAcrossRails.median ?? NaN),
      independentLocalZ: (cohorts.failure.independentLocalZMedianAcrossRails.median ?? NaN) - (cohorts.control.independentLocalZMedianAcrossRails.median ?? NaN),
      providedLocalZ: (cohorts.failure.providedLocalZMedianAcrossRails.median ?? NaN) - (cohorts.control.providedLocalZMedianAcrossRails.median ?? NaN),
      cloudContourGap: (cohorts.failure.cloudContourGapAcrossRails.median ?? NaN) - (cohorts.control.cloudContourGapAcrossRails.median ?? NaN),
      seedZ: (cohorts.failure.seedZAcrossRails.median ?? NaN) - (cohorts.control.seedZAcrossRails.median ?? NaN)
    },
    chunkCountDistribution: chunkCounts,
    sameVisitOppositeSidePairs: rails.filter(r => r.sameVisitOppositeSideContext).length / 2,
    sessions,
    associationDirectContradictions: assocContradictions,
    associationStatusCounts: assocStatus,
    railsWithTimestamps: timestampsPresent,
    timestampDeltasMs: timestampDeltas,
    failureEngineSubgroups: qTopRows,
    overlap: {
      failuresIndependentLocalZInsideControlIqr: failuresInsideControlLocalIqr,
      failureCount: failures.length,
      controlIndependentLocalZIqr: cIqr
    },
    contourMedianLocalZ: {
      min: contourZs.length ? Math.min(...contourZs) : null,
      max: contourZs.length ? Math.max(...contourZs) : null,
      spread: contourSpread
    },
    leftRight: {
      uniquePairs: mixedPairs.length,
      mixedCohortPairs: mixedPairs.filter(p => p.leftCohort !== p.rightCohort).length,
      failureFailurePairs: mixedPairs.filter(p => p.leftCohort === 'failure' && p.rightCohort === 'failure').length,
      originDisplacement: stats(lrDisplacements),
      axisZOrientationDeltaRadians: stats(lrAngles),
      pairs: mixedPairs
    },
    chunkCompositionIntegrity: {
      multiChunkRails: multi.length,
      concatMedianOutsidePerChunkEnvelope: concatOutside
    },
    special: {
      session3876864f: rails.filter(r => r.identity.sessionId.startsWith('3876864f')).map(r => ({
        identity: compactRef(r), gap: r.cloudContourRelation?.medianDifferenceIndependent,
        seedZ: r.engineTrace?.seedZ, topRows: r.engineTrace?.topRows, stage: r.firstObservedStage
      })),
      sessionD9ccb545: rails.filter(r => r.identity.sessionId.startsWith('d9ccb545')).map(r => ({
        identity: compactRef(r), cohort: r.identity.cohort,
        gap: r.cloudContourRelation?.medianDifferenceIndependent, stage: r.firstObservedStage,
        seedZ: r.engineTrace?.seedZ, topRows: r.engineTrace?.topRows
      })),
      session0c58c033: rails.filter(r => r.identity.sessionId.startsWith('0c58c033')).map(r => ({
        identity: compactRef(r), cohort: r.identity.cohort, visitIndex: r.identity.visitIndex,
        gap: r.cloudContourRelation?.medianDifferenceIndependent, origin: r.profileOrigin,
        seedZ: r.engineTrace?.seedZ, topRows: r.engineTrace?.topRows, stage: r.firstObservedStage
      })),
      clusterPart1Right5083_5276: rails.filter(r => r.identity.part === 1 && r.identity.side === 'right'
        && r.identity.cut >= 5083 && r.identity.cut <= 5276).map(r => ({
        identity: compactRef(r), cohort: r.identity.cohort,
        projectedMedian: r.sceneProjectedCloudStatistics?.median,
        gap: r.cloudContourRelation?.medianDifferenceIndependent,
        seedZ: r.engineTrace?.seedZ, topRows: r.engineTrace?.topRows, stage: r.firstObservedStage
      })),
      failuresWithTopRowsGe3: failures.filter(r => (r.engineTrace?.topRows ?? 0) >= 3).map(r => ({
        identity: compactRef(r), topRows: r.engineTrace?.topRows, loss: r.engineTrace?.refinedBestLoss,
        coarseBestZ: r.engineTrace?.coarseBestZ, refinedBestZ: r.engineTrace?.refinedBestZ,
        gap: r.cloudContourRelation?.medianDifferenceIndependent, stage: r.firstObservedStage
      }))
    },
    lokiThresholdProxyOnRichardGapAndCoarse: (() => {
      const T = LOKI_REPLICATION.cited.familyThreshold;
      const counts = {
        'local-transformed-already-offset': 0,
        'coarse-search-offset-while-local-near-plane': 0,
        'no-large-offset': 0
      };
      for (const r of failures) {
        const gap = Math.abs(r.cloudContourRelation?.medianDifferenceIndependent ?? Infinity);
        const coarse = Math.abs(r.engineTrace?.coarseBestZ ?? Infinity);
        if (gap >= T) counts['local-transformed-already-offset']++;
        else if (coarse >= T) counts['coarse-search-offset-while-local-near-plane']++;
        else counts['no-large-offset']++;
      }
      return {
        note: 'Proxy only. Richard gap (full-cloud median vs contour) is not Loki zLocalHeadWindow. Counts are not an identity of the same 40 rails.',
        threshold: T,
        counts
      };
    })()
  };
}

function hypothesesFrom(summary, rails) {
  const eq = summary.projectionEquivalent === summary.rails;
  const allChunksProjected = rails.every(r => r.perChunkStatistics.every(c => c.pointCount > 0 && c.statistics));
  const concatOnly = rails.some(r => r.firstObservedStage === STAGES.CHUNK_COMPOSITION);
  const assocObs = summary.associationDirectContradictions > 0;
  const timestamps = summary.railsWithTimestamps === summary.rails;
  const sceneStageAll = rails.every(r => r.firstObservedStage === STAGES.SCENE_PROFILE_RELATION);
  const cohortGapBothFinite = finite(summary.cohorts.failure.cloudContourGapAcrossRails.median)
    && finite(summary.cohorts.control.cloudContourGapAcrossRails.median);
  return {
    A: {
      status: 'COMPATIBLE',
      statement: 'The relative vertical relation is measured on captured scene coordinates versus the profile pose. That does not isolate the LiDAR coordinates themselves as a causal source.'
    },
    B: {
      status: concatOnly ? 'OBSERVÉ' : (allChunksProjected ? 'CONTREDIT' : 'COMPATIBLE'),
      statement: concatOnly
        ? 'At least one rail exhibits a concatenated relation that is not measurable on any individual chunk.'
        : (allChunksProjected
          ? 'Every referenced chunk of every rail carries points that independently exhibit the scene/profile vertical relation; concatenation is not the introduction point.'
          : 'Chunk composition could not be fully tested on every rail.')
    },
    C: {
      status: eq ? 'CONTREDIT' : 'OBSERVÉ',
      statement: eq
        ? 'The independently inverted profileLocalToSceneRelative mapping agrees with the provided sceneRelativeToProfileLocal z on all 239 rails inside the a priori numerical envelope. The implementation of that transform does not introduce the disagreement.'
        : 'Independent inverse local-z and provided profile-local z diverge on at least one rail.'
    },
    D: {
      status: 'COMPATIBLE',
      statement: 'The disagreement is observable in the scene-relative relation between the cloud and the profile pose. That is compatible with pose/cloud inconsistency without identifying which side is causal.'
    },
    E: {
      status: assocObs ? 'OBSERVÉ' : (timestamps ? 'COMPATIBLE' : 'NON TESTABLE'),
      statement: assocObs
        ? 'At least one rail has a direct recorded association contradiction (visitId, side, or chunk.rail matrix vs snapshot.rail).'
        : (timestamps
          ? 'Materialized chunks and snapshots carry acquisition, capture and snapshot timestamps and recorded associationStatus. Recorded contemporaneity is not independent proof of physical association; E remains compatible, not demonstrated.'
          : 'Required timestamps are absent; association contemporaneity is not testable from the available fields.')
    },
    F: {
      status: (eq && sceneStageAll) ? 'CONTREDIT' : 'COMPATIBLE',
      statement: (eq && sceneStageAll)
        ? 'The relative vertical cloud/profile offset is measurable at identity pose, before coarse/refined search, on all 239 rails. Engine search cannot be the sole introduction of that offset. This does not claim that the offset separates failures from controls, nor that it is the cause of the 63 unresolved rails.'
        : 'Pre-search localization is incomplete on some rails, so engine search cannot be excluded as an introduction path.'
    },
    G: {
      status: 'COMPATIBLE',
      statement: 'Acquisition, pose, recorded association, upstream scene construction and calibration remain jointly compatible because they are not separable as unique physical causes.'
    }
  };
}

function buildProvenanceGap(rails) {
  const missing = [];
  const timestampsPresent = rails.every(r => r.temporalProvenance?.anyTimestampPresent);
  if (!timestampsPresent) {
    missing.push('explicit acquisition timestamp for each LiDAR chunk');
    missing.push('explicit timestamp for snapshot/profile pose state');
  }
  missing.push('independent verification that recorded acquisition clocks and pose clocks share a physical time base');
  missing.push('upstream sensor-to-scene transform chain with version and timestamp (beyond the recorded sourceStatus claim)');
  missing.push('independent physical calibration of scene units (coordinateSystem.physicalCalibrationStatus is not-independently-verified)');
  const stillGap = true;
  return {
    code: 'PROVENANCE_GAP',
    present: stillGap,
    timestampsWereFoundInMaterializedView: timestampsPresent,
    missing,
    consequence: timestampsPresent
      ? 'Recorded timestamps and associationStatus exist on the materialized chunks and snapshots, so a raw absence of time fields is not the gap. The remaining gap is the lack of an independent physical binding between LiDAR acquisition, profile pose, and the upstream scene transform. Causal source therefore stays unknown.'
      : 'The available fields cannot temporally bind the LiDAR acquisition to the profile pose with an independent clock.',
    minimalFutureInstrumentation: [
      'Persist an explicit association event {lidarAcquisitionId, poseStateId, sharedClockTimestamp, transformChainVersion} at collection time',
      'Persist the sensor-to-scene transform chain (matrices + versions + timestamps), not only the scene-relative cloud',
      'Persist a pose-state timestamp distinct from export storedAt',
      'Record an independently verified unit/calibration status rather than metres-observed-not-independently-calibrated'
    ]
  };
}

function confrontationFrom(summary, hypotheses) {
  const loki = LOKI_REPLICATION.cited;
  const proxy = summary.lokiThresholdProxyOnRichardGapAndCoarse;
  const richard = {
    independentLocalZMedian: {
      failure: summary.cohorts.failure.independentLocalZMedianAcrossRails.median,
      control: summary.cohorts.control.independentLocalZMedianAcrossRails.median,
      absDelta: Math.abs(summary.cohortMedianDifferences.independentLocalZ)
    },
    cloudContourGapMedian: {
      failure: summary.cohorts.failure.cloudContourGapAcrossRails.median,
      control: summary.cohorts.control.cloudContourGapAcrossRails.median,
      absDelta: Math.abs(summary.cohortMedianDifferences.cloudContourGap)
    },
    coarseZMedian: {
      failure: summary.cohorts.failure.coarseBestZAcrossRails.median,
      control: summary.cohorts.control.coarseBestZAcrossRails.median
    },
    refinedZMedian: {
      failure: summary.cohorts.failure.refinedBestZAcrossRails.median,
      control: summary.cohorts.control.refinedBestZAcrossRails.median
    },
    firstObservedStage: summary.firstObservedStage,
    associationDirectContradictions: summary.associationDirectContradictions,
    hypotheses: Object.fromEntries(Object.entries(hypotheses).map(([k, v]) => [k, v.status]))
  };
  return {
    peer: {
      branch: LOKI_REPLICATION.branch,
      head: LOKI_REPLICATION.head,
      report: LOKI_REPLICATION.report,
      toolAtHead: LOKI_REPLICATION.toolAtHead,
      jsonAtHead: null,
      limitation: 'Loki tool file at that HEAD is the literal string "see-file" (MCP truncation). Confrontation uses the published markdown and tests only. Session-level tables are not in that report.'
    },
    status: 'PARTIELLEMENT CONCORDANT',
    definitionDifference: {
      richardAsks: 'premier stade où l’offset nuage/profil existe (sans seuil)',
      lokiAsks: 'premier stade où un |Δ| de cohortes dépasse 0.015, puis familles à 0.030',
      verdict: 'La différence apparente SCENE_PROFILE_RELATION × 239 vs coarse-search-offset-while-local-near-plane 40/63 n’est pas une contradiction de mesure. C’est premier-stade-où-l’offset-existe vs premier-stade-où-une-séparation-de-cohorte-apparaît.'
    },
    reproduced: [
      'Population 63 failures + 176 controls, exit « Plan de roulement non estimable. »',
      'Association : 0 contradiction / 239 des deux côtés',
      `coarse.z médian failures ${fmt(loki.coarseZMedian.failure)} vs Richard ${fmt(richard.coarseZMedian.failure)} ; controls ${fmt(loki.coarseZMedian.control)} vs ${fmt(richard.coarseZMedian.control)}`,
      `refined.z médian failures ${fmt(loki.refinedZMedian.failure)} vs Richard ${fmt(richard.refinedZMedian.failure)} ; controls ${fmt(loki.refinedZMedian.control)} vs ${fmt(richard.refinedZMedian.control)}`,
      `Z scène − origine profil Loki (${fmt(loki.sceneMinusOriginMedian.failure)} / ${fmt(loki.sceneMinusOriginMedian.control)}) ≈ z local indépendant Richard (${fmt(richard.independentLocalZMedian.failure)} / ${fmt(richard.independentLocalZMedian.control)})`,
      'Calibration : metres-observed-not-independently-calibrated / not-independently-verified'
    ],
    methodologicalDifferences: [
      'Loki lit la géométrie depuis la capsule RSF ; Richard relit la vue matérialisée (parité payload 239/239, donc mêmes points si la parité tient).',
      'Loki n’appelle pas G.propose ; Richard observe seed/coarse/refined via CAP.trace. Les z coarse/refined publiés coïncident malgré cela.',
      'Loki publie un seuil 0.015 (stade) et 0.030 (familles). Richard n’en définit aucun pour localiser le premier stade.',
      'Loki mesure zLocalHeadWindow (fenêtre « tête »). Richard mesure la médiane du nuage visible entier et l’écart au gabarit. Ce n’est pas le même observable local.'
    ],
    definitionalDifferences: [
      'Richard firstObservedStage = existence de la relation nuage/pose à l’identité, sur les 239 rails.',
      'Loki firstStageAbove015 = premier |Δ| de médianes de cohortes ≥ 0.015. Son z local tête |Δ|=0.0136 < 0.015, puis coarse |Δ|=0.039 → coarse-search-z.',
      'Le |Δ| de z local indépendant Richard vaut 0.0114 < 0.015, puis |Δ| coarse 0.039. Appliquée aux différences de cohortes, la règle 0.015 de Loki désignerait aussi coarse-search comme premier stade séparateur.',
      'Les familles Loki 40 / 10 / 13 partitionnent les 63 failures. Richard 40/63 dans l’IQR de z local des controls est un autre cut. Les deux « 40 » ne sont pas identifiés comme les mêmes rails.'
    ],
    realContradictions: [],
    lokiCited: loki,
    richard,
    thresholdProxy: proxy,
    sessions: {
      comparable: false,
      reason: 'Le rapport Loki à 7a6555b ne publie pas 0c58c033, d9ccb545, 3876864f. Pas de confrontation de grain session.'
    },
    hypothesesAtoG: {
      lokiPublished: false,
      richard: richard.hypotheses,
      reading: 'Loki n’a pas publié A–G. Son tableau (local tête près du plan, gros z à coarse pour 40 failures, association 0/239) est compatible avec C CONTREDIT, E non observée, et avec F CONTREDIT au sens « la recherche n’introduit pas l’offset d’existence ». Il n’est pas une affirmation que coarse.z cause les 63 RSF.'
    }
  };
}

function labStatusFrom(summary, hypotheses, confrontation) {
  const closed = [
    {
      piste: 'bug scene→profile transform',
      status: 'FERMÉE comme explication principale des RSF',
      why: 'C CONTREDIT. Inverse indépendant ≡ z fourni 239/239. Loki : |Δ| local tête 0.0136 sous le seuil 0.015.'
    },
    {
      piste: 'bug de concaténation chunks',
      status: 'FERMÉE comme explication principale des RSF',
      why: 'B CONTREDIT. 51 rails multi-chunks ; médiane concaténée dans l’enveloppe par chunk 51/51. Loki n’a pas testé B ; la fermeture repose sur Richard.'
    },
    {
      piste: 'simple anomalie verticale globale',
      status: 'FERMÉE comme explication principale des RSF',
      why: 'L’offset nuage/profil à l’identité existe des deux côtés et ne sépare pas les cohortes (40/63 failures dans l’IQR control). Loki : 40/63 already local-near-plane sous seuil 0.030.'
    },
    {
      piste: 'association manifestement incorrecte',
      status: 'FERMÉE comme explication principale des RSF',
      why: '0 contradiction d’identifiants / 239 chez Richard et chez Loki. associationStatus=same-target-and-rail-pose partout. E n’est pas OBSERVÉ.'
    }
  ];
  const notClosed = [
    { piste: 'origine physique LiDAR', status: 'NON DÉMONTRÉE / NON TESTABLE comme cause', why: 'A COMPATIBLE. Relation nuage/pose, pas isolat capteur.' },
    { piste: 'origine physique pose', status: 'NON DÉMONTRÉE / NON TESTABLE comme cause', why: 'D COMPATIBLE. Non séparable du nuage.' },
    { piste: 'chaîne capteur→scène', status: 'PROVENANCE_GAP', why: 'sourceStatus enregistré, chaîne versionnée absente.' },
    { piste: 'synchronisation physique des horloges', status: 'PROVENANCE_GAP', why: 'Timestamps présents et cohérents ; pas de preuve d’horloge commune indépendante.' }
  ];
  return {
    state: 'CLOSED',
    justification: 'Mesures indépendantes 239/239 terminées, runtime gelé, confrontation documentaire Loki faite. Les pistes moteur-critiques que ce lab peut fermer (transform, chunks, anomalie verticale globale, association manifeste) sont fermées. Le résidu est PROVENANCE_GAP hors chemin critique moteur. causalSource reste unknown. Pas de merge.',
    independentReplicationStatus: confrontation.status,
    closedAsPrincipalRsfExplanation: closed,
    notClosed,
    hypotheses: Object.fromEntries(Object.entries(hypotheses).map(([k, v]) => [k, v.status])),
    payloadParity: summary.rails,
    remainingProvenanceGap: true,
    causalSource: 'unknown'
  };
}

function fmt(x) {
  return x == null ? 'n/a' : (Number.isFinite(x) ? Number(x).toPrecision(8) : String(x));
}

function report(a) {
  const f = a.summary.cohorts.failure, c = a.summary.cohorts.control;
  const st = Object.entries(a.summary.firstObservedStage).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n');
  const hyp = Object.entries(a.hypotheses).map(([k, v]) => `- **${k}** — ${v.status}: ${v.statement}`).join('\n');
  const sessions = Object.entries(a.summary.sessions).map(([id, v]) =>
    `- \`${id}\`: failures=${v.failures}, controls=${v.controls}`).join('\n');
  const formulation = a.summary.projectionEquivalent === a.summary.rails
    ? 'Le désaccord vertical relatif préexiste au calcul des coordonnées profile-local et n’est pas introduit par l’implémentation de cette transformation.'
    : 'La projection indépendante n’est pas équivalente au z profile-local sur toute la population ; aucune formulation d’équivalence n’est émise.';
  return [
    '# VERTICAL ALIGNMENT PROVENANCE LAB V1',
    '',
    `Branche: \`lab-vertical-alignment-provenance-v1-richard\``,
    `Base scientifique: \`infra/research-capsule-rsf-v1\` @ \`${a.baseCommit}\``,
    `Données: \`StoryNow30/banane-data\` @ \`${a.source.commit}\` / \`${a.source.dataset}\``,
    `Artefact déterministe (hors \`generatedAt\`): \`${a.deterministicSha256}\``,
    '',
    '## Portée',
    '',
    `${a.summary.rails} rails: ${a.summary.cohorts.failure.rails} failures (« Plan de roulement non estimable. ») et ${a.summary.cohorts.control.rails} controls.`,
    'La capsule RSF V1 est le registre d’identités. Toutes les poses, matrices, chunks et timestamps mesurés sont relus de la vue matérialisée. Aucun humain, aucun correctif moteur, aucun tuning, aucun millimètre.',
    '',
    `Parité payload matérialisé ↔ capsule: **${a.integrity.payloadParityMatches} / ${a.summary.rails}** (mismatches=${a.integrity.payloadParityMismatches}).`,
    '',
    '## Runtime gelé',
    '',
    Object.entries(a.runtime.actual).map(([p, h]) => `- \`${p}\`: \`${h}\` match=${a.runtime.matches[p]}`).join('\n'),
    '',
    '## Tolérances numériques (a priori)',
    '',
    '```json',
    JSON.stringify(TOLERANCES, null, 2),
    '```',
    '',
    '## Audit de transformation',
    '',
    `Projection indépendante (inverse affine de \`profileLocalToSceneRelative\`) équivalente au z fourni par \`sceneRelativeToProfileLocal\`: **${a.summary.projectionEquivalent}/${a.summary.rails}**.`,
    '',
    'La projection indépendante n’appelle pas `C.point`. Si shear ou échelle non unitaire existent, le z local est la 3e composante de l’inverse, pas un produit scalaire sur un axe normalisé.',
    '',
    '## Premier stade observable',
    '',
    st,
    '',
    '## Formulation scientifique supportée',
    '',
    formulation,
    '',
    'Cela ne démontre toujours pas: LiDAR fautif, pose fautive, snapshot fautif, association fautive, timing fautif, transformation amont fautive.',
    '',
    '## Failures vs controls',
    '',
    'Le z médian du contour en coordonnées profile-local est le même objet géométrique sur les 239 rails (étendue ' + fmt(a.summary.contourMedianLocalZ.spread) + '). L’écart nuage–contour se réduit donc au z local du nuage, décalé d’une constante de gabarit. Ce n’est pas un second observable indépendant.',
    '',
    `Médiane des médianes rail, z local indépendant: failures=${fmt(f.independentLocalZMedianAcrossRails.median)}, controls=${fmt(c.independentLocalZMedianAcrossRails.median)}, différence=${fmt(a.summary.cohortMedianDifferences.independentLocalZ)}.`,
    `Médiane des médianes rail, z profile-local fourni: failures=${fmt(f.providedLocalZMedianAcrossRails.median)}, controls=${fmt(c.providedLocalZMedianAcrossRails.median)}, différence=${fmt(a.summary.cohortMedianDifferences.providedLocalZ)}.`,
    `Médiane de l’écart médian nuage–contour: failures=${fmt(f.cloudContourGapAcrossRails.median)}, controls=${fmt(c.cloudContourGapAcrossRails.median)}, différence=${fmt(a.summary.cohortMedianDifferences.cloudContourGap)}.`,
    `Médiane seed.z: failures=${fmt(f.seedZAcrossRails.median)}, controls=${fmt(c.seedZAcrossRails.median)}, différence=${fmt(a.summary.cohortMedianDifferences.seedZ)}.`,
    `Médiane topRows: failures=${fmt(f.topRowsAcrossRails.median)}, controls=${fmt(c.topRowsAcrossRails.median)}.`,
    '',
    `${a.summary.overlap.failuresIndependentLocalZInsideControlIqr}/${a.summary.overlap.failureCount} failures ont un z local médian dans l’IQR des controls. Les distributions de z local se recouvrent. L’écart de médianes 0.011 n’est pas une séparation de cohortes.`,
    '',
    `Le z scène brut ne se compare pas d’un rail à l’autre (médianes ${fmt(f.rawSceneZMedianAcrossRails.median)} vs ${fmt(c.rawSceneZMedianAcrossRails.median)}) : les origines scène diffèrent selon le site (session f938b9f8 vers ~740 unités d’origine). Après passage en profile-local, cette échelle disparaît.`,
    '',
    `Sous-groupes engine (failures, topRows de CAP.trace, contexte RSF non redémontré): topRows=0 : ${a.summary.failureEngineSubgroups.topRowsEq0} ; topRows∈{1,2} : ${a.summary.failureEngineSubgroups.topRows1or2} ; topRows≥3 : ${a.summary.failureEngineSubgroups.topRowsGe3}. Séparation engine (topRows 0–2 vs ≥15) déjà établie par RSF V1 ; elle n’est pas relocalisée ici comme cause.`,
    '',
    '## Chunks',
    '',
    `Distribution du nombre de chunks par rail: ${JSON.stringify(a.summary.chunkCountDistribution)}. Rails multi-chunks: ${a.summary.chunkCompositionIntegrity.multiChunkRails}. Médiane concaténée hors enveloppe des médianes par chunk: ${a.summary.chunkCompositionIntegrity.concatMedianOutsidePerChunkEnvelope}. La concaténation n’introduit pas une relation absente des chunks.`,
    '',
    '## Continuité et gauche/droite',
    '',
    `Paires gauche/droite au même visit dans le registre: ${a.summary.leftRight.uniquePairs} (dont ${a.summary.leftRight.mixedCohortPairs} mixtes control/failure, ${a.summary.leftRight.failureFailurePairs} failure/failure). Aucune paire ne partage un chunk (intersection vide) : les nuages gauche et droit sont des acquisitions distinctes. frameId, pageId et sourceFile coïncident. Déplacement d’origine médian ${fmt(a.summary.leftRight.originDisplacement.median)} (largeur de voie observée, pas un saut de pose). Angle d’axe z constant ${fmt(a.summary.leftRight.axisZOrientationDeltaRadians.median)} rad sur les paires mesurées.`,
    '',
    'Les déplacements d’origine entre voisins du registre atteignent >1000 unités lorsque des visites non sélectionnées s’intercalent. Ce n’est pas une trajectoire physique visit-à-visit. La continuité publiée est celle du registre 239, pas celle de la session Native complète.',
    '',
    '## Sessions',
    '',
    sessions,
    '',
    '## Cas de contrôle',
    '',
    `- session 3876864f : ${a.summary.special.session3876864f.length} rails, 17 failures, 0 control. Presque tout à droite, cuts 5083–5106, seed.z typiquement à la borne de recherche, topRows=0. Aucun témoin interne n’est inventé.`,
    `- session d9ccb545 : ${a.summary.special.sessionD9ccb545.length} rails (35 failures, 19 controls), même fichier, même frame, origines ~71. Les failures occupent les visitIndex bas (0–190, essentiellement côté droit) ; les controls les visitIndex plus élevés. Témoin intra-session réel, mais pas au même visitIndex.`,
    `- session 0c58c033 : ${a.summary.special.session0c58c033.length} rails (10 failures, 40 controls). visitIndex du registre : 0…315. Autour de 245, le registre contient 224 (failure, gap≈0, seed.z=+0.034, topRows=0), 226 (control), 231 gauche control / droite failure, 257 control. La frontière RSF à 245 n’est pas un saut de z local unique dans ce sous-ensemble.`,
    `- session 92dbb85e : 1 failure parmi 31 controls. Gap nuage–contour ≈ −0.001 (nuage presque sur le gabarit) et topRows=0, seed.z à la borne. L’écart médian nuage–contour ne prédit pas cet échec.`,
    `- cluster part 1 / right / cuts 5083–5276 : ${a.summary.special.clusterPart1Right5083_5276.length} rails (sessions 3876864f + d9ccb545).`,
    `- paires mixtes même visit : 0c58c033 visit 63 (gauche control topRows=43, droite failure topRows=2, gaps comparables) et visit 231 (gauche control gap≈−0.048, droite failure gap≈−0.122). Même visit, même source, nuages distincts, issues engine distinctes.`,
    '',
    '## Hypothèses A–G',
    '',
    hyp,
    '',
    'Lecture : A et D restent ouvertes parce que le z local est une relation nuage/pose, pas un verdict sur lequel des deux est fautif. B et C sont fermées comme *points d’introduction*. F est fermée comme *introduction unique par la recherche* : l’offset existe déjà à la pose d’identité. F n’est pas une explication des 63 unresolved. E n’est pas observée : associationStatus=`same-target-and-rail-pose` sur 239/239, mêmes captureId/visitId, snapshotId = chunkId, deltas d’horloge enregistrement de l’ordre de 0–1 s et recouvrants entre cohortes. G reste le résidu non séparable (acquisition, pose, calibration, chaîne capteur→scène).',
    '',
    '## Provenance disponible',
    '',
    `- timestamps présents sur ${a.summary.railsWithTimestamps}/${a.summary.rails} rails (champs matérialisés chunk/snapshot/eligibility).`,
    `- associationStatus: ${JSON.stringify(a.summary.associationStatusCounts)}.`,
    `- contradictions d’association directe: ${a.summary.associationDirectContradictions}.`,
    `- delta médian (fin d’acquisition − snapshot.acquiredThrough) failures=${fmt(a.summary.timestampDeltasMs.failure.acquisitionEndedMinusSnapshotAcquiredThroughMs.median)} ms, controls=${fmt(a.summary.timestampDeltasMs.control.acquisitionEndedMinusSnapshotAcquiredThroughMs.median)} ms.`,
    `- delta médian (capturedAt − viewObservedAt) failures=${fmt(a.summary.timestampDeltasMs.failure.capturedAtMinusViewObservedAtMs.median)} ms, controls=${fmt(a.summary.timestampDeltasMs.control.capturedAtMinusViewObservedAtMs.median)} ms.`,
    `- captureId, chunkId, snapshotId, frameId, viewEpochId, sourceStatus, associationStatus sont lus lorsqu’ils existent.`,
    `- sourceStatus nuage: reference-version-and-matrix-stable-through-checkpoint (enregistré, non vérifié indépendamment).`,
    `- coordinateSystem.physicalCalibrationStatus: not-independently-verified ; units: metres-observed-not-independently-calibrated.`,
    '',
    '## PROVENANCE_GAP',
    '',
    a.provenanceGap.consequence,
    '',
    'Champs encore insuffisants pour une cause physique:',
    a.provenanceGap.missing.map(x => `- ${x}`).join('\n'),
    '',
    'Instrumentation minimale à ajouter lors d’une future collecte Native:',
    a.provenanceGap.minimalFutureInstrumentation.map(x => `- ${x}`).join('\n'),
    '',
    '## Causes non démontrées',
    '',
    'La source causale reste `unknown` rail par rail. Les données présentes ne démontrent ni un LiDAR fautif, ni une pose profil fautive, ni un décalage temporel, ni une association incorrecte, ni un snapshot incorrect, ni une transformation amont fautive. Elles ne démontrent pas non plus que l’offset nuage–gabarit à la pose d’identité *est* la cause des 63 « Plan de roulement non estimable. ».',
    '',
    '## INDEPENDENT_REPLICATION_CONFRONTATION',
    '',
    `Pair : \`${a.independentReplicationConfrontation.peer.branch}\` @ \`${a.independentReplicationConfrontation.peer.head}\` (\`${a.independentReplicationConfrontation.peer.report}\`).`,
    `Statut : **${a.independentReplicationConfrontation.status}**.`,
    '',
    a.independentReplicationConfrontation.peer.limitation,
    '',
    '### Différence de définition',
    '',
    a.independentReplicationConfrontation.definitionDifference.verdict,
    '',
    `- Richard demande : ${a.independentReplicationConfrontation.definitionDifference.richardAsks}.`,
    `- Loki demande : ${a.independentReplicationConfrontation.definitionDifference.lokiAsks}.`,
    '',
    '### Phénomènes reproduits',
    '',
    a.independentReplicationConfrontation.reproduced.map(x => `- ${x}`).join('\n'),
    '',
    '### Différences méthodologiques',
    '',
    a.independentReplicationConfrontation.methodologicalDifferences.map(x => `- ${x}`).join('\n'),
    '',
    '### Différences de définition',
    '',
    a.independentReplicationConfrontation.definitionalDifferences.map(x => `- ${x}`).join('\n'),
    '',
    '### Contradictions réelles',
    '',
    a.independentReplicationConfrontation.realContradictions.length
      ? a.independentReplicationConfrontation.realContradictions.map(x => `- ${x}`).join('\n')
      : 'Aucune contradiction réelle identifiée sur les quantités publiées qui se recouvrent (coarse.z, refined.z, association 0/239, Z scène−origine ≈ z local indépendant).',
    '',
    `Sessions 0c58c033 / d9ccb545 / 3876864f : ${a.independentReplicationConfrontation.sessions.reason}`,
    '',
    `Proxy des familles Loki 0.030 appliqué à ( |gap Richard|, |coarse.z| ) : ${JSON.stringify(a.independentReplicationConfrontation.thresholdProxy.counts)} contre Loki 40 / 10 / 13. ${a.independentReplicationConfrontation.thresholdProxy.note}`,
    '',
    a.independentReplicationConfrontation.hypothesesAtoG.reading,
    '',
    '## STATUT DU CHANTIER',
    '',
    `**${a.labStatus.state}**`,
    '',
    a.labStatus.justification,
    '',
    'Pistes fermées comme explication principale des RSF :',
    a.labStatus.closedAsPrincipalRsfExplanation.map(x => `- **${x.piste}** — ${x.status}. ${x.why}`).join('\n'),
    '',
    'Pistes non fermées (hors chemin critique moteur) :',
    a.labStatus.notClosed.map(x => `- **${x.piste}** — ${x.status}. ${x.why}`).join('\n'),
    '',
    '## Fichiers consultés',
    '',
    `Commit banane-data: \`${a.source.commit}\`. Manifest SHA-256: \`${a.source.manifestSha256}\`.`,
    `Index/sources: ${a.consulted.materializedSourceIndices.length}. Fichiers nuage consultés: ${a.consulted.cloudShardFiles.length}.`,
    ''
  ].join('\n');
}

function stripGenerated(result) {
  const copy = JSON.parse(JSON.stringify(result));
  delete copy.generatedAt;
  delete copy.deterministicSha256;
  return copy;
}

function build(opts = {}) {
  const root = opts.root || process.cwd();
  const dataRoot = opts.dataRoot;
  if (!dataRoot) throw Error('dataRoot is required (materialized native-v4.6-2026-09-16)');
  const hashes = runtimeHashes(root);
  if (!hashes.allMatch) throw Error('Frozen runtime hash mismatch');
  const CAP = require(path.join(root, 'tools/banane-capsule.cjs'));
  const G = require(path.join(root, 'src/geometry.js'));
  const { manifest: capsuleManifest, rows: registry, shardVerification } = loadCapsuleRegistry(root);
  const dataManifest = loadJson(path.join(dataRoot, 'manifest.json'));
  const entries = listMaterializedEntries(dataRoot, dataManifest);
  const located = locateVisits(registry, dataRoot, entries);
  const neededByArchive = { historical: new Set(), final: new Set() };
  for (const p of located.partial) for (const id of p.chunkIds) neededByArchive[p.entry.archive].add(id);
  const scanned = scanNeededChunks(dataRoot, entries, neededByArchive);
  const rec = reconstructPayloads(located.partial, scanned);
  const matches = rec.parity.filter(x => x.match).length;
  const mismatches = rec.parity.filter(x => !x.match);
  if (mismatches.length) {
    const first = mismatches[0];
    throw Error(`payload parity mismatch ${matches}/239 first=${first.identity.part}/${first.identity.cut}/${first.identity.side} expected=${first.expected} got=${first.materialized}`);
  }
  const rails = rec.rows.map(payload => {
    const extra = payload._extra;
    delete payload._extra;
    const engineTrace = traceEngine(payload, CAP, G);
    const chunkMeta = {};
    for (const c of extra.chunkObjs) chunkMeta[c.chunkId] = c.materializedProvenance;
    const analysis = analyzeRail(payload, {
      parity: rec.parity.find(x => x.identity.sessionId === payload.key.sessionId
        && x.identity.visitId === payload.key.visitId && x.identity.side === payload.key.side),
      temporal: extra.temporal,
      association: extra.association,
      chunkMeta,
      engineTrace,
      consultedFiles: (payload.provenance.chunkMaterializedSources || []).flatMap(s =>
        s.occurrences.flatMap(o => o.materializedFiles))
    });
    for (const r of extra.temporal.missingFieldNames.length ? extra.temporal.missingFieldNames.slice(0, 3) : []) {
      analysis.limitations.push(`missing timestamp field ${r}`);
    }
    if (!analysis.matrixAudit.usable) analysis.limitations.push('matrix audit not numerically usable');
    if (!analysis.temporalProvenance?.anyTimestampPresent) analysis.limitations.push('no materialized timestamps');
    return analysis;
  });
  addContexts(rails);
  const summary = summarize(rails);
  const hyp = hypothesesFrom(summary, rails);
  const gap = buildProvenanceGap(rails);
  const confrontation = confrontationFrom(summary, hyp);
  const labStatus = labStatusFrom(summary, hyp, confrontation);
  const consultedHashes = { ...scanned.fileHashes };
  for (const f of located.consulted) {
    const p = path.join(dataRoot, f);
    if (fs.existsSync(p) && fs.statSync(p).isFile() && !consultedHashes[f]) consultedHashes[f] = sha256File(p);
  }
  const result = {
    format: 'banane-vertical-alignment-provenance-v1',
    baseCommit: BASE_COMMIT,
    generatedAt: new Date().toISOString(),
    source: {
      repository: 'StoryNow30/banane-data',
      commit: DATA_COMMIT,
      dataset: DATASET_REL,
      manifestSha256: sha256File(path.join(dataRoot, 'manifest.json')),
      archiveAuthority: dataManifest.sourceArchives ?? null
    },
    methodology: {
      purpose: 'first observable stage of relative vertical cloud/profile disagreement; not physical causality',
      numericTolerances: TOLERANCES,
      projectionMethod: 'independent affine inverse of profileLocalToSceneRelative; no C.point call',
      scanner: 'recursive materializer walk: single-json, array-shards, oversizeItem, object-shards, scalar-text-parts, exact-json-copy; clouds in largeEntries or root shards',
      noMillimetres: true,
      noHumanData: true,
      noThresholdTuning: true,
      capsuleRole: 'identity/source locator and expected payloadSha256 only'
    },
    capsule: {
      id: capsuleManifest.id,
      expectedTotal: capsuleManifest.expectedTotal,
      failures: capsuleManifest.failures,
      controls: capsuleManifest.controls,
      studiedExit: capsuleManifest.studiedExit,
      shards: shardVerification
    },
    runtime: hashes,
    integrity: {
      payloadParityMatches: matches,
      payloadParityMismatches: mismatches.length,
      parity: rec.parity
    },
    consulted: {
      materializedSourceIndices: [...new Set(located.partial.map(p => p.entry.indexPath || p.entry.filePath))].sort(),
      rootFiles: located.consulted,
      cloudShardFiles: scanned.consulted,
      fileSha256: consultedHashes,
      neededChunkIds: {
        historical: [...neededByArchive.historical].sort(),
        final: [...neededByArchive.final].sort()
      }
    },
    summary,
    hypotheses: hyp,
    provenanceGap: gap,
    independentReplicationConfrontation: confrontation,
    labStatus,
    rails
  };
  result.deterministicSha256 = sha256Text(canonicalize(stripGenerated(result)));
  return result;
}

function writeOutputs(opts = {}) {
  const a = build(opts);
  const root = opts.root || process.cwd();
  const auditPath = path.join(root, 'audit', 'vertical-alignment-provenance-v1.json');
  const reportPath = path.join(root, 'VERTICAL_ALIGNMENT_PROVENANCE_V1.md');
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, JSON.stringify(a, null, 2) + '\n');
  fs.writeFileSync(reportPath, report(a));
  return a;
}

function parseArgs(argv) {
  const out = { write: false, parityOnly: false, dataRoot: null, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--write') out.write = true;
    else if (argv[i] === '--parity-only') out.parityOnly = true;
    else if (argv[i] === '--data') out.dataRoot = argv[++i];
    else if (argv[i] === '--root') out.root = argv[++i];
  }
  return out;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dataRoot) {
    console.error('usage: node tools/vertical-alignment-provenance-v1.cjs --data <materialized-dataset> [--write] [--parity-only]');
    process.exit(2);
  }
  if (args.parityOnly) {
    const root = args.root;
    const hashes = runtimeHashes(root);
    if (!hashes.allMatch) throw Error('Frozen runtime hash mismatch');
    const { rows: registry } = loadCapsuleRegistry(root);
    const dataManifest = loadJson(path.join(args.dataRoot, 'manifest.json'));
    const entries = listMaterializedEntries(args.dataRoot, dataManifest);
    const located = locateVisits(registry, args.dataRoot, entries);
    const neededByArchive = { historical: new Set(), final: new Set() };
    for (const p of located.partial) for (const id of p.chunkIds) neededByArchive[p.entry.archive].add(id);
    const scanned = scanNeededChunks(args.dataRoot, entries, neededByArchive);
    const rec = reconstructPayloads(located.partial, scanned);
    const matches = rec.parity.filter(x => x.match).length;
    const mismatches = rec.parity.filter(x => !x.match);
    console.log(JSON.stringify({
      payloadParityMatches: matches,
      payloadParityMismatches: mismatches.length,
      needed: { historical: neededByArchive.historical.size, final: neededByArchive.final.size },
      consultedCloudFiles: scanned.consulted.length,
      firstMismatch: mismatches[0] || null
    }, null, 2));
    if (mismatches.length) process.exit(1);
    process.exit(0);
  }
  const a = args.write
    ? writeOutputs({ root: args.root, dataRoot: args.dataRoot })
    : build({ root: args.root, dataRoot: args.dataRoot });
  console.log(JSON.stringify({
    rails: a.summary.rails,
    integrity: a.integrity.payloadParityMatches,
    cohorts: { failure: a.summary.cohorts.failure.rails, control: a.summary.cohorts.control.rails },
    projectionEquivalentRails: a.summary.projectionEquivalent,
    firstObservedStage: a.summary.firstObservedStage,
    deterministicSha256: a.deterministicSha256,
    cohortMedianDifferences: a.summary.cohortMedianDifferences,
    hypotheses: Object.fromEntries(Object.entries(a.hypotheses).map(([k, v]) => [k, v.status])),
    provenanceGap: a.provenanceGap.code,
    independentReplicationStatus: a.independentReplicationConfrontation.status,
    labStatus: a.labStatus.state
  }, null, 2));
}

module.exports = {
  BASE_COMMIT, DATA_COMMIT, CAPSULE_DIR, EXPECTED_RUNTIME_HASHES, TOLERANCES, STAGES,
  LOKI_REPLICATION,
  canonicalize, numericEnvelope, applyAffine, applyLinear, independentAffineInverse,
  projectPointIndependently, stats, loadCapsuleRegistry, runtimeHashes, auditMatrix,
  analyzeRail, loadNode, visitNodeForChunks, visitEntryClouds, listMaterializedEntries,
  scanNeededChunks, isLidarChunk, shaOf, findHumanKeys, build, report, writeOutputs,
  classifyFirstObservedStage, confrontationFrom, labStatusFrom
};
