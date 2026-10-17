'use strict';
/* 5.0 (D-170, chantier P7) — VOISINS SÛRS POUR LES DIFFÉRÉS (src/voisins-surs-differes.js, fiches/P7_VOISINS_SURS_DIFFERES.md).
 * Post-traitement PUR, coupé par défaut : un cut DIFFÉRÉ PAR LE LOT que la chaîne diffère encore est repris par la décision livrée
 * (`LotDecision.decideCut`, option `validated`, D-054), avec pour appuis validés les poses ACTUELLES des voisins à ±5 cuts (non différés
 * par le lot, pose non fictive, jamais le cut lui-même). La garde de cohérence livrée (`consistentValidated` : 3 voisins alignés à 8 mm)
 * et les étapes livrées décident ; la reprise ne devient jamais un appui de la chaîne.
 * Données : le cut de corpus des essais de la décision (tests/lot-decision-valides.test.cjs) ; rails de départ à 150 mm de la vraie voie. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L = require('../src/lot-decision.js'), O = require('../src/continuity-observer.js'), Shadow = require('../src/gcv1-shadow.js');
const VS = require('../src/voisins-surs-differes.js');
const { K, base } = require('./fixtures.cjs');
const SIDES = ['left', 'right'];
const capture = (rails, cut = 105) => ({ identity: { part: 23, cut, frameId: null }, rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.pointsSceneRelative.map(() => true) });
const science0 = Shadow.scientificProposeBoth(capture(base.rails));
const truth = Object.fromEntries(SIDES.map(side => { const r = base.rails[side], P = r.profileLocalToSceneRelative, d = science0.rails[side].next.delta;
  const w = K.C.point(P, d), o = K.C.point(P, [0, 0, 0]); return [side, O.translated(r, w.map((v, i) => v - o[i]))]; }));
function shifted(rails, mm) { return Object.fromEntries(SIDES.map(side => { const r = rails[side], P = r.profileLocalToSceneRelative, o = K.C.point(r.sceneRelativeToProfileLocal, r.positionSceneRelative);
  const a = K.C.point(P, o), b = K.C.point(P, [o[0], o[1] + mm / 1000, o[2]]); return [side, O.translated(r, [b[0] - a[0], b[1] - a[1], b[2] - a[2]])]; })); }
const pos = rails => Object.fromEntries(SIDES.map(s => [s, rails[s].positionSceneRelative.slice()]));
const pose = (cut, rails, o = {}) => ({ identity: { part: 23, cut, frameId: null }, positions: pos(rails), differe: false, ...o });
const rails = shifted(truth, 150), cap = capture(rails), sci = Shadow.scientificProposeBoth(cap);
const chaine = L.decideCut({ capture: cap, science: sci, anchors: [], Shadow });
/* Une pose « fictive » : l'écartement par défaut d'ESV (1 500 mm), le rail droit replacé sur la droite gauche → droite. */
function fictive(cut) {
  const p = pos(truth), v = [0, 1, 2].map(i => p.right[i] - p.left[i]), n = Math.hypot(...v);
  return { identity: { part: 23, cut, frameId: null }, positions: { left: p.left, right: [0, 1, 2].map(i => p.left[i] + v[i] / n * 1.5) }, differe: false };
}

test('le cut de départ : sans appui, la chaîne le diffère (base de tous les essais)', () => {
  assert.equal(chaine.stage, 'deferred'); assert.equal(chaine.positions, undefined);
});

test('voisins sûrs : ±5 cuts, jamais le cut lui-même, ni un différé du lot, ni une pose fictive, ni une autre partie ou un autre repère', () => {
  const poses = [pose(99, truth), pose(100, truth), pose(103, truth), pose(104, truth, { differe: true }), pose(105, truth), pose(106, truth),
    fictive(107), pose(108, truth, { identity: { part: 24, cut: 108, frameId: null } }), pose(109, truth, { identity: { part: 23, cut: 109, frameId: 'g' } }),
    pose(110, truth), pose(111, truth), { identity: { part: 23, cut: 102, frameId: null }, positions: { left: [0, 0, NaN], right: [0, 0, 0] }, differe: false }];
  assert.deepEqual(VS.voisinsSurs(cap.identity, poses).map(a => a.identity.cut), [100, 103, 106, 110]);
  assert.ok(VS.voisinsSurs(cap.identity, poses).every(a => !('differe' in a)), 'seules identité et positions passent à la décision');
  assert.equal(VS.estFictive(fictive(1).positions), true); assert.equal(VS.estFictive(pos(truth)), false);
  assert.deepEqual(VS.voisinsSurs(cap.identity, poses, { rayon: 1 }).map(a => a.identity.cut), [106], 'rayon 1 : 104 (différé) et 106');
});

test('coupé par défaut : la décision rendue est celle de la chaîne, même objet, aucune tentative', () => {
  const poses = [pose(103, truth), pose(104, truth), pose(106, truth)];
  const r = VS.reprendre({ decision: chaine, differe: true, capture: cap, science: sci, anchors: [], poses, Shadow });
  assert.equal(r.decision, chaine); assert.equal(r.tentative, null);
});

test('jamais sur un vert ni un cut posé par le lot, jamais sur un cut que la chaîne pose', () => {
  const poses = [pose(103, truth), pose(104, truth), pose(106, truth)];
  const vert = VS.reprendre({ decision: chaine, differe: false, capture: cap, science: sci, anchors: [], poses, Shadow, options: { actif: true } });
  assert.equal(vert.decision, chaine); assert.equal(vert.tentative, null);
  const posee = { stage: 'window', positions: pos(truth), anchor: true };
  const p = VS.reprendre({ decision: posee, differe: true, capture: cap, science: sci, anchors: [], poses, Shadow, options: { actif: true } });
  assert.equal(p.decision, posee); assert.equal(p.tentative, null);
});

test('différé du lot que la chaîne diffère, trois voisins sûrs cohérents : la décision livrée le pose, jamais comme appui', () => {
  const poses = [pose(103, truth), pose(104, truth), pose(106, truth)], anchors = [], avant = JSON.stringify(poses);
  const r = VS.reprendre({ decision: chaine, differe: true, capture: cap, science: sci, anchors, poses, Shadow, options: { actif: true } });
  assert.ok(['window', 'choice', 'first-pass', 'crossing'].includes(r.decision.stage), r.decision.stage);
  assert.ok(r.decision.positions, 'une pose');
  assert.equal(r.decision.post, 'voisins-surs'); assert.equal(r.decision.anchor, false, 'jamais un appui de la chaîne');
  assert.deepEqual(r.decision.validatedAnchors.slice().sort(), [103, 104, 106]);
  assert.deepEqual(r.tentative, { version: VS.VERSION, voisins: 3, gardes: [103, 104, 106], stage: r.decision.stage, reason: null, pose: true });
  /* La pose tombe sur la vraie voie (les voisins), à 10 mm près, et non sur la pose de départ (150 mm). */
  const ecart = Math.max(...SIDES.map(s => 1000 * K.C.distance(r.decision.positions[s], truth[s].positionSceneRelative)));
  assert.ok(ecart < 10, `écart à la voie ${ecart} mm`);
  assert.equal(JSON.stringify(poses), avant, 'entrées non modifiées'); assert.deepEqual(anchors, [], 'la liste des appuis de la chaîne n\'est pas touchée');
});

test('moins de trois voisins sûrs (différés du lot, poses fictives écartés) : aucune reprise, le différé reste', () => {
  const poses = [pose(103, truth), pose(104, truth, { differe: true }), fictive(106), pose(107, truth)];
  const r = VS.reprendre({ decision: chaine, differe: true, capture: cap, science: sci, anchors: [], poses, Shadow, options: { actif: true } });
  assert.equal(r.decision, chaine);
  assert.deepEqual(r.tentative, { version: VS.VERSION, voisins: 2, gardes: [], stage: null, reason: 'trop-peu-de-voisins', pose: false });
});

test('voisins incohérents (garde livrée consistentValidated) : aucune reprise', () => {
  const poses = [pose(103, truth), pose(104, shifted(truth, 40)), pose(106, shifted(truth, -40))];
  const r = VS.reprendre({ decision: chaine, differe: true, capture: cap, science: sci, anchors: [], poses, Shadow, options: { actif: true } });
  assert.equal(r.decision, chaine);
  assert.equal(r.tentative.pose, false); assert.deepEqual(r.tentative.gardes, []); assert.equal(r.tentative.voisins, 3);
});

test('une panne de la décision ne change jamais la décision de la chaîne', () => {
  const poses = [pose(103, truth), pose(104, truth), pose(106, truth)];
  const casse = { decideCut() { throw Error('panne'); }, DEFAULTS: L.DEFAULTS };
  const r = VS.reprendre({ decision: chaine, differe: true, capture: cap, science: sci, anchors: [], poses, Shadow, options: { actif: true }, Lot: casse });
  assert.equal(r.decision, chaine); assert.equal(r.tentative.pose, false); assert.equal(r.tentative.reason, 'panne');
});
