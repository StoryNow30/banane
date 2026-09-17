#!/usr/bin/env node
'use strict';
/* Qualification finale NEXT V0 — lecture seule.
 * Ne modifie pas A_STAR, S1, searchY/Z, minFace, minTop, ratio.
 * Aucun retuning. Aucun Pair Arbitration. Aucun merge. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const N = require('./materialized-native.cjs');
const U = require('./u-hypothesis-lab-v1.cjs');
const FAA = require('./face-aware-arbitration-v1.cjs');
const CSA = require('./competitive-support-arbitration-v1.cjs');
const Next = require('./geometry-engine-next-v0.cjs');
const Prev = require('./no-support-generator-lab-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const FROZEN_PATH = path.join(ROOT, 'audit/geometry-engine-next-v0.json');
const GRID_TOL = 0.003;
const GROSS_TOL = 0.010;
const RATIO = G.DEFAULTS.minTemplateLossRatio;
const KEY_5146 = 'd9ccb545-25db-4262-b383-794ab3272ec7|78b8f581-337d-4ae0-8404-223074a0ed00|1|5146|right';
const KEY_154 = '0c58c033-f2e7-4aa5-ad8c-80b081a83932|0ee8e953-5a50-47f1-ad6f-e187dd380029|2|154|left';
const KEY_5088 = '3876864f-a864-4678-b7b0-3feecc4af418|5718fbfe-c435-4589-86be-5b1b647c9b9f|1|5088|right';
const KEY_2894 = '06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|fbb902d4-c847-4327-9565-ea6a1acd0361|1|2894|left';
const KEY_9644 = FAA.KEY_9644;
const S1_KEYS = Object.freeze([KEY_5088, KEY_5146, KEY_9644, KEY_2894]);

function round6(x) { return Math.round(Number(x) * 1e6) / 1e6; }

function hypotDelta(a, b) { return Next.hypotDelta(a, b); }

function qualifyOracle(status, human) {
  if (!human || !Array.isArray(human)) {
    if (status === 'candidate-timing-uncertain') return 'AMBIGUOUS';
    return 'UNAVAILABLE';
  }
  if (status === 'candidate-observed') return 'QUALIFIED';
  if (status === 'candidate-timing-uncertain') return 'AMBIGUOUS';
  return 'UNAVAILABLE';
}

function vsHuman(hypotNext, hypotV46, oracle) {
  if (oracle === 'AMBIGUOUS') return 'ORACLE_AMBIGUOUS';
  if (oracle === 'UNAVAILABLE' || hypotNext == null) return 'ORACLE_UNAVAILABLE';
  if (hypotV46 == null) return 'IMPROVED';
  if (hypotNext < hypotV46 - 1e-9) return 'IMPROVED';
  if (hypotNext > hypotV46 + 1e-9) return 'REGRESSED';
  return 'EQUIVALENT';
}

function vsHumanGrid(hypotNext, hypotV46, oracle) {
  if (oracle !== 'QUALIFIED' || hypotNext == null || hypotV46 == null) return vsHuman(hypotNext, hypotV46, oracle);
  const d = hypotNext - hypotV46;
  if (Math.abs(d) <= GRID_TOL) return 'EQUIVALENT';
  return d < 0 ? 'IMPROVED' : 'REGRESSED';
}

function bandOf(h) {
  if (h == null || !Number.isFinite(h)) return null;
  if (h <= 0.010) return 'le10';
  if (h <= 0.020) return 'b10_20';
  if (h <= 0.050) return 'b20_50';
  return 'gt50';
}

function emptyBands() { return { le10: 0, b10_20: 0, b20_50: 0, gt50: 0, n: 0, median: null }; }

function fillBands(hs) {
  const out = emptyBands();
  const finite = hs.filter(x => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  out.n = finite.length;
  for (const h of finite) out[bandOf(h)]++;
  if (finite.length) {
    const m = finite.length >> 1;
    out.median = finite.length % 2 ? finite[m] : round6((finite[m - 1] + finite[m]) / 2);
  }
  return out;
}

function inspectAt(frame, u, z, uCenters, knownLoss) {
  const cfg = G.DEFAULTS;
  const { points, width } = frame;
  const topPts = [];
  for (const p of points) {
    if (p[0] > u + 0.012 && p[0] < u + width - 0.012 && Math.abs(p[1] - z) < cfg.topBand)
      topPts.push([p[0], p[1]]);
  }
  const top = G.robustLine(topPts);
  const ch = FAA.characterize(frame, u, z, uCenters, knownLoss);
  let face = null;
  if (top) {
    const facePts = [];
    for (const p of points) {
      const drop = top.slope * p[0] + top.intercept - p[1];
      if (drop > 0.009 && drop < 0.034 && Math.abs(p[0] - u) < cfg.faceBand) facePts.push([p[1], p[0]]);
    }
    face = G.robustLine(facePts);
  }
  const strong = FAA.qualifyStrong({
    topRows: ch.topRows, faceCount: ch.faceCount,
    slopeLimited: ch.slopeLimited, windowOk: ch.windowOk,
  });
  return {
    u: round6(u), z: round6(z), loss: knownLoss ?? ch.loss ?? null,
    topRows: ch.topRows, faceCount: ch.faceCount,
    topSlope: top ? top.slope : null,
    topRawSlope: top ? top.rawSlope : null,
    topSlopeLimited: !!(top && top.slopeLimited),
    topResidual: top ? top.residual : null,
    faceSlope: face ? face.slope : null,
    faceRawSlope: face ? face.rawSlope : null,
    faceSlopeLimited: !!(face && face.slopeLimited),
    faceResidual: face ? face.residual : null,
    slopeLimited: !!ch.slopeLimited,
    windowOk: !!ch.windowOk,
    motif: ch.motif, tier: ch.tier,
    strong,
  };
}

function cellLocal(seed, sign) {
  if (!seed) return null;
  return { u: round6(sign * seed[0]), z: round6(seed[1]) };
}

function deepRail(item, row) {
  if (!item?.assembled?.ready) return { key: row.key, ok: false };
  const capture = item.assembled.capture;
  const side = item.side;
  const raw = CSA.analyseRail(capture, side, row.role, item.key);
  CSA.applyPolicies(raw);
  if (!raw.ok) return { key: row.key, ok: false, reason: raw.reason };
  const frame = Prev.prepareFrame(capture, side);
  const uCenters = raw.astar?.uCenters || [0];
  const lmin = raw.competitive?.lmin;
  const inspectSeed = (seed, loss) => {
    const loc = cellLocal(seed, frame.sign);
    if (!loc) return null;
    return inspectAt(frame, loc.u, loc.z, uCenters, loss);
  };
  const v46 = inspectSeed(raw.engine?.seed, raw.engine?.loss);
  const astar = inspectSeed(raw.astar?.seed, raw.astar?.loss);
  const pick = raw.policies?.S1?.pick;
  const next = pick ? inspectAt(frame, pick.u, pick.z, uCenters, pick.loss) : null;
  const competitive = (raw.competitive?.competitive || raw.pool || []).filter(c => CSA.inCompetitive(c, lmin));
  const competitiveInspect = competitive.slice(0, 16).map(c => {
    const ins = inspectAt(frame, c.u, c.z, uCenters, c.loss);
    return {
      ...ins,
      ratio: (lmin > 0 && Number.isFinite(c.loss)) ? c.loss / lmin : null,
      tags: c.tags || [],
    };
  });
  const strongComp = competitiveInspect.filter(c => c.strong);
  return {
    key: row.key, ok: true, cut: row.cut, side: row.side, role: row.role,
    sign: frame.sign, lmin, ratioLimit: RATIO,
    nPool: raw.poolMeta?.nKept ?? (raw.pool || []).length,
    nCompetitive: raw.competitive?.nCompetitive,
    nStrongCompetitive: raw.competitive?.nStrongCompetitive,
    nClusters: raw.competitive?.nClusters,
    alreadyQualified: !!raw.alreadyQualified,
    s1Activated: !!raw.policies?.S1?.activated,
    s1Changed: !!raw.policies?.S1?.changed,
    s1Note: raw.policies?.S1?.note || null,
    v46, astar, next,
    engineStatus: raw.engine?.status, engineMotif: raw.engine?.motif, engineReason: raw.engine?.reason,
    astarStatus: raw.astar?.status, astarMotif: raw.astar?.motif, astarReason: raw.astar?.reason,
    nextStatus: raw.policies?.S1?.status, nextMotif: raw.policies?.S1?.motif,
    competitive: competitiveInspect,
    strongCompetitive: strongComp,
  };
}

function classify5146(deep) {
  if (!deep || !deep.ok) return { kind: 'INCONCLUSIVE', reason: 'rail 5146 non analysé' };
  const n = deep.next;
  const bypass = [];
  if (!n) bypass.push('aucun pick NEXT');
  else {
    if ((n.topRows || 0) < G.DEFAULTS.minTop) bypass.push('topRows < minTop');
    if ((n.faceCount || 0) < G.DEFAULTS.minFace) bypass.push('faceCount < minFace');
    if (n.slopeLimited) bypass.push('slopeLimited');
    if (n.motif && n.motif !== 'candidate') bypass.push('motif ' + n.motif);
    if (!n.windowOk) bypass.push('hors fenêtre');
    if (deep.lmin > 0 && n.loss != null && n.loss / deep.lmin > RATIO + 1e-12) bypass.push('hors competitive set');
  }
  if (bypass.length) {
    return {
      kind: 'CONTRACT_BYPASS',
      reason: bypass.join(' ; '),
      astarSlopeLimited: !!(deep.astar && deep.astar.slopeLimited),
      nextSlopeLimited: !!(n && n.slopeLimited),
    };
  }
  return {
    kind: 'VALID_ALTERNATIVE',
    reason: 'S1 choisit une géométrie STRONG compétitive, minTop/minFace tenus, pente non limitée.',
    astarSlopeLimited: !!(deep.astar && deep.astar.slopeLimited),
    nextSlopeLimited: false,
    distinctFromAstar: !!(deep.astar && n && (Math.hypot(n.u - deep.astar.u, n.z - deep.astar.z) > 1e-6)),
  };
}

function parityAgainstFrozen(current, frozen) {
  const byK = new Map(frozen.rails.map(r => [r.key, r]));
  const mismatches = [];
  const lockCurrent = current.filter(r => r.role !== 'known-bad-extra');
  if (lockCurrent.length !== 239) {
    mismatches.push({ kind: 'count', got: lockCurrent.length, exp: 239 });
  }
  for (const r of lockCurrent) {
    const e = byK.get(r.key);
    if (!e) { mismatches.push({ key: r.key, kind: 'missing-frozen' }); continue; }
    const fields = [
      ['ok', r.ok, e.ok],
      ['engine.status', r.engine?.status, e.engine?.status],
      ['astar.status', r.astar?.status, e.astar?.status],
      ['astar.motif', r.astar?.motif, e.astar?.motif],
      ['next.status', r.next?.status, e.next?.status],
      ['next.motif', r.next?.motif, e.next?.motif],
      ['s1Changed', !!r.s1Changed, !!e.s1Changed],
      ['s1Activated', !!r.s1Activated, !!e.s1Activated],
      ['classV46Next', r.classV46Next, e.classV46Next],
      ['alreadyQualified', !!r.alreadyQualified, !!e.alreadyQualified],
    ];
    for (const [name, a, b] of fields) {
      if (a !== b) mismatches.push({ key: r.key, cut: r.cut, side: r.side, kind: name, got: a, exp: b });
    }
    const hN = hypotDelta(r.next?.delta, e.next?.delta);
    const hA = hypotDelta(r.astar?.delta, e.astar?.delta);
    const hE = hypotDelta(r.engine?.delta, e.engine?.delta);
    if (hN > 1e-9) mismatches.push({ key: r.key, kind: 'next.delta', hypot: round6(hN) });
    if (hA > 1e-9) mismatches.push({ key: r.key, kind: 'astar.delta', hypot: round6(hA) });
    if (hE > 1e-9) mismatches.push({ key: r.key, kind: 'engine.delta', hypot: round6(hE) });
  }
  const s1Got = lockCurrent.filter(r => r.s1Changed).map(r => r.key).sort();
  const s1Exp = frozen.rails.filter(r => r.role !== 'known-bad-extra' && r.s1Changed).map(r => r.key).sort();
  if (s1Got.join('|') !== s1Exp.join('|')) {
    mismatches.push({ kind: 's1ChangedKeys', got: s1Got, exp: s1Exp });
  }
  return {
    n: lockCurrent.length,
    nMismatch: mismatches.length,
    pass: mismatches.length === 0,
    mismatches: mismatches.slice(0, 24),
  };
}

function classifyKnownBad(row) {
  const oracle = qualifyOracle(row.humanStatus, row.human);
  const v46C = row.engine?.status === 'candidate';
  const nC = row.next?.status === 'candidate';
  const hV = row.hypotV46Human, hN = row.hypotNextHuman;
  const same = (row.classV46Next === 'UNCHANGED_GOOD' || row.classV46Next === 'UNCHANGED_UNRESOLVED');
  let label = 'ORACLE_INSUFFICIENT';
  if (oracle !== 'QUALIFIED') {
    if (!nC && !v46C) label = 'ABSTENTION';
    else label = 'ORACLE_INSUFFICIENT';
  } else if (!nC) {
    label = 'ABSTENTION';
  } else if (same && hN != null && hN <= GROSS_TOL) {
    label = 'UNCHANGED_CORRECT';
  } else if (same && hN != null && hN > GROSS_TOL) {
    label = 'UNCHANGED_WRONG';
  } else if (!v46C && nC && hN != null && hN <= GROSS_TOL) {
    label = 'CORRECTED';
  } else if (v46C && nC) {
    if (hV != null && hN != null && hN < hV - GRID_TOL) label = 'CORRECTED';
    else if (hV != null && hN != null && hN > hV + GRID_TOL) label = 'WORSENED';
    else if (hN != null && hN <= GROSS_TOL) label = 'UNCHANGED_CORRECT';
    else label = 'UNCHANGED_WRONG';
  }
  return {
    key: row.key, cut: row.cut, side: row.side, visitIndex: row.visitIndex,
    role: row.role, primary: row.visitIndex === 102 || row.visitIndex === 103 || row.visitIndex === 105,
    v46: row.engine && { status: row.engine.status, motif: row.engine.motif, delta: row.engine.delta, face: row.engine.faceCount, top: row.engine.topRows },
    next: row.next && { status: row.next.status, motif: row.next.motif, delta: row.next.delta, face: row.next.faceCount, top: row.next.topRows },
    astar: row.astar && { status: row.astar.status, motif: row.astar.motif, delta: row.astar.delta },
    nStrongCompetitive: row.competitive?.nStrongCompetitive ?? null,
    oracle, hypotV46Human: hV, hypotNextHuman: hN, label,
  };
}

function deriveVerdict(q) {
  const reasons = [];
  const blockers = [];
  if (!q.parity.pass) { blockers.push('parité 239/239 échouée'); }
  if (q.audit5146?.kind === 'CONTRACT_BYPASS') blockers.push('5146 CONTRACT_BYPASS');
  if ((q.publishedWeak || 0) > 0) blockers.push('PARTIAL/WEAK publié');
  if ((q.displacedAlreadyStrong || 0) > 0) blockers.push('déjà-STRONG déplacé');
  if ((q.s1Far || 0) > 0) blockers.push('S1 far');
  const kbWorse = (q.knownBad?.items || []).filter(i => i.label === 'WORSENED');
  if (kbWorse.length) blockers.push('102/103/105 WORSENED ×' + kbWorse.length);
  const recFar = (q.recoveries?.items || []).filter(i => i.hypotNextHuman != null && i.hypotNextHuman > 0.050);
  const recOk = (q.recoveries?.bands || {}).le10;
  const recN = q.recoveries?.n || 0;
  const recMajor = recN > 0 && recOk >= recN * 0.5 && recFar.length === 0;
  if (!recMajor) reasons.push('recoveries post-hoc non majoritairement ≤ 0.010');
  const c154 = q.audit154;
  const grave154 = !!(c154 && c154.oracle === 'QUALIFIED' && c154.grid === 'REGRESSED' && (c154.hypotNextHuman || 0) > 0.020);
  if (grave154) blockers.push('154 régression grave vs humain');
  if (c154 && c154.s1Activated) reasons.push('154 : S1 aurait dû rester inactif');
  if (!q.s1Conservative) reasons.push('S1 non conservateur');
  if (q.holdoutNote && /pas un holdout aveugle/i.test(q.holdoutNote)) reasons.push('pas de vrai holdout');

  let verdict = 'INCONCLUSIVE';
  if (blockers.length) {
    verdict = blockers.some(b => /parité|BYPASS|WEAK|WORSENED|déjà-STRONG|far/.test(b))
      ? (q.audit5146?.kind === 'CONTRACT_BYPASS' ? 'KEEP_IN_LAB' : 'REGRESSIVE')
      : 'KEEP_IN_LAB';
    if (q.audit5146?.kind === 'CONTRACT_BYPASS') verdict = 'KEEP_IN_LAB';
    if (!q.parity.pass) verdict = 'INCONCLUSIVE';
  } else if (q.parity.pass && q.audit5146?.kind === 'VALID_ALTERNATIVE' && !grave154 && recMajor && q.s1Conservative) {
    if (c154 && c154.oracle === 'QUALIFIED' && c154.grid !== 'REGRESSED' && kbWorse.length === 0) {
      verdict = 'PROMOTE_TO_GEOMETRY_CANDIDATE_V1';
    } else {
      verdict = 'KEEP_IN_LAB';
    }
  } else {
    verdict = 'KEEP_IN_LAB';
  }
  return { verdict, blockers, reasons };
}

function slimDeep(d) {
  if (!d || !d.ok) return d;
  return {
    key: d.key, cut: d.cut, side: d.side, role: d.role, ok: true,
    lmin: d.lmin, nCompetitive: d.nCompetitive, nStrongCompetitive: d.nStrongCompetitive, nClusters: d.nClusters,
    alreadyQualified: d.alreadyQualified, s1Activated: d.s1Activated, s1Changed: d.s1Changed, s1Note: d.s1Note,
    engineStatus: d.engineStatus, engineMotif: d.engineMotif, astarStatus: d.astarStatus, astarMotif: d.astarMotif,
    nextStatus: d.nextStatus, nextMotif: d.nextMotif,
    v46: d.v46, astar: d.astar, next: d.next,
    strongCompetitive: d.strongCompetitive, competitive: (d.competitive || []).slice(0, 8),
  };
}

function renderMarkdown(q) {
  const v = q.verdict;
  const a = q.audit5146 || {};
  const c = q.audit154 || {};
  const rec = q.recoveries || {};
  const ctrl = q.modifiedControls || {};
  const kb = q.knownBad || {};
  const s1 = q.s1Four || {};
  const p = q.parity || {};
  const recLines = (rec.items || []).map(i =>
    `| ${i.cut} | ${i.side} | ${i.exposure === 'DEVELOPMENT_EXPOSED' ? 'oui' : 'non'} | ${i.mechanism} | ${i.v46Reason || '—'} | ${i.next?.u ?? '—'} | ${i.next?.z ?? '—'} | ${i.hypotNextHuman ?? '—'} | ${i.oracle} | ${i.slopeLimited} |`
  ).join('\n');
  const ctrlLines = (ctrl.items || []).map(i =>
    `| ${i.cut} | ${i.side} | ${i.hypotNextV46} | ΔU ${i.du ?? '—'} | ΔZ ${i.dz ?? '—'} | ${i.responsible} | ${i.hypotV46Human ?? '—'} | ${i.hypotNextHuman ?? '—'} | ${i.verdict} |`
  ).join('\n');
  const kbLines = (kb.items || []).map(i =>
    `| ${i.visitIndex} | ${i.cut} | ${i.side} | ${i.v46?.status} | ${i.next?.status} | ${i.hypotV46Human ?? '—'} | ${i.hypotNextHuman ?? '—'} | ${i.label} |`
  ).join('\n');
  const s1Lines = (s1.items || []).map(i =>
    `### ${i.cut} ${i.side}\n\n- rôle : ${i.role}\n- A_STAR : ${i.astarMotif} (slopeLimited=${i.astarSlopeLimited})\n- S1 : ${i.s1Note}\n- NEXT : status=${i.nextStatus} face=${i.next?.faceCount} top=${i.next?.topRows} slopeLimited=${i.next?.slopeLimited} slope=${i.next?.topSlope}\n- oracle : ${i.oracle} NEXT↔humain=${i.hypotNextHuman ?? '—'} V4.6↔humain=${i.hypotV46Human ?? '—'}\n- verdict post-hoc : ${i.postHoc}\n`
  ).join('\n');
  return `# Geometry Engine Next V0 — Qualification

Lot **EXPÉRIMENTAL**. Branche \`lab-geometry-engine-next-v0-qualification\`. Aucun merge. Moteur inchangé.

- HEAD : \`${q.head || '(après commit)'}\`
- Base : \`0f6846f\` (lab NEXT V0 \`9e40ad2\`)
- Commande : \`node tools/geometry-engine-next-v0-qualification.cjs\`
- Tests : \`node tests/geometry-engine-next-v0-qualification.test.cjs\`

**Verdict : \`${v.verdict}\`.**

${v.blockers.length ? '- Bloqueurs : ' + v.blockers.join(' ; ') : '- Aucun bloqueur dur.'}
${v.reasons.length ? '- Limites : ' + v.reasons.join(' ; ') : ''}

## Parité

| | |
|---|---|
| 239/239 | **${p.n === 239 && p.pass ? 'oui' : 'non'}** |
| mismatches | **${p.nMismatch}** |
| S1 keys | ${(q.s1ChangedKeys || []).map(k => k.split('|')[3]).join(', ')} |
| hashes A_STAR / composition | \`${q.hashes?.aStar}\` / \`${q.hashes?.composition}\` |
| baseline inchangée | **${q.hashes?.baselineUnchanged ? 'oui' : 'non'}** |

Aucune qualification n’est lue si la parité échoue.

## 5146 — contrat pente

**${a.kind}.** ${a.reason || ''}

- A_STAR slopeLimited : **${a.astarSlopeLimited}**
- NEXT slopeLimited : **${a.nextSlopeLimited}**
- distinct de A_STAR : **${a.distinctFromAstar}**

S1 n’a pas été modifié. Si CONTRACT_BYPASS : KEEP_IN_LAB, pas de correctif ici.

## Cut 154 gauche

S1 activé : **${c.s1Activated}** (attendu false). Déjà STRONG : **${c.alreadyQualified}**.

| | V4.6 | A_STAR / NEXT |
|---|---|---|
| u | ${c.v46?.u} | ${c.next?.u} |
| z | ${c.v46?.z} | ${c.next?.z} |
| loss | ${c.v46?.loss} | ${c.next?.loss} |
| top / face | ${c.v46?.topRows} / ${c.v46?.faceCount} | ${c.next?.topRows} / ${c.next?.faceCount} |
| slopeLimited | ${c.v46?.slopeLimited} | ${c.next?.slopeLimited} |
| residual top | ${c.v46?.topResidual} | ${c.next?.topResidual} |

- hypot V4.6 ↔ NEXT : **${c.hypotNextV46}**
- oracle : **${c.oracle}**
- hypot V4.6 ↔ humain : **${c.hypotV46Human}**
- hypot NEXT ↔ humain : **${c.hypotNextHuman}**
- verdict brut : **${c.raw}** · au pas de grille 3 mm : **${c.grid}**

Aucun seuil nouveau n’est dérivé de 154.

## 25 recoveries

n = **${rec.n}**. Mécanisme A_STAR=${rec.byMechanism?.A_STAR || 0} S1=${rec.byMechanism?.S1 || 0}.
Exposed ${rec.exposed || 0} / non-exposed ${rec.hold || 0}.

Distribution NEXT ↔ humain (unités de scène) :

| ≤0.010 | 0.010–0.020 | 0.020–0.050 | >0.050 | médiane |
|---:|---:|---:|---:|---:|
| ${rec.bands?.le10} | ${rec.bands?.b10_20} | ${rec.bands?.b20_50} | ${rec.bands?.gt50} | ${rec.bands?.median} |

| cut | side | exposé | mécanisme | V4.6 | u | z | NEXT↔humain | oracle | slopeLimited |
|---|---|---|---|---|---:|---:|---:|---|---|
${recLines}

## Controls modifiés (NEXT ≠ V4.6 au-delà de la maille, ou S1)

n = **${ctrl.n}**. Gross (>0.010 vs V4.6) : **${ctrl.nGross}**.

| cut | side | hypot vs V4.6 | ΔU | ΔZ | responsable | V4.6↔humain | NEXT↔humain | verdict |
|---|---|---:|---|---|---|---:|---:|---|
${ctrlLines}

Un control resté \`candidate\` n’est pas ipso facto conservé géométriquement.

## 102 / 103 / 105

Pas de Pair Arbitration supplémentaire. Alternative = STRONG du competitive set déjà produit.

| vi | cut | side | V4.6 | NEXT | V4.6↔humain | NEXT↔humain | classe |
|---|---|---|---|---|---:|---:|---|
${kbLines}

WORSENED : **${(kb.items || []).filter(i => i.label === 'WORSENED').length}**.

## Exposition

- DEVELOPMENT_EXPOSED = 53+53 des lots No-Support / U / A_STAR / Face-Aware / Competitive Support.
- Geometry Prototype V1 a déjà rejoué 221/239 : **pas un holdout aveugle**.

${q.holdoutNote || ''}

| groupe | n | recoveries | controls modifiés | médiane NEXT↔humain |
|---|---:|---:|---:|---:|
| DEVELOPMENT_EXPOSED | ${q.exposure?.exposed?.n} | ${q.exposure?.exposed?.recoveries} | ${q.exposure?.exposed?.modifiedControls} | ${q.exposure?.exposed?.bands?.median} |
| NOT_DIRECTLY_USED | ${q.exposure?.hold?.n} | ${q.exposure?.hold?.recoveries} | ${q.exposure?.hold?.modifiedControls} | ${q.exposure?.hold?.bands?.median} |

## Contribution S1 (4 rails)

${s1Lines}

S1 reste un fallback rare. 5088 et 5146 sont des recoveries RSF. 9644 et 2894 restaurent le témoin V4.6 (A_STAR les avait perdus) : ce n’est pas un alignement oracle.

## Doctrine

- Aucun nouveau seuil, aucun retuning oracle, aucune action ESV.
- Unités de scène uniquement (×10⁻³ non calibré, pas des millimètres).
- Ne pas merger. Si PROMOTE : spécification figée, réplication indépendante ensuite.

## Réponse

${q.answer}
`;
}

function writeSpec(q) {
  return `# Geometry Candidate V1 — spécification figée

Artefact scientifique. **Pas une branche d’intégration runtime.** Réplication indépendante requise avant tout ESV.

- Base Banane : \`0f6846f\` / lab NEXT V0 \`9e40ad2\`
- Qualification : \`${q.head || '(après commit)'}\` branche \`lab-geometry-engine-next-v0-qualification\`
- Composition hash : \`${Next.COMPOSITION_HASH}\`
- A_STAR hash : \`${Next.A_STAR_HASH}\`
- geometry.js : \`${q.hashes?.geometry}\`
- geometry-baseline.js : \`${q.hashes?.baselineGeometry}\` (inchangé)

## Moteur

NEXT V0 = A_STAR + SUPPORT_FALLBACK_15 (S1). S2 exclu.

### A_STAR

- médiane U des points locaux moteur via \`hypothesesA\`
- replaceOrigin : false
- recenterWindow : true
- searchY : **0.08** · searchZ : **0.04** · grid : **0.003**
- minTop : **15** · minFace : **6**
- pas un searchY global

### S1 SUPPORT_FALLBACK_15

- si A_STAR déjà STRONG (candidate ∧ top≥15 ∧ face≥6 ∧ !slopeLimited) : **ne rien faire**
- sinon competitive set loss/Lmin ≤ **1.5** (constante V4.6 \`minTemplateLossRatio\`)
- unique cluster STRONG (union-find, alternativeSeparation **0.02**) : min-loss du cluster
- plusieurs clusters : **AMBIGUOUS** (abstention)
- aucun STRONG compétitif : conserver le motif A_STAR

### Abstention

- flanc / minTop / pente / fenêtre / ambiguïté : inchangés
- S1 ne publie jamais PARTIAL_FACE ni WEAK_FACE

## Gates de validation

- parité 239/239 contre ce gel
- 0 PARTIAL/WEAK publié
- 0 déjà-STRONG déplacé par S1
- 0 far S1
- 5146 = VALID_ALTERNATIVE
- 102/103/105 non WORSENED

## Population

Lock RSF 239 (63 failures + 176 controls), dataset native-v4.6-2026-09-16 @ d541686d.

## Limitations

- Pas un holdout aveugle (Prototype V1 a vu 221/239 ; 53+53 ont servi au développement).
- 9644 : NEXT = V4.6, loin de l’humain (~0.130 unité de scène). Restauration de témoin, pas une correction oracle.
- 154 G : A_STAR déplace de ~0.030 vs V4.6 ; post-hoc humain IMPROVED. S1 inactif.
- Unités de scène uniquement.

## Cas non résolus

- 38 RSF encore unresolved
- 5 flancs insuffisants (5090, 5113, 5125, 5151, 5240) : S1 s’abstient
- extras 102/103/105 unresolved : ABSTENTION
`;
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/geometry-engine-next-v0-qualification.json'),
    frozen: FROZEN_PATH,
    data: N.DEFAULT_ROOT,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output') out.output = path.resolve(argv[++i]);
    else if (a === '--frozen') out.frozen = path.resolve(argv[++i]);
    else if (a === '--data') out.data = argv[++i];
    else throw Error('argument inconnu: ' + a);
  }
  return out;
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
  const frozen = JSON.parse(fs.readFileSync(args.frozen, 'utf8'));
  const aStarHash = FAA.assertAStarFrozen();
  if (aStarHash !== Next.A_STAR_HASH) throw Error('A_STAR hash drift');
  if (Next.COMPOSITION_HASH !== frozen.hashes.composition) throw Error('composition hash drift vs frozen');
  if (G.DEFAULTS.minTemplateLossRatio !== 1.5) throw Error('ratio drift');
  if (G.DEFAULTS.searchY !== 0.08 || G.DEFAULTS.searchZ !== 0.04) throw Error('searchY/Z drift');
  const geometrySha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry.js')));
  const baselineSha = SHA(fs.readFileSync(path.join(ROOT, 'src/geometry-baseline.js')));
  if (geometrySha !== frozen.hashes.geometry) throw Error('geometry.js a changé — qualification interdite');
  if (baselineSha !== frozen.hashes.baselineGeometry) throw Error('baseline a changé');

  const lock = Next.loadLock239();
  const pop = U.loadPopulation();
  const exposed = new Set([...pop.failureKeys, ...pop.controlKeys]);
  const frozenKeys = frozen.rails.map(r => r.key);
  const lockKeys = [...lock.failureKeys, ...lock.controlKeys];
  const extraKeys = frozen.rails.filter(r => r.role === 'known-bad-extra').map(r => r.key);

  process.stderr.write('[qual] replay 239\n');
  const { base, docs, visits } = N.readVisits(args.data);
  const asm = Next.assembleKeys(visits, lockKeys, docs, base);
  const failSet = new Set(lock.failureKeys);
  const rails = [];
  let done = 0;
  const byItem = new Map(asm.rails.map(x => [x.key, x]));
  for (const item of asm.rails) {
    const role = failSet.has(item.key) ? 'failure' : 'control';
    const row = Next.analyseAssembled(item, role);
    row.exposure = exposed.has(item.key) ? 'DEVELOPMENT_EXPOSED' : 'NOT_DIRECTLY_USED_FOR_TUNING';
    rails.push(row);
    done++;
    if (done % 25 === 0 || done === asm.rails.length) {
      process.stderr.write(`[qual] ${done}/${asm.rails.length} (${((Date.now() - tAll) / 1000).toFixed(1)}s)\n`);
    }
  }
  if (extraKeys.length) {
    const extraAsm = Next.assembleKeys(visits, extraKeys, docs, base);
    for (const item of extraAsm.rails) {
      byItem.set(item.key, item);
      const row = Next.analyseAssembled(item, 'known-bad-extra');
      row.exposure = 'NOT_DIRECTLY_USED_FOR_TUNING';
      rails.push(row);
    }
  }

  const parity = parityAgainstFrozen(rails, frozen);
  process.stderr.write('[qual] parité mismatches=' + parity.nMismatch + ' pass=' + parity.pass + '\n');

  const lockRails = rails.filter(r => r.role !== 'known-bad-extra');
  const q = {
    format: 'geometry-engine-next-v0-qualification',
    branch: 'lab-geometry-engine-next-v0-qualification',
    nature: 'experimental-qualification',
    generatedAt: new Date().toISOString(),
    head: null, base: '0f6846f', lab: '9e40ad2',
    hashes: {
      geometry: geometrySha, baselineGeometry: baselineSha,
      baselineUnchanged: true, aStar: aStarHash,
      composition: Next.COMPOSITION_HASH,
    },
    composition: Next.COMPOSITION,
    parity,
    coverage: {
      assembled: lockRails.filter(r => r.ok).length,
      skipped: lockRails.filter(r => !r.ok).length,
      extras: rails.filter(r => r.role === 'known-bad-extra').length,
      chunksLoaded: asm.chunksLoaded, chunksNeeded: asm.chunksNeeded,
    },
    s1ChangedKeys: lockRails.filter(r => r.s1Changed).map(r => r.key),
    publishedWeak: lockRails.filter(r => r.publishedWeak).length,
    displacedAlreadyStrong: lockRails.filter(r => r.alreadyQualified && r.s1Changed).length,
    s1Far: lockRails.filter(r => r.s1Changed && r.next?.status === 'candidate' && r.competitive?.lmin > 0 && r.next.loss / r.competitive.lmin > RATIO + 1e-12).length,
  };

  if (!parity.pass) {
    q.verdict = { verdict: 'INCONCLUSIVE', blockers: ['parité échouée'], reasons: [] };
    q.answer = 'STOP. Parité 239/239 échouée. Aucune qualification.';
    q.science = { lotStatus: 'INCONCLUSIVE', answer: q.answer, verdict: q.verdict.verdict, parity };
    writeArtifacts(q, args.output);
    return q;
  }

  process.stderr.write('[qual] audits profonds\n');
  const deepKeys = new Set([
    KEY_5146, KEY_154, KEY_5088, KEY_2894, KEY_9644,
    ...lockRails.filter(r => r.role === 'failure' && r.classV46Next === 'RECOVERED').map(r => r.key),
    ...lockRails.filter(r => r.role === 'control' && ((r.hypotNextV46 || 0) > GRID_TOL || r.s1Changed)).map(r => r.key),
  ]);
  const deepByKey = new Map();
  for (const key of deepKeys) {
    const item = byItem.get(key);
    const row = rails.find(r => r.key === key);
    if (item && row) deepByKey.set(key, deepRail(item, row));
  }

  const d5146 = deepByKey.get(KEY_5146);
  q.audit5146 = { ...classify5146(d5146), deep: slimDeep(d5146) };

  const r154 = rails.find(r => r.key === KEY_154);
  const d154 = deepByKey.get(KEY_154);
  const oracle154 = qualifyOracle(r154?.humanStatus, r154?.human);
  q.audit154 = {
    key: KEY_154, cut: 154, side: 'left',
    s1Activated: !!r154?.s1Activated, s1Changed: !!r154?.s1Changed,
    alreadyQualified: !!r154?.alreadyQualified,
    hypotNextV46: r154?.hypotNextV46, hypotAstarV46: r154?.hypotAstarV46,
    hypotV46Human: r154?.hypotV46Human, hypotNextHuman: r154?.hypotNextHuman,
    oracle: oracle154,
    raw: vsHuman(r154?.hypotNextHuman, r154?.hypotV46Human, oracle154),
    grid: vsHumanGrid(r154?.hypotNextHuman, r154?.hypotV46Human, oracle154),
    v46: d154?.v46 || null, astar: d154?.astar || null, next: d154?.next || null,
    nStrongPool: d154?.nPool, nStrongCompetitive: d154?.nStrongCompetitive,
    note: 'S1 inactif ; déplacement = A_STAR vs V4.6. Pas un seuil nouveau.',
  };

  const recItems = lockRails.filter(r => r.role === 'failure' && r.classV46Next === 'RECOVERED').map(r => {
    const d = deepByKey.get(r.key);
    const oracle = qualifyOracle(r.humanStatus, r.human);
    return {
      key: r.key, sessionId: r.sessionId, cut: r.cut, side: r.side, part: r.part,
      exposure: r.exposure,
      mechanism: r.s1Changed ? 'S1' : 'A_STAR',
      v46Reason: r.engine?.reason || r.engine?.motif,
      astarMotif: r.astar?.motif,
      next: d?.next || { u: r.next?.pick?.u, z: r.next?.pick?.z, loss: r.next?.loss, topRows: r.next?.topRows, faceCount: r.next?.faceCount, slopeLimited: r.next?.slopeLimited },
      loss: r.next?.loss, lossRatio: (r.competitive?.lmin > 0 && r.next?.loss != null) ? r.next.loss / r.competitive.lmin : null,
      topRows: r.next?.topRows, faceCount: r.next?.faceCount, slopeLimited: !!r.next?.slopeLimited,
      nStrongCompetitive: r.competitive?.nStrongCompetitive,
      nClusters: r.competitive?.nClusters,
      oracle, hypotNextHuman: r.hypotNextHuman, band: bandOf(r.hypotNextHuman),
      concurrentStrong: (r.competitive?.nStrongCompetitive || 0) > 1,
    };
  });
  q.recoveries = {
    n: recItems.length,
    byMechanism: { A_STAR: recItems.filter(i => i.mechanism === 'A_STAR').length, S1: recItems.filter(i => i.mechanism === 'S1').length },
    exposed: recItems.filter(i => i.exposure === 'DEVELOPMENT_EXPOSED').length,
    hold: recItems.filter(i => i.exposure !== 'DEVELOPMENT_EXPOSED').length,
    bands: fillBands(recItems.map(i => i.hypotNextHuman)),
    items: recItems,
  };

  const modified = lockRails.filter(r => r.role === 'control' && ((r.hypotNextV46 || 0) > GRID_TOL || r.s1Changed));
  q.modifiedControls = {
    n: modified.length,
    nGross: modified.filter(r => (r.hypotNextV46 || 0) > GROSS_TOL).length,
    items: modified.map(r => {
      const d = deepByKey.get(r.key);
      const oracle = qualifyOracle(r.humanStatus, r.human);
      const du = (r.next?.delta && r.engine?.delta) ? round6(r.next.delta[1] - r.engine.delta[1]) : null;
      const dz = (r.next?.delta && r.engine?.delta) ? round6(r.next.delta[2] - r.engine.delta[2]) : null;
      return {
        key: r.key, cut: r.cut, side: r.side, exposure: r.exposure,
        hypotNextV46: r.hypotNextV46, du, dz,
        v46Support: { top: r.engine?.topRows, face: r.engine?.faceCount, loss: r.engine?.loss, slopeLimited: r.engine?.slopeLimited },
        nextSupport: { top: r.next?.topRows, face: r.next?.faceCount, loss: r.next?.loss, slopeLimited: r.next?.slopeLimited },
        responsible: r.s1Changed ? (r.attribution === 'C' ? 'C' : 'S1') : 'A_STAR',
        alreadyQualified: r.alreadyQualified, s1Activated: r.s1Activated,
        oracle, hypotV46Human: r.hypotV46Human, hypotNextHuman: r.hypotNextHuman,
        verdict: vsHuman(r.hypotNextHuman, r.hypotV46Human, oracle),
        verdictGrid: vsHumanGrid(r.hypotNextHuman, r.hypotV46Human, oracle),
        inspect: d ? { v46: d.v46, next: d.next } : null,
      };
    }),
  };

  const kbRows = rails.filter(r => r.ok && (r.visitIndex === 102 || r.visitIndex === 103 || r.visitIndex === 105
    || r.role === 'known-bad-extra'));
  q.knownBad = {
    n: kbRows.length,
    items: kbRows.map(classifyKnownBad),
  };

  q.s1Four = {
    n: 4,
    items: S1_KEYS.map(key => {
      const r = rails.find(x => x.key === key);
      const d = deepByKey.get(key);
      const oracle = qualifyOracle(r?.humanStatus, r?.human);
      return {
        key, cut: r?.cut, side: r?.side, role: r?.role, exposure: r?.exposure,
        astarMotif: r?.astar?.motif, astarSlopeLimited: !!r?.astar?.slopeLimited,
        alreadyQualified: r?.alreadyQualified,
        s1Activated: r?.s1Activated, s1Changed: r?.s1Changed, s1Note: r?.next?.note || d?.s1Note,
        nextStatus: r?.next?.status, nStrongCompetitive: r?.competitive?.nStrongCompetitive, nClusters: r?.competitive?.nClusters,
        next: d?.next, astar: d?.astar, v46: d?.v46, strongCompetitive: d?.strongCompetitive,
        oracle, hypotNextHuman: r?.hypotNextHuman, hypotV46Human: r?.hypotV46Human,
        postHoc: vsHuman(r?.hypotNextHuman, r?.hypotV46Human, oracle),
      };
    }),
  };

  const s1Conservative = q.s1ChangedKeys.length === 4
    && q.s1ChangedKeys.slice().sort().join('|') === S1_KEYS.slice().sort().join('|')
    && q.publishedWeak === 0 && q.displacedAlreadyStrong === 0 && q.s1Far === 0;
  q.s1Conservative = s1Conservative;

  function exposureStats(label) {
    const rows = lockRails.filter(r => r.ok && r.exposure === label);
    const rec = rows.filter(r => r.role === 'failure' && r.classV46Next === 'RECOVERED');
    const mod = rows.filter(r => r.role === 'control' && ((r.hypotNextV46 || 0) > GRID_TOL || r.s1Changed));
    const hs = rows.filter(r => r.next?.status === 'candidate' && r.hypotNextHuman != null).map(r => r.hypotNextHuman);
    return {
      n: rows.length, recoveries: rec.length, modifiedControls: mod.length,
      nHuman: rows.filter(r => qualifyOracle(r.humanStatus, r.human) === 'QUALIFIED').length,
      bands: fillBands(hs),
    };
  }
  q.exposure = {
    exposed: exposureStats('DEVELOPMENT_EXPOSED'),
    hold: exposureStats('NOT_DIRECTLY_USED_FOR_TUNING'),
  };
  q.holdoutNote = 'Geometry Prototype V1 a assemblé 221/239. NOT_DIRECTLY_USED_FOR_TUNING n’est pas un holdout aveugle. 53+53 DEVELOPMENT_EXPOSED = No-Support, U Hypothesis, Recentering, Face-Aware, Competitive Support.';

  q.verdict = deriveVerdict(q);
  const parts = [];
  parts.push('Parité 239/239 ' + (parity.pass ? 'PASS' : 'FAIL') + '.');
  parts.push('5146 ' + q.audit5146.kind + '.');
  parts.push('154 S1=' + q.audit154.s1Activated + ' oracle=' + q.audit154.oracle + ' brut=' + q.audit154.raw + ' grille=' + q.audit154.grid + '.');
  parts.push('25 recoveries : médiane ' + q.recoveries.bands.median + ' ; ≤0.010 : ' + q.recoveries.bands.le10 + '/' + q.recoveries.n + '.');
  parts.push('Controls modifiés ' + q.modifiedControls.n + ' dont gross ' + q.modifiedControls.nGross + '.');
  parts.push('102/103/105 WORSENED ' + q.knownBad.items.filter(i => i.label === 'WORSENED').length + '.');
  parts.push('S1 conservateur=' + q.s1Conservative + ' (4 rails).');
  parts.push('Verdict ' + q.verdict.verdict + '. Pas une intégration runtime.');
  q.answer = parts.join(' ');
  q.science = {
    lotStatus: q.verdict.verdict,
    answer: q.answer,
    verdict: q.verdict.verdict,
    blockers: q.verdict.blockers,
    reasons: q.verdict.reasons,
    parity,
    audit5146: { kind: q.audit5146.kind, reason: q.audit5146.reason, astarSlopeLimited: q.audit5146.astarSlopeLimited, nextSlopeLimited: q.audit5146.nextSlopeLimited },
    audit154: { s1Activated: q.audit154.s1Activated, oracle: q.audit154.oracle, raw: q.audit154.raw, grid: q.audit154.grid, hypotNextV46: q.audit154.hypotNextV46, hypotNextHuman: q.audit154.hypotNextHuman, hypotV46Human: q.audit154.hypotV46Human },
    recoveries: { n: q.recoveries.n, bands: q.recoveries.bands, byMechanism: q.recoveries.byMechanism },
    modifiedControls: { n: q.modifiedControls.n, nGross: q.modifiedControls.nGross },
    knownBad: { n: q.knownBad.n, byLabel: q.knownBad.items.reduce((m, i) => { m[i.label] = (m[i.label] || 0) + 1; return m; }, {}) },
    s1Conservative: q.s1Conservative,
    exposure: q.exposure,
    holdoutNote: q.holdoutNote,
    searchY: 0.08, searchZ: 0.04, minFace: 6, minTop: 15, minTemplateLossRatio: 1.5,
    noNewThreshold: true, aStarFrozen: true, engineUntouched: true,
  };
  q.elapsedMs = Date.now() - tAll;
  writeArtifacts(q, args.output);
  return q;
}

function writeArtifacts(q, output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(q));
  const slim = {
    format: q.format, branch: q.branch, nature: q.nature, generatedAt: q.generatedAt,
    elapsedMs: q.elapsedMs, head: q.head, base: q.base, lab: q.lab,
    hashes: q.hashes, parity: q.parity, coverage: q.coverage, science: q.science,
    verdict: q.verdict, answer: q.answer,
    audit5146: q.audit5146, audit154: q.audit154,
    recoveries: q.recoveries && { n: q.recoveries.n, byMechanism: q.recoveries.byMechanism, bands: q.recoveries.bands, items: q.recoveries.items },
    modifiedControls: q.modifiedControls,
    knownBad: q.knownBad, s1Four: q.s1Four, exposure: q.exposure,
    s1ChangedKeys: q.s1ChangedKeys, s1Conservative: q.s1Conservative, holdoutNote: q.holdoutNote,
  };
  fs.writeFileSync(output.replace(/\.json$/, '.slim.json'), JSON.stringify(slim));
  fs.writeFileSync(path.join(ROOT, 'GEOMETRY_ENGINE_NEXT_V0_QUALIFICATION.md'), renderMarkdown(q));
  if (q.verdict?.verdict === 'PROMOTE_TO_GEOMETRY_CANDIDATE_V1') {
    fs.writeFileSync(path.join(ROOT, 'GEOMETRY_CANDIDATE_V1_SPEC.md'), writeSpec(q));
  }
  try { fs.writeFileSync(path.resolve(ROOT, '../public/geometry-engine-next-v0-qualification.json'), JSON.stringify(slim)); } catch { /* */ }
  try { fs.writeFileSync(path.resolve(ROOT, '../src/lib/geometry-engine-next-v0-qualification.json'), JSON.stringify(slim)); } catch { /* */ }
  process.stderr.write(`écrit ${output} (${q.elapsedMs} ms, verdict ${q.verdict?.verdict})\n`);
}

module.exports = {
  KEY_5146, KEY_154, KEY_5088, KEY_2894, KEY_9644, S1_KEYS,
  qualifyOracle, vsHuman, vsHumanGrid, classify5146, inspectAt, bandOf,
  parityAgainstFrozen, deriveVerdict, build, renderMarkdown,
};

if (require.main === module) build();
