'use strict';
/* CH-121 (D-352) : étage final d'ajustement de la pose sur le profil du rail (`ajusterPoseFinale`, src/gcv2-l1.js ; levier `ajustementFin`, coupé). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const G = require('../src/gcv2-l1.js'), Conv = require('../src/placement-convention.js');
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/* Champignon rectangulaire (dessus z = 0 de u = 0 à 64 mm, flanc en u = 0 jusqu'à −40 mm), repère profil = scène. Points d'un rail posé au décalage
 * `pose` (mm) : dessus de `dessus` mm (± `ep`/2) au-dessus du gabarit posé, flanc à `flanc` mm du gabarit posé (vers le champignon). */
function capture({ pose = [0, 0, 0], dessus = 0, ep = 4, flanc = 0, nTop = 40, nFace = 12, ecart = 1.44 } = {}) {
  const contour = [];
  for (let y = 0; y <= .064 + 1e-12; y += .001) contour.push([0, y, 0]);
  for (let z = -.001; z >= -.04 - 1e-12; z -= .001) contour.push([0, 0, z]);
  const bu = pose[1] / 1000, bz = pose[2] / 1000, pts = [];
  for (let i = 0; i < nTop; i++) pts.push([0, bu + .015 + i * (.035 / (nTop - 1)), bz + (dessus - ep / 2 + i * (ep / (nTop - 1))) / 1000]);
  for (let i = 0; i < nFace; i++) pts.push([0, bu + (flanc + 2.6 - 1 + i * (2 / (nFace - 1))) / 1000, bz - .012 - i * (.02 / (nFace - 1))]);
  const rail = { positionSceneRelative: [0, 0, 0], sceneRelativeToProfileLocal: I, profileLocalToSceneRelative: I, profileContours: [{ verticesSceneRelative: contour }] };
  /* le rail droit, à `ecart` m en −y (le latéral du rail gauche vers le champignon est +y : l'écartement grandit quand le rail gauche va vers +y) ; son repère profil
   * est translaté pour qu'aucun point ne soit dans sa fenêtre : il ne bouge pas */
  const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, ecart, 0, 1], Ti = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -ecart, 0, 1];
  return { rails: { left: rail, right: { ...rail, positionSceneRelative: [0, -ecart, 0], sceneRelativeToProfileLocal: T, profileLocalToSceneRelative: Ti } }, pointsSceneRelative: pts, visibleByClipBoxes: pts.map(() => true) };
}
const R = { c: 4.4, epMax: 15, dzMax: 13, domaine: 8, tolV: 4, tolL: 4 };

test('levier coupé : la pose reçue, à l’identique, et le levier livré est null', () => {
  assert.equal(G.LEVIERS_LIVRES.ajustementFin, null);
  const d = { left: [0, 1, 2], right: [0, 3, 4] }, r = G.ajusterPoseFinale(capture(), d);
  assert.equal(r.decal, d); assert.equal(r.ajuste, false);
  assert.equal(G.ajusterPoseFinale(capture(), d, null).decal, d);
});

test('la fenêtre de lecture suit la pose : un rail posé à 210 mm de son départ est lu (le calage de convention, centré sur le départ, ne le voit pas)', () => {
  const pose = [0, 210, 0], cap = capture({ pose, dessus: 0, flanc: 6 });
  assert.equal(Conv.calibrate(cap, 'left', pose.map(v => v / 1000)).reason, 'top-under-observed');
  const r = G.ajusterPoseFinale(cap, { left: pose, right: [0, 210, 0] }, R);
  assert.equal(r.ajuste, true);
  assert.ok(Math.abs(r.decal.left[1] - (210 + 6)) < 0.3, `latéral ${r.decal.left[1]}`);
  assert.deepEqual(r.decal.right, [0, 210, 0]);
});

test('vertical : médiane du dessus + c ; près de l’enveloppe (médiane à −c), rien', () => {
  const r = G.ajusterPoseFinale(capture({ dessus: 5, ep: 4 }), { left: [0, 0, 0], right: [0, 0, 0] }, { ...R, lateral: false });
  const q50 = 5 - 2 + Math.floor(.5 * 40) * (4 / 39);
  assert.ok(Math.abs(r.decal.left[2] - (q50 + 4.4)) < 0.05, `vertical ${r.decal.left[2]}`);
  assert.equal(G.ajusterPoseFinale(capture({ dessus: -4.4, ep: 4 }), { left: [0, 0, 0], right: [0, 0, 0] }, { ...R, lateral: false }).ajuste, false);
});

test('vertical : bande épaisse ou déplacement au-delà de dzMax : rien', () => {
  assert.equal(G.ajusterPoseFinale(capture({ dessus: 3, ep: 20 }), { left: [0, 0, 0], right: [0, 0, 0] }, { ...R, lateral: false }).ajuste, false);
  assert.equal(G.ajusterPoseFinale(capture({ dessus: 10, ep: 2 }), { left: [0, 0, 0], right: [0, 0, 0] }, { ...R, lateral: false }).ajuste, false);
});

test('point fixe : l’étage réappliqué à sa propre pose ne bouge plus (bande de 10 mm, rail 6 mm trop bas, flanc à 7 mm)', () => {
  const cap = capture({ dessus: 6 - 4.4, ep: 10, flanc: 7, nTop: 60 });
  const r1 = G.ajusterPoseFinale(cap, { left: [0, 0, 0], right: [0, 0, 0] }, R);
  assert.equal(r1.ajuste, true);
  const r2 = G.ajusterPoseFinale(cap, r1.decal, R);
  assert.equal(r2.ajuste, false, JSON.stringify(r2.info));
});

test('latéral : refusé si l’écartement de la paire sortirait des bornes', () => {
  const cap = capture({ flanc: 6, ecart: 1.471 });
  const r = G.ajusterPoseFinale(cap, { left: [0, 0, 0], right: [0, 0, 0] }, R);
  assert.equal(r.decal.left[1], 0); assert.ok(r.info.ecartementRefuse > 1475);
  const r2 = G.ajusterPoseFinale(capture({ flanc: 6 }), { left: [0, 0, 0], right: [0, 0, 0] }, R);
  assert.ok(Math.abs(r2.decal.left[1] - 6) < 0.3);
});
