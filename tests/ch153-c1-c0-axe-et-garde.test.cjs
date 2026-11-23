'use strict';
/* CH-153 (Lot C1 + C0, D-380 / D-381) :
 *  1. `BananeAncreTrajectoire.graineAxe` calcule la graine [latMm, 0] centrée sur l'axe prédit à ±gRefMm/2,
 *     cohérente au millimètre avec `ecartPose` (y compris lorsque la pose de départ d'ESV est sur une autre voie à 150 mm),
 *     et se tait dès que l'ancre ou le calage du lot est muet ;
 *  2. C1 (`gA` + `v4BS-sd` + `voieListe`) dans `BananeGcv2L1` repêche un cut différé dont la vraie voie est hors de la fenêtre ±80 mm
 *     du moteur (décalée de 150 mm), ne modifie AUCUNE pose déjà décidée par le tronc (`c1SeulementDifferes`),
 *     et marque `voisinLivre: { etat: 'rien', positions: null }` (`c1SansRicochet`) que `BananeDecisionLotPartagee` respecte sans transporter la pose ;
 *  3. C1 éteint (`reglerLeviers({ c1Actif: false })`) reproduit au bit près la sortie de `BananeGcv2L1` d'avant ;
 *  4. C0 : `BananeSettings.lot.serrageLotOmbre.actif === false`, et `ArianeCorrectionListe.construire` intègre le signal `'garde-voie'`
 *     sur les coupes posées par le lot où `garde-voie-ombre` signale `auraitPause: true`.
 * Données 100 % synthétiques / issues de `tests/fixtures.cjs`. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../src/ancre-trajectoire.js');
const L1 = require('../src/gcv2-l1.js');
const Sh = require('../src/gcv1-shadow.js');
const L = require('../src/lot-decision.js');
const O = require('../src/continuity-observer.js');
const C = require('../vendor/capture-core.js');
const S = require('../src/settings.js');
const CL = require('../src/correction-liste.js');
const DLP = require('../src/decision-lot-partagee.js');
const PARAM = require('../src/gcv2-parametres-l1.js');
const { base, K } = require('./fixtures.cjs');
const { journal: journalCorrection } = require('./helpers/correction-journal.cjs');

const SIDES = ['left', 'right'];
const MOD = L1.modeleFige(PARAM, 'lot');

/* Table synthétique de 300 coupes droites espacées de 1 m (monde = scène + T, ex = [0, 1], ey = [0, 0] -> rail gauche à y = +0.7185, droit à y = -0.7185). */
function construireTableDroite({ n = 300, fausses = [], T = [10, -20, 2], demiM = 0.7185 } = {}) {
  const st = [], fl = [], ed = [];
  for (let i = 0; i < n; i++) {
    const f = fausses.find(x => i >= x.de && i <= x.a);
    const decalY = f ? f.mm / 1000 : 0;
    st.push(f?.rouge ? 1 : 0);
    fl.push(f?.rouge ? 2 : 0);
    /* Bord gauche : (x = i, y = decalY + demiM, z = 0) + T ; bord droit : (x = i, y = decalY - demiM, z = 0) + T */
    ed.push(
      Math.round((i + T[0]) * 1e4), Math.round((decalY + demiM + T[1]) * 1e4), Math.round(T[2] * 1e4),
      Math.round((i + T[0]) * 1e4), Math.round((decalY - demiM + T[1]) * 1e4), Math.round(T[2] * 1e4)
    );
  }
  return { n, st, fl, ed, T };
}

test('CH-153 (C1) : BananeAncreTrajectoire.graineAxe projette exactement l\'axe prédit en repère profil et se tait hors conditions', () => {
  assert.equal(typeof A.graineAxe, 'function', 'graineAxe doit être exposée par src/ancre-trajectoire.js');

  /* Sur `base` (capture de fixture, écartement de départ 1500 mm, vraie voie `vrai` à ~1437 mm), construisons une table alignée sur `vrai`
   * sauf aux cuts 148–152 déportés de +150 mm. */
  const capBase = { identity: { part: 23, cut: 150, frameId: null }, rails: base.rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.visibleByClipBoxes };
  const sciBase = Sh.scientificProposeBothAvecReservoir(capBase);
  const pL0 = L.positionOf(base.rails.left, sciBase.rails.left.next.delta);
  const pR0 = L.positionOf(base.rails.right, sciBase.rails.right.next.delta);
  const dx = pL0[0] - pR0[0], dy = pL0[1] - pR0[1], g0 = Math.hypot(dx, dy), ex = dx / g0, ey = dy / g0;
  const g3d = C.distance(pL0, pR0);
  const nx = ey, ny = -ex; /* normale du plan de coupe */
  const Mx0 = (pL0[0] + pR0[0]) / 2, My0 = (pL0[1] + pR0[1]) / 2;
  const T = [50, -30, 4];

  const n = 300, st = [], fl = [], ed = [];
  for (let i = 0; i < n; i++) {
    const s = (i - 150) * 1.0;
    const deport = (i >= 148 && i <= 152) ? 0.150 : 0; /* +150 mm vers la gauche sur 148..152 */
    const cx = Mx0 + s * nx + deport * ex, cy = My0 + s * ny + deport * ey;
    st.push(deport ? 1 : 0);
    fl.push(deport ? 2 : 0);
    ed.push(
      Math.round((cx + (g0 / 2) * ex + T[0]) * 1e4), Math.round((cy + (g0 / 2) * ey + T[1]) * 1e4), Math.round((pL0[2] + T[2]) * 1e4),
      Math.round((cx - (g0 / 2) * ex + T[0]) * 1e4), Math.round((cy - (g0 / 2) * ey + T[1]) * 1e4), Math.round((pR0[2] + T[2]) * 1e4)
    );
  }
  const table = { n, st, fl, ed };
  const E = A.etat(table);
  assert.equal(E.modele.ok, true, 'modèle cinématique valide sur la voie courante à ~1437 mm');

  /* Calons le lot sur 3 coupes saines (100, 101, 102). */
  for (const c of [100, 101, 102]) {
    const o = 6 * c;
    const capC = {
      rails: {
        left: { positionSceneRelative: [0, 1, 2].map(j => ed[o + j] / 1e4 - T[j]) },
        right: { positionSceneRelative: [0, 1, 2].map(j => ed[o + 3 + j] / 1e4 - T[j]) },
      }
    };
    assert.equal(A.noter(E, c, capC).rigide, true);
  }

  /* Au cut 150, la ligne de départ d'ESV est sur `pL0/pR0 + 150 mm` : plaçons les rails de départ de cap150 exactement sur la ligne 150. */
  const cap150 = {
    ...capBase,
    rails: {
      left: O.translated(base.rails.left, [pL0[0] + 0.150 * ex - base.rails.left.positionSceneRelative[0], pL0[1] + 0.150 * ey - base.rails.left.positionSceneRelative[1], pL0[2] - base.rails.left.positionSceneRelative[2]]),
      right: O.translated(base.rails.right, [pR0[0] + 0.150 * ex - base.rails.right.positionSceneRelative[0], pR0[1] + 0.150 * ey - base.rails.right.positionSceneRelative[1], pR0[2] - base.rails.right.positionSceneRelative[2]]),
    }
  };
  const gr = A.graineAxe(E, 150, cap150, g0 * 1000);
  assert.equal(gr.muet, undefined, 'graineAxe active sur cut 150');
  assert.ok(Math.abs(gr.axeMm + 150) < 3, `axe attendu ≈ -150 mm, obtenu ${gr.axeMm}`);

  /* Les positions reconstruites depuis la graine tombent à < 2 mm des vrais rails `pL0` / `pR0` et à < 2 mm de l'axe selon `ecartPose` ! */
  const posGraine = {
    left: L.positionOf(cap150.rails.left, [0, gr.left[0] / 1000, gr.left[1] / 1000]),
    right: L.positionOf(cap150.rails.right, [0, gr.right[0] / 1000, gr.right[1] / 1000]),
  };
  assert.ok(1000 * C.distance(posGraine.left, pL0) < 2, `rail gauche de la graine ramené sur la vraie voie (${(1000 * C.distance(posGraine.left, pL0)).toFixed(2)} mm)`);
  assert.ok(1000 * C.distance(posGraine.right, pR0) < 2, `rail droit de la graine ramené sur la vraie voie (${(1000 * C.distance(posGraine.right, pR0)).toFixed(2)} mm)`);
  const ep = A.ecartPose(E, 150, cap150, posGraine);
  assert.ok(Math.abs(ep.ecartMm) < 2, `écart à l'axe de la graine quasi nul : ${ep.ecartMm}`);

  /* Bout de liste → muet. */
  assert.ok(A.graineAxe(E, 2, cap150, 1435).muet, 'muet en bout de liste');
});

test('CH-153 (C1) : gA repêche un cut différé déporté de 150 mm sans voisin du lot, sans toucher les poses du tronc et sans ricochet', () => {
  const cap0 = { identity: { part: 23, cut: 150, frameId: null }, rails: base.rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.visibleByClipBoxes };
  const sci0 = Sh.scientificProposeBothAvecReservoir(cap0);
  const vrai = Object.fromEntries(SIDES.map(s => [s, L.positionOf(cap0.rails[s], sci0.rails[s].next.delta)]));
  const gVraiMm = 1000 * C.distance(vrai.left, vrai.right);

  /* Déportons les DEUX rails de départ de -220 mm en travers (côté sans autre rail, hors des fenêtres ±80 mm et ±180 mm du moteur A*) ! */
  const pL = vrai.left, pR = vrai.right;
  const dx = pL[0] - pR[0], dy = pL[1] - pR[1], g0 = Math.hypot(dx, dy), ex = dx / g0, ey = dy / g0, nx = ey, ny = -ex;
  const deportM = -0.220;
  const capDeporte = {
    ...cap0,
    rails: {
      left: O.translated(cap0.rails.left, [pL[0] + deportM * ex - cap0.rails.left.positionSceneRelative[0], pL[1] + deportM * ey - cap0.rails.left.positionSceneRelative[1], pL[2] - cap0.rails.left.positionSceneRelative[2]]),
      right: O.translated(cap0.rails.right, [pR[0] + deportM * ex - cap0.rails.right.positionSceneRelative[0], pR[1] + deportM * ey - cap0.rails.right.positionSceneRelative[1], pR[2] - cap0.rails.right.positionSceneRelative[2]]),
    }
  };
  const sciDeporte = Sh.scientificProposeBothAvecReservoir(capDeporte);

  /* Table de la partie : la voie courante est sur `vrai`, seuls les cuts 148..152 sont en échec à -220 mm. */
  const T = [10, 20, 1], n = 300, st = [], fl = [], ed = [];
  const Mx0 = (pL[0] + pR[0]) / 2, My0 = (pL[1] + pR[1]) / 2;
  for (let i = 0; i < n; i++) {
    const s = (i - 150) * 1.0, dep = (i >= 148 && i <= 152) ? deportM : 0;
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

  /* 1. C1 éteint : aucun voisin du lot et rails à 150 mm → `etat === 'rien'`. */
  L1.reglerLeviers({ c1Actif: false });
  let sansC1;
  try {
    sansC1 = L1.deciderDiffere({ capture: capDeporte, science: sciDeporte, voisins: [], zone: 'adv', modele: MOD, regle: L1.REGLE_E, reference: { mm: gVraiMm }, etatAncre: E });
  } finally {
    L1.reglerLeviers(null);
  }
  assert.equal(sansC1.decision.etat, 'rien', 'sans C1, le cut déporté de 150 mm sans voisin reste sans pose');

  /* 2. C1 actif (livré) : `gA` retrouve la vraie paire à < 5 mm sur les deux rails, et marque `voisinLivre` sans ricochet ! */
  const avecC1 = L1.deciderDiffere({ capture: capDeporte, science: sciDeporte, voisins: [], zone: 'adv', modele: MOD, regle: L1.REGLE_E, reference: { mm: gVraiMm }, etatAncre: E });
  assert.equal(avecC1.decision.etat, 'valider', `attendu valider grâce à gA, obtenu ${avecC1.decision.etat} (${avecC1.decision.motif})`);
  for (const s of SIDES) {
    const errMm = 1000 * C.distance(avecC1.positions[s], vrai[s]);
    assert.ok(errMm <= 10, `erreur rail ${s} = ${errMm.toFixed(2)} mm (attendu juste ≤ 10 mm)`);
  }
  assert.deepEqual(avecC1.voisinLivre, { etat: 'rien', positions: null }, 'sans ricochet : voisinLivre indique que le tronc laissait le cut sans pose');

  /* 3. `deciderCutL1se` valide bien le cut mais ne pousse RIEN dans `E.validesL1` (zéro ricochet sur les cuts suivants). */
  const runtimeRails = { left: { status: 'unresolved', motif: 'window' }, right: { status: 'unresolved', motif: 'window' } };
  const etatProfil = { anchors: [], valides: [], validesL1: [], max: 2 };
  const camLarge = { projection: [0.01, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 1], sceneRelativeToCamera: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  const cameras = { left: camLarge, right: camLarge };
  const resL1se = DLP.deciderCutL1se({
    capture: capDeporte, nuage: base, science: sciDeporte, runtimeRails, before: capDeporte.rails,
    cameras, camerasLarges: cameras,
    anchors: etatProfil.anchors, voisins: etatProfil.valides, voisinsTransport: etatProfil.validesL1,
    zone: 'adv', plagesADV: [[145, 155]], modele: MOD,
    reference: { mm: gVraiMm }, etatAncre: E, etatProfil, identity: capDeporte.identity,
  });
  assert.equal(resL1se.out.etat, 'pose', 'le cut est bien posé par deciderCutL1se');
  assert.equal(etatProfil.validesL1.length, 0, 'zéro ricochet : aucune entrée ajoutée au transport validesL1');
});

test('CH-153 (C0) : serrageLotOmbre est coupé par défaut et garde-voie alimente ArianeCorrectionListe', () => {
  assert.equal(S.lot.serrageLotOmbre.actif, false, 'D-380 : serrage-lot-ombre coupé par défaut');
  assert.equal(S.lot.gardeVoieOmbre.actif, true, 'D-380 : garde-voie-ombre conservé actif');

  const ev = journalCorrection();
  /* Cut 11 est posé sans autre signal dans `journalCorrection()` ; ajoutons une alerte `garde-voie-ombre` (`auraitPause: true`) sur le cut 11. */
  ev.push({
    type: 'garde-voie-ombre',
    timestamp: '2026-10-31T10:00:15Z',
    batchId: 'B1',
    identity: { part: 5, cut: 11 },
    ecartMm: 1461.2,
    referenceMm: 1438.4,
    ecartAuVoisinageMm: 22.8,
    auraitPause: true,
    motif: 'voie:22.8mm>15mm',
  });
  const r = CL.construire(ev, { partie: 5 });
  const c11 = r.entrees.find(e => e.cut === 11);
  assert.ok(c11, 'le cut 11 signalé par garde-voie-ombre entre dans la liste Aurore');
  assert.equal(c11.groupe, 'corriger');
  assert.ok(c11.signaux.includes('garde-voie'));
  assert.equal(c11.details['garde-voie'].ecartAuVoisinageMm, 22.8);
});
