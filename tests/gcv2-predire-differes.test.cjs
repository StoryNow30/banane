'use strict';
/* Prédiction scellée de la GCV2 sur les différés d'un lot (tools/gcv2-predire-differes.cjs), sur un lot SYNTHÉTIQUE (partie 91, cuts inventés,
 * captures fabriquées par tests/helpers/gcv2-jeu-fixture.cjs, Écho fabriqué par tests/helpers/jointure-synthetique.cjs) : aucune donnée de terrain.
 *  - ENTRÉE CAUSALE : rien d'après le début de la relecture n'entre ; la sortie ne change pas, octet pour octet, si l'on remplace tout contenu
 *    humain (relecture, validations Maj+Espace, poses finales, Écho collé dans le journal) par n'importe quoi ; un voisin validé APRÈS la décision
 *    du différé ne change rien, un voisin validé AVANT change le contexte (le canal existe, il est causal).
 *  - PARAMÈTRES FIGÉS : les colonnes reconstruites sont celles du fichier ; un fichier altéré est refusé.
 *  - DÉCISION : sans voie de série sûre, aucune action (garde-fou de voie) ; avec une voie sûre et un score qui le permet, une action, mesurée
 *    contre la voie de la série et contre la pose de départ.
 *  - COMPARER (jamais lancé sur une vraie partie avant l'Écho) : justes, abîmés, mauvaises voies séparées, rappel atteignable, départ différent,
 *    lecture de l'Écho. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const P = require('../tools/gcv2-predire-differes.cjs');
const A = require('../tools/gcv2-apprendre.cjs');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const SIDES = ['left', 'right'];
const PARAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres.json'), 'utf8'));
const T0 = Date.UTC(2031, 4, 1, 8, 0, 0), iso = s => new Date(T0 + s * 1000).toISOString();
const ORIGINE = [458559.4, 6699187.6, 24.0];             // « coordonnées » inventées : elles ne doivent jamais ressortir
const VALIDES = [1, 2, 3, 6, 7, 8], DIFFERES = [4, 5];
const clone = x => JSON.parse(JSON.stringify(x));

/* Captures : le cut k est à k mètres le long de la voie (axe x de la scène). */
const capDe = cut => { const c = F.capture({ cut, graine: 10 + cut, origine: [ORIGINE[0] + cut, ORIGINE[1], ORIGINE[2]] }); return { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: c.visibleByClipBoxes }; };
const CAPTURES = new Map([1, 2, 3, 4, 5, 6, 7, 8].map(c => [`cap-${c}`, capDe(c)]));
const decaler = (p, dy = 0, dz = 0) => [p[0], p[1] + dy, p[2] + dz];
/* Un lot synthétique : le lot décide les cuts 1 à 8 dans l'ordre, valide 1-3 et 6-8 (pose corrigée de 3 mm en latéral), diffère 4 et 5 ; puis
 * la relecture commence (t = 200 s) et « corrige » des cuts (contenu humain, qui ne doit jamais entrer). */
function journal({ decalCut = {} } = {}) {
  const events = [], records = [];
  for (const cut of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const valide = VALIDES.includes(cut), t = 10 * cut;
    events.push({ eventId: `d-${cut}`, timestamp: iso(t), type: 'gcv1-shadow-observed', identity: { part: 91, cut, frameId: 'cadre' }, batchId: 'lot-a', lidarCaptureId: `cap-${cut}`,
      lotObservation: { stage: valide ? 'first-pass' : 'deferred', reason: valide ? null : 'no-anchor', anchorsUsed: [], anchor: valide, anchorHeld: valide, command: { action: valide ? 'engine' : 'engine', reason: valide ? 'first-pass' : 'deferred' } } });
    if (!valide) continue;
    events.push({ eventId: `v-${cut}`, timestamp: iso(t + 2), type: 'validation-accepted', identity: { part: 91, cut } });
    const cap = CAPTURES.get(`cap-${cut}`), dy = decalCut[cut] ?? 0.003;
    records.push({ cut, part: 91, identity: { part: 91, cut }, capturedAt: iso(t + 1), rails: Object.fromEntries(SIDES.map(s => [s, {
      initial: { positionSceneRelative: cap.rails[s].positionSceneRelative.slice(), sceneRelativeToProfileLocal: cap.rails[s].sceneRelativeToProfileLocal.slice() },
      corrected: { positionSceneRelative: decaler(cap.rails[s].positionSceneRelative, dy) } }])) });
  }
  events.push({ eventId: 'r0', timestamp: iso(200), type: 'relecture-debut', mode: 'corriger' });
  events.push({ eventId: 'r1', timestamp: iso(205), type: 'relecture-ombre', identity: { part: 91, cut: 4 }, corrige: true });
  events.push({ eventId: 'r2', timestamp: iso(206), type: 'validation-accepted', identity: { part: 91, cut: 4 } });
  records.push({ cut: 4, part: 91, identity: { part: 91, cut: 4 }, capturedAt: iso(206), rails: Object.fromEntries(SIDES.map(s => [s, { initial: clone(CAPTURES.get('cap-4').rails[s]), corrected: { positionSceneRelative: decaler(CAPTURES.get('cap-4').rails[s].positionSceneRelative, 0.02) } }])) });
  return { events, records };
}
const predire = (j, opts = {}) => P.predire({ journal: j, captures: CAPTURES, parametres: PARAMS, projet: 9, partie: 91, empreinteParametres: 'essai', ...opts });

test('état du lot : coupure à la relecture, différés, validations de la relecture ignorées', () => {
  const e = P.etatDuLot(journal(), 91), cuts = P.cutsDuLot(e);
  assert.equal(e.coupure, true);
  assert.equal(e.decisions.length, 8);
  assert.deepEqual(cuts.filter(c => !c.valide).map(c => c.cut), DIFFERES, 'le cut 4 « corrigé » par la relecture reste un différé du lot');
  assert.deepEqual(e.poses.map(p => p.cut), VALIDES, 'la pose écrite pendant la relecture n\'entre pas');
  assert.ok(cuts.filter(c => c.valide).every(c => c.appui), 'un premier passage validé est un appui');
});

test('sortie : une ligne par différé, aucune coordonnée, mêmes octets d\'une fois à l\'autre', () => {
  const r1 = predire(journal()), r2 = predire(journal());
  const texte = P.enJsonl(r1.lignes);
  assert.equal(texte, P.enJsonl(r2.lignes), 'déterministe');
  assert.equal(r1.lignes[0].type, 'entete');
  assert.deepEqual(r1.lignes.slice(1).map(l => l.cut), DIFFERES);
  for (const v of ['458559', '458560', '458561', '6699187']) assert.ok(!texte.includes(v), 'aucune coordonnée de scène dans la sortie');
  for (const l of r1.lignes.slice(1)) {
    assert.equal(l.etat, 'calcule');
    assert.ok(['pn', 'adv', 'abords'].includes(l.zone));
    assert.ok(l.hyps.left.length && l.hyps.right.length && l.hyps.left.every(h => h.decal.every(x => Math.abs(x) < 1000) && h.p10 >= 0 && h.p10 <= 1));
    assert.ok(l.hyps.left.some(h => h.origines.includes('H0')), 'H0 est toujours là');
    assert.equal(l.contexte.validesAvant, 3, 'seuls les cuts 1 à 3 sont validés avant la décision');
  }
  assert.match(P.sha256(Buffer.from(texte)), /^[0-9a-f]{64}$/);
});

test('invariance : remplacer tout contenu humain par n\'importe quoi ne change pas un octet de la prédiction', () => {
  const ref = P.enJsonl(predire(journal()).lignes);
  const j = journal();
  /* relecture et validations d'après le lot : contenu remplacé, poses aberrantes, cuts différés « corrigés » */
  for (const e of j.events) if (e.type.startsWith('relecture')) Object.assign(e, { mode: 'n\'importe quoi', poses: [[1, 2, 3]], corrige: 999 });
  for (const cut of [1, 2, 3, 4, 5, 6]) {
    j.events.push({ eventId: `h-${cut}`, timestamp: iso(300 + cut), type: 'validation-accepted', identity: { part: 91, cut } });
    j.records.push({ cut, part: 91, identity: { part: 91, cut }, capturedAt: iso(300 + cut), rails: Object.fromEntries(SIDES.map(s => [s, { initial: clone(CAPTURES.get(`cap-${cut}`).rails[s]),
      corrected: { positionSceneRelative: decaler(CAPTURES.get(`cap-${cut}`).rails[s].positionSceneRelative, 0.4, -0.2) } }])) });
  }
  /* « pose finale » d'un humain et Écho collés dans le journal */
  j.echo = { records: [{ cut: 4, humanFinalReference: { state: { rails: { left: { positionSceneRelative: [1, 2, 3] } } } } }] };
  for (const r of j.records) r.humanFinalReference = { state: { rails: { left: { positionSceneRelative: [9, 9, 9] }, right: { positionSceneRelative: [8, 8, 8] } } } };
  assert.equal(P.enJsonl(predire(j).lignes), ref);
  /* un journal sans relecture, coupé à la même place, donne aussi la même prédiction */
  const k = journal(); k.events = k.events.filter(e => Date.parse(e.timestamp) < T0 + 200 * 1000); k.records = k.records.filter(r => Date.parse(r.capturedAt) < T0 + 200 * 1000);
  const sansRelecture = predire(k).lignes;
  assert.deepEqual(sansRelecture.slice(1), JSON.parse('[' + ref.trim().split('\n').slice(1).join(',') + ']'), 'mêmes lignes de différés');
});

test('causalité : un voisin validé après la décision du différé ne change rien ; un voisin validé avant change le contexte', () => {
  const base = predire(journal()).lignes.find(l => l.cut === 4);
  const apres = predire(journal({ decalCut: { 6: 0.03, 7: -0.05 } })).lignes.find(l => l.cut === 4);
  assert.deepEqual(apres, base, 'les cuts 6 et 7 sont validés après la décision du cut 4');
  const avant = predire(journal({ decalCut: { 3: 0.03 } })).lignes.find(l => l.cut === 4);
  assert.notDeepEqual(avant.hyps, base.hyps, 'le cut 3, validé avant, est un voisin sûr : ses poses changent les hypothèses');
});

test('paramètres figés : colonnes reconstruites identiques au fichier ; fichier altéré refusé', () => {
  for (const u of ['lot', 'relecture']) {
    const m = P.modeleFige(PARAMS, u);
    assert.deepEqual(m.fit.noms, PARAMS.usages[u].colonnes);
    assert.deepEqual(m.seuils, PARAMS.usages[u].seuils, 'τ et δ lus tels quels');
  }
  const x = clone(PARAMS); x.usages.lot.colonnes = x.usages.lot.colonnes.slice(1);
  assert.throws(() => P.modeleFige(x, 'lot'), /colonnes reconstruites/);
  const y = clone(PARAMS); y.usages.lot.modele10.coefficients.pop();
  assert.throws(() => P.modeleFige(y, 'lot'), /coefficients/);
});

test('garde-fou de voie : sans voie de série sûre (pas assez de voisins à 10 cuts), aucune paire permise, aucune action', () => {
  const j = journal(); const r = predire(j);
  for (const l of r.lignes.slice(1)) {
    assert.equal(l.paires, 0);
    assert.notEqual(l.decision.etat, 'agit');
    assert.equal(l.decision.motifNonAction, 'garde-voie-sans-reference-sure');
  }
  assert.equal(r.resume.agit, 0);
});

/* Un cas fait main (deux hypothèses par rail : H0, et une « voie décalée » à 150 mm) et un modèle factice qui préfère les grands déplacements :
 * la décision de paire agit sous le garde-fou de voie et se mesure contre la voie de la série. */
function casMain({ sure = true, zone = 'adv' } = {}) {
  const ctx = { zone, role: 'differe' };
  const hyp = (decal, origines, sous) => ({ rang: 0, hauteur: false, origines, sousOrigines: sous, decal, g: 1450 });
  const k = { partie: '9:91', cut: 4, zone, role: 'differe', gMed: 1450, G0: 1450, garde: 'voie', rails: {},
    voieRef: { sure, motifs: sure ? [] : ['appuis-contradictoires'], left: [150, 0], right: [150, 0] } };
  for (const s of SIDES) {
    const hs = [hyp([0, 0, 0], ['H0'], ['depart']), hyp([0, 151, 1], ['H6'], ['h6-lot-mediane-paire'])];
    const acc = A.accords(hs);
    k.rails[s] = { confiance: 50, hyps: hs.map((h, i) => ({ ...h, h6: h.origines.includes('H6'), x: A.brut({ traits: { deplMm: Math.hypot(...h.decal) }, hauteur: false, origines: h.origines, sousOrigines: h.sousOrigines }, {}, ctx, acc[i]) })) };
  }
  k.i0 = { left: 0, right: 0 };
  k.paires = A.pairesPermises(k);
  return k;
}
function modeleFactice() {
  const m = P.modeleFige(PARAMS, 'lot'), j = m.fit.noms.indexOf('deplMm');
  const coef = new Float64Array(m.fit.p); coef[j] = 3;
  return { ...m, m10: { coef, intercept: 0 }, m5: { coef, intercept: 0 }, cal10: { a: 1, b: 0 }, cal5: { a: 1, b: 0 } };
}
test('décision : avec une voie de série sûre, la GCV2 agit sur la voie décalée ; l\'action est mesurée contre la série et contre le départ', () => {
  const D = P.deciderDiffere(casMain(), modeleFactice());
  assert.equal(D.paires, 1);
  assert.equal(D.decision.etat, 'agit');
  assert.equal(D.decision.motifNonAction, null);
  assert.deepEqual(D.decision.paire.left.decal, [0, 151, 1]);
  assert.equal(D.decision.latSerieMm.left, 1, 'à 1 mm de la voie de la série');
  assert.equal(D.decision.latDepartMm.left, 151);
  assert.ok(D.drapeaux.includes('action-plus-de-45-mm-du-depart') && D.drapeaux.includes('depart-hors-corridor-de-serie'));
  assert.equal(D.decision.h6Retenue, true);
  const N = P.deciderDiffere(casMain({ sure: false }), modeleFactice());
  assert.equal(N.paires, 0);
  assert.equal(N.decision.etat, 'laisse');
  assert.equal(N.decision.motifNonAction, 'garde-voie-sans-reference-sure');
  assert.ok(N.drapeaux.includes('voie-appuis-contradictoires'));
});

/* Prédictions fabriquées pour la comparaison. */
function predictions() {
  const d = (cut, zone, etat, pose, extra = {}) => ({ type: 'differe', partie: '9:91', cut, zone, etat: 'calcule', departEcartementMm: 1450,
    decision: { etat, paire: pose, latSerieMm: { left: pose ? pose.left.decal[1] - 150 : null, right: pose ? pose.right.decal[1] - 150 : null }, h6Retenue: !!pose },
    hyps: { left: [{ decal: [0, 0, 0] }, { decal: [0, 150, 0] }], right: [{ decal: [0, 0, 0] }, { decal: [0, 150, 0] }] }, ...extra });
  const pose = lat => ({ left: { decal: [0, lat, 0] }, right: { decal: [0, lat, 0] } });
  return { entete: { type: 'entete', format: P.FORMAT, partie: '9:91' }, differes: [
    d(10, 'adv', 'agit', pose(150)),      // L'opérateur à 152 : juste (et > 45 mm du départ : compté à part)
    d(11, 'adv', 'agit', pose(150)),      // L'opérateur laisse à 0 : abîmé et mauvaise voie (erreur 150 mm)
    d(12, 'abords', 'laisse', null),      // L'opérateur à 30 : grosse laissée fausse, hors d'atteinte
    d(13, 'abords', 'laisse', null),      // départ différent dans l'Écho : non jugé
    d(14, 'pn', 'laisse', null),          // pas de référence de l'opérateur
    { type: 'differe', partie: '9:91', cut: 15, zone: 'adv', etat: 'sans-nuage', decision: { etat: 'sans-nuage' } },
    d(16, 'adv', 'abstient', pose(60)),   // abstention ; l'opérateur à 150 : atteignable
  ] };
}
const mic = lat => ({ ref: 'validation', rails: { left: [0, lat, 0], right: [0, lat, 0] }, ecartDepartMm: 1450.5 });
test('comparer : justes, abîmés, mauvaises voies séparées, abstentions, rappel atteignable, départ différent', () => {
  const R = P.comparerPredictions(predictions(), new Map([[10, mic(152)], [11, mic(0)], [12, mic(30)], [13, { ...mic(0), ecartDepartMm: 1400 }], [14, { ref: null, rails: null, ecartDepartMm: 1450, raison: 'trop-court' }],
    [15, mic(5)], [16, mic(150)]]));
  assert.deepEqual(R.nonJuges, { sansReferenceMic: 1, departDifferent: 1, sansNuage: 1, absentsEcho: 0 });
  assert.equal(R.total.visites, 4);
  assert.equal(R.total.agit, 2);
  assert.equal(R.total.justes, 1);
  assert.equal(R.total.abimes, 1);
  assert.equal(R.total.erreur50, 1, 'cut 11 : erreur finale de 150 mm');
  assert.equal(R.total.amplitude45, 2, 'les deux actions déplacent un rail de plus de 45 mm en travers depuis le départ');
  assert.equal(R.total.horsCorridor, 0, 'mais restent dans le corridor de la série');
  assert.equal(R.total.mauvaiseVoie, 2, 'définition du protocole : > 50 mm ou > 45 mm en travers depuis le départ');
  assert.equal(R.total.abstentions, 1);
  assert.equal(R.total.laisseFaux, 2, 'cuts 12 et 16');
  assert.deepEqual(R.rappel.paireA10, { n: 4, k: 3, nGrosses: 3, kGrosses: 2 });
  assert.equal(R.parZone.adv.agit, 2); assert.equal(R.parZone.abords.visites, 1);
  assert.equal(R.departDuLot.plus10, 3);
  const c10 = R.detail.find(x => x.cut === 10);
  assert.equal(c10.classe, 'juste-5'); assert.equal(c10.gainMm, 150);
  assert.match(P.texteComparaison(R, 'x'), /mauvaises voies/);
});

test('comparer : lecture de l\'Écho (validation, visite sans action, visite trop courte), repère de la pose de départ', () => {
  const G0 = [100, 200, 10], D0 = [100, 201.45, 10], m = (minutes, secondes = 0) => ({ minutes, secondes });
  const v = (index, cut, debut, fin, extra = {}) => S.visite({ session: 's', index, cut, partie: 91, debut, fin, initiale: [G0, D0], ...extra });
  const corr = [S.decaler(G0, 0, 0.15), S.decaler(D0, 0, 0.152)];
  const doc = S.exportEcho({ session: 's', debutSession: m(0), stamp: '2031-05-01T09-00-00', records: [
    v(0, 4, m(1), m(1, 30), { derniere: corr, validation: corr }), v(1, 5, m(2), m(2, 20)), v(2, 6, m(3), m(3, 0.3)), v(3, 7, m(4), m(4, 9)) ] });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'predire-differes-'));
  try {
    S.ecrire(dir, 'ariane-echo-2031-05-01T09-00-00-seg01.json', doc);
    const M = P.micDepuisEcho([dir], 91, [4, 5, 6]);
    assert.deepEqual([...M.keys()].sort(), [4, 5, 6], 'seuls les cuts demandés');
    assert.equal(M.get(4).ref, 'validation');
    assert.ok(Math.abs(M.get(4).rails.left[1] - 150) < 0.01 && Math.abs(M.get(4).rails.right[1] - 152) < 0.01);
    assert.equal(M.get(4).ecartDepartMm, 1450);
    assert.equal(M.get(5).ref, 'visite-bon');
    assert.equal(M.get(6).ref, null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('lecture des prédictions : format vérifié', () => {
  const r = predire(journal()), texte = P.enJsonl(r.lignes), p = P.lirePredictions(texte);
  assert.equal(p.differes.length, 2);
  assert.throws(() => P.lirePredictions(JSON.stringify({ type: 'entete', format: 'autre' })), /format/);
});

test('ligne de commande : « comparer » relit le fichier scellé, imprime son SHA-256 et refuse un fichier d\'un autre format', () => {
  const cp = require('node:child_process'), OUTIL = path.join(__dirname, '..', 'tools', 'gcv2-predire-differes.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'predire-differes-cli-'));
  try {
    const texte = P.enJsonl(predire(journal()).lignes), f = path.join(dir, 'pred.jsonl'); fs.writeFileSync(f, texte);
    const m = (minutes, secondes = 0) => ({ minutes, secondes }), G0 = [100, 200, 10], D0 = [100, 201.45, 10];
    S.ecrire(dir, 'ariane-echo-2031-05-01T09-00-00-seg01.json', S.exportEcho({ session: 's', debutSession: m(0), stamp: '2031-05-01T09-00-00',
      records: [S.visite({ session: 's', index: 0, cut: 4, partie: 91, debut: m(1), fin: m(1, 30), initiale: [G0, D0] })] }));
    const r = cp.spawnSync(process.execPath, [OUTIL, 'comparer', '--predictions', f, '--echo', dir, '--json', path.join(dir, 'r.json')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes(P.sha256(Buffer.from(texte))), 'le SHA-256 du fichier scellé est imprimé');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'r.json'), 'utf8')).format, P.FORMAT_COMPARAISON);
    fs.writeFileSync(f, JSON.stringify({ type: 'entete', format: 'autre' }) + '\n');
    const k = cp.spawnSync(process.execPath, [OUTIL, 'comparer', '--predictions', f, '--echo', dir], { encoding: 'utf8' });
    assert.notEqual(k.status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
