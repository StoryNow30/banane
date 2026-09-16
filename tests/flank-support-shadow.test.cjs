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
const ROWS = A.rows;
const FLANK = ROWS.filter(r => r.population === 'flank-only');

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
  assert.deepEqual(A.summary.failClosed, {});
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
    assert.deepEqual(F.causalHistory(r, ROWS), r.causalHistory);
    assert.deepEqual(F.oppositeRailContext(r, byKey), r.oppositeRailContext);
  }
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

test('session dégradée : présence VÉRIFIÉE, jamais supposée', () => {
  assert.deepEqual(F.DEGRADED_SESSIONS, ['0c58c033-f2e7-4aa5-ad8c-80b081a83932']);
  const d = A.degradedSessions.find(x => x.sessionId === F.DEGRADED_SESSIONS[0]);
  assert.ok(d, 'la session annoncée doit être rapportée, présente ou non');
  assert.equal(typeof d.present, 'boolean');
  if (!d.present) {
    assert.ok(d.note.includes('ABSENTE'), 'son absence doit être dite explicitement');
    // aucune ligne ne peut alors prétendre appartenir à une tranche dégradée
    for (const r of ROWS) {
      assert.equal(r.degradation.degradedSession, false);
      assert.equal(r.degradation.slice, 'not-applicable');
      assert.equal(r.degradation.excludedFromCausalAnalysis, false);
    }
  } else {
    for (const r of ROWS.filter(x => x.decisionFeatures.sessionId === d.sessionId)) {
      assert.ok(['before-last-lossless-snapshot', 'after-last-lossless-snapshot'].includes(r.degradation.slice));
      assert.equal(r.degradation.excludedFromCausalAnalysis,
        r.degradation.slice === 'after-last-lossless-snapshot');
    }
  }
  // chaque ligne porte une tranche, aucune n'est muette
  for (const r of ROWS) assert.ok(r.degradation && r.degradation.slice);
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
              snapshotPolicy: A.snapshotPolicy, summary: A.summary, rows: A.rows };
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(h)).digest('hex'), A.sha256);
  assert.deepEqual(A.sha256Covers, ['format', 'studiedAbstention', 'engine', 'snapshotPolicy', 'summary', 'rows']);
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

test('comptages du corpus : les populations se referment sur 1358 rails', () => {
  const p = A.summary.population;
  assert.equal(Object.values(p).reduce((a, b) => a + b, 0), ROWS.length);
  assert.equal(ROWS.length, 1358);
  const rejoues = ROWS.filter(r => !r.population.startsWith('not-replayable')).length;
  assert.equal(rejoues, 313, 'les rails rejoués doivent correspondre au lot précédent');
  assert.equal(p['flank-only'], 169);
  assert.equal(p['flank-only'] + p['flank-with-others'] + p['other-abstention']
    + p['engine-candidate'] + p['no-candidate'], 313);
  // la population étudiée est cohérente avec ses ventilations
  const f = A.summary.flankOnly;
  assert.equal(f.rails, 169);
  assert.equal(Object.values(f.bySide).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.byPart).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.oppositeState).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.postHocVerdict).reduce((a, b) => a + b, 0), 169);
  assert.equal(Object.values(f.anchorFound).reduce((a, b) => a + b, 0), 169);
});
