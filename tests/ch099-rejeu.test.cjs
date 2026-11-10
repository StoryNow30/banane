'use strict';
/* CH-099 — essais des fonctions pures de tools/ch099-rejeu.cjs (données synthétiques, aucun export terrain). */
const test = require('node:test'), assert = require('node:assert/strict');
const R = require('../tools/ch099-rejeu.cjs');

test('variantes : liste fermée du plan, seul le soutien du dessus change', () => {
  assert.deepEqual(Object.keys(R.VARIANTES), ['S0', 'S60', 'S90']);
  assert.deepEqual(Object.values(R.VARIANTES).map(v => v.soutienTop), [0, 60, 90]);
  for (const v of Object.values(R.VARIANTES)) {
    assert.equal(v.ok, true); assert.equal(v.actif, true); assert.equal(v.mode, 'differer');
    assert.deepEqual([v.porteeMm, v.pasMm, v.loinMm, v.rapport, v.presMm, v.cellulesMax, v.sansPaireLoin, v.soutienFace, v.grainesMode], [400, 120, 50, 1.5, 15, 12, true, 0, 'grille']);
  }
});

test('classe : faute au-delà de 50 mm, juste à 10 mm au plus, moyenne entre les deux', () => {
  assert.equal(R.classe(50.01), 'faute'); assert.equal(R.classe(50), 'moyenne'); assert.equal(R.classe(10.01), 'moyenne');
  assert.equal(R.classe(10), 'juste'); assert.equal(R.classe(0), 'juste'); assert.equal(R.classe(null), null);
});

test('séries : fautes d\'une même partie séparées par 2 cuts au plus', () => {
  const s = R.series([{ lot: 'a', partie: 16, cut: 9266 }, { lot: 'a', partie: 16, cut: 9267 }, { lot: 'a', partie: 16, cut: 9270 }, { lot: 'a', partie: 16, cut: 9274 },
    { lot: 'a', partie: 15, cut: 9268 }, { lot: 'b', partie: 16, cut: 9271 }]);
  assert.deepEqual(s.map(x => x.map(f => f.cut)), [[9268], [9266, 9267, 9270], [9274], [9271]]);
});

test('écartée (D-285) : validation sans mouvement de moins de 1,5 s', () => {
  assert.equal(R.ecartee({ etat: 'corrige', mm: 0, dureeS: 0.8 }), true);
  assert.equal(R.ecartee({ etat: 'corrige', mm: 0, dureeS: 1.5 }), false);
  assert.equal(R.ecartee({ etat: 'corrige', mm: 3, dureeS: 0.8 }), false);
  assert.equal(R.ecartee({ etat: 'controle', mm: 0, dureeS: 0.2 }), false);
});

test('couverture : étendue en travers des points lus autour de la pose de départ', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const rail = { positionSceneRelative: [0, 0, 0], sceneRelativeToProfileLocal: I };
  const pts = []; for (let y = -0.45; y <= 0.4501; y += 0.01) pts.push([0, y, 0]);
  pts.push([2, 0.9, 0]); /* hors de la bande longitudinale : ignoré */
  const c = R.couverture({ rails: { left: rail, right: rail }, pointsSceneRelative: pts });
  assert.equal(c.left.n, 91); assert.ok(c.left.min <= -449 && c.left.max >= 449); assert.equal(c.couvre400, true);
  const c2 = R.couverture({ rails: { left: rail, right: rail }, pointsSceneRelative: pts.filter(p => Math.abs(p[1]) < 0.2) });
  assert.equal(c2.couvre400, false);
});

test('verdict : seuils du plan', () => {
  const v = (o) => R.verdict({ series: 4, fautes: 10, differees: 7, poses: 1000, posesDifferes: 50, sansPaire: 0, ...o }).verdict;
  assert.equal(v({}), 'candidat pour l\'ombre');
  assert.equal(v({ series: 2 }), 'non concluable');
  assert.equal(v({ differees: 4 }), 'abandon');
  assert.equal(v({ posesDifferes: 81 }), 'abandon');
  assert.equal(v({ sansPaire: 6 }), 'abandon');
  assert.equal(v({ differees: 6 }), 'ni candidat ni abandon');
  assert.equal(v({ differees: 5 }), 'ni candidat ni abandon');
});

test('wilson : borne haute de 0 sur 73 proche de 5 %', () => {
  const w = R.wilson(0, 73); assert.equal(w.bas, 0); assert.ok(w.haut > 0.045 && w.haut < 0.055);
});
