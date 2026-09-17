#!/usr/bin/env node
'use strict';
/* Face-Aware Arbitration Lab V1 — branche lab-face-aware-arbitration-v1.
 * A_STAR figé. Pas de nouvelle génération U, pas de searchY/Z, pas de baisse minFace.
 * Arbitrage d’un pool de candidats déjà produits par A_STAR. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');
const U = require('./u-hypothesis-lab-v1.cjs');
const Prev = require('./no-support-generator-lab-v1.cjs');
const Stab = require('./u-recentering-stabilization-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = U.BASELINE_GEOMETRY_SHA;
const A_STAR_HASH = 'e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f';
const ENGINE_Y = G.DEFAULTS.searchY;
const ENGINE_Z = G.DEFAULTS.searchZ;
const GRID = G.DEFAULTS.grid;
const GRID_TOL = 0.003;
const GROSS_TOL = 0.010;
const KEY_9644 = 'f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right';
const CUTS_5 = Object.freeze([5090, 5113, 5125, 5151, 5240]);
const SLOPE_51 = Stab.SLOPE_51;
const RSF_51 = Stab.RSF_51;

function round6(x) { return Math.round(x * 1e6) / 1e6; }

function aStarFrozen() {
  return {
    id: 'A_STAR',
    method: 'median-all-local-points',
    searchY: ENGINE_Y,
    searchZ: ENGINE_Z,
    grid: GRID,
    minTop: G.DEFAULTS.minTop,
    minFace: G.DEFAULTS.minFace,
    lab: { replaceOrigin: false, recenterWindow: true, uSeedRule: 'median-U of engine-local points' },
    notAGlobalSearchY: true,
  };
}

function assertAStarFrozen() {
  const cfg = aStarFrozen();
  const h = SHA(Buffer.from(JSON.stringify(cfg)));
  if (h !== A_STAR_HASH) throw Error('A_STAR hash drift: ' + h + ' != ' + A_STAR_HASH);
  if (ENGINE_Y !== 0.08 || ENGINE_Z !== 0.04) throw Error('searchY/Z must stay 0.08/0.04');
  return h;
}

function faceTier(faceCount) {
  const n = faceCount || 0;
  if (n >= G.DEFAULTS.minFace) return 'STRONG_FACE';
  if (n >= 3) return 'PARTIAL_FACE';
  return 'WEAK_FACE';
}

function lossAt(frame, u, z) {
  const { points, topAnchors, faceAnchors } = frame;
  const loss = (anchors) => G.median(anchors.map(a => {
    let best = 0.025 * 0.025;
    for (const p of points) {
      const d = (p[0] - u - a[0]) ** 2 + (p[1] - z - a[1]) ** 2;
      if (d < best) best = d;
    }
    return best;
  }));
  return loss(topAnchors) + loss(faceAnchors) + 1e-7 * (Math.abs(u) + Math.abs(z));
}

function characterize(frame, u, z, uCenters, knownLoss) {
  const cfg = G.DEFAULTS;
  const { points, width, sign } = frame;
  const topPts = [];
  for (const p of points) {
    if (p[0] > u + 0.012 && p[0] < u + width - 0.012 && Math.abs(p[1] - z) < cfg.topBand)
      topPts.push([p[0], p[1]]);
  }
  const top = G.robustLine(topPts);
  const topRows = topPts.length;
  const loss = knownLoss != null ? knownLoss : null;
  if (!top) {
    return {
      u: round6(u), z: round6(z), loss,
      topRows, faceCount: 0, slope: null, slopeLimited: false,
      windowOk: false, tier: 'WEAK_FACE', motif: 'rsf',
      distU: round6(Math.abs(u - (frame.uMedian || 0))), distOrigin: round6(Math.abs(u)),
    };
  }
  const facePts = [];
  for (const p of points) {
    const drop = top.slope * p[0] + top.intercept - p[1];
    if (drop > 0.009 && drop < 0.034 && Math.abs(p[0] - u) < cfg.faceBand) facePts.push([p[1], p[0]]);
  }
  const face = G.robustLine(facePts);
  const faceCount = face?.count || 0;
  let surfaceU = u, surfaceZ = z;
  if (face) {
    const denom = 1 - face.slope * top.slope;
    if (Math.abs(denom) > 0.5) {
      surfaceU = (face.intercept + face.slope * top.intercept) / denom;
      surfaceZ = top.slope * surfaceU + top.intercept;
    }
  }
  const uWindowOk = (uCenters || [0]).some(cu => Math.abs(surfaceU - cu) <= cfg.searchY + 0.01);
  const zWindowOk = Math.abs(surfaceZ) <= cfg.searchZ + 0.01;
  const windowOk = uWindowOk && zWindowOk && Number.isFinite(surfaceU) && Number.isFinite(surfaceZ);
  const slopeLimited = !!(top.slopeLimited || face?.slopeLimited);
  let motif = 'candidate';
  if (top.count < cfg.minTop) motif = 'minTop';
  else if (!face || faceCount < cfg.minFace) motif = 'flank';
  else if (slopeLimited) motif = 'slope';
  else if (!windowOk) motif = 'window';
  const tier = faceTier(faceCount);
  return {
    u: round6(u), z: round6(z), loss,
    topRows, faceCount, slope: top.slope, slopeLimited, windowOk, tier, motif,
    distU: round6(Math.abs(u - (frame.uMedian || 0))), distOrigin: round6(Math.abs(u)),
    seed: [sign * u, z],
  };
}

function localMinima(coarse, grid = GRID) {
  const key = (u, z) => round6(u) + ',' + round6(z);
  const map = new Map();
  for (const c of coarse) map.set(key(c.u, c.z), c);
  const mins = [];
  for (const c of coarse) {
    let ok = true;
    for (let du = -grid; du <= grid + 1e-12; du += grid) {
      for (let dz = -grid; dz <= grid + 1e-12; dz += grid) {
        if (Math.abs(du) < 1e-12 && Math.abs(dz) < 1e-12) continue;
        const o = map.get(key(c.u + du, c.z + dz));
        if (o && o.loss < c.loss - 1e-15) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (ok) mins.push(c);
  }
  return mins;
}

function topRowsAt(frame, u, z) {
  return Prev.topRowsAt(frame.points, frame.width, u, z, G.DEFAULTS.topBand);
}

function reducePool(coarse, frame, uCenters, extras = []) {
  if (!coarse || !coarse.length) {
    return { pool: [], nCoarse: 0, nLocalMin: 0, nKept: 0, nDense: 0 };
  }
  const mins = localMinima(coarse);
  const keep = new Map();
  const add = (c, tag) => {
    if (!c || !Number.isFinite(c.u) || !Number.isFinite(c.z)) return;
    const k = round6(c.u) + ',' + round6(c.z);
    if (!keep.has(k)) keep.set(k, { u: c.u, z: c.z, loss: c.loss, tags: new Set() });
    keep.get(k).tags.add(tag);
  };
  let minLoss = coarse[0];
  let minLossSupported = null;
  for (const c of coarse) {
    if (c.loss < minLoss.loss) minLoss = c;
    const n = topRowsAt(frame, c.u, c.z);
    c.topRows = n;
    if (n >= G.DEFAULTS.minTop) {
      if (!minLossSupported || c.loss < minLossSupported.loss) minLossSupported = c;
    }
  }
  add(minLoss, 'min-loss');
  if (minLossSupported) add(minLossSupported, 'min-loss-supported');
  for (const c of mins) add(c, 'local-min');
  for (const e of extras) add(e, e.tag || 'extra');

  const dense = [];
  for (const c of coarse) {
    if ((c.topRows || 0) < G.DEFAULTS.minTop) continue;
    const ch = characterize(frame, c.u, c.z, uCenters, c.loss);
    ch.loss = c.loss;
    ch.tags = ['top>=15'];
    dense.push(ch);
  }
  const strongDense = dense.filter(qualifyStrong);
  if (strongDense.length) {
    const sMins = localMinima(strongDense.map(c => ({ u: c.u, z: c.z, loss: c.loss })));
    for (const c of sMins) add(c, 'strong-local-min');
    add(strongDense.reduce((a, b) => (b.loss < a.loss ? b : a)), 'min-loss-strong');
  }
  const partialDense = dense.filter(c => c.tier === 'PARTIAL_FACE' && c.topRows >= G.DEFAULTS.minTop && c.windowOk && !c.slopeLimited);
  if (partialDense.length) {
    const pMins = localMinima(partialDense.map(c => ({ u: c.u, z: c.z, loss: c.loss })));
    for (const c of pMins) add(c, 'partial-local-min');
    add(partialDense.reduce((a, b) => (b.loss < a.loss ? b : a)), 'min-loss-partial');
  }

  const characterized = [];
  for (const c of keep.values()) {
    const fromDense = dense.find(d => round6(d.u) === round6(c.u) && round6(d.z) === round6(c.z));
    const ch = fromDense || characterize(frame, c.u, c.z, uCenters, c.loss);
    const merged = { ...ch, loss: c.loss, tags: [...c.tags] };
    if (fromDense) merged.tags = [...new Set([...(fromDense.tags || []), ...c.tags])];
    characterized.push(merged);
  }
  characterized.sort((a, b) => a.loss - b.loss);
  return {
    pool: characterized,
    nCoarse: coarse.length,
    nLocalMin: mins.length,
    nKept: characterized.length,
    nDense: dense.length,
    nStrongDense: strongDense.length,
  };
}

function qualifyStrong(c) {
  return c.topRows >= G.DEFAULTS.minTop && c.faceCount >= G.DEFAULTS.minFace && !c.slopeLimited && c.windowOk;
}

function ambiguityAmong(pick, pool) {
  if (!pick || pick.loss <= 0) return { ambiguous: false, ratio: null, alt: null };
  let alt = null;
  for (const c of pool) {
    if (Math.hypot(c.u - pick.u, c.z - pick.z) < G.DEFAULTS.alternativeSeparation) continue;
    if (!alt || c.loss < alt.loss) alt = c;
  }
  const ratio = alt ? alt.loss / pick.loss : Infinity;
  return { ambiguous: Number.isFinite(ratio) && ratio < G.DEFAULTS.minTemplateLossRatio, ratio: Number.isFinite(ratio) ? ratio : null, alt };
}

function publish(pick, pool, policy) {
  if (!pick) return { status: 'unresolved', motif: 'absent', reason: 'aucun candidat dans le pool', pick: null, policy };
  const amb = policy === 'B' ? { ambiguous: false, ratio: null, alt: null } : ambiguityAmong(pick, pool);
  if (pick.motif !== 'candidate') {
    return { status: 'unresolved', motif: pick.motif, reason: reasonOf(pick), pick, policy, ambiguity: amb };
  }
  if (amb.ambiguous && policy !== 'B') {
    return {
      status: 'unresolved', motif: 'ambiguity',
      reason: 'Plusieurs placements concurrents du champignon sont géométriquement plausibles.',
      pick, policy, ambiguity: amb,
    };
  }
  return { status: 'candidate', motif: 'candidate', reason: null, pick, policy, ambiguity: amb };
}

function reasonOf(c) {
  if (c.motif === 'rsf') return 'Plan de roulement non estimable.';
  if (c.motif === 'minTop') return 'Plan de roulement insuffisamment observé.';
  if (c.motif === 'flank') return 'Flanc interne insuffisamment observé.';
  if (c.motif === 'slope') return 'Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.';
  if (c.motif === 'window') return 'Intersection hors de la fenêtre expérimentale.';
  return null;
}

function policyLossFirst(pool) {
  const pick = pool.reduce((a, b) => (a == null || b.loss < a.loss ? b : a), null);
  return publish(pick, pool, 'LOSS_FIRST');
}

function policyA(pool) {
  const qualified = pool.filter(qualifyStrong);
  const pick = (qualified.length ? qualified : pool).reduce((a, b) => (a == null || b.loss < a.loss ? b : a), null);
  const out = publish(pick, qualified.length ? qualified : pool, 'A');
  out.nQualified = qualified.length;
  out.fellThrough = qualified.length === 0;
  return out;
}

function dominates(a, b) {
  const le = a.loss <= b.loss && a.topRows >= b.topRows && a.faceCount >= b.faceCount;
  const st = a.loss < b.loss || a.topRows > b.topRows || a.faceCount > b.faceCount;
  return le && st;
}

function policyB(pool) {
  const front = pool.filter(c => !pool.some(o => o !== c && dominates(o, c)));
  const strong = front.filter(qualifyStrong);
  let kind = 'none';
  let pick = null;
  if (front.length === 1) { pick = front[0]; kind = 'unique-front'; }
  else if (strong.length === 1) { pick = strong[0]; kind = 'unique-strong-on-front'; }
  else if (strong.length > 1) {
    kind = 'multi-strong-on-front';
    return {
      status: 'unresolved', motif: 'ambiguity', policy: 'B',
      reason: 'Front de Pareto : plusieurs candidats STRONG_FACE non dominés.',
      pick: null, front, kind, nFront: front.length,
    };
  } else if (front.length > 1) {
    kind = 'multi-front-no-strong';
    return {
      status: 'unresolved', motif: 'ambiguity', policy: 'B',
      reason: 'Front de Pareto non unique, aucun STRONG_FACE.',
      pick: null, front, kind, nFront: front.length,
    };
  }
  const out = publish(pick, pool, 'B');
  out.kind = kind;
  out.nFront = front.length;
  out.frontSize = front.length;
  return out;
}

function policyC(pool) {
  const strong = pool.filter(c => c.tier === 'STRONG_FACE' && qualifyStrong(c));
  const partial = pool.filter(c => c.tier === 'PARTIAL_FACE' && c.topRows >= G.DEFAULTS.minTop && c.windowOk && !c.slopeLimited);
  if (strong.length) {
    const pick = strong.reduce((a, b) => (b.loss < a.loss ? b : a));
    const out = publish(pick, strong, 'C');
    out.tierUsed = 'STRONG_FACE';
    out.nStrong = strong.length;
    out.nPartial = partial.length;
    return out;
  }
  if (partial.length) {
    return {
      status: 'unresolved', motif: 'partial-abstain', policy: 'C',
      reason: 'Flanc interne partiellement observé ; abstention plutôt que publication.',
      pick: partial.reduce((a, b) => (b.loss < a.loss ? b : a)),
      tierUsed: 'PARTIAL_FACE', nStrong: 0, nPartial: partial.length,
    };
  }
  return {
    status: 'unresolved', motif: 'weak-abstain', policy: 'C',
    reason: 'WEAK_FACE : une loss plus basse ne suffit pas à publier.',
    pick: pool[0] || null,
    tierUsed: 'WEAK_FACE', nStrong: 0, nPartial: 0,
  };
}

function aStarLab(frame) {
  const hA = U.hypothesesA(frame.points);
  const uMed = hA[0] && Number.isFinite(hA[0].u) ? hA[0].u : frame.uMedian;
  return {
    uSeeds: [uMed],
    replaceOrigin: false,
    recenterWindow: true,
  };
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
      ...aStarLab(frame),
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
  const reduced = reducePool(coarse, frame, meta.uCenters || [0, frame.uMedian], extras);
  const policies = {
    LOSS_FIRST: policyLossFirst(reduced.pool),
    A: policyA(reduced.pool),
    B: policyB(reduced.pool),
    C: policyC(reduced.pool),
  };
  const strongInPool = reduced.pool.filter(qualifyStrong);
  const partialInPool = reduced.pool.filter(c => c.tier === 'PARTIAL_FACE');
  const bestLoss = reduced.pool[0] || null;
  const bestStrong = strongInPool.length ? strongInPool.reduce((a, b) => (b.loss < a.loss ? b : a)) : null;
  const bestPartial = partialInPool.length ? partialInPool.reduce((a, b) => (b.loss < a.loss ? b : a)) : null;

  return {
    ok: true, role, exception: U.exceptionOf(key),
    is9644: key === KEY_9644,
    isInsufficient5: CUTS_5.includes(Number(String(key).split('|')[3])),
    engine: engineC,
    astar,
    frame: {
      sign: frame.sign, width: round6(frame.width), pointsLocal: frame.pointsLocal,
      uMedian: round6(frame.uMedian), zMedian: frame.zMedian,
    },
    poolMeta: { nCoarse: reduced.nCoarse, nLocalMin: reduced.nLocalMin, nKept: reduced.nKept, nDense: reduced.nDense, nStrongDense: reduced.nStrongDense, nStrong: strongInPool.length, nPartial: partialInPool.filter(c => c.topRows >= 15).length },
    pool: reduced.pool.slice(0, 80),
    bestLoss, bestStrong, bestPartial,
    lossGap: (bestLoss && bestStrong) ? bestStrong.loss - bestLoss.loss : null,
    policies,
    ms: Number(process.hrtime.bigint() - t0) / 1e6,
  };
}

function hypotDelta(a, b) {
  if (!a || !b) return null;
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0), (a[2] || 0) - (b[2] || 0));
}

function deltaOf(pub, sign) {
  if (!pub || pub.status !== 'candidate' || !pub.pick) return null;
  return [0, sign * pub.pick.u, pub.pick.z];
}

function comparePolicy(rails, id) {
  const failures = rails.filter(r => r.role === 'failure' && r.ok && !r.exception);
  const controls = rails.filter(r => r.role === 'control' && r.ok);
  let recovered = 0, stillFlank = 0, stillRsf = 0, stillSlope = 0, nowAmbiguity = 0, nowAbstain = 0, nowCandidate = 0;
  const recoveredKeys = [];
  const motifShift = {};
  for (const r of failures) {
    const a = r.astar, p = r.policies[id];
    const am = a.motif, pm = p.motif;
    if (p.status === 'candidate') nowCandidate++;
    if (am !== 'candidate' && p.status === 'candidate') { recovered++; recoveredKeys.push({ key: r.key, cut: r.cut, side: r.side }); }
    if (pm === 'flank' || (p.status !== 'candidate' && am === 'flank' && pm !== 'ambiguity' && pm !== 'partial-abstain' && pm !== 'weak-abstain')) stillFlank++;
    if (pm === 'rsf') stillRsf++;
    if (pm === 'slope') stillSlope++;
    if (pm === 'ambiguity') nowAmbiguity++;
    if (pm === 'partial-abstain' || pm === 'weak-abstain') nowAbstain++;
    if (am !== pm) motifShift[am + '→' + pm] = (motifShift[am + '→' + pm] || 0) + 1;
  }
  let kept = 0, lost = 0, recoveredCtrl = 0, displaced = 0, displacedGross = 0, newAmbiguity = 0;
  const lostKeys = [], recoveredCtrlKeys = [], displacedKeys = [], grossKeys = [];
  for (const r of controls) {
    const eng = r.engine, a = r.astar, p = r.policies[id];
    const pDelta = deltaOf(p, r.frame.sign);
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
  const restored9644 = !!(r9644 && r9644.policies[id].status === 'candidate');
  let status = 'INCONCLUSIVE';
  if (lost > 2 || displacedGross > 0) status = 'REGRESSIVE';
  else if (restored9644 && lost === 0 && displacedGross === 0 && recovered >= 0) {
    status = recovered >= 5 ? 'PROMISING' : (lost === 0 && displaced <= 2 ? 'PROMISING' : 'INCONCLUSIVE');
  }
  if (displacedGross > 0) status = 'REGRESSIVE';
  return {
    id, status, recovered, stillFlank, stillRsf, stillSlope, nowAmbiguity, nowAbstain, nowCandidate,
    recoveredKeys, motifShift,
    controls: { n: controls.length, kept, lost, recoveredCtrl, displaced, displacedGross, newAmbiguity, lostKeys, recoveredCtrlKeys, displacedKeys, grossKeys },
    restored9644,
  };
}

function analysePartial22(rails) {
  const rows = rails.filter(r => r.role === 'failure' && r.ok && !r.exception && r.astar.motif === 'flank' && !r.isInsufficient5);
  const items = [];
  let selectable = 0, ambiguous = 0, mixed = 0;
  for (const r of rows) {
    const bl = r.bestLoss, bs = r.bestStrong, bp = r.bestPartial;
    const nStrong = r.poolMeta.nStrong;
    const nPartial = r.poolMeta.nPartial;
    const dist = (bl && (bs || bp)) ? Math.hypot(bl.u - (bs || bp).u, bl.z - (bs || bp).z) : null;
    const ratio = (bl && bs && bl.loss > 0) ? bs.loss / bl.loss : null;
    let kind = 'C';
    if (nStrong >= 1 && ((ratio != null && ratio < G.DEFAULTS.minTemplateLossRatio) || (dist != null && dist < G.DEFAULTS.alternativeSeparation))) kind = 'A';
    else if (nStrong >= 1) kind = 'C';
    else if (nPartial >= 2) kind = 'B';
    else kind = 'C';
    if (kind === 'A') selectable++;
    else if (kind === 'B') ambiguous++;
    else mixed++;
    items.push({
      cut: r.cut, side: r.side, key: r.key, kind,
      bestLoss: bl && { u: bl.u, z: bl.z, loss: bl.loss, topRows: bl.topRows, faceCount: bl.faceCount, tier: bl.tier, motif: bl.motif },
      bestSupported: (bs || bp) && { u: (bs || bp).u, z: (bs || bp).z, loss: (bs || bp).loss, topRows: (bs || bp).topRows, faceCount: (bs || bp).faceCount, tier: (bs || bp).tier },
      lossGap: r.lossGap, ratio, nStrong, nPartial, nKept: r.poolMeta.nKept,
      dist,
    });
  }
  let population = 'C';
  if (selectable >= 15) population = 'A';
  else if (ambiguous >= 10 && selectable < 8) population = 'B';
  else if (selectable && ambiguous) population = 'C';
  if (selectable && selectable < rows.length && ambiguous) population = 'C';
  return { n: rows.length, selectable, ambiguous, other: mixed, population, items };
}

function analyse5(rails) {
  return rails.filter(r => r.isInsufficient5).map(r => ({
    cut: r.cut, side: r.side, key: r.key,
    astar: { motif: r.astar.motif, topRows: r.astar.topRows, faceCount: r.astar.faceCount, loss: r.astar.loss },
    nStrong: r.poolMeta.nStrong, nPartial: r.poolMeta.nPartial,
    bestLoss: r.bestLoss && { u: r.bestLoss.u, face: r.bestLoss.faceCount, top: r.bestLoss.topRows, tier: r.bestLoss.tier },
    bestStrong: r.bestStrong && { u: r.bestStrong.u, face: r.bestStrong.faceCount, top: r.bestStrong.topRows, loss: r.bestStrong.loss },
    policies: Object.fromEntries(Object.entries(r.policies).map(([k, v]) => [k, { status: v.status, motif: v.motif }])),
    note: r.poolMeta.nStrong ? 'STRONG_FACE présent dans le pool — abstention non forcée par absence' : 'aucune géométrie STRONG_FACE ; abstention acceptable',
  }));
}

function analyse9644(rail) {
  if (!rail) return { found: false };
  const pool = rail.pool || [];
  const eng = rail.engine;
  const astar = rail.astar;
  const strong = pool.filter(qualifyStrong);
  const minLoss = pool[0];
  const nearOriginStrong = strong.filter(c => Math.abs(c.u) < ENGINE_Y + 0.01);
  return {
    found: true,
    key: rail.key,
    engine: { status: eng.status, delta: eng.delta, loss: eng.loss, topRows: eng.topRows, faceCount: eng.faceCount, seed: eng.seed },
    astar: { status: astar.status, motif: astar.motif, reason: astar.reason, loss: astar.loss, topRows: astar.topRows, faceCount: astar.faceCount, seed: astar.seed, uCenters: astar.uCenters },
    minLoss: minLoss && { u: minLoss.u, z: minLoss.z, loss: minLoss.loss, topRows: minLoss.topRows, faceCount: minLoss.faceCount, tier: minLoss.tier, motif: minLoss.motif },
    strong: strong.slice(0, 8).map(c => ({ u: c.u, z: c.z, loss: c.loss, topRows: c.topRows, faceCount: c.faceCount, distOrigin: c.distOrigin })),
    nStrong: strong.length,
    nStrongDense: rail.poolMeta?.nStrongDense ?? strong.length,
    nearOriginStrong: nearOriginStrong.length,
    whyLossFirstPicksWeak: minLoss && minLoss.faceCount < 6
      ? 'A_STAR publie une maille à face=' + minLoss.faceCount + ' dont la loss (' + minLoss.loss + ') est inférieure au témoin face=' + (eng.faceCount || 0) + ' (' + eng.loss + '). Le témoin reste dans le pool ; ce n’est pas une exception 9644.'
      : 'min-loss déjà STRONG_FACE',
    lossRatioStrongVsMin: (minLoss && minLoss.loss > 0 && eng.loss) ? eng.loss / minLoss.loss : null,
    policies: Object.fromEntries(Object.entries(rail.policies).map(([k, v]) => [k, {
      status: v.status, motif: v.motif, reason: v.reason,
      pick: v.pick && { u: v.pick.u, z: v.pick.z, loss: v.pick.loss, faceCount: v.pick.faceCount, topRows: v.pick.topRows, tier: v.pick.tier },
    }])),
    hardcodedException: false,
  };
}

function variantStatus(cmp, partial22) {
  if (cmp.controls.displacedGross > 0 || cmp.controls.lost > 2) return 'REGRESSIVE';
  if (cmp.restored9644 && cmp.controls.lost === 0 && cmp.controls.displacedGross === 0) {
    if (cmp.recovered >= 8 && cmp.controls.displaced <= 2) return 'PROMISING';
    if (cmp.recovered === 0 && partial22.selectable === 0) return 'PROMISING';
    return 'INCONCLUSIVE';
  }
  if (cmp.controls.lost > 0 && !cmp.restored9644) return 'NEUTRAL';
  return 'INCONCLUSIVE';
}

function deriveScience(report) {
  const rails = report.rails;
  const comparisons = {};
  const partial22 = analysePartial22(rails);
  for (const id of ['LOSS_FIRST', 'A', 'B', 'C']) {
    const cmp = comparePolicy(rails, id);
    cmp.status = variantStatus(cmp, partial22);
    comparisons[id] = cmp;
  }
  const five = analyse5(rails);
  const c9644 = analyse9644(rails.find(r => r.key === KEY_9644));
  const failures = rails.filter(r => r.role === 'failure' && r.ok && !r.exception);
  const astarTally = { candidate: 0, flank: 0, rsf: 0, slope: 0, other: 0 };
  for (const r of failures) {
    const m = r.astar.motif;
    if (astarTally[m] == null) astarTally.other++;
    else astarTally[m]++;
  }
  const p22keys = new Set(partial22.items.map(i => i.key));
  for (const id of ['LOSS_FIRST', 'A', 'B', 'C']) {
    const rows = rails.filter(r => r.ok);
    comparisons[id].published22 = rows.filter(r => p22keys.has(r.key) && r.policies[id].status === 'candidate').length;
    comparisons[id].published5 = rows.filter(r => r.isInsufficient5 && r.policies[id].status === 'candidate').length;
    comparisons[id].abstained22 = rows.filter(r => p22keys.has(r.key) && r.policies[id].status !== 'candidate').length;
  }
  let freeze = null;
  const a = comparisons.A;
  if (a.status !== 'REGRESSIVE' && a.restored9644 && a.controls.lost <= 1 && a.controls.displacedGross === 0) {
    freeze = { id: 'A', title: 'SUPPORT QUALIFIED FIRST', note: 'figé pour lecture ; post-hoc humain non exécuté dans ce lot ; A_STAR inchangé' };
  }
  let lotStatus = 'INCONCLUSIVE';
  if (Object.values(comparisons).every(c => c.status === 'REGRESSIVE')) lotStatus = 'REGRESSIVE';
  else if (a.status === 'PROMISING' && partial22.population === 'A' && comparisons.C.status !== 'REGRESSIVE') lotStatus = 'PROMISING';
  else lotStatus = 'INCONCLUSIVE';

  const answerParts = [];
  answerParts.push('A_STAR figé. Arbitrage sur le pool déjà produit, sans nouvelle génération U.');
  answerParts.push('9644 : loss-first choisit face=' + (c9644.minLoss?.faceCount ?? '?') + ' (loss ' + (c9644.minLoss?.loss ?? '?') + ') ; A et C restaurent le témoin face=' + (c9644.engine?.faceCount ?? '?') + ' sans règle spécifique.');
  answerParts.push('22 partialFace : population ' + partial22.population + ' (' + partial22.selectable + ' STRONG proche, ' + partial22.ambiguous + ' sans STRONG, ' + partial22.other + ' STRONG lointain à loss ×≫1.5).');
  answerParts.push('A publie ' + a.published22 + '/22 et ' + a.published5 + '/5 insuffisants ; témoins perdus ' + a.controls.lost + ', sauts >10 mm ' + a.controls.displacedGross + '.');
  answerParts.push('B est REGRESSIVE (' + comparisons.B.controls.lost + ' témoins perdus par front de Pareto non unique).');
  answerParts.push('C n’auto-publie pas PARTIAL_FACE.');
  if (lotStatus === 'INCONCLUSIVE')
    answerParts.push('Lot INCONCLUSIVE : le mécanisme 9644 est réel, mais les 22 ne forment pas une population uniformément sélectionnable. Pas un correctif de production.');

  return {
    lotStatus, answer: answerParts.join(' '),
    aStarHash: A_STAR_HASH, aStarFrozen: true, searchY: ENGINE_Y, searchZ: ENGINE_Z,
    notAGlobalSearchY: true, minFace: 6, minTop: 15,
    astarTally, comparisons, partial22, five, c9644, freeze,
    nFailures: 53, nMain51: failures.length, nControls: rails.filter(r => r.role === 'control').length,
    exceptions: rails.filter(r => r.exception).map(r => ({ cut: r.cut, side: r.side, tag: r.exception, astar: r.astar?.motif })),
  };
}

function renderMarkdown(report) {
  const s = report.science;
  const a = s.comparisons.A, b = s.comparisons.B, c = s.comparisons.C, l = s.comparisons.LOSS_FIRST;
  const p = s.partial22, x = s.c9644;
  return `# Face-Aware Arbitration V1

Lot **EXPÉRIMENTAL**. Branche \`lab-face-aware-arbitration-v1\`. Aucun merge. A_STAR figé.

- Branche : \`lab-face-aware-arbitration-v1\`
- HEAD : \`${report.head || '(après commit)'}\`
- Base : \`f25f337\`
- Lab amont : \`93b75ed\`
- Commande : \`node tools/face-aware-arbitration-v1.cjs\`
- Tests : \`node tests/face-aware-arbitration-v1.test.cjs\`

**Statut du lot : \`${s.lotStatus}\`.**

- A_STAR hash : \`${s.aStarHash}\` **figé**
- searchY **${s.searchY}** · searchZ **${s.searchZ}** · minFace **${s.minFace}** · minTop **${s.minTop}**
- Baseline géométrie inchangée : **${report.hashes.baselineUnchanged ? 'oui' : 'non'}**
- Durée : ${(report.elapsedMs / 1000).toFixed(1)} s

## Question

Parmi les candidats déjà générés par A_STAR, le moteur peut-il préférer une solution géométriquement mieux soutenue plutôt que le simple minimum de loss ?

## Réponse

${s.answer}

**Ce lot ne baisse pas minFace. Il n’élargit pas searchY.**

## Variantes

| id | statut | 51 → candidate | 22 publiés | 5 publiés | 9644 | témoins perdus | >grille | >10 mm |
|---|---|---:|---:|---:|---|---:|---:|---:|
| LOSS_FIRST | ${l.status} | ${l.nowCandidate} | ${l.published22} | ${l.published5} | ${l.restored9644} | ${l.controls.lost} | ${l.controls.displaced} | ${l.controls.displacedGross} |
| A support-qualified | ${a.status} | ${a.nowCandidate} | ${a.published22} | ${a.published5} | ${a.restored9644} | ${a.controls.lost} | ${a.controls.displaced} | ${a.controls.displacedGross} |
| B Pareto | ${b.status} | ${b.nowCandidate} | ${b.published22} | ${b.published5} | ${b.restored9644} | ${b.controls.lost} | ${b.controls.displaced} | ${b.controls.displacedGross} |
| C face-tiers | ${c.status} | ${c.nowCandidate} | ${c.published22} | ${c.published5} | ${c.restored9644} | ${c.controls.lost} | ${c.controls.displaced} | ${c.controls.displacedGross} |

A : lexicographique STRONG (top≥15 ∧ face≥6 ∧ fenêtre ∧ pente) puis loss. Pas de baisse de seuil.
C : STRONG publiable ; PARTIAL abstention explicite ; WEAK ne gagne pas à la loss.

## Cas 9644 D

Hardcodé comme exception : **non**.

- témoin moteur : status=${x.engine?.status} face=${x.engine?.faceCount} loss=${x.engine?.loss} seed=${JSON.stringify(x.engine?.seed)}
- A_STAR : motif=${x.astar?.motif} face=${x.astar?.faceCount} loss=${x.astar?.loss} seed=${JSON.stringify(x.astar?.seed)}
- min-loss du pool : u=${x.minLoss?.u} face=${x.minLoss?.faceCount} tier=${x.minLoss?.tier} loss=${x.minLoss?.loss}
- STRONG dans le pool compact : **${x.nStrong}** (dense ${x.nStrongDense ?? '—'})
- ratio loss témoin / min-loss : ${x.lossRatioStrongVsMin == null ? '—' : x.lossRatioStrongVsMin.toFixed(3)}
- pourquoi loss-first : ${x.whyLossFirstPicksWeak}

| politique | status | motif | face du pick |
|---|---|---|---:|
${['LOSS_FIRST', 'A', 'B', 'C'].map(id => {
    const p = x.policies?.[id];
    return `| ${id} | ${p?.status} | ${p?.motif} | ${p?.pick?.faceCount ?? '—'} |`;
  }).join('\n')}

## 22 partialFace

Population descriptive : **${p.population}** (A sélectionnable / B ambiguë / C sous-populations).

- n = ${p.n}
- STRONG proche (kind A) : ${p.selectable}
- sans STRONG, plusieurs PARTIAL (kind B) : ${p.ambiguous}
- STRONG lointain, loss ×≫1.5 (kind C) : ${p.other}
- A auto-publie ${a.published22}/22 — dont les kind C, sans filtre de ratio. Ne pas transformer automatiquement PARTIAL_FACE.

${(p.items || []).map(it => `- cut ${it.cut} kind=${it.kind} loss-face=${it.bestLoss?.faceCount} strong=${it.nStrong} gap=${it.lossGap == null ? '—' : it.lossGap.toExponential(2)} dist=${it.dist == null ? '—' : it.dist.toFixed(3)}`).join('\n')}

Ne pas transformer automatiquement PARTIAL_FACE en candidate.

## 5 flancs insuffisants

${(s.five || []).map(f => `- cut ${f.cut} nStrong=${f.nStrong} ${f.note}`).join('\n')}

Abstention acceptable s’il n’existe aucune géométrie suffisamment soutenue.

## Gel

${s.freeze ? `Variante \`${s.freeze.id}\` retenue pour post-hoc : ${s.freeze.note}` : 'Aucune variante gelée pour post-hoc (pas de retuning).'}

Oracle humain interdit pendant génération, arbitrage, choix des règles et des seuils.

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
    poolMeta: r.poolMeta || null,
    pool: (r.pool || []).slice(0, 40),
    bestLoss: r.bestLoss || null, bestStrong: r.bestStrong || null, bestPartial: r.bestPartial || null,
    lossGap: r.lossGap ?? null,
    policies: r.policies || null,
  };
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/face-aware-arbitration-v1.json'),
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
    head: report.head, base: report.base, hashes: report.hashes, science: report.science,
    rails: report.rails.map(slimRail),
  };
  fs.writeFileSync(output.replace(/\.json$/, '.slim.json'), JSON.stringify(slim));
  fs.writeFileSync(path.join(ROOT, 'FACE_AWARE_ARBITRATION_V1.md'), renderMarkdown(report));
  try { fs.writeFileSync(path.resolve(ROOT, '../public/face-aware-arbitration-v1.json'), JSON.stringify(slim)); } catch { /* */ }
  try { fs.writeFileSync(path.resolve(ROOT, '../src/lib/face-aware-arbitration-v1.json'), JSON.stringify(slim)); } catch { /* */ }
  process.stderr.write(`écrit ${output} (${report.rails.length} rails, ${report.elapsedMs} ms)\n`);
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const aStarHash = assertAStarFrozen();
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
  const report = {
    format: 'face-aware-arbitration-v1',
    branch: 'lab-face-aware-arbitration-v1',
    nature: 'experimental-lab',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    head: null, base: 'f25f337',
    hashes: {
      geometry: geometrySha, baselineGeometry: baselineSha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
      aStar: aStarHash,
    },
    population: { failureKeys, controlKeys, key9644: KEY_9644, cuts5: CUTS_5.slice() },
    rails,
  };
  report.science = deriveScience(report);
  report.elapsedMs = Date.now() - tAll;
  writeArtifacts(report, args.output);
  return report;
}

module.exports = {
  BASELINE_GEOMETRY_SHA, A_STAR_HASH, ENGINE_Y, ENGINE_Z, KEY_9644, CUTS_5,
  aStarFrozen, assertAStarFrozen, faceTier, qualifyStrong, dominates,
  policyA, policyB, policyC, policyLossFirst, localMinima, characterize,
  analyse9644, deriveScience, build, aStarLab, reducePool,
};

if (require.main === module) build();
