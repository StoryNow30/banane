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
});

test('l’ancien diagnostic « hors-fenetre-de-recherche » est publié comme SUPERSÉDÉ', () => {
  const sup = A.supersededDiagnostic;
  assert.equal(sup.v1Class, 'hors-fenetre-de-recherche');
  assert.equal(sup.v1Count, 25);
  assert.deepEqual(sup.replacedBy,
    ['generation-unreachable-by-bounds', 'outside-nominal-window-but-not-proven-unreachable']);
  assert.ok(sup.why.includes('.004') && sup.why.includes('.01'));
  // la classe supersédée ne doit plus être attribuée à aucun rail
  assert.ok(!D.UNSATISFIED_CLASSES.includes('hors-fenetre-de-recherche'));
  for (const r of FU) assert.notEqual(r.classe, 'hors-fenetre-de-recherche');
  // et les 25 se redistribuent exactement entre les deux nouvelles classes
  const horsNominal = FU.filter(r => r.detail.reachability.outsideNominalWindow);
  assert.equal(horsNominal.length, 25);
  assert.equal(S.flankUnsatisfied.byClass['generation-unreachable-by-bounds'], 21);
  assert.equal(S.flankUnsatisfied.byClass['outside-nominal-window-but-not-proven-unreachable'], 4);
});

test('les domaines atteignables sont ceux du moteur, aucune borne inventée', () => {
  const cfg = require('../src/geometry.js').DEFAULTS;
  const dom = D.reachableDomains();
  assert.equal(dom.coarse.boundY, cfg.searchY);
  assert.equal(dom.coarse.boundZ, cfg.searchZ);
  assert.equal(dom.alternative.boundY, cfg.searchY);
  assert.equal(dom.seed.boundY, cfg.searchY + D.REFINE);
  assert.equal(dom.seed.boundZ, cfg.searchZ + D.REFINE);
  assert.equal(dom.surfaceIntersection.boundY, cfg.searchY + D.SURFACE_MARGIN);
  assert.equal(dom.surfaceIntersection.boundZ, cfg.searchZ + D.SURFACE_MARGIN);
  /* Les deux marges sont CITÉES depuis geometry.js : le raffinement ±.004 et
   * l'acceptation de l'intersection à ±.01. */
  assert.equal(D.REFINE, 0.004);
  assert.equal(D.SURFACE_MARGIN, 0.01);
  assert.ok(GEO.includes('.004,.004,.001'), 'le raffinement ±.004 doit exister dans le moteur');
  assert.ok(GEO.includes('cfg.searchY+.01') && GEO.includes('cfg.searchZ+.01'),
    'l’enveloppe surfaceIntersection ±.01 doit exister dans le moteur');
  // surfaceIntersection est bien le domaine le plus permissif
  const noms = Object.keys(dom);
  for (const n of noms) assert.ok(dom.surfaceIntersection.boundY >= dom[n].boundY
    && dom.surfaceIntersection.boundZ >= dom[n].boundZ);
});

test('cas de frontière synthétiques : la preuve ne se déclenche qu’à bon escient', () => {
  const cfg = require('../src/geometry.js').DEFAULTS;
  const T = D.TOLERANCE_ORACLE;
  const cas = [
    { nom: 'juste au-delà de searchY, encore atteignable au seed raffiné',
      human: [0, cfg.searchY + 0.002, 0], horsNominal: true, prouve: false, distMax: 0 },
    { nom: 'hors coarse mais dans l’enveloppe surfaceIntersection',
      human: [0, cfg.searchY + 0.008, 0], horsNominal: true, prouve: false, distMax: 0 },
    { nom: 'hors de tout domaine mais à moins de 0,010',
      human: [0, cfg.searchY + D.SURFACE_MARGIN + 0.005, 0], horsNominal: true, prouve: false, distMax: T },
    { nom: 'réellement au-delà de 0,010 de tout domaine permissif',
      human: [0, cfg.searchY + D.SURFACE_MARGIN + 0.050, 0], horsNominal: true, prouve: true },
  ];
  for (const c of cas) {
    const r = D.reachability(c.human, T, cfg);
    assert.equal(r.outsideNominalWindow, c.horsNominal, c.nom + ' — hors bornes nominales');
    assert.equal(r.provenUnreachable, c.prouve, c.nom + ' — preuve');
    if (c.distMax !== undefined)
      assert.ok(r.mostPermissive.minDistance <= c.distMax + 1e-12,
        `${c.nom} — distance ${r.mostPermissive.minDistance} > ${c.distMax}`);
  }
  /* Exactement à la tolérance : la preuve exige un dépassement STRICT, donc
   * un point pile à 0,010 n'est PAS déclaré impossible. */
  const pile = D.reachability([0, cfg.searchY + D.SURFACE_MARGIN + T, 0], T, cfg);
  assert.ok(Math.abs(pile.mostPermissive.minDistance - T) < 1e-12);
  assert.equal(pile.provenUnreachable, false, 'égalité stricte : pile à la tolérance reste accessible');
  /* Un écart humain en x ne peut JAMAIS être atteint : la recherche du moteur
   * est bidimensionnelle et tous ses candidats ont x exactement nul. */
  const enX = D.reachability([0.02, 0.01, 0.01], T, cfg);
  assert.equal(enX.outsideNominalWindow, false, 'y et z sont pourtant dans les bornes');
  assert.equal(enX.provenUnreachable, true, 'l’écart en x rend le placement inatteignable');
  assert.ok(Math.abs(enX.mostPermissive.minDistance - 0.02) < 1e-12);
  // et la distance à un domaine est nulle quand le point est dedans
  assert.equal(D.distanceToDomain([0, 0.01, 0.01], cfg.searchY, cfg.searchZ), 0);
});

test('chaque cas « prouvé inaccessible » porte sa preuve, et elle tient', () => {
  const cfg = require('../src/geometry.js').DEFAULTS;
  const T = D.TOLERANCE_ORACLE;
  const prouves = FU.filter(r => r.classe === 'generation-unreachable-by-bounds');
  assert.equal(prouves.length, 21);
  for (const r of prouves) {
    const re = r.detail.reachability;
    assert.equal(re.provenUnreachable, true);
    assert.ok(re.minDistanceIsStrictlyGreater ?? re.mostPermissive.minDistance > T,
      'la distance doit dépasser STRICTEMENT la tolérance');
    // la preuve est recalculable depuis la référence humaine seule
    const recalc = D.reachability([r.detail.humanX, r.detail.humanY, r.detail.humanZ], T, cfg);
    assert.ok(Math.abs(recalc.mostPermissive.minDistance - re.mostPermissive.minDistance) < 1e-12);
    assert.ok(re.proof.includes('>'), 'la preuve doit être énoncée');
    // les quatre domaines sont publiés, pas seulement le plus permissif
    assert.deepEqual(Object.keys(re.perFamily).sort(),
      ['alternative', 'coarse', 'seed', 'surfaceIntersection']);
    for (const d of Object.values(re.perFamily)) assert.ok(d.minDistance >= re.mostPermissive.minDistance - 1e-12);
  }
  /* Réciproque : aucun cas d'une autre classe n'est prouvé inaccessible. */
  for (const r of FU) if (r.classe !== 'generation-unreachable-by-bounds')
    assert.equal(r.detail.reachability.provenUnreachable, false, r.classe);
});

test('« hors bornes mais non prouvé » est une classe réelle, pas un fourre-tout', () => {
  const T = D.TOLERANCE_ORACLE;
  const cas = FU.filter(r => r.classe === 'outside-nominal-window-but-not-proven-unreachable');
  assert.equal(cas.length, 4);
  for (const r of cas) {
    const re = r.detail.reachability;
    assert.equal(re.outsideNominalWindow, true, 'elle doit vraiment sortir des bornes nominales');
    assert.equal(re.provenUnreachable, false);
    assert.ok(re.mostPermissive.minDistance > 0 && re.mostPermissive.minDistance <= T,
      `distance ${re.mostPermissive.minDistance} hors de ]0, ${T}]`);
    assert.ok(re.proof.includes('NON prouvé impossible'));
  }
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
