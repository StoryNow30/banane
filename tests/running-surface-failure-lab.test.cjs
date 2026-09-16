'use strict';
/* Garde-fous du Running Surface Failure Lab V1, depuis l'artefact seul.
 * Aucun seuil opérationnel, aucun rayon, aucune règle n'est validé ici :
 * seulement que le traceur dit la vérité sur le moteur gelé, et que le
 * diagnostic n'a jamais vu la référence humaine. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const L = require('../tools/running-surface-failure-lab.cjs');
const G = require('../src/geometry.js');

const ROOT = path.resolve(__dirname, '..');
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/running-surface-failure-lab-v1.json')));
const S = A.summary, ROWS = A.rows;
const FAIL = ROWS.filter(r => r.cohort === 'failure');
const CTL = ROWS.filter(r => r.cohort === 'control');
const GEO = fs.readFileSync(path.join(ROOT, 'src/geometry.js'), 'utf8');

/* ---- 1. le traceur est vérifié contre le moteur, sinon le banc échoue ----- */

test('le traceur concorde avec le moteur — AUCUNE divergence inexpliquée', () => {
  assert.deepEqual(S.verification.unexplainedDivergences, [],
    'toute divergence traceur/moteur doit faire échouer le banc');
  assert.equal(S.verification.tracerAgreesWithEngine, true);
  assert.equal(S.verification.railsCompared, ROWS.length);
  assert.ok(S.verification.checksRun > 2000, 'la vérification doit être substantielle');
  assert.equal(S.verification.railsWithPublishedMetrics, 176);
  for (const r of ROWS) {
    const v = r.diagnosticTrace.verification;
    assert.deepEqual(v.divergences, [], `divergence sur ${r.key.part}/${r.key.cut}/${r.key.side}`);
    assert.ok(v.checks.every(c => c.ok));
  }
});

test('la vérification couvre bien les étapes internes exigées', () => {
  const avecMetriques = ROWS.filter(r => r.engineObserved.publishedMetrics);
  assert.ok(avecMetriques.length >= 176);
  const attendus = ['exitReason', 'pointsLocal', 'seedY', 'seedZ', 'templateLoss',
                    'coarseBestLoss', 'alternativeLoss', 'alternativeY', 'alternativeZ',
                    'lossRatio', 'topRows', 'topResidual', 'topSlope'];
  for (const r of avecMetriques.slice(0, 40)) {
    const noms = new Set(r.diagnosticTrace.verification.checks.map(c => c.name));
    for (const a of attendus) assert.ok(noms.has(a), `contrôle manquant : ${a}`);
  }
  /* Sur les rails d'échec le moteur ne publie RIEN à comparer au-delà du motif
   * de sortie : c'est dit, pas masqué. */
  for (const r of FAIL) {
    assert.equal(r.engineObserved.publishedMetrics, false);
    assert.equal(r.engineObserved.exitReason, L.FAILURE_REASON);
    assert.equal(r.diagnosticTrace.exit, L.FAILURE_REASON);
  }
});

test('le traceur reste une instrumentation SECONDAIRE, et réutilise le moteur', () => {
  assert.equal(A.tracer.role, 'instrumentation secondaire, jamais le moteur');
  assert.deepEqual(A.tracer.reusesFromEngine, ['G.median', 'G.robustLine', 'C.point']);
  assert.equal(A.tracer.floatAccumulationPreserved, true);
  const src = fs.readFileSync(path.join(ROOT, 'tools/running-surface-failure-lab.cjs'), 'utf8');
  /* L'accumulation flottante des boucles est celle du moteur : la remplacer par
   * `u0 + i*step` donnerait une grille différente au dernier bit. */
  assert.ok(src.includes('u += step'), 'la boucle doit accumuler comme le moteur');
  assert.ok(src.includes('G.median(') && src.includes('G.robustLine('),
    'le traceur doit appeler les fonctions du moteur, pas les recopier');
  assert.ok(!src.includes('function median') && !src.includes('function robustLine'),
    'le traceur ne doit pas réécrire les fonctions que le moteur exporte');
  // les bornes viennent des DEFAULTS, aucune valeur n'est recopiée en dur
  assert.ok(!/search[YZ]\s*[:=]\s*[.0-9]/.test(src), 'borne de recherche en dur');
  assert.ok(!/topBand\s*[:=]\s*[.0-9]/.test(src), 'topBand en dur');
  assert.deepEqual(A.engine.parameters, G.DEFAULTS);
  assert.equal(A.engine.calledWithoutOptions, true);
});

/* ---- 2. étanchéité humaine ------------------------------------------------ */

test('aucune donnée humaine dans les blocs de diagnostic moteur', () => {
  const interdit = /human|operator|label|final|reference|oracle|verdict|truth/i;
  const cles = o => {
    const out = [];
    (function walk(v) {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); walk(x); }
    })(o);
    return out;
  };
  for (const bloc of A.humanFreeBlocks) {
    assert.ok(['engineObserved', 'diagnosticTrace', 'localSupportLandscape',
               'sessionSideContext', 'degradationContext'].includes(bloc));
    for (const r of ROWS) for (const k of cles(r[bloc]))
      assert.ok(!interdit.test(k), `clé « ${k} » interdite dans ${bloc}`);
  }
  assert.equal(A.humanBlock, 'postHocEvaluation');
  assert.ok(ROWS.some(r => r.postHocEvaluation.humanDeltaLocal));
  // la famille d'échec ne dépend d'aucune valeur humaine : recalculable sans elle
  for (const r of FAIL.slice(0, 30)) {
    const attendu = L.failureFamily(
      { topRowsAtCoarse: r.diagnosticTrace.topRowsAtCoarseBest,
        topRowsAtRefined: r.diagnosticTrace.topRowsAtRefinedBest,
        refinedBest: r.diagnosticTrace.refinedBest },
      r.localSupportLandscape);
    assert.equal(attendu, r.failureFamily, `famille non reproductible sans l’humain`);
  }
});

/* ---- 3. population et cohorte -------------------------------------------- */

test('la population étudiée est exactement les 63 « Plan de roulement non estimable. »', () => {
  assert.equal(A.studiedExit, 'Plan de roulement non estimable.');
  assert.ok(GEO.includes(A.studiedExit), 'le motif doit être celui du moteur');
  assert.equal(FAIL.length, 63);
  assert.equal(CTL.length, 176);
  assert.deepEqual(S.cohorts, { failure: 63, control: 176 });
  assert.deepEqual(S.failure.bySide, { right: 58, left: 5 });
  assert.equal(Object.values(S.failure.bySession).reduce((a, b) => a + b, 0), 63);
  /* Le 64ᵉ no-candidate sort ailleurs (« Intersection hors de la fenêtre
   * expérimentale. ») : il est HORS de cette population, pas silencieusement
   * absorbé. */
  for (const r of FAIL) assert.equal(r.engineObserved.exitReason, L.FAILURE_REASON);
});

test('les témoins sont descriptifs : aucun classifieur, aucun seuil appris', () => {
  for (const r of CTL) {
    assert.equal(r.engineObserved.status, 'candidate');
    assert.equal(r.failureFamily, null, 'un témoin ne porte pas de famille d’échec');
  }
  const brut = JSON.stringify(A);
  for (const mot of ['"classifier"', '"threshold"', '"trained"', '"recommendation"', '"rule"'])
    assert.ok(!brut.includes(mot), 'le laboratoire ne doit rien apprendre : ' + mot);
  assert.ok(S.note.includes('aucune hypothèse adoptée'));
  assert.equal(A.familySeparationRatio.isNotAnEngineParameter, true);
  assert.equal(A.familySeparationRatio.isNotProposed, true);
});

/* ---- 4. le paysage de support n'invente ni grille ni rayon ---------------- */

test('la grille du paysage est celle du moteur, et 3 est sa condition', () => {
  assert.equal(L.MIN_ROWS_FOR_LINE, 3);
  assert.ok(GEO.includes('rows.length<3'), 'robustLine rend null en dessous de 3 lignes');
  for (const r of ROWS) {
    const land = r.localSupportLandscape;
    if (!land) continue;
    assert.equal(land.gridIsEngineGrid, true);
    assert.equal(land.noRadiusChosen, true);
    assert.equal(land.minRowsForLine, 3);
    assert.ok(land.gridPoints > 1000, 'la grille grossière du moteur doit être entière');
    assert.equal(land.fractionWithEnoughRows, land.gridPointsWithEnoughRows / land.gridPoints);
    // les anneaux locaux couvrent la grille sans en inventer la résolution
    for (const ring of land.localRings) {
      assert.ok(Math.abs(ring.radiusTo - ring.radiusFrom - G.DEFAULTS.grid) < 1e-12,
        `anneau de largeur ${ring.radiusTo - ring.radiusFrom}`);
      assert.ok(ring.pointsWithEnoughRows <= ring.gridPoints);
    }
  }
});

test('un placement supporté, quand il existe, est publié avec son coût en perte', () => {
  const avec = FAIL.filter(r => r.localSupportLandscape?.nearestSupportedPlacement);
  assert.equal(avec.length, S.nearestSupported.present);
  for (const r of avec) {
    const n = r.localSupportLandscape.nearestSupportedPlacement;
    assert.ok(n.topRows >= 3, 'un placement « supporté » doit vraiment l’être');
    assert.ok(n.distance > 0);
    assert.ok(Number.isFinite(n.lossDelta) && Number.isFinite(n.lossRatioToBest));
    /* Le voisin ne peut pas avoir une perte INFÉRIEURE au best : celui-ci est
     * le minimum de la grille. */
    assert.ok(n.lossRatioToBest >= 1 - 1e-9, `voisin meilleur que le best : ${n.lossRatioToBest}`);
  }
  // et quand il n'existe pas, c'est dit par la famille, pas par un silence
  for (const r of FAIL) if (!r.localSupportLandscape?.nearestSupportedPlacement)
    assert.equal(r.failureFamily, 'aucun-support-nulle-part-sur-la-grille');
});

/* ---- 5. les faits qui fondent le rapport --------------------------------- */

test('le mécanisme dominant : aucun support NULLE PART sur la grille', () => {
  assert.equal(S.failureFamilies['aucun-support-nulle-part-sur-la-grille'], 56);
  assert.equal(S.failureFamilies['support-ailleurs-mais-perte-nettement-superieure'], 5);
  assert.equal(S.failureFamilies['raffinement-a-quitte-le-support'], 2);
  assert.equal(Object.values(S.failureFamilies).reduce((a, b) => a + b, 0), 63);
  for (const r of FAIL) assert.ok(L.FAILURE_FAMILIES.includes(r.failureFamily), r.failureFamily);
  /* Le contraste avec les témoins est structurel, pas marginal. */
  assert.equal(S.failure.topRowsAtRefined.median, 0);
  assert.ok(S.control.topRowsAtRefined.median > 30);
  assert.equal(S.failure.gridFractionWithSupport.median, 0);
  assert.ok(S.control.gridFractionWithSupport.median > 0.2);
});

test('l’entrée n’est pas en cause : autant de points locaux que chez les témoins', () => {
  assert.ok(Math.abs(S.failure.pointsLocal.median - S.control.pointsLocal.median) < 20,
    'les points locaux sont du même ordre');
  // ancres et largeur de tête identiques : le contour est reconnu normalement
  assert.equal(S.failure.topAnchors.median, S.control.topAnchors.median);
  assert.equal(S.failure.faceAnchors.median, S.control.faceAnchors.median);
  assert.ok(Math.abs(S.failure.width.median - S.control.width.median) < 1e-6);
});

test('le placement retenu est poussé au bas de la fenêtre, jamais chez les témoins', () => {
  const bas = FAIL.filter(r => r.diagnosticTrace.refinedBest.z <= -0.04).length;
  const basCtl = CTL.filter(r => r.diagnosticTrace.refinedBest.z <= -0.04).length;
  assert.equal(bas, 38);
  assert.equal(basCtl, 0, 'aucun témoin ne descend aussi bas');
  // et la recherche grossière colle souvent à une borne
  assert.equal(S.failure.coarseAtBoundZ.true, 39);
  assert.equal(S.control.coarseAtBoundZ.true ?? 0, 0);
});

test('le nuage local est décalé au-dessus du placement, au-delà de topBand', () => {
  const band = G.DEFAULTS.topBand;
  const ecart = r => r.diagnosticTrace.localPointGeometry.zMedian - r.diagnosticTrace.refinedBest.z;
  const med = l => { const v = l.map(ecart).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  assert.ok(med(FAIL) > band * 3, 'l’écart médian des échecs dépasse largement la bande');
  assert.ok(Math.abs(med(CTL)) < band, 'chez les témoins il reste dans la bande');
  const sans = FAIL.filter(r => r.failureFamily === 'aucun-support-nulle-part-sur-la-grille');
  assert.equal(sans.filter(r => Math.abs(ecart(r)) > band).length, 50);
});

test('l’asymétrie droite/gauche n’est PAS un bug de signe — preuve directe', () => {
  /* `sign` suit le côté de façon parfaitement régulière : gauche → +1,
   * droite → −1, dans les deux cohortes. */
  for (const r of ROWS)
    assert.equal(r.diagnosticTrace.sign, r.key.side === 'left' ? 1 : -1,
      `signe irrégulier sur ${r.key.side}`);
  /* Et surtout : 56 rails DROITS réussissent avec le même signe −1. Un signe
   * fautif ne pourrait pas produire 56 succès. L'asymétrie est donc une
   * propriété de la POPULATION, pas de l'arithmétique. */
  assert.equal(S.control.bySide.right, 56);
  assert.equal(S.control.sign['-1'], 56);
  assert.equal(S.failure.sign['-1'], 58);
  assert.equal(S.failure.sign['1'], 5);
  // les mêmes opérations sont appliquées des deux côtés : un seul chemin de code
  const src = fs.readFileSync(path.join(ROOT, 'tools/running-surface-failure-lab.cjs'), 'utf8');
  assert.ok(!/if\s*\(\s*side\s*===\s*['"](left|right)['"]/.test(src),
    'le traceur ne doit pas brancher sur le côté');
});

test('la session 3876864f n’a produit AUCUN candidat, les autres si', () => {
  const parSession = {};
  for (const r of ROWS) {
    const k = r.key.sessionId;
    (parSession[k] ??= { fail: 0, ctl: 0 });
    parSession[k][r.cohort === 'failure' ? 'fail' : 'ctl']++;
  }
  const totale = Object.entries(parSession).filter(([, v]) => v.ctl === 0 && v.fail > 0);
  assert.equal(totale.length, 1, 'une seule session est en échec total');
  assert.ok(totale[0][0].startsWith('3876864f'));
  assert.equal(totale[0][1].fail, 17);
});

test('la tranche dégradée n’explique rien : les 63 sont causalement admissibles', () => {
  assert.deepEqual(S.causallyAdmissible, { true: 63 });
  for (const r of FAIL) {
    assert.equal(r.causallyAdmissible, true);
    assert.notEqual(r.degradationContext.slice, 'after-last-lossless-snapshot');
  }
  assert.equal(S.degradation['after-last-lossless-snapshot'] ?? 0, 0);
  assert.equal(S.degradation['before-last-lossless-snapshot'], 10);
});

test('les hypothèses sont des compatibilités, jamais des conclusions', () => {
  for (const h of L.HYPOTHESES) assert.ok(h in S.hypothesisCompatibility, 'hypothèse non testée : ' + h);
  for (const r of FAIL) assert.equal(r.hypotheses.note,
    'compatibilité observée, jamais une conclusion ni une règle');
  // une hypothèse peut être compatible avec zéro cas : on le publie quand même
  assert.equal(S.hypothesisCompatibility['voisin-supporte-a-perte-quasi-egale'], 0);
  assert.equal(S.hypothesisCompatibility['aucun-placement-supporte-sur-toute-la-grille'], 56);
  assert.equal(S.hypothesisCompatibility['raffinement-quitte-une-zone-supportee'], 2);
});

test('le post-hoc n’est qu’une observation : aucun seed caché n’était correct', () => {
  const q = FAIL.filter(r => r.postHocEvaluation.qualified);
  assert.equal(q.length, 63);
  /* Le seed que le traceur reconstitue n'a JAMAIS été publié par le moteur.
   * Aucun n'aurait été satisfaisant : ces échecs ne sont donc pas un simple
   * problème de publication. */
  assert.equal(q.filter(r => r.postHocEvaluation.unpublishedSeedWithinTolerance).length, 0);
  for (const r of q) assert.ok(r.postHocEvaluation.note.includes('pas une récupération'));
});

/* ---- 6. intégrité des lots précédents et déterminisme -------------------- */

test('géométrie, moteur V4.6, Brain et Pair Arbitration sont inchangés', () => {
  const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
  const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json')));
  for (const [rel, want] of Object.entries(pinned)) {
    if (rel === 'src/engine.js') continue;
    assert.equal(sha(rel), want, `${rel} a changé`);
  }
  assert.equal(sha('src/engine.js'),
    'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3', 'moteur V4.6 modifié');
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.6.0-engine-baseline.json')));
  for (const [rel, want] of Object.entries(base.unchangedSince440)) assert.equal(sha(rel), want);
  for (const [f, want] of [
    ['audit/pair-arbitration-policy-pair-joint-v1.json',
     'af2721d297937fefa73cd132567b32e8f5d001d4dc6d1a14e5bf2e00cc58ff1f'],
    ['audit/pair-arbitration-policy-lock-resolved-rail-v1.json',
     '21d57823da2615875e330c0a3b226191e505e43881329bd0f23b246c0fd87a36'],
  ]) assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, f))).sha256, want, `${f} a changé`);
  // le Brain existe et n'est pas touché par ce lot
  assert.ok(fs.existsSync(path.join(ROOT, 'src/geometry-brain.js')));
});

test('Shadow V1.3 et Candidate Generation Diagnostics sont intacts', () => {
  const sh = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/flank-support-shadow-v1.json')));
  assert.equal(sh.format, 'banane-flank-support-shadow-v1.3');
  assert.equal(sh.sha256, '23f71c19056fb38bc2c442cf35da87b9373f6a64276f161afcd8fa611a16eee7');
  const cg = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/candidate-generation-diagnostics-v1.json')));
  assert.equal(cg.format, 'banane-candidate-generation-diagnostics-v1');
  assert.equal(cg.sha256, 'fd9004413836b986627b94d065f6a67f233ca14a81a562975d8525d2f8f1be7f');
  // ce lot se raccorde à eux sans les redéfinir
  assert.equal(cg.summary.noCandidate.byExitReason['Plan de roulement non estimable.'], 63);
  assert.equal(FAIL.length, 63);
});

test('l’empreinte de l’artefact est recalculable, horodatage exclu', () => {
  const h = { format: A.format, engine: A.engine, tracer: A.tracer, summary: A.summary, rows: A.rows };
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(h)).digest('hex'), A.sha256);
  assert.deepEqual(A.sha256Covers, ['format', 'engine', 'tracer', 'summary', 'rows']);
  assert.ok(!A.sha256Covers.includes('generatedAt'));
  // déterminisme structurel : aucune fermeture ni champ volatil n'a survécu
  for (const r of ROWS) if (r.localSupportLandscape)
    assert.ok(!('topRowsAt' in r.localSupportLandscape), 'fermeture non sérialisable exportée');
});
