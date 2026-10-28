'use strict';
/* Banc conjoint des différés (tools/banc-differes.cjs) sur un lot SYNTHÉTIQUE (partie 91, cuts inventés, captures de
 * tests/helpers/gcv2-jeu-fixture.cjs) : aucune donnée de terrain.
 *  - Rejeu conjoint : trois profils, sort réel joint, une pose validée par un profil devient voisin des cuts suivants de CE profil seulement.
 *  - Causal : rien d'après le début de la relecture n'entre (validations, poses humaines, relecture) ; même entrée, mêmes octets.
 *  - Agrégation : taux de différés, posés non validés comptés comme différés « approchés », gain contre l'opérateur, rappel.
 *  - Comparaison (à l'arrivée de l'Écho) : jugés, départ différent, gain. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const B = require('../tools/banc-differes.cjs');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const SIDES = ['left', 'right'];
const PARAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json'), 'utf8'));
const T0 = Date.UTC(2031, 4, 1, 8, 0, 0), iso = s => new Date(T0 + s * 1000).toISOString();
const ORIGINE = [458559.4, 6699187.6, 24.0];
const CUTS = [1, 2, 3, 4, 5, 6], VALIDES = [1, 2, 3, 6];
/* Cut k à k mètres le long de la voie ; les cuts 4 et 5 n'ont de points que sur le rail gauche (le moteur ne résout pas le droit). */
const capDe = cut => { const c = F.capture({ cut, graine: 10 + cut, origine: [ORIGINE[0] + cut, ORIGINE[1], ORIGINE[2]] });
  const pts = [4, 5].includes(cut) ? c.pointsSceneRelative.filter(p => Math.abs(p[1] - ORIGINE[1]) < 0.5) : c.pointsSceneRelative;
  return { rails: c.rails, pointsSceneRelative: pts, visibleByClipBoxes: pts.map(() => true), camera: null, viewCaptures: [] }; };
const CAPTURES = new Map(CUTS.map(c => [`cap-${c}`, capDe(c)]));
function journal({ humain = 0 } = {}) {
  const events = [{ eventId: 'b0', timestamp: iso(1), type: 'batch-started', batch: { id: 'lot-a-0000', scope: { part: 91, start: 1, end: 6, extensionVersion: '9.9.9' } } }], records = [];
  for (const cut of CUTS) {
    const valide = VALIDES.includes(cut), t = 10 * cut;
    events.push({ eventId: `d-${cut}`, timestamp: iso(t), type: 'gcv1-shadow-observed', identity: { part: 91, cut, frameId: 'cadre' }, batchId: 'lot-a-0000', lidarCaptureId: `cap-${cut}`,
      lotObservation: { stage: valide ? 'first-pass' : 'deferred', reason: valide ? null : 'no-anchor', anchorsUsed: [], anchor: valide, anchorHeld: valide, command: { action: 'engine', reason: valide ? 'first-pass' : 'deferred' } } });
    if (!valide) continue;
    events.push({ eventId: `v-${cut}`, timestamp: iso(t + 2), type: 'validation-accepted', batchId: 'lot-a-0000', identity: { part: 91, cut } });
    const cap = CAPTURES.get(`cap-${cut}`);
    records.push({ identity: { part: 91, cut }, capturedAt: iso(t + 1), rails: Object.fromEntries(SIDES.map(s => [s, { initial: cap.rails[s], corrected: { positionSceneRelative: cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + 0.003 : v) } }])) });
  }
  events.push({ eventId: 'r0', timestamp: iso(200), type: 'relecture-debut', batchId: 'lot-a-0000', mode: 'corriger' });
  /* Contenu humain d'après le lot : ne doit jamais entrer. */
  events.push({ eventId: 'r1', timestamp: iso(205), type: 'validation-accepted', batchId: 'lot-a-0000', identity: { part: 91, cut: 4 } });
  records.push({ identity: { part: 91, cut: 4 }, capturedAt: iso(206), rails: Object.fromEntries(SIDES.map(s => [s, { initial: CAPTURES.get('cap-4').rails[s], corrected: { positionSceneRelative: CAPTURES.get('cap-4').rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + 0.02 + humain : v) } }])) });
  return { events, records };
}
const rejouer = (j = journal()) => B.rejouerLot({ journal: j, captures: CAPTURES, projet: 9, partie: 91, lotId: 'lot-a', parametres: PARAMS });

test('rejeu conjoint : lignes, profils, sort réel, déterminisme et causalité', () => {
  const t0 = Date.now(), a = rejouer(), b = rejouer(journal({ humain: 0.5 }));
  assert.ok(Date.now() - t0 < 20000, 'moins de 20 s');
  const [e, ...L] = a;
  assert.equal(e.format, B.FORMAT); assert.equal(e.traites, 6); assert.equal(e.differesReels, 2);
  assert.deepEqual(L.map(l => l.cut), CUTS);
  assert.deepEqual(L.filter(l => !l.reel.pose).map(l => l.cut), [4, 5], 'la validation de la relecture n\'entre pas');
  for (const l of L) for (const p of B.PROFILS) assert.ok(['pose', 'pose-non-validee', 'differe'].includes(l.profils[p].etat), `${l.cut} ${p}`);
  assert.equal(JSON.stringify(a.slice(1)), JSON.stringify(b.slice(1)), 'rien d\'humain après le lot ne change le rejeu');
  assert.ok(L.filter(l => [4, 5].includes(l.cut)).every(l => l.profils.base.etat === 'differe'), 'la base diffère les cuts sans rail droit');
  const g = L.find(l => l.cut === 4).profils.L1;
  assert.equal(g.source, 'gcv2'); assert.ok(g.l1 && typeof g.l1.etat === 'string' && g.l1.version, 'décision L1 consignée');
  assert.ok(!JSON.stringify(a).includes('458559'), 'aucune coordonnée absolue');
  /* D-221 : sous L1-s, chaque cut que la base rejouée pose est posé à l'identique ; contrôle de l'agrégation : 0. */
  for (const l of L.filter(l => l.profils.base.etat === 'pose')) { assert.equal(l.profils['L1-s'].etat, 'pose', `${l.cut}`); assert.deepEqual(l.profils['L1-s'].decal, l.profils.base.decal, `${l.cut}`); }
  const S = B.agreger(B.lireRejeux([a.map(x => JSON.stringify(x)).join('\n')]));
  assert.equal(S.effets['L1-s'].differentsDeLaBase, 0); assert.ok(S.effets['L1-s'].posesDeLaBase > 0);
  assert.equal(L.find(l => l.cut === 4).profils['L1-s'].source, 'gcv2', 'la GCV2 sur le différé de la chaîne');
  /* 4.9.5.14 : L1-se sans liste d'ESV = L1-s, sans pose approchée (même chaîne, mêmes poses validées, un approché redevient un différé). */
  for (const l of L) {
    const s = l.profils['L1-s'], e = l.profils['L1-se'];
    if (s.etat === 'pose-non-validee') { assert.equal(e.etat, 'differe', `${l.cut}`); continue; }
    assert.equal(e.etat, s.etat, `${l.cut}`); if (s.etat === 'pose') assert.deepEqual(e.decal, s.decal, `${l.cut}`);
  }
});

test('agrégation : taux, approchés, gain contre l\'opérateur, rappel', () => {
  const ligne = (cut, reel, L1, Lv, decal = null) => ({ type: 'cut', partie: '9:91', projet: 9, lot: 'lot-a', cut, nuage: true, zone: 'abords', reel: { pose: reel, motif: reel ? null : 'sans-appui' },
    profils: { base: { etat: reel ? 'pose' : 'differe' }, L1: { etat: L1, source: 'gcv2', decal, l1: { motif: L1 === 'differe' ? 'sous-delta' : null, hypothese: 'H1' } }, 'L1-v': { etat: Lv, source: 'gcv2', decal } } });
  const d = { left: [0, 30, 0], right: [0, 30, 0] };
  const R = { entetes: [{ profils: ['base', 'L1', 'L1-v'] }], lignes: [ligne(1, true, 'pose', 'pose'), ligne(2, false, 'pose', 'pose', d), ligne(3, false, 'pose-non-validee', 'pose', d), ligne(4, false, 'differe', 'differe')] };
  const juges = new Map([['9:91|lot-a|2', { depart: 30, mic: { left: [0, 31, 0], right: [0, 30, 0] } }], ['9:91|lot-a|3', { depart: 40, mic: { left: [0, 70, 0], right: [0, 30, 0] } }], ['9:91|lot-a|4', { depart: 5, mic: { left: [0, 5, 0], right: [0, 0, 0] } }]]);
  const S = B.agreger(R, juges);
  const c = S.groupes.total.comptes;
  assert.equal(c.reel.differes, 3); assert.equal(c.L1.differes, 2); assert.equal(c.L1.posesNonValidees, 1); assert.equal(c['L1-v'].differes, 1);
  const m = S.mic.L1.total;
  assert.equal(m.n, 3); assert.equal(m.a10, 2, 'cut 2 à 1 mm, cut 4 laissé à 5 mm'); assert.equal(m.plus50, 0); assert.equal(m.poses, 2);
  assert.deepEqual(m.rappel, { n: 2, k: 1, part: 50 }, 'rappel : jugés à plus de 10 mm au départ');
  assert.equal(S.reste.L1.restants, 2);
  assert.match(B.syntheseMd(S), /Taux de différés/);
});

test('prédiction et comparaison : résumé sans vérité, jugés, départ différent', () => {
  const [e, ...L] = rejouer();
  const R = B.resumePrediction(L, B.PROFILS);
  assert.equal(R.differesReels, 2);
  const s = R.parProfil.L1.surDifferesReels; assert.equal(s.valides + s.nonValides + s.rien, 2);
  const l4 = L.find(l => l.cut === 4);
  const mic = new Map([[4, { rails: { left: [0, 10, 0], right: [0, 10, 0] }, ecartDepartMm: l4.ecartDepartMm }], [5, { rails: { left: [0, 0, 0], right: [0, 0, 0] }, ecartDepartMm: l4.ecartDepartMm + 50 }]]);
  const C = B.comparer(e, L, mic);
  assert.equal(C.juges, 1); assert.equal(C.nonJuges.departDifferent, 1);
  assert.equal(C.parProfil.L1.n, 1); assert.equal(C.detail[0].cut, 4);
});

test('ligne de commande : la partie 0 d\'un projet est acceptée (3:0), pas le projet 0 ni une partie négative', () => {
  const a = B.args(['rejouer', '--partie', '3:0']);
  assert.equal(a.projet, 3); assert.equal(a.partie, 0); assert.ok(Number.isInteger(a.partie));
  assert.equal(B.args(['rejouer', '--partie', '2:19']).partie, 19);
  for (const mauvais of ['0:3', '3:-1', '3:00', '3:', '3']) assert.throws(() => B.args(['rejouer', '--partie', mauvais]), /--partie/, mauvais);
});

test('--chrono (T21a, garde critère 6-i) : temps de calcul par cut ajoutés, décisions identiques ; sans l’option, aucun champ de temps', () => {
  const sans = rejouer(), avec = B.rejouerLot({ journal: journal(), captures: CAPTURES, projet: 9, partie: 91, lotId: 'lot-a', parametres: PARAMS, chrono: true });
  assert.ok(sans.every(l => !('ms' in l)) && !('chrono' in sans[0]));
  assert.ok('chrono' in avec[0]);
  const cuts = avec.slice(1).filter(l => l.nuage);
  assert.ok(cuts.length > 0 && cuts.every(l => Number.isFinite(l.ms.analyse) && Number.isFinite(l.ms.decision)));
  const nettoie = L => L.slice(1).map(l => { const x = { ...l }; delete x.ms; return JSON.stringify(x); });
  assert.deepEqual(nettoie(avec), nettoie(sans));
});
