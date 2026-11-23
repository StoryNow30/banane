'use strict';
/* CH-154 (Lot C2 + C4, D-380 / D-381) :
 *  1. `BananeAncreTrajectoire.jugerConnu` et `fenetres` (intervalle de décalage en travers admissible par rail autour de l'axe) ;
 *  2. C2 (`probasAncre` + filtrage en aiguillage dans `BananeGcv2L1`) : lorsqu'une paire candidate en ADV tombe sur la branche divergente
 *     (> 75 mm de l'axe) alors que le pool contient la bonne paire proche de l'axe (≤ 35 mm, p ≥ τ), la décision retient la bonne branche
 *     sans jamais modifier une pose déjà valide sur la bonne voie ;
 *  3. C4 (`N+` haute pureté dans `BananeDecisionLotPartagee.deciderCutL1se`) : lorsqu'une pose (ex. de la chaîne trompée par ESV sur l'autre voie)
 *     est refusée par l'ancre N (> 75 mm), la reprise `N+` relance la décision sur le pool restreint à l'ancre (sans les appuis/voisins refusés),
 *     valide la vraie voie si elle est proche de l'axe (≤ 25 mm) et fortement soutenue, et garde 0 ricochet sur les cuts suivants.
 * Données 100 % synthétiques / issues de `tests/fixtures.cjs`. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../src/ancre-trajectoire.js');
const L1 = require('../src/gcv2-l1.js');
const DLP = require('../src/decision-lot-partagee.js');
const Sh = require('../src/gcv1-shadow.js');
const L = require('../src/lot-decision.js');
const O = require('../src/continuity-observer.js');
const C = require('../vendor/capture-core.js');
const PARAM = require('../src/gcv2-parametres-l1.js');
const { base } = require('./fixtures.cjs');

const MOD = L1.modeleFige(PARAM, 'lot');
const SIDES = ['left', 'right'];

function construireTableAvecAxe({ pL, pR, cutCible = 150, deportLigneM = 0.150, n = 300, T = [10, 20, 1] }) {
  const dx = pL[0] - pR[0], dy = pL[1] - pR[1], g0 = Math.hypot(dx, dy), ex = dx / g0, ey = dy / g0, nx = ey, ny = -ex;
  const Mx0 = (pL[0] + pR[0]) / 2, My0 = (pL[1] + pR[1]) / 2;
  const st = [], fl = [], ed = [];
  for (let i = 0; i < n; i++) {
    const s = (i - cutCible) * 1.0;
    const dep = (i >= cutCible - 2 && i <= cutCible + 2) ? deportLigneM : 0;
    const cx = Mx0 + s * nx + dep * ex, cy = My0 + s * ny + dep * ey;
    st.push(dep ? 1 : 0); fl.push(dep ? 2 : 0);
    ed.push(
      Math.round((cx + (g0 / 2) * ex + T[0]) * 1e4), Math.round((cy + (g0 / 2) * ey + T[1]) * 1e4), Math.round((pL[2] + T[2]) * 1e4),
      Math.round((cx - (g0 / 2) * ex + T[0]) * 1e4), Math.round((cy - (g0 / 2) * ey + T[1]) * 1e4), Math.round((pR[2] + T[2]) * 1e4)
    );
  }
  const E = A.etat({ n, st, fl, ed });
  for (const c of [100, 101, 102]) {
    const o = 6 * c;
    A.noter(E, c, { rails: { left: { positionSceneRelative: [0, 1, 2].map(j => ed[o + j] / 1e4 - T[j]) }, right: { positionSceneRelative: [0, 1, 2].map(j => ed[o + 3 + j] / 1e4 - T[j]) } } });
  }
  return { E, ex, ey };
}

test('CH-154 (C2 + C4) : jugerConnu, fenetres et probasAncre isolent la fenêtre de la voie relevée', () => {
  assert.equal(typeof A.jugerConnu, 'function', 'jugerConnu doit exister');
  assert.equal(typeof A.fenetres, 'function', 'fenetres doit exister');
  assert.equal(typeof L1.probasAncre, 'function', 'probasAncre doit exister');

  const sci0 = Sh.scientificProposeBothAvecReservoir(base);
  const vrai = Object.fromEntries(SIDES.map(s => [s, L.positionOf(base.rails[s], sci0.rails[s].next.delta)]));
  const { E, ex, ey } = construireTableAvecAxe({ pL: vrai.left, pR: vrai.right, cutCible: 150, deportLigneM: 0.150 });
  const cap150 = {
    identity: { part: 23, cut: 150, frameId: null },
    rails: {
      left: O.translated(base.rails.left, [vrai.left[0] + 0.150 * ex - base.rails.left.positionSceneRelative[0], vrai.left[1] + 0.150 * ey - base.rails.left.positionSceneRelative[1], vrai.left[2] - base.rails.left.positionSceneRelative[2]]),
      right: O.translated(base.rails.right, [vrai.right[0] + 0.150 * ex - base.rails.right.positionSceneRelative[0], vrai.right[1] + 0.150 * ey - base.rails.right.positionSceneRelative[1], vrai.right[2] - base.rails.right.positionSceneRelative[2]]),
    },
  };
  assert.equal(A.jugerConnu(E, 150, vrai).muet, 'non-note');
  assert.equal(A.juger(E, 150, cap150, { left: cap150.rails.left.positionSceneRelative, right: cap150.rails.right.positionSceneRelative }).refus, true);
  assert.equal(A.jugerConnu(E, 150, vrai).refus, false);

  const F = A.fenetres(E, 150, cap150, [1420, 1470]);
  assert.equal(F.muet, undefined);
  assert.ok(Math.abs(F.centreMm + 150) < 4);

  const h = (decal, origines) => ({ rang: 0, hauteur: false, origines, sousOrigines: [], decal, g: 1440, x: null });
  const k = {
    cut: 150, zone: 'adv', gMed: 1440, G0: 1440, voieRef: null, i0: { left: 0, right: 0 },
    rails: {
      left: { hyps: [h([0, 0, 0], ['H0']), h([0, 160, 0], ['H1']), h([0, 6, 0], ['H2'])] },
      right: { hyps: [h([0, 0, 0], ['H0']), h([0, 160, 0], ['H1']), h([0, 6, 0], ['H2'])] },
    },
  };
  const p = L1.probasAncre(k, null, { left: [-40, 40], right: [-40, 40] }, { left: [0.05, 0.95, 0.85], right: [0.05, 0.95, 0.85] });
  assert.deepEqual(Array.from(p.left), [0.05, 0, 0.85], 'l\'hypothèse sur l\'autre voie (+160 mm) est annulée');
});

test('CH-154 (C4 N+) : une pose de la chaîne refusée par l\'ancre N (> 75 mm) est reprise juste sur la vraie voie sans ricochet', () => {
  /* Dans `base` (`cut 2855`), à +150 mm il y a une seconde voie d'aiguillage sur laquelle la chaîne du lot peut poser par erreur !
   * Vérifions : lorsque `decisionLot` propose une pose fausse à +150 mm (refusée par l'ancre N), `deciderCutL1se` avec `N+` actif
   * relance la décision dans la fenêtre de l'axe (0 mm) et repose les vrais rails (`vrai`) à ≤ 10 mm, sans ricochet ! */
  const cap0 = { identity: { part: 23, cut: 150, frameId: null }, rails: base.rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.visibleByClipBoxes };
  const sci0 = Sh.scientificProposeBothAvecReservoir(cap0);
  const vrai = Object.fromEntries(SIDES.map(s => [s, L.positionOf(cap0.rails[s], sci0.rails[s].next.delta)]));
  const gVraiMm = 1000 * C.distance(vrai.left, vrai.right);
  const { E, ex, ey } = construireTableAvecAxe({ pL: vrai.left, pR: vrai.right, cutCible: 150, deportLigneM: 0 });
  /* Calons aussi le cut 150 dont les rails de départ sont alignés sur la ligne 150 (`vrai`) : */
  const cap150 = {
    ...cap0,
    rails: {
      left: O.translated(cap0.rails.left, vrai.left.map((v, i) => v - cap0.rails.left.positionSceneRelative[i])),
      right: O.translated(cap0.rails.right, vrai.right.map((v, i) => v - cap0.rails.right.positionSceneRelative[i])),
    },
  };
  const sci150 = Sh.scientificProposeBothAvecReservoir(cap150);

  /* Supposons que la chaîne du lot (trompée par un mauvais appui) ait proposé une pose à +150 mm sur l'autre voie : */
  const faussePose = {
    left: [vrai.left[0] + 0.150 * ex, vrai.left[1] + 0.150 * ey, vrai.left[2]],
    right: [vrai.right[0] + 0.150 * ex, vrai.right[1] + 0.150 * ey, vrai.right[2]],
  };
  const decisionChaineFausse = { stage: 'window', positions: faussePose, anchorsUsed: [149], anchor: true };
  const runtimeRails = Sh.toRuntimeRails(sci150);
  const camLarge = { projection: [0.01, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 1], sceneRelativeToCamera: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  const cameras = { left: camLarge, right: camLarge };

  /* 1. Avec reprise N+ coupée (`reprise: false`), l'ancre N refuse la fausse pose et laisse le cut différé (`source: 'ancre'`). */
  const E_sansNp = A.etat(E.table, { reprise: false });
  for (const [k, v] of E.parCut) E_sansNp.parCut.set(k, v);
  E_sansNp.grappes = E.grappes.map(g => ({ t: g.t.slice(), n: g.n }));
  const etat1 = { anchors: [], valides: [], validesL1: [], max: 2 };
  const rSans = DLP.deciderCutL1se({
    capture: cap150, nuage: base, science: sci150, runtimeRails, before: cap150.rails,
    decisionLot: decisionChaineFausse, cameras, camerasLarges: cameras,
    anchors: etat1.anchors, voisins: etat1.valides, voisinsTransport: etat1.validesL1,
    zone: 'adv', plagesADV: [[145, 155]], modele: MOD,
    reference: { mm: gVraiMm }, etatAncre: E_sansNp, etatProfil: etat1, identity: cap150.identity,
  });
  assert.equal(rSans.out.etat, 'differe');
  assert.equal(rSans.out.source, 'ancre');

  /* 2. Avec reprise N+ active (par défaut en CH-154), le cut refusé par N est repris sur la vraie voie à ≤ 10 mm, avec `reprise.etat === 'pose'` ! */
  const etat2 = { anchors: [], valides: [], validesL1: [], max: 2 };
  const rAvec = DLP.deciderCutL1se({
    capture: cap150, nuage: base, science: sci150, runtimeRails, before: cap150.rails,
    decisionLot: decisionChaineFausse, cameras, camerasLarges: cameras,
    anchors: etat2.anchors, voisins: etat2.valides, voisinsTransport: etat2.validesL1,
    zone: 'adv', plagesADV: [[145, 155]], modele: MOD,
    reference: { mm: gVraiMm }, etatAncre: E, etatProfil: etat2, identity: cap150.identity,
  });
  assert.equal(rAvec.out.etat, 'pose', `attendu pose grâce à N+, obtenu ${rAvec.out.etat} (${JSON.stringify(rAvec.out.reprise)})`);
  assert.equal(rAvec.out.reprise?.etat, 'pose');
  for (const s of SIDES) {
    const pReprise = L.positionOf(cap150.rails[s], rAvec.out.decal[s].map(v => v / 1000));
    const errMm = 1000 * C.distance(pReprise, vrai[s]);
    assert.ok(errMm <= 10, `erreur reprise rail ${s} = ${errMm.toFixed(2)} mm (attendu ≤ 10 mm)`);
  }
});
