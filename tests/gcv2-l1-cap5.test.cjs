'use strict';
/* 4.9.5.15 (fiches/L1_CAP5.md) — LEVIERS DE LA DÉCISION L1-e (cap 5) : valeurs livrées, réglage du banc, écartement exact, rail ramené à la référence,
 * correction sans capture. Données synthétiques (capture de tests/fixtures.cjs, écartement 1 500 mm). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const L1 = require('../src/gcv2-l1.js'), { base } = require('./fixtures.cjs');
const zero = () => ({ left: [0, 0, 0], right: [0, 0, 0] });
const vide = { ...base, pointsSceneRelative: [], visibleByClipBoxes: [] };

test('leviers livrés : ceux de la v4 (lus par l\'extension) ; le banc les change pour une mesure et revient aux livrés', () => {
  const V = L1.LEVIERS_LIVRES;
  assert.ok(Object.isFrozen(V));
  assert.deepEqual({ ...V }, { exact: true, autreRail: true, anomalieMinMm: 10, anomalieMaxMm: 45, sousTauCoherentMm: 8, sousTauCorrige: false, voisins: true, transport: true,
    voisinsRaffineMm: 8, voisinsEcartMaxMm: 10, vetoVoieMm: 45, raffineObligatoire: true, anomalieNonCorrigeeRien: true,
    consensus: true, consensusEcartMm: 10, consensusVoieMm: 15, consensusVoieProche: true, selectionRefMm: null,
    consensusTous: false, voieProcheMaxCuts: 5, diag: false, validerSansVoieMinP: null, anomalieMinRienMm: null, anomalieMinRienSansVoieMm: null,
    corrigeVoieMaxMm: null, sansVoieRien: false, voieListe: false, voieListeFenetre: 8, deuxiemePasse: 0, passe2Leviers: null,
    /* Cap 5b : recherche recentrée en ADV, coupée par défaut (l'extension reste en v4b). */
    rechercheDiag: false, voieAbsFenetre: 6, rechercheADV: false, rechZones: null, rechEcartMm: 10, rechMaxDeplMm: 300, rechVoieMaxMm: 80, rechHauteurMaxMm: null,
    rechProcheMaxCuts: 6, rechUniqueMm: 15, rechRemplace: false, rechRemplaceMm: 5, rechSansPaireRien: false, rechVoieParCutMm: null, rechContraMinMm: null, rechContraMaxMm: 45, rechContraRien: false,
    rechMinTop: 15, rechMinFace: 6, rechRatioMax: 1.5, rechDedupMm: 5, rechArret: false, rechGraineDecalMm: 0, rechDiagLarge: false, rechOrdreGraines: null,
    rechEncadre: false, rechEncadreMaxCuts: 1, rechEncadreSautMm: 15, rechEncadreEcartMm: 15, corrigeValideZones: null, anomalieNonCorrigeePMin: null, anomalieNonCorrigeeVoieMm: null });
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
