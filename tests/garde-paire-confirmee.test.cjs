'use strict';
/* 5.0 (D-170, chantier P7) — GARDE DE PAIRE CONFIRMÉE PAR LA VOIE (src/garde-paire-confirmee.js, fiches/P7_GARDE_PAIRE_CONFIRMEE.md).
 * Post-traitement PUR, coupé par défaut : un cut que la garde de paire retire (`reason: 'pair-guard'`) est posé à la pose du MOTEUR si,
 * la garde levée, la décision livrée pose au premier passage ET si cette paire tombe à N mm de la voie de la chaîne (appuis de
 * prédiction livrés) ou de la voie des voisins sûrs (poses actuelles à ±5 cuts, garde de cohérence livrée). Jamais un appui.
 * Données : le cut de corpus des essais de la décision ; la science est marquée pour la garde de paire (rail repêché par S1 à gauche ;
 * le rail droit a déjà un calage de convention refusé `shift-out-of-domain`). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L = require('../src/lot-decision.js'), O = require('../src/continuity-observer.js'), Shadow = require('../src/gcv1-shadow.js');
const GP = require('../src/garde-paire-confirmee.js');
const { K, base } = require('./fixtures.cjs');
const SIDES = ['left', 'right'];
const capture = (rails, cut = 105) => ({ identity: { part: 23, cut, frameId: null }, rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.pointsSceneRelative.map(() => true) });
const cap = capture(base.rails);
const science0 = Shadow.scientificProposeBoth(cap);
/* Science marquée : la garde de paire s'applique (S1 a changé le rail gauche, calage du droit hors domaine). */
const sci = JSON.parse(JSON.stringify(science0));
sci.rails.left.next.changed = true;
/* Rails « moteur » : la pose de départ translatée sur la proposition du moteur. */
const moteur = Object.fromEntries(SIDES.map(side => { const r = base.rails[side], P = r.profileLocalToSceneRelative, d = science0.rails[side].next.delta;
  const w = K.C.point(P, d), o = K.C.point(P, [0, 0, 0]); return [side, O.translated(r, w.map((v, i) => v - o[i]))]; }));
/* Décalage d'une voie (rails) de `lat` mm en travers et `vert` mm en hauteur, repère profil de chaque rail. */
function decale(rails, lat, vert = 0) { return Object.fromEntries(SIDES.map(side => { const r = rails[side], P = r.profileLocalToSceneRelative, o = K.C.point(r.sceneRelativeToProfileLocal, r.positionSceneRelative);
  const a = K.C.point(P, o), b = K.C.point(P, [o[0], o[1] + lat / 1000, o[2] + vert / 1000]); return [side, O.translated(r, [b[0] - a[0], b[1] - a[1], b[2] - a[2]])]; })); }
const pos = rails => Object.fromEntries(SIDES.map(s => [s, rails[s].positionSceneRelative.slice()]));
const pose = (cut, rails, o = {}) => ({ identity: { part: 23, cut, frameId: null }, positions: pos(rails), differe: false, ...o });
const appui = (cut, rails) => ({ identity: { part: 23, cut, frameId: null }, positions: pos(rails), stage: 'first-pass' });
const garde = L.decideCut({ capture: cap, science: sci, anchors: [], Shadow });
const ACTIF = { actif: true, nMm: 10, axes: 'lv' };

test('le cut de départ : la garde de paire le retire (base de tous les essais) ; sans elle, le moteur pose au premier passage', () => {
  assert.equal(garde.stage, 'deferred'); assert.equal(garde.reason, 'pair-guard'); assert.equal(garde.pairGuarded, true); assert.equal(garde.positions, undefined);
  const sans = L.decideCut({ capture: cap, science: sci, anchors: [], Shadow, options: { pairGuard: false } });
  assert.equal(sans.stage, 'first-pass'); assert.ok(sans.positions);
});

test('coupé par défaut : la décision rendue est la même, aucune tentative', () => {
  const poses = [pose(103, moteur), pose(104, moteur), pose(106, moteur)];
  const r = GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses, Shadow });
  assert.equal(r.decision, garde); assert.equal(r.tentative, null); assert.equal(r.leve, null);
  assert.equal(GP.DEFAUTS.actif, false);
});

test('jamais sur une autre décision que la garde de paire (différé sans appui, cut posé)', () => {
  const poses = [pose(103, moteur), pose(104, moteur), pose(106, moteur)];
  const autre = { stage: 'deferred', reason: 'no-anchor' };
  assert.equal(GP.lever({ decision: autre, capture: cap, science: sci, anchors: [], poses, Shadow, options: ACTIF }).decision, autre);
  const posee = { stage: 'first-pass', positions: pos(moteur), anchor: true };
  const r = GP.lever({ decision: posee, capture: cap, science: sci, anchors: [], poses, Shadow, options: ACTIF });
  assert.equal(r.decision, posee); assert.equal(r.tentative, null);
});

test('voisins sûrs sur la voie du moteur : la paire du moteur est posée, au premier passage, jamais comme appui', () => {
  const poses = [pose(103, moteur), pose(104, moteur), pose(106, moteur)], anchors = [], avant = JSON.stringify(poses);
  const r = GP.lever({ decision: garde, capture: cap, science: sci, anchors, poses, Shadow, options: ACTIF });
  assert.equal(r.decision.stage, 'first-pass'); assert.ok(r.decision.positions);
  assert.equal(r.decision.anchor, false, 'jamais un appui de la chaîne');
  assert.equal(r.decision.post, 'garde-paire-confirmee'); assert.equal(r.decision.liftedReason, 'pair-guard');
  assert.equal(r.decision.gardePaire.source, 'voisins'); assert.ok(r.decision.gardePaire.ecartMm <= 1, `écart ${r.decision.gardePaire.ecartMm}`);
  for (const s of SIDES) assert.ok(1000 * K.C.distance(r.decision.positions[s], moteur[s].positionSceneRelative) < 0.5, 'pose = proposition du moteur');
  assert.equal(r.tentative.pose, true); assert.equal(r.tentative.voies.chaine, null, 'sans appui, pas de voie de chaîne');
  assert.deepEqual(r.tentative.voies.voisins.gardes, [103, 104, 106]);
  assert.equal(JSON.stringify(poses), avant, 'entrées non modifiées'); assert.deepEqual(anchors, []);
});

test('voie des voisins à 30 mm en travers : non confirmée, la garde reste ; la levée est rendue à part (étude hors ligne)', () => {
  const poses = [pose(103, decale(moteur, 30)), pose(104, decale(moteur, 30)), pose(106, decale(moteur, 30))];
  const r = GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses, Shadow, options: ACTIF });
  assert.equal(r.decision, garde);
  assert.equal(r.tentative.pose, false); assert.equal(r.tentative.reason, 'voie-non-confirmee');
  assert.ok(Math.abs(r.tentative.voies.voisins.lat[0] - 30) < 0.5 && Math.abs(r.tentative.voies.voisins.lat[1] - 30) < 0.5, JSON.stringify(r.tentative.voies));
  assert.equal(r.leve.stage, 'first-pass'); assert.equal(r.leve.anchor, false);
  /* Le seuil N décide : à 40 mm, la même voie confirme. */
  assert.equal(GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses, Shadow, options: { ...ACTIF, nMm: 40 } }).decision.post, 'garde-paire-confirmee');
});

test('voie décalée de 15 mm en hauteur seulement : confirmée en latéral seul (axes l), refusée en latéral et vertical (axes lv)', () => {
  const poses = [pose(103, decale(moteur, 0, 15)), pose(104, decale(moteur, 0, 15)), pose(106, decale(moteur, 0, 15))];
  const lv = GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses, Shadow, options: ACTIF });
  assert.equal(lv.decision, garde);
  const l = GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses, Shadow, options: { ...ACTIF, axes: 'l' } });
  assert.equal(l.decision.post, 'garde-paire-confirmee');
  assert.equal(GP.ecartMax(lv.tentative.voies.voisins, 'l') < 1, true); assert.ok(Math.abs(GP.ecartMax(lv.tentative.voies.voisins, 'lv') - 15) < 0.5);
});

test('voie de la chaîne : un appui sur la voie du moteur confirme ; un appui à 25 mm ne confirme pas', () => {
  const ok = GP.lever({ decision: L.decideCut({ capture: cap, science: sci, anchors: [appui(104, moteur)], Shadow }), capture: cap, science: sci, anchors: [appui(104, moteur)], poses: [], Shadow, options: ACTIF });
  assert.equal(ok.decision.post, 'garde-paire-confirmee'); assert.equal(ok.decision.gardePaire.source, 'chaine');
  assert.deepEqual(ok.tentative.voies.chaine.appuis, [104]); assert.equal(ok.tentative.voies.voisins.gardes.length, 0);
  const loin = [appui(104, decale(moteur, 25))], dl = L.decideCut({ capture: cap, science: sci, anchors: loin, Shadow });
  assert.equal(dl.reason, 'pair-guard', 'garde de continuité (30 mm) passée : la garde de paire retire le cut');
  const r = GP.lever({ decision: dl, capture: cap, science: sci, anchors: loin, poses: [], Shadow, options: ACTIF });
  assert.equal(r.decision, dl); assert.equal(r.tentative.reason, 'voie-non-confirmee');
  /* « ou » : la voie des voisins suffit quand celle de la chaîne est loin. */
  const both = GP.lever({ decision: dl, capture: cap, science: sci, anchors: loin, poses: [pose(103, moteur), pose(106, moteur), pose(107, moteur)], Shadow, options: ACTIF });
  assert.equal(both.decision.gardePaire.source, 'voisins');
  /* Sources restreintes : la chaîne seule ne confirme pas. */
  const ch = GP.lever({ decision: dl, capture: cap, science: sci, anchors: loin, poses: [pose(103, moteur), pose(106, moteur), pose(107, moteur)], Shadow, options: { ...ACTIF, sources: ['chaine'] } });
  assert.equal(ch.decision, dl);
});

test('aucune voie (ni appui, ni trois voisins sûrs cohérents ; différés, poses fictives et le cut lui-même écartés) : la garde reste', () => {
  const p = pos(moteur), v = [0, 1, 2].map(i => p.right[i] - p.left[i]), n = Math.hypot(...v);
  const fictive = { identity: { part: 23, cut: 107, frameId: null }, positions: { left: p.left, right: [0, 1, 2].map(i => p.left[i] + v[i] / n * 1.5) }, differe: false };
  const poses = [pose(103, moteur), pose(104, moteur, { differe: true }), fictive, pose(105, moteur), pose(112, moteur)];
  assert.deepEqual(GP.voisinsSurs(cap.identity, poses).map(a => a.identity.cut), [103]);
  const r = GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses, Shadow, options: ACTIF });
  assert.equal(r.decision, garde); assert.equal(r.tentative.reason, 'sans-voie'); assert.equal(r.tentative.voies.voisins.candidats, 1);
});

test('sans la garde de paire, une autre garde livrée retire encore la paire : rien n\'est posé (seule la pose du moteur est confirmée)', () => {
  const faux = { decideCut: () => ({ stage: 'deferred', reason: 'gauge-guard' }), DEFAULTS: L.DEFAULTS, neighbours: L.neighbours, predictionAnchors: L.predictionAnchors, consistentValidated: L.consistentValidated, predictFramed: L.predictFramed };
  const r = GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses: [pose(103, moteur), pose(104, moteur), pose(106, moteur)], Shadow, options: ACTIF, Lot: faux });
  assert.equal(r.decision, garde); assert.equal(r.tentative.stage, 'deferred'); assert.equal(r.tentative.reason, 'gauge-guard'); assert.equal(r.leve, null);
});

test('une panne de la décision ne change jamais la décision rendue', () => {
  const casse = { decideCut() { throw Error('panne'); }, DEFAULTS: L.DEFAULTS };
  const r = GP.lever({ decision: garde, capture: cap, science: sci, anchors: [], poses: [], Shadow, options: ACTIF, Lot: casse });
  assert.equal(r.decision, garde); assert.equal(r.tentative.pose, false); assert.equal(r.tentative.reason, 'panne');
});

test('confirme : la voie la plus proche sous N, null sans voie ; réglages de la grille d\'étude', () => {
  const voies = { chaine: { lat: [4, 2], vert: [9, 1] }, voisins: { lat: [1, 1], vert: [12, 3] } };
  assert.deepEqual(GP.confirme(voies, { nMm: 10, axes: 'lv' }), { source: 'chaine', ecartMm: 9 });
  assert.deepEqual(GP.confirme(voies, { nMm: 10, axes: 'l' }), { source: 'voisins', ecartMm: 1 });
  assert.equal(GP.confirme(voies, { nMm: 5, axes: 'lv' }), null);
  assert.equal(GP.confirme({ chaine: null, voisins: { candidats: 2, gardes: [] } }, { nMm: 100, axes: 'l' }), null);
  assert.ok(GP.GRILLE.length >= 4 && GP.GRILLE.every(g => g.nMm > 0 && ['l', 'lv'].includes(g.axes)));
});
