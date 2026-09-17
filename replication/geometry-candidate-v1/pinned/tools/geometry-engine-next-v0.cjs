#!/usr/bin/env node
'use strict';
/* Geometry Engine Next V0 — branche lab-geometry-engine-next-v0.
 * Composition figée : A_STAR + SUPPORT_FALLBACK_15 (S1). Pas de S2.
 * Aucun nouveau seuil. Pas d’intégration runtime. Pas d’ESV. Ne merge rien. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');
const U = require('./u-hypothesis-lab-v1.cjs');
const FAA = require('./face-aware-arbitration-v1.cjs');
const CSA = require('./competitive-support-arbitration-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = U.BASELINE_GEOMETRY_SHA;
const A_STAR_HASH = FAA.A_STAR_HASH;
const ENGINE_Y = G.DEFAULTS.searchY;
const ENGINE_Z = G.DEFAULTS.searchZ;
const GRID_TOL = 0.003;
const GROSS_TOL = 0.010;
const SEP = G.DEFAULTS.alternativeSeparation;
const RATIO = G.DEFAULTS.minTemplateLossRatio;
const KEY_9644 = FAA.KEY_9644;
const CUTS_5 = FAA.CUTS_5;
const LOCK_PATH = path.join(ROOT, 'audit/rsf-population-v1.json');
const CSA_SLIM = path.join(ROOT, 'audit/competitive-support-arbitration-v1.slim.json');
const PREV_FAA = path.join(ROOT, 'audit/face-aware-arbitration-v1.slim.json');

const COMPOSITION = Object.freeze({
  engine: 'GEOMETRY_ENGINE_NEXT_V0',
  aStar: {
    id: 'A_STAR',
    hash: A_STAR_HASH,
    method: 'median-all-local-points',
    replaceOrigin: false,
    recenterWindow: true,
    searchY: 0.08,
    searchZ: 0.04,
    grid: 0.003,
    minTop: 15,
    minFace: 6,
    uSeedRule: 'median-U of engine-local points via hypothesesA',
  },
  support: {
    id: 'S1',
    title: 'SUPPORT_FALLBACK_15',
    minTemplateLossRatio: 1.5,
    alternativeSeparation: 0.02,
    activatesOnlyIfAStarNotStrong: true,
    uniqueStrongCluster: 'min-loss',
    multiCluster: 'AMBIGUOUS',
    none: 'keep-A_STAR',
  },
  excluded: ['S2'],
  notAGlobalSearchY: true,
  noNewThreshold: true,
});
const COMPOSITION_HASH = SHA(Buffer.from(JSON.stringify(COMPOSITION)));

function round6(x) { return Math.round(Number(x) * 1e6) / 1e6; }

function hypotDelta(a, b) {
  if (!a || !b) return a || b ? Infinity : 0;
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0), (a[2] || 0) - (b[2] || 0));
}

function deltaOf(pub, sign) {
  if (!pub || pub.status !== 'candidate' || !pub.pick) return null;
  return [0, sign * pub.pick.u, pub.pick.z];
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const t = Math.max(0, Math.min(1, q)) * (sorted.length - 1);
  const i = Math.floor(t), f = t - i;
  return sorted[i] * (1 - f) + sorted[Math.min(i + 1, sorted.length - 1)] * f;
}

function lockKey(r) {
  return [r.sessionId, r.visitId, r.part, r.cut, r.side].join('|');
}

function loadLock239() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  if (lock.n !== 239 || lock.rails.length !== 239) throw Error('lock 239 invalide');
  const failures = lock.rails.filter(r => r.cohort === 'failure');
  const controls = lock.rails.filter(r => r.cohort === 'control');
  if (failures.length !== 63 || controls.length !== 176) throw Error('lock 63/176 invalide');
  return {
    source: lock.source, n: lock.n,
    failureKeys: failures.map(lockKey),
    controlKeys: controls.map(lockKey),
    rails: lock.rails,
  };
}

function developmentExposedSet() {
  const pop = U.loadPopulation();
  return new Set([...pop.failureKeys, ...pop.controlKeys]);
}

function assembleKeys(visits, keys, docs, base) {
  const want = new Set(keys);
  const items = [];
  const seen = new Set();
  for (const v of visits) {
    for (const side of ['left', 'right']) {
      const key = N.railKey(v, side);
      if (!want.has(key)) continue;
      seen.add(key);
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
  const tChunks = Date.now();
  const chunks = N.loadNeededChunksComplete(base, docs, needed);
  const chunkMs = Date.now() - tChunks;
  const rails = [];
  for (const key of keys) {
    const item = items.find(x => x.key === key);
    if (!item) {
      rails.push({ key, assembled: { ready: false, reasons: ['visite-absente'] }, visit: null, side: U.parseKey(key).side });
      continue;
    }
    const assembled = N.assembleCapture(item.visit, item.side, chunks);
    const ident = item.visit.identity || {};
    const init = N.initialRail(item.visit, item.side);
    rails.push({
      key, visit: item.visit, side: item.side, assembled,
      sessionId: item.visit.sessionId,
      visitIndex: item.visit.visitIndex,
      part: ident.part, cut: ident.cut,
      cohort: item.visit.cohort,
      human: init.rail ? N.humanDeltaLocal(item.visit, item.side, init.rail) : null,
      humanStatus: item.visit.humanFinalReference?.status || null,
    });
  }
  return { rails, chunksLoaded: chunks.size, chunksNeeded: needed.size, chunkMs, matched: seen.size };
}

function compactEngine(p) {
  const c = U.compactProposal(p);
  c.motif = U.motifOf(c);
  return c;
}

function classifyPair(v46, next) {
  const a = v46 && v46.status === 'candidate';
  const b = next && next.status === 'candidate';
  const nextMotif = next?.motif || null;
  if (!a && b) return 'RECOVERED';
  if (a && !b) {
    if (nextMotif === 'ambiguity') return 'NEW_AMBIGUITY';
    return 'LOST';
  }
  if (!a && !b) {
    if (nextMotif === 'ambiguity' && v46?.motif !== 'ambiguity') return 'NEW_AMBIGUITY';
    return 'UNCHANGED_UNRESOLVED';
  }
  const h = hypotDelta(v46.delta, next.delta);
  if (h <= GRID_TOL) return 'UNCHANGED_GOOD';
  if (h > SEP) return 'DIFFERENT_CANDIDATE';
  return 'MOVED';
}

function analyseAssembled(item, role) {
  const t0 = process.hrtime.bigint();
  const ident = U.parseKey(item.key);
  if (!item.assembled?.ready) {
    return {
      key: item.key, role, ok: false,
      skipReasons: item.assembled?.reasons || ['non-assemblé'],
      exception: U.exceptionOf(item.key),
      sessionId: ident.sessionId, side: ident.side, cut: ident.cut, part: ident.part,
      visitIndex: item.visitIndex ?? null,
      ms: Number(process.hrtime.bigint() - t0) / 1e6,
    };
  }
  const raw = CSA.analyseRail(item.assembled.capture, item.side, role, item.key);
  if (!raw.ok) {
    return {
      key: item.key, role, ok: false,
      skipReasons: [raw.reason || 'frame-invalide'],
      exception: U.exceptionOf(item.key),
      sessionId: item.sessionId, side: item.side, cut: item.cut, part: item.part,
      visitIndex: item.visitIndex ?? null,
      ms: Number(process.hrtime.bigint() - t0) / 1e6,
    };
  }
  CSA.applyPolicies(raw);
  const sign = raw.frame?.sign ?? 1;
  const v46 = raw.engine;
  const astar = raw.astar;
  const s1 = raw.policies?.S1 || null;
  const nextDelta = s1 && s1.status === 'candidate' ? deltaOf(s1, sign) : null;
  const next = s1 ? {
    status: s1.status,
    motif: s1.motif,
    reason: s1.reason || null,
    pick: s1.pick || null,
    delta: nextDelta,
    loss: s1.pick?.loss ?? null,
    topRows: s1.pick?.topRows ?? null,
    faceCount: s1.pick?.faceCount ?? null,
    slope: s1.pick?.slope ?? null,
    slopeLimited: !!s1.pick?.slopeLimited,
    activated: !!s1.activated,
    changed: !!s1.changed,
    nClusters: s1.nClusters ?? null,
    nStrongCompetitive: s1.nStrongCompetitive ?? null,
    note: s1.note || null,
  } : null;
  const astarView = astar ? {
    status: astar.status, motif: astar.motif, reason: astar.reason || null,
    delta: astar.delta, loss: astar.loss, topRows: astar.topRows, faceCount: astar.faceCount,
    slopeLimited: !!astar.slopeLimited, seed: astar.seed, uCenters: astar.uCenters || null,
  } : null;
  const v46View = v46 ? {
    status: v46.status, motif: v46.motif, reason: v46.reason || null,
    delta: v46.delta, loss: v46.loss, topRows: v46.topRows, faceCount: v46.faceCount,
    slopeLimited: !!v46.slopeLimited, seed: v46.seed,
    ambiguity: v46.lossRatio ?? null,
  } : null;
  const clsV46Next = classifyPair(v46View, next);
  const clsV46Astar = classifyPair(v46View, astarView && {
    status: astarView.status, motif: astarView.motif, delta: astarView.delta,
  });
  const clsAstarNext = classifyPair(astarView && {
    status: astarView.status, motif: astarView.motif, delta: astarView.delta,
  }, next);
  let attribution = 'UNCHANGED';
  const astarDiffers = clsV46Astar !== 'UNCHANGED_GOOD' && clsV46Astar !== 'UNCHANGED_UNRESOLVED';
  const s1Differs = !!(s1 && s1.changed);
  if (astarDiffers && s1Differs) attribution = 'C';
  else if (!astarDiffers && s1Differs) attribution = 'B';
  else if (astarDiffers && !s1Differs) attribution = 'A';
  else if (clsV46Next !== 'UNCHANGED_GOOD' && clsV46Next !== 'UNCHANGED_UNRESOLVED') attribution = 'D';
  const publishedWeak = !!(next && next.status === 'candidate' && next.pick
    && !FAA.qualifyStrong({
      topRows: next.pick.topRows, faceCount: next.pick.faceCount,
      slopeLimited: next.pick.slopeLimited, windowOk: next.pick.windowOk !== false,
    }));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return {
    key: item.key, role, ok: true,
    exception: U.exceptionOf(item.key),
    sessionId: item.sessionId, side: item.side, cut: item.cut, part: item.part,
    visitIndex: item.visitIndex ?? null,
    is9644: item.key === KEY_9644,
    isInsufficient5: CUTS_5.includes(Number(item.cut)),
    frame: raw.frame, engine: v46View, astar: astarView, next,
    alreadyQualified: !!raw.alreadyQualified,
    competitive: raw.competitive ? {
      lmin: raw.competitive.lmin, nPool: raw.competitive.nPool,
      nCompetitive: raw.competitive.nCompetitive,
      nStrongPool: raw.competitive.nStrongPool,
      nStrongCompetitive: raw.competitive.nStrongCompetitive,
      nClusters: raw.competitive.nClusters,
    } : null,
    poolMeta: raw.poolMeta || null,
    bestStrong: raw.bestStrong || null,
    classV46Next: clsV46Next,
    classV46Astar: clsV46Astar,
    classAstarNext: clsAstarNext,
    attribution,
    publishedWeak,
    s1Activated: !!s1?.activated,
    s1Changed: !!s1?.changed,
    humanStatus: item.humanStatus || null,
    human: item.human || null,
    hypotV46Human: (item.human && v46View?.delta) ? round6(hypotDelta(v46View.delta, item.human)) : null,
    hypotNextHuman: (item.human && nextDelta) ? round6(hypotDelta(nextDelta, item.human)) : null,
    hypotAstarV46: (astarView?.delta && v46View?.delta) ? round6(hypotDelta(astarView.delta, v46View.delta)) : null,
    hypotNextV46: (nextDelta && v46View?.delta) ? round6(hypotDelta(nextDelta, v46View.delta)) : null,
    ms,
  };
}

function tallyClasses(rails) {
  const out = {
    UNCHANGED_GOOD: 0, UNCHANGED_UNRESOLVED: 0, RECOVERED: 0, LOST: 0,
    MOVED: 0, NEW_AMBIGUITY: 0, NEW_ABSTENTION: 0, DIFFERENT_CANDIDATE: 0,
  };
  for (const r of rails) {
    if (!r.ok) continue;
    const c = r.classV46Next;
    if (c === 'LOST' && r.next?.motif && r.next.motif !== 'ambiguity') out.NEW_ABSTENTION++;
    if (out[c] == null) out[c] = 0;
    out[c]++;
  }
  return out;
}

function engineStats(rails, field) {
  const rows = rails.filter(r => r.ok);
  let published = 0, unresolved = 0, strong = 0, partial = 0, weak = 0, slope = 0, amb = 0;
  for (const r of rows) {
    const e = r[field];
    if (!e) continue;
    if (e.status === 'candidate') {
      published++;
      const face = e.faceCount || 0;
      if (face >= 6) strong++;
      else if (face >= 3) partial++;
      else weak++;
    } else {
      unresolved++;
      if (e.motif === 'slope') slope++;
      if (e.motif === 'ambiguity') amb++;
    }
  }
  return { n: rows.length, published, unresolved, strong, partial, weak, slope, ambiguity: amb };
}

function compareToV46(rails, field) {
  const rows = rails.filter(r => r.ok && !r.exception);
  let recovered = 0, lost = 0, kept = 0, moved = 0, movedGross = 0, newAmb = 0;
  const recoveredKeys = [], lostKeys = [], movedKeys = [], grossKeys = [];
  for (const r of rows) {
    const a = r.engine, b = r[field];
    if (!a || !b) continue;
    const aC = a.status === 'candidate', bC = b.status === 'candidate';
    if (!aC && bC) { recovered++; recoveredKeys.push({ key: r.key, cut: r.cut, side: r.side }); }
    else if (aC && !bC) {
      lost++;
      lostKeys.push({ key: r.key, cut: r.cut, side: r.side, motif: b.motif, reason: b.reason });
      if (b.motif === 'ambiguity') newAmb++;
    } else if (aC && bC) {
      kept++;
      const h = hypotDelta(a.delta, b.delta);
      if (h > GRID_TOL) { moved++; movedKeys.push({ key: r.key, cut: r.cut, side: r.side, hypot: round6(h) }); }
      if (h > GROSS_TOL) { movedGross++; grossKeys.push({ key: r.key, cut: r.cut, side: r.side, hypot: round6(h) }); }
    }
  }
  return { n: rows.length, recovered, lost, kept, moved, movedGross, newAmb, recoveredKeys, lostKeys, movedKeys, grossKeys };
}

function parityAgainstCsa(rails, prevRails) {
  const byK = new Map((prevRails || []).map(r => [r.key, r]));
  const astarM = [], s1M = [];
  for (const r of rails) {
    const e = byK.get(r.key);
    if (!e) { astarM.push({ key: r.key, kind: 'missing-prev' }); continue; }
    const a = r.astar, p = e.astar;
    if (!a || !p) { astarM.push({ key: r.key, kind: 'absent' }); continue; }
    if ((a.status || null) !== (p.status || null)) astarM.push({ key: r.key, kind: 'status', got: a.status, exp: p.status });
    else if ((a.motif || null) !== (p.motif || null)) astarM.push({ key: r.key, kind: 'motif', got: a.motif, exp: p.motif });
    else if (hypotDelta(a.delta, p.delta) > 1e-9) astarM.push({ key: r.key, kind: 'delta', hypot: round6(hypotDelta(a.delta, p.delta)) });
    const s = r.next, q = e.policies?.S1;
    if (!s || !q) { s1M.push({ key: r.key, kind: 'absent-s1' }); continue; }
    if ((s.status || null) !== (q.status || null)) s1M.push({ key: r.key, kind: 'status', got: s.status, exp: q.status });
    else if ((s.motif || null) !== (q.motif || null)) s1M.push({ key: r.key, kind: 'motif', got: s.motif, exp: q.motif });
    else if (!!s.changed !== !!q.changed) s1M.push({ key: r.key, kind: 'changed' });
    else {
      const sign = r.frame?.sign ?? 1;
      const dGot = s.delta, dExp = q.status === 'candidate' ? deltaOf(q, sign) : null;
      if (hypotDelta(dGot, dExp) > 1e-9) s1M.push({ key: r.key, kind: 'delta', hypot: round6(hypotDelta(dGot, dExp)) });
    }
  }
  return {
    n: rails.length,
    astar: { nMismatch: astarM.length, pass: astarM.length === 0, mismatches: astarM.slice(0, 20) },
    s1: { nMismatch: s1M.length, pass: s1M.length === 0, mismatches: s1M.slice(0, 20) },
    pass: astarM.length === 0 && s1M.length === 0,
  };
}

function knownBadLabel(r) {
  const v46 = r.engine, next = r.next;
  const human = r.human;
  const v46Wrong = !!(human && v46?.status === 'candidate' && hypotDelta(v46.delta, human) > GROSS_TOL);
  let nextKind = 'SAME_STRUCTURE_NEXT';
  if (!next || next.status !== 'candidate') nextKind = 'ABSTENTION_NEXT';
  else if (v46?.status === 'candidate' && hypotDelta(v46.delta, next.delta) > SEP) nextKind = 'ALTERNATIVE_STRUCTURE_NEXT';
  else if (v46?.status !== 'candidate' && next.status === 'candidate') nextKind = 'ALTERNATIVE_STRUCTURE_NEXT';
  return {
    key: r.key, cut: r.cut, side: r.side, visitIndex: r.visitIndex, part: r.part, sessionId: r.sessionId,
    primary: [102, 103, 105].includes(Number(r.visitIndex)),
    v46: v46 && { status: v46.status, motif: v46.motif, delta: v46.delta, faceCount: v46.faceCount, loss: v46.loss },
    next: next && { status: next.status, motif: next.motif, delta: next.delta, faceCount: next.faceCount, loss: next.loss, activated: next.activated, changed: next.changed },
    humanStatus: r.humanStatus, human: r.human,
    hypotV46Human: r.hypotV46Human, hypotNextHuman: r.hypotNextHuman,
    baseline: v46Wrong ? 'WRONG_STRUCTURE_BASELINE' : (v46?.status === 'candidate' ? 'CANDIDATE_BASELINE' : 'UNRESOLVED_BASELINE'),
    nextKind,
    improved: (r.hypotNextHuman != null && r.hypotV46Human != null) ? r.hypotNextHuman + GRID_TOL < r.hypotV46Human : null,
    degraded: (r.hypotNextHuman != null && r.hypotV46Human != null) ? r.hypotNextHuman > r.hypotV46Human + GRID_TOL : null,
  };
}

function postHocOf(rails) {
  const rows = rails.filter(r => r.ok);
  const byRef = { available: 0, absente: 0, ambigue: 0 };
  const measurable = [];
  for (const r of rows) {
    const st = r.humanStatus;
    if (st === 'candidate-observed' && r.human) byRef.available++;
    else if (st && st !== 'candidate-observed') byRef.ambigue++;
    else byRef.absente++;
    if (r.human && r.engine?.status === 'candidate' && r.next?.status === 'candidate') {
      const a = r.hypotV46Human, b = r.hypotNextHuman;
      if (a == null || b == null) continue;
      measurable.push({
        key: r.key, cut: r.cut, side: r.side, role: r.role,
        hypotV46: a, hypotNext: b, improved: b + 1e-9 < a, degraded: b > a + 1e-9,
        pair: true,
      });
    }
  }
  const hv = measurable.map(x => x.hypotV46).sort((a, b) => a - b);
  const hn = measurable.map(x => x.hypotNext).sort((a, b) => a - b);
  const band = (arr) => ({
    le10: arr.filter(x => x <= GROSS_TOL).length,
    b10_20: arr.filter(x => x > GROSS_TOL && x <= 0.020).length,
    gt20: arr.filter(x => x > 0.020).length,
  });
  return {
    n: rows.length, byRef, nMeasurable: measurable.length,
    medianV46: hv.length ? quantile(hv, 0.5) : null,
    medianNext: hn.length ? quantile(hn, 0.5) : null,
    bandsV46: band(hv), bandsNext: band(hn),
    improved: measurable.filter(x => x.improved).length,
    degraded: measurable.filter(x => x.degraded).length,
    items: measurable.filter(x => x.improved || x.degraded).slice(0, 40),
    unit: 'unités de scène (×10⁻³ non calibré, pas des millimètres)',
    note: 'Oracle ouvert seulement après gel. Aucun retuning.',
  };
}

function perfOf(rails) {
  const ms = rails.filter(r => r.ok).map(r => r.ms).sort((a, b) => a - b);
  const pools = rails.filter(r => r.ok && r.competitive).map(r => r.competitive.nPool);
  const comps = rails.filter(r => r.ok && r.competitive).map(r => r.competitive.nCompetitive);
  const act = rails.filter(r => r.ok && r.s1Activated).length;
  const chg = rails.filter(r => r.ok && r.s1Changed).length;
  const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return {
    n: ms.length,
    medianMs: ms.length ? quantile(ms, 0.5) : null,
    p95Ms: ms.length ? quantile(ms, 0.95) : null,
    maxMs: ms.length ? ms[ms.length - 1] : null,
    meanPool: mean(pools), meanCompetitive: mean(comps),
    s1Activated: act, s1Changed: chg,
    s1ActivatedShare: ms.length ? act / ms.length : null,
  };
}

function deriveScience(report) {
  const rails = report.rails.filter(r => r.role !== 'known-bad-extra');
  const extras = report.rails.filter(r => r.role === 'known-bad-extra');
  const failures = rails.filter(r => r.role === 'failure');
  const controls = rails.filter(r => r.role === 'control');
  const okF = failures.filter(r => r.ok && !r.exception);
  const okC = controls.filter(r => r.ok);
  const nextF = compareToV46(okF, 'next');
  const nextC = compareToV46(okC, 'next');
  const astarF = compareToV46(okF, 'astar');
  const astarC = compareToV46(okC, 'astar');
  const displacedAlreadyStrong = okC.filter(r => r.alreadyQualified && r.s1Changed).length;
  const activatedOnStrong = okC.filter(r => r.alreadyQualified && r.s1Activated).length;
  const publishedWeak = rails.filter(r => r.ok && r.publishedWeak).length;
  const publishedFar = rails.filter(r => r.ok && r.s1Changed && r.next?.status === 'candidate' && r.competitive?.lmin > 0
    && r.next.loss / r.competitive.lmin > RATIO + 1e-12).length;
  const astarGross = okC.filter(r => r.hypotAstarV46 != null && r.hypotAstarV46 > GROSS_TOL).length;
  const s1NewGross = okC.filter(r => r.s1Changed && r.hypotNextV46 != null && r.hypotNextV46 > GROSS_TOL
    && !(r.hypotAstarV46 != null && r.hypotAstarV46 > GROSS_TOL)).length;
  const r9644 = rails.find(r => r.key === KEY_9644);
  const restored9644 = !!(r9644 && r9644.next?.status === 'candidate');
  const r5088 = rails.find(r => Number(r.cut) === 5088);
  const r5146 = rails.find(r => Number(r.cut) === 5146);
  const classes = tallyClasses(rails.filter(r => r.ok));
  const attr = { A: 0, B: 0, C: 0, D: 0, UNCHANGED: 0 };
  for (const r of rails.filter(r => r.ok)) attr[r.attribution] = (attr[r.attribution] || 0) + 1;
  const exposed = rails.filter(r => r.exposure === 'DEVELOPMENT_EXPOSED');
  const hold = rails.filter(r => r.exposure === 'NOT_DIRECTLY_USED_FOR_TUNING');
  const split = (subset) => ({
    n: subset.length, nOk: subset.filter(r => r.ok).length,
    v46: engineStats(subset, 'engine'),
    astar: engineStats(subset, 'astar'),
    next: engineStats(subset, 'next'),
    vsV46: compareToV46(subset, 'next'),
    vsV46Astar: compareToV46(subset, 'astar'),
    classes: tallyClasses(subset),
    s1Changed: subset.filter(r => r.ok && r.s1Changed).length,
    s1Activated: subset.filter(r => r.ok && r.s1Activated).length,
  });
  const knownPrimary = report.knownBad?.items || [];
  const knownAggravated = knownPrimary.filter(x => x.degraded === true && x.primary).length;
  const knownImproved = knownPrimary.filter(x => x.improved === true && x.primary).length;
  const r2894 = rails.find(r => Number(r.cut) === 2894 && r.side === 'left');
  const five = rails.filter(r => r.isInsufficient5).map(r => ({
    cut: r.cut, side: r.side, key: r.key,
    astar: r.astar && { motif: r.astar.motif, faceCount: r.astar.faceCount, topRows: r.astar.topRows },
    next: r.next && { status: r.next.status, motif: r.next.motif, changed: r.next.changed, faceCount: r.next.faceCount },
  }));
  const published22 = rails.filter(r => report.locked22?.includes(r.key) && r.next?.status === 'candidate').length;

  let lotStatus = 'INCONCLUSIVE';
  const parityPass = !!report.parity?.pass;
  const coverageOk = report.coverage?.assembled === 239;
  if (!parityPass) lotStatus = 'INCONCLUSIVE';
  else if (displacedAlreadyStrong > 0 || publishedWeak > 0 || publishedFar > 0 || nextC.lost > 0 || s1NewGross > 0) {
    lotStatus = 'REGRESSIVE';
  } else if (astarGross > 0 || knownAggravated > 0) {
    lotStatus = 'INCONCLUSIVE';
  } else if (coverageOk && restored9644 && nextC.lost === 0 && displacedAlreadyStrong === 0 && publishedFar === 0 && publishedWeak === 0) {
    lotStatus = 'PROMISING';
  } else if (coverageOk && nextF.recovered === 0 && nextC.lost === 0) {
    lotStatus = 'NEUTRAL';
  }

  const answerParts = [];
  answerParts.push('Parité 53+53 : A_STAR ' + (report.parity?.astar?.pass ? 'PASS' : 'FAIL') + ', S1 ' + (report.parity?.s1?.pass ? 'PASS' : 'FAIL') + '.');
  answerParts.push('Couverture ' + (report.coverage?.assembled || 0) + '/239.');
  answerParts.push('9644 restauré=' + restored9644 + ' (pas une exception).');
  answerParts.push('S1 : activations ' + rails.filter(r => r.ok && r.s1Activated).length + ', changements ' + rails.filter(r => r.ok && r.s1Changed).length + ' (5088, 5146, 9644, 2894).');
  answerParts.push('Ablation 176 témoins : V4.6 perdus NEXT=' + nextC.lost + ' A_STAR=' + astarC.lost + ' ; RSF récupérés NEXT=' + nextF.recovered + ' A_STAR=' + astarF.recovered + '.');
  answerParts.push('Attribution des écarts A/B/C/D = ' + attr.A + '/' + attr.B + '/' + attr.C + '/' + attr.D + '.');
  answerParts.push('A_STAR héritage : ' + astarGross + ' saut >10 mm (S1 nouveaux=' + s1NewGross + '). far S1=' + publishedFar + '.');
  answerParts.push('Cohorte 102/103/105 : améliorés ' + knownImproved + ', aggravés ' + knownAggravated + ' (seuil 3 mm).');
  if (lotStatus === 'PROMISING') answerParts.push('Lot PROMISING au sens du gate 239. Pas un candidat d’intégration runtime.');
  if (lotStatus === 'INCONCLUSIVE') answerParts.push('Lot INCONCLUSIVE comme Geometry Candidate : pas une conclusion de production.');
  if (lotStatus === 'REGRESSIVE') answerParts.push('Lot REGRESSIVE sur le banc 239.');

  return {
    lotStatus, answer: answerParts.join(' '),
    compositionHash: COMPOSITION_HASH, aStarHash: A_STAR_HASH, aStarFrozen: true,
    searchY: ENGINE_Y, searchZ: ENGINE_Z, minFace: G.DEFAULTS.minFace, minTop: G.DEFAULTS.minTop,
    minTemplateLossRatio: RATIO, alternativeSeparation: SEP, noNewThreshold: true,
    s2Excluded: true,
    restored9644, publishedWeak, publishedFar, displacedAlreadyStrong, activatedOnStrong,
    astarGross, s1NewGross, published22, five,
    rail5088: r5088 && { key: r5088.key, astar: r5088.astar?.motif, next: r5088.next?.status, face: r5088.next?.faceCount, changed: r5088.s1Changed },
    rail2894: r2894 && { key: r2894.key, astar: r2894.astar?.motif, next: r2894.next?.status, face: r2894.next?.faceCount, changed: r2894.s1Changed },
    rail5146: r5146 && {
      key: r5146.key, astar: r5146.astar?.motif, astarSlopeLimited: r5146.astar?.slopeLimited,
      next: r5146.next?.status, nextMotif: r5146.next?.motif, nextSlopeLimited: r5146.next?.slopeLimited,
      changed: r5146.s1Changed, note: 'S1 figé ; motif pente A_STAR conservé si le STRONG compétitif est lui-même slopeLimited.',
    },
    classes, attribution: attr,
    ablation: {
      all: split(rails),
      failures63: split(failures),
      controls176: split(controls),
      developmentExposed: split(exposed),
      notDirectlyUsedForTuning: split(hold),
    },
    vsV46: { failures: nextF, controls: nextC },
    vsV46Astar: { failures: astarF, controls: astarC },
    knownBad: {
      n: knownPrimary.length, nPrimary: knownPrimary.filter(x => x.primary).length,
      improved: knownImproved, aggravated: knownAggravated,
      extras: extras.length,
    },
    postHoc: report.postHoc,
    performance: report.performance,
    holdoutNote: 'Les 53+53 des labs No-Support / U / A_STAR / Face-Aware / Competitive sont DEVELOPMENT_EXPOSED. Le complément du lock 239 n’est pas un holdout aveugle : Geometry Prototype V1 a déjà parcouru le lock (221 assemblés alors).',
  };
}

function renderMarkdown(report) {
  const s = report.science;
  const a = s.ablation || {};
  const c239 = a.all || {};
  const f = a.failures63 || {};
  const c = a.controls176 || {};
  const p = report.parity || {};
  return `# Geometry Engine Next V0

Lot **EXPÉRIMENTAL**. Branche \`lab-geometry-engine-next-v0\`. Aucun merge. Pas d’intégration runtime. Pas d’ESV.

- Branche : \`lab-geometry-engine-next-v0\`
- HEAD : \`${report.head || '(après commit)'}\`
- Base : \`a97373e\` (Competitive Support V1, lab \`2ac4e6a\`)
- Commande : \`node tools/geometry-engine-next-v0.cjs\`
- Tests : \`node tests/geometry-engine-next-v0.test.cjs\`

**Statut du lot : \`${s.lotStatus}\`.**

## Composition figée

- Nom : \`GEOMETRY_ENGINE_NEXT_V0\`
- Hash composition : \`${s.compositionHash}\`
- A_STAR hash : \`${s.aStarHash}\` **figé** — médiane U, replaceOrigin false, fenêtre recentrée, searchY **${s.searchY}**, searchZ **${s.searchZ}**, minTop **${s.minTop}**, minFace **${s.minFace}**
- S1 : \`SUPPORT_FALLBACK_15\` — minTemplateLossRatio **${s.minTemplateLossRatio}** (constante V4.6, pas un nouveau seuil)
- S2 **exclu** de NEXT V0 (comparaison du lot amont seulement)
- Baseline géométrie inchangée : **${report.hashes.baselineUnchanged ? 'oui' : 'non'}**
- Durée : ${((report.elapsedMs || 0) / 1000).toFixed(1)} s

Ce n’est **pas** encore un candidat d’intégration.

## Gate de parité 53+53

| comparaison | n | mismatches | pass |
|---|---:|---:|---|
| A_STAR vs Competitive Support V1 | ${p.astar?.nMismatch != null ? p.n : '—'} | ${p.astar?.nMismatch} | ${p.astar?.pass} |
| S1 vs Competitive Support V1 | ${p.s1?.nMismatch != null ? p.n : '—'} | ${p.s1?.nMismatch} | ${p.s1?.pass} |

- 9644 restauré : **${s.restored9644}**
- 5088 : ${s.rail5088 ? (s.rail5088.next + ' face=' + s.rail5088.face) : 'absent'}
- 2894 : ${s.rail2894 ? ('A_STAR ' + s.rail2894.astar + ' → NEXT ' + s.rail2894.next) : 'absent'}
- 5 insufficient publiés : **${(s.five || []).filter(x => x.next?.status === 'candidate').length}/5**
- 5146 : A_STAR \`${s.rail5146?.astar}\` slopeLimited=${s.rail5146?.astarSlopeLimited} → NEXT \`${s.rail5146?.nextMotif}\` slopeLimited=${s.rail5146?.nextSlopeLimited}
- far S1 : **${s.publishedFar}** · PARTIAL/WEAK publiés : **${s.publishedWeak}** · déjà-STRONG déplacés : **${s.displacedAlreadyStrong}**
- sauts A_STAR >10 mm hérités : **${s.astarGross}** · sauts S1 nouveaux : **${s.s1NewGross}**

${p.pass ? 'Parité PASS. Replay 239 autorisé.' : 'Parité FAIL. STOP — le 239 n’est pas une lecture de gate.'}

## Population 239/239

- Source lock : \`${report.coverage?.source}\`
- Assemblés : **${report.coverage?.assembled} / 239**
- Ignorés : **${report.coverage?.skipped}**
- Chunks : ${report.coverage?.chunksLoaded}/${report.coverage?.chunksNeeded} (lecteur complet, nuages inline)
- Failures RSF : 63 · témoins : 176

${(report.coverage?.skippedItems || []).map(x => `- \`${x.key}\` ${ (x.reasons || []).join(', ') }`).join('\n') || 'Aucun rail fail-closed.'}

## Ablation V4.6 / A_STAR / A_STAR+S1

| cohorte | n | V4.6 pub. | A_STAR pub. | NEXT pub. | récup. NEXT | perdus NEXT | dépl. NEXT | >10 mm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 239 | ${c239.nOk} | ${c239.v46?.published} | ${c239.astar?.published} | ${c239.next?.published} | ${c239.vsV46?.recovered} | ${c239.vsV46?.lost} | ${c239.vsV46?.moved} | ${c239.vsV46?.movedGross} |
| 63 RSF | ${f.nOk} | ${f.v46?.published} | ${f.astar?.published} | ${f.next?.published} | ${f.vsV46?.recovered} | ${f.vsV46?.lost} | ${f.vsV46?.moved} | ${f.vsV46?.movedGross} |
| 176 témoins | ${c.nOk} | ${c.v46?.published} | ${c.astar?.published} | ${c.next?.published} | ${c.vsV46?.recovered} | ${c.vsV46?.lost} | ${c.vsV46?.moved} | ${c.vsV46?.movedGross} |
| DEVELOPMENT_EXPOSED | ${a.developmentExposed?.nOk} | ${a.developmentExposed?.v46?.published} | ${a.developmentExposed?.astar?.published} | ${a.developmentExposed?.next?.published} | ${a.developmentExposed?.vsV46?.recovered} | ${a.developmentExposed?.vsV46?.lost} | ${a.developmentExposed?.vsV46?.moved} | ${a.developmentExposed?.vsV46?.movedGross} |
| NOT_DIRECTLY_USED | ${a.notDirectlyUsedForTuning?.nOk} | ${a.notDirectlyUsedForTuning?.v46?.published} | ${a.notDirectlyUsedForTuning?.astar?.published} | ${a.notDirectlyUsedForTuning?.next?.published} | ${a.notDirectlyUsedForTuning?.vsV46?.recovered} | ${a.notDirectlyUsedForTuning?.vsV46?.lost} | ${a.notDirectlyUsedForTuning?.vsV46?.moved} | ${a.notDirectlyUsedForTuning?.vsV46?.movedGross} |

S1 n’est pas « plus de candidates ⇒ meilleur ». Contribution marginale de S1 après A_STAR : changements S1 = ${c239.s1Changed}, déjà-STRONG déplacés = ${s.displacedAlreadyStrong}, PARTIAL/WEAK publiés = ${s.publishedWeak}, far = ${s.publishedFar}.

Saut >10 mm hérités d’A_STAR (S1 inactif) : ${(c.vsV46?.grossKeys || []).map(g => 'cut ' + g.cut + ' ' + g.side + ' hypot=' + g.hypot).join(', ') || 'aucun'}.


## Classes V4.6 → NEXT

${Object.entries(s.classes || {}).map(([k, v]) => `- \`${k}\` : **${v}**`).join('\n')}

## Attribution des écarts (A A_STAR seul / B S1 / C les deux / D autre)

A=${s.attribution?.A} B=${s.attribution?.B} C=${s.attribution?.C} D=${s.attribution?.D} inchangés=${s.attribution?.UNCHANGED}

${(s.attribution?.B || 0) > (s.attribution?.A || 0) ? 'S1 fait un travail réel au-delà d’A_STAR.' : 'NEXT V0 ≈ A_STAR + fallback rare.'}

## Mauvais placements connus (visite 102 / 103 / 105)

Cohorte séparée, **pas** un sous-ensemble RSF. Aucun retuning.

- n = ${s.knownBad?.n} (primaires 102/103/105 : ${s.knownBad?.nPrimary})
- améliorés vs humain (post-hoc) : ${s.knownBad?.improved}
- aggravés : ${s.knownBad?.aggravated}

${(report.knownBad?.items || []).filter(x => x.primary).map(x => `- vi ${x.visitIndex} cut ${x.cut} ${x.side} ${x.baseline} → ${x.nextKind} hypotV46=${x.hypotV46Human ?? '—'} hypotNEXT=${x.hypotNextHuman ?? '—'}`).join('\n')}

## Development exposure

${s.holdoutNote}

Ce n’est **pas** un faux holdout.

## Oracle humain (Phase B, après gel)

${s.postHoc?.note}
Références : disponibles ${s.postHoc?.byRef?.available} · absentes ${s.postHoc?.byRef?.absente} · ambiguës ${s.postHoc?.byRef?.ambigue}.
Paires mesurables : ${s.postHoc?.nMeasurable}. Médiane V4.6 ${s.postHoc?.medianV46} · NEXT ${s.postHoc?.medianNext} ${s.postHoc?.unit}.
Améliorés ${s.postHoc?.improved} · dégradés ${s.postHoc?.degraded}.
Bandes NEXT ≤10 / 10–20 / >20 (unités de scène) : ${s.postHoc?.bandsNext?.le10} / ${s.postHoc?.bandsNext?.b10_20} / ${s.postHoc?.bandsNext?.gt20}.

## Performance

- médiane ${s.performance?.medianMs != null ? s.performance.medianMs.toFixed(1) : '—'} ms/rail
- p95 ${s.performance?.p95Ms != null ? s.performance.p95Ms.toFixed(1) : '—'} ms
- max ${s.performance?.maxMs != null ? s.performance.maxMs.toFixed(1) : '—'} ms
- pool moyen ${s.performance?.meanPool != null ? s.performance.meanPool.toFixed(1) : '—'} · competitive ${s.performance?.meanCompetitive != null ? s.performance.meanCompetitive.toFixed(1) : '—'}
- S1 activé ${s.performance?.s1Activated} · changé ${s.performance?.s1Changed}

## Gate Geometry Candidate

NEXT V0 n’est un futur Geometry Candidate que si : replay complet, témoins non dégradés, pas d’explosion de déplacements, pas de publication non supportée, mauvais placements non aggravés, récupération réelle, S1 n’altère pas les A_STAR STRONG, perf acceptable, métriques exposées séparées, oracle jamais en réglage.

**Verdict : \`${s.lotStatus}\`.** Pas un merge. Pas un runtime.

## Réponse

${s.answer}

Ne pas transformer ce laboratoire en version Banane.
`;
}

function slimRail(r) {
  return {
    key: r.key, role: r.role, ok: r.ok, skipReasons: r.skipReasons || null,
    sessionId: r.sessionId, side: r.side, cut: r.cut, part: r.part, visitIndex: r.visitIndex,
    exception: r.exception || null, exposure: r.exposure || null,
    is9644: r.is9644 || false, alreadyQualified: r.alreadyQualified || false,
    engine: r.engine || null, astar: r.astar || null, next: r.next || null,
    competitive: r.competitive || null,
    classV46Next: r.classV46Next || null, classV46Astar: r.classV46Astar || null,
    attribution: r.attribution || null, s1Activated: r.s1Activated || false, s1Changed: r.s1Changed || false,
    publishedWeak: r.publishedWeak || false,
    humanStatus: r.humanStatus || null,
    hypotV46Human: r.hypotV46Human, hypotNextHuman: r.hypotNextHuman,
    hypotNextV46: r.hypotNextV46, ms: r.ms,
  };
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/geometry-engine-next-v0.json'),
    data: N.DEFAULT_ROOT,
    parityOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output') out.output = path.resolve(argv[++i]);
    else if (a === '--data') out.data = argv[++i];
    else if (a === '--parity-only') out.parityOnly = true;
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
    composition: report.composition, coverage: report.coverage,
    parity: report.parity, science: report.science,
    knownBad: report.knownBad, postHoc: report.postHoc, performance: report.performance,
    rails: report.rails.map(slimRail),
  };
  fs.writeFileSync(output.replace(/\.json$/, '.slim.json'), JSON.stringify(slim));
  fs.writeFileSync(path.join(ROOT, 'GEOMETRY_ENGINE_NEXT_V0.md'), renderMarkdown(report));
  try { fs.writeFileSync(path.resolve(ROOT, '../public/geometry-engine-next-v0.json'), JSON.stringify(slim)); } catch { /* */ }
  try { fs.writeFileSync(path.resolve(ROOT, '../src/lib/geometry-engine-next-v0.json'), JSON.stringify(slim)); } catch { /* */ }
  process.stderr.write(`écrit ${output} (${report.rails.length} rails, ${report.elapsedMs} ms)\n`);
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const aStarHash = FAA.assertAStarFrozen();
  if (aStarHash !== A_STAR_HASH) throw Error('A_STAR hash drift');
  if (RATIO !== 1.5) throw Error('minTemplateLossRatio drift: ' + RATIO);
  if (ENGINE_Y !== 0.08 || ENGINE_Z !== 0.04) throw Error('searchY/Z drift');
  const geometrySha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry.js')));
  const baselineSha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry-baseline.js')));
  const lock = loadLock239();
  const exposedSet = developmentExposedSet();
  const prevCsa = JSON.parse(fs.readFileSync(CSA_SLIM, 'utf8'));
  const locked22 = prevCsa.science?.partial22?.items?.map(i => i.key) || [];
  const { base, docs, visits } = N.readVisits(args.data || N.DEFAULT_ROOT);

  process.stderr.write('[next-v0] parité 53+53\n');
  const pop = U.loadPopulation();
  const parityKeys = [...pop.failureKeys, ...pop.controlKeys];
  const parityAsm = assembleKeys(visits, parityKeys, docs, base);
  const parityRails = [];
  for (const item of parityAsm.rails) {
    const role = pop.failureKeys.includes(item.key) ? 'failure' : 'control';
    parityRails.push(analyseAssembled(item, role));
  }
  const parity = parityAgainstCsa(parityRails.filter(r => r.ok), prevCsa.rails);
  parity.n = parityRails.filter(r => r.ok).length;
  const gate9644 = parityRails.find(r => r.key === KEY_9644);
  const gate5088 = parityRails.find(r => Number(r.cut) === 5088);
  const gate5 = parityRails.filter(r => r.isInsufficient5);
  const gateFar = parityRails.filter(r => r.ok && r.next?.status === 'candidate' && r.competitive?.lmin > 0 && r.next.loss / r.competitive.lmin > RATIO + 1e-12).length;
  const gateStrongMoved = parityRails.filter(r => r.ok && r.alreadyQualified && r.s1Changed).length;
  parity.gate = {
    restored9644: !!(gate9644 && gate9644.next?.status === 'candidate'),
    published5088: !!(gate5088 && gate5088.next?.status === 'candidate'),
    published5: gate5.filter(r => r.next?.status === 'candidate').length,
    publishedFar: gateFar,
    displacedAlreadyStrong: gateStrongMoved,
    extraLost: parityRails.filter(r => r.role === 'control' && r.ok && r.engine?.status === 'candidate' && r.next?.status !== 'candidate').length,
  };
  parity.pass = !!(parity.astar.pass && parity.s1.pass && parity.gate.restored9644 && parity.gate.published5 === 0
    && parity.gate.publishedFar === 0 && parity.gate.displacedAlreadyStrong === 0 && parity.gate.extraLost === 0);

  const report = {
    format: 'geometry-engine-next-v0',
    branch: 'lab-geometry-engine-next-v0',
    nature: 'experimental-lab',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    head: null, base: 'a97373e',
    hashes: {
      geometry: geometrySha, baselineGeometry: baselineSha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
      aStar: aStarHash, composition: COMPOSITION_HASH,
    },
    composition: COMPOSITION,
    locked22,
    parity,
    rails: [],
  };

  if (!parity.pass) {
    report.coverage = { assembled: 0, skipped: 239, source: lock.source, stop: 'parity-failed' };
    report.science = deriveScience(report);
    report.elapsedMs = Date.now() - tAll;
    writeArtifacts(report, args.output);
    process.stderr.write('[next-v0] STOP parité\n');
    return report;
  }
  if (args.parityOnly) {
    report.rails = parityRails;
    report.coverage = { assembled: parityRails.filter(r => r.ok).length, skipped: 0, source: 'parity-53+53' };
    report.science = deriveScience(report);
    report.elapsedMs = Date.now() - tAll;
    writeArtifacts(report, args.output);
    return report;
  }

  process.stderr.write('[next-v0] replay 239\n');
  const allKeys = [...lock.failureKeys, ...lock.controlKeys];
  const asm = assembleKeys(visits, allKeys, docs, base);
  const failSet = new Set(lock.failureKeys);
  const rails = [];
  let done = 0;
  for (const item of asm.rails) {
    const role = failSet.has(item.key) ? 'failure' : 'control';
    const row = analyseAssembled(item, role);
    row.exposure = exposedSet.has(item.key) ? 'DEVELOPMENT_EXPOSED' : 'NOT_DIRECTLY_USED_FOR_TUNING';
    rails.push(row);
    done++;
    if (done % 25 === 0 || done === asm.rails.length) {
      process.stderr.write(`[next-v0] ${done}/${asm.rails.length} (${((Date.now() - tAll) / 1000).toFixed(1)}s)\n`);
    }
  }

  const knownWant = [];
  const lockSet = new Set(allKeys);
  for (const v of visits) {
    const vi = v.visitIndex;
    if (vi < 100 || vi > 107) continue;
    for (const side of ['left', 'right']) {
      if (v.geometryEligibility?.[side]?.status !== 'comparable-candidate') continue;
      const key = N.railKey(v, side);
      if (lockSet.has(key)) continue;
      knownWant.push(key);
    }
  }
  process.stderr.write('[next-v0] cohorte 102/103/105 extras ' + knownWant.length + '\n');
  const extraAsm = knownWant.length ? assembleKeys(visits, knownWant, docs, base) : { rails: [] };
  for (const item of extraAsm.rails) {
    const row = analyseAssembled(item, 'known-bad-extra');
    row.exposure = 'NOT_DIRECTLY_USED_FOR_TUNING';
    rails.push(row);
  }

  const skipped = rails.filter(r => r.role !== 'known-bad-extra' && !r.ok);
  report.coverage = {
    source: lock.source, lock: 239, assembled: rails.filter(r => r.role !== 'known-bad-extra' && r.ok).length,
    skipped: skipped.length, skippedItems: skipped.map(s => ({ key: s.key, reasons: s.skipReasons })),
    chunksLoaded: asm.chunksLoaded, chunksNeeded: asm.chunksNeeded, chunkMs: asm.chunkMs,
    failures: 63, controls: 176,
  };
  report.rails = rails;
  const lockRails = rails.filter(r => r.role !== 'known-bad-extra');
  const knownItems = rails.filter(r => r.ok && r.visitIndex >= 100 && r.visitIndex <= 107).map(knownBadLabel);
  report.knownBad = { items: knownItems };
  report.postHoc = postHocOf(lockRails);
  report.performance = perfOf(lockRails);
  report.science = deriveScience(report);
  report.elapsedMs = Date.now() - tAll;
  writeArtifacts(report, args.output);
  return report;
}

module.exports = {
  BASELINE_GEOMETRY_SHA, A_STAR_HASH, COMPOSITION, COMPOSITION_HASH,
  ENGINE_Y, ENGINE_Z, RATIO, KEY_9644, CUTS_5,
  loadLock239, classifyPair, hypotDelta, deltaOf, assembleKeys, analyseAssembled,
  parityAgainstCsa, deriveScience, renderMarkdown, build,
};

if (require.main === module) build();
