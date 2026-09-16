'use strict';
/* Garde-fous du Flank Support Shadow V1, vérifiés DEPUIS L'ARTEFACT SEUL.
 *
 * Aucun test ne relit la collecte de 34 Mo : tout se recalcule depuis
 * `audit/flank-support-shadow-v1.json`, comme le ferait un tiers n'ayant que le
 * dépôt. Aucun seuil n'est choisi, aucun gagnant n'est désigné. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const F = require('../tools/flank-support-shadow.cjs');

const ROOT = path.resolve(__dirname, '..');
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/flank-support-shadow-v1.json')));
assert.equal(A.format, 'banane-flank-support-shadow-v1.2');
const ROWS = A.rows;
const FLANK = ROWS.filter(r => r.population === 'flank-only');
const CORPUS = n => A.corpora.find(c => c.name === n);
const HIST = CORPUS('historical-original'), FINAL = CORPUS('final-complementary');

/** Toutes les clés d'un objet, récursivement, avec leur chemin. */
function keysOf(o, base = '') {
  const out = [];
  (function walk(v, p) {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push([k, `${p}.${k}`]); walk(x, `${p}.${k}`); }
  })(o, base);
  return out;
}

test('le snapshot est EXACT, sinon fail-closed — jamais de repli silencieux', () => {
  assert.equal(A.snapshotPolicy.exactOnly, true);
  assert.equal(A.snapshotPolicy.fallbackToLastSnapshot, false);
  for (const r of ROWS) {
    if (r.population.startsWith('not-replayable')) continue;
    assert.ok(r.decisionFeatures.snapshotId, 'un rail rejoué doit nommer son snapshot');
    assert.equal(r.eligibility.failClosed, null, 'un rail rejoué ne peut pas être fail-closed');
  }
  for (const r of ROWS) {
    if (r.eligibility.failClosed === null) continue;
    assert.equal(r.population, 'not-replayable-fail-closed');
    assert.equal(r.decisionFeatures.status, null, 'un rail refusé ne doit porter aucune décision');
    assert.deepEqual(r.decisionFeatures.candidates, { seed: null, surfaceIntersection: null, alternative: null });
  }
  /* Le motif de refus, quand il existe, est l'un des motifs déclarés — jamais
   * un repli déguisé. */
  const connus = ['snapshotId-absent', 'snapshotId-introuvable', 'snapshotId-ambigu',
                  'aucun-snapshot', 'pose-absente-du-snapshot', 'chunk-nomme-absent', 'aucun-point'];
  for (const r of ROWS) if (r.eligibility.failClosed)
    assert.ok(connus.includes(r.eligibility.failClosed), 'motif inconnu : ' + r.eligibility.failClosed);
  /* Constat, et non hypothèse : sur cette collecte aucun rail n'est refusé.
   * Le fail-closed est donc une garantie, pas une correction rétroactive. */
  for (const c of A.corpora) assert.deepEqual(c.summary.failClosed, {});
  assert.deepEqual(A.combinedDay.summary.failClosed, {});
});

test('aucune clé humaine dans decisionFeatures, causalHistory, oppositeRailContext', () => {
  const interdit = /human|operator|label|final|reference|oracle|verdict|truth|error/i;
  for (const bloc of A.blocks.humanFreeBlocks) {
    assert.ok(['decisionFeatures', 'causalHistory', 'oppositeRailContext'].includes(bloc));
    for (const r of ROWS) for (const [k, chemin] of keysOf(r[bloc], bloc))
      assert.ok(!interdit.test(k), `clé « ${k} » interdite en ${chemin} `
        + `(rail ${r.decisionFeatures.target.part}/${r.decisionFeatures.target.cut}/${r.decisionFeatures.side})`);
  }
  // et l'humain est bien présent, lui, dans le seul bloc qui y a droit
  assert.equal(A.blocks.humanBlock, 'postHocEvaluation');
  assert.ok(ROWS.some(r => r.postHocEvaluation.humanDeltaLocal));
  /* Aucune valeur numérique du bloc humain ne doit se retrouver dans les trois
   * autres : contrôle par les VALEURS, pas seulement par les noms. */
  for (const r of FLANK.slice(0, 60)) {
    const h = r.postHocEvaluation.humanDeltaLocal;
    if (!h) continue;
    const brut = JSON.stringify([r.decisionFeatures, r.causalHistory, r.oppositeRailContext]);
    for (const v of h) if (v !== 0) assert.ok(!brut.includes(String(v)),
      `la valeur humaine ${v} apparaît dans un bloc sans humain`);
  }
});

test('l’ancre causale est toujours STRICTEMENT antérieure', () => {
  for (const r of ROWS) {
    const c = r.causalHistory;
    if (!c.anchorFound) { assert.equal(c.anchor, null); continue; }
    assert.ok(c.anchor.visitIndex < r.decisionFeatures.visitIndex,
      `ancre non antérieure : ${c.anchor.visitIndex} >= ${r.decisionFeatures.visitIndex}`);
    assert.ok(c.anchor.visitIndexGap > 0);
    assert.equal(c.anchor.visitIndexGap, r.decisionFeatures.visitIndex - c.anchor.visitIndex);
  }
});

test('l’ancre n’est JAMAIS une abstention, même stable', () => {
  const parCle = new Map();
  for (const r of ROWS) parCle.set(`${r.decisionFeatures.sessionId}|${r.decisionFeatures.visitId}|${r.decisionFeatures.side}`, r);
  for (const r of ROWS) {
    const c = r.causalHistory;
    if (!c.anchorFound) continue;
    assert.equal(c.anchor.anchorStatus, 'candidate',
      'une abstention ne peut pas servir d’ancre, même répétée à l’identique');
    const src = ROWS.find(o => o.decisionFeatures.sessionId === r.decisionFeatures.sessionId
      && o.decisionFeatures.visitId === c.anchor.visitId
      && o.decisionFeatures.side === r.decisionFeatures.side);
    assert.ok(src, 'l’ancre doit exister dans le corpus');
    assert.equal(src.population, 'engine-candidate');
  }
});

test('l’ancre ne traverse ni côté, ni session, ni page, ni frame, ni part', () => {
  for (const r of ROWS) {
    const c = r.causalHistory;
    if (!c.anchorFound) continue;
    const src = ROWS.find(o => o.decisionFeatures.sessionId === r.decisionFeatures.sessionId
      && o.decisionFeatures.visitId === c.anchor.visitId
      && o.decisionFeatures.side === r.decisionFeatures.side);
    const a = src.decisionFeatures, k = r.decisionFeatures;
    assert.equal(a.sessionId, k.sessionId);
    assert.equal(a.side, k.side);
    assert.equal(a.target.pageId, k.target.pageId);
    assert.equal(a.target.frameId, k.target.frameId);
    assert.equal(a.target.part, k.target.part);
  }
  // aucune fenêtre maximale n'est retenue
  for (const r of ROWS) assert.equal(r.causalHistory.windowChosen, null);
});

test('l’ancre est bien la plus RÉCENTE antérieure, et le calcul est reproductible', () => {
  /* Déterminisme et pureté : recalculer causalHistory et oppositeRailContext à
   * partir des seuls decisionFeatures stockés doit redonner l'identique. */
  const byKey = new Map();
  for (const r of ROWS) byKey.set(`${r.decisionFeatures.sessionId}|${r.decisionFeatures.visitId}|${r.decisionFeatures.side}`, r);
  for (const r of ROWS.slice(0, 400)) {
    /* V1.2 ajoute `admissible`, `admissibility` et `clean` par-dessus l'histoire
     * DESCRIPTIVE. C'est cette dernière qui doit rester purement reproductible. */
    const { admissible, admissibility, clean, ...descriptive } = r.causalHistory;
    assert.deepEqual(F.causalHistory(r, ROWS), descriptive);
    assert.deepEqual(F.oppositeRailContext(r, byKey), r.oppositeRailContext);
  }
});

/* ---- V1.2 : admissibilité causale ---------------------------------------- */

test('une ligne d’une tranche dégradée est décrite mais NON admissible', () => {
  const degradees = ROWS.filter(r => r.degradation.excludedFromCausalAnalysis === true);
  assert.equal(degradees.length, 288);
  for (const r of degradees) {
    assert.equal(r.causalHistory.admissible, false);
    assert.equal(r.causalHistory.admissibility.status, 'excluded-degraded-slice');
    // ses données descriptives et son post-hoc sont CONSERVÉS : on ne jette rien
    assert.ok(r.decisionFeatures, 'les features restent');
    assert.ok(r.postHocEvaluation, 'le post-hoc reste');
    assert.ok('anchorFound' in r.causalHistory, 'l’histoire descriptive reste');
    // mais elle n'a aucune ancre propre
    assert.equal(r.causalHistory.clean.anchorFound, false);
    assert.equal(r.causalHistory.clean.reason, 'ligne-non-admissible');
  }
  for (const r of ROWS) if (r.degradation.excludedFromCausalAnalysis !== true)
    assert.equal(r.causalHistory.admissible, true);
});

test('aucune ligne dégradée ne sert d’ancre à une analyse propre', () => {
  const degradees = new Set(ROWS.filter(r => r.causalHistory.admissible === false)
    .map(r => `${r.decisionFeatures.sessionId}|${r.decisionFeatures.visitId}|${r.decisionFeatures.side}`));
  assert.ok(degradees.size > 0);
  for (const r of ROWS) {
    const c = r.causalHistory.clean;
    if (!c.anchorFound) continue;
    const k = `${r.decisionFeatures.sessionId}|${c.anchor.visitId}|${r.decisionFeatures.side}`;
    assert.ok(!degradees.has(k),
      `ancre propre issue d’une tranche dégradée : ${r.decisionFeatures.target.cut}`);
  }
});

test('les lignes antérieures à la frontière gardent EXACTEMENT leur histoire V1.1', () => {
  /* Propriété vraie par construction — une ligne dégradée a toujours un
   * visitIndex supérieur à la frontière, donc ne peut précéder une ligne
   * admissible — et vérifiée ici plutôt que supposée. */
  let verifiees = 0;
  for (const r of ROWS) {
    if (!r.causalHistory.admissible) continue;
    const { admissible, admissibility, clean, ...descriptive } = r.causalHistory;
    assert.deepEqual(clean, descriptive,
      `l’ancre propre diffère de l’ancre descriptive (cut ${r.decisionFeatures.target.cut})`);
    verifiees++;
  }
  assert.equal(verifiees, 4042);
  // et aucune ligne admissible n'a un visitIndex postérieur à sa frontière
  for (const r of ROWS) {
    const b = r.degradation.lastLosslessVisitIndex;
    if (b === null || !r.causalHistory.admissible) continue;
    assert.ok(r.decisionFeatures.visitIndex <= b);
  }
});

test('les compteurs descriptifs et causal-clean sont publiés SÉPARÉMENT', () => {
  for (const s of [...A.corpora.map(c => c.summary), A.combinedDay.summary]) {
    assert.ok(s.causalAnchors.descriptive && s.causalAnchors.causalClean);
    const d = s.causalAnchors.descriptive, c = s.causalAnchors.causalClean;
    assert.equal(c.rails, d.rails - c.excludedRails);
    assert.equal(c.flankOnly, d.flankOnly - c.excludedFlankOnly);
    // le jeu propre ne peut jamais compter PLUS d'ancres que le descriptif
    assert.ok((c.anchorFound.true ?? 0) <= (d.anchorFound.true ?? 0));
  }
  // le corpus historique n'a aucune tranche dégradée : les deux jeux coïncident
  const h = HIST.summary.causalAnchors;
  assert.equal(h.causalClean.excludedRails, 0);
  assert.deepEqual(h.causalClean.anchorFound, h.descriptive.anchorFound);
  // le corpus final en a : les deux jeux diffèrent, et c'est le but
  const f = FINAL.summary.causalAnchors;
  assert.equal(f.causalClean.excludedRails, 288);
  assert.equal(f.causalClean.excludedFlankOnly, 1);
  assert.equal(f.descriptive.anchorFound.true, 87);
  assert.equal(f.causalClean.anchorFound.true, 86);
});

test('aucun candidat n’est créé : trois familles, composante x nulle', () => {
  for (const r of ROWS) {
    const c = r.decisionFeatures.candidates;
    assert.deepEqual(Object.keys(c).sort(), ['alternative', 'seed', 'surfaceIntersection']);
    for (const [n, v] of Object.entries(c)) {
      if (v === null) continue;
      assert.equal(v.length, 3);
      assert.equal(v[0], 0, `${n} : la recherche du moteur est 2D, x doit être exactement nul`);
      assert.ok(v.every(Number.isFinite));
    }
    // un rail sans décision ne porte aucun candidat
    if (r.decisionFeatures.status === null)
      assert.ok(Object.values(c).every(v => v === null));
  }
  /* Les écarts entre familles sont bien les distances des candidats exposés, et
   * ne sont donc pas des placements nouveaux. */
  for (const r of FLANK) {
    const d = r.decisionFeatures;
    if (d.candidates.seed && d.candidates.surfaceIntersection)
      assert.ok(Math.abs(d.seedToSurface - F.norm(d.candidates.seed, d.candidates.surfaceIntersection)) < 1e-12);
    if (d.candidates.seed && d.candidates.alternative)
      assert.ok(Math.abs(d.seedToAlternative - F.norm(d.candidates.seed, d.candidates.alternative)) < 1e-12);
    if (d.candidates.seed)
      assert.ok(Math.abs(d.seedMagnitudeFromInitialPose - F.mag(d.candidates.seed)) < 1e-12);
  }
});

test('« flank-only » est le motif EXACT, jamais un motif joint', () => {
  assert.equal(F.FLANK_REASON, 'Flanc interne insuffisamment observé.');
  const src = fs.readFileSync(path.join(ROOT, 'src/geometry.js'), 'utf8');
  assert.ok(src.includes(F.FLANK_REASON), 'le motif doit être cité mot pour mot depuis geometry.js');
  for (const r of FLANK) {
    assert.deepEqual(r.decisionFeatures.abstentionReasons, [F.FLANK_REASON]);
    assert.equal(r.decisionFeatures.status, 'unresolved');
  }
  /* Un rail qui manque AUSSI d'un autre appui est une population distincte :
   * `geometry.js` joint ses motifs par un espace, et les confondre reviendrait
   * à étudier un autre objet. */
  for (const r of ROWS.filter(x => x.population === 'flank-with-others')) {
    assert.ok(r.decisionFeatures.abstentionReasons.join(' ').includes(F.FLANK_REASON));
    assert.notDeepEqual(r.decisionFeatures.abstentionReasons, [F.FLANK_REASON]);
  }
  for (const r of ROWS.filter(x => x.population === 'other-abstention'))
    assert.ok(!r.decisionFeatures.abstentionReasons.join(' ').includes(F.FLANK_REASON));
});

test('le rail opposé est exposé, jamais déplacé', () => {
  for (const r of ROWS) {
    const o = r.oppositeRailContext;
    assert.equal(o.railMoved, false);
    assert.ok(F.OPPOSITE_STATES.includes(o.state), 'état inconnu : ' + o.state);
    assert.notEqual(o.side, r.decisionFeatures.side);
  }
  assert.deepEqual(F.OPPOSITE_STATES, ['opposite-candidate', 'opposite-flank-only',
    'opposite-other-abstention', 'opposite-no-candidate', 'opposite-not-replayable']);
  // les cinq états sont bien distingués sur la population étudiée
  const vus = new Set(FLANK.map(r => r.oppositeRailContext.state));
  assert.ok(vus.size >= 4, 'les états du rail opposé doivent être réellement discriminés');
});

test('dégradation : LUE dans les métadonnées, jamais déduite du statut de visite', () => {
  const sid = '0c58c033-f2e7-4aa5-ad8c-80b081a83932';
  const deg = FINAL.degradation.find(d => d.sessionId === sid);
  assert.ok(deg, 'la session dégradée doit être présente dans le corpus final');
  assert.equal(deg.anyLoss, true);
  /* La frontière est le DERNIER export explicitement sans perte, et le premier
   * export dégradé est identifié par ses vrais signaux — pas par visitStatus ni
   * lidarStatus, qui ne parlent pas de perte d'événements. */
  assert.equal(deg.lastLosslessExport.file, 'banane-native-v4-2026-09-16T13-18-15-auto-seg06.json');
  assert.equal(deg.lastLosslessExport.maxVisitIndex, 245);
  assert.equal(deg.firstDegradedExport.file, 'banane-native-v4-2026-09-16T13-25-47-seg01.json');
  assert.deepEqual(deg.firstDegradedExport.reasons,
    ['dropped=65', 'degradationEvents=2', 'degradationPeak=METADATA_ONLY']);
  for (const e of deg.perExport) {
    const g = e.signals;
    assert.equal(e.lossless, g.dropped === 0 && g.degradationEvents === 0
      && g.degradationPeak === 'FULL' && g.sequenceGap === 0);
    // aucun signal de perte ne vient d'un champ de complétude de visite
    for (const k of Object.keys(g)) assert.ok(!/visitStatus|lidarStatus/.test(k));
  }
  // chaque ligne de la session est marquée par rapport à cette vraie frontière
  const mine = ROWS.filter(r => r.decisionFeatures.sessionId === sid);
  assert.equal(mine.length, 780);
  for (const r of mine) {
    assert.equal(r.degradation.degradedSession, true);
    assert.equal(r.degradation.lastLosslessVisitIndex, 245);
    assert.equal(r.degradation.slice,
      r.decisionFeatures.visitIndex > 245 ? 'after-last-lossless-snapshot' : 'before-last-lossless-snapshot');
    assert.equal(r.degradation.excludedFromCausalAnalysis, r.degradation.slice === 'after-last-lossless-snapshot');
  }
  assert.equal(mine.filter(r => r.degradation.slice === 'before-last-lossless-snapshot').length, 492);
  assert.equal(mine.filter(r => r.degradation.slice === 'after-last-lossless-snapshot').length, 288);
  // une session sans aucune perte est dite telle, jamais « not-applicable » par défaut
  for (const r of ROWS) assert.ok(['lossless-throughout', 'before-last-lossless-snapshot',
    'after-last-lossless-snapshot'].includes(r.degradation.slice), r.degradation.slice);
});

test('ingestion tolérante : les sidecars sont ignorés ET rapportés avec leur motif', () => {
  const ign = Object.fromEntries(FINAL.ignoredSidecars.map(x => [x.file, x]));
  assert.equal(FINAL.ignoredSidecars.length, 2);
  /* Piège réel : le bilan porte le BON format et n'a pourtant pas de session.
   * Le format seul ne peut donc pas servir de critère. */
  const bilan = ign['banane-bilan-v4-2026-09-16T12-09-38-seg01.json'];
  assert.equal(bilan.format, 'banane-native-session-v3-compact');
  assert.equal(bilan.reason, 'champ-manquant:session');
  assert.equal(ign['banane-journal-v4-1789560584630.json'].reason, 'format-non-natif:banane-test-journal-v4');
  assert.deepEqual(HIST.ignoredSidecars, [], 'le corpus historique n’a aucun sidecar');
  // le classificateur ne suppose jamais la présence des champs
  assert.equal(F.classifyExport(null), 'racine-non-objet');
  assert.equal(F.classifyExport([]), 'racine-non-objet');
  assert.equal(F.classifyExport({}), 'format-non-natif:absent');
  assert.equal(F.classifyExport({ format: 'banane-native-session-v3-compact' }), 'champ-manquant:session');
  assert.equal(F.classifyExport({ format: 'banane-native-session-v3-compact', session: {}, segment: {},
    records: [], dictionaries: {} }), 'champ-manquant:session.id');
  assert.equal(FINAL.files, FINAL.nativeExports + FINAL.ignoredSidecars.length);
});

test('reliableObservation : critère du projet repris VERBATIM, statut brut conservé', () => {
  assert.equal(A.reliableObservationCriterion.invented, false);
  assert.equal(A.reliableObservationCriterion.source,
    'src/native-session.js — referenceReasons, repris verbatim');
  /* Les motifs produits doivent être exactement ceux que native-session.js sait
   * produire — aucun motif inventé ne doit apparaître. */
  const src = fs.readFileSync(path.join(ROOT, 'src/native-session.js'), 'utf8');
  const vus = new Set();
  for (const r of ROWS) for (const m of r.postHocEvaluation.reliableObservation.reasons) vus.add(m);
  for (const m of vus) assert.ok(src.includes(m), `motif « ${m} » absent de native-session.js`);
  // la fenêtre de fraîcheur est celle du projet, pas une nouvelle
  assert.ok(src.includes('freshnessMs>1500'));
  for (const r of ROWS) assert.deepEqual(r.postHocEvaluation.reliableObservation.freshnessWindowMs, [0, 1500]);
  // le statut BRUT est conservé à côté, jamais réécrit
  for (const r of ROWS) assert.ok(['candidate-observed', 'absent', 'not-observed']
    .includes(r.postHocEvaluation.humanStatus) || typeof r.postHocEvaluation.humanStatus === 'string');
  /* Contrôle de cohérence : tout rail rejoué satisfait déjà le critère, parce
   * que `comparable-candidate` l'exige. Le sous-ensemble fiable ne mord donc
   * pas sur la population étudiée — et c'est un RÉSULTAT, pas un oubli. */
  for (const r of ROWS) if (!r.population.startsWith('not-replayable'))
    assert.equal(r.postHocEvaluation.reliableObservation.reliable, true,
      'un rail comparable-candidate doit satisfaire le critère observationnel');
  // il mord en revanche sur la population entière, ce qui prouve qu'il est bien calculé
  const tous = ROWS.filter(r => r.postHocEvaluation.humanStatus === 'candidate-observed');
  const fiables = tous.filter(r => r.postHocEvaluation.reliableObservation.reliable);
  assert.ok(fiables.length < tous.length, 'le critère doit exclure quelque chose quelque part');
  // et les compteurs sont publiés des DEUX côtés
  for (const s of [...A.corpora.map(c => c.summary), A.combinedDay.summary]) {
    assert.ok(s.flankOnly.postHoc.allCandidateObserved);
    assert.ok(s.flankOnly.postHoc.reliableObservationOnly);
    assert.ok(s.allPopulationsPostHoc.reliableObservationOnly);
  }
});

test('pointsUsed est renseigné, et distinct des points fournis', () => {
  for (const r of ROWS) {
    const d = r.decisionFeatures;
    if (r.population.startsWith('not-replayable')) { assert.equal(d.pointsUsed, null); continue; }
    /* Les points fournis sont toujours connus dès qu'on a rejoué. Les points
     * RETENUS ne le sont que si le moteur est allé jusqu'à ses métriques : sur
     * un `no-candidate`, il abandonne avant, et `null` est alors la vérité. */
    assert.ok(Number.isInteger(d.pointsSupplied) && d.pointsSupplied > 0,
      `pointsSupplied doit être renseigné (rail ${d.target.part}/${d.target.cut}/${d.side})`);
    if (r.population === 'no-candidate') { assert.equal(d.pointsUsed, null); continue; }
    assert.ok(Number.isInteger(d.pointsUsed) && d.pointsUsed > 0,
      `pointsUsed doit être renseigné (rail ${d.target.part}/${d.target.cut}/${d.side})`);
    assert.ok(d.pointsUsed <= d.pointsSupplied,
      'le moteur ne peut pas retenir plus de points qu’on ne lui en fournit');
  }
  // les deux champs diffèrent réellement : ce n'est pas un doublon
  assert.ok(ROWS.some(r => r.decisionFeatures.pointsUsed !== null
    && r.decisionFeatures.pointsUsed < r.decisionFeatures.pointsSupplied));
  assert.ok(!ROWS.some(r => 'pointsInCapture' in r.decisionFeatures),
    'le champ mal nommé de V1 ne doit plus exister');
});

test('les résultats du corpus historique de 679 visites sont INCHANGÉS', () => {
  /* V1.1 ajoute des champs et corrige l'ingestion ; elle ne doit toucher aucun
   * résultat du corpus historique. Chiffres figés depuis l'artefact V1. */
  assert.equal(HIST.visitsRead, 679);
  assert.deepEqual(HIST.summary.population, { 'not-replayable': 1045, 'flank-only': 169,
    'engine-candidate': 99, 'flank-with-others': 24, 'other-abstention': 19, 'no-candidate': 2 });
  assert.equal(HIST.summary.flankOnly.rails, 169);
  assert.deepEqual(HIST.summary.flankOnly.anchorFound, { true: 152, false: 17 });
  assert.deepEqual(HIST.summary.flankOnly.oppositeState, { 'opposite-not-replayable': 104,
    'opposite-flank-only': 34, 'opposite-candidate': 23, 'opposite-other-abstention': 7,
    'opposite-no-candidate': 1 });
  assert.deepEqual(HIST.summary.flankOnly.postHoc.allCandidateObserved.verdicts,
    { 'seed-satisfaisant': 134, 'aucun-candidat-expose-satisfaisant': 25,
      'seed-insuffisant-autre-candidat-satisfaisant': 10 });
  assert.deepEqual(HIST.summary.flankOnly.postHoc.allCandidateObserved.otherCandidateFamily,
    { surfaceIntersection: 5, alternative: 5 });
});

test('les deux corpus restent SÉPARÉS, et combined-day est dédupliqué sans fusion', () => {
  assert.deepEqual(A.corpora.map(c => c.name), ['historical-original', 'final-complementary']);
  assert.equal(FINAL.visitsRead, 1486);
  assert.equal(A.combinedDay.deduplicationKey, 'sessionId|visitId|side');
  assert.equal(A.combinedDay.merged, false);
  // sur ce jour, les deux corpus sont disjoints : aucune session partagée
  assert.deepEqual(A.combinedDay.sharedSessions, []);
  assert.equal(A.combinedDay.overlapRows, 0);
  // les totaux se referment, donc rien n'a été ni perdu ni compté deux fois
  assert.equal(A.combinedDay.summary.rails, HIST.summary.rails + FINAL.summary.rails);
  assert.equal(A.combinedDay.summary.visits, 679 + 1486);
  assert.equal(A.combinedDay.summary.sessions, HIST.sessions.length + FINAL.sessions.length);
  assert.equal(A.combinedDay.summary.flankOnly.rails,
    HIST.summary.flankOnly.rails + FINAL.summary.flankOnly.rails);
  // chaque ligne sait de quel corpus elle vient
  for (const r of ROWS) assert.ok(['historical-original', 'final-complementary'].includes(r.corpus));
});

test('les hashes gelés sont intacts et l’artefact les porte', () => {
  const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json')));
  for (const [rel, want] of Object.entries(pinned)) {
    const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
    if (rel === 'src/engine.js') continue;            // dégelé en V4.6.0, épinglé ailleurs
    assert.equal(got, want, `${rel} : la géométrie gelée a changé`);
  }
  for (const [rel, want] of Object.entries(A.engine.frozenHashes)) {
    if (rel === 'src/engine.js') continue;
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'), want);
  }
  assert.equal(A.engine.calledWithoutOptions, true);
  assert.deepEqual(A.engine.parameters, require('../src/geometry.js').DEFAULTS);
});

test('moteur, Brain et Pair Arbitration sont inchangés par ce lot', () => {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.6.0-engine-baseline.json')));
  const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
  // les trois fichiers gelés depuis 4.4.0, recopiés à l'identique dans la baseline
  for (const [rel, want] of Object.entries(base.unchangedSince440))
    assert.equal(sha(rel), want, `${rel} a changé`);
  // et le moteur, dégelé en V4.6.0 puis ré-épinglé
  assert.equal(sha('src/engine.js'), base.engine['src/engine.js'], 'src/engine.js a changé');
  assert.equal(base.engine['src/engine.js'],
    'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3');
  // les deux artefacts Pair Arbitration gardent leur empreinte publiée
  for (const [f, sha] of [
    ['audit/pair-arbitration-policy-pair-joint-v1.json',
     'af2721d297937fefa73cd132567b32e8f5d001d4dc6d1a14e5bf2e00cc58ff1f'],
    ['audit/pair-arbitration-policy-lock-resolved-rail-v1.json',
     '21d57823da2615875e330c0a3b226191e505e43881329bd0f23b246c0fd87a36'],
  ]) assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, f))).sha256, sha, `${f} a changé`);
});

test('l’empreinte du shadow est recalculable, horodatage exclu', () => {
  const h = { format: A.format, studiedAbstention: A.studiedAbstention, engine: A.engine,
              snapshotPolicy: A.snapshotPolicy, corpora: A.corpora,
              combinedDay: A.combinedDay, rows: A.rows };
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(h)).digest('hex'), A.sha256);
  assert.deepEqual(A.sha256Covers, ['format', 'studiedAbstention', 'engine', 'snapshotPolicy', 'corpora', 'combinedDay', 'rows']);
  assert.ok(!A.sha256Covers.includes('generatedAt'));
});

test('aucun seuil, aucun score combiné, aucun gagnant n’est retenu', () => {
  const brut = JSON.stringify(A);
  for (const interdit of ['"threshold"', '"score"', '"classifier"', '"winner"', '"recommended"', '"chosen"'])
    assert.ok(!brut.includes(interdit), `le shadow ne doit rien retenir : ${interdit}`);
  assert.equal(A.evaluationConvention.tolerance, 0.010);
  assert.deepEqual(A.evaluationConvention.neverA, ['seuil runtime', 'calibration physique']);
  for (const r of ROWS) assert.equal(r.postHocEvaluation.toleranceIsEvaluationOnly, true);
  // les trois familles sont exposées sans préférence : aucun champ ne désigne la « bonne »
  for (const r of FLANK) assert.ok(!('preferredFamily' in r.decisionFeatures));
});

test('comptages du corpus : les populations se referment', () => {
  const p = HIST.summary.population;
  assert.equal(Object.values(p).reduce((a, b) => a + b, 0), HIST.summary.rails);
  assert.equal(HIST.summary.rails, 1358);
  assert.equal(ROWS.length, 4330);
  const rejoues = ROWS.filter(r => r.corpus === 'historical-original'
    && !r.population.startsWith('not-replayable')).length;
  assert.equal(rejoues, 313, 'les rails rejoués doivent correspondre au lot précédent');
  assert.equal(p['flank-only'], 169);
  assert.equal(p['flank-only'] + p['flank-with-others'] + p['other-abstention']
    + p['engine-candidate'] + p['no-candidate'], 313);
  // la population étudiée est cohérente avec ses ventilations
  const f = HIST.summary.flankOnly;
  assert.equal(f.rails, 169);
  assert.equal(Object.values(f.bySide).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.byPart).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.oppositeState).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.postHoc.allCandidateObserved.verdicts).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.anchorFound).reduce((a, b) => a + b, 0), 169);
});
