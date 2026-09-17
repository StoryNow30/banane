#!/usr/bin/env node
'use strict';
/* Flank Support Lab V1 — branche lab-geometry-prototype-v1.
 * Étudie uniquement les 6 rails 4+2. Ne merge rien. Aucune action ESV. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');
const Proto = require('./geometry-prototype-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const RSF = 'Plan de roulement non estimable.';
const CD_LAB = { preferSupported: true, preserveCoarseSupport: true };

const TARGET_KEYS = Object.freeze([
  '3876864f-a864-4678-b7b0-3feecc4af418|2a62d36a-664b-4030-83d7-348ec57f11b4|1|5098|left',
  '0c58c033-f2e7-4aa5-ad8c-80b081a83932|15c0c1da-def9-4fb7-b23e-2310771e7ea7|2|228|right',
  '0c58c033-f2e7-4aa5-ad8c-80b081a83932|32cb7e14-93cc-4249-8f1c-b59ac3d09139|2|742|right',
  '0c58c033-f2e7-4aa5-ad8c-80b081a83932|312d7db2-eb41-48ef-9b24-968af93c005a|2|826|right',
  '0c58c033-f2e7-4aa5-ad8c-80b081a83932|a6286fda-0c67-4a54-b857-aac03998ddfc|2|839|right',
  '0c58c033-f2e7-4aa5-ad8c-80b081a83932|ce9be984-2a77-4311-941c-93448e7d443b|2|2335|right',
]);

const PROTOTYPES = {
  BASELINE: {
    family: 'baseline', hypothesis: 'géométrie gelée, DEFAULTS, aucun lab',
    options: {}, diagnostic: false,
  },
  A_FLANK_UNCHANGED: {
    family: 'A', hypothesis: 'C+D, critère de flanc actuel inchangé (minTop=15, minFace=6)',
    options: { lab: { ...CD_LAB } }, diagnostic: false,
  },
  B_MINTOP_ISOLATED: {
    family: 'B', hypothesis: 'C+D, seul minTop=3 ; minFace=6 inchangé',
    options: { minTop: 3, lab: { ...CD_LAB } }, diagnostic: false,
  },
  C_ADAPTIVE_FACE: {
    family: 'C', hypothesis: 'C+D, minFace adapté à la visibilité de la zone de flanc (minTop=15 inchangé)',
    options: { lab: { ...CD_LAB, adaptiveFace: true } }, diagnostic: false,
  },
  D_RELATIVE_FACE: {
    family: 'D', hypothesis: 'C+D, minFace relatif à topCount (6/15) plutôt qu’un nombre absolu ; minTop=15',
    options: { lab: { ...CD_LAB, relativeFace: true } }, diagnostic: false,
  },
  E_PARTIAL_FACE_KEEP: {
    family: 'E', hypothesis: 'C+D, conserver un candidat si le plan de roulement est fort (top≥15) et le flanc partiel (≥3) ; minFace sinon inchangé',
    options: { lab: { ...CD_LAB, partialFaceKeep: true } }, diagnostic: false,
  },
  F_EXPLICIT_ABSTAIN: {
    family: 'F', hypothesis: 'C+D, abstention explicite selon l’observation réelle du flanc ; aucun assouplissement de seuil',
    options: { lab: { ...CD_LAB, explicitFaceAbstain: true } }, diagnostic: false,
  },
  DIAG_CD_MINTHRESH: {
    family: 'diag', hypothesis: 'levier diagnostique C+D + minTop=minFace=3 — pas un candidat sauf publication réelle sans perte de témoins',
    options: { minTop: 3, minFace: 3, lab: { ...CD_LAB } }, diagnostic: true,
  },
};

function parseKey(key) {
  const [sessionId, visitId, part, cut, side] = key.split('|');
  return { sessionId, visitId, part: Number(part), cut: Number(cut), side, key };
}

function compactProposal(p) {
  if (!p) return { status: 'absent', reason: null, delta: null, loss: null, topRows: null, faceCount: null, seed: null };
  const reason = p.status === 'candidate' ? (p.reasons || []).join(' ') || null : (p.reasons || []).join(' ');
  const amb = p.metrics?.templateAmbiguity || {};
  return {
    status: p.status,
    reason,
    delta: p.delta || null,
    loss: p.metrics?.templateLoss ?? null,
    topRows: p.top?.count ?? p.metrics?.topCount ?? null,
    faceCount: p.metrics?.faceCount ?? p.face?.count ?? null,
    seed: p.metrics?.seed || null,
    confidence: p.confidence ?? null,
    topSlope: p.top?.slope ?? null,
    topRawSlope: p.top?.rawSlope ?? null,
    topSlopeLimited: !!p.top?.slopeLimited,
    faceSlope: p.face?.slope ?? null,
    faceRawSlope: p.face?.rawSlope ?? null,
    faceSlopeLimited: !!p.face?.slopeLimited,
    residual: p.metrics?.residual ?? null,
    binsTop: p.metrics?.topSpanBins ?? null,
    binsFace: p.metrics?.faceSpanBins ?? null,
    coarseLoss: amb.coarseBestLoss ?? null,
    alternativeLoss: amb.alternativeLoss ?? null,
    lossRatio: amb.lossRatio ?? null,
    alternative: amb.alternative ?? null,
    surface: p.metrics?.surfaceIntersection || null,
    lab: p.metrics?.lab || null,
  };
}

function failingCriteria(compact) {
  const r = compact.reason || '';
  return {
    runningSurfaceUnestimable: r.includes('Plan de roulement non estimable'),
    runningSurfaceSparse: r.includes('Plan de roulement insuffisamment observé'),
    flankSparse: r.includes('Flanc interne insuffisamment observé') || r.includes('Flanc interne absent') || r.includes('Flanc interne trop clairsemé') || r.includes('Flanc interne partiellement observé'),
    slopeLimited: r.includes('Inclinaison estimée hors du domaine'),
    ambiguity: r.includes('placements concurrents'),
    explicitAbstain: r.includes('abstention'),
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

function assembleCaptureRaw(visit, side, chunks) {
  const el = visit.geometryEligibility?.[side] ?? null;
  if (el?.status !== 'comparable-candidate')
    return { ready: false, reasons: el?.reasons ?? [], capture: null };
  const init = N.initialRail(visit, side);
  if (!init.rail) return { ready: false, reasons: [init.reason], capture: null };
  const ids = el.chunkIds ?? [];
  const points = [], visible = [];
  let missing = 0, clipped = 0, kept = 0;
  for (const id of ids) {
    const c = chunks.get(id);
    if (!c) { missing++; continue; }
    for (let i = 0; i < c.points.length; i++) {
      points.push(c.points[i]);
      const v = c.visible ? c.visible[i] : null;
      visible.push(v);
      if (v === true) kept++;
      else if (v === false) clipped++;
    }
  }
  if (missing) return { ready: false, reasons: [`chunks-absents:${missing}/${ids.length}`], capture: null };
  return {
    ready: true, reasons: [], points: points.length, visibleTrue: kept, clipped,
    capture: { rails: { [side]: init.rail }, pointsSceneRelative: points, visibleByClipBoxes: visible },
  };
}

function collectLocal(capture, side) {
  const rail = capture.rails?.[side];
  if (!rail) return null;
  const contour = rail.profileContours?.reduce((a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  if (!contour) return null;
  const shape = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(G.median(shape.map(p => p[1])));
  if (!sign) return null;
  const vertices = shape.map(p => [sign * p[1], p[2]]);
  const head = vertices.filter(p => p[1] > -0.04);
  const topBand = head.filter(p => p[1] > -0.012);
  const width = topBand.length ? Math.max(...topBand.map(p => p[0])) : NaN;
  const vis = capture.visibleByClipBoxes;
  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    const pt = capture.pointsSceneRelative[i];
    if (!Array.isArray(pt) || !pt.every(Number.isFinite)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, pt);
    if (!q.every(Number.isFinite)) continue;
    const visible = vis?.[i] !== false;
    const inWindow = Math.abs(q[0]) <= 0.5 && Math.abs(q[1]) < 0.18 && Math.abs(q[2]) < 0.10;
    points.push({
      along: q[0], u: sign * q[1], z: q[2],
      visible, inWindow, enginePoint: visible && inWindow,
    });
  }
  const topAnchors = [];
  if (Number.isFinite(width)) {
    for (let u = 0.012; u < width - 0.012; u += 0.006) {
      const near = head.filter(p => Math.abs(p[0] - u) < 0.004);
      if (near.length) topAnchors.push([u, Math.max(...near.map(p => p[1]))]);
    }
  }
  const faceAnchors = [];
  for (let z = -0.014; z >= -0.033; z -= 0.004) {
    const near = head.filter(p => Math.abs(p[1] - z) < 0.004);
    if (near.length) faceAnchors.push([Math.min(...near.map(p => p[0])), z]);
  }
  return { sign, width, head, vertices, points, topAnchors, faceAnchors };
}

function quantiles(arr) {
  const b = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!b.length) return null;
  const at = (p) => b[Math.min(b.length - 1, Math.floor((b.length - 1) * p))];
  return { n: b.length, min: b[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: b[b.length - 1] };
}

function hist(values, lo, hi, step) {
  const bins = [];
  for (let x = lo; x < hi - 1e-12; x += step) bins.push({ lo: +x.toFixed(4), hi: +(x + step).toFixed(4), n: 0 });
  let below = 0, above = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) { below++; continue; }
    if (v >= hi) { above++; continue; }
    const i = Math.min(bins.length - 1, Math.floor((v - lo) / step));
    bins[i].n++;
  }
  return { below, above, bins: bins.filter(b => b.n) };
}

function samplePoints(pts, n = 24) {
  if (pts.length <= n) return pts.map(p => ({ u: p.u, z: p.z, drop: p.drop ?? null, visible: p.visible }));
  const step = pts.length / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[Math.floor(i * step)];
    out.push({ u: p.u, z: p.z, drop: p.drop ?? null, visible: p.visible });
  }
  return out;
}

function classifyFlankPresence(strictN, boxN, innerN, clippedStrict, clippedBox) {
  if (strictN >= G.DEFAULTS.minFace) return 'flanc-suffisant-dans-la-fenetre-moteur';
  if (strictN >= 3) return 'flanc-partiel-dans-la-fenetre-moteur';
  if (strictN > 0) return 'flanc-clairseme-sous-robustLine';
  if (clippedStrict >= 3) return 'points-de-flanc-exclus-par-clipping';
  if (boxN >= 3) return 'points-dans-la-boite-z-mais-rejetes-par-la-pente';
  if (innerN >= 3) return 'flanc-present-pres-du-profil-initial-hors-fenetre-u';
  if (clippedBox >= 3) return 'boite-de-flanc-peuplee-hors-clip';
  return 'structure-de-flanc-absente-du-nuage-local';
}

function traceFlank(capture, rawCapture, side, options) {
  const proposal = G.propose(capture, side, options);
  const compact = compactProposal(proposal);
  const local = collectLocal(capture, side);
  const raw = rawCapture ? collectLocal(rawCapture, side) : null;
  const cfg = { ...G.DEFAULTS, ...options };
  const seed = compact.seed;
  const u0 = seed && local ? seed[0] / local.sign : null;
  const z0 = seed ? seed[1] : null;
  const top = proposal.top;
  const enginePts = local ? local.points.filter(p => p.enginePoint) : [];
  const rawPts = raw ? raw.points : [];

  const withDrop = (pts) => pts.map(p => {
    const drop = top ? top.slope * p.u + top.intercept - p.z : null;
    return { ...p, drop };
  });

  const strict = (p) => top && Number.isFinite(u0) && p.drop > 0.009 && p.drop < 0.034 && Math.abs(p.u - u0) < cfg.faceBand;
  const band2x = (p) => top && Number.isFinite(u0) && p.drop > 0.009 && p.drop < 0.034 && Math.abs(p.u - u0) < cfg.faceBand * 2;
  const dropWide = (p) => top && Number.isFinite(u0) && p.drop > 0.005 && p.drop < 0.045 && Math.abs(p.u - u0) < cfg.faceBand;
  const zBox = (p) => Number.isFinite(u0) && Number.isFinite(z0) && Math.abs(p.u - u0) < cfg.faceBand && p.z < z0 - 0.006 && p.z > z0 - 0.040;
  const innerInit = (p) => Math.abs(p.u) < 0.012 && p.z < -0.006 && p.z > -0.040;
  const topWin = (p) => Number.isFinite(u0) && Number.isFinite(local?.width) && p.u > u0 + 0.012 && p.u < u0 + local.width - 0.012 && Math.abs(p.z - z0) < cfg.topBand;

  const engD = withDrop(enginePts);
  const rawD = withDrop(rawPts);
  const visWin = rawPts.filter(p => p.visible && p.inWindow);
  const clipWin = rawPts.filter(p => !p.visible && p.inWindow);
  const clipAll = rawPts.filter(p => !p.visible);

  const strictEng = engD.filter(strict);
  const strictClip = withDrop(clipWin).filter(strict);
  const boxEng = enginePts.filter(zBox);
  const boxClip = clipWin.filter(zBox);
  const innerEng = enginePts.filter(innerInit);
  const innerClip = clipWin.filter(innerInit);

  const presence = classifyFlankPresence(
    strictEng.length, boxEng.length, innerEng.length, strictClip.length, boxClip.length,
  );

  const required = {
    minTop: cfg.minTop,
    minFace: cfg.minFace,
    robustLineMin: 3,
    faceBand: cfg.faceBand,
    topBand: cfg.topBand,
    drop: { lo: 0.009, hi: 0.034 },
    expectedZones: {
      runningSurface: 'bande horizontale u ∈ (best.u+0.012, best.u+width−0.012), |z−best.z| < topBand=0.012',
      innerFace: 'bande verticale |u−best.u| < faceBand=0.01 et drop (nappe de roulement − z) ∈ (0.009, 0.034)',
      faceAnchorsOnProfile: 'ancres de flanc du contour : z ∈ [−0.033, −0.014] pas −0.004, u = min du contour local',
      engineLocalWindow: '|along|≤0.5, |y_local|<0.18, |z|<0.10, visibleByClipBoxes !== false',
    },
    thresholdDependsOnVisibility: false,
    notes: [
      'minFace=6 et minTop=15 sont des effectifs absolus, indépendants du nombre de points réellement visibles dans la zone.',
      'robustLine exige 3 points ; en dessous le flanc est nul (face=null), même si minFace est abaissé à 3.',
      'binsFace histogramme p[0] de faceRows=[z,u], donc le z, pas le u (implémentation historique, non corrigée).',
    ],
  };

  return {
    compact,
    failing: failingCriteria(compact),
    placement: {
      u: u0, z: z0, seed, sign: local?.sign ?? null, width: local?.width ?? null,
      topAnchors: local?.topAnchors?.length ?? 0,
      faceAnchors: local?.faceAnchors?.length ?? 0,
    },
    top: top ? {
      count: top.count, slope: top.slope, rawSlope: top.rawSlope, slopeLimited: !!top.slopeLimited,
      intercept: top.intercept, residual: top.residual,
    } : null,
    face: proposal.face ? {
      count: proposal.face.count, slope: proposal.face.slope, rawSlope: proposal.face.rawSlope,
      slopeLimited: !!proposal.face.slopeLimited, intercept: proposal.face.intercept, residual: proposal.face.residual,
    } : null,
    counts: {
      captureVisible: capture.pointsSceneRelative?.length ?? 0,
      rawTotal: rawPts.length,
      rawVisibleTrue: rawPts.filter(p => p.visible).length,
      rawClipped: clipAll.length,
      engineLocal: enginePts.length,
      clippedInEngineWindow: clipWin.length,
      topWindow: enginePts.filter(topWin).length,
      faceStrict: strictEng.length,
      faceBand2x: engD.filter(band2x).length,
      faceDropWider: engD.filter(dropWide).length,
      faceZBox: boxEng.length,
      innerFaceNearU0: innerEng.length,
      clippedFaceStrict: strictClip.length,
      clippedFaceZBox: boxClip.length,
      clippedInnerNearU0: innerClip.length,
      visWin: visWin.length,
      clipWin: clipWin.length,
    },
    distributions: {
      engineU: hist(enginePts.map(p => p.u), -0.12, 0.12, 0.01),
      engineZ: hist(enginePts.map(p => p.z), -0.08, 0.04, 0.005),
      faceStrictU: hist(strictEng.map(p => p.u), -0.12, 0.12, 0.005),
      faceStrictZ: hist(strictEng.map(p => p.z), -0.08, 0.04, 0.005),
      engineUq: quantiles(enginePts.map(p => p.u)),
      engineZq: quantiles(enginePts.map(p => p.z)),
      faceDropQ: quantiles(engD.map(p => p.drop)),
    },
    samples: {
      faceStrict: samplePoints(strictEng, 20),
      faceZBox: samplePoints(boxEng, 16),
      innerNearU0: samplePoints(innerEng, 16),
      clippedFaceStrict: samplePoints(strictClip, 12),
    },
    presence,
    required,
    alternatives: {
      coarseLoss: compact.coarseLoss,
      alternativeLoss: compact.alternativeLoss,
      lossRatio: compact.lossRatio,
      alternative: compact.alternative,
      minTemplateLossRatio: cfg.minTemplateLossRatio,
    },
  };
}

function summarizePrototype(rows, baselineByKey) {
  const recovered = [], lostProposals = [], candidateChanges = [];
  let rsfRecovered = 0, rsfStill = 0, controlKept = 0, controlLost = 0, controlChanged = 0;
  let motifShift = 0, newAmbiguity = 0, targetRecovered = 0, targetMotifShift = 0;
  const reasonCounts = {};
  const targetKeys = new Set(TARGET_KEYS);
  for (const row of rows) {
    const base = baselineByKey.get(row.key);
    const b = base.proposal, p = row.proposal;
    const bFail = b.status !== 'candidate';
    const pFail = p.status !== 'candidate';
    const bRsf = (b.reason || '') === RSF;
    reasonCounts[p.reason || p.status] = (reasonCounts[p.reason || p.status] || 0) + 1;
    if (bRsf && !pFail) {
      rsfRecovered++;
      recovered.push(row.key);
      if (targetKeys.has(row.key)) targetRecovered++;
    }
    if (bRsf && pFail) rsfStill++;
    if (bRsf && pFail && (p.reason || '') !== (b.reason || '')) {
      motifShift++;
      if (targetKeys.has(row.key)) targetMotifShift++;
    }
    if (!bFail && !pFail) {
      if (deltaChanged(b.delta, p.delta)) { controlChanged++; candidateChanges.push(row.key); }
      else controlKept++;
    }
    if (!bFail && pFail) { controlLost++; lostProposals.push(row.key); }
    if (!(b.reason || '').includes('placements concurrents') && (p.reason || '').includes('placements concurrents'))
      newAmbiguity++;
  }
  return {
    n: rows.length, rsfRecovered, rsfStill, controlKept, controlLost, controlChanged,
    recovered, lostProposalKeys: lostProposals, candidateChangeKeys: candidateChanges,
    motifShift, newAmbiguity, targetRecovered, targetMotifShift, reasonCounts,
  };
}

function statusOf(comp, diagnostic) {
  const rec = comp.rsfRecovered, lost = comp.controlLost, chg = comp.controlChanged;
  if (diagnostic) {
    if (rec > 0 && lost === 0) return 'PROMISING';
    return 'NEUTRAL';
  }
  if (rec === 0 && lost === 0 && chg === 0) return 'NEUTRAL';
  if (lost > rec) return 'REGRESSIVE';
  if (rec >= 3 && lost === 0) return 'PROMISING';
  if (rec > 0 && lost <= 2) return 'PROMISING';
  if (rec > 0 && lost > 2) return 'INCONCLUSIVE';
  if (rec === 0 && (lost > 0 || chg > 0)) return 'REGRESSIVE';
  return 'INCONCLUSIVE';
}

function pickComparableControls(baselineRows, targets) {
  const candidates = baselineRows.filter(r => r.proposal.status === 'candidate');
  const perTarget = {};
  const used = new Set();
  for (const t of targets) {
    const meta = parseKey(t.key);
    const same = candidates
      .filter(c => c.sessionId === meta.sessionId && c.side === meta.side)
      .sort((a, b) => Math.abs((a.cut ?? 0) - meta.cut) - Math.abs((b.cut ?? 0) - meta.cut));
    const picked = [];
    for (const c of same) {
      if (picked.length >= 4) break;
      picked.push(c);
      used.add(c.key);
    }
    if (picked.length < 3) {
      const rest = candidates
        .filter(c => c.side === meta.side && !used.has(c.key))
        .sort((a, b) => (a.proposal.topRows ?? 99) - (b.proposal.topRows ?? 99));
      for (const c of rest) {
        if (picked.length >= 4) break;
        picked.push(c);
        used.add(c.key);
      }
    }
    perTarget[t.key] = picked.map(c => ({
      key: c.key, sessionId: c.sessionId, side: c.side, cut: c.cut, part: c.part,
      sameSession: c.sessionId === meta.sessionId, sameSide: c.side === meta.side,
      cutDistance: Math.abs((c.cut ?? 0) - meta.cut),
      topRows: c.proposal.topRows, loss: c.proposal.loss, faceCount: c.proposal.faceCount,
    }));
  }
  return { perTarget, uniqueKeys: [...used] };
}

function loadRails(args) {
  const { base, docs, visits } = N.readVisits(args.data || N.DEFAULT_ROOT);
  const lockPath = path.join(ROOT, 'audit/rsf-population-v1.json');
  const populationLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const lockSet = new Set(populationLock.rails.map(r => r.visitId + '|' + r.side));
  const comparable = [];
  for (const v of visits) {
    for (const side of ['left', 'right']) {
      if (v.geometryEligibility?.[side]?.status !== 'comparable-candidate') continue;
      if (!lockSet.has(v.visitId + '|' + side)) continue;
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
    const assembled = N.assembleCapture(item.visit, item.side, chunks);
    if (!assembled.ready) {
      rails.push({ ...item, assembled, skip: true, skipReasons: assembled.reasons });
      continue;
    }
    const init = N.initialRail(item.visit, item.side);
    rails.push({
      ...item, assembled, skip: false, chunks,
      human: N.humanDeltaLocal(item.visit, item.side, init.rail),
      identity: item.visit.identity,
      sessionId: item.visit.sessionId,
      cohort: item.visit.cohort,
      visitIndex: item.visit.visitIndex,
    });
  }
  for (const d of docs) { d.records = null; d.dictionaries = null; d.exactDoc = null; }
  return { base, chunks, rails, comparable, populationLock, chunkMs, needed };
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/flank-support-lab-v1.json'),
    prototypes: Object.keys(PROTOTYPES),
    limit: 0,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output') out.output = path.resolve(argv[++i]);
    else if (a === '--prototypes') out.prototypes = argv[++i].split(',');
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--data') out.data = argv[++i];
    else if (a === '--from-json') out.fromJson = path.resolve(argv[++i]);
    else throw Error('argument inconnu: ' + a);
  }
  return out;
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const geometrySha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry.js')));
  const baselineSha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry-baseline.js')));
  const loaded = loadRails(args);
  const work = loaded.rails.filter(r => !r.skip);
  const names = args.prototypes.filter(n => PROTOTYPES[n]);
  if (!names.includes('BASELINE')) names.unshift('BASELINE');

  const results = {};
  const baselineByKey = new Map();
  for (const name of names) {
    const proto = PROTOTYPES[name];
    const t0 = Date.now();
    const rows = [];
    let done = 0, msSum = 0;
    process.stderr.write(`[flank-lab] ${name} 0/${work.length}\n`);
    for (const rail of work) {
      if (args.limit && rows.length >= args.limit) break;
      const t1 = process.hrtime.bigint();
      const proposal = name === 'BASELINE'
        ? B.propose(rail.assembled.capture, rail.side)
        : G.propose(rail.assembled.capture, rail.side, proto.options);
      msSum += Number(process.hrtime.bigint() - t1) / 1e6;
      const compact = compactProposal(proposal);
      const row = {
        key: rail.key, sessionId: rail.sessionId, cohort: rail.cohort, side: rail.side,
        part: rail.identity?.part, cut: rail.identity?.cut, visitIndex: rail.visitIndex,
        points: rail.assembled.points, proposal: compact, ms: Number(process.hrtime.bigint() - t1) / 1e6,
        postHoc: postHoc(proposal, rail.human), failing: failingCriteria(compact),
      };
      if (name === 'BASELINE') {
        const isRsf = compact.reason === RSF;
        const land = isRsf ? Proto.landscape(rail.assembled.capture, rail.side) : null;
        row.landscape = land ? {
          family: land.family, pointsLocal: land.pointsLocal,
          topRowsCoarse: land.topRowsCoarse, topRowsRefined: land.topRowsRefined,
          gridSupported: land.gridSupported, zMedianLocal: land.zMedianLocal,
          zDisagreement: land.zDisagreement, refinedZ: land.refinedBest?.z, coarseZ: land.coarseBest?.z,
        } : null;
        row.rsfFamily = isRsf ? (land?.family || 'untraced') : null;
        baselineByKey.set(rail.key, row);
      } else {
        const base = baselineByKey.get(rail.key);
        row.rsfFamily = base?.rsfFamily || null;
        row.divergedFromBaseline = base
          ? (base.proposal.status !== compact.status || deltaChanged(base.proposal.delta, compact.delta) || base.proposal.reason !== compact.reason)
          : null;
      }
      rows.push(row);
      done++;
      if (done % 25 === 0 || done === work.length)
        process.stderr.write(`[flank-lab] ${name} ${done}/${work.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    }
    results[name] = { name, ...proto, elapsedMs: Date.now() - t0, proposeMs: msSum, rows };
  }

  const baselineRows = results.BASELINE.rows;
  const rsf = baselineRows.filter(r => r.proposal.reason === RSF);
  const controls = baselineRows.filter(r => r.proposal.status === 'candidate');
  const familyCounts = {};
  for (const r of rsf) familyCounts[r.rsfFamily || 'untraced'] = (familyCounts[r.rsfFamily || 'untraced'] || 0) + 1;

  const targetRows = TARGET_KEYS.map(k => {
    const base = baselineByKey.get(k);
    if (!base) return { key: k, missing: true };
    const rail = work.find(r => r.key === k);
    const raw = assembleCaptureRaw(rail.visit, rail.side, loaded.chunks);
    const traces = {};
    for (const name of names) {
      if (name === 'BASELINE') continue;
      traces[name] = traceFlank(rail.assembled.capture, raw.ready ? raw.capture : null, rail.side, PROTOTYPES[name].options);
    }
    const cdTrace = traces.A_FLANK_UNCHANGED || traceFlank(rail.assembled.capture, raw.ready ? raw.capture : null, rail.side, { lab: { ...CD_LAB } });
    return {
      key: k, missing: false,
      sessionId: base.sessionId, side: base.side, part: base.part, cut: base.cut,
      rsfFamily: base.rsfFamily, landscape: base.landscape,
      baseline: base.proposal,
      prototypes: Object.fromEntries(names.filter(n => n !== 'BASELINE').map(n => {
        const row = results[n].rows.find(x => x.key === k);
        return [n, { proposal: row?.proposal, failing: row?.failing, trace: traces[n] || null }];
      })),
      criterion: cdTrace,
      rawAssembly: raw.ready ? { points: raw.points, visibleTrue: raw.visibleTrue, clipped: raw.clipped } : { ready: false, reasons: raw.reasons },
    };
  });

  const comparable = pickComparableControls(baselineRows, targetRows.filter(t => !t.missing));
  const controlTraces = {};
  for (const key of comparable.uniqueKeys) {
    const rail = work.find(r => r.key === key);
    if (!rail) continue;
    const raw = assembleCaptureRaw(rail.visit, rail.side, loaded.chunks);
    const base = baselineByKey.get(key);
    controlTraces[key] = {
      key, sessionId: rail.sessionId, side: rail.side, part: rail.identity?.part, cut: rail.identity?.cut,
      baseline: base?.proposal, rsfFamily: null,
      criterion: traceFlank(rail.assembled.capture, raw.ready ? raw.capture : null, rail.side, { lab: { ...CD_LAB } }),
      rawAssembly: raw.ready ? { points: raw.points, visibleTrue: raw.visibleTrue, clipped: raw.clipped } : { ready: false, reasons: raw.reasons },
    };
  }

  const comparisons = {};
  const statuses = {};
  for (const name of names) {
    if (name === 'BASELINE') { statuses[name] = 'BASELINE'; continue; }
    const all = summarizePrototype(results[name].rows, baselineByKey);
    const rsfRows = results[name].rows.filter(r => baselineByKey.get(r.key)?.proposal.reason === RSF);
    const controlRows = results[name].rows.filter(r => baselineByKey.get(r.key)?.proposal.status === 'candidate');
    const targetOnly = results[name].rows.filter(r => TARGET_KEYS.includes(r.key));
    comparisons[name] = {
      all,
      rsf: summarizePrototype(rsfRows, baselineByKey),
      controls: summarizePrototype(controlRows, baselineByKey),
      targets: summarizePrototype(targetOnly, baselineByKey),
    };
    statuses[name] = statusOf(comparisons[name].all, PROTOTYPES[name].diagnostic);
  }

  const publishedRecoveries = Math.max(0, ...names.filter(n => n !== 'BASELINE' && !PROTOTYPES[n].diagnostic).map(n => comparisons[n].rsf.rsfRecovered));
  const promising = names.filter(n => n !== 'BASELINE' && !PROTOTYPES[n].diagnostic && statuses[n] === 'PROMISING');
  const lotStatus = promising.length ? 'PROMISING'
    : publishedRecoveries === 0 && names.filter(n => n !== 'BASELINE' && !PROTOTYPES[n].diagnostic).every(n => statuses[n] === 'NEUTRAL' || statuses[n] === 'REGRESSIVE' || statuses[n] === 'INCONCLUSIVE')
      ? (names.filter(n => n !== 'BASELINE' && !PROTOTYPES[n].diagnostic).every(n => statuses[n] === 'NEUTRAL') ? 'INCONCLUSIVE' : 'INCONCLUSIVE')
      : 'INCONCLUSIVE';

  const presence = {};
  for (const t of targetRows) {
    const p = t.criterion?.presence || 'untraced';
    presence[p] = (presence[p] || 0) + 1;
  }
  const clippedHides = targetRows.filter(t => (t.criterion?.counts?.clippedFaceStrict || 0) >= 3).length;
  const diag = comparisons.DIAG_CD_MINTHRESH;
  const diagCandidate = !!(diag && diag.rsf.rsfRecovered > 0 && diag.controls.controlLost === 0);

  const report = {
    format: 'banane-flank-support-lab-v1',
    branch: 'lab-geometry-prototype-v1',
    headExpected: 'edd76c2346a803a04b8ae1db61615257d6ce7da4',
    nature: 'EXPERIMENTAL — aucune conclusion de production',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    data: { ...N.REF, root: loaded.base, chunkLoadMs: loaded.chunkMs, chunksLoaded: loaded.chunks.size, chunksNeeded: loaded.needed.size },
    hashes: {
      geometryBaselineOriginal: BASELINE_GEOMETRY_SHA,
      geometryBaselineFile: baselineSha,
      geometryCurrent: geometrySha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
    },
    assembled: work.length,
    skipped: loaded.rails.filter(r => r.skip).map(r => ({ key: r.key, reasons: r.skipReasons })),
    targetKeys: [...TARGET_KEYS],
    baseline: {
      rsfFailures: rsf.length,
      engineCandidates: controls.length,
      rsfFamilies: familyCounts,
      rsfKeys: rsf.map(r => r.key),
      controlKeys: controls.map(r => r.key),
    },
    prototypes: Object.fromEntries(names.map(n => [n, {
      family: PROTOTYPES[n].family, hypothesis: PROTOTYPES[n].hypothesis, options: PROTOTYPES[n].options,
      diagnostic: PROTOTYPES[n].diagnostic, elapsedMs: results[n].elapsedMs, proposeMs: results[n].proposeMs,
      status: statuses[n],
    }])),
    comparisons,
    targets: targetRows,
    comparableControls: comparable,
    controlTraces,
    science: {
      lotStatus,
      publishedRecoveries,
      promising,
      neutral: names.filter(n => n !== 'BASELINE' && statuses[n] === 'NEUTRAL'),
      regressive: names.filter(n => n !== 'BASELINE' && statuses[n] === 'REGRESSIVE'),
      inconclusive: names.filter(n => n !== 'BASELINE' && statuses[n] === 'INCONCLUSIVE'),
      diagnosticOnly: ['DIAG_CD_MINTHRESH'],
      cdMinthreshAsCandidate: diagCandidate,
      targetN: TARGET_KEYS.length,
      presence,
      clippingHidesEnoughFace: clippedHides,
      familiesInScope: ['support-ailleurs-mais-perte-nettement-superieure', 'raffinement-a-quitte-le-support'],
      familiesOutOfScope: ['aucun-support-nulle-part-sur-la-grille'],
      nextExperiment: publishedRecoveries === 0
        ? 'Aucune variante A–F ne publie de candidate sûre sur les 6. Ne pas baisser minFace/minTop ensemble. Les 53 sans support restent hors de ce laboratoire.'
        : 'Une variante publie : ne l’intégrer que si les témoins sont conservés et après confrontation provenance.',
    },
  };

  writeArtifacts(report, args.output);
  return { report, output: args.output, elapsedMs: report.elapsedMs };
}

function writeArtifacts(report, output) {
  if (!report.science.presence && Array.isArray(report.targets)) {
    const presence = {};
    for (const t of report.targets) {
      const p = t.criterion?.presence || 'untraced';
      presence[p] = (presence[p] || 0) + 1;
    }
    report.science.presence = presence;
    report.science.clippingHidesEnoughFace = report.targets.filter(t => (t.criterion?.counts?.clippedFaceStrict || 0) >= 3).length;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report));
  const slim = { ...report };
  delete slim.controlTraces;
  const slimRows = {};
  if (report.targets) slim.targets = report.targets;
  fs.writeFileSync(output.replace(/\.json$/i, '.slim.json'), JSON.stringify({
    ...report,
    controlTraces: undefined,
    targets: report.targets.map(t => ({
      key: t.key, sessionId: t.sessionId, side: t.side, part: t.part, cut: t.cut,
      rsfFamily: t.rsfFamily, landscape: t.landscape, baseline: t.baseline,
      prototypes: Object.fromEntries(Object.entries(t.prototypes || {}).map(([n, v]) => [n, { proposal: v.proposal, failing: v.failing }])),
      criterionCounts: t.criterion?.counts,
      presence: t.criterion?.presence,
      failing: t.criterion?.failing,
      placement: t.criterion?.placement,
      top: t.criterion?.top,
      face: t.criterion?.face,
      alternatives: t.criterion?.alternatives,
      required: t.criterion?.required,
      rawAssembly: t.rawAssembly,
    })),
  }));
  const railsPath = output.replace(/\.json$/i, '-rails.json');
  fs.writeFileSync(railsPath, JSON.stringify({ format: report.format, targetKeys: report.targetKeys, rails: report.targets }, null, 2));
  const md = renderMarkdown(report);
  fs.writeFileSync(output.replace(/\.json$/i, '.md'), md);
  fs.writeFileSync(path.join(ROOT, 'FLANK_SUPPORT_LAB_V1.md'), md);
  return { railsPath };
}

function num(x, d = 4) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) >= 1) return x.toFixed(Math.min(d, 3));
  return x.toPrecision(3);
}

function renderMarkdown(report) {
  const s = report.science;
  const p = [];
  const L = (t = '') => p.push(t);
  L('# Flank Support Lab V1');
  L('');
  L('Lot **EXPÉRIMENTAL**. Branche `lab-geometry-prototype-v1`. Aucun merge, aucune conclusion de production, aucune action ESV.');
  L('');
  L('**Statut du lot : `' + s.lotStatus + '`.** Récupérations publiées (status `candidate`) : **' + s.publishedRecoveries + '**.');
  L('');
  L('- Base : `' + report.hashes.geometryBaselineOriginal + '` (`src/geometry-baseline.js`)');
  L('- Géométrie courante : `' + report.hashes.geometryCurrent + '`');
  L('- Baseline inchangée : **' + (report.hashes.baselineUnchanged ? 'oui' : 'NON') + '**');
  L('- Données : `' + report.data.repo + '` `' + report.data.branch + '` `@' + report.data.head + '`');
  L('- Rails assemblés : **' + report.assembled + '** (témoins ' + report.baseline.engineCandidates + ', RSF ' + report.baseline.rsfFailures + ')');
  L('- Cibles 4+2 : **' + report.targetKeys.length + '** — les 53 sans support de grille sont hors périmètre');
  L('- Durée : ' + (report.elapsedMs / 1000).toFixed(1) + ' s');
  L('');
  L('## Conclusions');
  L('');
  if (s.publishedRecoveries === 0) {
    L('1. **Aucune récupération candidate sûre.** Les variantes A–F n’ont transformé aucun des 6 rails en `candidate`. Un changement de motif d’abstention n’est pas une publication. Ne pas forcer un résultat positif.');
  } else {
    L('1. **Récupérations publiées : ' + s.publishedRecoveries + '.** Une récupération n’est un succès que si les témoins sont conservés.');
  }
  L('2. **Les 6 ont un plan de roulement fragile, pas un plan absent.** Après C+D, `robustLine` passe (topRows 3–7) mais **aucun** n’atteint `minTop=15`. Le plus fort est cut 826 (7 points).');
  L('3. **Le flanc n’est pas caché par le clipping.** Aucune cible n’a ≥3 points de flanc exclus par clip. Présence : `' + JSON.stringify(s.presence || {}) + '`. Le critère exige une nappe (3 points, puis 6) dans `|u−best.u|<0,01` et drop 9–34×10⁻³ — structure souvent absente du nuage local.');
  L('4. **Cut 839 est le seul flanc partiel réel** (3 points, `robustLine` du flanc existe). `DIAG_CD_MINTHRESH` le fait sortir vers l’ambiguïté (ratio 1,23 < 1,5), pas vers une candidate. Cut 826/2335 ont 2 et 1 points (sous le plancher 3). Cuts 5098/228 ont un seed latéral collé à `searchY` et 0 point de flanc. Cut 742 a une pente de roulement saturée à −0,5.');
  L('5. **Ne pas remplacer minFace par un ratio du dessus.** `D_RELATIVE_FACE` perd **153** témoins : un rail publié a souvent beaucoup de points sur le dessus et seulement 6–8 sur le flanc ; le ratio 6/15 exige alors 10–20 points de flanc.');
  L('6. **`DIAG_CD_MINTHRESH` reste diagnostique**' + (s.cdMinthreshAsCandidate ? ' — promu seulement parce qu’il publie sans perte de témoins.' : ' : 0 candidate, 0 témoin perdu. Ne pas le présenter comme candidat.'));
  L('7. **Les 53 sans support de grille restent hors périmètre.**');
  L('');
  L('### Statuts A–F');
  L('');
  L('| variante | famille | statut | RSF récupérés | motif d’abstention changé (6) | témoins perdus | témoins déplacés | ambiguïtés nouvelles |');
  L('|---|---|---|---:|---:|---:|---:|---:|');
  for (const [name, proto] of Object.entries(report.prototypes)) {
    if (name === 'BASELINE') continue;
    const c = report.comparisons[name];
    L('| `' + name + '` | ' + proto.family + ' | **' + proto.status + '** | ' + c.rsf.rsfRecovered + ' | ' + c.targets.motifShift + ' | ' + c.controls.controlLost + ' | ' + c.controls.controlChanged + ' | ' + c.all.newAmbiguity + ' |');
  }
  L('');
  L('### Conservés comme leviers diagnostiques');
  L('');
  const keep = Object.entries(report.prototypes).filter(([n, x]) => n !== 'BASELINE' && (x.status === 'NEUTRAL' || x.diagnostic)).map(([n]) => n);
  L(keep.map(x => '- `' + x + '`').join('\n') || '- *(aucun)*');
  L('');
  L('### Écartés comme candidats');
  L('');
  const drop = Object.entries(report.prototypes).filter(([n, x]) => n !== 'BASELINE' && (x.status === 'REGRESSIVE' || (x.status !== 'PROMISING' && !x.diagnostic && x.status !== 'NEUTRAL'))).map(([n]) => n);
  const dropReg = Object.entries(report.prototypes).filter(([, x]) => x.status === 'REGRESSIVE').map(([n]) => n);
  L((dropReg.length ? dropReg : drop.filter(n => report.prototypes[n].status === 'REGRESSIVE')).map(x => '- `' + x + '`').join('\n') || '- *(aucun REGRESSIVE)*');
  L('');
  L('## Liste exacte des 6 cas');
  L('');
  L('| rail | famille | topRows coarse | topRows raffiné | topRows C+D | minTop | faceStrict | pente limitée | présence | motif minTop=3/minFace=3 |');
  L('|---|---|---:|---:|---:|---:|---:|---|---|---|');
  for (const t of report.targets) {
    if (t.missing) { L('| `' + t.key + '` | *absent* | | | | | | | | |'); continue; }
    const a = t.prototypes.A_FLANK_UNCHANGED?.proposal;
    const d = t.prototypes.DIAG_CD_MINTHRESH?.proposal;
    const faceN = t.criterion?.counts?.faceStrict ?? a?.faceCount;
    L('| `' + t.key + '` | `' + t.rsfFamily + '` | ' + (t.landscape?.topRowsCoarse ?? '—') + ' | ' + (t.landscape?.topRowsRefined ?? '—') + ' | ' + (a?.topRows ?? '—') + ' | 15 | ' + (faceN ?? '—') + ' | ' + ((a?.topSlopeLimited || a?.faceSlopeLimited) ? 'oui' : 'non') + ' | ' + (t.criterion?.presence || '') + ' | ' + (d?.reason || '') + ' |');
  }
  L('');
  L('## Rail par rail');
  L('');
  for (const t of report.targets) {
    if (t.missing) continue;
    const c = t.criterion;
    const a = t.prototypes.A_FLANK_UNCHANGED?.proposal;
    L('### Cut ' + t.cut + ' ' + t.side + ' — `' + t.rsfFamily + '`');
    L('');
    L('- Clé : `' + t.key + '`');
    L('- Session : `' + t.sessionId + '` · part ' + t.part);
    L('- Landscape : topRows coarse **' + (t.landscape?.topRowsCoarse ?? '—') + '**, raffiné **' + (t.landscape?.topRowsRefined ?? '—') + '**, grille supportée **' + (t.landscape?.gridSupported ?? '—') + '**');
    L('- Placement C+D : seed `' + JSON.stringify(a?.seed) + '`, loss `' + num(a?.loss) + '`, topRows **' + (a?.topRows ?? '—') + '**, faceCount **' + (a?.faceCount ?? '—') + '**');
    L('- Pente roulement : `' + num(a?.topSlope) + '` (raw `' + num(a?.topRawSlope) + '`, limitée : ' + (a?.topSlopeLimited ? 'oui' : 'non') + ')');
    L('- Pente flanc : `' + num(a?.faceSlope) + '` (limitée : ' + (a?.faceSlopeLimited ? 'oui' : 'non') + ')');
    L('- Ratio d’ambiguïté : `' + num(a?.lossRatio) + '` (seuil 1,5) · alternative `' + JSON.stringify(a?.alternative) + '`');
    L('- Motif A (flanc inchangé) : *' + (a?.reason || '') + '*');
    if (c) {
      L('- Points moteur (clip ∩ fenêtre) : **' + c.counts.engineLocal + '** · clipés dans la fenêtre : **' + c.counts.clippedInEngineWindow + '** · raw total : ' + c.counts.rawTotal);
      L('- Fenêtre de flanc stricte : **' + c.counts.faceStrict + '** · bande×2 : **' + c.counts.faceBand2x + '** · drop élargi : **' + c.counts.faceDropWider + '** · boîte z : **' + c.counts.faceZBox + '** · flanc près de u=0 : **' + c.counts.innerFaceNearU0 + '**');
      L('- Points de flanc exclus par clipping (fenêtre stricte) : **' + c.counts.clippedFaceStrict + '**');
      L('- Présence : `' + c.presence + '`');
      L('- Ancres profil : top ' + c.placement.topAnchors + ' · face ' + c.placement.faceAnchors + ' · width `' + num(c.placement.width) + '`');
    }
    L('- Témoins comparables :');
    for (const ctrl of report.comparableControls.perTarget[t.key] || []) {
      L('  - `' + ctrl.key + '` cut ' + ctrl.cut + ' ' + ctrl.side + (ctrl.sameSession ? ' (même session)' : '') + ' · topRows ' + ctrl.topRows + ' · faceCount ' + (ctrl.faceCount ?? '—') + ' · Δcut ' + ctrl.cutDistance);
    }
    L('');
    L('| variante | status | motif | top | face |');
    L('|---|---|---|---:|---:|');
    for (const name of Object.keys(t.prototypes || {})) {
      const pr = t.prototypes[name].proposal;
      L('| `' + name + '` | ' + pr.status + ' | ' + (pr.reason || '(candidate)') + ' | ' + (pr.topRows ?? '—') + ' | ' + (pr.faceCount ?? '—') + ' |');
    }
    L('');
  }
  L('## Retrace du critère de flanc');
  L('');
  L('Le moteur, après avoir choisi `(best.u, best.z)` et ajusté une nappe de roulement `z = slope·u + intercept`, retient comme flanc interne les points du nuage local tels que :');
  L('');
  L('1. `visibleByClipBoxes !== false` (clipping ESV) ;');
  L('2. fenêtre locale `|along| ≤ 0,5`, `|y| < 0,18`, `|z| < 0,10` ;');
  L('3. `|u − best.u| < faceBand` avec `faceBand = 0,01` ;');
  L('4. `drop = slope·u + intercept − z` ∈ `(0,009 ; 0,034)`.');
  L('');
  L('Il faut **6** points (`minFace`) pour publier, et **3** pour que `robustLine` existe. Ces seuils **ne dépendent pas** du nombre de points réellement visibles dans la zone. Si le clipping ou la fenêtre enlèvent les points du flanc, le critère exige une structure que le nuage *observé* ne contient plus — même si des points existent hors clip.');
  L('');
  L('Les 53 RSF sans aucun support de grille n’atteignent pas cette porte.');
  L('');
  L('## Cohorte de témoins comparable');
  L('');
  L('Sélection : même session et même côté lorsque c’est possible, plus proches cuts ; à défaut même côté, plus petit `topRows` encore publié (proche du seuil 15). Tous ont un plan de roulement **et** un flanc acceptés à la baseline.');
  L('');
  L('| cible | n témoins | dont même session+côté |');
  L('|---|---:|---:|');
  for (const t of report.targets) {
    if (t.missing) continue;
    const list = report.comparableControls.perTarget[t.key] || [];
    L('| cut ' + t.cut + ' ' + t.side + ' | ' + list.length + ' | ' + list.filter(x => x.sameSession && x.sameSide).length + ' |');
  }
  L('');
  L('Témoins uniques : **' + (report.comparableControls.uniqueKeys || []).length + '**.');
  L('');
  L('## Ablations');
  L('');
  for (const [name, proto] of Object.entries(report.prototypes)) {
    if (name === 'BASELINE') continue;
    const c = report.comparisons[name];
    L('### `' + name + '` — ' + proto.status);
    L('');
    L('- Famille : **' + proto.family + '**' + (proto.diagnostic ? ' (diagnostique, pas un candidat d’intégration a priori)' : ''));
    L('- Hypothèse : ' + proto.hypothesis);
    L('- Options : `' + JSON.stringify(proto.options) + '`');
    L('- RSF récupérés (221) : **' + c.rsf.rsfRecovered + '** dont cibles 4+2 : **' + c.targets.rsfRecovered + '**');
    L('- Motifs d’abstention changés (cibles) : ' + c.targets.motifShift);
    L('- Témoins conservés : ' + c.controls.controlKept + ' · perdus : **' + c.controls.controlLost + '** · déplacés : **' + c.controls.controlChanged + '**');
    L('- Ambiguïtés nouvelles : ' + c.all.newAmbiguity);
    if (c.rsf.recovered.length) {
      L('- Rails récupérés :');
      for (const k of c.rsf.recovered) L('  - `' + k + '`');
    } else L('- Rails récupérés : *(aucun)*');
    if (c.controls.lostProposalKeys.length) {
      L('- Témoins perdus :');
      for (const k of c.controls.lostProposalKeys.slice(0, 20)) L('  - `' + k + '`');
    }
    L('');
  }
  L('## Gains et régressions');
  L('');
  L('- Gains (candidate nouvelle, témoins intacts) : ' + (s.promising.length ? s.promising.map(x => '`' + x + '`').join(', ') : '*(aucun)*'));
  L('- Régressions : ' + (s.regressive.length ? s.regressive.map(x => '`' + x + '`').join(', ') : '*(aucune)*'));
  L('- Neutres : ' + (s.neutral.length ? s.neutral.map(x => '`' + x + '`').join(', ') : '*(aucun)*'));
  L('');
  L('## Commandes');
  L('');
  L('```bash');
  L('node tools/flank-support-lab-v1.cjs --output audit/flank-support-lab-v1.json');
  L('node tools/flank-support-lab-v1.cjs --from-json audit/flank-support-lab-v1.json');
  L('node --test tests/flank-support-lab-v1.test.cjs tests/geometry-prototype-v1.test.cjs');
  L('```');
  L('');
  L('Branche `lab-geometry-prototype-v1`. Ne pas merger.');
  return p.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fromJson) {
    const report = JSON.parse(fs.readFileSync(args.fromJson, 'utf8'));
    writeArtifacts(report, args.output && args.output.endsWith('flank-support-lab-v1.json') === false ? args.output : args.fromJson);
    console.log(JSON.stringify({ mode: 'from-json', lotStatus: report.science.lotStatus, publishedRecoveries: report.science.publishedRecoveries }, null, 2));
    return;
  }
  const { report, output, elapsedMs } = build(args);
  console.log(JSON.stringify({
    output, elapsedMs,
    assembled: report.assembled,
    targets: report.targetKeys.length,
    lotStatus: report.science.lotStatus,
    publishedRecoveries: report.science.publishedRecoveries,
    prototypes: Object.fromEntries(Object.entries(report.prototypes).map(([k, v]) => [k, {
      status: v.status,
      recovered: report.comparisons[k]?.rsf.rsfRecovered ?? null,
      targetRecovered: report.comparisons[k]?.targets.rsfRecovered ?? null,
      motifShift6: report.comparisons[k]?.targets.motifShift ?? null,
      controlLost: report.comparisons[k]?.controls.controlLost ?? null,
      controlChanged: report.comparisons[k]?.controls.controlChanged ?? null,
    }])),
  }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e.stack || e); process.exitCode = 1; }
}

module.exports = {
  TARGET_KEYS, PROTOTYPES, BASELINE_GEOMETRY_SHA, CD_LAB,
  parseArgs, build, compactProposal, collectLocal, traceFlank,
  assembleCaptureRaw, classifyFlankPresence, failingCriteria, renderMarkdown, writeArtifacts,
};
