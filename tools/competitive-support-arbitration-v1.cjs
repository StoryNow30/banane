#!/usr/bin/env node
'use strict';
/* Competitive Support Arbitration V1 — branche lab-competitive-support-arbitration-v1.
 * A_STAR figé. Aucun nouveau seuil. minTemplateLossRatio = 1.5 déjà gelé.
 * S1 n’intervient que si le gagnant A_STAR n’est pas déjà STRONG.
 * Le bug uMedian d’index du lot Face-Aware était un harness, pas A_STAR. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');
const U = require('./u-hypothesis-lab-v1.cjs');
const Prev = require('./no-support-generator-lab-v1.cjs');
const Stab = require('./u-recentering-stabilization-v1.cjs');
const FAA = require('./face-aware-arbitration-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = U.BASELINE_GEOMETRY_SHA;
const A_STAR_HASH = FAA.A_STAR_HASH;
const ENGINE_Y = G.DEFAULTS.searchY;
const ENGINE_Z = G.DEFAULTS.searchZ;
const GRID_TOL = 0.003;
const GROSS_TOL = 0.010;
const KEY_9644 = FAA.KEY_9644;
const CUTS_5 = FAA.CUTS_5;
const RATIO = G.DEFAULTS.minTemplateLossRatio;
const SEP = G.DEFAULTS.alternativeSeparation;
const PREV_FAA = path.join(ROOT, 'audit/face-aware-arbitration-v1.slim.json');
const PREV_STAB = path.join(ROOT, 'audit/u-recentering-stabilization-v1.json');

function round6(x) { return Math.round(x * 1e6) / 1e6; }

function lossRatio(loss, lmin) {
  if (!Number.isFinite(loss) || !Number.isFinite(lmin)) return Infinity;
  if (lmin <= 0) return loss <= 0 ? 1 : Infinity;
  return loss / lmin;
}

function inCompetitive(c, lmin) {
  return Number.isFinite(c?.loss) && lossRatio(c.loss, lmin) <= RATIO;
}

function alreadyQualified(astar) {
  return !!(astar
    && astar.status === 'candidate'
    && (astar.topRows ?? 0) >= G.DEFAULTS.minTop
    && (astar.faceCount ?? 0) >= G.DEFAULTS.minFace
    && !astar.slopeLimited);
}

function spatialClusters(cells, sep = SEP) {
  const n = cells.length;
  if (!n) return [];
  const parent = cells.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i, j) => {
    const a = find(i), b = find(j);
    if (a !== b) parent[a] = b;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.hypot(cells[i].u - cells[j].u, cells[i].z - cells[j].z) < sep) union(i, j);
    }
  }
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(cells[i]);
  }
  return [...map.values()];
}

function cellFromAstar(astar, frame) {
  if (!astar || !astar.seed) return null;
  return {
    u: round6(frame.sign * astar.seed[0]),
    z: round6(astar.seed[1]),
    loss: astar.loss,
    topRows: astar.topRows,
    faceCount: astar.faceCount,
    slopeLimited: !!astar.slopeLimited,
    windowOk: astar.status === 'candidate',
    tier: FAA.faceTier(astar.faceCount),
    motif: astar.motif,
    tags: ['astar-published'],
  };
}

function lminOf(pool, astar) {
  let m = null;
  for (const c of pool || []) {
    if (Number.isFinite(c.loss) && (m == null || c.loss < m)) m = c.loss;
  }
  if (m == null && Number.isFinite(astar?.loss)) m = astar.loss;
  return m;
}

function compactCell(c) {
  if (!c) return null;
  return {
    u: c.u, z: c.z, loss: c.loss, topRows: c.topRows, faceCount: c.faceCount,
    slope: c.slope ?? null, slopeLimited: !!c.slopeLimited, windowOk: !!c.windowOk,
    tier: c.tier, motif: c.motif, tags: c.tags || [],
    distOrigin: c.distOrigin, distU: c.distU,
  };
}

function competitiveView(pool, lmin) {
  const competitive = (pool || []).filter(c => inCompetitive(c, lmin));
  const strong = competitive.filter(FAA.qualifyStrong);
  const clusters = spatialClusters(strong);
  return {
    lmin,
    ratioLimit: RATIO,
    nPool: (pool || []).length,
    nCompetitive: competitive.length,
    nStrongPool: (pool || []).filter(FAA.qualifyStrong).length,
    nStrongCompetitive: strong.length,
    nClusters: clusters.length,
    competitive: competitive.slice(0, 24).map(c => ({
      ...compactCell(c),
      ratio: Number.isFinite(lmin) && lmin > 0 ? c.loss / lmin : null,
    })),
    strongCompetitive: strong.slice(0, 16).map(c => ({
      ...compactCell(c),
      ratio: Number.isFinite(lmin) && lmin > 0 ? c.loss / lmin : null,
    })),
  };
}

function pickMinLoss(cells) {
  return cells.reduce((a, b) => (a == null || b.loss < a.loss ? b : a), null);
}

function rankS2(a, b) {
  const qa = FAA.qualifyStrong(a) ? 1 : 0;
  const qb = FAA.qualifyStrong(b) ? 1 : 0;
  if (qb !== qa) return qb - qa;
  if ((b.faceCount || 0) !== (a.faceCount || 0)) return (b.faceCount || 0) - (a.faceCount || 0);
  if ((b.topRows || 0) !== (a.topRows || 0)) return (b.topRows || 0) - (a.topRows || 0);
  return (a.loss || 0) - (b.loss || 0);
}

function policyKeepAstar(astar, frame, policy, extra) {
  return {
    status: astar.status,
    motif: astar.motif,
    reason: astar.reason || null,
    pick: cellFromAstar(astar, frame),
    policy,
    changed: false,
    activated: false,
    ...extra,
  };
}

function policyS1(astar, pool, frame, view) {
  if (alreadyQualified(astar)) {
    return policyKeepAstar(astar, frame, 'S1', {
      nStrongCompetitive: view.nStrongCompetitive, nClusters: view.nClusters,
      note: 'A_STAR déjà STRONG ; pas d’arbitrage.',
    });
  }
  const strong = (pool || []).filter(c => inCompetitive(c, view.lmin) && FAA.qualifyStrong(c));
  const clusters = spatialClusters(strong);
  if (clusters.length === 1) {
    const pick = pickMinLoss(clusters[0]);
    return {
      status: 'candidate', motif: 'candidate', reason: null, pick, policy: 'S1',
      changed: true, activated: true,
      nStrongCompetitive: strong.length, nClusters: 1,
      note: 'Un cluster STRONG compétitif ; min-loss du cluster.',
    };
  }
  if (clusters.length > 1) {
    return {
      status: 'unresolved', motif: 'ambiguity',
      reason: 'Plusieurs placements STRONG compétitifs spatialement distincts.',
      pick: null, policy: 'S1', changed: false, activated: true,
      nStrongCompetitive: strong.length, nClusters: clusters.length,
    };
  }
  return {
    status: astar.status, motif: astar.motif, reason: astar.reason || null,
    pick: cellFromAstar(astar, frame), policy: 'S1',
    changed: false, activated: true,
    nStrongCompetitive: 0, nClusters: 0,
    note: 'Aucun STRONG dans le competitive set ; motif A_STAR conservé.',
  };
}

function policyS2(astar, pool, frame, view) {
  if (alreadyQualified(astar)) {
    return policyKeepAstar(astar, frame, 'S2', {
      nStrongCompetitive: view.nStrongCompetitive, nClusters: view.nClusters,
      note: 'A_STAR déjà STRONG ; pas d’arbitrage.',
    });
  }
  const strong = (pool || []).filter(c => inCompetitive(c, view.lmin) && FAA.qualifyStrong(c));
  const clusters = spatialClusters(strong);
  if (clusters.length === 1) {
    const pick = clusters[0].slice().sort(rankS2)[0];
    return {
      status: 'candidate', motif: 'candidate', reason: null, pick, policy: 'S2',
      changed: true, activated: true,
      nStrongCompetitive: strong.length, nClusters: 1,
      note: 'Un cluster STRONG compétitif ; rang faceCount, topRows, loss.',
    };
  }
  if (clusters.length > 1) {
    return {
      status: 'unresolved', motif: 'ambiguity',
      reason: 'Plusieurs placements STRONG compétitifs spatialement distincts ; S2 ne force pas.',
      pick: null, policy: 'S2', changed: false, activated: true,
      nStrongCompetitive: strong.length, nClusters: clusters.length,
    };
  }
  return {
    status: astar.status, motif: astar.motif, reason: astar.reason || null,
    pick: cellFromAstar(astar, frame), policy: 'S2',
    changed: false, activated: true,
    nStrongCompetitive: 0, nClusters: 0,
    note: 'Aucun STRONG dans le competitive set ; motif A_STAR conservé.',
  };
}

function hypotDelta(a, b) {
  if (!a || !b) return a || b ? Infinity : 0;
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0), (a[2] || 0) - (b[2] || 0));
}

function deltaOf(pub, sign) {
  if (!pub || pub.status !== 'candidate' || !pub.pick) return null;
  return [0, sign * pub.pick.u, pub.pick.z];
}

function analyseRail(capture, side, role, key) {
  const t0 = process.hrtime.bigint();
  const frame = Prev.prepareFrame(capture, side);
  const engine = B.propose(capture, side);
  const engineC = U.compactProposal(engine);
  engineC.motif = U.motifOf(engineC);
  if (!frame.ok) {
    return {
      ok: false, reason: frame.reason, role, exception: U.exceptionOf(key),
      engine: engineC, ms: Number(process.hrtime.bigint() - t0) / 1e6,
    };
  }
  let coarse = [];
  let meta = { uCenters: [0] };
  const astarP = G.propose(capture, side, {
    lab: {
      ...FAA.aStarLab(frame),
      onCoarse(c, m) { coarse = c; meta = m; },
    },
  });
  const astar = U.compactProposal(astarP);
  astar.motif = U.motifOf(astar);
  astar.uCenters = astarP.metrics?.lab?.uCenters || meta.uCenters;
  const extras = [];
  if (meta && meta.best) extras.push({ u: meta.best.u, z: meta.best.z, loss: meta.best.loss, tag: 'coarse-best' });
  if (astar.seed) extras.push({ u: frame.sign * astar.seed[0], z: astar.seed[1], loss: astar.loss, tag: 'astar-published' });
  if (engineC.seed) extras.push({ u: frame.sign * engineC.seed[0], z: engineC.seed[1], loss: engineC.loss, tag: 'engine-published' });
  const reduced = FAA.reducePool(coarse, frame, meta.uCenters || [0, frame.uMedian], extras);
  const lmin = lminOf(reduced.pool, astar);
  const view = competitiveView(reduced.pool, lmin);
  const bestStrong = reduced.pool.filter(FAA.qualifyStrong).sort((a, b) => a.loss - b.loss)[0] || null;
  const bestLoss = reduced.pool[0] || null;
  return {
    ok: true, role, exception: U.exceptionOf(key),
    is9644: key === KEY_9644,
    isInsufficient5: CUTS_5.includes(Number(String(key).split('|')[3])),
    engine: engineC,
    astar,
    frame: {
      sign: frame.sign, width: round6(frame.width), pointsLocal: frame.pointsLocal,
      uMedian: round6(frame.uMedian), uSeed: FAA.aStarLab(frame).uSeeds[0],
      zMedian: frame.zMedian,
    },
    poolMeta: {
      nCoarse: reduced.nCoarse, nLocalMin: reduced.nLocalMin, nKept: reduced.nKept,
      nDense: reduced.nDense, nStrongDense: reduced.nStrongDense,
      nStrong: reduced.pool.filter(FAA.qualifyStrong).length,
      nPartial: reduced.pool.filter(c => c.tier === 'PARTIAL_FACE').length,
    },
    pool: reduced.pool.slice(0, 40),
    bestLoss: compactCell(bestLoss),
    bestStrong: compactCell(bestStrong),
    competitive: view,
    alreadyQualified: alreadyQualified(astar),
    ms: Number(process.hrtime.bigint() - t0) / 1e6,
  };
}

function applyPolicies(rail) {
  if (!rail.ok) return rail;
  const dummyFrame = { sign: rail.frame.sign };
  rail.policies = {
    S1: policyS1(rail.astar, rail.pool, dummyFrame, rail.competitive),
    S2: policyS2(rail.astar, rail.pool, dummyFrame, rail.competitive),
  };
  return rail;
}

function parityRecord(current, expected, source) {
  const mismatches = [];
  const byK = new Map((expected || []).map(r => [r.key, r]));
  for (const r of current) {
    const e = byK.get(r.key);
    if (!e) { mismatches.push({ key: r.key, cut: r.cut, side: r.side, kind: 'missing-prev', source }); continue; }
    const a = r.astar, p = e.astar || e;
    if (!a || !p) { mismatches.push({ key: r.key, cut: r.cut, side: r.side, kind: 'absent', source }); continue; }
    if ((a.status || null) !== (p.status || null)) {
      mismatches.push({ key: r.key, cut: r.cut, side: r.side, kind: 'status', got: a.status, exp: p.status, source });
    } else if ((a.motif || null) !== (p.motif || null)) {
      mismatches.push({ key: r.key, cut: r.cut, side: r.side, kind: 'motif', got: a.motif, exp: p.motif, source });
    } else {
      const h = hypotDelta(a.delta, p.delta);
      if (h > 1e-9) mismatches.push({ key: r.key, cut: r.cut, side: r.side, kind: 'delta', hypot: round6(h), source });
    }
  }
  return { source, n: current.length, nMismatch: mismatches.length, pass: mismatches.length === 0, mismatches: mismatches.slice(0, 20) };
}

function loadPrevAstar() {
  const faa = JSON.parse(fs.readFileSync(PREV_FAA, 'utf8'));
  const stab = JSON.parse(fs.readFileSync(PREV_STAB, 'utf8'));
  const faaRails = faa.rails.map(r => ({
    key: r.key, cut: r.cut, side: r.side, role: r.role,
    astar: r.astar, engine: r.engine,
  }));
  const stabRails = stab.rails.map(r => ({
    key: r.key, cut: r.cut, side: r.side, role: r.role,
    astar: r.variants?.A_ORIGIN_PRESERVE || r.variants?.A_STAR || null,
  }));
  const locked22 = (faa.science?.partial22?.items || []).map(i => i.key);
  return { faaRails, stabRails, locked22, faaScience: faa.science };
}

function fileParityFaaVsStab(faaRails, stabRails) {
  const byK = new Map(stabRails.map(r => [r.key, r]));
  const mismatches = [];
  for (const r of faaRails) {
    const s = byK.get(r.key);
    if (!s || !s.astar || !r.astar) { mismatches.push({ key: r.key, kind: 'missing' }); continue; }
    if (r.astar.status !== s.astar.status || r.astar.motif !== s.astar.motif) {
      mismatches.push({ key: r.key, kind: 'status-motif', faa: r.astar.status, stab: s.astar.status });
    } else if (hypotDelta(r.astar.delta, s.astar.delta) > 1e-9) {
      mismatches.push({ key: r.key, kind: 'delta' });
    }
  }
  return {
    source: 'face-aware-astar vs u-recentering A_ORIGIN_PRESERVE',
    n: faaRails.length, nMismatch: mismatches.length, pass: mismatches.length === 0,
    mismatches: mismatches.slice(0, 12),
    harnessNote: 'La correction hypothesesA du lot Face-Aware concernait le harness (uMedian d’index vs médiane figée). A_STAR (hash, searchY/Z, minFace, replaceOrigin) n’a pas été modifié.',
  };
}

function classify22Item(r) {
  const v = r.competitive || {};
  const nStrong = v.nStrongPool || 0;
  const nComp = v.nStrongCompetitive || 0;
  const nCl = v.nClusters || 0;
  let kind = 'C';
  if (nComp >= 1 && nCl > 1) kind = 'D';
  else if (nComp >= 1) kind = 'A';
  else if (nStrong >= 1) kind = 'B';
  else kind = 'C';
  const bl = r.bestLoss, bs = r.bestStrong;
  const lmin = v.lmin;
  return {
    cut: r.cut, side: r.side, key: r.key, kind,
    lmin,
    astar: { motif: r.astar.motif, face: r.astar.faceCount, top: r.astar.topRows, loss: r.astar.loss },
    bestStrong: bs && {
      u: bs.u, z: bs.z, face: bs.faceCount, top: bs.topRows, loss: bs.loss,
      ratio: lmin > 0 ? bs.loss / lmin : null,
      dist: bl ? Math.hypot(bl.u - bs.u, bl.z - bs.z) : null,
      slope: bs.slope, inCompetitive: nComp >= 1 && inCompetitive(bs, lmin),
    },
    nStrong, nStrongCompetitive: nComp, nClusters: nCl,
    s1: r.policies?.S1 && { status: r.policies.S1.status, motif: r.policies.S1.motif, changed: r.policies.S1.changed },
    s2: r.policies?.S2 && { status: r.policies.S2.status, motif: r.policies.S2.motif, changed: r.policies.S2.changed },
  };
}

function analyse9644(rail) {
  if (!rail) return { found: false };
  const v = rail.competitive || {};
  const eng = rail.engine, astar = rail.astar;
  const lmin = v.lmin;
  const engineRatio = (eng.loss != null && lmin > 0) ? eng.loss / lmin : null;
  const s1 = rail.policies?.S1, s2 = rail.policies?.S2;
  return {
    found: true, key: rail.key, hardcodedException: false,
    lmin,
    engine: { status: eng.status, delta: eng.delta, loss: eng.loss, topRows: eng.topRows, faceCount: eng.faceCount, seed: eng.seed, ratio: engineRatio },
    astar: { status: astar.status, motif: astar.motif, reason: astar.reason, loss: astar.loss, topRows: astar.topRows, faceCount: astar.faceCount, seed: astar.seed, uCenters: astar.uCenters },
    minLoss: rail.bestLoss,
    bestStrong: rail.bestStrong,
    nStrongCompetitive: v.nStrongCompetitive, nClusters: v.nClusters,
    engineInCompetitive: !!(eng.loss != null && lmin > 0 && eng.loss / lmin <= RATIO),
    why: 'A_STAR publie face=0 à Lmin ; le témoin face=24 a un ratio ' + (engineRatio == null ? '?' : engineRatio.toFixed(3)) + ' ≤ 1.5 donc entre dans le competitive set.',
    policies: {
      S1: s1 && { status: s1.status, motif: s1.motif, reason: s1.reason, pick: compactCell(s1.pick), activated: s1.activated, changed: s1.changed, nClusters: s1.nClusters },
      S2: s2 && { status: s2.status, motif: s2.motif, reason: s2.reason, pick: compactCell(s2.pick), activated: s2.activated, changed: s2.changed, nClusters: s2.nClusters },
    },
  };
}

function comparePolicy(rails, id) {
  const failures = rails.filter(r => r.role === 'failure' && r.ok && !r.exception);
  const controls = rails.filter(r => r.role === 'control' && r.ok);
  let recovered = 0, stillFlank = 0, stillRsf = 0, stillSlope = 0, nowAmbiguity = 0, nowCandidate = 0, activated = 0;
  const recoveredKeys = [];
  const motifShift = {};
  let publishedFar = 0;
  for (const r of failures) {
    const a = r.astar, p = r.policies?.[id];
    if (!p) continue;
    if (p.activated) activated++;
    if (p.status === 'candidate') nowCandidate++;
    if (a.status !== 'candidate' && p.status === 'candidate') {
      recovered++;
      recoveredKeys.push({ key: r.key, cut: r.cut, side: r.side });
    }
    if (p.motif === 'flank') stillFlank++;
    if (p.motif === 'rsf') stillRsf++;
    if (p.motif === 'slope') stillSlope++;
    if (p.motif === 'ambiguity') nowAmbiguity++;
    const am = a.motif, pm = p.motif;
    if (am !== pm) motifShift[am + '→' + pm] = (motifShift[am + '→' + pm] || 0) + 1;
    const lmin = r.competitive?.lmin;
    if (p.status === 'candidate' && p.pick && lmin > 0 && p.pick.loss / lmin > RATIO + 1e-12) publishedFar++;
  }
  let kept = 0, lost = 0, recoveredCtrl = 0, displaced = 0, displacedGross = 0, newAmbiguity = 0;
  let displacedAlreadyStrong = 0, activatedOnStrong = 0, astarKept = 0, astarChanged = 0;
  const lostKeys = [], recoveredCtrlKeys = [], displacedKeys = [], grossKeys = [], strongMoved = [];
  for (const r of controls) {
    const eng = r.engine, a = r.astar, p = r.policies?.[id];
    if (!p) continue;
    const pDelta = deltaOf(p, r.frame.sign);
    if (alreadyQualified(a) && p.activated) activatedOnStrong++;
    if (alreadyQualified(a) && p.status === 'candidate') {
      const h = hypotDelta(a.delta, pDelta);
      if (h > GRID_TOL) {
        displacedAlreadyStrong++;
        strongMoved.push({ key: r.key, cut: r.cut, side: r.side, hypot: round6(h) });
      }
    }
    if (a.status === 'candidate' && p.status === 'candidate' && !p.changed) astarKept++;
    if (p.changed) astarChanged++;
    if (eng.status === 'candidate' && p.status === 'candidate') {
      kept++;
      const h = hypotDelta(eng.delta, pDelta);
      const du = (pDelta?.[1] ?? 0) - (eng.delta?.[1] ?? 0);
      if (h > GRID_TOL) {
        displaced++;
        displacedKeys.push({ key: r.key, cut: r.cut, side: r.side, du: round6(du), hypot: round6(h) });
      }
      if (h > GROSS_TOL) {
        displacedGross++;
        grossKeys.push({ key: r.key, cut: r.cut, side: r.side, du: round6(du), hypot: round6(h) });
      }
    } else if (eng.status === 'candidate' && p.status !== 'candidate') {
      lost++;
      lostKeys.push({ key: r.key, cut: r.cut, side: r.side, motif: p.motif, reason: p.reason });
    } else if (eng.status !== 'candidate' && p.status === 'candidate') {
      recoveredCtrl++;
      recoveredCtrlKeys.push({ key: r.key, cut: r.cut, side: r.side });
    }
    if (a.status === 'candidate' && p.motif === 'ambiguity') newAmbiguity++;
  }
  const r9644 = rails.find(r => r.key === KEY_9644);
  const restored9644 = !!(r9644 && r9644.policies?.[id]?.status === 'candidate');
  const extraLostVsAstar = controls.filter(r => r.astar.status === 'candidate' && r.policies?.[id]?.status !== 'candidate').length;
  return {
    id, recovered, stillFlank, stillRsf, stillSlope, nowAmbiguity, nowCandidate, activated,
    recoveredKeys, motifShift, publishedFar,
    controls: {
      n: controls.length, kept, lost, recoveredCtrl, displaced, displacedGross, newAmbiguity,
      lostKeys, recoveredCtrlKeys, displacedKeys, grossKeys,
      displacedAlreadyStrong, activatedOnStrong, astarKept, astarChanged, extraLostVsAstar, strongMoved,
    },
    restored9644,
  };
}

function variantStatus(cmp, partial22) {
  const c = cmp.controls;
  const farPublished = cmp.publishedFar > 0;
  const strongMoved = c.displacedAlreadyStrong > 0;
  const extraLost = c.extraLostVsAstar > 0 || c.lost > 1;
  const ambBoom = c.newAmbiguity > 2;
  if (strongMoved || extraLost || farPublished || c.displacedGross > 0) return 'REGRESSIVE';
  if (cmp.restored9644 && c.displacedAlreadyStrong === 0 && c.extraLostVsAstar === 0 && !farPublished && !ambBoom) {
    return 'PROMISING';
  }
  if (c.lost > 0 && !cmp.restored9644) return 'NEUTRAL';
  return 'INCONCLUSIVE';
}

function deriveScience(report, prev) {
  const rails = report.rails;
  const parity = report.parity;
  const locked22 = new Set(prev.locked22 || []);
  const partial22items = rails.filter(r => locked22.has(r.key)).map(classify22Item);
  const byKind = { A: 0, B: 0, C: 0, D: 0 };
  for (const it of partial22items) byKind[it.kind] = (byKind[it.kind] || 0) + 1;
  const partial22 = {
    n: partial22items.length, byKind, items: partial22items,
    population: (byKind.A >= 15 && byKind.B + byKind.C + byKind.D === 0) ? 'A'
      : (byKind.D >= 10) ? 'D'
      : (byKind.B >= 10 && byKind.A < 8) ? 'B' : 'C',
  };
  const five = rails.filter(r => r.isInsufficient5).map(r => ({
    cut: r.cut, side: r.side, key: r.key,
    astar: { motif: r.astar.motif, topRows: r.astar.topRows, faceCount: r.astar.faceCount, loss: r.astar.loss },
    nStrong: r.competitive?.nStrongPool || 0,
    nStrongCompetitive: r.competitive?.nStrongCompetitive || 0,
    nClusters: r.competitive?.nClusters || 0,
    bestStrong: r.bestStrong && { u: r.bestStrong.u, face: r.bestStrong.faceCount, loss: r.bestStrong.loss, ratio: r.competitive?.lmin > 0 ? r.bestStrong.loss / r.competitive.lmin : null },
    policies: r.policies && Object.fromEntries(Object.entries(r.policies).map(([k, v]) => [k, { status: v.status, motif: v.motif, changed: v.changed }])),
    note: (r.competitive?.nStrongCompetitive > 0)
      ? 'STRONG compétitif présent — S1 peut publier'
      : (r.competitive?.nStrongPool > 0)
        ? 'STRONG hors competitive set ; abstention'
        : 'aucun STRONG ; abstention acceptable',
  }));
  const comparisons = {};
  for (const id of ['S1', 'S2']) {
    if (!parity.currentVsFaa.pass) {
      comparisons[id] = { id, status: 'INCONCLUSIVE', skipped: true, reason: 'parité A_STAR incomplète' };
      continue;
    }
    const cmp = comparePolicy(rails, id);
    cmp.published22 = rails.filter(r => locked22.has(r.key) && r.policies?.[id]?.status === 'candidate').length;
    cmp.published5 = rails.filter(r => r.isInsufficient5 && r.policies?.[id]?.status === 'candidate').length;
    cmp.status = variantStatus(cmp, partial22);
    comparisons[id] = cmp;
  }
  const c9644 = analyse9644(rails.find(r => r.key === KEY_9644));
  const failures = rails.filter(r => r.role === 'failure' && r.ok && !r.exception);
  const astarTally = { candidate: 0, flank: 0, rsf: 0, slope: 0, other: 0 };
  for (const r of failures) {
    const m = r.astar?.motif;
    if (astarTally[m] == null) astarTally.other++;
    else astarTally[m]++;
  }
  const s1 = comparisons.S1;
  let freeze = null;
  if (parity.currentVsFaa.pass && s1.status !== 'REGRESSIVE' && s1.restored9644 && s1.controls.displacedAlreadyStrong === 0) {
    freeze = { id: 'S1', title: 'SUPPORT_FALLBACK_15', note: 'figé pour lecture ; post-hoc humain non exécuté ; A_STAR inchangé ; constante 1.5 déjà gelée' };
  }
  let lotStatus = 'INCONCLUSIVE';
  if (!parity.currentVsFaa.pass || !parity.faaVsStab.pass) lotStatus = 'INCONCLUSIVE';
  else if (s1.status === 'REGRESSIVE' && comparisons.S2.status === 'REGRESSIVE') lotStatus = 'REGRESSIVE';
  else if (s1.status === 'PROMISING') lotStatus = 'PROMISING';
  else lotStatus = 'INCONCLUSIVE';

  const answerParts = [];
  answerParts.push('Parité A_STAR : harness Face-Aware vs A_ORIGIN_PRESERVE ' + (parity.faaVsStab.pass ? 'PASS' : 'FAIL') + ' ; lot courant vs Face-Aware ' + (parity.currentVsFaa.pass ? 'PASS' : 'FAIL') + '.');
  answerParts.push('Le décalage uMedian d’index du lot précédent était un bug de harness, pas une modification d’A_STAR.');
  answerParts.push('Aucun nouveau seuil : minTemplateLossRatio=' + RATIO + '.');
  if (parity.currentVsFaa.pass) {
    answerParts.push('9644 : Lmin face=0 ; témoin face=24 ratio=' + (c9644.engine?.ratio == null ? '?' : c9644.engine.ratio.toFixed(3)) + ' ; S1 restaure=' + s1.restored9644 + '.');
    answerParts.push('22 : A(compétitif)=' + byKind.A + ' B(hors set)=' + byKind.B + ' C(aucun)=' + byKind.C + ' D(plusieurs)=' + byKind.D + ' ; S1 publie ' + s1.published22 + '/22 et ' + s1.published5 + '/5.');
    answerParts.push('S1 : +' + s1.recovered + ' candidates, témoins perdus ' + s1.controls.lost + ', déjà-STRONG déplacés ' + s1.controls.displacedAlreadyStrong + ', far publiés ' + s1.publishedFar + ', activation-sur-STRONG ' + s1.controls.activatedOnStrong + '.');
    answerParts.push('S2 statut ' + comparisons.S2.status + '.');
  }
  if (lotStatus === 'INCONCLUSIVE') answerParts.push('Lot INCONCLUSIVE : pas un correctif de production.');
  if (lotStatus === 'PROMISING') answerParts.push('Lot PROMISING au sens du gate (9644, témoins, pas de far). Pas une intégration runtime.');

  return {
    lotStatus, answer: answerParts.join(' '),
    aStarHash: A_STAR_HASH, aStarFrozen: true, searchY: ENGINE_Y, searchZ: ENGINE_Z,
    notAGlobalSearchY: true, minFace: G.DEFAULTS.minFace, minTop: G.DEFAULTS.minTop,
    minTemplateLossRatio: RATIO, alternativeSeparation: SEP, noNewThreshold: true,
    harnessNote: parity.faaVsStab.harnessNote,
    astarTally, comparisons, partial22, five, c9644, freeze,
    nFailures: rails.filter(r => r.role === 'failure').length,
    nMain51: failures.length,
    nControls: rails.filter(r => r.role === 'control').length,
    exceptions: rails.filter(r => r.exception).map(r => ({ cut: r.cut, side: r.side, tag: r.exception, astar: r.astar?.motif })),
  };
}

function renderMarkdown(report) {
  const s = report.science;
  const p = s.parity || report.parity;
  const s1 = s.comparisons.S1 || {};
  const s2 = s.comparisons.S2 || {};
  const x = s.c9644 || {};
  const t22 = s.partial22 || {};
  const c1 = s1.controls || {};
  const c2 = s2.controls || {};
  return `# Competitive Support Arbitration V1

Lot **EXPÉRIMENTAL**. Branche \`lab-competitive-support-arbitration-v1\`. Aucun merge. A_STAR figé.

- Branche : \`lab-competitive-support-arbitration-v1\`
- HEAD : \`${report.head || '(après commit)'}\`
- Base : \`8d98f68\`
- Lab amont : \`2ec9443\`
- Commande : \`node tools/competitive-support-arbitration-v1.cjs\`
- Tests : \`node tests/competitive-support-arbitration-v1.test.cjs\`

**Statut du lot : \`${s.lotStatus}\`.**

- A_STAR hash : \`${s.aStarHash}\` **figé**
- searchY **${s.searchY}** · searchZ **${s.searchZ}** · minFace **${s.minFace}** · minTop **${s.minTop}**
- minTemplateLossRatio **${s.minTemplateLossRatio}** (constante V4.6, pas un nouveau seuil)
- Baseline géométrie inchangée : **${report.hashes.baselineUnchanged ? 'oui' : 'non'}**
- Durée : ${((report.elapsedMs || 0) / 1000).toFixed(1)} s

## Parité A_STAR

${s.harnessNote}

| comparaison | n | mismatches | pass |
|---|---:|---:|---|
| Face-Aware vs A_ORIGIN_PRESERVE | ${p.faaVsStab?.n} | ${p.faaVsStab?.nMismatch} | ${p.faaVsStab?.pass} |
| lot courant vs Face-Aware | ${p.currentVsFaa?.n} | ${p.currentVsFaa?.nMismatch} | ${p.currentVsFaa?.pass} |

Aucune arbitration n’est interprétée si la parité échoue.

## Question

Le support géométrique peut-il servir de critère de secours, uniquement parmi des candidats encore compétitifs en loss (ratio ≤ 1,5) ?

## Réponse

${s.answer}

**Ce lot ne baisse pas minFace. Il n’élargit pas searchY. Il n’introduit pas de constante nouvelle.**

## Variantes

| id | statut | 51 → candidate | 22 publiés | 5 publiés | 9644 | témoins perdus | déjà-STRONG déplacés | far publiés | activation-sur-STRONG |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| S1 fallback | ${s1.status} | ${s1.nowCandidate ?? '—'} | ${s1.published22 ?? '—'} | ${s1.published5 ?? '—'} | ${s1.restored9644} | ${c1.lost ?? '—'} | ${c1.displacedAlreadyStrong ?? '—'} | ${s1.publishedFar ?? '—'} | ${c1.activatedOnStrong ?? '—'} |
| S2 ranking | ${s2.status} | ${s2.nowCandidate ?? '—'} | ${s2.published22 ?? '—'} | ${s2.published5 ?? '—'} | ${s2.restored9644} | ${c2.lost ?? '—'} | ${c2.displacedAlreadyStrong ?? '—'} | ${s2.publishedFar ?? '—'} | ${c2.activatedOnStrong ?? '—'} |

S1 : si A_STAR est déjà STRONG, ne rien changer. Sinon, STRONG du competitive set ; un cluster → min-loss ; plusieurs → ambiguïté ; zéro → motif inchangé.
S2 : même gate, rang faceCount puis topRows puis loss dans un cluster unique. Ne force pas si plusieurs clusters.

## Cas 9644 D

Hardcodé comme exception : **non**.

- Lmin : ${x.lmin}
- A_STAR : motif=${x.astar?.motif} face=${x.astar?.faceCount} loss=${x.astar?.loss}
- témoin : face=${x.engine?.faceCount} loss=${x.engine?.loss} ratio=${x.engine?.ratio}
- dans le competitive set : **${x.engineInCompetitive}**
- STRONG compétitifs / clusters : ${x.nStrongCompetitive} / ${x.nClusters}
- ${x.why}

| politique | status | motif | face | activé | changé |
|---|---|---|---:|---|---|
| S1 | ${x.policies?.S1?.status} | ${x.policies?.S1?.motif} | ${x.policies?.S1?.pick?.faceCount ?? '—'} | ${x.policies?.S1?.activated} | ${x.policies?.S1?.changed} |
| S2 | ${x.policies?.S2?.status} | ${x.policies?.S2?.motif} | ${x.policies?.S2?.pick?.faceCount ?? '—'} | ${x.policies?.S2?.activated} | ${x.policies?.S2?.changed} |

## 22 partialFace

Population : **${t22.population}** — A compétitif / B STRONG hors set / C aucun STRONG / D plusieurs clusters.

- n = ${t22.n}
- A : ${t22.byKind?.A} · B : ${t22.byKind?.B} · C : ${t22.byKind?.C} · D : ${t22.byKind?.D}

${(t22.items || []).map(it => `- cut ${it.cut} kind=${it.kind} faceA=${it.astar?.face} nStrong=${it.nStrong} nComp=${it.nStrongCompetitive} clusters=${it.nClusters} ratioS=${it.bestStrong?.ratio == null ? '—' : it.bestStrong.ratio.toFixed(2)} S1=${it.s1?.motif}`).join('\n')}

Ne pas transformer automatiquement PARTIAL_FACE en candidate.

## 5 flancs insuffisants

${(s.five || []).map(f => `- cut ${f.cut} nStrong=${f.nStrong} nComp=${f.nStrongCompetitive} ${f.note}`).join('\n')}

Abstention si le seul STRONG est hors competitive set.

## Gel

${s.freeze ? `Variante \`${s.freeze.id}\` : ${s.freeze.note}` : 'Aucune variante gelée.'}

Oracle humain interdit pendant génération, arbitrage, choix des règles.

## Exceptions 836 / 756

${(s.exceptions || []).map(e => `- cut ${e.cut} ${e.side} \`${e.tag}\` A_STAR=${e.astar}`).join('\n')}

Ne pas transformer ce laboratoire en version Banane.
`;
}

function slimRail(r) {
  return {
    key: r.key, role: r.role, ok: r.ok, reason: r.reason || null,
    sessionId: r.sessionId, side: r.side, cut: r.cut, part: r.part,
    exception: r.exception || null, is9644: r.is9644 || false, isInsufficient5: r.isInsufficient5 || false,
    frame: r.frame || null, engine: r.engine || null, astar: r.astar || null,
    alreadyQualified: r.alreadyQualified || false,
    poolMeta: r.poolMeta || null,
    pool: (r.pool || []).slice(0, 24),
    bestLoss: r.bestLoss || null, bestStrong: r.bestStrong || null,
    competitive: r.competitive ? {
      lmin: r.competitive.lmin, ratioLimit: r.competitive.ratioLimit,
      nPool: r.competitive.nPool, nCompetitive: r.competitive.nCompetitive,
      nStrongPool: r.competitive.nStrongPool, nStrongCompetitive: r.competitive.nStrongCompetitive,
      nClusters: r.competitive.nClusters,
      competitive: (r.competitive.competitive || []).slice(0, 12),
      strongCompetitive: (r.competitive.strongCompetitive || []).slice(0, 8),
    } : null,
    policies: r.policies || null,
  };
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/competitive-support-arbitration-v1.json'),
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

function writeArtifacts(report, output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report));
  const slim = {
    format: report.format, branch: report.branch, nature: report.nature,
    generatedAt: report.generatedAt, elapsedMs: report.elapsedMs,
    head: report.head, base: report.base, hashes: report.hashes,
    parity: report.parity, science: report.science,
    rails: report.rails.map(slimRail),
  };
  fs.writeFileSync(output.replace(/\.json$/, '.slim.json'), JSON.stringify(slim));
  fs.writeFileSync(path.join(ROOT, 'COMPETITIVE_SUPPORT_ARBITRATION_V1.md'), renderMarkdown(report));
  try { fs.writeFileSync(path.resolve(ROOT, '../public/competitive-support-arbitration-v1.json'), JSON.stringify(slim)); } catch { /* */ }
  try { fs.writeFileSync(path.resolve(ROOT, '../src/lib/competitive-support-arbitration-v1.json'), JSON.stringify(slim)); } catch { /* */ }
  process.stderr.write(`écrit ${output} (${report.rails.length} rails, ${report.elapsedMs} ms)\n`);
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const aStarHash = FAA.assertAStarFrozen();
  if (RATIO !== 1.5) throw Error('minTemplateLossRatio drift: ' + RATIO);
  if (ENGINE_Y !== 0.08 || ENGINE_Z !== 0.04) throw Error('searchY/Z drift');
  const prev = loadPrevAstar();
  const faaVsStab = fileParityFaaVsStab(prev.faaRails, prev.stabRails);
  const pop = U.loadPopulation();
  const geometrySha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry.js')));
  const baselineSha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry-baseline.js')));
  let failureKeys = pop.failureKeys.slice();
  let controlKeys = pop.controlKeys.slice();
  if (args.limit > 0) {
    failureKeys = failureKeys.slice(0, args.limit);
    controlKeys = controlKeys.slice(0, args.limit);
  }
  const { base, docs, visits } = N.readVisits(args.data || N.DEFAULT_ROOT);
  const assembled = Stab.assembleNeeded(visits, [...failureKeys, ...controlKeys], docs, base);
  const byKey = new Map(assembled.map(r => [r.key, r]));
  const rails = [];
  function push(key, role) {
    const item = byKey.get(key);
    const ident = U.parseKey(key);
    if (!item || !item.assembled?.ready) {
      rails.push({
        key, role, ok: false, skipReasons: item?.assembled?.reasons || ['non-assemblé'],
        exception: U.exceptionOf(key), sessionId: ident.sessionId, side: ident.side, cut: ident.cut, part: ident.part,
      });
      return;
    }
    const analysis = analyseRail(item.assembled.capture, item.side, role, key);
    rails.push({
      key, role, sessionId: item.sessionId, side: item.side, cut: item.cut, part: item.part, ...analysis,
    });
  }
  for (const key of failureKeys) push(key, 'failure');
  for (const key of controlKeys) push(key, 'control');

  const currentVsFaa = parityRecord(rails.filter(r => r.ok), prev.faaRails, 'current vs face-aware A_STAR');
  const parity = { faaVsStab, currentVsFaa, pass: faaVsStab.pass && currentVsFaa.pass };
  if (parity.pass) {
    for (const r of rails) applyPolicies(r);
  }

  const report = {
    format: 'competitive-support-arbitration-v1',
    branch: 'lab-competitive-support-arbitration-v1',
    nature: 'experimental-lab',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    head: null, base: '8d98f68',
    hashes: {
      geometry: geometrySha, baselineGeometry: baselineSha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
      aStar: aStarHash,
    },
    population: { failureKeys, controlKeys, key9644: KEY_9644, cuts5: CUTS_5.slice(), locked22: prev.locked22 },
    parity,
    rails,
  };
  report.science = deriveScience(report, prev);
  report.science.parity = parity;
  report.elapsedMs = Date.now() - tAll;
  writeArtifacts(report, args.output);
  return report;
}

module.exports = {
  BASELINE_GEOMETRY_SHA, A_STAR_HASH, ENGINE_Y, ENGINE_Z, KEY_9644, CUTS_5, RATIO, SEP,
  lossRatio, inCompetitive, alreadyQualified, spatialClusters, policyS1, policyS2,
  rankS2, competitiveView, lminOf, deriveScience, build,
};

if (require.main === module) build();
