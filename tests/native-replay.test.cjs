'use strict';
/* Cohérence du rejeu Natif V4.6, vérifiée DEPUIS L'ARTEFACT SEUL.
 *
 * Ces tests ne relisent jamais la collecte de 34 Mo : ils recalculent tout à
 * partir de `audit/native-replay-v4.6.json`, exactement comme le ferait un tiers
 * qui n'a que le dépôt. Rien n'est réglé, rien n'est appris, aucune politique
 * n'est proposée. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const M = require('../tools/native-replay.cjs');

const A = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../audit/native-replay-v4.6.json')));
const SUM = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../audit/native-replay-v4.6-summary.json')));
const C = M.consolidate(A);
const S = ['left', 'right'];

test('le résumé livré est exactement ce que le banc recalcule depuis l’artefact', () => {
  assert.deepEqual(SUM.counts, C.counts);
  assert.deepEqual(SUM.taxonomy, C.taxonomy);
  assert.deepEqual(SUM.scoredCuts, C.scoredCuts);
  assert.deepEqual(SUM.eligibilityReasons, C.eligibilityReasons);
  assert.deepEqual(SUM.byPart, C.byPart);
});

test('effectifs par part : 503 / 176 visites et 474 / 137 cuts distincts', () => {
  assert.deepEqual(C.byPart, [
    { part: 1, visits: 503, distinctCuts: 474 },
    { part: 8, visits: 176, distinctCuts: 137 },
  ]);
  assert.equal(C.counts.visits, 503 + 176);
  assert.equal(C.counts.distinctCuts, 474 + 137);
});

test('76 = 74 + 2, et les deux prédicats sont ceux qui produisent ces chiffres', () => {
  const pair = A.rows.filter(M.pairReplayable);
  const scored = pair.filter(M.scorable);
  assert.equal(pair.length, 76);
  assert.equal(scored.length, 74);
  assert.equal(pair.length - scored.length, 2);
  assert.equal(C.counts.identity, '76 = 74 + 2');
  // « scorable » ne doit jamais désigner un cut qui n'est pas rejouable en paire
  for (const r of A.rows) if (M.scorable(r)) assert.ok(M.pairReplayable(r),
    `cut ${r.identity.part}/${r.identity.cut} classé sans être rejouable en paire`);
});

test('les 2 non-scorables : 1/326 candidat DROIT absent, 8/9656 candidat GAUCHE absent', () => {
  const m = Object.fromEntries(C.notScorable.map(x => [`${x.part}/${x.cut}`, x]));
  assert.deepEqual(Object.keys(m).sort(), ['1/326', '8/9656']);
  assert.equal(m['1/326'].missingSide, 'right');
  assert.deepEqual(m['1/326'].candidatesBySide.right, []);
  assert.equal(m['1/326'].candidatesBySide.left.length, 3);
  assert.equal(m['8/9656'].missingSide, 'left');
  assert.deepEqual(m['8/9656'].candidatesBySide.left, []);
  assert.equal(m['8/9656'].candidatesBySide.right.length, 3);
});

test('taxonomie détaillée 7 / 40 / 0 / 1 / 26, et sa somme vaut 74', () => {
  const t = C.taxonomy;
  assert.equal(t['moteur-correct'], 7);
  assert.equal(t['moteur-abstient-bon-candidat-expose'], 40);
  assert.equal(t['mauvaise-famille-alors-qu-une-autre-est-meilleure'] ?? 0, 0);
  assert.equal(t['rail-resolu-a-changer-pour-ameliorer-la-paire'], 1);
  assert.equal(t['aucun-candidat-satisfaisant'], 26);
  assert.equal(Object.values(t).reduce((a, b) => a + b, 0), 74);
  // aucune classe hors de la taxonomie déclarée
  for (const k of Object.keys(t)) assert.ok(C.taxonomyClasses.includes(k), 'classe inconnue : ' + k);
  // les 74 {part, cut, classe} sont livrés en entier et sans doublon
  assert.equal(C.scoredCuts.length, 74);
  assert.equal(new Set(C.scoredCuts.map(x => `${x.part}/${x.cut}`)).size, 74);
});

test('compteurs canoniques de geometryEligibility : statuts et motifs', () => {
  assert.deepEqual(C.eligibilityStatus, { 'comparable-candidate': 313, excluded: 1045 });
  assert.equal(313 + 1045, 2 * C.counts.visits);
  assert.equal(C.eligibilityReasons.railsNotReplayed, 1045);
  /* Un rail non rejoué porte PLUSIEURS motifs : la somme des motifs dépasse le
   * nombre de rails, et c'est normal. L'artefact le déclare explicitement pour
   * qu'aucun lecteur ne prenne 625 pour un nombre de rails. */
  assert.equal(C.eligibilityReasons.multiLabelled, true);
  const s = Object.values(C.eligibilityReasons.byReason).reduce((a, b) => a + b, 0);
  assert.equal(s, C.eligibilityReasons.occurrences);
  assert.ok(s > C.eligibilityReasons.railsNotReplayed);
  assert.equal(C.eligibilityReasons.byReason['qualified-stored-snapshot-missing'], 625);
  assert.equal(C.eligibilityReasons.byReason['validated-reference-not-observed'], 270);
  assert.equal(C.eligibilityReasons.byReason['human-final-reference-missing'], 270);
  assert.equal(C.eligibilityReasons.byReason['human-final-rail-state-missing'], 270);
  assert.equal(C.eligibilityReasons.byReason['checkpoint-not-qualified'], 226);
  assert.equal(C.eligibilityReasons.byReason['decision-effect-not-observed'], 6);
});

test('part 1 / cut 2891 : deux revisites, et le seul cas « rail résolu à changer »', () => {
  const d = M.cutDossier(A, 1, 2891);
  assert.equal(d.length, 2, 'le cut 2891 doit avoir exactement deux revisites');
  assert.deepEqual(d.map(x => x.visitIndex), [230, 232]);
  for (const v of d) assert.equal(v.observedLabelCandidate, 'VALIDATE_CORRECTED_RIGHT_ONLY');
  assert.equal(d[0].classe, 'rail-resolu-a-changer-pour-ameliorer-la-paire');
  assert.equal(d[1].classe, 'non-qualifiable');
  assert.deepEqual(d[0].eligibility, { left: 'comparable-candidate', right: 'comparable-candidate' });
  assert.deepEqual(d[1].eligibility, { left: 'excluded', right: 'excluded' });
  // c'est l'unique représentant de sa classe dans tout le corpus
  assert.deepEqual(C.scoredCuts.filter(x => x.classe === 'rail-resolu-a-changer-pour-ameliorer-la-paire'),
    [{ part: 1, cut: 2891, classe: 'rail-resolu-a-changer-pour-ameliorer-la-paire' }]);
  /* Le rail gauche n'a pas bougé (label « RIGHT_ONLY ») : le delta humain gauche
   * est exactement nul, et c'est le rail droit qui porte toute la correction. */
  assert.deepEqual(d[0].humanDeltaLocal.left, [0, 0, 0]);
  assert.ok(Math.hypot(...d[0].humanDeltaLocal.right) > 0.010,
    'la correction humaine droite doit dépasser la convention d’évaluation');
});

test('les revisites existent et sont comptées, 2891 n’est pas un cas isolé', () => {
  assert.ok(C.revisitedCuts.length > 0);
  const t = C.revisitedCuts.find(x => x.cut === '1/2891');
  assert.deepEqual(t, { cut: '1/2891', visits: 2, scorable: 1 });
  // un cut revisité ne peut pas être scoré plus de fois qu'il n'a de visites
  for (const r of C.revisitedCuts) assert.ok(r.scorable <= r.visits);
  assert.equal(A.rows.length, C.counts.visits);
});

test('aucune agrégation 58 / 15 / 1 n’est reproductible depuis l’artefact', () => {
  /* Astra cite un triplet 58/15/1 dont la somme vaut bien 74, mais aucune
   * partition des 74 cuts scorables ne le produit. Ce test EXIGE qu'il reste
   * non figé tant que son prédicat n'est pas fourni : si une future agrégation
   * le reproduit, ce test tombe et il faudra la documenter. */
  const scored = A.rows.filter(r => M.pairReplayable(r) && M.scorable(r));
  const tol = A.summary.oracleTolerance;
  const partitions = {
    classe: r => r.interpretation.classe,
    part: r => r.identity.part,
    railsResolus: r => S.filter(s => r.engine.rails[s].status === 'candidate').length,
    recuperable: r => Math.max(...S.map(s => Math.min(...Object.values(r.measure[s].errors)))) <= tol,
    moteurSousTolerance: r => S.every(s => r.measure[s].engineError !== null
      && r.measure[s].engineError <= tol),
    label: r => r.provenance.observedLabelCandidate,
    lidarStatus: r => r.provenance.lidarStatus,
    visitStatus: r => r.provenance.visitStatus,
    session: r => r.sessionId,
    meilleureFamilleParRail: r => S.map(s => Object.entries(r.measure[s].errors)
      .sort((a, b) => a[1] - b[1])[0][0] === 'alternative' ? 'alt' : 'best').join('/'),
  };
  for (const [nom, f] of Object.entries(partitions)) {
    const m = {};
    for (const r of scored) { const k = String(f(r)); m[k] = (m[k] || 0) + 1; }
    const v = Object.values(m).sort((a, b) => b - a);
    assert.notDeepEqual(v, [58, 15, 1],
      `la partition « ${nom} » reproduit 58/15/1 : il faut la documenter, plus la déclarer irreproductible`);
  }
  // le résumé livré ne doit contenir aucun triplet figé de ce genre
  assert.ok(!JSON.stringify(SUM).includes('"58"'));
});

test('le rejeu n’a lu aucune valeur humaine dans l’étage 1', () => {
  /* Étanchéité structurelle : aucune VALEUR humaine n'entre dans l'étage 1.
   * On vérifie les CLÉS, récursivement — une mesure humaine ne peut y être
   * cachée que sous un nom. */
  const cles = o => {
    const out = [];
    (function walk(v) {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === 'object') for (const k of Object.keys(v)) { out.push(k); walk(v[k]); }
    })(o);
    return out;
  };
  for (const r of A.rows) for (const k of cles(r.engine))
    assert.ok(!/human|operator|label|final/i.test(k),
      `clé « ${k} » interdite dans engine (cut ${r.identity.cut})`);
  /* Les SEULES occurrences du mot « human » dans l'étage 1 sont des chaînes de
   * motif venues de `geometryEligibility[side].reasons`, c'est-à-dire de la
   * collecte elle-même. Elles n'apportent aucune valeur mesurée. En revanche
   * elles montrent que la PORTE d'éligibilité dépend de la disponibilité d'une
   * référence humaine : les 313 rails rejoués ne sont donc pas un échantillon
   * indépendant de l'humain. Cette limite est énoncée dans le rapport ; ce test
   * la verrouille pour qu'elle ne soit pas oubliée. */
  const motifsHumains = new Set();
  for (const r of A.rows) for (const s of S)
    for (const m of r.engine.rails[s].notReplayedReasons || [])
      if (/human/i.test(m)) motifsHumains.add(m);
  assert.deepEqual([...motifsHumains].sort(), [
    'human-final-rail-state-missing',
    'human-final-reference-missing',
    'human-final-reference-not-freshly-observed',
  ]);
  for (const r of A.rows) for (const s of S) {
    const e = r.engine.rails[s];
    if (e.replayed) assert.deepEqual(e.notReplayedReasons, [],
      'un rail rejoué ne doit porter aucun motif de non-rejeu');
  }
  assert.equal(A.summary.oracleTolerance, 0.010);
  assert.equal(A.engine.calledWithoutOptions, true);
  assert.equal(A.engine.geometryMethod, 'template-surfaces-v3');
});

test('la collecte est passive : le moteur n’a rien appliqué sur le terrain', () => {
  assert.equal(A.rows.filter(r => r.provenance.commandSentByBanane).length, 0);
  assert.equal(A.rows.filter(r => r.provenance.usableForTraining).length, 0);
  assert.equal(A.rows.length, 679);
});

test('socle d’ancrage : part 1 absent, part 8 atteint tout juste', () => {
  const a = Object.fromEntries(C.anchorFeasibility.map(x => [x.part, x]));
  assert.equal(a[1].settled, 3); assert.equal(a[1].socleExists, false);
  assert.deepEqual(a[1].settledCuts, [744, 2891, 3018]);
  assert.equal(a[8].settled, 5); assert.equal(a[8].socleExists, true);
  assert.deepEqual(a[8].settledCuts, [8580, 9391, 9540, 9542, 9667]);
  for (const x of C.anchorFeasibility) { assert.equal(x.R, 5); assert.equal(x.minBase, 5); }
  /* Le cut 2891 est à la fois l'unique « rail résolu à changer » ET l'un des
   * trois seuls socles de la part 1 : ces deux faits portent sur le même cut. */
  assert.ok(a[1].settledCuts.includes(2891));
});
