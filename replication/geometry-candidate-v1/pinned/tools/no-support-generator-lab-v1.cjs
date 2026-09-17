#!/usr/bin/env node
'use strict';
/* No-Support Generator Lab V1 — branche lab-no-support-generator-v1.
 * Outil OFFLINE. Ne modifie pas le moteur. Ne merge rien. Aucune action ESV.
 * Question : les 53 failures n’ont-ils réellement aucun support observable,
 * ou le moteur ne regarde-t-il pas au bon endroit / à la bonne résolution ? */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const RSF = 'Plan de roulement non estimable.';
const MIN_TOP = 3;
const ENGINE_Y = G.DEFAULTS.searchY;
const ENGINE_Z = G.DEFAULTS.searchZ;
const ENGINE_GRID = G.DEFAULTS.grid;
const TOP_BAND = G.DEFAULTS.topBand;
const FACE_BAND = G.DEFAULTS.faceBand;
const CATEGORIES = Object.freeze([
  'NO_SUPPORT_FOUND',
  'SUPPORT_BETWEEN_GRID',
  'SUPPORT_OUTSIDE_Z',
  'SUPPORT_OUTSIDE_U',
  'SUPPORT_OUTSIDE_UZ',
  'SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE',
  'INCONCLUSIVE',
]);

const POP_PATH = path.join(ROOT, 'audit/no-support-population-v1.json');

const EXPERIMENTS = Object.freeze({
  A_ENGINE: {
    id: 'A', title: 'grille actuelle',
    searchY: ENGINE_Y, searchZ: ENGINE_Z, grid: ENGINE_GRID,
    keepMap: true, computeLoss: true,
  },
  B_DENSE: {
    id: 'B', title: 'même domaine, grille plus dense',
    searchY: ENGINE_Y, searchZ: ENGINE_Z, grid: 0.001,
    keepMap: false, computeLoss: false,
  },
  C_EXT_Z: {
    id: 'C', title: 'extension Z seulement',
    searchY: ENGINE_Y, searchZ: 0.10, grid: ENGINE_GRID,
    keepMap: false, computeLoss: false,
  },
  D_EXT_U: {
    id: 'D', title: 'extension U seulement',
    searchY: 0.20, searchZ: ENGINE_Z, grid: ENGINE_GRID,
    keepMap: false, computeLoss: false,
  },
  E_EXT_UZ: {
    id: 'E', title: 'extension U+Z',
    searchY: 0.20, searchZ: 0.10, grid: ENGINE_GRID,
    keepMap: false, computeLoss: false,
  },
});

function loadPopulation() {
  const pop = JSON.parse(fs.readFileSync(POP_PATH, 'utf8'));
  if (!Array.isArray(pop.failureKeys) || pop.failureKeys.length !== 53)
    throw Error('population 53 invalide');
  if (!Array.isArray(pop.excludedFamilyKeys) || pop.excludedFamilyKeys.length !== 6)
    throw Error('exclusion 4+2 invalide');
  return pop;
}

function parseKey(key) {
  const [sessionId, visitId, part, cut, side] = key.split('|');
  return { sessionId, visitId, part: Number(part), cut: Number(cut), side, key };
}

function atBound(v, limit, grid) {
  return Math.abs(Math.abs(v) - limit) <= grid * 0.51;
}

function distOutsideDomain(u, z, yLim = ENGINE_Y, zLim = ENGINE_Z) {
  const du = Math.max(0, Math.abs(u) - yLim);
  const dz = Math.max(0, Math.abs(z) - zLim);
  return { du, dz, outsideU: du > 1e-9, outsideZ: dz > 1e-9, dist: Math.hypot(du, dz) };
}

function prepareFrame(capture, side, pointBox = { lat: 0.18, z: 0.10, x: 0.5 }) {
  const rail = capture.rails?.[side];
  if (!rail) return { ok: false, reason: 'Profil absent.' };
  if (!capture.pointsSceneRelative?.length) return { ok: false, reason: 'Aucun point LiDAR disponible.' };
  const contour = rail.profileContours?.reduce(
    (a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a,
    null,
  );
  if (!contour) return { ok: false, reason: 'Contour du profil absent.' };
  const shape = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(G.median(shape.map(p => p[1])));
  if (!sign) return { ok: false, reason: 'Sens du profil ambigu.' };
  const vertices = shape.map(p => [sign * p[1], p[2]]);
  const head = vertices.filter(p => p[1] > -0.04);
  if (head.length < 6) return { ok: false, reason: 'Contour de champignon non reconnu.' };
  const points = [];
  let rawAccepted = 0, skippedClip = 0, skippedBox = 0, skippedNonFinite = 0;
  const allZ = [], allU = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes?.[i] === false) { skippedClip++; continue; }
    const src = capture.pointsSceneRelative[i];
    if (!Array.isArray(src) || !src.every(Number.isFinite)) { skippedNonFinite++; continue; }
    const q = C.point(rail.sceneRelativeToProfileLocal, src);
    if (!q.every(Number.isFinite)) { skippedNonFinite++; continue; }
    const u = sign * q[1], z = q[2];
    allU.push(u); allZ.push(z);
    if (Math.abs(q[0]) <= pointBox.x && Math.abs(q[1]) < pointBox.lat && Math.abs(q[2]) < pointBox.z) {
      points.push([u, z, q[0]]);
      rawAccepted++;
    } else skippedBox++;
  }
  if (points.length < 8) return { ok: false, reason: 'Trop peu de points autour du champignon.', pointsLocal: points.length };
  const width = Math.max(...head.filter(p => p[1] > -0.012).map(p => p[0]));
  if (!(width > 0.025 && width < 0.12)) return { ok: false, reason: 'Dimensions du profil hors du domaine testé.', width };
  const topAnchors = [];
  for (let u = 0.012; u < width - 0.012; u += 0.006) {
    const near = head.filter(p => Math.abs(p[0] - u) < 0.004);
    if (near.length) topAnchors.push([u, Math.max(...near.map(p => p[1]))]);
  }
  const faceAnchors = [];
  for (let z = -0.014; z >= -0.033; z -= 0.004) {
    const near = head.filter(p => Math.abs(p[1] - z) < 0.004);
    if (near.length) faceAnchors.push([Math.min(...near.map(p => p[0])), z]);
  }
  if (topAnchors.length < 3 || faceAnchors.length < 3)
    return { ok: false, reason: 'Surfaces du profil non identifiées.' };
  const zs = points.map(p => p[1]).slice().sort((a, b) => a - b);
  const us = points.map(p => p[0]).slice().sort((a, b) => a - b);
  let nOutsideU = 0, nOutsideZ = 0;
  for (const p of points) {
    if (Math.abs(p[0]) > ENGINE_Y) nOutsideU++;
    if (Math.abs(p[1]) > ENGINE_Z) nOutsideZ++;
  }
  return {
    ok: true, sign, width, points, topAnchors, faceAnchors, head,
    zMedian: zs[zs.length >> 1],
    uMedian: us[us.length >> 1],
    zMin: zs[0], zMax: zs[zs.length - 1],
    uMin: us[0], uMax: us[us.length - 1],
    pointsLocal: points.length,
    nOutsideU, nOutsideZ,
    fracOutsideU: nOutsideU / points.length,
    fracOutsideZ: nOutsideZ / points.length,
    counts: { rawAccepted, skippedClip, skippedBox, skippedNonFinite, raw: capture.pointsSceneRelative.length },
    allPointStats: allZ.length ? {
      n: allZ.length,
      zMedian: allZ.slice().sort((a, b) => a - b)[allZ.length >> 1],
      uMedian: allU.slice().sort((a, b) => a - b)[allU.length >> 1],
    } : null,
  };
}

function topRowsAt(points, width, u, z, topBand = TOP_BAND) {
  const lo = u + 0.012, hi = u + width - 0.012;
  if (!(hi > lo)) return 0;
  let n = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p[0] > lo && p[0] < hi && Math.abs(p[1] - z) < topBand) n++;
  }
  return n;
}

function templateLoss(frame, u, z) {
  const { topAnchors, faceAnchors, points } = frame;
  const of = (anchors) => G.median(anchors.map(a => {
    let best = 0.025 * 0.025;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const d = (p[0] - u - a[0]) ** 2 + (p[1] - z - a[1]) ** 2;
      if (d < best) best = d;
    }
    return best;
  }));
  return of(topAnchors) + of(faceAnchors) + 1e-7 * (Math.abs(u) + Math.abs(z));
}

function binsTopAt(points, width, u, z, topBand = TOP_BAND) {
  const lo = u + 0.012, hi = u + width - 0.012;
  const bins = new Set();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p[0] > lo && p[0] < hi && Math.abs(p[1] - z) < topBand) bins.add(Math.floor(p[0] / 0.006));
  }
  return bins.size;
}

function faceAt(frame, u, z) {
  const { points, width } = frame;
  const lo = u + 0.012, hi = u + width - 0.012;
  const topRows = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p[0] > lo && p[0] < hi && Math.abs(p[1] - z) < TOP_BAND) topRows.push([p[0], p[1]]);
  }
  const top = G.robustLine(topRows);
  if (!top) return { topRows: topRows.length, top: null, faceCount: 0, face: null, binsTop: 0, slopeLimited: false };
  const faceRows = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const drop = top.slope * p[0] + top.intercept - p[1];
    if (drop > 0.009 && drop < 0.034 && Math.abs(p[0] - u) < FACE_BAND) faceRows.push([p[1], p[0]]);
  }
  const face = G.robustLine(faceRows);
  return {
    topRows: top.count,
    top,
    faceCount: face?.count || 0,
    face,
    binsTop: new Set(topRows.map(p => Math.floor(p[0] / 0.006))).size,
    slopeLimited: !!(top.slopeLimited || face?.slopeLimited),
  };
}

function scanGrid(frame, spec, opts = {}) {
  const searchY = spec.searchY, searchZ = spec.searchZ, grid = spec.grid;
  const computeLoss = opts.computeLoss ?? spec.computeLoss;
  const keepMap = opts.keepMap ?? spec.keepMap;
  const keepHits = opts.keepHits !== false;
  const { points, width } = frame;
  let nCells = 0, nSupported = 0, maxTopRows = 0;
  let lossBest = { loss: Infinity, u: 0, z: 0, topRows: 0 };
  let supportBest = null;
  const hits = [];
  const us = [], zs = [];
  for (let u = -searchY; u <= searchY + 1e-10; u += grid) us.push(u);
  for (let z = -searchZ; z <= searchZ + 1e-10; z += grid) zs.push(z);
  const topMap = keepMap ? new Array(us.length * zs.length) : null;
  const lossMap = keepMap && computeLoss ? new Array(us.length * zs.length) : null;
  for (let iz = 0; iz < zs.length; iz++) {
    const z = zs[iz];
    for (let iu = 0; iu < us.length; iu++) {
      const u = us[iu];
      nCells++;
      const n = topRowsAt(points, width, u, z);
      if (n > maxTopRows) maxTopRows = n;
      if (keepMap) topMap[iz * us.length + iu] = n;
      let loss = null;
      if (computeLoss) {
        loss = templateLoss(frame, u, z);
        if (keepMap) lossMap[iz * us.length + iu] = loss;
        if (loss < lossBest.loss) lossBest = { loss, u, z, topRows: n };
      }
      if (n >= MIN_TOP) {
        nSupported++;
        const rec = { u, z, topRows: n, loss };
        if (!supportBest || n > supportBest.topRows || (n === supportBest.topRows && (loss ?? Infinity) < (supportBest.loss ?? Infinity)))
          supportBest = rec;
        if (keepHits) hits.push(rec);
      }
    }
  }
  hits.sort((a, b) => b.topRows - a.topRows || (a.loss ?? 1) - (b.loss ?? 1));
  const topHits = hits.slice(0, 24);
  for (const h of topHits) {
    if (h.loss == null) h.loss = templateLoss(frame, h.u, h.z);
    const geo = faceAt(frame, h.u, h.z);
    h.faceCount = geo.faceCount;
    h.binsTop = geo.binsTop;
    h.slopeLimited = geo.slopeLimited;
    h.topSlope = geo.top?.slope ?? null;
    const d = distOutsideDomain(h.u, h.z);
    h.outsideU = d.outsideU;
    h.outsideZ = d.outsideZ;
    h.distOutside = d.dist;
    h.distSeed = Math.hypot(h.u, h.z);
  }
  if (supportBest && supportBest.loss == null) supportBest.loss = templateLoss(frame, supportBest.u, supportBest.z);
  if (supportBest) {
    const geo = faceAt(frame, supportBest.u, supportBest.z);
    supportBest = {
      ...supportBest,
      faceCount: geo.faceCount,
      binsTop: geo.binsTop,
      slopeLimited: geo.slopeLimited,
      topSlope: geo.top?.slope ?? null,
      ...(() => {
        const d = distOutsideDomain(supportBest.u, supportBest.z);
        return { outsideU: d.outsideU, outsideZ: d.outsideZ, distOutside: d.dist, distSeed: Math.hypot(supportBest.u, supportBest.z) };
      })(),
    };
  }
  const map = keepMap ? {
    searchY, searchZ, grid,
    nu: us.length, nz: zs.length,
    u0: us[0], z0: zs[0],
    topRows: topMap,
    loss: lossMap,
  } : null;
  return {
    id: spec.id, title: spec.title, searchY, searchZ, grid,
    nCells, nSupported, maxTopRows,
    lossBest: computeLoss ? {
      ...lossBest,
      uAtBound: atBound(lossBest.u, searchY, grid),
      zAtBound: atBound(lossBest.z, searchZ, grid),
    } : null,
    supportBest,
    hits: topHits,
    nHitsKept: topHits.length,
    map,
  };
}

function downsampleMap(map, maxU = 40, maxZ = 28) {
  if (!map) return null;
  const { nu, nz, topRows, loss, u0, z0, grid } = map;
  const su = Math.max(1, Math.ceil(nu / maxU));
  const sz = Math.max(1, Math.ceil(nz / maxZ));
  const ou = Math.ceil(nu / su), oz = Math.ceil(nz / sz);
  const t = new Array(ou * oz).fill(0);
  const l = loss ? new Array(ou * oz).fill(Infinity) : null;
  for (let iz = 0; iz < nz; iz++) {
    for (let iu = 0; iu < nu; iu++) {
      const ou_ = Math.floor(iu / su), oz_ = Math.floor(iz / sz);
      const i = oz_ * ou + ou_;
      const v = topRows[iz * nu + iu];
      if (v > t[i]) t[i] = v;
      if (l) {
        const lv = loss[iz * nu + iu];
        if (lv < l[i]) l[i] = lv;
      }
    }
  }
  return {
    nu: ou, nz: oz, u0, z0,
    du: grid * su, dz: grid * sz,
    topRows: t,
    lossE6: l ? l.map(v => (Number.isFinite(v) ? Math.round(v * 1e6) : null)) : null,
  };
}

function isPlausible(hit, engineLoss) {
  if (!hit || hit.topRows < MIN_TOP) return false;
  const cap = Math.max(5e-4, (engineLoss || 1e-4) * 25);
  if (hit.loss != null && hit.loss > cap) return false;
  if ((hit.binsTop || 0) < 2 && hit.topRows < 6) return false;
  return true;
}

function classifyRail(scans, engineLoss, role = 'failure') {
  const A = scans.A_ENGINE, B = scans.B_DENSE, C = scans.C_EXT_Z, D = scans.D_EXT_U, E = scans.E_EXT_UZ;
  const X = scans.DENSE_EXT;
  if (!A || !B || !C || !D || !E) return { category: 'INCONCLUSIVE', reason: 'scan-incomplet' };

  function consider(s, acc) {
    if (!s) return;
    if (s.supportBest) acc.push(s.supportBest);
    for (const h of s.hits || []) acc.push(h);
  }
  const allHits = [];
  for (const s of [A, B, C, D, E, X]) consider(s, allHits);
  const any = [A, B, C, D, E, X].some(s => (s?.nSupported || 0) > 0);
  const inEngineGrid = A.nSupported > 0;

  let best = null;
  for (const h of allHits) {
    if (!h || h.topRows < MIN_TOP) continue;
    if (!best || h.topRows > best.topRows || (h.topRows === best.topRows && (h.loss ?? Infinity) < (best.loss ?? Infinity)))
      best = h;
  }

  const outsideZAny = allHits.some(h => h.outsideZ && !h.outsideU);
  const outsideUAny = allHits.some(h => h.outsideU && !h.outsideZ);
  const outsideUZAny = allHits.some(h => h.outsideU && h.outsideZ);
  const denseInDomain = (B.nSupported > 0) || allHits.some(h => !h.outsideU && !h.outsideZ && h.topRows >= MIN_TOP);

  let location = 'NO_SUPPORT_FOUND';
  if (role === 'control' && inEngineGrid) {
    location = 'ENGINE_SUPPORT_PRESENT';
  } else if (!best) {
    location = any ? 'INCONCLUSIVE' : 'NO_SUPPORT_FOUND';
  } else {
    const d = distOutsideDomain(best.u, best.z);
    if (!d.outsideU && !d.outsideZ) {
      if (inEngineGrid) location = 'INCONCLUSIVE';
      else location = 'SUPPORT_BETWEEN_GRID';
    } else if (d.outsideU && d.outsideZ) location = 'SUPPORT_OUTSIDE_UZ';
    else if (d.outsideU) location = 'SUPPORT_OUTSIDE_U';
    else location = 'SUPPORT_OUTSIDE_Z';
  }

  const candidates = allHits.filter(h => isPlausible(h, engineLoss));
  let category = location;
  if (best && location !== 'NO_SUPPORT_FOUND' && location !== 'INCONCLUSIVE' && location !== 'ENGINE_SUPPORT_PRESENT' && !isPlausible(best, engineLoss) && candidates.length === 0)
    category = 'SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE';

  return {
    category,
    location,
    inEngineGrid,
    inDomainDense: denseInDomain,
    outsideZ: outsideZAny,
    outsideU: outsideUAny,
    outsideUZ: outsideUZAny,
    anySupport: any,
    nPlausible: candidates.length,
    denseExtSupported: X?.nSupported || 0,
    bestHit: best ? compactHit(best) : null,
    competingOutsideZ: outsideZAny && location === 'SUPPORT_OUTSIDE_U',
    reason: category === 'INCONCLUSIVE' && inEngineGrid && role === 'failure'
      ? 'support-sur-grille-moteur-alors-que-famille-53-annonce-zero'
      : null,
  };
}

function pickControls(baselineRows, failureKeys, excludedKeys, n) {
  const failSet = new Set(failureKeys);
  const excl = new Set(excludedKeys);
  const failures = failureKeys.map(parseKey);
  const pool = baselineRows
    .filter(r => r.status === 'candidate' && !failSet.has(r.key) && !excl.has(r.key))
    .map(r => ({ ...parseKey(r.key), cut: r.cut, side: r.side, sessionId: r.sessionId, key: r.key, loss: r.loss, topRows: r.topRows }));
  const used = new Set();
  const picked = [];

  function scoreOf(f, c, requireSession) {
    if (requireSession && c.sessionId !== f.sessionId) return Infinity;
    const sameSession = c.sessionId === f.sessionId ? 0 : 1;
    const sameSide = c.side === f.side ? 0 : 1;
    const dCut = Math.abs((c.cut || 0) - (f.cut || 0));
    return sameSession * 1e6 + sameSide * 1e4 + dCut;
  }

  function assign(requireSession) {
    for (const f of failures) {
      if (picked.find(p => p.pairedFailure === f.key)) continue;
      let best = null, bestScore = Infinity;
      for (const c of pool) {
        if (used.has(c.key)) continue;
        const score = scoreOf(f, c, requireSession);
        if (score < bestScore) { bestScore = score; best = c; }
      }
      if (best && bestScore < Infinity) {
        used.add(best.key);
        picked.push({
          key: best.key,
          pairedFailure: f.key,
          sameSession: best.sessionId === f.sessionId,
          sameSide: best.side === f.side,
          cutDistance: Math.abs((best.cut || 0) - (f.cut || 0)),
        });
      }
    }
  }

  assign(true);
  assign(false);
  if (picked.length < n) {
    for (const c of pool) {
      if (picked.length >= n) break;
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push({ key: c.key, pairedFailure: null, sameSession: false, sameSide: false, cutDistance: null });
    }
  }
  return picked.slice(0, n);
}

function cloudScatter(frame, maxN = 280) {
  const pts = frame.points;
  if (pts.length <= maxN) return pts.map(p => [round6(p[0]), round6(p[1])]);
  const step = pts.length / maxN;
  const out = [];
  for (let i = 0; i < maxN; i++) {
    const p = pts[Math.floor(i * step)];
    out.push([round6(p[0]), round6(p[1])]);
  }
  return out;
}

function round6(x) { return Math.round(x * 1e6) / 1e6; }

function compactScan(scan, includeMap) {
  return {
    id: scan.id, title: scan.title,
    searchY: scan.searchY, searchZ: scan.searchZ, grid: scan.grid,
    nCells: scan.nCells, nSupported: scan.nSupported, maxTopRows: scan.maxTopRows,
    lossBest: scan.lossBest ? {
      u: round6(scan.lossBest.u), z: round6(scan.lossBest.z),
      loss: scan.lossBest.loss, topRows: scan.lossBest.topRows,
      uAtBound: scan.lossBest.uAtBound, zAtBound: scan.lossBest.zAtBound,
    } : null,
    supportBest: scan.supportBest ? compactHit(scan.supportBest) : null,
    hits: (scan.hits || []).slice(0, 12).map(compactHit),
    map: includeMap ? downsampleMap(scan.map) : null,
  };
}

function compactHit(h) {
  if (!h) return null;
  return {
    u: round6(h.u), z: round6(h.z),
    topRows: h.topRows, loss: h.loss,
    faceCount: h.faceCount ?? null, binsTop: h.binsTop ?? null,
    slopeLimited: !!h.slopeLimited, topSlope: h.topSlope ?? null,
    outsideU: !!h.outsideU, outsideZ: !!h.outsideZ,
    distOutside: h.distOutside ?? 0, distSeed: h.distSeed ?? Math.hypot(h.u, h.z),
    plausible: isPlausible(h, null),
  };
}

function analyseRail(capture, side, role) {
  const t0 = process.hrtime.bigint();
  const proposal = B.propose(capture, side);
  const frame = prepareFrame(capture, side);
  if (!frame.ok) {
    return {
      ok: false, reason: frame.reason, role,
      proposal: compactProposal(proposal),
      ms: Number(process.hrtime.bigint() - t0) / 1e6,
    };
  }
  const scans = {};
  for (const [name, spec] of Object.entries(EXPERIMENTS))
    scans[name] = scanGrid(frame, spec);
  scans.DENSE_EXT = scanGrid(frame, {
    id: 'X', title: 'observation dense étendue (pas un test A–E)',
    searchY: 0.20, searchZ: 0.10, grid: 0.001,
    keepMap: false, computeLoss: false,
  });
  const wideFrame = prepareFrame(capture, side, { lat: 0.30, z: 0.20, x: 0.5 });
  let wide = null;
  if (wideFrame.ok) {
    wide = scanGrid(wideFrame, EXPERIMENTS.E_EXT_UZ, { keepMap: false, computeLoss: false, keepHits: true });
  }
  const engineLoss = scans.A_ENGINE.lossBest?.loss ?? null;
  const cls = classifyRail(scans, engineLoss, role);
  const seed = [0, 0];
  const engineBest = scans.A_ENGINE.lossBest;
  const rel = engineBest ? {
    u: round6(engineBest.u), z: round6(engineBest.z),
    uAtBound: engineBest.uAtBound, zAtBound: engineBest.zAtBound,
    fracU: engineBest.u / ENGINE_Y,
    fracZ: engineBest.z / ENGINE_Z,
  } : null;
  return {
    ok: true, role,
    proposal: compactProposal(proposal),
    frame: {
      sign: frame.sign, width: round6(frame.width),
      pointsLocal: frame.pointsLocal,
      zMedian: frame.zMedian, uMedian: frame.uMedian,
      zMin: frame.zMin, zMax: frame.zMax, uMin: frame.uMin, uMax: frame.uMax,
      nOutsideU: frame.nOutsideU, nOutsideZ: frame.nOutsideZ,
      fracOutsideU: frame.fracOutsideU, fracOutsideZ: frame.fracOutsideZ,
      nTopAnchors: frame.topAnchors.length, nFaceAnchors: frame.faceAnchors.length,
      counts: frame.counts,
    },
    seed,
    enginePlacement: rel,
    zDisagreement: engineBest ? frame.zMedian - engineBest.z : null,
    scans: {
      A_ENGINE: compactScan(scans.A_ENGINE, true),
      B_DENSE: compactScan(scans.B_DENSE, false),
      C_EXT_Z: compactScan(scans.C_EXT_Z, false),
      D_EXT_U: compactScan(scans.D_EXT_U, false),
      E_EXT_UZ: compactScan(scans.E_EXT_UZ, false),
      DENSE_EXT: compactScan(scans.DENSE_EXT, false),
    },
    wideNeighborhood: wide ? {
      pointsLocal: wideFrame.pointsLocal,
      nSupported: wide.nSupported,
      maxTopRows: wide.maxTopRows,
      supportBest: compactHit(wide.supportBest),
    } : null,
    classification: cls,
    cloud: cloudScatter(frame),
    ms: Number(process.hrtime.bigint() - t0) / 1e6,
  };
}

function compactProposal(p) {
  return {
    status: p?.status ?? 'absent',
    reason: p?.status === 'candidate' ? null : (p?.reasons || []).join(' '),
    delta: p?.delta || null,
    loss: p?.metrics?.templateLoss ?? null,
    topRows: p?.top?.count ?? p?.metrics?.topCount ?? null,
    seed: p?.metrics?.seed || null,
    confidence: p?.confidence ?? null,
  };
}

function deriveScience(report) {
  const failures = report.rails.filter(r => r.role === 'failure');
  const controls = report.rails.filter(r => r.role === 'control');
  const count = (rows, cat) => rows.filter(r => r.classification?.category === cat).length;
  const dist = {};
  for (const c of CATEGORIES) dist[c] = count(failures, c);
  const distC = {};
  for (const c of [...CATEGORIES, 'ENGINE_SUPPORT_PRESENT']) distC[c] = count(controls, c);
  const nFailOk = failures.filter(r => r.ok).length;
  const nCtrlOk = controls.filter(r => r.ok).length;
  const failSupport = failures.filter(r => r.ok && r.classification?.anySupport).length;
  const ctrlSupportExt = controls.filter(r => r.ok && (r.scans?.B_DENSE?.nSupported > 0 || r.scans?.C_EXT_Z?.nSupported > 0 || r.scans?.D_EXT_U?.nSupported > 0 || r.scans?.E_EXT_UZ?.nSupported > 0)).length;
  const failBetween = dist.SUPPORT_BETWEEN_GRID;
  const failOutsideU = dist.SUPPORT_OUTSIDE_U;
  const failOutsideZ = dist.SUPPORT_OUTSIDE_Z;
  const failOutsideUZ = dist.SUPPORT_OUTSIDE_UZ;
  const failOutside = failOutsideU + failOutsideZ + failOutsideUZ;
  const failNone = dist.NO_SUPPORT_FOUND;
  const failImpl = dist.SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE;
  const boundZ = failures.filter(r => r.enginePlacement?.zAtBound).length;
  const boundU = failures.filter(r => r.enginePlacement?.uAtBound).length;
  const wideOnly = failures.filter(r => r.ok && !r.classification?.anySupport && (r.wideNeighborhood?.nSupported || 0) > 0).length;
  const uMed = failures.filter(r => r.ok && r.frame).map(r => Math.abs(r.frame.uMedian));
  const zMed = failures.filter(r => r.ok && r.frame).map(r => r.frame.zMedian);
  const median = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  const fracU = failures.filter(r => r.ok && r.frame).map(r => r.frame.fracOutsideU);
  let lotStatus = 'INCONCLUSIVE';
  let answer = 'Les mesures ne départagent pas encore nettement absence de support et défaut de fenêtre.';
  if (failNone >= 40 && failBetween + failOutside <= 5)
    answer = 'Sur la cohorte assemblée, aucun support topRows≥3 n’apparaît dans le domaine moteur, ni entre les mailles, ni dans les extensions U/Z testées. Le générateur n’explore pas un support caché à cette résolution : le support n’est pas observable dans l’espace représenté.';
  else if (failBetween >= 15 && failNone < 20)
    answer = 'Du support apparaît entre les mailles de la grille actuelle, dans le domaine déjà exploré. La résolution coarse manque des placements supportés.';
  else if (failOutsideU >= 20 && failBetween <= 5)
    answer = 'Le support existe, mais hors du domaine U du moteur. La grille n’est pas trop lâche : le dense in-domaine reste à zéro. Le nuage local est centré au-delà de searchY=0,08. Élargir searchZ — déjà régressif dans Geometry Prototype V1 — n’est pas la bonne direction ; l’espace utile est latéral. Ceci n’est pas une proposition de searchY de production.';
  else if (failOutsideZ >= 20 && failBetween <= 5)
    answer = 'Du support apparaît hors du domaine Z, pas entre les mailles. Le moteur ne couvre pas la zone verticale utile.';
  else if (failOutside >= 15 && failBetween <= 5)
    answer = 'Du support apparaît hors du domaine actuel (U et/ou Z), pas entre les mailles. Le moteur ne couvre pas la zone géométriquement utile.';
  else if (failImpl >= 20)
    answer = 'Des surfaces avec topRows≥3 existent mais échouent les critères de plausibilité (loss, emprise). Un support quelconque n’est pas un rail.';
  return {
    lotStatus,
    nFailures: failures.length,
    nControls: controls.length,
    nFailuresOk: nFailOk,
    nControlsOk: nCtrlOk,
    categoriesFailures: dist,
    categoriesControls: distC,
    failSupportAny: failSupport,
    failBetween,
    failOutside,
    failOutsideU,
    failOutsideZ,
    failOutsideUZ,
    failNone,
    failImplausible: failImpl,
    controlExtraSupport: ctrlSupportExt,
    engineBestAtZBound: boundZ,
    engineBestAtUBound: boundU,
    wideNeighborhoodOnly: wideOnly,
    failureAbsUMedian: median(uMed),
    failureZMedian: median(zMed),
    failureFracPointsOutsideU: median(fracU),
    answer,
    keepAsDiagnostic: ['A_ENGINE', 'B_DENSE', 'C_EXT_Z', 'D_EXT_U', 'E_EXT_UZ'],
    notEnginePrototypes: true,
  };
}

function renderMarkdown(report) {
  const s = report.science;
  const catLine = (d) => [...CATEGORIES, 'ENGINE_SUPPORT_PRESENT'].filter(c => d[c] != null).map(c => `| \`${c}\` | ${d[c] || 0} |`).join('\n');
  const failList = (cat) => report.rails
    .filter(r => r.role === 'failure' && r.classification?.category === cat)
    .map(r => `- \`${r.key}\` cut ${r.cut} ${r.side}`)
    .join('\n') || '- *(aucun)*';
  const interesting = report.rails.filter(r => r.role === 'failure' && r.ok).slice(0, 8);
  return `# No-Support Generator Lab V1

Lot **EXPÉRIMENTAL / DIAGNOSTIQUE**. Branche \`lab-no-support-generator-v1\`. Aucun merge, aucun prototype moteur, aucune action ESV.

**Statut du lot : \`${s.lotStatus}\`.** Outil offline uniquement.

- Base géométrie : \`${report.hashes.baselineGeometry}\` (\`src/geometry-baseline.js\`)
- Géométrie courante : \`${report.hashes.geometry}\`
- Baseline inchangée : **${report.hashes.baselineUnchanged ? 'oui' : 'non'}**
- Données : \`${report.data.repo}\` \`${report.data.branch}\` \`@${report.data.head}\`
- Rails failures assemblés : **${s.nFailuresOk}** / 53
- Témoins : **${s.nControlsOk}**
- Durée : ${(report.elapsedMs / 1000).toFixed(1)} s

## Question

Les 53 failures n’ont-ils réellement aucune solution géométrique observable, ou le moteur actuel ne regarde-t-il simplement pas au bon endroit / avec une résolution suffisante ?

## Réponse mesurée

${s.answer}

Ce n’est **pas** une proposition de nouveaux \`searchY\` / \`searchZ\` / \`grid\`. Les extensions sont diagnostiques.

## Population

| cohorte | n |
|---|---:|
| failures \`gridSupported = 0\` | ${s.nFailures} |
| témoins engine-candidate appariés | ${s.nControls} |
| 4+2 exclus | 6 |

## Distribution des catégories — failures

| catégorie | n |
|---|---:|
${catLine(s.categoriesFailures)}

## Distribution des catégories — témoins

| catégorie | n |
|---|---:|
${catLine(s.categoriesControls)}

Le même protocole sur les témoins dit si la méthode révèle une propriété des failures ou simplement beaucoup de placements alternatifs partout. Témoins avec support hors grille moteur (B–E) : **${s.controlExtraSupport}**.

## Tests d’espacement (diagnostiques, pas des paramètres candidats)

| id | domaine | pas | rôle |
|---|---|---|---|
| A | searchY=0.08 searchZ=0.04 | 0.003 | grille actuelle |
| B | identique | 0.001 | entre les mailles |
| C | Z → 0.10 | 0.003 | hors domaine Z |
| D | U → 0.20 | 0.003 | hors domaine U |
| E | U+Z | 0.003 | hors domaine U et Z |

## Position du min de loss moteur

- Failures dont le coarse est collé à la borne Z : **${s.engineBestAtZBound}**
- Failures dont le coarse est collé à la borne U : **${s.engineBestAtUBound}**
- |u| médian du nuage (failures) : **${s.failureAbsUMedian?.toFixed(3)}** (searchY = 0,08)
- z médian du nuage (failures) : **${s.failureZMedian?.toFixed(4)}** (searchZ = 0,04)
- Fraction médiane des points hors |u|>0,08 : **${((s.failureFracPointsOutsideU || 0) * 100).toFixed(0)} %**
- Support qui n’apparaît que si l’on élargit le voisinage de points (hors filtre moteur) : **${s.wideNeighborhoodOnly}**

## Placements supportés découverts (failures)

Failures avec au moins un cell \`topRows ≥ 3\` dans A–E : **${s.failSupportAny}**.

### SUPPORT_BETWEEN_GRID

${failList('SUPPORT_BETWEEN_GRID')}

### SUPPORT_OUTSIDE_Z

${failList('SUPPORT_OUTSIDE_Z')}

### SUPPORT_OUTSIDE_U

${failList('SUPPORT_OUTSIDE_U')}

### SUPPORT_OUTSIDE_UZ

${failList('SUPPORT_OUTSIDE_UZ')}

### SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE

${failList('SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE')}

### NO_SUPPORT_FOUND

${failList('NO_SUPPORT_FOUND')}

### INCONCLUSIVE

${failList('INCONCLUSIVE')}

## Cas intéressants

${interesting.map(r => {
    const a = r.scans.A_ENGINE;
    const best = a.supportBest || a.lossBest;
    return `### Cut ${r.cut} ${r.side}

- Clé : \`${r.key}\`
- Catégorie : \`${r.classification.category}\`
- Points locaux : ${r.frame.pointsLocal} · z médian ${r.frame.zMedian?.toFixed(4)} · width ${r.frame.width}
- Min loss moteur : u=${a.lossBest?.u} z=${a.lossBest?.z} loss=${a.lossBest?.loss} topRows=${a.lossBest?.topRows} · borne Z=${a.lossBest?.zAtBound} borne U=${a.lossBest?.uAtBound}
- A nSupported=${a.nSupported} · B=${r.scans.B_DENSE.nSupported} · C=${r.scans.C_EXT_Z.nSupported} · D=${r.scans.D_EXT_U.nSupported} · E=${r.scans.E_EXT_UZ.nSupported}
- Meilleur support : ${r.scans.E_EXT_UZ.supportBest ? JSON.stringify(r.scans.E_EXT_UZ.supportBest) : (r.scans.B_DENSE.supportBest ? JSON.stringify(r.scans.B_DENSE.supportBest) : 'aucun')}
`;
  }).join('\n')}

## Conclusion technique (prochaine expérience)

Les extensions A–E ne sont pas des candidats d’intégration. **Ne pas** promouvoir \`searchY=0,20\` : \`maxSingleRailLateral=0,06\` rejetterait encore un déplacement de 0,17 m, et Geometry Prototype V1 a déjà montré qu’élargir naïvement une borne est régressif sur les témoins.

Si la masse des 53 est \`SUPPORT_OUTSIDE_U\` :
1. Le générateur ne manque pas de résolution (B_DENSE = 0).
2. Il ne « n’a pas de solution » : un plan de roulement \`topRows\` 20–30 existe vers |u|≈0,17, z≈z_nuage.
3. Prochaine expérience utile : **re-centrage U** (graine sur la médiane U du nuage local, ou fenêtre glissante), mesuré sur les mêmes 53 + témoins, sans toucher searchZ.

Les 6 cas 4+2 restent hors périmètre. Cut 756 / 836 (gauche) sont des exceptions où Z sort aussi du domaine.

Ne pas transformer ce laboratoire en nouvelle version Banane.
`;
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/no-support-generator-lab-v1.json'),
    limit: 0,
    data: N.DEFAULT_ROOT,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output') out.output = path.resolve(argv[++i]);
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--data') out.data = argv[++i];
    else throw Error('argument inconnu: ' + a);
  }
  return out;
}

function assembleNeeded(visits, keys, docs, base) {
  const want = new Map();
  for (const k of keys) want.set(k, parseKey(k));
  const items = [];
  for (const v of visits) {
    for (const side of ['left', 'right']) {
      const key = N.railKey(v, side);
      if (!want.has(key)) continue;
      items.push({ visit: v, side, key });
    }
  }
  const needed = new Set();
  const docsNeeded = new Set();
  for (const item of items) {
    docsNeeded.add(item.visit._doc);
    for (const id of item.visit.geometryEligibility?.[item.side]?.chunkIds || []) needed.add(id);
  }
  for (const d of docsNeeded) N.ensureRailsDictionary(base, d);
  for (const item of items) N.hydrateRailPoses(base, item.visit);
  const chunks = N.loadNeededChunks(base, docs, needed);
  const rails = [];
  for (const item of items) {
    const assembled = N.assembleCapture(item.visit, item.side, chunks);
    const ident = item.visit.identity || {};
    rails.push({
      ...item,
      assembled,
      sessionId: item.visit.sessionId,
      part: ident.part,
      cut: ident.cut,
    });
  }
  return rails;
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const pop = loadPopulation();
  const geometrySha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry.js')));
  const baselineSha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry-baseline.js')));
  const proto = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/geometry-prototype-v1.json'), 'utf8'));
  const baselineRows = proto.rows.BASELINE;
  const controlsMeta = pickControls(baselineRows, pop.failureKeys, pop.excludedFamilyKeys, pop.failureKeys.length);
  let failureKeys = pop.failureKeys.slice();
  let controlKeys = controlsMeta.map(c => c.key);
  if (args.limit > 0) {
    failureKeys = failureKeys.slice(0, args.limit);
    controlKeys = controlKeys.slice(0, args.limit);
  }
  const { base, docs, visits } = N.readVisits(args.data || N.DEFAULT_ROOT);
  const allKeys = [...failureKeys, ...controlKeys];
  const assembled = assembleNeeded(visits, allKeys, docs, base);
  const byKey = new Map(assembled.map(r => [r.key, r]));
  const controlByKey = new Map(controlsMeta.map(c => [c.key, c]));
  const rails = [];
  for (const key of failureKeys) {
    const item = byKey.get(key);
    if (!item || !item.assembled?.ready) {
      rails.push({
        key, role: 'failure', ok: false,
        skipReasons: item?.assembled?.reasons || ['non-assemblé'],
        classification: { category: 'INCONCLUSIVE', reason: 'non-assemblé' },
        sessionId: parseKey(key).sessionId, side: parseKey(key).side, cut: parseKey(key).cut, part: parseKey(key).part,
      });
      continue;
    }
    const analysis = analyseRail(item.assembled.capture, item.side, 'failure');
    rails.push({
      key, role: 'failure',
      sessionId: item.sessionId, side: item.side, cut: item.cut, part: item.part,
      ...analysis,
    });
  }
  for (const key of controlKeys) {
    const item = byKey.get(key);
    const meta = controlByKey.get(key);
    if (!item || !item.assembled?.ready) {
      rails.push({
        key, role: 'control', ok: false,
        skipReasons: item?.assembled?.reasons || ['non-assemblé'],
        pairedFailure: meta?.pairedFailure || null,
        classification: { category: 'INCONCLUSIVE', reason: 'non-assemblé' },
        sessionId: parseKey(key).sessionId, side: parseKey(key).side, cut: parseKey(key).cut, part: parseKey(key).part,
      });
      continue;
    }
    const analysis = analyseRail(item.assembled.capture, item.side, 'control');
    rails.push({
      key, role: 'control',
      sessionId: item.sessionId, side: item.side, cut: item.cut, part: item.part,
      pairedFailure: meta?.pairedFailure || null,
      sameSession: meta?.sameSession, sameSide: meta?.sameSide, cutDistance: meta?.cutDistance,
      ...analysis,
    });
  }
  const report = {
    format: 'no-support-generator-lab-v1',
    branch: 'lab-no-support-generator-v1',
    nature: 'offline-diagnostic',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    data: N.REF,
    hashes: {
      geometry: geometrySha,
      baselineGeometry: baselineSha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
    },
    population: {
      family: pop.family,
      failureKeys,
      excludedFamilyKeys: pop.excludedFamilyKeys,
      controlKeys,
      controlsMeta: args.limit ? controlsMeta.slice(0, args.limit) : controlsMeta,
    },
    experiments: EXPERIMENTS,
    rails,
  };
  report.science = deriveScience(report);
  report.elapsedMs = Date.now() - tAll;
  writeArtifacts(report, args.output);
  return report;
}

function slimRail(r) {
  return {
    key: r.key, role: r.role, ok: r.ok,
    sessionId: r.sessionId, side: r.side, cut: r.cut, part: r.part,
    pairedFailure: r.pairedFailure || null,
    classification: r.classification,
    frame: r.frame || null,
    enginePlacement: r.enginePlacement || null,
    zDisagreement: r.zDisagreement ?? null,
    proposal: r.proposal || null,
    scans: r.scans ? {
      A_ENGINE: {
        ...r.scans.A_ENGINE,
        hits: (r.scans.A_ENGINE.hits || []).slice(0, 6),
        map: r.role === 'failure' ? r.scans.A_ENGINE.map : null,
      },
      B_DENSE: { ...r.scans.B_DENSE, map: null, hits: (r.scans.B_DENSE.hits || []).slice(0, 6) },
      C_EXT_Z: { ...r.scans.C_EXT_Z, map: null, hits: (r.scans.C_EXT_Z.hits || []).slice(0, 4) },
      D_EXT_U: { ...r.scans.D_EXT_U, map: null, hits: (r.scans.D_EXT_U.hits || []).slice(0, 4) },
      E_EXT_UZ: { ...r.scans.E_EXT_UZ, map: null, hits: (r.scans.E_EXT_UZ.hits || []).slice(0, 6) },
      DENSE_EXT: { ...r.scans.DENSE_EXT, map: null, hits: (r.scans.DENSE_EXT.hits || []).slice(0, 6) },
    } : null,
    wideNeighborhood: r.wideNeighborhood || null,
    cloud: r.role === 'failure' ? (r.cloud || null) : null,
  };
}

function writeArtifacts(report, output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report));
  const slim = {
    format: report.format,
    branch: report.branch,
    nature: report.nature,
    generatedAt: report.generatedAt,
    elapsedMs: report.elapsedMs,
    data: report.data,
    hashes: report.hashes,
    science: report.science,
    experiments: Object.fromEntries(Object.entries(EXPERIMENTS).map(([k, v]) => [k, {
      id: v.id, title: v.title, searchY: v.searchY, searchZ: v.searchZ, grid: v.grid,
    }])),
    population: {
      family: report.population.family,
      nFailures: report.population.failureKeys.length,
      nControls: report.population.controlKeys.length,
      nExcluded: report.population.excludedFamilyKeys.length,
      failureKeys: report.population.failureKeys,
      controlKeys: report.population.controlKeys,
      excludedFamilyKeys: report.population.excludedFamilyKeys,
    },
    rails: report.rails.map(slimRail),
  };
  const slimPath = output.replace(/\.json$/, '.slim.json');
  fs.writeFileSync(slimPath, JSON.stringify(slim));
  const md = renderMarkdown(report);
  fs.writeFileSync(path.join(ROOT, 'NO_SUPPORT_GENERATOR_LAB_V1.md'), md);
  const workspacePublic = path.resolve(ROOT, '../public/no-support-generator-lab-v1.json');
  const workspaceLib = path.resolve(ROOT, '../src/lib/no-support-lab-v1.json');
  try { fs.writeFileSync(workspacePublic, JSON.stringify(slim)); } catch { /* preview optional */ }
  try { fs.writeFileSync(workspaceLib, JSON.stringify(slim)); } catch { /* preview optional */ }
  process.stderr.write(`écrit ${output} (${report.rails.length} rails, ${report.elapsedMs} ms)\n`);
}

module.exports = {
  BASELINE_GEOMETRY_SHA, CATEGORIES, EXPERIMENTS, ENGINE_Y, ENGINE_Z, ENGINE_GRID,
  loadPopulation, parseKey, prepareFrame, topRowsAt, templateLoss, scanGrid,
  classifyRail, pickControls, isPlausible, analyseRail, deriveScience, build,
  distOutsideDomain, atBound, downsampleMap,
};

if (require.main === module) build();
