'use strict';
/* 4.9.5.15 (fiches/L1_CAP5.md), 4.9.5.16 (v5 livrée) — LEVIERS DE LA DÉCISION L1-e (cap 5) : valeurs v4 et livrées, réglage du banc, écartement exact, rail ramené à la référence,
 * correction sans capture. Données synthétiques (capture de tests/fixtures.cjs, écartement 1 500 mm). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L1 = require('../src/gcv2-l1.js'), { base } = require('./fixtures.cjs');
const zero = () => ({ left: [0, 0, 0], right: [0, 0, 0] });
const vide = { ...base, pointsSceneRelative: [], visibleByClipBoxes: [] };

test('leviers v4 (test 15) : la base ; test 16 = v4 + v5 ; leviers livrés (test 18) = v4 + v5 + v6 ; le banc les change pour une mesure et revient aux livrés', () => {
  const V = L1.LEVIERS_LIVRES, V4 = L1.LEVIERS_V4, V5 = L1.LEVIERS_V5, V6 = L1.LEVIERS_V6, V16 = { ...V4, ...V5 };
  assert.ok(Object.isFrozen(V) && Object.isFrozen(V4) && Object.isFrozen(V5) && Object.isFrozen(V6));
  /* Test 16 : les leviers v5 livrés sont la chaîne mesurée au banc « a3-bd3 sans deuxième passe » (a3-bd3s, a2486b1), diagnostics coupés. */
  assert.deepEqual({ ...V5 }, { rechercheADV: true, rechZones: ['adv', 'abords'], rechEcartMm: 15, rechVoieParCutMm: 40, rechHauteurMaxMm: 20,
    rechContraMinMm: 22, rechContraMaxMm: 45, rechContraRien: true, rechRemplace: true, rechRemplaceMm: 12, corrigeValideZones: ['adv'], rechEncadre: true,
    anomalieNonCorrigeePMin: 0.8, anomalieNonCorrigeeVoieMm: 35, rechPaireTopMin: 60, rechContraRatioMax: 1.5, rechArret: true, rechSauteProcheMm: 2.5,
    voisinsCoherents: true, branche: true, brancheDernier: true, brancheVertMm: 60, brancheExtrapCuts: 2 });
  assert.deepEqual({ ...V }, { ...V4, ...V5, ...V6 }, 'livrés = v4 + v5 + v6');
  /* Test 18 : les leviers qui changent entre la test 16 et la test 18, ni plus ni moins. */
  assert.deepEqual({ ...V6 }, { rechHauteurMaxMm: 25, vetoVoieAbsMm: 100, voieIncoherenteMm: 40 });
  assert.deepEqual(Object.keys(V).filter(k => JSON.stringify(V[k]) !== JSON.stringify(V16[k])).sort(), ['rechHauteurMaxMm', 'vetoVoieAbsMm', 'voieIncoherenteMm']);
  /* Les 22 leviers qui changent entre la test 15 et la test 16, ni plus ni moins (rechContraMaxMm 45 était déjà la valeur v4). */
  assert.deepEqual(Object.keys(V16).filter(k => JSON.stringify(V16[k]) !== JSON.stringify(V4[k])).sort(), ['anomalieNonCorrigeePMin', 'anomalieNonCorrigeeVoieMm', 'branche',
    'brancheDernier', 'brancheExtrapCuts', 'brancheVertMm', 'corrigeValideZones', 'rechArret', 'rechContraMinMm', 'rechContraRatioMax', 'rechContraRien', 'rechEcartMm',
    'rechEncadre', 'rechHauteurMaxMm', 'rechPaireTopMin', 'rechRemplace', 'rechRemplaceMm', 'rechSauteProcheMm', 'rechVoieParCutMm', 'rechZones', 'rechercheADV', 'voisinsCoherents']);
  assert.deepEqual(Object.keys(V).sort(), Object.keys(V4).sort(), 'aucun levier nouveau');
  /* Rien d'irréversible de plus : pas de deuxième passe (ni en ombre), diagnostics coupés. */
  assert.equal(V.deuxiemePasse, 0); assert.equal(V.passe2Leviers, null); assert.equal(V.diag, false); assert.equal(V.rechercheDiag, false); assert.equal(V.rechDiagLarge, false);
  assert.equal(L1.leviersActifs(), V, 'l\'extension part des livrés');
  assert.deepEqual({ ...V4 }, { exact: true, autreRail: true, anomalieMinMm: 10, anomalieMaxMm: 45, sousTauCoherentMm: 8, sousTauCorrige: false, voisins: true, transport: true,
    voisinsRaffineMm: 8, voisinsEcartMaxMm: 10, vetoVoieMm: 45, raffineObligatoire: true, anomalieNonCorrigeeRien: true,
    consensus: true, consensusEcartMm: 10, consensusVoieMm: 15, consensusVoieProche: true, selectionRefMm: null,
    consensusTous: false, voieProcheMaxCuts: 5, diag: false, validerSansVoieMinP: null, anomalieMinRienMm: null, anomalieMinRienSansVoieMm: null,
    corrigeVoieMaxMm: null, sansVoieRien: false, voieListe: false, voieListeFenetre: 8, deuxiemePasse: 0, passe2Leviers: null, passesAlternees: false,
    branche: false, brancheMm: 8, brancheVertMm: 25, brancheMaxCuts: 6, brancheExtrapCuts: 1, brancheEcartement: [1380, 1520],
    voieProcheSureCuts: null, soutienMinDessus: null, soutienMinFlanc: null,
    /* Test 17 (fiches/PASSATION_T17_FAUTES.md) : garde de voie absolue et contre-expertise de la chaîne, coupées. */
    vetoVoieAbsMm: null, voieIncoherenteMm: null, contreChaineZones: null, contreChaineVoieMm: null, contreChaineMm: null,
    /* Cap 5b : recherche recentrée en ADV, coupée dans la v4 (test 15). */
    rechercheDiag: false, voieAbsFenetre: 6, rechercheADV: false, rechZones: null, rechEcartMm: 10, rechMaxDeplMm: 300, rechVoieMaxMm: 80, rechHauteurMaxMm: null,
    rechProcheMaxCuts: 6, rechUniqueMm: 15, rechRemplace: false, rechRemplaceMm: 5, rechSansPaireRien: false, rechVoieParCutMm: null, rechContraMinMm: null, rechContraMaxMm: 45, rechContraRien: false,
    rechMinTop: 15, rechMinFace: 6, rechRatioMax: 1.5, rechDedupMm: 5, rechArret: false, rechGraineDecalMm: 0, rechDiagLarge: false, rechOrdreGraines: null,
    rechEncadre: false, rechEncadreMaxCuts: 1, rechEncadreSautMm: 15, rechEncadreEcartMm: 15, corrigeValideZones: null, anomalieNonCorrigeePMin: null, anomalieNonCorrigeeVoieMm: null, rechPaireTopMin: null, rechContraRatioMax: null, rechSauteProcheMm: null, rechSauteProcheCuts: 2, rechSauteProcheZones: null,
    /* Cap 6 (A2, A3) : coupés dans la v4. */
    voisinsCoherents: false, voisinsCoherentsParCutMm: 40, voisinsCoherentsBaseMm: 15, rechVoisinsMin: null, brancheDernier: false,
    /* T17B : coupés. */
    rechListeResMm: null, rechListeVoieMm: 20, rechListeZones: null });
  try {
    const l = L1.reglerLeviers({ transport: false, selectionRefMm: 8 });
    assert.equal(l.transport, false); assert.equal(l.selectionRefMm, 8); assert.equal(l.consensus, true, 'les autres leviers restent livrés');
  } finally { assert.equal(L1.reglerLeviers(null), V, 'retour aux livrés'); }
});

test('écartement exact d\'une paire de décalages, et rail ramené en travers jusqu\'à la référence (Newton, vertical gardé)', () => {
  const g0 = L1.ecartementDecal(base, zero());
  assert.ok(Math.abs(g0 - 1500) < 0.01, `écartement de départ ${g0}`);
  for (const [rail, ref] of [['left', 1520], ['right', 1480], ['left', 1475]]) {
    const r = L1.ramenerRail(base, zero(), rail, ref);
    assert.ok(r, `${rail} → ${ref}`);
    assert.ok(Math.abs(L1.ecartementDecal(base, r) - ref) < 0.5, `${rail} → ${ref} : ${L1.ecartementDecal(base, r)}`);
    const autre = rail === 'left' ? 'right' : 'left';
    assert.deepEqual(r[autre], [0, 0, 0], 'l\'autre rail ne bouge pas'); assert.equal(r[rail][2], 0, 'vertical gardé'); assert.equal(r[rail][0], 0);
  }
  assert.equal(L1.ramenerRail(base, zero(), 'left', 1600), null, 'plus de 60 mm : refusé');
});

test('correction d\'une paire : anomalie de 10 à 45 mm seulement ; rail ramené là où le nuage le soutient ; sans capture, rien n\'est corrigé', () => {
  const ordre = ['left', 'right'];
  const c = ref => L1.corrigerDecal({ capture: base, decal: zero(), ref, ordre });
  assert.equal(c(1495).anomalie, false, '5 mm : dispersion naturelle');
  assert.equal(c(1488).anomalie, true, '12 mm'); assert.equal(c(1460).anomalie, true, '40 mm');
  assert.equal(c(1450).anomalie, false, '50 mm : trop pour une erreur de rail');
  assert.equal(c(1470).ecartMm, -30);
  /* Rail gauche (le moins sûr) ramené à la référence, là où le nuage de la capture d'essai le soutient. */
  const o = c(1470); assert.equal(o.rail, 'left'); assert.equal(o.soutenue, true);
  assert.ok(Math.abs(L1.ecartementDecal(base, o.decal) - 1470) < 0.5); assert.deepEqual(o.decal.right, [0, 0, 0]);
  /* Sans points (nuage vide) : aucun rail soutenu, pas de correction. */
  const n = L1.corrigerDecal({ capture: vide, decal: zero(), ref: 1470, ordre }); assert.equal(n.anomalie, true); assert.equal(n.soutenue, false); assert.equal(n.decal, null);
  const s = L1.corrigerDecal({ capture: null, decal: zero(), ref: 1470, gApprox: 1500, ordre });
  assert.equal(s.anomalie, true); assert.equal(s.ecartMm, -30); assert.equal(s.soutenue, false); assert.equal(s.decal, null);
  assert.equal(L1.corrigerDecal({ capture: null, decal: zero(), ref: 1470, ordre }).ecartMm, null, 'sans capture ni écartement des hypothèses : pas de mesure');
});

test('pose de la chaîne refaite par L1-s : sans référence ou non soutenue, rendue telle quelle ; soutenue, corrigée', () => {
  const d = { left: [0, 3, 1], right: [0, -2, 0] };
  assert.deepEqual(L1.corrigerPoseChaine(base, d, null), { decal: d, correction: { ref: null, appliquee: false } });
  const r = L1.corrigerPoseChaine(vide, d, { mm: 1470 });
  assert.equal(r.decal, d); assert.equal(r.correction.anomalie, true); assert.equal(r.correction.appliquee, false);
  const a = L1.corrigerPoseChaine(base, d, { mm: 1470 });
  assert.equal(a.correction.appliquee, true); assert.ok(Math.abs(L1.ecartementDecal(base, a.decal) - 1470) < 0.5, 'soutenue : corrigée à la référence');
});
