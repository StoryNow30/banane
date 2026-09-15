const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const Brain = require('../src/brain.js');
const Fit = require('../tools/brain-fit.cjs');
const Dataset = require('../tools/brain-dataset.cjs');

/* Cerveau de placement — V1.
 *
 * Le jeu d'essai est un extrait RÉDUIT du corpus de corrections humaines
 * (parts 17 et 20, 110 cuts, 220 rails). Les nuages de points en sont retirés :
 * seuls les descripteurs, la sortie du moteur gelé et la cible humaine sont
 * conservés, ce qui suffit à exercer le cerveau et tient dans le dépôt. */
const JEU = path.resolve(__dirname, 'fixtures', 'brain-jeu.json');
const jeu = JSON.parse(fs.readFileSync(JEU, 'utf8'));
const L = jeu.lignes;
const dev = L.filter(l => l.part === 20), reserve = L.filter(l => l.part === 17);

const prop = (statut, delta, motifs = [], metrics = null) =>
  ({ side: 'left', status: statut, delta, confidence: statut === 'candidate' ? 70 : 0,
     reasons: motifs, metrics });
const AMBIGU = 'Plusieurs placements concurrents du champignon sont géométriquement plausibles.';
const metriques = (graine, surface, alternative) =>
  ({ seed: graine, surfaceIntersection: surface, templateAmbiguity: { alternative } });

/* ------------------------------------------------------- forme du jeu -- */

test('le jeu d’essai porte les deux blocs et la cible humaine', () => {
  assert.equal(L.length, 220);
  assert.equal(dev.length, 168);
  assert.equal(reserve.length, 52);
  for (const l of L) assert.equal(l.cible.deplacementLocal.length, 3);
});

test('aucune fuite : la cible n’apparaît dans aucune entrée du moteur', () => {
  // La règle qui compte : la correction humaine ne doit jamais atteindre ce que
  // le cerveau lit. On la vérifie sur la structure, pas sur une intention.
  for (const l of L) {
    const entrees = JSON.stringify({ descripteurs: l.descripteurs, moteur: l.moteur });
    for (const v of l.cible.deplacementLocal) {
      if (!Number.isFinite(v) || v === 0) continue;
      assert.ok(!entrees.includes(String(v)),
        'une valeur de la cible humaine apparaît dans les entrées : ' + v);
    }
  }
});

/* --------------------------------------------------- biais et sélection -- */

test('un biais nul laisse la proposition intacte', () => {
  const p = prop('candidate', [0, .01, .02]);
  const r = Brain.corrigerPaire({ left: p, right: null }, { biaisVertical: 0, biaisLateral: 0 });
  assert.deepEqual(r.proposals.left.delta, [0, .01, .02]);
  assert.equal(r.brain.perRail.left.action, 'aucune');
});

test('le biais vertical est appliqué, le latéral reste à la main de l’appelant', () => {
  const p = prop('candidate', [0, .01, .02]);
  const r = Brain.corrigerPaire({ left: p, right: null }, { biaisVertical: .004, biaisLateral: 0 });
  assert.equal(r.proposals.left.delta[1], .01, 'le latéral ne doit pas bouger');
  assert.ok(Math.abs(r.proposals.left.delta[2] - .024) < 1e-12);
  assert.equal(r.brain.perRail.left.action, 'biais');
});

test('le cerveau ne sélectionne que sur une abstention pour concurrence', () => {
  const p = prop('unresolved', null, ['Flanc interne insuffisamment observé.'],
    metriques([.01, .02], [.011, .021], [.05, .03]));
  const autre = prop('candidate', [0, -.01, .02]);
  const r = Brain.corrigerPaire({ left: p, right: autre }, { ecartVerticalMax: .015, plausibiliteLaterale: .05 });
  assert.equal(r.proposals.left.status, 'unresolved');
  assert.match(r.brain.perRail.left.motif, /non liée à la concurrence/);
});

test('sans rail opposé résolu, le cerveau s’abstient : pas d’appui de dévers', () => {
  const p = prop('unresolved', null, [AMBIGU], metriques([.01, .02], [.011, .021], [.05, .03]));
  const r = Brain.corrigerPaire({ left: p, right: prop('unresolved', null, [AMBIGU]) }, {});
  assert.equal(r.proposals.left.status, 'unresolved');
  assert.equal(r.brain.perRail.left.action, 'abstention');
  assert.match(r.brain.perRail.left.motif, /dévers/);
});

test('le candidat retenu est celui qui s’accorde en dévers avec le rail opposé', () => {
  const p = prop('unresolved', null, [AMBIGU],
    metriques([.01, .050], [.012, .048], [.02, .021]));
  const autre = prop('candidate', [0, -.01, .020]);
  const r = Brain.corrigerPaire({ left: p, right: autre }, { biaisVertical: 0 });
  assert.equal(r.proposals.left.status, 'candidate');
  assert.equal(r.proposals.left.brainApplied.selection, 'alternative');
  assert.deepEqual(r.proposals.left.delta, [0, .02, .021]);
});

test('un candidat latéralement invraisemblable est refusé, pas corrigé', () => {
  const p = prop('unresolved', null, [AMBIGU], metriques([.30, .020], [.31, .021], [.32, .020]));
  const autre = prop('candidate', [0, -.01, .020]);
  const r = Brain.corrigerPaire({ left: p, right: autre }, { plausibiliteLaterale: .05 });
  assert.equal(r.proposals.left.status, 'unresolved');
  assert.match(r.brain.perRail.left.motif, /latéral hors du domaine/);
});

test('aucun candidat en accord de dévers : abstention', () => {
  const p = prop('unresolved', null, [AMBIGU], metriques([.01, .30], [.011, .31], [.02, .32]));
  const autre = prop('candidate', [0, -.01, .020]);
  const r = Brain.corrigerPaire({ left: p, right: autre }, { ecartVerticalMax: .015 });
  assert.equal(r.proposals.left.status, 'unresolved');
  assert.match(r.brain.perRail.left.motif, /accord de dévers/);
});

test('le cerveau n’invente aucun candidat', () => {
  const p = prop('unresolved', null, [AMBIGU], metriques([.01, .02], null, null));
  const autre = prop('candidate', [0, -.01, .02]);
  const r = Brain.corrigerPaire({ left: p, right: autre }, {});
  assert.equal(r.proposals.left.status, 'unresolved');
  assert.match(r.brain.perRail.left.motif, /moins de deux candidats/);
  assert.equal(Brain.candidatsExposes(p).length, 1, 'seul le candidat réellement exposé est compté');
});

test('une abstention n’est jamais transformée en SKIP', () => {
  const p = prop('unresolved', null, [AMBIGU], metriques([.30, .30], [.31, .31], [.32, .32]));
  const r = Brain.corrigerPaire({ left: p, right: null }, {});
  assert.equal(r.proposals.left.status, 'unresolved');
  assert.ok(!JSON.stringify(r).includes('SKIP'), 'le cerveau ne doit produire aucun SKIP');
});

/* ------------------------------------------------- VERROU DE SÛRETÉ ---- */

test('une sélection ne peut PAS être appliquée seule par le pilote', () => {
  /* `src/engine.js` est gelé : il met en pause tout rail dont la confiance est
   * sous `minConfidence`. Une sélection doit donc porter une confiance qui
   * déclenche cette pause pour TOUT seuil admissible, sans dépendre d'une
   * coercition. C'est le seul garde-fou disponible, il est verrouillé ici.
   *
   * Motif : 2 des 14 sélections du bloc de développement étaient fausses de
   * ~82e-3 unités de scène malgré les garde-fous. */
  const p = prop('unresolved', null, [AMBIGU], metriques([.01, .021], [.012, .022], [.02, .020]));
  const autre = prop('candidate', [0, -.01, .020]);
  const r = Brain.corrigerPaire({ left: p, right: autre }, {});
  const choisi = r.proposals.left;
  assert.equal(choisi.status, 'candidate');
  assert.equal(choisi.confidence, 0, 'une sélection porte une confiance nulle');
  assert.equal(typeof choisi.confidence, 'number', 'un nombre, pas null : aucune coercition en jeu');
  for (const seuil of [0.0001, 1, 25, 55, 100])
    assert.ok(choisi.confidence < seuil, 'le pilote doit mettre en pause au seuil ' + seuil);
  assert.equal(choisi.confidenceStatus, 'non-calibrée-pour-la-sélection');
  assert.ok(choisi.reasons.some(x => /jamais à appliquer automatiquement/.test(x)),
    'le motif doit le dire à l’opérateur, pas seulement au code');
});

test('des réglages aberrants sont refusés, pas silencieusement corrigés', () => {
  const p = prop('candidate', [0, .01, .02]);
  assert.throws(() => Brain.corrigerPaire({ left: p }, { biaisVertical: NaN }), /Biais du cerveau invalide/);
  assert.throws(() => Brain.corrigerPaire({ left: p }, { ecartVerticalMax: 0 }), /Garde-fou du cerveau invalide/);
  assert.throws(() => Brain.corrigerPaire({ left: p }, { plausibiliteLaterale: -1 }), /Garde-fou du cerveau invalide/);
});

/* ------------------------------------------- ajustement et généralisation -- */

test('l’ajustement rejette de lui-même le biais latéral, qui est du bruit', () => {
  const r = Fit.ajuster(dev);
  assert.equal(r.biaisLateral, 0,
    'le latéral ne domine pas sa dispersion : le corriger ajouterait du bruit');
  assert.ok(r._mesures.rapportLateral < 1, 'rapport latéral : ' + r._mesures.rapportLateral);
  assert.ok(r.biaisVertical > 0.002 && r.biaisVertical < 0.008,
    'biais vertical ajusté : ' + r.biaisVertical);
  assert.ok(r._mesures.rapportVertical >= 1, 'le vertical doit dominer sa dispersion');
});

test('le biais vertical se retrouve dans les DEUX blocs, séparément', () => {
  // Un biais présent dans un seul bloc serait une particularité de ce bloc.
  const a = Fit.ajuster(dev)._mesures.residuVerticalMoyen;
  const b = Fit.ajuster(reserve)._mesures.residuVerticalMoyen;
  assert.ok(a > 0.002 && b > 0.002, 'biais dev ' + a + ' / réserve ' + b);
  assert.ok(Math.abs(a - b) < 0.003, 'les deux blocs doivent s’accorder à mieux que 3e-3');
});

test('sur le bloc RÉSERVÉ, le cerveau améliore l’erreur médiane', () => {
  // Réglages ajustés sur le développement seul, appliqués tels quels.
  const { _mesures, ...figes } = Fit.ajuster(dev);
  const r = Fit.evaluer(reserve, figes);
  assert.ok(r.apres.p50 < r.avant.p50,
    'médiane : ' + r.avant.p50 + ' -> ' + r.apres.p50);
  assert.ok(r.apres.p50 < r.avant.p50 * 0.8, 'le gain doit dépasser 20 %');
  assert.ok(r.proposeApres >= r.proposeAvant, 'le cerveau ne doit jamais retirer de proposition');
  assert.ok(r.apparies.ameliores > r.apparies.degrades,
    'améliorés ' + r.apparies.ameliores + ' contre dégradés ' + r.apparies.degrades);
});

test('le cerveau ne dégrade pas le taux de proposition', () => {
  const { _mesures, ...figes } = Fit.ajuster(dev);
  for (const bloc of [dev, reserve]) {
    const r = Fit.evaluer(bloc, figes);
    assert.ok(r.proposeApres >= r.proposeAvant);
  }
});

test('désactiver la sélection laisse le biais agir seul', () => {
  const { _mesures, ...figes } = Fit.ajuster(dev);
  const r = Fit.evaluer(reserve, { ...figes, selectionActive: false });
  assert.equal(r.selections, 0);
  assert.equal(r.proposeApres, r.proposeAvant, 'sans sélection, aucune proposition nouvelle');
  assert.ok(r.apres.p50 < r.avant.p50, 'le biais seul suffit déjà à améliorer');
});

test('le cerveau est un post-traitement pur : aucune dépendance, aucun nuage relu', () => {
  /* La propriété qui compte n'est pas textuelle mais structurelle : le module
   * ne charge rien et ne lit aucune donnée de points. Il ne peut donc pas
   * contourner le moteur gelé ni refaire un placement en douce. */
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'brain.js'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const interdit of ['require(', 'importScripts', 'proposeBoth',
    'pointsSceneRelative', 'profileContours', 'visibleByClipBoxes'])
    assert.ok(!code.includes(interdit), 'src/brain.js ne doit pas contenir : ' + interdit);
  // Et il fonctionne sans aucun accès au moteur ni au stockage.
  const isole = { left: prop('candidate', [0, .01, .02]), right: null };
  assert.doesNotThrow(() => Brain.corrigerPaire(isole, { biaisVertical: .004 }));
});
