'use strict';
/* CH-159 (D-382, opérateur, 23/11/2026) — Cas particuliers de relecture :
 *  1. Saut borné confirmé dans les bornes (M = 2 voisines saines de chaque côté, k <= Kmax : 4/5/4/6) -> décision `skip-borne` ;
 *  2. Au-delà de Kmax sans réapparition d'un rail normal -> `reprendre-coupe-par-coupe`, aucun SKIP ;
 *  3. Moins de 2 voisines saines d'un côté -> aucun SKIP ;
 *  4. Cut déjà `valid` dans ESV -> `peutEnvoyerSkipBorne` faux, `skipAndNext` non appelé (verrou anti-vert-validé) ;
 *  5. Décision autre que `skip-borne` confirmée ou identité divergente -> `skipAndNext` non appelé ;
 *  6. Réglage `actif: false` -> comportement antérieur au bit près (aucun SKIP automatique, pas de pose 2A, pas de bascule 10 %) ;
 *  7. `BananeRelectureCritere.juger` refuse toute correction en présence d'un saut borné ;
 *  8. Cas 5 (2A) : sous-nappe saine retenue par géométrie -> pose de relecture issue de cette nappe ; nappes non départageables -> abstention ;
 *  9. `src/placement-convention.js` strictement inchangé (diff git vide, empreinte intacte) ;
 * 10. Seuil de 10 % par portion d'au plus 10 000 ER (1 ER = 1 coupe) : tranches fixes, taux sur toutes les coupes, définition d'échec D-382,
 *     et passage à la partie suivante sur dépassement (`qualite-portion`) ;
 * 11. Lecteur LiDAR (`vendor/lidar.js`, `vendor/lidar-rust.js`, `tests/lidar.js`) : copie multi-composants `rgba`/`color`/`rgb` (itemSize 3/4)
 *     et scalaires `pointSourceID`/`source`/`chain`/`scannerId`, suppression des attributs vides (y compris tableaux de null), allowlist stricte. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RACINE = path.resolve(__dirname, '..');
const CP = require('../src/relecture-cas-particuliers.js');
const Q = require('../src/relecture-critere.js');
const S = require('../src/settings.js');
const FP = require('../src/file-parties.js');
const C = require('../vendor/capture-core.js');
const LidarVendor = require('../vendor/lidar.js');
const LidarRust = require('../vendor/lidar-rust.js');
const LidarTest = require('./lidar.js');
const F242 = require('./v242/fixtures.cjs');
const { H, PERMISSIF } = require('./helpers/relecture-essais.cjs');

/* Constructeurs de coupes synthétiques pour les essais de fenêtre [c-M .. c+K+M]. */
function coupeSaine(cut, opts = {}) {
  const gRef = opts.ecartementRefMm ?? 1435;
  return {
    cut,
    zone: opts.zone ?? 'adv',
    role: opts.role ?? 'vert',
    statutEsv: opts.statutEsv ?? { statut: 'valid', operateur: false, vu: true },
    ecartementMm: opts.ecartementMm ?? gRef,
    ecartementRefMm: gRef,
    flecheMm: opts.flecheMm ?? 1.2,
    pasMm: opts.pasMm ?? 250,
    science: {
      rails: {
        left: {
          ok: true,
          next: { status: 'candidate', motif: 'nominal', delta: [0, 0, 0], rawDelta: [0, 0, 0], topRows: 22, faceCount: 10, slopeLimited: false, loss: 0.0012 },
          competitive: { nStrongPool: 3, nClusters: 1 },
          conventionCalibration: { applied: true, dzMm: 1.5, duMm: -0.5, topN: 24, faceN: 10 },
          epaisseurDessusMm: 4.0,
          residuMm: 1.8,
        },
        right: {
          ok: true,
          next: { status: 'candidate', motif: 'nominal', delta: [0, 0, 0], rawDelta: [0, 0, 0], topRows: 21, faceCount: 9, slopeLimited: false, loss: 0.0013 },
          competitive: { nStrongPool: 3, nClusters: 1 },
          conventionCalibration: { applied: true, dzMm: 1.4, duMm: -0.4, topN: 23, faceN: 9 },
          epaisseurDessusMm: 4.2,
          residuMm: 1.9,
        },
      },
      summary: { nextCandidates: 2, nextUnresolved: 0, pairGaugeRejected: false, pairGaugeMm: gRef },
    },
  };
}

function coupeAnomalie(cut, cas, opts = {}) {
  const base = coupeSaine(cut, opts);
  if (cas === 'lacune-coeur') {
    base.zone = 'adv';
    base.role = opts.role ?? 'differe';
    base.statutEsv = opts.statutEsv ?? { statut: 'invalid', operateur: false, vu: true };
    base.science.rails.right = {
      ok: true,
      next: { status: 'unresolved', motif: 'ambiguity', delta: null, topRows: 6, faceCount: 2, slopeLimited: false },
      competitive: { nStrongPool: 0, nClusters: 2 },
      publishedWeak: true,
    };
    base.science.summary.nextCandidates = 1;
    base.science.summary.nextUnresolved = 1;
  } else if (cas === 'nappes-separees') {
    base.role = opts.role ?? 'differe';
    base.statutEsv = opts.statutEsv ?? { statut: 'invalid', operateur: false, vu: true };
    base.science.rails.left.epaisseurDessusMm = 17.5;
    base.science.rails.left.residuMm = 5.4;
    base.science.rails.left.modesTop = [
      { centreMm: -1.0, count: 14, part: 0.5 },
      { centreMm: 11.5, count: 14, part: 0.5 },
    ];
    base.science.rails.left.conventionCalibration = { applied: false, reason: 'shift-out-of-domain', dzMm: 12.2, duMm: 0.5, topN: 28, faceN: 9 };
  } else if (cas === 'rail-invisible') {
    base.role = opts.role ?? 'differe';
    base.statutEsv = opts.statutEsv ?? { statut: 'invalid', operateur: false, vu: true };
    base.science.rails.left = {
      ok: false,
      reason: 'Trop peu de points autour du champignon.',
      next: { status: 'unresolved', motif: 'minTop', delta: null, topRows: 2, faceCount: 0, slopeLimited: false },
      competitive: { nStrongPool: 0, nClusters: 0 },
      pointsDessus: 3,
      pointsFlanc: 0,
      pointsPreditsVoisines: { pointsDessus: 2, pointsFlanc: 0 },
    };
  } else if (cas === 'decalibration') {
    base.role = opts.role ?? 'differe';
    base.statutEsv = opts.statutEsv ?? { statut: 'invalid', operateur: false, vu: true };
    base.pasMm = 60; // pas longitudinal très comprimé (faible vitesse / arrêt)
    base.pasMedianMm = 250;
    base.flecheMm = 16.5;
    base.rigideMm = 4.2;
    base.science.rails.left.next.slopeLimited = true;
    base.science.rails.left.residuMm = 5.8;
    base.torsionPaireMm = { dl: 9.5, dv: 7.2 };
  }
  return base;
}

test('1. Saut confirmé dans les bornes (M = 2 voisines saines de chaque côté, k <= Kmax) -> décision skip-borne pour les cas 1 à 4', () => {
  const casBornes = [
    ['lacune-coeur', 4, 2],
    ['nappes-separees', 5, 3],
    ['rail-invisible', 4, 4],
    ['decalibration', 6, 6],
  ];
  for (const [motif, kMaxAttendu, k] of casBornes) {
    const amont = [coupeSaine(98), coupeSaine(99)];
    const anomalies = Array.from({ length: k }, (_, i) => coupeAnomalie(100 + i, motif));
    const aval = [coupeSaine(100 + k), coupeSaine(100 + k + 1)];
    const dec = CP.evaluerSautBorne({ amont, suite: [...anomalies, ...aval], cutDepart: 100 });
    assert.equal(dec.action, 'skip-borne', `${motif} avec k=${k} <= Kmax=${kMaxAttendu}`);
    assert.equal(dec.confirme, true, motif);
    assert.equal(dec.motif, motif);
    assert.equal(dec.k, k);
    assert.equal(dec.kMax, kMaxAttendu);
    assert.deepEqual(dec.cuts, anomalies.map(x => x.cut));
    assert.equal(dec.repriseCut, 100 + k);
    assert.equal(dec.bornes.mAmont, 2);
    assert.equal(dec.bornes.mAval, 2);
  }
});

test('1b. Anti-faux-positif Cas 1 : rail continu fort en ADV décalé par rapport à ESV n’est pas une lacune de cœur', () => {
  const amont = [coupeSaine(98), coupeSaine(99)];
  const normaleDecalee = coupeSaine(100, { zone: 'adv', ecartementMm: 1436, ecartementRefMm: 1435 });
  const aval = [coupeSaine(101), coupeSaine(102)];
  const dec = CP.evaluerSautBorne({ amont, suite: [normaleDecalee, ...aval], cutDepart: 100 });
  assert.notEqual(dec.action, 'skip-borne');
  assert.equal(dec.confirme, false);
});

test('2. Au-delà de Kmax sans réapparition d’un rail normal -> reprendre-coupe-par-coupe, aucun SKIP', () => {
  const casDepassement = [
    ['lacune-coeur', 5],     // Kmax = 4
    ['nappes-separees', 6],  // Kmax = 5
    ['rail-invisible', 5],   // Kmax = 4
    ['decalibration', 7],    // Kmax = 6
  ];
  for (const [motif, k] of casDepassement) {
    const amont = [coupeSaine(98), coupeSaine(99)];
    const anomalies = Array.from({ length: k }, (_, i) => coupeAnomalie(100 + i, motif));
    const aval = [coupeSaine(100 + k), coupeSaine(100 + k + 1)];
    const dec = CP.evaluerSautBorne({ amont, suite: [...anomalies, ...aval], cutDepart: 100 });
    assert.equal(dec.action, 'reprendre-coupe-par-coupe', `${motif} avec k=${k} > Kmax`);
    assert.equal(dec.confirme, false);
    assert.equal(dec.motif, motif);
    assert.equal(
      CP.peutEnvoyerSkipBorne(dec, { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' }),
      false,
      `aucun SKIP au-delà de Kmax pour ${motif}`
    );
  }
});

test('3. Moins de 2 voisines saines d’un côté (amont < 2 ou aval < 2) -> aucun SKIP', () => {
  // Seulement 1 voisine saine en amont
  const decAmont1 = CP.evaluerSautBorne({
    amont: [coupeSaine(99)],
    suite: [coupeAnomalie(100, 'lacune-coeur'), coupeSaine(101), coupeSaine(102)],
    cutDepart: 100,
  });
  assert.notEqual(decAmont1.action, 'skip-borne');
  assert.equal(decAmont1.confirme, false);
  assert.equal(
    CP.peutEnvoyerSkipBorne(decAmont1, { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' }),
    false
  );

  // Seulement 1 voisine saine en aval avant une autre anomalie ou la fin
  const decAval1 = CP.evaluerSautBorne({
    amont: [coupeSaine(98), coupeSaine(99)],
    suite: [coupeAnomalie(100, 'rail-invisible'), coupeSaine(101)],
    cutDepart: 100,
  });
  assert.notEqual(decAval1.action, 'skip-borne');
  assert.equal(decAval1.confirme, false);
  assert.equal(
    CP.peutEnvoyerSkipBorne(decAval1, { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' }),
    false
  );
});

test('4 & 5. Gardes d’envoi peutEnvoyerSkipBorne : refus strict sur vert déjà validé (valid), identité divergente, bornes falsifiées ou décision non skip-borne', async () => {
  const amont = [coupeSaine(98), coupeSaine(99)];
  const aval = [coupeSaine(101), coupeSaine(102)];
  const decValide = CP.evaluerSautBorne({
    amont,
    suite: [coupeAnomalie(100, 'lacune-coeur'), ...aval],
    cutDepart: 100,
  });
  assert.equal(decValide.action, 'skip-borne');

  // Cas nominal autorisé : cut `invalid` dans ESV, identité conforme, bornes M=2, k=1 <= 4
  assert.equal(
    CP.peutEnvoyerSkipBorne(decValide, {
      identity: { part: 20, cut: 100 },
      attendu: { part: 20, cut: 100 },
      statut: 'invalid',
    }),
    true
  );

  // Garde 2 : cut déjà `valid` dans ESV -> JAMAIS de SKIP (verrou anti-vert-validé)
  assert.equal(
    CP.peutEnvoyerSkipBorne(decValide, {
      identity: { part: 20, cut: 100 },
      attendu: { part: 20, cut: 100 },
      statut: 'valid',
    }),
    false,
    'verrou anti-vert-validé : jamais de SKIP sur un cut déjà valid'
  );
  assert.equal(
    CP.peutEnvoyerSkipBorne(decValide, {
      identity: { part: 20, cut: 100 },
      attendu: { part: 20, cut: 100 },
      ligne: { statut: 'valid', operateur: false },
    }),
    false
  );

  // Garde 3 : identité du cut différente de celle attendue
  assert.equal(
    CP.peutEnvoyerSkipBorne(decValide, {
      identity: { part: 20, cut: 101 },
      attendu: { part: 20, cut: 100 },
      statut: 'invalid',
    }),
    false,
    'identité de coupe divergente'
  );
  assert.equal(
    CP.peutEnvoyerSkipBorne(decValide, {
      identity: { part: 21, cut: 100 },
      attendu: { part: 20, cut: 100 },
      statut: 'invalid',
    }),
    false,
    'identité de partie divergente'
  );

  // Garde 1 : décision autre que `skip-borne` confirmée
  for (const action of ['reprendre-coupe-par-coupe', 'abstenir', 'aucune']) {
    assert.equal(
      CP.peutEnvoyerSkipBorne(
        { ...decValide, action },
        { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' }
      ),
      false,
      `action=${action} ne doit jamais autoriser skipAndNext`
    );
  }

  // Garde 4 : K > Kmax ou M < 2
  assert.equal(
    CP.peutEnvoyerSkipBorne(
      { ...decValide, k: 5 },
      { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' }
    ),
    false,
    'k=5 > Kmax=4 refusé par la garde'
  );
  assert.equal(
    CP.peutEnvoyerSkipBorne(
      { ...decValide, bornes: { mAmont: 1, mAval: 2 } },
      { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' }
    ),
    false,
    'mAmont=1 < 2 refusé par la garde'
  );

  // Garde 5 : réglage inactif (`actif: false`)
  assert.equal(
    CP.peutEnvoyerSkipBorne(
      decValide,
      { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' },
      { actif: false }
    ),
    false,
    'actif: false coupe tout envoi de SKIP'
  );

  // Exécution avec mock de l'adaptateur : `skipAndNext` n'est appelé QUE si toutes les gardes passent
  const appelsSkip = [];
  const adapterMock = {
    skipAndNext: async (id, sc) => {
      appelsSkip.push({ id, sc });
      return { commandSent: true, command: 'SKIP' };
    },
  };
  const rRefusValid = await CP.executerSkipBorneSiPermis({
    adapter: adapterMock,
    decision: decValide,
    etatEsv: { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'valid' },
    scope: { part: 20, pageId: 'p1' },
  });
  assert.equal(rRefusValid.envoye, false);
  assert.equal(appelsSkip.length, 0, 'skipAndNext non appelé sur un cut valid');

  const rRefusDecision = await CP.executerSkipBorneSiPermis({
    adapter: adapterMock,
    decision: { ...decValide, action: 'reprendre-coupe-par-coupe' },
    etatEsv: { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' },
    scope: { part: 20, pageId: 'p1' },
  });
  assert.equal(rRefusDecision.envoye, false);
  assert.equal(appelsSkip.length, 0, 'skipAndNext non appelé hors skip-borne');

  const rOk = await CP.executerSkipBorneSiPermis({
    adapter: adapterMock,
    decision: decValide,
    etatEsv: { identity: { part: 20, cut: 100 }, attendu: { part: 20, cut: 100 }, statut: 'invalid' },
    scope: { part: 20, pageId: 'p1' },
  });
  assert.equal(rOk.envoye, true);
  assert.equal(appelsSkip.length, 1, 'skipAndNext appelé exactement une fois sur saut borné confirmé invalid');
});

test('4b. Service worker (relecturePasse) : saut borné confirmé avec lookahead 3D -> skipAndNext envoyé sur cut invalid, bloqué sur cut valid, jamais dans ctx.chaine', async () => {
  // Plage 105..109 tous dans sel.cuts : 105, 106 sains en amont (M=2), 107 sans point (k=1 <= 4), 108, 109 sains en aval (M=2).
  // Cas 1 : cut 107 est `invalid` dans ESV -> skipAndNext est envoyé !
  const { b: bInvalid, adapter: aInvalid } = await H.lotRelecture({
    mode: 'corriger',
    loin: [107, 113],
    reglagesProposes: PERMISSIF,
    esv: (a, sw) => {
      a.sansPoints.add(107);
      const vOrig = sw.ctx.vertsAControler;
      sw.ctx.vertsAControler = async arg => {
        const res = await vOrig(arg);
        return { ...res, actif: true, verts: [105, 106, 107, 108, 109].map(i => ({ i })) };
      };
    },
  });
  await H.finPasse(bInvalid);
  const ev107Inv = H.evenements(bInvalid, 'relecture-ombre').find(e => e.identity.cut === 107);
  assert.ok(ev107Inv, 'cut 107 évalué en relecture');
  assert.equal(ev107Inv.skipBorne?.action, 'skip-borne');
  assert.equal(ev107Inv.skipBorne?.confirme, true);
  assert.equal(ev107Inv.action, 'skip-borne');
  assert.equal(ev107Inv.enChaine, false, 'un cut en saut borné n’entre jamais dans ctx.chaine');
  assert.equal(aInvalid.calls.includes('skip'), true, 'skipAndNext appelé sur cut 107 invalid en saut borné confirmé');

  // Cas 2 : relance de la relecture sur le même lot mais cut 107 est maintenant `valid` dans ESV -> verrou anti-vert-validé : skipAndNext NON appelé !
  const nbSkipsAvant = aInvalid.calls.filter(c => c === 'skip').length;
  aInvalid.rouges.delete(107);
  await bInvalid.api('relecture-lancer');
  await H.finPasse(bInvalid);
  const ev107Val = H.evenements(bInvalid, 'relecture-ombre').filter(e => e.identity.cut === 107).at(-1);
  assert.ok(ev107Val);
  assert.equal(ev107Val.skipBorne?.action, 'skip-borne');
  assert.equal(ev107Val.enChaine, false);
  assert.equal(aInvalid.calls.filter(c => c === 'skip').length, nbSkipsAvant, 'verrou anti-vert-validé : skipAndNext jamais appelé sur un cut déjà valid');
});

test('6. Réglage actif: false -> comportement actuel au bit près (aucun SKIP automatique, pas de pose deux-scanners, pas de bascule 10 %)', () => {
  assert.equal(S.relectureCasParticuliers.actif, true);
  assert.equal(Object.isFrozen(S.relectureCasParticuliers), true);
  assert.equal(Object.isFrozen(S.relectureCasParticuliers.kMax), true);
  assert.equal(Object.isFrozen(S.relectureCasParticuliers.seuils), true);
  assert.equal(Object.isFrozen(S.relectureCasParticuliers.portions), true);

  const amont = [coupeSaine(98), coupeSaine(99)];
  const aval = [coupeSaine(101), coupeSaine(102)];
  const decInactif = CP.evaluerSautBorne(
    { amont, suite: [coupeAnomalie(100, 'lacune-coeur'), ...aval], cutDepart: 100 },
    { actif: false }
  );
  assert.equal(decInactif.action, 'inactif');
  assert.equal(decInactif.confirme, false);

  const poseInactif = CP.poserSousNappeSaine(
    {
      rail: 'left',
      ecartementRefMm: 1435,
      sousNappes: [
        { id: 'saine', delta: [0, 0.002, 0.001], residuMm: 1.5, topRows: 20, faceCount: 8, ecartementMm: 1435.5, ecartVoisinesMm: 1.8 },
        { id: 'deformee', delta: [0, 0.002, 0.014], residuMm: 5.8, topRows: 12, faceCount: 4, ecartementMm: 1447.0, ecartVoisinesMm: 14.2 },
      ],
    },
    { actif: false }
  );
  assert.equal(poseInactif.action, 'inactif');

  const bilanInactif = CP.bilanPortions(
    { total: 100, differes: Array.from({ length: 20 }, (_, i) => i), resultats: [] },
    { actif: false }
  );
  assert.equal(bilanInactif.seuilDepasse, true);
  assert.equal(bilanInactif.action, 'continuer', 'actif: false coupe la bascule de partie sur 10 %');
});

test('7. BananeRelectureCritere.juger refuse toute correction en présence d’un saut borné (ou skipOmbre)', () => {
  const jugementValide = {
    etage: 'first-pass',
    appuis: [98, 99],
    confiance: { left: 96, right: 96 },
    confianceAstar: { left: 96, right: 96 },
    poseActuelle: { left: [0, 0, 0], right: [0, 1.435, 0] },
    poseCalculee: { left: [0, 0.012, 0], right: [0, 1.447, 0] },
    ecartMm: { left: { long: 0, lat: 12, vert: 0 }, right: { long: 0, lat: 12, vert: 0 } },
    ecartBrutMm: { left: { long: 0, lat: 12, vert: 0 }, right: { long: 0, lat: 12, vert: 0 } },
    pireMm: 12,
    verdict: 'je corrigerais',
  };
  const baseCritere = {
    jugement: jugementValide,
    zone: 'adv',
    role: 'vert',
    skipOmbre: { raison: null },
    ecartementMm: 1435,
    ecartementRefMm: 1435,
  };
  assert.equal(Q.juger(baseCritere).corriger, true, 'sans saut borné, la coupe est corrigeable');

  for (const motif of ['lacune-coeur', 'nappes-separees', 'rail-invisible', 'decalibration']) {
    const viaSkipBorne = Q.juger({
      ...baseCritere,
      skipBorne: { action: 'skip-borne', confirme: true, motif, k: 2 },
    });
    assert.equal(viaSkipBorne.corriger, false, `skipBorne ${motif} doit bloquer la correction`);
    assert.equal(viaSkipBorne.regle, 'skip');

    const viaSkipOmbre = Q.juger({
      ...baseCritere,
      skipOmbre: { raison: motif },
    });
    assert.equal(viaSkipOmbre.corriger, false, `skipOmbre ${motif} doit bloquer la correction`);
    assert.equal(viaSkipOmbre.regle, 'skip');
  }
});

test('8. Cas 5 (2A) : sous-nappe saine retenue par géométrie pour la pose de relecture ; nappes non départageables -> abstention', () => {
  // Cas A : deux sous-nappes dont une seule satisfait forme U50, écartement de référence et continuité voisines
  const resSaine = CP.poserSousNappeSaine({
    rail: 'left',
    ecartementRefMm: 1435,
    sousNappes: [
      {
        id: 'nappe-1-saine',
        delta: [0, -0.001, 0.0005],
        positions: { left: [0, -0.001, 0.0005], right: [0, 1.434, 0.0004] },
        residuMm: 1.8,
        topRows: 22,
        faceCount: 9,
        slopeLimited: false,
        ecartementMm: 1435.0,
        ecartVoisinesMm: 2.1,
      },
      {
        id: 'nappe-2-rail-poli',
        delta: [0, -0.001, 0.0135],
        positions: { left: [0, -0.001, 0.0135], right: [0, 1.434, 0.0004] },
        residuMm: 6.2,
        topRows: 11,
        faceCount: 4,
        slopeLimited: true,
        ecartementMm: 1445.8,
        ecartVoisinesMm: 13.4,
      },
    ],
    attributes: { pointSourceID: [1, 1, 2, 2], rgba: [[120, 120, 120, 255], [250, 250, 250, 255]] },
  });
  assert.equal(resSaine.action, 'poser-sous-nappe');
  assert.equal(resSaine.retenue.id, 'nappe-1-saine');
  assert.deepEqual(resSaine.delta, [0, -0.001, 0.0005]);
  assert.equal(resSaine.criterePrincipal, 'geometrie');
  assert.equal(resSaine.appointAttributs.present, true);

  // Cas B : extraction automatique depuis rawDelta vs calage q90 tiré par une bavure haute de rail poli sur une capture
  const resRaw = CP.poserSousNappeSaine({
    rail: 'left',
    ecartementRefMm: 1435,
    science: {
      rails: {
        left: {
          ok: true,
          next: {
            status: 'candidate',
            delta: [0, 0.001, 0.014],     // tiré par q90 de la bavure haute (+13 mm)
            rawDelta: [0, 0.001, 0.001],  // cœur dense de la sous-nappe non déformée
            topRows: 24,
            faceCount: 9,
            slopeLimited: false,
          },
          conventionCalibration: {
            applied: true,
            rawDelta: [0, 0.001, 0.001],
            delta: [0, 0.001, 0.014],
            dzMm: 13.0,
            duMm: 0.0,
            topN: 28,
            faceN: 9,
          },
          epaisseurDessusMm: 16.5,
          residuMm: 2.1,
        },
        right: coupeSaine(100).science.rails.right,
      },
    },
    ecartementBrutMm: 1435.2,
    ecartementCaleMm: 1446.5,
    ecartVoisinesBrutMm: 2.0,
    ecartVoisinesCaleMm: 13.0,
  });
  assert.equal(resRaw.action, 'poser-sous-nappe');
  assert.deepEqual(resRaw.delta, [0, 0.001, 0.001]);

  // Cas C : deux sous-nappes non départageables (toutes deux dégradées ou trop proches) -> abstention
  const resAmbigu = CP.poserSousNappeSaine({
    rail: 'left',
    ecartementRefMm: 1435,
    sousNappes: [
      { id: 'nappe-a', delta: [0, -0.005, 0.006], residuMm: 5.1, topRows: 16, faceCount: 6, ecartementMm: 1443.0, ecartVoisinesMm: 9.5 },
      { id: 'nappe-b', delta: [0, 0.006, -0.005], residuMm: 4.9, topRows: 16, faceCount: 6, ecartementMm: 1427.0, ecartVoisinesMm: 9.2 },
    ],
  });
  assert.equal(resAmbigu.action, 'abstenir');
  assert.equal(resAmbigu.retenue, null);
  assert.equal(resAmbigu.delta, null);
});

test('9. src/placement-convention.js est strictement inchangé (diff git vide)', () => {
  const diff = spawnSync('git', ['diff', 'HEAD', '--', 'src/placement-convention.js'], { cwd: RACINE, encoding: 'utf8' });
  assert.equal(diff.status, 0);
  assert.equal(diff.stdout.trim(), '', 'aucune ligne ni commentaire de src/placement-convention.js ne doit changer');
});

test('10. Portions de 10 000 ER : tranches fixes, taux sur toutes les coupes, définition d’échec D-382 et passage à la partie suivante sur > 10 %', () => {
  // Partie de 14 000 ER -> 2 tranches fixes : [0..9999] (10 000 ER) et [10000..13999] (4 000 ER)
  // Dans la portion 0 (10 000 ER) :
  // - 150 différés initiaux, dont 10 résolus par un SKIP borné confirmé -> 140 différés encore ouverts (échecs)
  // - 5 corrections de relecture refusées / en erreur -> 5 échecs
  // - 30 abstentions de critère -> 0 échec
  // - 25 corrections acceptées -> 0 échec
  // Total échecs portion 0 = 145 / 10 000 = 1,45 % (<= 10 %, qualité 98,55 % >= 95 %)
  // Dans la portion 1 (4 000 ER) :
  // - 420 différés encore ouverts + 10 corrections refusées = 430 / 4 000 = 10,75 % (> 10 % -> dépassement !)
  const differesP0 = Array.from({ length: 150 }, (_, i) => 100 + i);
  const skipsBornesP0 = Array.from({ length: 10 }, (_, i) => ({
    cut: 100 + i,
    role: 'differe',
    action: 'skip-borne',
    skipBorne: { action: 'skip-borne', confirme: true, motif: 'lacune-coeur', k: 2 },
  }));
  const refusP0 = Array.from({ length: 5 }, (_, i) => ({
    cut: 500 + i,
    role: 'vert',
    action: 'correction-refusee',
  }));
  const abstentionsP0 = Array.from({ length: 30 }, (_, i) => ({
    cut: 600 + i,
    role: 'vert',
    action: 'visite',
    critere: { corriger: false, regle: 'confiance' },
  }));
  const corrigesP0 = Array.from({ length: 25 }, (_, i) => ({
    cut: 700 + i,
    role: 'vert',
    action: 'corrige',
  }));

  const differesP1 = Array.from({ length: 420 }, (_, i) => 10100 + i);
  const refusP1 = Array.from({ length: 10 }, (_, i) => ({
    cut: 11000 + i,
    role: 'vert',
    action: 'correction-refusee',
  }));

  const bilan = CP.bilanPortions({
    total: 14000,
    differes: [...differesP0, ...differesP1],
    resultats: [...skipsBornesP0, ...refusP0, ...abstentionsP0, ...corrigesP0, ...refusP1],
  });

  assert.equal(bilan.portions.length, 2);
  const [p0, p1] = bilan.portions;
  assert.deepEqual({ debut: p0.debut, fin: p0.fin, totalEr: p0.totalEr }, { debut: 0, fin: 9999, totalEr: 10000 });
  assert.equal(p0.echecs, 145, '140 différés ouverts + 5 corrections refusées ; les 10 SKIP bornés et 30 abstentions ne comptent pas comme échecs');
  assert.equal(p0.detailEchecs.differesOuverts.length, 140);
  assert.equal(p0.detailEchecs.correctionsRefuseesOuErreur.length, 5);
  assert.equal(p0.nonEchecs.skipsBornes.length, 10);
  assert.equal(p0.nonEchecs.abstentionsCritere.length, 30);
  assert.equal(p0.nonEchecs.correctionsAcceptees.length, 25);
  assert.equal(p0.tauxEchecPct, 1.45);
  assert.equal(p0.qualitePct, 98.55);
  assert.equal(p0.seuilDepasse, false);
  assert.equal(p0.cibleAtteinte, true);

  assert.deepEqual({ debut: p1.debut, fin: p1.fin, totalEr: p1.totalEr }, { debut: 10000, fin: 13999, totalEr: 4000 });
  assert.equal(p1.echecs, 430);
  assert.equal(p1.tauxEchecPct, 10.75);
  assert.equal(p1.qualitePct, 89.25);
  assert.equal(p1.seuilDepasse, true);
  assert.equal(p1.cibleAtteinte, false);

  assert.equal(bilan.seuilDepasse, true);
  assert.equal(bilan.premierePortionEnDepassement.index, 1);
  assert.equal(bilan.action, 'partie-suivante');
  assert.equal(bilan.motif, 'qualite-portion');

  // File de parties : le motif `qualite-portion` fait passer la machine à `changement` (`changer-partie` vers la partie suivante), sans jamais envoyer de SKIP
  const sel = { status: 'ok', current: 20, parts: [{ part: 20 }, { part: 21 }] };
  let r = FP.transition(null, { type: 'demarrer', id: 'F-159', n: 2, selecteur: sel, courante: 20, at: '2026-11-23T10:00:00.000Z' });
  r = FP.transition(r.etat, { type: 'lot-demarre', lotId: 'L-20', part: 20, at: '2026-11-23T10:00:01.000Z' });
  r = FP.transition(r.etat, { type: 'lot-fin', lotId: 'L-20', motif: 'fin-normale', issue: 'COMPLETED', resume: { traites: 100, differes: 15 }, at: '2026-11-23T10:01:00.000Z' });
  r = FP.transition(r.etat, { type: 'passe-fin', lotId: 'L-20', issue: 'finie', ecrits: 0, at: '2026-11-23T10:01:10.000Z' });
  r = FP.transition(r.etat, {
    type: 'relecture-fin',
    lotId: 'L-20',
    issue: 'qualite-portion',
    corriges: 1,
    faits: 20,
    mode: 'corriger',
    detail: 'portion 0–99 : 15 % d’échecs (> 10 %)',
    at: '2026-11-23T10:02:00.000Z',
  });
  assert.equal(r.etat.etat, 'changement');
  assert.deepEqual(r.actions, [{ type: 'registre', rang: 0 }, { type: 'changer-partie', vers: 21 }]);
  assert.ok(r.etat.bilan[0].motifs.some(m => m.code === 'qualite-portion'));
});

