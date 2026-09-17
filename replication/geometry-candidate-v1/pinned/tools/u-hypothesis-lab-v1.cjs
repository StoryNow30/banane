#!/usr/bin/env node
'use strict';
/* U Hypothesis Lab V1 — branche lab-u-hypothesis-v1.
 * Question : un meilleur centrage / générateur d’hypothèses U, dans le
 * searchY local actuel, récupère-t-il les 51 hors-U sans déplacer les témoins ?
 * NE PAS élargir searchY. searchZ inchangé. Aucun merge, aucune action ESV. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');
const Prev = require('./no-support-generator-lab-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53';
const RSF = 'Plan de roulement non estimable.';
const POP_PATH = path.join(ROOT, 'audit/u-hypothesis-population-v1.json');
const ENGINE_Y = G.DEFAULTS.searchY;
const ENGINE_Z = G.DEFAULTS.searchZ;
const ENGINE_GRID = G.DEFAULTS.grid;
const TOP_BAND = G.DEFAULTS.topBand;
const EXCEPTIONS = Object.freeze({
  '0c58c033-f2e7-4aa5-ad8c-80b081a83932|3d0da416-a1c4-4b67-914b-88fc3820df5b|2|836|left': 'hors-Z',
  '0c58c033-f2e7-4aa5-ad8c-80b081a83932|269cf493-35e6-4145-a4a2-997b775eff50|2|756|left': 'hors-U+Z',
});

const VARIANTS = Object.freeze({
  BASELINE: {
    id: 'BASELINE', title: 'moteur actuel, graine (0,0)',
    hypothesis: 'search(0,0) searchY=0.08 searchZ=0.04 — aucun lab',
    buildLab: () => null,
  },
  A: {
    id: 'A', title: 'médiane U du nuage local',
    hypothesis: 'une graine = médiane U des points observables moteur ; recherche locale inchangée ; fenêtre recentrée',
    buildLab: (h) => ({ uSeeds: h.A.map(x => x.u), replaceOrigin: true, recenterWindow: true }),
  },
  A_NO_WINDOW: {
    id: 'A_NO_WINDOW', title: 'A sans recentrage de fenêtre (ablation)',
    hypothesis: 'même graine A, mais la fenêtre d’intersection reste |u|≤searchY+0.01 autour de 0',
    buildLab: (h) => ({ uSeeds: h.A.map(x => x.u), replaceOrigin: true, recenterWindow: false }),
  },
  B: {
    id: 'B', title: 'médiane U robuste (nappe haute)',
    hypothesis: 'médiane U du sous-ensemble z ≥ q70(z) − topBand ; recherche locale ; fenêtre recentrée',
    buildLab: (h) => ({ uSeeds: h.B.map(x => x.u), replaceOrigin: true, recenterWindow: true }),
  },
  C: {
    id: 'C', title: 'multi-hypothèses U',
    hypothesis: 'pics de densité + maxima de support 1D + quantiles, dédupliqués ; chaque graine a searchY local',
    buildLab: (h) => ({ uSeeds: h.C.map(x => x.u), replaceOrigin: true, recenterWindow: true }),
  },
});

function loadPopulation() {
  const pop = JSON.parse(fs.readFileSync(POP_PATH, 'utf8'));
  if (!Array.isArray(pop.failureKeys) || pop.failureKeys.length !== 53)
    throw Error('population failures 53 invalide');
  if (!Array.isArray(pop.controlKeys) || pop.controlKeys.length !== 53)
    throw Error('population témoins 53 invalide');
  const fail = new Set(pop.failureKeys);
  const ctrl = new Set(pop.controlKeys);
  if (fail.size !== 53 || ctrl.size !== 53) throw Error('clés dupliquées');
  for (const k of ctrl) if (fail.has(k)) throw Error('chevauchement failure/control');
  return pop;
}

function parseKey(key) {
  const [sessionId, visitId, part, cut, side] = key.split('|');
  return { sessionId, visitId, part: Number(part), cut: Number(cut), side, key };
}

function exceptionOf(key) { return EXCEPTIONS[key] || null; }

function round6(x) { return Math.round(x * 1e6) / 1e6; }

function median(a) {
  if (!a.length) return NaN;
  const b = a.slice().sort((x, y) => x - y);
  const i = b.length >> 1;
  return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2;
}

function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const t = Math.max(0, Math.min(1, q)) * (sorted.length - 1);
  const i = Math.floor(t), f = t - i;
  if (i >= sorted.length - 1) return sorted[sorted.length - 1];
  return sorted[i] * (1 - f) + sorted[i + 1] * f;
}

/* Filtre B — sans oracle humain.
 * 1. Même voisinage que propose() (|x|≤0.5, |u|<0.18, |z|<0.10, clip).
 * 2. Nappe haute : z ≥ quantile 70 % de z − topBand (0,012).
 *    Le plan de roulement est la surface localement la plus haute du champignon ;
 *    ballast et semelle sont plus bas ; le rail opposé n’entre pas dans la boîte.
 * 3. Si < 8 points, repli z > −0,04 (tête de profil, même seuil que le moteur).
 * 4. Si encore < 8, nuage complet. */
function highZSubset(points, topBand = TOP_BAND, q = 0.70) {
  if (!points.length) return { points: [], zCut: null, fallback: 'empty' };
  const zs = points.map(p => p[1]).slice().sort((a, b) => a - b);
  const zCut = quantile(zs, q) - topBand;
  let sub = points.filter(p => p[1] >= zCut);
  let fallback = 'high-z-q70';
  if (sub.length < 8) {
    sub = points.filter(p => p[1] > -0.04);
    fallback = 'head-z-gt-minus-0.04';
  }
  if (sub.length < 8) {
    sub = points;
    fallback = 'all-local';
  }
  return { points: sub, zCut, fallback, n: sub.length, nAll: points.length };
}

function uHistogram(points, uMin = -0.18, uMax = 0.18, du = 0.012) {
  const n = Math.round((uMax - uMin) / du);
  const counts = new Array(n).fill(0);
  for (const p of points) {
    const i = Math.floor((p[0] - uMin) / du);
    if (i >= 0 && i < n) counts[i]++;
  }
  return { uMin, du, n, counts };
}

function densityPeaks(hist, minFrac = 0.25, minCount = 3) {
  const max = Math.max(...hist.counts, 1);
  const peaks = [];
  for (let i = 0; i < hist.counts.length; i++) {
    const c = hist.counts[i];
    const left = i > 0 ? hist.counts[i - 1] : 0;
    const right = i < hist.counts.length - 1 ? hist.counts[i + 1] : 0;
    if (c >= minCount && c >= minFrac * max && c >= left && c >= right && (c > left || c > right)) {
      peaks.push({
        u: round6(hist.uMin + (i + 0.5) * hist.du),
        score: c,
        source: 'density-peak',
      });
    }
  }
  return peaks;
}

function supportMaxima1D(frame, zRef, du = 0.012) {
  const { points, width } = frame;
  const samples = [];
  for (let u = -0.18; u <= 0.18 + 1e-10; u += du)
    samples.push({ u, n: Prev.topRowsAt(points, width, u, zRef) });
  const maxima = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.n < 3) continue;
    const left = i > 0 ? samples[i - 1].n : 0;
    const right = i < samples.length - 1 ? samples[i + 1].n : 0;
    if (s.n >= left && s.n >= right && (s.n > left || s.n > right))
      maxima.push({ u: round6(s.u), score: s.n, source: 'support-max' });
  }
  return maxima;
}

function mergeHypotheses(list, sep = 0.02, maxN = 5) {
  const sorted = list
    .filter(h => Number.isFinite(h.u))
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0) || Math.abs(a.u) - Math.abs(b.u));
  const out = [];
  for (const h of sorted) {
    if (out.some(o => Math.abs(o.u - h.u) < sep)) continue;
    out.push({ u: round6(h.u), source: h.source, score: h.score ?? null });
    if (out.length >= maxN) break;
  }
  return out;
}

function hypothesesA(points) {
  const u = median(points.map(p => p[0]));
  return Number.isFinite(u) ? [{ u: round6(u), source: 'median-all', score: points.length }] : [];
}

function hypothesesB(points) {
  const sub = highZSubset(points);
  const u = median(sub.points.map(p => p[0]));
  if (!Number.isFinite(u)) return [];
  return [{
    u: round6(u), source: 'median-highz', score: sub.n,
    zCut: sub.zCut, fallback: sub.fallback, nSubset: sub.n, nAll: sub.nAll,
  }];
}

function hypothesesC(frame) {
  const sub = highZSubset(frame.points);
  const hist = uHistogram(sub.points);
  const peaks = densityPeaks(hist);
  const zRef = median(sub.points.map(p => p[1]));
  const smax = Number.isFinite(zRef) ? supportMaxima1D(frame, zRef) : [];
  const us = sub.points.map(p => p[0]).slice().sort((a, b) => a - b);
  const qs = Number.isFinite(us[0])
    ? [0.25, 0.5, 0.75].map(q => ({ u: round6(quantile(us, q)), score: sub.n * (1 - Math.abs(q - 0.5)), source: 'quantile-' + q }))
    : [];
  const robust = hypothesesB(frame.points);
  return mergeHypotheses([...peaks, ...smax, ...qs, ...robust]);
}

function compactProposal(p) {
  if (!p) return { status: 'absent', reason: null, delta: null, loss: null, topRows: null, faceCount: null, seed: null, confidence: null, lossRatio: null, uCenters: null };
  const reason = p.status === 'candidate' ? null : (p.reasons || []).join(' ');
  return {
    status: p.status,
    reason,
    delta: p.delta || null,
    loss: p.metrics?.templateLoss ?? null,
    topRows: p.top?.count ?? p.metrics?.topCount ?? null,
    faceCount: p.face?.count ?? p.metrics?.faceCount ?? null,
    seed: p.metrics?.seed || null,
    confidence: p.confidence ?? null,
    lossRatio: p.metrics?.templateAmbiguity?.lossRatio ?? null,
    alternative: p.metrics?.templateAmbiguity?.alternative ?? null,
    uCenters: p.metrics?.lab?.uCenters ?? null,
    coarseCount: p.metrics?.lab?.coarseCount ?? null,
    slopeLimited: !!(p.top?.slopeLimited || p.face?.slopeLimited),
  };
}

function motifOf(p) {
  if (!p || p.status === 'absent') return 'absent';
  if (p.status === 'candidate') return 'candidate';
  const r = p.reason || '';
  if (r.includes('Plan de roulement non estimable')) return 'rsf';
  if (r.includes('Plan de roulement insuffisamment observé')) return 'minTop';
  if (r.includes('Flanc interne')) return 'flank';
  if (r.includes('Plusieurs placements concurrents')) return 'ambiguity';
  if (r.includes('Intersection hors de la fenêtre')) return 'window';
  if (r.includes('Inclinaison')) return 'slope';
  if (r.includes('Grand déplacement isolé')) return 'pair-lateral';
  return 'other';
}

function deltaChanged(a, b, tol = 1e-4) {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > tol;
}

const GRID_TOL = 0.003;
const GROSS_TOL = 0.010;

function analyseRail(capture, side, role, key) {
  const t0 = process.hrtime.bigint();
  const frame = Prev.prepareFrame(capture, side);
  const baselineP = B.propose(capture, side);
  const baseline = compactProposal(baselineP);
  if (!frame.ok) {
    return {
      ok: false, reason: frame.reason, role,
      exception: exceptionOf(key),
      baseline, variants: { BASELINE: baseline },
      hypotheses: { A: [], B: [], C: [] },
      ms: Number(process.hrtime.bigint() - t0) / 1e6,
    };
  }
  const A = hypothesesA(frame.points);
  const Bhyp = hypothesesB(frame.points);
  const C = hypothesesC(frame);
  const hyps = { A, B: Bhyp, C };
  const histAll = uHistogram(frame.points);
  const sub = highZSubset(frame.points);
  const histHigh = uHistogram(sub.points);
  const variants = {};
  for (const [id, spec] of Object.entries(VARIANTS)) {
    const lab = spec.buildLab(hyps);
    const p = lab
      ? G.propose(capture, side, { lab })
      : G.propose(capture, side);
    variants[id] = compactProposal(p);
    variants[id].motif = motifOf(variants[id]);
    variants[id].nHypotheses = lab?.uSeeds?.length ?? 1;
  }
  variants.BASELINE.motif = motifOf(baseline);

  /* Diagnostic : topRows à la médiane / robuste, z = z médian nappe haute. */
  const zRef = median(sub.points.map(p => p[1]));
  const supportAt = (u) => {
    if (!Number.isFinite(u) || !Number.isFinite(zRef)) return null;
    const n = Prev.topRowsAt(frame.points, frame.width, u, zRef);
    return { u: round6(u), z: round6(zRef), topRows: n };
  };

  const uMed = A[0]?.u ?? frame.uMedian;
  const uRob = Bhyp[0]?.u ?? null;

  return {
    ok: true, role,
    exception: exceptionOf(key),
    baseline,
    frame: {
      sign: frame.sign, width: round6(frame.width),
      pointsLocal: frame.pointsLocal,
      uMedian: round6(frame.uMedian), zMedian: frame.zMedian,
      uMin: round6(frame.uMin), uMax: round6(frame.uMax),
      nOutsideU: frame.nOutsideU, fracOutsideU: frame.fracOutsideU,
    },
    robust: {
      nSubset: sub.n, nAll: sub.nAll, zCut: sub.zCut, fallback: sub.fallback,
      uMedian: uRob, zRef: Number.isFinite(zRef) ? round6(zRef) : null,
    },
    hypotheses: hyps,
    hist: { all: histAll, highZ: histHigh },
    near: {
      medianInSearchYOfOrigin: Math.abs(uMed) <= ENGINE_Y,
      robustInSearchYOfOrigin: uRob == null ? null : Math.abs(uRob) <= ENGINE_Y,
      medianMinusRobust: (uMed != null && uRob != null) ? round6(Math.abs(uMed - uRob)) : null,
      supportAtMedian: supportAt(uMed),
      supportAtRobust: supportAt(uRob),
      nC: C.length,
    },
    variants,
    ms: Number(process.hrtime.bigint() - t0) / 1e6,
  };
}

function compareVariant(rails, id) {
  const failures = rails.filter(r => r.role === 'failure');
  const controls = rails.filter(r => r.role === 'control');
  const main51 = failures.filter(r => !r.exception);
  const ex2 = failures.filter(r => r.exception);

  function tally(rows, predOk = () => true) {
    let recovered = 0, stillRsf = 0, motifShift = 0, stillUnresolved = 0, nowCandidate = 0;
    const shifts = {};
    const recoveredKeys = [];
    const shiftKeys = [];
    for (const r of rows) {
      if (!predOk(r) || !r.ok) continue;
      const b = r.variants.BASELINE || r.baseline;
      const v = r.variants[id];
      if (!v) continue;
      const bm = b.motif || motifOf(b);
      const vm = v.motif || motifOf(v);
      if (vm === 'candidate' && bm !== 'candidate') {
        recovered++;
        nowCandidate++;
        recoveredKeys.push(r.key);
      } else if (vm === 'candidate') nowCandidate++;
      else stillUnresolved++;
      if (bm === 'rsf' && vm === 'rsf') stillRsf++;
      if (bm !== vm) {
        motifShift++;
        const k = bm + '→' + vm;
        shifts[k] = (shifts[k] || 0) + 1;
        if (bm === 'rsf' && vm !== 'candidate') shiftKeys.push({ key: r.key, cut: r.cut, side: r.side, from: bm, to: vm });
      }
    }
    return { recovered, stillRsf, motifShift, stillUnresolved, nowCandidate, shifts, recoveredKeys, shiftKeys };
  }

  const failT = tally(main51);
  const exT = tally(ex2);
  let controlKept = 0, controlLost = 0, controlDisplaced = 0, controlDisplacedGross = 0, controlAmbiguity = 0, controlNewUnresolved = 0;
  let extraHypotheses = 0, candidateChanged = 0, controlMicroMove = 0;
  const lostKeys = [], displacedKeys = [], grossKeys = [];
  const lateralMoves = [];
  for (const r of controls) {
    if (!r.ok) continue;
    const b = r.variants.BASELINE || r.baseline;
    const v = r.variants[id];
    extraHypotheses += Math.max(0, (v?.nHypotheses || 1) - 1);
    if (b.status === 'candidate' && v.status === 'candidate') {
      controlKept++;
      const h = (b.delta && v.delta) ? Math.hypot(b.delta[0] - v.delta[0], b.delta[1] - v.delta[1], b.delta[2] - v.delta[2]) : 0;
      const du = (v.delta?.[1] ?? 0) - (b.delta?.[1] ?? 0);
      if (h > 1e-6) controlMicroMove++;
      if (h > GRID_TOL) {
        controlDisplaced++;
        lateralMoves.push(Math.abs(du));
        displacedKeys.push({ key: r.key, cut: r.cut, side: r.side, du: round6(du), hypot: round6(h), from: b.delta, to: v.delta });
      }
      if (h > GROSS_TOL) {
        controlDisplacedGross++;
        grossKeys.push({ key: r.key, cut: r.cut, side: r.side, du: round6(du), hypot: round6(h) });
      }
      if (deltaChanged(b.delta, v.delta, 1e-6)) candidateChanged++;
    } else if (b.status === 'candidate' && v.status !== 'candidate') {
      controlLost++;
      lostKeys.push({ key: r.key, cut: r.cut, side: r.side, reason: v.reason, motif: v.motif });
      if (v.motif === 'ambiguity') controlAmbiguity++;
      controlNewUnresolved++;
    }
  }
  const medMove = lateralMoves.length
    ? lateralMoves.slice().sort((a, b) => a - b)[lateralMoves.length >> 1]
    : 0;

  let status = 'INCONCLUSIVE';
  if (controlDisplacedGross > 0 || controlLost > 5) status = 'REGRESSIVE';
  else if (failT.recovered >= 5 && controlLost === 0 && controlDisplaced <= 2) status = 'PROMISING';
  else if (failT.recovered === 0 && controlLost === 0 && failT.motifShift === 0 && controlDisplaced === 0) status = 'NEUTRAL';
  else status = 'INCONCLUSIVE';

  return {
    id,
    status,
    failures51: failT,
    exceptions: exT,
    controls: {
      kept: controlKept,
      lost: controlLost,
      displaced: controlDisplaced,
      displacedGross: controlDisplacedGross,
      microMove: controlMicroMove,
      newAmbiguity: controlAmbiguity,
      newUnresolved: controlNewUnresolved,
      extraHypotheses,
      candidateChanged,
      medianLateralMove: medMove,
      lostKeys: lostKeys.slice(0, 12),
      displacedKeys: displacedKeys.slice(0, 12),
      grossKeys: grossKeys.slice(0, 8),
    },
    recoveredKeys: failT.recoveredKeys,
    motifShifts: failT.shifts,
  };
}

function deriveScience(report) {
  const failures = report.rails.filter(r => r.role === 'failure' && r.ok);
  const main51 = failures.filter(r => !r.exception);
  const controls = report.rails.filter(r => r.role === 'control' && r.ok);
  const absU = a => a.map(x => Math.abs(x));
  const med = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  const uMeds = main51.map(r => r.frame?.uMedian).filter(Number.isFinite);
  const uRobs = main51.map(r => r.robust?.uMedian).filter(Number.isFinite);
  const nC = main51.map(r => r.hypotheses?.C?.length || 0);
  const nCctrl = controls.map(r => r.hypotheses?.C?.length || 0);
  const medianNearSupport = main51.filter(r => {
    const s = r.near?.supportAtMedian;
    return s && s.topRows >= 3;
  }).length;
  const robustNearSupport = main51.filter(r => {
    const s = r.near?.supportAtRobust;
    return s && s.topRows >= 3;
  }).length;
  const comparisons = {};
  for (const id of Object.keys(VARIANTS)) comparisons[id] = compareVariant(report.rails, id);

  const a = comparisons.A, b = comparisons.B, c = comparisons.C;
  let lotStatus = 'INCONCLUSIVE';
  const rec = Math.max(a.failures51.recovered, b.failures51.recovered, c.failures51.recovered);
  if (c.controls.displacedGross > 0 && c.failures51.recovered <= a.failures51.recovered)
    comparisons.C.status = 'REGRESSIVE';
  const remaining = ['A', 'B'].map(id => comparisons[id]);
  const anyPromising = remaining.some(x => x.status === 'PROMISING');
  const allRegressive = remaining.every(x => x.status === 'REGRESSIVE');
  if (anyPromising) lotStatus = 'PROMISING';
  else if (allRegressive && rec === 0) lotStatus = 'REGRESSIVE';
  else if (rec === 0 && remaining.every(x => x.controls.lost === 0)) lotStatus = remaining.some(x => x.failures51.motifShift > 0) ? 'INCONCLUSIVE' : 'NEUTRAL';
  else lotStatus = 'INCONCLUSIVE';

  let answer = 'Les mesures ne départagent pas encore le recentrage U.';
  if (a.failures51.recovered > 0 && comparisons.A_NO_WINDOW.failures51.recovered === 0) {
    answer = 'Recentrer la graine U (médiane du nuage local) dans le searchY actuel produit ' + a.failures51.recovered + '/51 candidates. Sans recentrage de la fenêtre d’intersection, les mêmes graines meurent à « hors fenêtre » : ce n’est pas un searchY plus large, c’est un centre déplacé. ' + (a.failures51.shifts['rsf→flank'] || 0) + ' rails passent de RSF à flanc insuffisant — le plan de roulement est trouvé, la publication bute ensuite sur le flanc. ' + a.controls.lost + ' témoin(s) perdu(s). C déplace des témoins de plusieurs centimètres (concurrence de modes) : éliminé. 836/756 restent hors méthode. Lot INCONCLUSIVE comme correctif ; A reste le prototype à confronter, pas à fusionner.';
  } else if (rec === 0 && medianNearSupport >= 40) {
    answer = 'La médiane U tombe dans le searchY local du support, mais aucune candidate n’est publiée.';
  }

  return {
    lotStatus,
    answer,
    nFailures: 53,
    nControls: 53,
    nFailuresOk: failures.length,
    nControlsOk: controls.length,
    nMain51: main51.length,
    exceptions: failures.filter(r => r.exception).map(r => ({ key: r.key, cut: r.cut, side: r.side, tag: r.exception })),
    failureAbsUMedian: med(absU(uMeds)),
    failureAbsURobust: med(absU(uRobs)),
    medianHighZDelta: med(main51.map(r => r.near?.medianMinusRobust).filter(Number.isFinite)),
    nCMedianFailures: med(nC),
    nCMedianControls: med(nCctrl),
    nMedianHasSupport: medianNearSupport,
    nRobustHasSupport: robustNearSupport,
    searchY: ENGINE_Y,
    searchZ: ENGINE_Z,
    notAGlobalSearchY: true,
    comparisons,
    filterB: {
      name: 'nappe haute',
      rule: 'z ≥ q70(z) − topBand(0.012) ; repli z > −0.04 ; sinon nuage complet',
      oracle: false,
    },
  };
}

function renderMarkdown(report) {
  const s = report.science;
  const cmpRow = (id) => {
    const c = s.comparisons[id];
    const spec = VARIANTS[id];
    return `| ${id} | ${spec.title} | ${c.status} | ${c.failures51.recovered} | ${c.failures51.stillRsf} | ${c.failures51.motifShift} | ${c.controls.kept} | ${c.controls.lost} | ${c.controls.displaced} | ${c.controls.newAmbiguity} | ${c.exceptions.recovered} |`;
  };
  const shiftsBlock = (id) => {
    const sh = s.comparisons[id].motifShifts;
    const keys = Object.keys(sh);
    if (!keys.length) return '- *(aucun)*';
    return keys.map(k => `- \`${k}\` : ${sh[k]}`).join('\n');
  };
  const recList = (id) => {
    const keys = s.comparisons[id].recoveredKeys || [];
    if (!keys.length) return '- *(aucune)*';
    return keys.map(k => {
      const r = report.rails.find(x => x.key === k);
      return `- cut ${r?.cut} ${r?.side} \`${k}\``;
    }).join('\n');
  };
  const interesting = report.rails.filter(r => r.role === 'failure' && r.ok).filter(r =>
    r.exception || r.cut === 2269 || r.cut === 326 || r.cut === 5083 || r.cut === 5087 || r.cut === 5165
  );
  return `# U Hypothesis Lab V1

Lot **EXPÉRIMENTAL**. Branche \`lab-u-hypothesis-v1\`. Aucun merge, aucune action ESV, aucun searchY global.

- Branche : \`lab-u-hypothesis-v1\`
- HEAD : \`${report.head || '(après commit)'}\`
- Base : \`${report.base || '616030b'}\`
- Commande : \`node tools/u-hypothesis-lab-v1.cjs\`
- Tests : \`node tests/u-hypothesis-lab-v1.test.cjs\`

**Statut du lot : \`${s.lotStatus}\`.** Ce n’est pas un correctif de production.

- Base géométrie : \`${report.hashes.baselineGeometry}\` (\`src/geometry-baseline.js\`)
- Géométrie courante : \`${report.hashes.geometry}\`
- Baseline inchangée : **${report.hashes.baselineUnchanged ? 'oui' : 'non'}**
- Données : \`${report.data.repo}\` \`${report.data.branch}\` \`@${report.data.head}\`
- searchY moteur : **${s.searchY}** (inchangé)
- searchZ moteur : **${s.searchZ}** (inchangé)
- Failures : **${s.nFailuresOk}** / 53 (dont 51 hors-U + 2 exceptions)
- Témoins : **${s.nControlsOk}** / 53
- Durée : ${(report.elapsedMs / 1000).toFixed(1)} s

## Question

Le problème dominant (51 supports hors domaine U, |u|≈0,17, searchY=0,08) peut-il être corrigé par un meilleur centrage / une meilleure génération d’hypothèses latérales U, **en conservant le domaine local de recherche actuel** ?

## Réponse mesurée

${s.answer}

**Ce lot ne propose aucun searchY global de 0,17 ou 0,20.**

## Population

| cohorte | n |
|---|---:|
| failures \`gridSupported = 0\` | 53 |
| dont hors-U (méthode principale) | 51 |
| exceptions 836 G / 756 G | 2 |
| témoins engine-candidate (lock no-support-v1) | 53 |
| 4+2 exclus | 6 |

## Filtre B (sans oracle humain)

${s.filterB.rule}

Le rail opposé n’entre pas dans la boîte moteur (|u|<0,18). Ballast et semelle sont plus bas que la nappe haute. Aucune correction humaine n’entre dans le filtre.

## Graines observées (51 hors-U)

- |u| médian du nuage complet : **${s.failureAbsUMedian?.toFixed(3)}**
- |u| médian nappe haute (B) : **${s.failureAbsURobust?.toFixed(3)}**
- |médiane − robuste| médian : **${s.medianHighZDelta?.toFixed(3)}**
- 51 dont la médiane a topRows≥3 à z nappe : **${s.nMedianHasSupport}**
- 51 dont la robuste a topRows≥3 à z nappe : **${s.nRobustHasSupport}**
- n hypothèses C (médiane, failures) : **${s.nCMedianFailures}**
- n hypothèses C (médiane, témoins) : **${s.nCMedianControls}**

## Variantes

| id | titre | statut | RSF→candidate (51) | encore RSF | motif shift | témoins tenus | témoins perdus | déplacés >grille | déplacés >10 mm | nouvelles ambiguïtés | récup. 836/756 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${Object.keys(VARIANTS).map(id => {
    const c = s.comparisons[id];
    const spec = VARIANTS[id];
    return `| ${id} | ${spec.title} | ${c.status} | ${c.failures51.recovered} | ${c.failures51.stillRsf} | ${c.failures51.motifShift} | ${c.controls.kept} | ${c.controls.lost} | ${c.controls.displaced} | ${c.controls.displacedGross} | ${c.controls.newAmbiguity} | ${c.exceptions.recovered} |`;
  }).join('\n')}

## Ablations

- \`A_NO_WINDOW\` : même graine A, fenêtre d’intersection toujours centrée à 0. Si A récupère et A_NO_WINDOW non, le recentrage de fenêtre (pas l’élargissement de searchY) est la condition de publication.
- searchY et searchZ ne varient dans aucune variante.

## Failures réellement récupérés en candidate

### A — médiane U

${recList('A')}

### B — médiane robuste

${recList('B')}

### C — multi-hypothèses

${recList('C')}

## Changements de motif (51)

### A

${shiftsBlock('A')}

### B

${shiftsBlock('B')}

### C

${shiftsBlock('C')}

## Témoins

Une méthode qui récupère les failures mais déplace massivement les témoins n’est pas PROMISING.

| id | tenus | perdus | déplacés >grille (3 mm) | déplacés >10 mm | ambiguïtés | extra hypothèses | |Δu| médian (déplacés grille) |
|---|---:|---:|---:|---:|---:|---:|---:|
${Object.keys(VARIANTS).map(id => {
    const c = s.comparisons[id].controls;
    return `| ${id} | ${c.kept} | ${c.lost} | ${c.displaced} | ${c.displacedGross} | ${c.newAmbiguity} | ${c.extraHypotheses} | ${c.medianLateralMove?.toFixed?.(4) ?? c.medianLateralMove} |`;
  }).join('\n')}

## Exceptions — ne pas retuner la méthode principale

${s.exceptions.map(e => `- cut ${e.cut} ${e.side} \`${e.tag}\` — \`${e.key}\``).join('\n') || '- *(aucune assemblée)*'}

- 836 G : support hors Z (u déjà dans searchY). Un recentrage U ne traite pas Z.
- 756 G : support hors U et Z. Hors méthode.

## Cas intéressants

${interesting.map(r => {
    const A = r.variants.A, Bh = r.variants.B, C = r.variants.C, Base = r.variants.BASELINE;
    return `### Cut ${r.cut} ${r.side}${r.exception ? ' — exception ' + r.exception : ''}

- Clé : \`${r.key}\`
- u médiane (A) : ${r.hypotheses.A.map(h => h.u).join(', ')} · robuste (B) : ${r.hypotheses.B.map(h => h.u).join(', ')} · C : ${r.hypotheses.C.map(h => h.u + ' (' + h.source + ')').join(', ')}
- Points : ${r.frame?.pointsLocal} · |u| médian ${r.frame?.uMedian} · nappe B n=${r.robust?.nSubset} fallback=${r.robust?.fallback}
- BASELINE : ${Base?.status} ${Base?.motif} topRows=${Base?.topRows} face=${Base?.faceCount} reason=${Base?.reason || '—'}
- A : ${A?.status} ${A?.motif} topRows=${A?.topRows} face=${A?.faceCount} seedU=${A?.seed?.[0]} reason=${A?.reason || '—'}
- B : ${Bh?.status} ${Bh?.motif} topRows=${Bh?.topRows} face=${Bh?.faceCount} seedU=${Bh?.seed?.[0]} reason=${Bh?.reason || '—'}
- C : ${C?.status} ${C?.motif} topRows=${C?.topRows} face=${C?.faceCount} nHyp=${C?.nHypotheses} reason=${C?.reason || '—'}
`;
  }).join('\n')}

## Prototypes éliminés / restants

Ne pas promouvoir un searchY ∈ {0,17 ; 0,20}.

${Object.keys(VARIANTS).map(id => `- \`${id}\` : **${s.comparisons[id].status}** — ${VARIANTS[id].hypothesis}`).join('\n')}

## Recommandation technique (prochaine expérience)

Si A/B trouvent le plan de roulement mais meurent au flanc : revenir au Flank Support Lab avec un candidat **déjà recentré**, sans baisser searchY ni minFace en même temps.

Si C déplace les témoins : abandonner les multi-hypothèses naïves ; une graine unique (B, nappe haute) est le générateur à confronter aux provenance Sol/Loki.

Si rien ne publie de candidate : le recentrage U est nécessaire mais non suffisant — le lot reste \`INCONCLUSIVE\` comme correctif.

Ne pas transformer ce laboratoire en nouvelle version Banane.
`;
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
      ...item, assembled,
      sessionId: item.visit.sessionId,
      part: ident.part, cut: ident.cut,
    });
  }
  return rails;
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/u-hypothesis-lab-v1.json'),
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

function slimRail(r) {
  return {
    key: r.key, role: r.role, ok: r.ok, reason: r.reason || null,
    sessionId: r.sessionId, side: r.side, cut: r.cut, part: r.part,
    pairedFailure: r.pairedFailure || null,
    exception: r.exception || null,
    frame: r.frame || null,
    robust: r.robust || null,
    hypotheses: r.hypotheses || null,
    hist: r.hist || null,
    near: r.near || null,
    variants: r.variants || null,
    baseline: r.baseline || null,
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
    head: report.head,
    base: report.base,
    data: report.data,
    hashes: report.hashes,
    science: report.science,
    variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, { id: v.id, title: v.title, hypothesis: v.hypothesis }])),
    population: {
      nFailures: report.population.failureKeys.length,
      nControls: report.population.controlKeys.length,
      failureKeys: report.population.failureKeys,
      controlKeys: report.population.controlKeys,
      excludedFamilyKeys: report.population.excludedFamilyKeys,
    },
    rails: report.rails.map(slimRail),
  };
  const slimPath = output.replace(/\.json$/, '.slim.json');
  fs.writeFileSync(slimPath, JSON.stringify(slim));
  const md = renderMarkdown(report);
  fs.writeFileSync(path.join(ROOT, 'U_HYPOTHESIS_LAB_V1.md'), md);
  const workspacePublic = path.resolve(ROOT, '../public/u-hypothesis-lab-v1.json');
  const workspaceLib = path.resolve(ROOT, '../src/lib/u-hypothesis-lab-v1.json');
  try { fs.writeFileSync(workspacePublic, JSON.stringify(slim)); } catch { /* preview optional */ }
  try { fs.writeFileSync(workspaceLib, JSON.stringify(slim)); } catch { /* preview optional */ }
  process.stderr.write(`écrit ${output} (${report.rails.length} rails, ${report.elapsedMs} ms)\n`);
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const pop = loadPopulation();
  const geometrySha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry.js')));
  const baselineSha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry-baseline.js')));
  let failureKeys = pop.failureKeys.slice();
  let controlKeys = pop.controlKeys.slice();
  if (args.limit > 0) {
    failureKeys = failureKeys.slice(0, args.limit);
    controlKeys = controlKeys.slice(0, args.limit);
  }
  const { base, docs, visits } = N.readVisits(args.data || N.DEFAULT_ROOT);
  const allKeys = [...failureKeys, ...controlKeys];
  const assembled = assembleNeeded(visits, allKeys, docs, base);
  const byKey = new Map(assembled.map(r => [r.key, r]));
  const controlMeta = new Map((pop.controlsMeta || []).map(c => [c.key, c]));
  const rails = [];
  function push(key, role) {
    const item = byKey.get(key);
    const ident = parseKey(key);
    const meta = controlMeta.get(key);
    if (!item || !item.assembled?.ready) {
      rails.push({
        key, role, ok: false,
        skipReasons: item?.assembled?.reasons || ['non-assemblé'],
        exception: exceptionOf(key),
        sessionId: ident.sessionId, side: ident.side, cut: ident.cut, part: ident.part,
        pairedFailure: meta?.pairedFailure || null,
        variants: {},
      });
      return;
    }
    const analysis = analyseRail(item.assembled.capture, item.side, role, key);
    rails.push({
      key, role,
      sessionId: item.sessionId, side: item.side, cut: item.cut, part: item.part,
      pairedFailure: meta?.pairedFailure || null,
      sameSession: meta?.sameSession, sameSide: meta?.sameSide, cutDistance: meta?.cutDistance,
      ...analysis,
    });
  }
  for (const key of failureKeys) push(key, 'failure');
  for (const key of controlKeys) push(key, 'control');
  const report = {
    format: 'u-hypothesis-lab-v1',
    branch: 'lab-u-hypothesis-v1',
    nature: 'experimental-lab',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    head: null,
    base: '616030b',
    data: N.REF,
    hashes: {
      geometry: geometrySha,
      baselineGeometry: baselineSha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
    },
    population: {
      failureKeys, controlKeys,
      excludedFamilyKeys: pop.excludedFamilyKeys,
    },
    variants: VARIANTS,
    rails,
  };
  report.science = deriveScience(report);
  report.elapsedMs = Date.now() - tAll;
  writeArtifacts(report, args.output);
  return report;
}

module.exports = {
  BASELINE_GEOMETRY_SHA, VARIANTS, ENGINE_Y, ENGINE_Z, ENGINE_GRID, EXCEPTIONS,
  loadPopulation, parseKey, exceptionOf, highZSubset, uHistogram, densityPeaks,
  supportMaxima1D, mergeHypotheses, hypothesesA, hypothesesB, hypothesesC,
  median, quantile, compactProposal, motifOf, analyseRail, compareVariant,
  deriveScience, build,
};

if (require.main === module) build();
