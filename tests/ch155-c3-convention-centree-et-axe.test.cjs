'use strict';
/* CH-155 (Lot C3, D-380 / D-381) :
 *  1. Centrage de `Conv.bandOffsets` / `Conv.calibrate` (`src/placement-convention.js`) autour de `(delta[1], delta[2])`
 *     pour les poses éloignées du départ (`|delta[1]| >= 0.13` ou `options.centrerFenetre === true`), tout en gardant
 *     une identité stricte au bit près sur toutes les poses proches (`|delta[1]| < 0.13`) afin de ne jamais perturber la chaîne ;
 *  2. Arbitrage fin en travers par l'axe (`c3AffinerPoseParAxe` dans `src/gcv2-l1.js`, mode sans ricochet sur les poses GCV2) :
 *     - rapproche le rail vers son flanc LiDAR local UNIQUEMENT lorsque le milieu de la paire se rapproche strictement de l'axe
 *       prédit par `ancre-trajectoire.js` et maintient l'écartement dans `±10 mm` de la référence ;
 *     - refuse tout déplacement qui éloignerait la paire de l'axe (fausse face voisine en aiguillage).
 * Données 100 % synthétiques / issues de `tests/fixtures.cjs`. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const Conv = require('../src/placement-convention.js');
const L1 = require('../src/gcv2-l1.js');
const A = require('../src/ancre-trajectoire.js');
const L = require('../src/lot-decision.js');
const O = require('../src/continuity-observer.js');
const Sh = require('../src/gcv1-shadow.js');
const C = require('../vendor/capture-core.js');
const { base } = require('./fixtures.cjs');

test('CH-155 (C3a) : Conv.calibrate retrouve exactement le calage à -220 mm du départ (fin du top-under-observed) et garde le bit-exact sous 130 mm', () => {
  const sci0 = Sh.scientificProposeBothAvecReservoir(base);
  const d0 = sci0.rails.left.next.delta;
  const rawL = sci0.rails.left.conventionCalibration.rawDelta;
  assert.equal(sci0.rails.left.conventionCalibration.applied, true, 'sur left, le calage original s\'applique');

  /* Déplaçons le rail de départ gauche de -260 mm du côté ballast vide (`+260 mm` vers le vrai rail, hors de ±180 mm !) : */
  const pL = L.positionOf(base.rails.left, d0);
  const railDeplace = O.translated(
    base.rails.left,
    L.positionOf(base.rails.left, [0, rawL[1] - 0.260, rawL[2]]).map((v, i) => v - base.rails.left.positionSceneRelative[i])
  );
  const capLoin = { ...base, rails: { ...base.rails, left: railDeplace } };
  const deltaVersVrai = [0, 0.260, 0];

  /* Sans centrage (`centrerFenetre: false`), les points à +260 mm tombent hors de |q1| < 0.18 → `top-under-observed` ! */
  const sansCentrage = Conv.calibrate(capLoin, 'left', deltaVersVrai, { centrerFenetre: false });
  assert.equal(sansCentrage.applied, false);
  assert.equal(sansCentrage.reason, 'top-under-observed');

  /* Par défaut avec CH-155 (`|delta[1]| >= 0.13`), la fenêtre suit `(delta[1], delta[2])` : le calage s'applique et ramène le rail à < 1,5 mm de `pL` ! */
  const avecCentrage = Conv.calibrate(capLoin, 'left', deltaVersVrai);
  assert.equal(avecCentrage.applied, true, `attendu applied:true à +260 mm, obtenu reason=${avecCentrage.reason}`);
  const posCalee = L.positionOf(railDeplace, avecCentrage.delta);
  const errMm = 1000 * C.distance(posCalee, pL);
  assert.ok(errMm < 2.0, `le calage centré supprime le biais brut (erreur résiduelle = ${errMm.toFixed(2)} mm)`);

  /* Sous 130 mm (`delta = [0, 0.04, 0.005]`), sortie identique au bit près à `centrerFenetre: false` ! */
  const procheDef = Conv.calibrate(base, 'left', [0, 0.04, 0.005]);
  const procheAncien = Conv.calibrate(base, 'left', [0, 0.04, 0.005], { centrerFenetre: false });
  assert.deepStrictEqual(procheDef, procheAncien, 'sous 130 mm, identité stricte au bit près');
});

test('CH-155 (C3b) : affinerPoseParAxe rapproche une pose GCV2 du flanc seulement quand l\'écart à l\'axe diminue, et refuse une fausse face hors axe', () => {
  assert.equal(typeof L1.affinerPoseParAxe, 'function', 'affinerPoseParAxe doit être exposée par src/gcv2-l1.js');

  const sci0 = Sh.scientificProposeBothAvecReservoir(base);
  const pL0 = L.positionOf(base.rails.left, sci0.rails.left.next.delta);
  const pR0 = L.positionOf(base.rails.right, sci0.rails.right.next.delta);
  const gVraiMm = 1000 * C.distance(pL0, pR0);
  const dx = pL0[0] - pR0[0], dy = pL0[1] - pR0[1], g0 = Math.hypot(dx, dy), ex = dx / g0, ey = dy / g0, nx = ey, ny = -ex;
  const Mx0 = (pL0[0] + pR0[0]) / 2, My0 = (pL0[1] + pR0[1]) / 2, T = [10, -20, 3];

  const construirEtatAxe = (decalAxeMm = 0) => {
    const n = 260, st = [], fl = [], ed = [];
    for (let i = 0; i < n; i++) {
      const s = (i - 130) * 1.0;
      const d = (i === 130 ? 0 : decalAxeMm / 1000);
      const cx = Mx0 + s * nx + d * ex, cy = My0 + s * ny + d * ey;
      st.push(i === 130 ? 1 : 0); fl.push(0);
      ed.push(
        Math.round((cx + (g0 / 2) * ex + T[0]) * 1e4), Math.round((cy + (g0 / 2) * ey + T[1]) * 1e4), Math.round((pL0[2] + T[2]) * 1e4),
        Math.round((cx - (g0 / 2) * ex + T[0]) * 1e4), Math.round((cy - (g0 / 2) * ey + T[1]) * 1e4), Math.round((pR0[2] + T[2]) * 1e4)
      );
    }
    const E = A.etat({ n, st, fl, ed });
    for (const c of [90, 91, 92]) {
      const o = 6 * c;
      A.noter(E, c, { rails: { left: { positionSceneRelative: [0, 1, 2].map(j => ed[o + j] / 1e4 - T[j]) }, right: { positionSceneRelative: [0, 1, 2].map(j => ed[o + 3 + j] / 1e4 - T[j]) } } });
    }
    /* Noter aussi le cut 130 avec une capture alignée sur la ligne 130 (`pL0`, `pR0`). */
    const cap130 = {
      ...base,
      identity: { part: 23, cut: 130, frameId: null },
      rails: {
        left: O.translated(base.rails.left, pL0.map((v, i) => v - base.rails.left.positionSceneRelative[i])),
        right: O.translated(base.rails.right, pR0.map((v, i) => v - base.rails.right.positionSceneRelative[i])),
      },
    };
    A.noter(E, 130, cap130);
    return { E, cap130 };
  };

  /* Cas 1 : l'axe est sur la vraie voie (0 mm), mais une pose GCV2 initialement décalée de +6 mm sur le rail droit est soumise :
   * le flanc LiDAR la ramène vers 0 mm ET l'écart du milieu à l'axe diminue de ~3 mm vers ~0 mm → accepté ! */
  const { E: E1, cap130: cap1 } = construirEtatAxe(0);
  const decalBiaise = { left: [0, 0, 0], right: [0, 6.0, 0] };
  const r1 = L1.affinerPoseParAxe({ capture: cap1, cut: 130, decal: decalBiaise, etatAncre: E1, gRefMm: gVraiMm });
  assert.equal(r1.applique, true, 'le recalage flanc qui rapproche de l\'axe est accepté');
  assert.ok(Math.abs(r1.decal.right[1]) < 3.0, `rail droit ramené près de 0 mm (obtenu ${r1.decal.right[1]} mm)`);

  /* Cas 2 : l'axe est à +12 mm (de sorte que ramener le rail droit de +6 mm vers 0 mm ÉLOIGNERAIT le milieu de l'axe !) → refusé ! */
  const { E: E2, cap130: cap2 } = construirEtatAxe(12);
  const r2 = L1.affinerPoseParAxe({ capture: cap2, cut: 130, decal: decalBiaise, etatAncre: E2, gRefMm: gVraiMm });
  assert.equal(r2.applique, false, 'un recalage flanc qui éloigne le milieu de l\'axe est refusé');
  assert.deepStrictEqual(r2.decal, decalBiaise);
});
