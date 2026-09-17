#!/usr/bin/env node
'use strict';
/* Lecture des JSON Natif V4.6 matérialisés (shards + copies exactes).
 * Aucune reconstruction complète inutile : records d'abord, chunks à la demande. */
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT = process.env.BANANE_DATA_NATIVE
  || '/workspace/banane-data/datasets/native-v4.6-2026-09-16';
const REF = {
  repo: 'StoryNow30/banane-data',
  branch: 'infra/materialized-native-v46-v1',
  head: 'd541686d3a98569125cdbdb261ef121c9f533d6a',
  dataset: 'datasets/native-v4.6-2026-09-16',
};

function derefer(dictionaries) {
  const seen = new WeakMap();
  return function deref(v) {
    if (Array.isArray(v)) return v.map(deref);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === '__ref') {
        const [name, i] = v.__ref.split(':');
        const table = dictionaries[name];
        if (!table) throw Error('dictionnaire compact absent : ' + name);
        const hit = table[Number(i)];
        if (hit === undefined) throw Error('référence compacte absente : ' + v.__ref);
        return deref(hit);
      }
      if (seen.has(v)) return seen.get(v);
      const out = {};
      seen.set(v, out);
      for (const k of keys) out[k] = deref(v[k]);
      return out;
    }
    return v;
  };
}

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function datasetRoot(root = DEFAULT_ROOT) { return path.resolve(root); }

function loadManifest(root = DEFAULT_ROOT) {
  const base = datasetRoot(root);
  const manifest = loadJson(path.join(base, 'manifest.json'));
  return { base, manifest };
}

function loadNode(base, node, skipKeys = new Set()) {
  if (!node || typeof node !== 'object') throw Error('nœud de shard invalide');
  if (node.kind === 'single-json') return loadJson(path.join(base, node.file.path));
  if (node.kind === 'array-shards') {
    const out = [];
    for (const shard of node.shards) {
      if (shard && shard.oversizeItem) out.push(loadNode(base, shard.node, skipKeys));
      else out.push(...loadJson(path.join(base, shard.path)));
    }
    return out;
  }
  if (node.kind === 'object-shards') {
    const out = {};
    for (const shard of node.shards) Object.assign(out, loadJson(path.join(base, shard.path)));
    for (const [key, child] of Object.entries(node.largeEntries || {})) {
      if (skipKeys.has(key)) continue;
      out[key] = loadNode(base, child, skipKeys);
    }
    return out;
  }
  if (node.kind === 'scalar-text-parts') {
    const text = node.parts.map(p => fs.readFileSync(path.join(base, p.path), 'utf8')).join('');
    return JSON.parse(text);
  }
  throw Error('kind de shard inconnu : ' + node.kind);
}

function railsNodeFrom(rootNode) {
  const dicts = rootNode && rootNode.largeEntries && rootNode.largeEntries.dictionaries;
  if (dicts && dicts.kind === 'object-shards') return dicts.largeEntries && dicts.largeEntries.rails || null;
  return null;
}

function loadShardedDocument(base, fileEntry, skipKeys = new Set(['clouds', 'events', 'rails'])) {
  if (fileEntry.representation === 'exact-json-copy') {
    const p = path.join(base, fileEntry.outputs[0].path);
    return { kind: 'exact', file: p, doc: loadJson(p), cloudsNode: null, railsNode: null };
  }
  const indexPath = path.join(base, fileEntry.index.path);
  const idx = loadJson(indexPath);
  const node = idx.semanticRepresentation;
  if (node.kind !== 'object-shards') throw Error('unexpected semantic kind ' + node.kind);
  const doc = loadNode(base, node, skipKeys);
  return {
    kind: 'sharded',
    file: indexPath,
    doc,
    cloudsNode: node.largeEntries && node.largeEntries.clouds,
    railsNode: railsNodeFrom(node),
  };
}

function listNativeFiles(root = DEFAULT_ROOT) {
  const { base, manifest } = loadManifest(root);
  return { base, manifest, files: manifest.files };
}

/** Charge records + dictionnaires légers (sans nappes rails ni nuages) pour TOUS les segments. */
function loadVisitDocuments(root = DEFAULT_ROOT) {
  const { base, files } = listNativeFiles(root);
  const docs = [];
  for (const entry of files) {
    const loaded = loadShardedDocument(base, entry, new Set(['clouds', 'events', 'rails']));
    const raw = loaded.doc;
    if (!raw.session || !raw.records) continue;
    docs.push({
      cohort: entry.cohort,
      sourceRelPath: entry.sourceRelPath,
      stamp: raw.segment?.stamp || raw.exportedAt || '',
      sessionId: raw.session.id,
      file: loaded.file,
      kind: loaded.kind,
      cloudsNode: loaded.cloudsNode || null,
      railsNode: loaded.railsNode || null,
      exactDoc: loaded.kind === 'exact' ? raw : null,
      records: raw.records,
      dictionaries: raw.dictionaries || {},
      session: raw.session,
    });
  }
  return { base, docs };
}

function ensureRailsDictionary(base, doc) {
  if (!doc) return;
  if (doc.dictionaries && Array.isArray(doc.dictionaries.rails) && doc.dictionaries.rails.length) return;
  if (doc.kind === 'exact' && doc.exactDoc?.dictionaries?.rails) {
    doc.dictionaries = doc.dictionaries || {};
    doc.dictionaries.rails = doc.exactDoc.dictionaries.rails;
    return;
  }
  if (!doc.railsNode) return;
  doc.dictionaries = doc.dictionaries || {};
  doc.dictionaries.rails = loadNode(base, doc.railsNode);
}

function hydrateRailPoses(base, visit) {
  ensureRailsDictionary(base, visit._doc);
  const deref = derefer(visit._doc.dictionaries || {});
  visit.railSnapshots = deref(visit._rawSnapshots);
  visit.humanFinalReference = deref(visit.humanFinalReference);
}

/** Export le plus tardif par session (stamp), comme native-replay. */
function latestDocsPerSession(docs) {
  const latest = new Map();
  for (const d of docs) {
    const prev = latest.get(d.sessionId);
    if (!prev || d.stamp > prev.stamp) latest.set(d.sessionId, d);
  }
  return latest;
}

function readVisits(root = DEFAULT_ROOT) {
  const { base, docs } = loadVisitDocuments(root);
  const visits = [];
  const byVisitId = new Map();
  for (const d of docs) {
    const deref = derefer(d.dictionaries || {});
    for (const r of d.records) {
      const prev = byVisitId.get(r.visitId);
      if (prev && prev.stamp >= d.stamp) continue;
      const visit = {
        cohort: d.cohort,
        sessionId: d.sessionId,
        sourceFile: d.file,
        stamp: d.stamp,
        visitId: r.visitId,
        visitIndex: r.visitIndex,
        identity: deref(r.identity),
        status: r.status,
        lidarStatus: r.lidarStatus ?? null,
        geometryEligibility: deref(r.geometryEligibility ?? null),
        railSnapshots: r.railSnapshots ?? null,
        humanFinalReference: r.humanFinalReference ?? null,
        usableForTraining: r.usableForTraining === true,
        _doc: d,
        _rawSnapshots: r.railSnapshots ?? null,
      };
      byVisitId.set(r.visitId, visit);
    }
  }
  for (const v of byVisitId.values()) visits.push(v);
  return { base, docs, visits };
}

function collectNeededChunkIds(visits) {
  const needed = new Set();
  for (const v of visits) {
    for (const side of ['left', 'right']) {
      const el = v.geometryEligibility?.[side];
      if (el?.status !== 'comparable-candidate') continue;
      for (const id of el.chunkIds || []) needed.add(id);
    }
  }
  return needed;
}

function ingestCloudArray(arr, needed, out) {
  for (const c of arr) {
    if (!c || c.format !== 'banane-native-lidar-chunk-v1') continue;
    if (!needed.has(c.chunkId) || out.has(c.chunkId)) continue;
    out.set(c.chunkId, {
      chunkId: c.chunkId,
      side: c.side,
      points: c.pointsSceneRelative,
      visible: c.visibleByClipBoxes ?? null,
    });
  }
}

function loadNeededChunks(base, docs, needed) {
  const out = new Map();
  if (!needed.size) return out;
  for (const d of docs) {
    if (out.size === needed.size) break;
    if (d.kind === 'exact' && d.exactDoc?.clouds) {
      ingestCloudArray(d.exactDoc.clouds, needed, out);
      continue;
    }
    const node = d.cloudsNode;
    if (!node || node.kind !== 'array-shards') continue;
    for (const shard of node.shards) {
      if (out.size === needed.size) break;
      const shardPath = path.join(base, shard.path);
      const text = fs.readFileSync(shardPath, 'utf8');
      let hit = false;
      for (const id of needed) { if (!out.has(id) && text.includes(id)) { hit = true; break; } }
      if (!hit) continue;
      ingestCloudArray(JSON.parse(text), needed, out);
    }
  }
  return out;
}

function initialRail(visit, side) {
  const snaps = visit.railSnapshots?.[side];
  const el = visit.geometryEligibility?.[side];
  if (!Array.isArray(snaps) || !snaps.length) return { rail: null, reason: 'pose-initiale-absente' };
  const byId = el?.snapshotId && snaps.find(s => s.snapshotId === el.snapshotId);
  if (el?.snapshotId && !byId) return { rail: null, reason: 'snapshot-exact-absent:' + el.snapshotId };
  return { rail: (byId || snaps[snaps.length - 1]).rail ?? null, reason: null };
}

function assembleCapture(visit, side, chunks) {
  const el = visit.geometryEligibility?.[side] ?? null;
  const status = el?.status ?? 'absent';
  if (status !== 'comparable-candidate')
    return { ready: false, eligibility: status, reasons: el?.reasons ?? [], capture: null };
  const init = initialRail(visit, side);
  if (!init.rail) return { ready: false, eligibility: status, reasons: [init.reason], capture: null };
  const ids = el.chunkIds ?? [];
  const points = [], visible = [];
  let missing = 0;
  for (const id of ids) {
    const c = chunks.get(id);
    if (!c) { missing++; continue; }
    for (let i = 0; i < c.points.length; i++) {
      if (c.visible ? c.visible[i] !== true : false) continue;
      points.push(c.points[i]);
      visible.push(true);
    }
  }
  if (missing) return { ready: false, eligibility: status, reasons: [`chunks-absents:${missing}/${ids.length}`], capture: null };
  if (!points.length) return { ready: false, eligibility: status, reasons: ['aucun-point'], capture: null };
  return {
    ready: true, eligibility: status, reasons: [], points: points.length,
    capture: { rails: { [side]: init.rail }, pointsSceneRelative: points, visibleByClipBoxes: visible },
  };
}

function humanDeltaLocal(visit, side, rail) {
  const ref = visit.humanFinalReference;
  if (!ref || ref.status !== 'candidate-observed') return null;
  const finalRail = ref.state?.rails?.[side];
  if (!finalRail || !rail) return null;
  const a = rail.profileOriginSceneRelative, b = finalRail.profileOriginSceneRelative;
  if (!a || !b) return null;
  const C = require('../vendor/capture-core.js');
  const o = C.point(rail.sceneRelativeToProfileLocal, [0, 0, 0]);
  const w = C.point(rail.sceneRelativeToProfileLocal, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  return [w[0] - o[0], w[1] - o[1], w[2] - o[2]];
}

function railKey(visit, side) {
  const id = visit.identity || {};
  return [visit.sessionId, visit.visitId, id.part, id.cut, side].join('|');
}

module.exports = {
  REF, DEFAULT_ROOT, derefer, loadManifest, loadVisitDocuments, readVisits,
  collectNeededChunkIds, loadNeededChunks, assembleCapture, initialRail,
  humanDeltaLocal, railKey, latestDocsPerSession, loadNode, ensureRailsDictionary, hydrateRailPoses,
};
