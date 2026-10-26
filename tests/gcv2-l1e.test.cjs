'use strict';
/* 4.9.5.14 (test 14, fiches/L1_APPRENTISSAGE.md) — DÉCISION L1-e DES DIFFÉRÉS : référence d'écartement lue dans la liste d'ESV, correction du rail le
 * moins probable, soutien du nuage exigé, plus de pose sans validation. Données synthétiques (aucune coordonnée réelle). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const E = require('../src/gcv2-l1e.js'), L1 = require('../src/gcv2-l1.js'), LM = require('../src/liste-memoire.js');

/* Une liste d'ESV fabriquée : `n` lignes, écartement `g` (mm) par ligne, statut et drapeaux au choix ; bords au dixième de millimètre. */
function table(lignes) {
  const st = [], fl = [], ed = [];
  lignes.forEach(({ g = 1435, s = 0, f = 0 }, i) => { st.push(s); fl.push(f); ed.push(i * 10000, 0, 0, i * 10000, g * 10, 0); });
  return LM.decompacter(LM.compacter({ st, fl, ed }, { partie: 9, at: '2026-10-20T00:00:00Z', cle: 'x' }));
}

test('référence : médiane des lignes valides NON TOUCHÉES les plus proches ; lignes invalides, vues ou traitées ignorées', () => {
  const L = [];
  for (let i = 0; i < 60; i++) L.push({ g: 1434 + (i % 3) });
  for (let i = 25; i < 35; i++) L[i] = { g: 1465, s: 0, f: 3 };      // validées dans la séance (par Ariane ou l'opérateur) : jamais référence
  for (let i = 35; i < 40; i++) L[i] = { g: 1500, s: 1, f: 0 };      // invalides
  const r = E.referenceEcartement(table(L), 30);
  assert.equal(r.n, 20); assert.ok(r.mm >= 1434 && r.mm <= 1436, `référence ${r.mm}`);
  assert.equal(E.referenceEcartement(table(L.slice(0, 8)), 3), null, 'moins de 10 lignes : pas de référence');
  assert.equal(E.referenceEcartement(null, 3), null);
});

const hyps = { left: [{ decal: [0, 0, 0], g: 1500, depart: true }, { decal: [0, -100, 0], g: 1400, depart: false }],
  right: [{ decal: [0, 0, 0], g: 1500, depart: true }, { decal: [0, -100, 0], g: 1600, depart: false }] };
const soutenu = () => ({ dessus: 9, flanc: 6 }), vide = () => ({ dessus: 2, flanc: 0 });

test('correction : le rail le moins probable va en travers jusqu\'à la référence, si l\'anomalie est de 15 à 40 mm et que le nuage le soutient', () => {
  /* Paire trop large de 28 mm (1 463 contre 1 435), rail gauche moins probable : il va de 28 mm vers le droit (signe du rail gauche : +1). */
  const paire = { left: { decal: [0, -175, 10], p: 0.1 }, right: { decal: [0, -128, -12], p: 0.6 } };
  const c = E.corriger({ paire, g: 1463, hyps, ref: 1435, soutien: soutenu });
  assert.equal(c.anomalie, true); assert.equal(c.rail, 'left'); assert.equal(c.soutenue, true); assert.equal(c.ecartMm, -28);
  assert.deepEqual(c.decal.left, [0, -203, 10]); assert.deepEqual(c.decal.right, [0, -128, -12], 'le rail le plus probable ne bouge pas');
  assert.equal(E.corriger({ paire, g: 1463, hyps, ref: 1435, soutien: vide }).soutenue, false, 'sans soutien du nuage : pas de correction');
  assert.equal(E.corriger({ paire, g: 1445, hyps, ref: 1435, soutien: soutenu }).anomalie, false, '10 mm : dans la dispersion naturelle');
  assert.equal(E.corriger({ paire, g: 1480, hyps, ref: 1435, soutien: soutenu }).anomalie, false, '45 mm : trop pour une simple erreur de rail');
  assert.equal(E.corriger({ paire, g: 1463, hyps, ref: null, soutien: soutenu }).anomalie, false, 'sans référence : rien');
});

test('décision : valider garde ou corrige ; « plus de 150 mm » validé seulement corrigé ; plus de pose sans validation', () => {
  const paire = { left: { decal: [0, -175, 10] }, right: { decal: [0, -128, -12] } };
  const c = { anomalie: true, soutenue: true, decal: { left: [0, -203, 10], right: [0, -128, -12] } };
  assert.deepEqual(E.decider({ etat: 'valider', paire }, null), { etat: 'valider', motif: null, decal: { left: [0, -175, 10], right: [0, -128, -12] }, corrigee: false });
  assert.deepEqual(E.decider({ etat: 'valider', paire }, c).decal, c.decal);
  assert.equal(E.decider({ etat: 'rien', motif: 'plus-de-150-mm', paire }, c).etat, 'valider');
  assert.equal(E.decider({ etat: 'rien', motif: 'plus-de-150-mm', paire }, { ...c, soutenue: false }).etat, 'rien');
  assert.equal(E.decider({ etat: 'rien', motif: 'plus-de-150-mm', paire }, null).etat, 'rien');
  assert.deepEqual(E.decider({ etat: 'poser-sans-valider', motif: 'sous-tau', paire }, c), { etat: 'rien', motif: 'sans-approche', decal: null, corrigee: false });
  for (const motif of ['depart-le-plus-probable', 'sous-delta', 'zone-inactive']) assert.equal(E.decider({ etat: 'rien', motif, paire: null }, c).etat, 'rien', motif);
});

/* Un cas fabriqué (comme tests/gcv2-l1.test.cjs) : rail gauche H0 et une hypothèse, rail droit H0 et une. */
function cas({ decalG = [0, 20, 0], decalD = [0, 20, 0], G0 = 1450 } = {}) {
  const h = (decal, origines, g) => ({ rang: 0, hauteur: false, origines, sousOrigines: [], decal, g, x: null });
  return { cut: 4, zone: 'abords', gMed: 1450, G0, voieRef: null, i0: { left: 0, right: 0 },
    rails: { left: { hyps: [h([0, 0, 0], ['H0'], 1450), h(decalG, ['H1'], 1450 - decalG[1])] }, right: { hyps: [h([0, 0, 0], ['H0'], 1450), h(decalD, ['H2'], 1450 + decalD[1])] } } };
}
const M = { seuils: { abords: { actif: true, tau: 0.44, delta: 2 }, hors: { actif: true, tau: 0.45, delta: 3 } } };

test('GCV2 L1-e sans liste d\'ESV : la décision de la test 13 (L1-s), sans pose approchée', () => {
  const p = (a, b) => ({ left: [0.2, a], right: [0.2, b] });
  for (const [k, pr] of [[cas(), p(0.9, 0.9)], [cas(), p(0.6, 0.6)], [cas({ decalG: [0, 160, 0], decalD: [0, 160, 0] }), p(0.6, 0.6)], [cas(), p(0.01, 0.01)]]) {
    const d0 = L1.deciderL1(k, M, L1.REGLE, pr), d = L1.deciderL1e(k, M, null, null, pr);
    assert.equal(d.variante, 'L1-e'); assert.deepEqual(d.test13, { etat: d0.etat, motif: d0.motif ?? null, paire: d0.paire ? { left: d0.paire.left.decal, right: d0.paire.right.decal } : null });
    if (d0.etat === 'valider') { assert.equal(d.etat, 'valider'); assert.deepEqual(d.paire.left.decal, d0.paire.left.decal); assert.deepEqual(d.paire.right.decal, d0.paire.right.decal); }
    else { assert.equal(d.etat, 'rien'); assert.equal(d.paire, null); }
    if (d0.etat === 'poser-sans-valider') assert.equal(d.motif, 'sans-approche');
  }
  /* Écartement de la paire dans la dispersion naturelle de la référence : aucune correction, le soutien du nuage n'est même pas lu. */
  const d = L1.deciderL1e(cas(), M, { mm: 1450 }, null, p(0.9, 0.9));
  assert.equal(d.etat, 'valider'); assert.equal(d.correction.anomalie, false); assert.equal(d.correction.appliquee, false);
});
