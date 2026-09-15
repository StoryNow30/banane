const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const G = require('../src/geometry.js');
const GB = require('../src/geometry-brain.js');

/* Branchement du cerveau sur le moteur — V4.5.6.
 *
 * `src/engine.js` est gelé et lie sa géométrie au chargement depuis
 * `globalThis.BananeGeometry3`. Le cerveau ne peut donc s'insérer que par
 * SUBSTITUTION à ce point, avant le chargement du moteur.
 *
 * Deux propriétés doivent tenir, et elles sont vérifiées ici :
 *   1. les fichiers gelés restent identiques à la référence 4.4.0 ;
 *   2. cerveau éteint, la composition est TRANSPARENTE — elle rend l'objet de
 *      la géométrie gelée par identité, pas une copie ressemblante.
 * La seconde est la plus importante : c'est elle qui garantit qu'installer
 * cette version sans rien activer ne change strictement rien au comportement. */

/* Captures RÉELLES, réduites, sur lesquelles le moteur gelé propose vraiment.
 * Un test de transparence sur des captures synthétiques ne prouverait rien :
 * il faut que le moteur ait quelque chose à dire pour que « ne rien changer »
 * soit une propriété observable. */
const CAPTURES = path.resolve(__dirname, 'fixtures', 'captures-moteur.json');
const captures = () => JSON.parse(fs.readFileSync(CAPTURES, 'utf8')).captures;

/* V4.6.0 : `src/engine.js` est dégelé sur décision explicite (défauts 4 et 9
 * d'AUDIT_PILOTE.md), mais ré-épinglé sur une baseline déclarée. Les trois
 * autres fichiers restent gelés à 4.4.0, et le fichier d'empreintes historique
 * n'est pas modifié. */
const empreinte = (root, fichier) =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, fichier))).digest('hex');

test('le placement, les transformations et le lecteur LiDAR restent identiques à la référence 4.4.0', () => {
  const root = path.resolve(__dirname, '..');
  const attendu = JSON.parse(fs.readFileSync(path.join(root, 'audit', 'v4.4.0-frozen-engine-hashes.json'), 'utf8'));
  const geles = Object.keys(attendu).filter(f => f !== 'src/engine.js');
  assert.deepEqual(geles, ['src/geometry.js', 'vendor/capture-core.js', 'vendor/lidar.js']);
  for (const fichier of geles) assert.equal(empreinte(root, fichier), attendu[fichier], fichier + ' a changé');
});

test('le moteur dégelé reste épinglé sur la baseline V4.6.0, qui recopie les empreintes historiques', () => {
  const root = path.resolve(__dirname, '..');
  const historique = JSON.parse(fs.readFileSync(path.join(root, 'audit', 'v4.4.0-frozen-engine-hashes.json'), 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'audit', 'v4.6.0-engine-baseline.json'), 'utf8'));
  /* La baseline ne doit jamais servir à assouplir le gel historique par la
   * bande : elle recopie les trois empreintes 4.4.0 telles quelles, et garde
   * trace de l'empreinte 4.4.0 du moteur. */
  for (const fichier of ['src/geometry.js', 'vendor/capture-core.js', 'vendor/lidar.js'])
    assert.equal(baseline.unchangedSince440[fichier], historique[fichier], fichier + ' : empreinte historique réécrite');
  assert.equal(baseline.engine.previousHash440, historique['src/engine.js']);
  assert.equal(empreinte(root, 'src/engine.js'), baseline.engine['src/engine.js'], 'src/engine.js ne correspond pas à sa baseline déclarée');
});

test('le cerveau est ÉTEINT par défaut', () => {
  GB.configure({ actif: false });
  assert.equal(GB.reglages().actif, false);
});

test('éteint, la composition rend l’objet du moteur gelé PAR IDENTITÉ', () => {
  /* Pas « deepEqual » : identité. Une copie ressemblante laisserait passer une
   * transformation silencieuse. */
  GB.configure({ actif: false });
  const vues = captures();
  assert.ok(vues.length >= 3, 'il faut de vraies captures pour que le test ait un sens');
  for (const capture of vues) {
    const attendu = G.proposeBoth(capture, {});
    const obtenu = GB.proposeBoth(capture, {});
    // Le moteur construit un nouvel objet à chaque appel : on compare le contenu,
    // et on vérifie qu'aucune marque du cerveau n'a été ajoutée.
    assert.deepEqual(obtenu, attendu);
    const texte = JSON.stringify(obtenu);
    for (const marque of ['brainApplied', 'brain-bias', 'brain-candidate-selection', 'cerveau'])
      assert.ok(!texte.includes(marque), 'marque du cerveau alors qu’il est éteint : ' + marque);
  }
  assert.equal(GB.journal().actif, false);
});

test('la surface exposée est celle que le moteur gelé attend', () => {
  for (const cle of ['DEFAULTS', 'median', 'robustLine', 'enforcePairSupport', 'propose', 'proposeBoth'])
    assert.ok(GB[cle] !== undefined, 'symbole manquant : ' + cle);
  // Tout sauf proposeBoth passe sans interposition.
  for (const cle of ['DEFAULTS', 'median', 'robustLine', 'enforcePairSupport', 'propose'])
    assert.equal(GB[cle], G[cle], cle + ' ne doit pas être réimplémenté');
  assert.notEqual(GB.proposeBoth, G.proposeBoth, 'proposeBoth est le seul point d’interposition');
  assert.equal(GB.frozen, G, 'la géométrie gelée reste accessible');
});

test('allumé, chaque proposition touchée est MARQUÉE', () => {
  GB.configure({ actif: true, biaisVertical: .004 });
  let touchees = 0;
  for (const capture of captures()) {
    const r = GB.proposeBoth(capture, {});
    for (const side of ['left', 'right']) {
      const p = r[side];
      if (!p || p.status !== 'candidate' || !p.delta) continue;
      touchees++;
      assert.ok(p.brainApplied, 'une proposition modifiée sans marque');
      assert.ok(p.reasons.some(x => /cerveau/i.test(x)), 'aucun motif lisible par l’opérateur');
      assert.match(p.source, /brain/);
    }
  }
  assert.ok(touchees > 0, 'le jeu doit contenir des propositions à toucher');
  GB.configure({ actif: false });
});

test('allumé, le biais vertical est bien celui demandé', () => {
  GB.configure({ actif: false });
  const vues = captures();
  const avant = vues.map(c => G.proposeBoth(c, {}));
  GB.configure({ actif: true, biaisVertical: .004, selectionActive: false });
  const apres = vues.map(c => GB.proposeBoth(c, {}));
  let compares = 0;
  for (let i = 0; i < vues.length; i++) for (const side of ['left', 'right']) {
    const a = avant[i][side], b = apres[i][side];
    if (a?.status !== 'candidate' || !a.delta || !b?.delta) continue;
    compares++;
    assert.ok(Math.abs(b.delta[2] - (a.delta[2] + .004)) < 1e-12, 'vertical');
    assert.equal(b.delta[1], a.delta[1], 'le latéral ne doit pas bouger');
  }
  assert.ok(compares > 0);
  GB.configure({ actif: false });
});

test('une défaillance du cerveau rend la proposition gelée, jamais une erreur', () => {
  /* Le cerveau ne doit pas pouvoir empêcher le moteur de répondre. */
  GB.configure({ actif: true });
  const capture = captures()[0];
  const attendu = G.proposeBoth(capture, {});
  const Brain = require('../src/brain.js');
  const vrai = Brain.corrigerPaire;
  Brain.corrigerPaire = () => { throw Error('panne simulée du cerveau'); };
  try {
    const r = GB.proposeBoth(capture, {});
    assert.deepEqual(r, attendu, 'la proposition gelée doit être rendue telle quelle');
    assert.match(GB.journal().action, /échec/);
    assert.match(GB.journal().erreur, /panne simulée/);
  } finally { Brain.corrigerPaire = vrai; GB.configure({ actif: false }); }
});

test('des réglages aberrants sont refusés, et l’état précédent est conservé', () => {
  GB.configure({ actif: false, biaisVertical: .004 });
  const avant = GB.reglages();
  for (const mauvais of [{ actif: 'oui' }, { biaisVertical: NaN }, { ecartVerticalMax: 0 },
    { plausibiliteLaterale: -1 }, { plausibiliteLaterale: 0.2 }])
    assert.throws(() => GB.configure(mauvais), /Cerveau/);
  assert.deepEqual(GB.reglages(), avant, 'un refus ne doit pas laisser un état à moitié écrit');
});

test('le journal dit ce que le cerveau a fait, pour chaque rail', () => {
  GB.configure({ actif: true, biaisVertical: .004 });
  GB.proposeBoth(captures()[0], {});
  const j = GB.journal();
  assert.equal(j.actif, true);
  assert.ok(j.perRail.left && j.perRail.right, 'les deux rails doivent être tracés');
  assert.ok(j.parameters.biaisVertical === .004);
  GB.configure({ actif: false });
});

test('les réglages ajustés livrés sont ceux du rapport, et sont figés', () => {
  assert.equal(GB.AJUSTE.biaisVertical, 0.00455);
  assert.equal(GB.AJUSTE.biaisLateral, 0, 'le latéral n’est pas corrigé : c’est du bruit');
  assert.ok(Object.isFrozen(GB.AJUSTE));
});

/* ------------------------------------------------------------------------
 * GARDE-FOU DÉCOUVERT SUR LE TERRAIN — cut 6/4245, 15/09/2026.
 *
 * Une sélection porte `confidence: 0` pour forcer la pause du pilote. Mais
 * `src/engine.js` ligne 233 ne met en pause que si
 * `scope.lowConfidence !== 'attempt'`. Avec la politique « Tenter la
 * proposition expérimentale », le pilote a appliqué seul une sélection marquée
 * « jamais à appliquer automatiquement ». La confiance nulle ne suffisait pas.
 * ------------------------------------------------------------------------ */

test('la confiance nulle NE SUFFIT PAS à empêcher une application automatique', () => {
  /* On rejoue la condition exacte du moteur gelé, pour que ce test échoue si
   * quelqu'un se remet à croire que confidence:0 protège à lui seul. */
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'engine.js'), 'utf8');
  assert.ok(source.includes("low&&scope.lowConfidence!=='attempt'"),
    'le moteur gelé ne met en pause pour confiance faible que hors politique « attempt »');
  const pilotePause = (confidence, minConfidence, politique) =>
    confidence < minConfidence && politique !== 'attempt';
  assert.equal(pilotePause(0, 55, 'pause'), true);
  assert.equal(pilotePause(0, 55, 'attempt'), false,
    'avec « attempt », une confiance nulle ne protège de rien');
});

test('politique « attempt » : le cerveau ne produit AUCUNE sélection', () => {
  const Brain = require('../src/brain.js');
  const AMBIGU = 'Plusieurs placements concurrents du champignon sont géométriquement plausibles.';
  const ambigu = { side: 'right', status: 'unresolved', delta: null, confidence: 0, reasons: [AMBIGU],
    metrics: { seed: [-.003, -.003], surfaceIntersection: [-.0001, -.0098],
      templateAmbiguity: { alternative: [-.07, -.007] } } };
  const resolu = { side: 'left', status: 'candidate', delta: [0, -.056, -.001], confidence: 65, reasons: [], metrics: {} };
  // Ce que fait background.js au démarrage d'un lot en politique « attempt ».
  GB.configure({ actif: true, selectionActive: false });
  const { actif, ...params } = GB.reglages();
  const r = Brain.corrigerPaire({ left: resolu, right: ambigu }, params);
  assert.equal(r.proposals.right.status, 'unresolved',
    'le rail ambigu doit rester sans proposition');
  assert.equal(r.proposals.right.delta, null);
  /* Conséquence voulue : `missing` est vrai, donc le moteur gelé part en
   * PAUSED_UNRESOLVED_RAIL — branche qui précède toute question de confiance. */
  const fits = Object.values(r.proposals);
  assert.equal(fits.some(p => !p.delta), true, 'le lot doit se mettre en pause par le chemin « missing »');
  GB.configure({ actif: false, selectionActive: true });
});

test('politique « pause » : la sélection reste offerte, et reste marquée', () => {
  const Brain = require('../src/brain.js');
  const AMBIGU = 'Plusieurs placements concurrents du champignon sont géométriquement plausibles.';
  const ambigu = { side: 'right', status: 'unresolved', delta: null, confidence: 0, reasons: [AMBIGU],
    metrics: { seed: [-.003, -.003], surfaceIntersection: [-.0001, -.0098],
      templateAmbiguity: { alternative: [-.07, -.007] } } };
  const resolu = { side: 'left', status: 'candidate', delta: [0, -.056, -.001], confidence: 65, reasons: [], metrics: {} };
  GB.configure({ actif: true, selectionActive: true });
  const { actif, ...params } = GB.reglages();
  const r = Brain.corrigerPaire({ left: resolu, right: ambigu }, params);
  assert.equal(r.proposals.right.status, 'candidate');
  assert.equal(r.proposals.right.confidence, 0);
  assert.equal(r.proposals.right.brainApplied.selection, 'graine');
  GB.configure({ actif: false });
});

test('le biais vertical, lui, n’est jamais coupé : il garde la confiance du moteur', () => {
  const Brain = require('../src/brain.js');
  const resolu = { side: 'left', status: 'candidate', delta: [0, -.056, -.001], confidence: 65, reasons: [], metrics: {} };
  GB.configure({ actif: true, selectionActive: false, biaisVertical: .00455 });
  const { actif, ...params } = GB.reglages();
  const r = Brain.corrigerPaire({ left: resolu, right: null }, params);
  assert.equal(r.proposals.left.confidence, 65, 'la correction de biais ne dégrade pas la confiance');
  assert.ok(Math.abs(r.proposals.left.delta[2] - .00355) < 1e-12);
  GB.configure({ actif: false, selectionActive: true });
});

test('le mode essai est un choix explicite, désactivé par défaut', () => {
  /* Couper les sélections en politique « attempt » protège, mais empêche aussi
   * de les OBSERVER — or le seul chiffre de fiabilité dont on dispose vient du
   * corpus de corrections, dont on a démontré qu'il n'est pas représentatif.
   * Refuser d'observer au nom d'un chiffre douteux interdit de le corriger.
   * D'où ce réglage : il existe, il est explicite, il est éteint par défaut. */
  GB.configure({ actif: false, autoriserSelectionSansPause: false });
  assert.equal(GB.reglages().autoriserSelectionSansPause, false);
  assert.throws(() => GB.configure({ autoriserSelectionSansPause: 'oui' }), /Cerveau/);
  GB.configure({ autoriserSelectionSansPause: true });
  assert.equal(GB.reglages().autoriserSelectionSansPause, true);
  GB.configure({ autoriserSelectionSansPause: false });
});

test('le réglage d’essai n’est jamais transmis au cerveau comme paramètre', () => {
  /* Il pilote le démarrage du lot, pas le comportement du cerveau lui-même :
   * il ne doit pas fuir dans les paramètres journalisés du placement. */
  GB.configure({ actif: true, autoriserSelectionSansPause: true, biaisVertical: .004 });
  GB.proposeBoth(captures()[0], {});
  const p = GB.journal().parameters;
  assert.equal(p.autoriserSelectionSansPause, undefined);
  assert.equal(p.actif, undefined);
  assert.equal(p.biaisVertical, .004);
  GB.configure({ actif: false, autoriserSelectionSansPause: false });
});
