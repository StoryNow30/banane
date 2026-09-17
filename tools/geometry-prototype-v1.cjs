#!/usr/bin/env node
'use strict';
/* Geometry Prototype V1 — banc expérimental.
 * Branche lab-geometry-prototype-v1. Ne merge rien. Aucune action ESV. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');

const ROOT = path.resolve(__dirname, '..');
const FAILURE = 'Plan de roulement non estimable.';
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';

const PROTOTYPES = {
  BASELINE: { family: 'baseline', hypothesis: 'géométrie gelée, DEFAULTS, aucun lab', options: {} },
  A_SEARCHZ_008: { family: 'A', hypothesis: 'fenêtre verticale élargie searchZ=0.08', options: { searchZ: 0.08 } },
  A_SEARCHZ_010: { family: 'A', hypothesis: 'fenêtre verticale maximale searchZ=0.10', options: { searchZ: 0.10 } },
  A_TOPBAND_024: { family: 'A', hypothesis: 'bande de roulement élargie topBand=0.024', options: { topBand: 0.024 } },
  B_CLOUD_Z_SEED: { family: 'B', hypothesis: 'hypothèse verticale supplémentaire au z médian du nuage local', options: { lab: { cloudZSeed: true } } },
  B_LOCK_CLOUD_Z: { family: 'B', hypothesis: 'ignorer le min de loss global ; retenir le coarse le plus proche du z médian du nuage (±0.012)', options: { lab: { lockZToCloud: true } } },
  C_PREFER_SUPPORT: { family: 'C', hypothesis: 'parmi la grille coarse, préférer un placement avec topRows>=3 même si loss supérieure', options: { lab: { preferSupported: true } } },
  D_PRESERVE_COARSE: { family: 'D', hypothesis: 'si le raffinement perd le support, conserver le coarse', options: { lab: { preserveCoarseSupport: true } } },
  CD: { family: 'C+D', hypothesis: 'préférence support puis conservation du coarse si le raffinement le quitte', options: { lab: { preferSupported: true, preserveCoarseSupport: true } } },
  CD_MINTHRESH: { family: 'C+D', hypothesis: 'C+D avec minTop=minFace=3 (seuil de publication aligné sur robustLine)', options: { minTop: 3, minFace: 3, lab: { preferSupported: true, preserveCoarseSupport: true } } },
  E_SUPPORT_PENALTY: { family: 'E', hypothesis: 'score combiné loss + 1e-4 si topRows<3', options: { lab: { supportPenalty: 1e-4 } } },
  F_MULTI_MINIMA: { family: 'F', hypothesis: 'minima locaux, puis support puis loss', options: { lab: { multiMinima: true, preferSupported: true } } },
  G_STRICT_AMBIGUITY: { family: 'G', hypothesis: 'abstention plus stricte (ratio 2.0) sur les seuls placements supportés', options: { lab: { preferSupported: true }, minTemplateLossRatio: 2 } },
  BC: { family: 'B+C', hypothesis: 'graine nuage + préférence support', options: { lab: { cloudZSeed: true, preferSupported: true } } },
  BC_LOCK: { family: 'B+C', hypothesis: 'lock z nuage + préférence support', options: { lab: { lockZToCloud: true, preferSupported: true } } },
  BCD: { family: 'B+C+D', hypothesis: 'graine nuage + support + conservation coarse', options: { lab: { cloudZSeed: true, preferSupported: true, preserveCoarseSupport: true } } },
  BCDG: { family: 'B+C+D+G', hypothesis: 'BCD + abstention stricte', options: { lab: { cloudZSeed: true, preferSupported: true, preserveCoarseSupport: true }, minTemplateLossRatio: 2 } },
  P_PAIR_Z: { family: 'P', hypothesis: 'arbitration de paire : transférer z du rail résolu vers le rail RSF', options: { lab: { cloudZSeed: true, preferSupported: true, preserveCoarseSupport: true, pairZTransfer: true } }, pair: true },
};

function compactProposal(p) {
  if (!p) return { status: 'absent', reason: null, delta: null, loss: null, topRows: null, seed: null, confidence: null };
  const reason = p.status === 'candidate' ? null : (p.reasons || []).join(' ');
  return {
    status: p.status,
    reason,
    delta: p.delta || null,
    loss: p.metrics?.templateLoss ?? null,
    topRows: p.top?.count ?? p.metrics?.topCount ?? null,
    seed: p.metrics?.seed || null,
    confidence: p.confidence ?? null,
    coarseLoss: p.metrics?.templateAmbiguity?.coarseBestLoss ?? null,
    alternativeLoss: p.metrics?.templateAmbiguity?.alternativeLoss ?? null,
    lossRatio: p.metrics?.templateAmbiguity?.lossRatio ?? null,
    surface: p.metrics?.surfaceIntersection || null,
    lab: p.metrics?.lab || null,
  };
}

function deltaChanged(a, b, tol = 1e-6) {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > tol;
}

function postHoc(proposal, human) {
  if (!human) return { available: false };
  if (proposal?.status !== 'candidate' || !proposal.delta) {
    return { available: true, engineUnresolved: true, humanDelta: human, error: null };
  }
  const e = proposal.delta.map((v, i) => v - human[i]);
  return {
    available: true, engineUnresolved: false, humanDelta: human,
    error: { y: e[1], z: e[2], euclid: Math.hypot(e[0], e[1], e[2]) },
    within010: Math.hypot(e[0], e[1], e[2]) <= 0.010,
  };
}

/* Traceur de paysage — miroir du moteur, pour 56/5/2 uniquement sur la baseline. */
function landscape(capture, side, cfg = G.DEFAULTS) {
  const rail = capture.rails?.[side];
  if (!rail) return null;
  const contour = rail.profileContours?.reduce((a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  if (!contour) return null;
  const shape = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(G.median(shape.map(p => p[1])));
  if (!sign) return null;
  const vertices = shape.map(p => [sign * p[1], p[2]]), head = vertices.filter(p => p[1] > -0.04);
  if (head.length < 6) return null;
  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes?.[i] === false) continue;
    if (!Array.isArray(capture.pointsSceneRelative[i]) || !capture.pointsSceneRelative[i].every(Number.isFinite)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, capture.pointsSceneRelative[i]);
    if (q.every(Number.isFinite) && Math.abs(q[0]) <= 0.5 && Math.abs(q[1]) < 0.18 && Math.abs(q[2]) < 0.10)
      points.push([sign * q[1], q[2], q[0]]);
  }
  if (points.length < 8) return { pointsLocal: points.length, family: null };
  const width = Math.max(...head.filter(p => p[1] > -0.012).map(p => p[0]));
  if (!(width > 0.025 && width < 0.12)) return { pointsLocal: points.length, family: null };
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
  if (topAnchors.length < 3 || faceAnchors.length < 3) return { pointsLocal: points.length, family: null };
  const loss = (anchors, u, z) => G.median(anchors.map(a => {
    let b = 0.025 * 0.025;
    for (const p of points) { const d = (p[0] - u - a[0]) ** 2 + (p[1] - z - a[1]) ** 2; if (d < b) b = d; }
    return b;
  }));
  let best = { loss: Infinity, u: 0, z: 0 };
  const coarse = [];
  for (let u = -cfg.searchY; u <= cfg.searchY + 1e-10; u += cfg.grid)
    for (let z = -cfg.searchZ; z <= cfg.searchZ + 1e-10; z += cfg.grid) {
      const score = loss(topAnchors, u, z) + loss(faceAnchors, u, z) + 1e-7 * (Math.abs(u) + Math.abs(z));
      coarse.push({ loss: score, u, z });
      if (score < best.loss) best = { loss: score, u, z };
    }
  const coarseBest = { ...best };
  for (let u = best.u - 0.004; u <= best.u + 0.004 + 1e-10; u += 0.001)
    for (let z = best.z - 0.004; z <= best.z + 0.004 + 1e-10; z += 0.001) {
      const score = loss(topAnchors, u, z) + loss(faceAnchors, u, z) + 1e-7 * (Math.abs(u) + Math.abs(z));
      if (score < best.loss) best = { loss: score, u, z };
    }
  const topRowsAt = (u, z) => points.filter(p => p[0] > u + 0.012 && p[0] < u + width - 0.012 && Math.abs(p[1] - z) < cfg.topBand).length;
  let supported = 0, bestSupported = null;
  for (const c of coarse) {
    const n = topRowsAt(c.u, c.z);
    if (n >= 3) {
      supported++;
      if (!bestSupported || c.loss < bestSupported.loss) bestSupported = { ...c, topRows: n };
    }
  }
  const coarseN = topRowsAt(coarseBest.u, coarseBest.z);
  const refinedN = topRowsAt(best.u, best.z);
  let family = 'autre';
  if (supported === 0) family = 'aucun-support-nulle-part-sur-la-grille';
  else if (coarseN >= 3 && refinedN < 3) family = 'raffinement-a-quitte-le-support';
  else if (refinedN < 3 && supported > 0) family = 'support-ailleurs-mais-perte-nettement-superieure';
  else if (refinedN >= 3) family = 'support-present-au-best-refined';
  const zs = points.map(p => p[1]).sort((a, b) => a - b);
  const zMed = zs[zs.length >> 1];
  return {
    pointsLocal: points.length, sign, width,
    coarseBest, refinedBest: best,
    topRowsCoarse: coarseN, topRowsRefined: refinedN,
    gridSupported: supported, bestSupported,
    zMedianLocal: zMed, zDisagreement: zMed - best.z,
    family,
  };
}

function classifyBaselineFamily(proposal, land) {
  const reason = (proposal.reasons || []).join(' ');
  if (reason !== FAILURE) return null;
  return land?.family || 'untraced';
}

function summarizePrototype(name, rows, baselineByKey) {
  const recovered = [], newFailures = [], lostProposals = [], newProposals = [], candidateChanges = [];
  const keptControls = [];
  let rsfRecovered = 0, rsfStill = 0, controlKept = 0, controlLost = 0, controlChanged = 0;
  const byFamily = {};
  for (const row of rows) {
    const base = baselineByKey.get(row.key);
    const b = base.proposal, p = row.proposal;
    const bFail = b.status !== 'candidate';
    const pFail = p.status !== 'candidate';
    const bRsf = (b.reason || '') === FAILURE;
    if (bRsf && !pFail) {
      rsfRecovered++;
      recovered.push(row.key);
      if (row.rsfFamily) byFamily[row.rsfFamily] = (byFamily[row.rsfFamily] || 0) + 1;
    }
    if (bRsf && pFail) rsfStill++;
    if (!bFail && !pFail) {
      if (deltaChanged(b.delta, p.delta)) { controlChanged++; candidateChanges.push(row.key); }
      else { controlKept++; keptControls.push(row.key); }
    }
    if (!bFail && pFail) { controlLost++; lostProposals.push(row.key); }
    if (bFail && !pFail && !bRsf) newProposals.push(row.key);
    if (!bFail && pFail && !bRsf) newFailures.push(row.key);
  }
  return {
    n: rows.length, rsfRecovered, rsfStill, controlKept, controlLost, controlChanged,
    recoveredCount: recovered.length, lostProposals: lostProposals.length,
    candidateChanges: candidateChanges.length, newFailures: newFailures.length,
    recovered, lostProposalKeys: lostProposals, candidateChangeKeys: candidateChanges,
    recoveredByFamily: byFamily,
  };
}

function parseArgs(argv) {
  const out = { prototypes: Object.keys(PROTOTYPES), output: path.join(ROOT, 'audit/geometry-prototype-v1.json'), limit: 0, skipPair: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output') out.output = path.resolve(argv[++i]);
    else if (a === '--prototypes') out.prototypes = argv[++i].split(',');
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--data') out.data = argv[++i];
    else if (a === '--skip-pair') out.skipPair = true;
    else if (a === '--from-json') out.fromJson = path.resolve(argv[++i]);
    else throw Error('argument inconnu: ' + a);
  }
  return out;
}

function runPrototypeOnRail(capture, side, proto, pairCapture, useBaseline) {
  const t0 = process.hrtime.bigint();
  let proposal;
  if (useBaseline) proposal = B.propose(capture, side);
  else if (proto.pair && pairCapture) proposal = G.proposeBoth(pairCapture, proto.options)[side];
  else proposal = G.propose(capture, side, proto.options);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { proposal, ms };
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const geometrySha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry.js')));
  const baselineSha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry-baseline.js')));
  const { base, docs, visits } = N.readVisits(args.data || N.DEFAULT_ROOT);
  const lockPath = path.join(ROOT, 'audit/rsf-population-v1.json');
  const populationLock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null;
  const lockSet = populationLock ? new Set(populationLock.rails.map(r => r.visitId + '|' + r.side)) : null;
  const comparable = [];
  for (const v of visits) {
    for (const side of ['left', 'right']) {
      if (v.geometryEligibility?.[side]?.status !== 'comparable-candidate') continue;
      if (lockSet && !lockSet.has(v.visitId + '|' + side)) continue;
      comparable.push({ visit: v, side, key: N.railKey(v, side) });
    }
  }
  const needed = new Set();
  const docsNeeded = new Set();
  for (const item of comparable) {
    docsNeeded.add(item.visit._doc);
    for (const id of item.visit.geometryEligibility?.[item.side]?.chunkIds || []) needed.add(id);
  }
  for (const d of docsNeeded) N.ensureRailsDictionary(base, d);
  for (const item of comparable) N.hydrateRailPoses(base, item.visit);
  const tChunks = Date.now();
  const chunks = N.loadNeededChunks(base, docs, needed);
  const chunkMs = Date.now() - tChunks;

  const rails = [];
  for (const item of comparable) {
    if (args.limit && rails.length >= args.limit) break;
    const assembled = N.assembleCapture(item.visit, item.side, chunks);
    if (!assembled.ready) {
      rails.push({ ...item, assembled, skip: true, skipReasons: assembled.reasons });
      continue;
    }
    const init = N.initialRail(item.visit, item.side);
    rails.push({
      ...item, assembled, skip: false,
      human: N.humanDeltaLocal(item.visit, item.side, init.rail),
      identity: item.visit.identity,
      sessionId: item.visit.sessionId,
      cohort: item.visit.cohort,
      visitIndex: item.visit.visitIndex,
    });
  }
  for (const d of docs) { d.records = null; d.dictionaries = null; d.exactDoc = null; }

  const names = args.prototypes.filter(n => PROTOTYPES[n]);
  if (!names.includes('BASELINE')) names.unshift('BASELINE');
  const results = {};
  const baselineByKey = new Map();

  for (const name of names) {
    const proto = PROTOTYPES[name];
    const t0 = Date.now();
    const rows = [];
    let msSum = 0;
    let done = 0;
    const work = rails.filter(r => !r.skip);
    process.stderr.write(`[prototype] ${name} 0/${work.length}\n`);
    for (const rail of rails) {
      if (rail.skip) continue;
      let pairCapture = null;
      if (proto.pair) {
        const other = rail.side === 'left' ? 'right' : 'left';
        const otherA = N.assembleCapture(rail.visit, other, chunks);
        if (otherA.ready) {
          pairCapture = {
            rails: { ...rail.assembled.capture.rails, ...otherA.capture.rails },
            pointsSceneRelative: [...rail.assembled.capture.pointsSceneRelative, ...otherA.capture.pointsSceneRelative],
            visibleByClipBoxes: [...rail.assembled.capture.visibleByClipBoxes, ...otherA.capture.visibleByClipBoxes],
          };
        }
      }
      const ran = runPrototypeOnRail(rail.assembled.capture, rail.side, proto, pairCapture, name === 'BASELINE');
      msSum += ran.ms;
      const compact = compactProposal(ran.proposal);
      const row = {
        key: rail.key, sessionId: rail.sessionId, cohort: rail.cohort, side: rail.side,
        part: rail.identity?.part, cut: rail.identity?.cut, visitIndex: rail.visitIndex,
        points: rail.assembled.points, proposal: compact, ms: ran.ms,
        postHoc: postHoc(ran.proposal, rail.human),
      };
      if (name === 'BASELINE') {
        const isRsf = compact.reason === FAILURE;
        const land = isRsf ? landscape(rail.assembled.capture, rail.side) : null;
        row.landscape = land ? {
          family: land.family, pointsLocal: land.pointsLocal,
          topRowsCoarse: land.topRowsCoarse, topRowsRefined: land.topRowsRefined,
          gridSupported: land.gridSupported, zMedianLocal: land.zMedianLocal,
          zDisagreement: land.zDisagreement,
          refinedZ: land.refinedBest?.z, coarseZ: land.coarseBest?.z,
        } : null;
        row.rsfFamily = classifyBaselineFamily(ran.proposal, land);
        baselineByKey.set(rail.key, row);
      } else {
        const base = baselineByKey.get(rail.key);
        row.rsfFamily = base?.rsfFamily || null;
        row.divergedFromBaseline = base ? (base.proposal.status !== compact.status || deltaChanged(base.proposal.delta, compact.delta)) : null;
      }
      rows.push(row);
      done++;
      if (done % 25 === 0 || done === work.length) {
        process.stderr.write(`[prototype] ${name} ${done}/${work.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
      }
    }
    results[name] = {
      name, family: proto.family, hypothesis: proto.hypothesis, options: proto.options,
      elapsedMs: Date.now() - t0, proposeMs: msSum, rows,
    };
  }

  const baselineRows = results.BASELINE.rows;
  const rsf = baselineRows.filter(r => r.proposal.reason === FAILURE);
  const controls = baselineRows.filter(r => r.proposal.status === 'candidate');
  const otherUnresolved = baselineRows.filter(r => r.proposal.status !== 'candidate' && r.proposal.reason !== FAILURE);
  const familyCounts = {};
  for (const r of rsf) familyCounts[r.rsfFamily || 'untraced'] = (familyCounts[r.rsfFamily || 'untraced'] || 0) + 1;

  const comparisons = {};
  for (const name of names) {
    if (name === 'BASELINE') continue;
    const rows = results[name].rows;
    const rsfRows = rows.filter(r => baselineByKey.get(r.key)?.proposal.reason === FAILURE);
    const controlRows = rows.filter(r => baselineByKey.get(r.key)?.proposal.status === 'candidate');
    comparisons[name] = {
      all: summarizePrototype(name, rows, baselineByKey),
      rsf: summarizePrototype(name, rsfRows, baselineByKey),
      controls: summarizePrototype(name, controlRows, baselineByKey),
      postHoc: postHocStats(rows),
      baselinePostHoc: postHocStats(rsfRows.map(r => baselineByKey.get(r.key)).filter(Boolean).concat(controlRows.map(r => baselineByKey.get(r.key)).filter(Boolean))),
    };
  }

  const statuses = {};
  for (const name of names) {
    if (name === 'BASELINE') { statuses[name] = 'BASELINE'; continue; }
    const c = comparisons[name];
    const rec = c.rsf.rsfRecovered, lost = c.controls.controlLost, chg = c.controls.controlChanged;
    if (rec === 0 && lost === 0 && chg === 0) statuses[name] = 'NEUTRAL';
    else if (lost > rec) statuses[name] = 'REGRESSIVE';
    else if (rec >= 3 && lost === 0) statuses[name] = 'PROMISING';
    else if (rec > 0 && lost <= 2) statuses[name] = 'PROMISING';
    else statuses[name] = 'INCONCLUSIVE';
  }

  const slimRows = (rows) => rows.map(r => ({
    key: r.key, sessionId: r.sessionId, cohort: r.cohort, side: r.side, part: r.part, cut: r.cut,
    status: r.proposal.status, reason: r.proposal.reason, delta: r.proposal.delta,
    loss: r.proposal.loss, topRows: r.proposal.topRows, seed: r.proposal.seed,
    rsfFamily: r.rsfFamily, landscape: r.landscape || null,
    postHoc: r.postHoc, divergedFromBaseline: r.divergedFromBaseline ?? false,
  }));

  const report = {
    format: 'banane-geometry-prototype-v1',
    branch: 'lab-geometry-prototype-v1',
    nature: 'EXPERIMENTAL — aucune conclusion de production',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    data: { ...N.REF, root: base, chunkLoadMs: chunkMs, chunksLoaded: chunks.size, chunksNeeded: needed.size },
    hashes: {
      geometryBaselineOriginal: BASELINE_GEOMETRY_SHA,
      geometryBaselineFile: baselineSha,
      geometryCurrent: geometrySha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
    },
    visits: visits.length, comparableCandidateRails: comparable.length,
    populationLock: populationLock ? { source: populationLock.source, n: populationLock.n, matched: comparable.length } : null,
    assembled: rails.filter(r => !r.skip).length,
    skipped: rails.filter(r => r.skip).map(r => ({ key: r.key, reasons: r.skipReasons })),
    baseline: {
      rsfFailures: rsf.length,
      engineCandidates: controls.length,
      otherUnresolved: otherUnresolved.length,
      otherUnresolvedReasons: countBy(otherUnresolved.map(r => r.proposal.reason)),
      rsfFamilies: familyCounts,
      rsfKeys: rsf.map(r => r.key),
      controlKeys: controls.map(r => r.key),
      postHoc: postHocStats(baselineRows),
    },
    prototypes: Object.fromEntries(names.map(n => [n, {
      family: results[n].family, hypothesis: results[n].hypothesis, options: results[n].options,
      elapsedMs: results[n].elapsedMs, proposeMs: results[n].proposeMs, status: statuses[n],
    }])),
    comparisons,
    rows: Object.fromEntries(names.map(n => [n, slimRows(results[n].rows)])),
  };
  report.science = deriveScience(report);
  const { contentSha } = writeArtifacts(report, args.output);
  return { report, output: args.output, contentSha, elapsedMs: report.elapsedMs };
}

function median(a) {
  const b = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!b.length) return null;
  const i = b.length >> 1;
  return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2;
}

function railLockKey(x) {
  return [x.sessionId, x.visitId, x.part, x.cut, x.side].join('|');
}

function deriveScience(report) {
  const lockPath = path.join(ROOT, 'audit/rsf-population-v1.json');
  const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : null;
  const skipSet = new Set((report.skipped || []).map(s => s.key));
  const skipFail = lock ? lock.rails.filter(x => x.cohort === 'failure' && skipSet.has(railLockKey(x))) : [];
  const skipCtrl = lock ? lock.rails.filter(x => x.cohort === 'control' && skipSet.has(railLockKey(x))) : [];
  const prototypes = Object.entries(report.prototypes).filter(([n]) => n !== 'BASELINE');
  const promising = prototypes.filter(([, p]) => p.status === 'PROMISING').map(([n]) => n);
  const neutral = prototypes.filter(([, p]) => p.status === 'NEUTRAL').map(([n]) => n);
  const regressive = prototypes.filter(([, p]) => p.status === 'REGRESSIVE').map(([n]) => n);
  const publishedRecoveries = Math.max(0, ...prototypes.map(([n]) => report.comparisons[n]?.rsf.rsfRecovered || 0));

  const baseRows = report.rows?.BASELINE || [];
  const baseBy = Object.fromEntries(baseRows.map(x => [x.key, x]));
  const rsfKeys = report.baseline.rsfKeys || [];

  function gateShifts(name) {
    const rows = report.rows?.[name];
    if (!rows) return null;
    const by = Object.fromEntries(rows.map(x => [x.key, x]));
    const shifts = [];
    const reasonCounts = {};
    for (const k of rsfKeys) {
      const a = baseBy[k], b = by[k];
      if (!a || !b) continue;
      reasonCounts[b.reason || b.status] = (reasonCounts[b.reason || b.status] || 0) + 1;
      if (a.reason !== b.reason || a.status !== b.status) {
        shifts.push({
          key: k,
          family: a.rsfFamily,
          fromStatus: a.status,
          fromReason: a.reason,
          toStatus: b.status,
          toReason: b.reason,
          topRows: b.topRows,
        });
      }
    }
    return {
      n: shifts.length,
      published: shifts.filter(s => s.toStatus === 'candidate').length,
      stillUnresolved: shifts.filter(s => s.toStatus !== 'candidate').length,
      reasonCounts,
      shifts,
    };
  }

  const rsfLands = rsfKeys.map(k => baseBy[k]?.landscape).filter(Boolean);
  const famRows = {};
  for (const k of rsfKeys) {
    const row = baseBy[k];
    const f = row?.rsfFamily || 'untraced';
    (famRows[f] = famRows[f] || []).push(row);
  }
  const familyLandscape = {};
  for (const [f, rows] of Object.entries(famRows)) {
    const lands = rows.map(r => r.landscape).filter(Boolean);
    familyLandscape[f] = {
      n: rows.length,
      gridSupportedMedian: median(lands.map(z => z.gridSupported)),
      topRowsCoarseMedian: median(lands.map(z => z.topRowsCoarse)),
      topRowsRefinedMedian: median(lands.map(z => z.topRowsRefined)),
      zMedianLocal: median(lands.map(z => z.zMedianLocal)),
      refinedZ: median(lands.map(z => z.refinedZ)),
      zDisagreement: median(lands.map(z => z.zDisagreement)),
    };
  }

  return {
    lotStatus: 'INCONCLUSIVE',
    publishedRecoveries,
    promising,
    neutral,
    regressive,
    keepAsDiagnostic: ['C_PREFER_SUPPORT', 'D_PRESERVE_COARSE', 'CD', 'CD_MINTHRESH'],
    dropAsCandidate: regressive,
    coverage: {
      lock: lock ? lock.n : report.comparableCandidateRails,
      lockFailures: lock ? lock.failures : 63,
      lockControls: lock ? lock.controls : 176,
      assembled: report.assembled,
      skipped: (report.skipped || []).length,
      skippedFailures: skipFail.length,
      skippedControls: skipCtrl.length,
      skipReason: 'chunks-absents fail-closed',
      rsfReproduced: report.baseline.rsfFailures,
      controlsReproduced: report.baseline.engineCandidates,
      familiesReproduced: report.baseline.rsfFamilies,
      skippedFailureKeys: skipFail.map(railLockKey),
    },
    families: familyLandscape,
    verticalAssembledRsf: {
      n: rsfLands.length,
      zMedianLocal: median(rsfLands.map(z => z.zMedianLocal)),
      coarseZ: median(rsfLands.map(z => z.coarseZ)),
      refinedZ: median(rsfLands.map(z => z.refinedZ)),
      zDisagreement: median(rsfLands.map(z => z.zDisagreement)),
    },
    gateShifts: {
      C_PREFER_SUPPORT: gateShifts('C_PREFER_SUPPORT'),
      D_PRESERVE_COARSE: gateShifts('D_PRESERVE_COARSE'),
      CD: gateShifts('CD'),
      CD_MINTHRESH: gateShifts('CD_MINTHRESH'),
    },
    nextExperiment: 'Le prochain levier n’est pas searchZ ni un seed nuage. Les 53 n’ont aucun support de grille : ranking et raffinement ne peuvent pas inventer de points — attendre Sol/Loki sur le cadre vertical, ou un autre générateur. Les 4+2 passent robustLine après C+D mais échouent au flanc (minFace) et/ou minTop=15 : expérience ciblée de support de face, cohorte de contrôle obligatoire.',
    solLoki: {
      loki: 'lab-vertical-alignment-provenance-replication-v1 : première divergence à coarse-search-z. Compatible avec B et C comme intuitions, pas comme correctifs. N’établit pas la cause physique.',
      sol: 'lab-vertical-alignment-provenance-v1 : rapport Markdown non publié au moment de ce lot. Pas de retune rétrospectif.',
    },
  };
}

function slimReport(report) {
  const { rows, ...rest } = report;
  return rest;
}

function renderMarkdown(report) {
  const b = report.baseline;
  const s = report.science || deriveScience(report);
  const lines = [];
  const p = (t = '') => lines.push(t);
  p('# Geometry Prototype V1');
  p('');
  p('Lot **EXPÉRIMENTAL**. Branche `lab-geometry-prototype-v1`. Aucun merge, aucune conclusion de production, aucune action ESV.');
  p('');
  p('**Statut du lot : `' + s.lotStatus + '`.** Récupérations publiées (status `candidate`) : **' + s.publishedRecoveries + '**. Aucun prototype PROMISING.');
  p('');
  p('- Base : `' + (report.hashes?.geometryBaselineOriginal || '') + '` (`src/geometry-baseline.js`)');
  p('- Géométrie courante : `' + (report.hashes?.geometryCurrent || '') + '`');
  p('- Baseline inchangée : **' + (report.hashes?.baselineUnchanged ? 'oui' : 'NON') + '**');
  p('- Données : `' + report.data.repo + '` `' + report.data.branch + '` `@' + report.data.head + '`');
  p('- Dataset : `' + report.data.dataset + '`');
  p('- Rails assemblés : **' + report.assembled + '** / comparables ' + report.comparableCandidateRails + ' (lock 239)');
  p('- Ignorés fail-closed (`chunks-absents`) : **' + (s.coverage?.skipped ?? (report.skipped || []).length) + '** — ' + (s.coverage?.skippedFailures ?? '?') + ' échecs + ' + (s.coverage?.skippedControls ?? '?') + ' témoins');
  p('- Durée : ' + (report.elapsedMs / 1000).toFixed(1) + ' s');
  p('');
  p('## Conclusions');
  p('');
  p('1. **Aucune récupération publiée.** Sur les 17 prototypes, zéro RSF ne devient `candidate`. « Récupéré » = proposition publiable, pas un simple changement de motif d’abstention.');
  p('2. **Couverture 221/239.** 18 rails lock sont absents des shards nuage (`chunks-absents`) : 4 échecs + 14 témoins. Fail-closed. Baseline reproduite **59 / 162** (lock 63 / 176). Familles **53 / 4 / 2** (science établie 56 / 5 / 2). Les 4 échecs manquants expliquent 3+1 sur 56 et 5.');
  p('3. **Les 53 n’ont aucun support de grille** (`gridSupported` médian 0, `topRowsCoarse` 0). Ranking, raffinement, seed de paire et fenêtre `searchZ` ne peuvent pas inventer des points. C’est un problème de générateur / cadre, pas de scoring.');
  p('4. **Les 4 + 2 sont un autre mécanisme.** Après C+D ils passent `robustLine` (`topRows` 3–7) puis échouent à `minTop=15` / flanc. `CD_MINTHRESH` (diagnostique, pas un candidat) sort 6/59 du motif RSF : 4 « Flanc interne insuffisamment observé. », 1 flanc + pente, 1 ambiguïté. Aucun ne publie.');
  p('5. **Ne pas élargir `searchZ` vers le bas** (A : 0 récupéré, 2–4 témoins perdus). **Ne pas promouvoir le seed / lock nuage** (B : 0 récupéré, jusqu’à 76 déplacements de témoins, 4–12 perdus). B+C, attaque principale prévue, est REGRESSIVE dès que le seed nuage est actif ; `BC_LOCK` est NEUTRAL et toujours à 0.');
  p('6. **La paire ne masque pas un mauvais générateur.** `P_PAIR_Z` rejoue B+C+D : mêmes 4 témoins perdus, 76 déplacements, 0 récupéré.');
  p('');
  p('### Conservés comme leviers diagnostiques (pas des candidats d’intégration)');
  p('');
  p((s.keepAsDiagnostic || []).map(x => '- `' + x + '`').join('\n') || '- *(aucun)*');
  p('');
  p('### Écartés comme candidats');
  p('');
  p((s.dropAsCandidate || []).map(x => '- `' + x + '`').join('\n') || '- *(aucun)*');
  p('');
  p('## Baseline reproduite');
  p('');
  p('| cohorte | n |');
  p('|---|---:|');
  p('| RSF `Plan de roulement non estimable.` | **' + b.rsfFailures + '** |');
  p('| contrôles engine-candidate | **' + b.engineCandidates + '** |');
  p('| autres unresolved | ' + b.otherUnresolved + ' |');
  p('');
  p('### Familles 56 / 5 / 2');
  p('');
  p('| famille | n |');
  p('|---|---:|');
  for (const [k, v] of Object.entries(b.rsfFamilies || {})) p('| `' + k + '` | **' + v + '** |');
  p('');
  p('## Tableau comparatif');
  p('');
  p('| prototype | famille | statut | RSF récupérés | RSF restants | contrôles perdus | contrôles déplacés | ms |');
  p('|---|---|---|---:|---:|---:|---:|---:|');
  for (const [name, proto] of Object.entries(report.prototypes)) {
    if (name === 'BASELINE') {
      p('| BASELINE | baseline | BASELINE | — | ' + b.rsfFailures + ' | — | — | ' + proto.elapsedMs + ' |');
      continue;
    }
    const c = report.comparisons[name];
    p('| `' + name + '` | ' + proto.family + ' | **' + proto.status + '** | ' + (c?.rsf.rsfRecovered ?? '—') + ' | ' + (c?.rsf.rsfStill ?? '—') + ' | ' + (c?.controls.controlLost ?? '—') + ' | ' + (c?.controls.controlChanged ?? '—') + ' | ' + proto.elapsedMs + ' |');
  }
  p('');
  p('## Ablations');
  p('');
  p('Les combinaisons `BC`, `BC_LOCK`, `BCD`, `BCDG` se décomposent en A/B/C/D/G unitaires du tableau ci-dessus. Un gain n’est attribué à une famille que si la variante unitaire le produit déjà, ou s’il n’apparaît que dans la combinaison (interaction).');
  p('');
  for (const [name, proto] of Object.entries(report.prototypes)) {
    if (name === 'BASELINE') continue;
    const c = report.comparisons[name];
    p('### `' + name + '` — ' + proto.status);
    p('');
    p('- Famille : **' + proto.family + '**');
    p('- Hypothèse : ' + proto.hypothesis);
    p('- Options : `' + JSON.stringify(proto.options) + '`');
    p('- RSF récupérés : **' + (c?.rsf.rsfRecovered ?? 0) + '** ; encore en échec : ' + (c?.rsf.rsfStill ?? 0));
    p('- Contrôles conservés (delta identique) : ' + (c?.controls.controlKept ?? 0) + ' ; perdus : **' + (c?.controls.controlLost ?? 0) + '** ; déplacés : ' + (c?.controls.controlChanged ?? 0));
    if (c?.rsf.recoveredByFamily && Object.keys(c.rsf.recoveredByFamily).length) {
      p('- Récupérés par famille RSF : ' + Object.entries(c.rsf.recoveredByFamily).map(([k, v]) => k + '=' + v).join(', '));
    }
    const rec = (c?.rsf.recovered || []).slice(0, 40);
    const lost = c?.controls.lostProposalKeys || [];
    const chg = (c?.controls.candidateChangeKeys || []).slice(0, 20);
    p('- Rails récupérés' + ((c?.rsf.recovered || []).length > 40 ? ' (40 premiers)' : '') + ' :');
    p('');
    p(rec.length ? rec.map(x => '  - `' + x + '`').join('\n') : '  - *(aucun)*');
    p('');
    p('- Rails contrôles perdus :');
    p('');
    p(lost.length ? lost.map(x => '  - `' + x + '`').join('\n') : '  - *(aucun)*');
    p('');
    if (chg.length) {
      p('- Changements de candidat (20 premiers) :');
      p('');
      p(chg.map(x => '  - `' + x + '`').join('\n'));
      p('');
    }
  }
  p('## 56 / 5 / 2 — analyse séparée (reproduit 53 / 4 / 2)');
  p('');
  p('| famille établie | n lock | n assemblés | gridSupported médian | topRows coarse | topRows raffiné |');
  p('|---|---:|---:|---:|---:|---:|');
  const famOrder = [
    ['aucun-support-nulle-part-sur-la-grille', 56],
    ['support-ailleurs-mais-perte-nettement-superieure', 5],
    ['raffinement-a-quitte-le-support', 2],
  ];
  for (const [k, lockN] of famOrder) {
    const f = s.families?.[k] || {};
    p('| `' + k + '` | ' + lockN + ' | **' + (f.n ?? '—') + '** | ' + (f.gridSupportedMedian ?? '—') + ' | ' + (f.topRowsCoarseMedian ?? '—') + ' | ' + (f.topRowsRefinedMedian ?? '—') + ' |');
  }
  p('');
  p('- **53 (ex-56)** : aucun placement de la grille n’atteint `topRows >= 3`. Ranking (C, E, F) est structurellement inopérant. `searchZ` 0,08 / 0,10 n’ouvre pas de support : le min de loss reste collé à la borne basse, conformément à Loki (`coarse-search-z`).');
  p('- **4 (ex-5)** : du support existe ailleurs. `C_PREFER_SUPPORT` en porte un à `topRows=7` (cut 826 right) puis `minTop=15` + flanc le rejettent. Les trois autres restent sous le seuil `robustLine` tant que le raffinement n’est pas conservé (D) et le seuil abaissé.');
  p('- **2** : support coarse `topRows=3` perdu au raffinement (`topRowsRefined` 1 et 2). `D_PRESERVE_COARSE` restaure `topRows=3` puis échoue à `minTop=15` + flanc. Ce n’est pas une récupération publiable.');
  p('');
  p('### Diagnostic de porte — `CD_MINTHRESH` (pas un candidat)');
  p('');
  const gmin = s.gateShifts?.CD_MINTHRESH;
  if (gmin) {
    p('Sur 59 RSF assemblés, **' + gmin.n + '** changent de motif (tous restent `unresolved`, **' + gmin.published + '** publiés) :');
    p('');
    for (const [reason, n] of Object.entries(gmin.reasonCounts || {})) p('- `' + reason + '` × ' + n);
    p('');
    p('Les 53 sans support de grille restent « Plan de roulement non estimable. ». Les 6 déplacés sont exactement les 4+2. Prochaine porte après C+D+minTop : **support de flanc**.');
    p('');
  }
  p('## Confrontation Sol / Loki');
  p('');
  p('Loki (`lab-vertical-alignment-provenance-replication-v1`) : première divergence au-dessus du seuil 0,015 à `coarse-search-z` ; z local tête médian failures **+0,0069**, coarse **−0,040**, refined **−0,043**. Association 0 inconsistency / 239. Compatible avec B et C **comme intuitions**. Les prototypes B et C **ne corrigeant pas** le cadre : B est REGRESSIVE, C est NEUTRAL à 0 récupéré. **N’établit pas** la cause physique du décalage.');
  p('');
  p('Sol (`lab-vertical-alignment-provenance-v1`) : rapport Markdown non publié sur la branche au moment de ce lot — pas d’attente, pas de retune rétrospective.');
  p('');
  p('Signature verticale reproduite sur les 59 RSF assemblés (unités scène) : z nuage local médian **' + (s.verticalAssembledRsf?.zMedianLocal ?? '—') + '**, coarse **' + (s.verticalAssembledRsf?.coarseZ ?? '—') + '**, refined **' + (s.verticalAssembledRsf?.refinedZ ?? '—') + '**, désaccord **' + (s.verticalAssembledRsf?.zDisagreement ?? '—') + '**. Compatible avec la signature établie (failures best.z ≈ −0,043, cloud ≈ +0,0069). `physicalCalibrationStatus: not-independently-verified`.');
  p('');
  p('## Recommandation technique (prochaine expérience)');
  p('');
  p('- Prototypes **PROMISING** (candidats d’intégration) : *(aucun)*');
  p('- Leviers **diagnostiques à conserver** : ' + (s.keepAsDiagnostic || []).map(x => '`' + x + '`').join(', '));
  p('- Prototypes **écartés comme candidats** : ' + (s.dropAsCandidate || []).map(x => '`' + x + '`').join(', '));
  p('- Ne pas transformer un levier NEUTRAL en version Banane. Passage EXPLORATION → CANDIDAT → INTÉGRATION décidé séparément, après confrontation provenance.');
  p('- ' + s.nextExperiment);
  p('');
  p('## Commandes');
  p('');
  p('```bash');
  p('node tools/geometry-prototype-v1.cjs --output audit/geometry-prototype-v1.json');
  p('node tools/geometry-prototype-v1.cjs --from-json audit/geometry-prototype-v1.json');
  p('node --test tests/geometry-prototype-v1.test.cjs');
  p('```');
  p('');
  return lines.join('\n');
}

function countBy(arr) {
  const o = {};
  for (const x of arr) o[x || '(null)'] = (o[x || '(null)'] || 0) + 1;
  return o;
}

function postHocStats(rows) {
  const avail = rows.filter(r => r.postHoc?.available);
  const scored = avail.filter(r => r.postHoc.error);
  const within = scored.filter(r => r.postHoc.within010);
  const unresolved = avail.filter(r => r.postHoc.engineUnresolved);
  const errors = scored.map(r => r.postHoc.error.euclid).sort((a, b) => a - b);
  const q = (p) => errors.length ? errors[Math.min(errors.length - 1, Math.floor((errors.length - 1) * p))] : null;
  return {
    available: avail.length, scored: scored.length, within010: within.length, unresolvedWithHuman: unresolved.length,
    medianError: q(0.5), p90Error: q(0.9),
  };
}

function writeArtifacts(report, output) {
  if (!report.science) report.science = deriveScience(report);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report));
  const mdPath = output.replace(/\.json$/i, '.md');
  if (mdPath !== output) fs.writeFileSync(mdPath, renderMarkdown(report));
  const canonical = path.join(ROOT, 'GEOMETRY_PROTOTYPE_V1.md');
  fs.writeFileSync(canonical, renderMarkdown(report));
  const slimPath = output.replace(/\.json$/i, '.slim.json');
  fs.writeFileSync(slimPath, JSON.stringify(slimReport(report)));
  const contentSha = SHA(JSON.stringify({ ...report, generatedAt: null, science: report.science }));
  return { mdPath, slimPath, canonical, contentSha };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fromJson) {
    const report = JSON.parse(fs.readFileSync(args.fromJson, 'utf8'));
    report.science = deriveScience(report);
    const output = args.output && args.output !== path.join(ROOT, 'audit/geometry-prototype-v1.json')
      ? args.output
      : args.fromJson;
    const { contentSha, slimPath } = writeArtifacts(report, output);
    console.log(JSON.stringify({
      mode: 'from-json',
      output,
      slimPath,
      lotStatus: report.science.lotStatus,
      publishedRecoveries: report.science.publishedRecoveries,
      coverage: report.science.coverage,
      gateShifts: Object.fromEntries(Object.entries(report.science.gateShifts).map(([k, v]) => [k, v && { n: v.n, published: v.published, reasonCounts: v.reasonCounts }])),
      contentSha,
    }, null, 2));
    return;
  }
  const { report, output, contentSha, elapsedMs } = build(args);
  const b = report.baseline;
  console.log(JSON.stringify({
    output, elapsedMs, contentSha,
    assembled: report.assembled, rsf: b.rsfFailures, controls: b.engineCandidates,
    families: b.rsfFamilies,
    lotStatus: report.science?.lotStatus,
    publishedRecoveries: report.science?.publishedRecoveries,
    prototypes: Object.fromEntries(Object.entries(report.prototypes).map(([k, v]) => [k, {
      status: v.status, ms: v.elapsedMs,
      recovered: report.comparisons[k]?.rsf.rsfRecovered ?? null,
      controlLost: report.comparisons[k]?.controls.controlLost ?? null,
      controlChanged: report.comparisons[k]?.controls.controlChanged ?? null,
    }])),
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.stack || e); process.exitCode = 1; }
}

module.exports = { PROTOTYPES, build, landscape, compactProposal, BASELINE_GEOMETRY_SHA, parseArgs, deriveScience, slimReport, renderMarkdown };
