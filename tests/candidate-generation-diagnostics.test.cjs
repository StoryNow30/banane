'use strict';
/* Garde-fous du Candidate Generation Diagnostics V1, depuis l'artefact seul.
 * Aucun seuil, aucune règle, aucun correctif n'est validé ici : seulement que le
 * diagnostic dit la vérité sur ce que le moteur gelé fait. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const D = require('../tools/candidate-generation-diagnostics.cjs');

const ROOT = path.resolve(__dirname, '..');
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/candidate-generation-diagnostics-v1.json')));
const S = A.summary, NC = A.noCandidateRails, FU = A.flankUnsatisfiedRails;
const GEO = fs.readFileSync(path.join(ROOT, 'src/geometry.js'), 'utf8');

test('chaque étape de sortie déclarée existe MOT POUR MOT dans geometry.js', () => {
  for (const e of D.EXIT_STAGES)
    assert.ok(GEO.includes(e.reason), `motif absent de geometry.js : « ${e.reason} »`);
  for (const m of D.SUPPORT_MESSAGES) assert.ok(GEO.includes(m));
  assert.ok(GEO.includes(D.AMBIGUITY_MESSAGE));
  // la table couvre tous les `unresolved(` à message littéral du source
  const litteraux = [...GEO.matchAll(/unresolved\('([^']+)'\)/g)].map(m => m[1]);
  const connus = new Set(D.EXIT_STAGES.map(e => e.reason).concat([D.AMBIGUITY_MESSAGE]));
  for (const l of litteraux) assert.ok(connus.has(l), `sortie non répertoriée : « ${l} »`);
});

test('aucune cause n’est regroupée sous un vague « no-candidate »', () => {
  assert.equal(NC.length, 64);
  for (const r of NC) {
    assert.ok(r.exit.reason, 'chaque rail doit nommer sa sortie');
    assert.equal(r.exit.recognised, true, 'sortie non reconnue : ' + r.exit.reason);
    assert.notEqual(r.exit.stage, 'inconnu');
    assert.ok(r.exit.meaning && r.exit.after, 'une sortie doit dire ce qui précédait');
  }
  // les étapes composites sont reconnues, pas rangées en « inconnu »
  assert.ok(!Object.keys(S.exitStages).includes('inconnu'), JSON.stringify(S.exitStages));
  assert.equal(D.stageOf('Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé.').stage,
    'appuis-manquants');
  assert.equal(D.stageOf(D.AMBIGUITY_MESSAGE).stage, 'ambiguite-gabarit');
  assert.equal(D.stageOf('motif inventé'), null);
});

test('les 64 no-candidate sortent TOUS après la recherche de gabarit', () => {
  assert.deepEqual(S.noCandidate.byExitStage, { 'ajustement-post-recherche': 64 });
  assert.deepEqual(S.noCandidate.byExitReason,
    { 'Plan de roulement non estimable.': 63, 'Intersection hors de la fenêtre expérimentale.': 1 });
  assert.deepEqual(S.noCandidate.byCorpus, { 'final-complementary': 62, 'historical-original': 2 });
  /* Conséquence à ne pas manquer : la recherche avait CONVERGÉ. L'échec n'est
   * donc ni à l'entrée, ni au ROI, ni au contour. */
  for (const r of NC) assert.ok(r.exit.after.includes('recherche'), r.exit.after);
  // et le moteur n'a rien exposé à cet abandon : le banc ne l'invente pas
  for (const r of NC) {
    assert.equal(r.engineExposedMetrics, false);
    assert.deepEqual(r.builtBeforeGivingUp, { seed: null, surfaceIntersection: null, alternative: null });
    assert.equal(r.pointsUsed, null);
  }
});

test('l’échec n’est pas une pénurie d’entrée : les points sont comparables aux réussites', () => {
  const nc = S.noCandidate.concentration, ok = S.noCandidate.comparedToSucceeded;
  assert.ok(nc.pointsSupplied.median > 1000, 'les no-candidate ne manquent pas de points');
  assert.ok(nc.pointsSupplied.median > 0.5 * ok.pointsSupplied.median,
    'la médiane des points fournis reste du même ordre que celle des réussites');
  assert.ok(nc.pointsInEngineUsefulRoi.min >= 64,
    'tous franchissent le minimum de ROI utile exigé par la collecte');
  // aucune visibilité de découpe inconnue, aucun contour dégénéré
  for (const r of NC) {
    assert.equal(r.input.nullVisibility, 0);
    assert.ok(r.input.maxContourVertices > 100, 'contour dégénéré : ' + r.input.maxContourVertices);
    assert.ok(r.input.chunks >= 1);
  }
});

test('la concentration est publiée sur TOUS les axes demandés', () => {
  const c = S.noCandidate.concentration;
  for (const k of ['bySession', 'bySide', 'byPart', 'byExitStage', 'byExitReason',
                   'bySourceNodeKind', 'byChunkCount', 'byLidarStatus'])
    assert.ok(c[k] && Object.keys(c[k]).length, 'axe manquant : ' + k);
  for (const k of ['pointsSupplied', 'pointsInRoiFromCollection', 'pointsInEngineUsefulRoi',
                   'maxContourVertices'])
    assert.ok(c[k] && Number.isFinite(c[k].median), 'quantiles manquants : ' + k);
  assert.ok(c.cutRange && Number.isFinite(c.cutRange.min));
  // les totaux de chaque axe se referment sur 64
  for (const k of ['bySession', 'bySide', 'byPart', 'byExitReason', 'byLidarStatus'])
    assert.equal(Object.values(c[k]).reduce((a, b) => a + b, 0), 64, 'axe incomplet : ' + k);
});

test('l’explosion 2 → 62 est CONCENTRÉE, et le taux par session le montre', () => {
  const nc = S.noCandidate.concentration.bySession;
  const ok = S.noCandidate.comparedToSucceeded.bySession;
  const taux = {};
  for (const k of new Set([...Object.keys(nc), ...Object.keys(ok)]))
    taux[k] = (nc[k] || 0) / ((nc[k] || 0) + (ok[k] || 0));
  const chauds = Object.entries(taux).filter(([, t]) => t > 0.1).map(([k]) => k);
  assert.equal(chauds.length, 3, 'trois sessions concentrent l’échec');
  const somme = chauds.reduce((a, k) => a + (nc[k] || 0), 0);
  assert.equal(somme, 62, 'ces trois sessions portent 62 des 64 rails');
  // une session échoue à 100 % : elle n'a produit AUCUN candidat
  const total = Object.entries(taux).filter(([, t]) => t === 1);
  assert.equal(total.length, 1);
  assert.equal(nc[total[0][0]], 17);
  // les autres sessions restent sous 5 %
  for (const [k, t] of Object.entries(taux)) if (!chauds.includes(k)) assert.ok(t < 0.05, `${k} : ${t}`);
});

test('le biais de côté est réel, et mesuré contre les réussites', () => {
  assert.equal(S.noCandidate.concentration.bySide.right, 58);
  assert.equal(S.noCandidate.concentration.bySide.left, 6);
  const ok = S.noCandidate.comparedToSucceeded.bySide;
  /* Les réussites penchent dans l'autre sens : le biais n'est donc pas un effet
   * de population. */
  assert.ok(ok.left > ok.right);
});

test('les 45 flank-only sans bon candidat sont classés, sans recouvrement', () => {
  assert.equal(FU.length, 45);
  assert.equal(Object.values(S.flankUnsatisfied.byClass).reduce((a, b) => a + b, 0), 45);
  for (const r of FU) assert.ok(D.UNSATISFIED_CLASSES.includes(r.classe), r.classe);
  assert.deepEqual(S.flankUnsatisfied.byCorpus, { 'historical-original': 25, 'final-complementary': 20 });
  assert.equal(S.flankUnsatisfied.byClass['hors-fenetre-de-recherche'], 25);
  assert.equal(S.flankUnsatisfied.byClass['familles-divergentes-toutes-fausses'], 20);
});

test('« hors fenêtre » est démontrable : les bornes citées sont celles du moteur', () => {
  const cfg = require('../src/geometry.js').DEFAULTS;
  const hors = FU.filter(r => r.classe === 'hors-fenetre-de-recherche');
  assert.equal(hors.length, 25);
  for (const r of hors) {
    assert.equal(r.detail.searchWindow.searchY, cfg.searchY);
    assert.equal(r.detail.searchWindow.searchZ, cfg.searchZ);
    assert.ok(r.detail.humanY > cfg.searchY || r.detail.humanZ > cfg.searchZ,
      'un cas « hors fenêtre » doit réellement dépasser une borne du moteur');
  }
  /* Et réciproquement : aucun cas classé autrement ne dépasse les bornes — la
   * catégorie est donc exclusive, pas un fourre-tout. */
  for (const r of FU) if (r.classe !== 'hors-fenetre-de-recherche')
    assert.ok(r.detail.humanY <= cfg.searchY && r.detail.humanZ <= cfg.searchZ);
  // ce sont les bornes du moteur gelé, citées, jamais un seuil nouveau
  assert.equal(cfg.searchY, 0.08); assert.equal(cfg.searchZ, 0.04);
});

test('le détecteur d’ambiguïté humaine déclare son angle mort', () => {
  const a = S.ambiguousHumanCuts;
  assert.equal(a.scope, 'visites REJOUABLES uniquement');
  assert.ok(a.knownBlindSpot.includes('2891'), 'l’angle mort doit nommer le cas connu');
  assert.ok(a.knownBlindSpot.includes('9,851'));
  /* Un comptage à zéro ne vaut pas « aucune contradiction n’existe » : c'est
   * précisément ce que l'angle mort interdit de conclure. */
  assert.ok(Array.isArray(a.detected));
});

test('la géométrie n’est ni modifiée ni réimplémentée', () => {
  const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/v4.4.0-frozen-engine-hashes.json')));
  for (const [rel, want] of Object.entries(pinned)) {
    if (rel === 'src/engine.js') continue;
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'),
      want, `${rel} a changé`);
  }
  assert.equal(A.engine.calledWithoutOptions, true);
  assert.deepEqual(A.engine.parameters, require('../src/geometry.js').DEFAULTS);
  /* Le banc ne doit contenir aucune copie de la recherche de gabarit : ni
   * boucle de grille, ni ajustement de droite. */
  const src = fs.readFileSync(path.join(ROOT, 'tools/candidate-generation-diagnostics.cjs'), 'utf8');
  for (const interdit of ['robustLine', 'topAnchors', 'faceAnchors', 'coarseBest', 'templateLossRatio'])
    assert.ok(!src.includes(interdit), `le banc ne doit pas réimplémenter « ${interdit} »`);
  /* Les bornes de recherche sont CITÉES depuis `G.DEFAULTS`, jamais recopiées :
   * aucune constante géométrique en dur ne doit figurer dans le banc. */
  assert.ok(!/search[YZ]\s*[:=]\s*[.0-9]/.test(src), 'borne de recherche recopiée en dur');
  assert.ok(!/(minTop|minFace|topBand|faceBand|maxResidual)\s*[:=]\s*[.0-9]/.test(src),
    'paramètre géométrique recopié en dur');
  assert.ok(src.includes('cfg.searchY') && src.includes('G.DEFAULTS'),
    'les bornes doivent venir des DEFAULTS du moteur');
});

test('aucun seuil, aucune règle, aucun correctif n’est proposé', () => {
  const brut = JSON.stringify(A);
  for (const mot of ['"threshold"', '"recommendation"', '"fix"', '"rule"', '"policy"', '"winner"'])
    assert.ok(!brut.includes(mot), 'le diagnostic ne doit rien proposer : ' + mot);
  assert.ok(S.note.includes('description seulement'));
  assert.equal(A.evaluationConvention.usedFor, 'comptage uniquement');
});

test('l’empreinte est recalculable, horodatage exclu', () => {
  const h = { format: A.format, engine: A.engine, exitStages: A.exitStages, summary: A.summary,
              noCandidateRails: A.noCandidateRails, flankUnsatisfiedRails: A.flankUnsatisfiedRails };
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(h)).digest('hex'), A.sha256);
  assert.ok(!A.sha256Covers.includes('generatedAt'));
});
