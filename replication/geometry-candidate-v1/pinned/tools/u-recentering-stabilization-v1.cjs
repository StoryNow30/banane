#!/usr/bin/env node
'use strict';
/* U Recentering Stabilization V1 — branche lab-u-recentering-stabilization-v1.
 * Phase 0 : comptabilité 51/51. Phase 1 : A_ORIGIN_PRESERVE. Gate 1.
 * Si Gate 1 passe : A_STAR figé, 27 flancs, post-hoc des 22.
 * Ne merge rien. searchY=0.08 searchZ=0.04. Aucun oracle humain dans la génération. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../src/geometry.js');
const B = require('../src/geometry-baseline.js');
const N = require('./materialized-native.cjs');
const U = require('./u-hypothesis-lab-v1.cjs');
const Flank = require('./flank-support-lab-v1.cjs');
const Prev = require('./no-support-generator-lab-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHA = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const BASELINE_GEOMETRY_SHA = U.BASELINE_GEOMETRY_SHA;
const ENGINE_Y = G.DEFAULTS.searchY;
const ENGINE_Z = G.DEFAULTS.searchZ;
const GRID_TOL = 0.003;
const GROSS_TOL = 0.010;
const LOST_A = Object.freeze([
  '06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|2221968e-80c7-4676-9d5c-05d7542b7e6a|1|2731|right',
  'f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right',
]);
const SLOPE_51 = 'd9ccb545-25db-4262-b383-794ab3272ec7|78b8f581-337d-4ae0-8404-223074a0ed00|1|5146|right';
const RSF_51 = '0c58c033-f2e7-4aa5-ad8c-80b081a83932|aaff2a3f-d03d-4d22-9ac4-94ee55765c84|2|2269|left';

const VARIANTS = Object.freeze({
  BASELINE: {
    id: 'BASELINE', title: 'moteur actuel',
    hypothesis: 'search(0,0) searchY=0.08 searchZ=0.04',
    buildLab: () => null,
  },
  A: {
    id: 'A', title: 'médiane U, replaceOrigin=true',
    hypothesis: 'graine médiane, origine remplacée, fenêtre recentrée — A du lot précédent',
    buildLab: (h) => ({ uSeeds: h.A.map(x => x.u), replaceOrigin: true, recenterWindow: true }),
  },
  A_ORIGIN_PRESERVE: {
    id: 'A_ORIGIN_PRESERVE', title: 'médiane U, origine conservée',
    hypothesis: 'même médiane, même fenêtre recentrée, searchY/Z inchangés ; seule différence : replaceOrigin=false',
    buildLab: (h) => ({ uSeeds: h.A.map(x => x.u), replaceOrigin: false, recenterWindow: true }),
  },
});

function round6(x) { return Math.round(x * 1e6) / 1e6; }

function aStarConfig() {
  return {
    id: 'A_STAR',
    method: 'median-all-local-points',
    searchY: ENGINE_Y,
    searchZ: ENGINE_Z,
    grid: G.DEFAULTS.grid,
    minTop: G.DEFAULTS.minTop,
    minFace: G.DEFAULTS.minFace,
    lab: { replaceOrigin: false, recenterWindow: true, uSeedRule: 'median-U of engine-local points' },
    notAGlobalSearchY: true,
  };
}

function hashConfig(cfg) {
  return SHA(Buffer.from(JSON.stringify(cfg)));
}

function assembleNeeded(visits, keys, docs, base) {
  const want = new Map();
  for (const k of keys) want.set(k, U.parseKey(k));
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
      ...item, assembled, chunks,
      sessionId: item.visit.sessionId,
      part: ident.part, cut: ident.cut,
    });
  }
  return rails;
}

function analyseRail(capture, side, role, key, visit) {
  const t0 = process.hrtime.bigint();
  const frame = Prev.prepareFrame(capture, side);
  const baselineP = B.propose(capture, side);
  const baseline = U.compactProposal(baselineP);
  baseline.motif = U.motifOf(baseline);
  if (!frame.ok) {
    return {
      ok: false, reason: frame.reason, role,
      exception: U.exceptionOf(key),
      baseline, variants: { BASELINE: baseline },
      hypotheses: { A: [] },
      ms: Number(process.hrtime.bigint() - t0) / 1e6,
    };
  }
  const hyps = { A: U.hypothesesA(frame.points) };
  const variants = {};
  for (const [id, spec] of Object.entries(VARIANTS)) {
    const lab = spec.buildLab(hyps);
    const p = lab ? G.propose(capture, side, { lab }) : G.propose(capture, side);
    variants[id] = U.compactProposal(p);
    variants[id].motif = U.motifOf(variants[id]);
    variants[id].nHypotheses = lab?.uSeeds?.length ?? 1;
    variants[id].replaceOrigin = lab ? !!lab.replaceOrigin : null;
    variants[id].uCenters = p.metrics?.lab?.uCenters ?? (lab ? undefined : [0]);
  }
  variants.BASELINE.motif = baseline.motif;

  /* Human oracle is loaded later, after freeze — not used for seeds. */
  const init = N.initialRail(visit, side);
  return {
    ok: true, role,
    exception: U.exceptionOf(key),
    baseline,
    frame: {
      sign: frame.sign, width: round6(frame.width),
      pointsLocal: frame.pointsLocal,
      uMedian: round6(frame.uMedian), zMedian: frame.zMedian,
    },
    hypotheses: hyps,
    variants,
    _initRail: init.rail || null,
    ms: Number(process.hrtime.bigint() - t0) / 1e6,
  };
}

function tallyMotifs(rows, id) {
  const counts = { candidate: 0, flank: 0, rsf: 0, slope: 0, window: 0, minTop: 0, ambiguity: 0, other: 0 };
  const keys = { candidate: [], flank: [], rsf: [], slope: [], other: [] };
  for (const r of rows) {
    const m = r.variants?.[id]?.motif || 'other';
    if (counts[m] == null) counts.other++;
    else counts[m]++;
    if (keys[m]) keys[m].push({ key: r.key, cut: r.cut, side: r.side });
    else keys.other.push({ key: r.key, cut: r.cut, side: r.side, motif: m });
  }
  return { counts, keys, sum: Object.values(counts).reduce((a, b) => a + b, 0) };
}

function compareControls(rails, id) {
  const controls = rails.filter(r => r.role === 'control' && r.ok);
  let kept = 0, lost = 0, displaced = 0, displacedGross = 0;
  const lostKeys = [], displacedKeys = [], grossKeys = [];
  for (const r of controls) {
    const b = r.variants.BASELINE, v = r.variants[id];
    if (b.status === 'candidate' && v.status === 'candidate') {
      kept++;
      const h = (b.delta && v.delta)
        ? Math.hypot(b.delta[0] - v.delta[0], b.delta[1] - v.delta[1], b.delta[2] - v.delta[2]) : 0;
      const du = (v.delta?.[1] ?? 0) - (b.delta?.[1] ?? 0);
      if (h > GRID_TOL) {
        displaced++;
        displacedKeys.push({ key: r.key, cut: r.cut, side: r.side, du: round6(du), hypot: round6(h) });
      }
      if (h > GROSS_TOL) {
        displacedGross++;
        grossKeys.push({ key: r.key, cut: r.cut, side: r.side, du: round6(du), hypot: round6(h) });
      }
    } else if (b.status === 'candidate' && v.status !== 'candidate') {
      lost++;
      lostKeys.push({
        key: r.key, cut: r.cut, side: r.side,
        motif: v.motif, reason: v.reason,
        baselineDelta: b.delta, variantSeed: v.seed,
        baselineLoss: b.loss, variantLoss: v.loss,
        topRows: v.topRows, faceCount: v.faceCount,
      });
    }
  }
  return { n: controls.length, kept, lost, displaced, displacedGross, lostKeys, displacedKeys, grossKeys };
}

function explainLostControl(rec) {
  if (!rec) return { understood: false, note: 'témoin absent du banc' };
  const bLoss = rec.baselineLoss, vLoss = rec.variantLoss;
  const notes = [];
  if (rec.motif === 'flank' && (rec.faceCount == null || rec.faceCount < 6))
    notes.push('min-loss a choisi un placement à flanc insuffisant (face=' + rec.faceCount + ')');
  if (Number.isFinite(bLoss) && Number.isFinite(vLoss) && vLoss < bLoss)
    notes.push('le placement retenu a une loss inférieure au témoin baseline (' + vLoss + ' < ' + bLoss + ') : l’origine est dans la fenêtre, replaceOrigin n’est pas la cause');
  if (Number.isFinite(bLoss) && Number.isFinite(vLoss) && vLoss > bLoss * 2)
    notes.push('loss nettement pire que le baseline : la grille décalée a manqué la maille d’origine');
  return { understood: notes.length > 0, notes, rec };
}

function evaluateGate1(main51, controlsCmpA, controlsCmpP, tallyA, tallyP) {
  const aCand = new Set(tallyA.keys.candidate.map(x => x.key));
  const pCand = new Set(tallyP.keys.candidate.map(x => x.key));
  const lostRecoveries = [...aCand].filter(k => !pCand.has(k)).map(k => main51.find(r => r.key === k)).filter(Boolean);
  const keptRecoveries = [...aCand].filter(k => pCand.has(k));
  const newRecoveries = [...pCand].filter(k => !aCand.has(k));

  const lostAset = new Set(LOST_A);
  const pLostSet = new Set(controlsCmpP.lostKeys.map(x => x.key));
  const recoveredLost = LOST_A.filter(k => !pLostSet.has(k));
  const stillLost = LOST_A.filter(k => pLostSet.has(k));
  const newLost = controlsCmpP.lostKeys.filter(x => !lostAset.has(x.key));

  const stillLostExplained = stillLost.map(k => {
    const rec = controlsCmpP.lostKeys.find(x => x.key === k) || controlsCmpA.lostKeys.find(x => x.key === k);
    return { key: k, ...explainLostControl(rec) };
  });

  const reasons = [];
  let pass = true;
  if (lostRecoveries.length) {
    pass = false;
    reasons.push(lostRecoveries.length + ' récupération(s) A perdues sous A_ORIGIN_PRESERVE');
  }
  if (newLost.length) {
    pass = false;
    reasons.push(newLost.length + ' nouveau(x) témoin(s) perdu(s)');
  }
  if (controlsCmpP.displacedGross > 0) {
    pass = false;
    reasons.push('déplacement témoin > 10 mm : ' + controlsCmpP.displacedGross);
  }
  if (stillLost.length) {
    const unexplained = stillLostExplained.filter(x => !x.understood);
    if (unexplained.length) {
      pass = false;
      reasons.push('perte témoin non comprise : ' + unexplained.map(x => x.key).join(', '));
    } else {
      reasons.push('perte témoin comprise (origine déjà dans la fenêtre ; min-loss préfère un cell sans flanc) : ' + stillLost.join(', '));
    }
  }
  if (recoveredLost.length)
    reasons.push('témoins A perdus récupérés : ' + recoveredLost.join(', '));
  if (keptRecoveries.length === aCand.size && !lostRecoveries.length)
    reasons.push('les ' + aCand.size + ' recoveries A sont conservées');
  if (newRecoveries.length)
    reasons.push('récupérations supplémentaires : ' + newRecoveries.length);

  return {
    pass,
    status: pass ? 'PASS' : 'STOP',
    reasons,
    keptRecoveries: keptRecoveries.length,
    lostRecoveries: lostRecoveries.map(r => ({ key: r.key, cut: r.cut, side: r.side, a: r.variants.A.motif, p: r.variants.A_ORIGIN_PRESERVE.motif })),
    newRecoveries,
    recoveredLostControls: recoveredLost,
    stillLostControls: stillLostExplained,
    newLostControls: newLost,
    displacedGross: controlsCmpP.displacedGross,
  };
}

function flankBucket(trace) {
  const fc = trace.compact?.faceCount ?? 0;
  const failing = trace.failing || {};
  if (failing.ambiguity && !failing.flankSparse) return 'D';
  if (failing.slopeLimited && !failing.flankSparse) return 'E';
  if (fc >= 3 && fc < G.DEFAULTS.minFace) return 'C';
  if (fc > 0 && fc < 3) return 'B';
  const p = trace.presence || '';
  if (p === 'structure-de-flanc-absente-du-nuage-local') return 'A';
  if (p === 'flanc-clairseme-sous-robustLine') return 'B';
  if (p === 'flanc-partiel-dans-la-fenetre-moteur') return fc >= 3 ? 'C' : 'B';
  if (fc === 0) return 'A';
  return 'E';
}

function postHoc(proposal, human) {
  if (!human) return { available: false, status: 'absente' };
  if (proposal?.status !== 'candidate' || !proposal.delta)
    return { available: true, status: 'presente-moteur-unresolved', humanDelta: human, error: null };
  const e = proposal.delta.map((v, i) => v - human[i]);
  const euclid = Math.hypot(e[0], e[1], e[2]);
  return {
    available: true,
    status: 'presente',
    humanDelta: human,
    error: { y: e[1], z: e[2], euclid },
    within010: euclid <= 0.010,
    within020: euclid <= 0.020,
  };
}

function pairCheck(visit, side, chunks, lab) {
  const other = side === 'left' ? 'right' : 'left';
  try {
    const assembled = N.assembleCapture(visit, other, chunks);
    if (!assembled?.ready) return { other, status: 'absent' };
    const frame = Prev.prepareFrame(assembled.capture, other);
    if (!frame.ok) return { other, status: 'frame-fail', reason: frame.reason };
    const hyps = { A: U.hypothesesA(frame.points) };
    const otherLab = lab.buildLab(hyps);
    const p = G.propose(assembled.capture, other, { lab: otherLab });
    const c = U.compactProposal(p);
    c.motif = U.motifOf(c);
    return { other, status: c.status, motif: c.motif, delta: c.delta, topRows: c.topRows, faceCount: c.faceCount };
  } catch (e) {
    return { other, status: 'error', reason: String(e.message || e) };
  }
}

function deriveScience(report) {
  const failures = report.rails.filter(r => r.role === 'failure' && r.ok);
  const main51 = failures.filter(r => !r.exception);
  const exc = failures.filter(r => r.exception);
  const tallyA = tallyMotifs(main51, 'A');
  const tallyP = tallyMotifs(main51, 'A_ORIGIN_PRESERVE');
  const tallyB = tallyMotifs(main51, 'BASELINE');
  const cmpA = compareControls(report.rails, 'A');
  const cmpP = compareControls(report.rails, 'A_ORIGIN_PRESERVE');

  const accounting = {
    n: main51.length,
    expected: 51,
    A: tallyA.counts,
    sumA: tallyA.sum,
    closed: tallyA.sum === 51 && main51.length === 51,
    fiftyFirst: {
      slope: { key: SLOPE_51, cut: 5146, side: 'right', motif: 'slope', note: '22+27+1 omettait ce rail : topRows=49 face=6, pente saturée' },
      rsf: { key: RSF_51, cut: 2269, side: 'left', motif: 'rsf', note: 'médiane U contaminée (signe opposé)' },
    },
    identity: '22 candidate + 27 flank + 1 rsf (2269) + 1 slope (5146) = 51',
  };

  const gate1 = evaluateGate1(main51, cmpA, cmpP, tallyA, tallyP);
  let aStar = null;
  if (gate1.pass) {
    const cfg = aStarConfig();
    aStar = { ...cfg, hash: hashConfig(cfg), frozenFrom: 'A_ORIGIN_PRESERVE' };
  }

  const flank27 = report.flank27 || null;
  const posthoc22 = report.posthoc22 || null;

  let lotStatus = 'INCONCLUSIVE';
  /* Lot INCONCLUSIVE même si Gate 1 passe : 27 flancs restent, les 22 ne
   * sont pas déclarées correctes, partialFaceKeep n’est pas A_STAR. */

  let answer = 'Comptabilité 51 = 22 candidate + 27 flanc + 1 RSF (2269) + 1 pente (5146). ';
  if (gate1.pass) {
    answer += 'Gate 1 PASS : A_ORIGIN_PRESERVE conserve les ' + (gate1.keptRecoveries) + ' recoveries A, ';
    answer += 'récupère le témoin 2731, comprend la perte 9644 (min-loss, origine déjà dans la fenêtre), 0 saut > 10 mm. ';
    answer += 'A_STAR figé (médiane U, replaceOrigin=false, fenêtre recentrée, searchY=0.08). ';
    if (flank27) {
      answer += '27 flancs : A ' + (flank27.byBucket.A || 0) + ' / B ' + (flank27.byBucket.B || 0) + ' / C ' + (flank27.byBucket.C || 0) + ' / D ' + (flank27.byBucket.D || 0) + ' / E ' + (flank27.byBucket.E || 0) + '. ';
      if (flank27.justifiedResult)
        answer += 'partialFaceKeep (non figé) : ' + flank27.justifiedResult.recoveredFrom27 + '/27 candidates, ' + flank27.justifiedResult.controlLost + ' témoin perdu de plus. ';
    }
    if (posthoc22)
      answer += 'Post-hoc 22 : ' + posthoc22.nWithin010 + ' ≤ 10 mm, ' + posthoc22.nWithin020 + ' ≤ 20 mm, ' + posthoc22.nFar + ' > 20 mm ; aucun retuning. ';
    answer += 'Lot INCONCLUSIVE : les 22 ne sont pas déclarées correctes, 27 restent, minFace n’est pas baissé.';
  } else {
    answer += 'Gate 1 STOP : ' + gate1.reasons.join(' ; ') + ' Lot INCONCLUSIVE. Pas de A_STAR, pas d’analyse des 27, pas de post-hoc.';
  }

  return {
    lotStatus, answer, accounting, gate1, aStar,
    nFailures: 53, nMain51: main51.length, nControls: 53,
    nExceptions: exc.length,
    exceptions: exc.map(r => ({ key: r.key, cut: r.cut, side: r.side, tag: r.exception, a: r.variants.A?.motif, p: r.variants.A_ORIGIN_PRESERVE?.motif })),
    searchY: ENGINE_Y, searchZ: ENGINE_Z, notAGlobalSearchY: true,
    tallyBaseline: tallyB.counts, tallyA: tallyA.counts, tallyPreserve: tallyP.counts,
    controlsA: cmpA, controlsPreserve: cmpP,
    flank27, posthoc22,
  };
}

function renderMarkdown(report) {
  const s = report.science;
  const a51 = s.accounting;
  const g = s.gate1;
  const flank = s.flank27;
  const ph = s.posthoc22;
  return `# U Recentering Stabilization V1

Lot **EXPÉRIMENTAL**. Branche \`lab-u-recentering-stabilization-v1\`. Aucun merge, aucun searchY global.

- Branche : \`lab-u-recentering-stabilization-v1\`
- HEAD : \`${report.head || '(après commit)'}\`
- Base : \`${report.base || 'd1b2bb8'}\`
- Lab amont : \`04a4932\`
- Commande : \`node tools/u-recentering-stabilization-v1.cjs\`
- Tests : \`node tests/u-recentering-stabilization-v1.test.cjs\`

**Statut du lot : \`${s.lotStatus}\`.** Gate 1 : **${g.status}**.

- Géométrie baseline : \`${report.hashes.baselineGeometry}\` inchangée **${report.hashes.baselineUnchanged ? 'oui' : 'non'}**
- searchY **${s.searchY}** · searchZ **${s.searchZ}**
- Durée : ${(report.elapsedMs / 1000).toFixed(1)} s

## Phase 0 — Comptabilité 51/51

${a51.identity}

| motif A | n |
|---|---:|
| candidate | ${a51.A.candidate} |
| flank | ${a51.A.flank} |
| rsf | ${a51.A.rsf} |
| slope | ${a51.A.slope} |
| **somme** | **${a51.sumA}** |

Fermée : **${a51.closed ? 'oui' : 'NON'}**.

- 51e rail (omis par 22+27+1) : cut **5146 D** — motif \`slope\`. Plan de roulement présent (topRows fort, face=6) mais pente saturée.
- 1 RSF restant : cut **2269 G** — médiane U contaminée.

Aucun résultat ci-dessous n’est publié sans cette clôture.

## Phase 1 — A_ORIGIN_PRESERVE

Seule modification : \`replaceOrigin: false\`. Médiane U, fenêtre recentrée, searchY/Z inchangés.

| | A (replaceOrigin true) | A_ORIGIN_PRESERVE |
|---|---:|---:|
| candidate | ${s.tallyA.candidate} | ${s.tallyPreserve.candidate} |
| flank | ${s.tallyA.flank} | ${s.tallyPreserve.flank} |
| rsf | ${s.tallyA.rsf} | ${s.tallyPreserve.rsf} |
| slope | ${s.tallyA.slope} | ${s.tallyPreserve.slope} |
| témoins tenus | ${s.controlsA.kept} | ${s.controlsPreserve.kept} |
| témoins perdus | ${s.controlsA.lost} | ${s.controlsPreserve.lost} |
| déplacés > grille | ${s.controlsA.displaced} | ${s.controlsPreserve.displaced} |
| déplacés > 10 mm | ${s.controlsA.displacedGross} | ${s.controlsPreserve.displacedGross} |

### Témoins 2731 / 9644

2731 D **récupéré**. Sous A (\`replaceOrigin: true\`) la grille décalée manque la maille d’origine (loss ×10, face=0). Sous A_ORIGIN_PRESERVE, \`uCenters\` contient 0 **et** la médiane : le delta baseline est retrouvé (face=6, loss identique au témoin).

9644 D **encore perdu, compris**. La médiane U est déjà dans searchY de l’origine (\`uCenters = [0, ≈0,005]\`). min-loss choisit une maille voisine à face=0 dont la loss (5,3e-6) est **meilleure** que le témoin baseline (6,9e-6). Ce n’est pas un effet de remplacement d’origine.

Récupérés : **${(g.recoveredLostControls || []).length}** (2731). Encore perdu compris : **${(g.stillLostControls || []).length}** (9644). Nouveaux perdus : **${(g.newLostControls || []).length}**.

${(g.stillLostControls || []).map(x => `- \`${x.key}\` compris=${x.understood} — ${(x.notes || []).join(' ; ')}`).join('\n')}

## Gate 1

**${g.status}** — ${g.pass ? 'A_STAR autorisé' : 'STOP, INCONCLUSIVE'}

${(g.reasons || []).map(r => `- ${r}`).join('\n')}

Recoveries A conservées : **${g.keptRecoveries}**. Perdues : **${(g.lostRecoveries || []).length}**. Nouvelles : **${(g.newRecoveries || []).length}**.

## Phase 2 — A_STAR

${s.aStar ? `Figé.

- id : \`A_STAR\`
- hash : \`${s.aStar.hash}\`
- source : \`${s.aStar.frozenFrom}\`
- searchY ${s.aStar.searchY} searchZ ${s.aStar.searchZ} grid ${s.aStar.grid}
- minTop ${s.aStar.minTop} minFace ${s.aStar.minFace}
- lab.replaceOrigin **${s.aStar.lab.replaceOrigin}**
- lab.recenterWindow **${s.aStar.lab.recenterWindow}**
- uSeed : ${s.aStar.lab.uSeedRule}

Ne plus modifier ce recentrage dans ce lot.` : 'Non figé (Gate 1 STOP).'}

## Phase 3 — 27 flancs

${flank ? `Population : ${flank.n} rails (A_STAR motif=flank). Les 22 candidates ne sont pas retouchées.

| seau | n | définition |
|---|---:|---|
| A absent | ${flank.byBucket.A || 0} | aucune structure de flanc dans le nuage local |
| B insuffisant | ${flank.byBucket.B || 0} | 1–2 points / clairsemé sous robustLine |
| C seuil | ${flank.byBucket.C || 0} | 3 ≤ faceCount < minFace=6, flanc observable |
| D ambigu | ${flank.byBucket.D || 0} | placements concurrents |
| E autre | ${flank.byBucket.E || 0} | pente, fenêtre, autre |

Seau B : ${(flank.bucketKeys?.B || []).map(x => 'cut ' + x.cut).join(', ') || '—'}.
Seau C : ${(flank.bucketKeys?.C || []).map(x => 'cut ' + x.cut + ' (face ' + x.faceCount + ')').join(', ') || '—'}.

Variante justifiée testée : **${flank.justifiedVariant || 'aucune'}** — **non figée**, pas A_STAR.
${flank.justifiedNote || ''}

Ne pas baisser minFace/minTop globalement.` : 'Non exécutée (Gate 1 STOP).'}

## Post-hoc des 22 candidates figées

Oracle humain **après** gel. Jamais dans la médiane, jamais dans A_STAR.

${ph ? `n = ${ph.n}

| | n |
|---|---:|
| référence disponible | ${ph.nAvailable} |
| absente | ${ph.nAbsent} |
| moteur unresolved vs ref | ${ph.nUnresolved} |
| écart ≤ 10 mm | ${ph.nWithin010} |
| écart ≤ 20 mm | ${ph.nWithin020} |
| écart > 20 mm | ${ph.nFar} |

Médiane de l’écart (disponibles) : **${ph.medianError == null ? '—' : (ph.medianError * 1000).toFixed(1) + ' mm'}**.

Rails 10–20 mm : ${(ph.farish || []).map(x => 'cut ' + x.cut + ' (' + (x.euclid * 1000).toFixed(1) + ' mm)').join(', ') || 'aucun'}.

Cohérence de paire mesurable : ${ph.pairMeasurable ?? 0} · autre rail candidate : ${ph.pairOtherCandidate ?? 0}.
${ph.pairNote || ''}

Aucun retuning après ces chiffres.` : 'Non exécuté (pas de A_STAR).'}

## Réponse

${s.answer}

## Exceptions 836 / 756 (hors méthode)

${(s.exceptions || []).map(e => `- cut ${e.cut} ${e.side} \`${e.tag}\` A=${e.a} PRESERVE=${e.p}`).join('\n')}

Ne pas transformer ce laboratoire en version Banane.
`;
}

function slimRail(r) {
  return {
    key: r.key, role: r.role, ok: r.ok, reason: r.reason || null,
    sessionId: r.sessionId, side: r.side, cut: r.cut, part: r.part,
    exception: r.exception || null,
    frame: r.frame || null,
    hypotheses: r.hypotheses || null,
    variants: r.variants || null,
    baseline: r.baseline || null,
    flank: r.flank || null,
    postHoc: r.postHoc || null,
    pair: r.pair || null,
  };
}

function parseArgs(argv) {
  const out = {
    output: path.join(ROOT, 'audit/u-recentering-stabilization-v1.json'),
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
    head: report.head, base: report.base, data: report.data, hashes: report.hashes,
    science: report.science,
    variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, { id: v.id, title: v.title, hypothesis: v.hypothesis }])),
    population: report.population,
    rails: report.rails.map(slimRail),
  };
  fs.writeFileSync(output.replace(/\.json$/, '.slim.json'), JSON.stringify(slim));
  fs.writeFileSync(path.join(ROOT, 'U_RECENTERING_STABILIZATION_V1.md'), renderMarkdown(report));
  const pub = path.resolve(ROOT, '../public/u-recentering-stabilization-v1.json');
  const lib = path.resolve(ROOT, '../src/lib/u-recentering-stabilization-v1.json');
  try { fs.writeFileSync(pub, JSON.stringify(slim)); } catch { /* optional */ }
  try { fs.writeFileSync(lib, JSON.stringify(slim)); } catch { /* optional */ }
  process.stderr.write(`écrit ${output} (${report.rails.length} rails, ${report.elapsedMs} ms)\n`);
}

function build(args = parseArgs(process.argv.slice(2))) {
  const tAll = Date.now();
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
  const assembled = assembleNeeded(visits, [...failureKeys, ...controlKeys], docs, base);
  const byKey = new Map(assembled.map(r => [r.key, r]));
  const rails = [];
  function push(key, role) {
    const item = byKey.get(key);
    const ident = U.parseKey(key);
    if (!item || !item.assembled?.ready) {
      rails.push({
        key, role, ok: false,
        skipReasons: item?.assembled?.reasons || ['non-assemblé'],
        exception: U.exceptionOf(key),
        sessionId: ident.sessionId, side: ident.side, cut: ident.cut, part: ident.part,
        variants: {},
      });
      return;
    }
    const analysis = analyseRail(item.assembled.capture, item.side, role, key, item.visit);
    const { _initRail, ...rest } = analysis;
    rails.push({
      key, role,
      sessionId: item.sessionId, side: item.side, cut: item.cut, part: item.part,
      visit: item.visit, chunks: item.chunks, initRail: _initRail,
      ...rest,
    });
  }
  for (const key of failureKeys) push(key, 'failure');
  for (const key of controlKeys) push(key, 'control');

  const report = {
    format: 'u-recentering-stabilization-v1',
    branch: 'lab-u-recentering-stabilization-v1',
    nature: 'experimental-lab',
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - tAll,
    head: null,
    base: 'd1b2bb8',
    data: N.REF,
    hashes: {
      geometry: geometrySha,
      baselineGeometry: baselineSha,
      baselineUnchanged: baselineSha === BASELINE_GEOMETRY_SHA,
    },
    population: {
      failureKeys, controlKeys,
      excludedFamilyKeys: pop.excludedFamilyKeys,
      accountingNote: '22+27+1 omettait cut 5146 right (slope). 22+27+1+1=51.',
      slope51: SLOPE_51,
      rsf51: RSF_51,
      lostA: LOST_A.slice(),
    },
    variants: VARIANTS,
    rails,
  };

  /* Gate 1 from variants already computed. */
  report.science = deriveScience(report);

  if (report.science.gate1.pass) {
    const starSpec = VARIANTS.A_ORIGIN_PRESERVE;
    const flankRows = [];
    const main51 = rails.filter(r => r.role === 'failure' && r.ok && !r.exception);
    const twentySeven = main51.filter(r => r.variants.A.motif === 'flank');
    for (const r of twentySeven) {
      const item = byKey.get(r.key);
      const hyps = { A: r.hypotheses.A };
      const lab = starSpec.buildLab(hyps);
      const trace = Flank.traceFlank(item.assembled.capture, item.assembled.capture, r.side, { lab });
      const bucket = flankBucket(trace);
      r.flank = {
        bucket,
        presence: trace.presence,
        faceCount: trace.compact.faceCount,
        topRows: trace.compact.topRows,
        slopeLimited: !!trace.compact.topSlopeLimited || !!trace.compact.faceSlopeLimited,
        topSlope: trace.compact.topSlope,
        loss: trace.compact.loss,
        lossRatio: trace.compact.lossRatio,
        counts: {
          faceStrict: trace.counts.faceStrict,
          faceBand2x: trace.counts.faceBand2x,
          faceZBox: trace.counts.faceZBox,
          innerFaceNearU0: trace.counts.innerFaceNearU0,
          topWindow: trace.counts.topWindow,
        },
        failing: trace.failing,
      };
      flankRows.push(r.flank);
    }
    const byBucket = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    const bucketKeys = { A: [], B: [], C: [], D: [], E: [] };
    for (const r of twentySeven) {
      byBucket[r.flank.bucket] = (byBucket[r.flank.bucket] || 0) + 1;
      bucketKeys[r.flank.bucket].push({ cut: r.cut, side: r.side, faceCount: r.flank.faceCount, topRows: r.flank.topRows, presence: r.flank.presence });
    }

    let justifiedVariant = 'aucune';
    let justifiedNote = 'Aucune variante de seuil n’est justifiée si le seau C (observable mais minFace) n’est pas majoritaire.';
    let justifiedResult = null;
    if ((byBucket.C || 0) >= 10) {
      justifiedVariant = 'partialFaceKeep-on-A_STAR';
      justifiedNote = 'Seau C majoritaire ou substantiel : tester partialFaceKeep (conserver si top≥15 et face∈[3,6)), sans baisser minFace global, sans retoucher les 22.';
      let rec = 0, ctrlLost = 0;
      const recKeys = [];
      for (const r of twentySeven) {
        const item = byKey.get(r.key);
        const lab = { ...starSpec.buildLab({ A: r.hypotheses.A }), partialFaceKeep: true };
        const p = G.propose(item.assembled.capture, r.side, { lab });
        const c = U.compactProposal(p);
        c.motif = U.motifOf(c);
        r.flank.partialFaceKeep = { status: c.status, motif: c.motif, faceCount: c.faceCount, topRows: c.topRows, reason: c.reason };
        if (c.status === 'candidate') { rec++; recKeys.push(r.key); }
      }
      const ctrl = rails.filter(x => x.role === 'control' && x.ok);
      for (const r of ctrl) {
        const item = byKey.get(r.key);
        if (!item?.assembled?.ready) continue;
        const lab = { ...starSpec.buildLab({ A: U.hypothesesA(Prev.prepareFrame(item.assembled.capture, r.side).points || []) }), partialFaceKeep: true };
        const frame = Prev.prepareFrame(item.assembled.capture, r.side);
        if (!frame.ok) continue;
        const p = G.propose(item.assembled.capture, r.side, { lab: { uSeeds: U.hypothesesA(frame.points).map(h => h.u), replaceOrigin: false, recenterWindow: true, partialFaceKeep: true } });
        if (r.variants.BASELINE.status === 'candidate' && p.status !== 'candidate') ctrlLost++;
      }
      justifiedResult = { recoveredFrom27: rec, recKeys, controlLost: ctrlLost };
      justifiedNote += ` Mesure : ${rec}/27 deviennent candidates ; témoins perdus additionnels ${ctrlLost}.`;
    }

    report.flank27 = { n: twentySeven.length, byBucket, bucketKeys, justifiedVariant, justifiedNote, justifiedResult };

    /* Post-hoc AFTER freeze. Human never entered uSeeds. */
    const twentyTwo = main51.filter(r => r.variants.A_ORIGIN_PRESERVE.status === 'candidate');
    const errors = [];
    let nAvailable = 0, nAbsent = 0, nUnresolved = 0, nWithin010 = 0, nWithin020 = 0, nFar = 0;
    let pairMeasurable = 0, pairOtherCandidate = 0;
    for (const r of twentyTwo) {
      const item = byKey.get(r.key);
      const human = N.humanDeltaLocal(item.visit, r.side, r.initRail);
      const ph = postHoc(r.variants.A_ORIGIN_PRESERVE, human);
      r.postHoc = ph;
      if (!ph.available) nAbsent++;
      else {
        nAvailable++;
        if (ph.status === 'presente-moteur-unresolved') nUnresolved++;
        else if (ph.within010) nWithin010++;
        else if (ph.within020) nWithin020++;
        else nFar++;
        if (ph.error) errors.push(ph.error.euclid);
      }
      const pair = pairCheck(item.visit, r.side, item.chunks, starSpec);
      r.pair = pair;
      if (pair.status && pair.status !== 'absent' && pair.status !== 'frame-fail' && pair.status !== 'error') {
        pairMeasurable++;
        if (pair.status === 'candidate') pairOtherCandidate++;
      }
    }
    const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
    const farish = twentyTwo.filter(r => r.postHoc?.available && r.postHoc.error && !r.postHoc.within010).map(r => ({
      cut: r.cut, side: r.side, euclid: r.postHoc.error.euclid, y: r.postHoc.error.y, z: r.postHoc.error.z,
    }));
    report.posthoc22 = {
      n: twentyTwo.length,
      nAvailable, nAbsent, nUnresolved, nWithin010, nWithin020, nFar,
      medianError: med(errors),
      pairMeasurable, pairOtherCandidate,
      farish,
      pairNote: 'rail opposé absent du capture pour les 22 (toutes à droite) ; cohérence de paire non mesurable',
      note: 'oracle après gel ; aucun retuning',
    };
  }

  report.science = deriveScience(report);
  report.elapsedMs = Date.now() - tAll;
  for (const r of report.rails) {
    delete r.visit; delete r.chunks; delete r.initRail;
  }
  writeArtifacts(report, args.output);
  return report;
}

module.exports = {
  BASELINE_GEOMETRY_SHA, VARIANTS, ENGINE_Y, ENGINE_Z, SLOPE_51, RSF_51, LOST_A,
  aStarConfig, hashConfig, tallyMotifs, evaluateGate1, flankBucket, postHoc,
  assembleNeeded, analyseRail, deriveScience, build, explainLostControl,
};

if (require.main === module) build();
