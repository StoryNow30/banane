'use strict';
/* Candidate L1 (D-219) : `src/gcv2-l1.js`, module commun au banc et au lot. Captures SYNTHÉTIQUES (tests/helpers/gcv2-jeu-fixture.cjs), aucune
 * donnée de terrain.
 *  - Le moteur rend son réservoir sur demande seulement : sans demande, sa sortie est celle d'avant, octet pour octet ; avec, celle de la copie
 *    en mémoire des outils (tools/gcv2-jeu.cjs).
 *  - Les hypothèses du module sont celles de `hypothesesDuCut` des outils, trait par trait ; les probabilités celles de gcv2-predire-differes.
 *  - La règle L1 : valider au-dessus de τ, poser sans valider sous τ (sauf à plus de 150 mm), rien sous δ ou si la pose de départ est la plus
 *    probable ; L1-v valide sous τ et marque « à contrôler ». */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const L1 = require('../src/gcv2-l1.js'), Sh = require('../src/gcv1-shadow.js'), L = require('../src/lot-decision.js'), K = require('../src/core.js');
const G = require('../tools/gcv2-jeu.cjs'), P = require('../tools/gcv2-predire-differes.cjs'), RA = require('../tools/relecture-autonome.cjs');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const SIDES = ['left', 'right'];
const PARAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json'), 'utf8'));
const strip = x => JSON.stringify(x, (k, v) => v instanceof Float64Array ? Array.from(v) : v);
const capture = (cut, graine, o = 0) => F.capture({ cut, graine, origine: [o + cut, 0, 0] });

test('moteur : le réservoir n\'apparaît que sur demande, la sortie par défaut ne change pas', () => {
  const c = capture(5, 7), a = Sh.scientificProposeBoth(c), b = Sh.scientificProposeBothAvecReservoir(c), m = G.moteurAvecReservoir().scientificProposeBoth(c);
  assert.ok(SIDES.every(s => !('_reservoir' in a.rails[s])), 'pas de réservoir par défaut');
  assert.ok(SIDES.every(s => b.rails[s]._reservoir && Array.isArray(b.rails[s]._reservoir.pool)), 'réservoir sur demande');
  const sans = x => JSON.parse(strip(x), (k, v) => k === '_reservoir' ? undefined : v);
  assert.deepEqual(sans(b), JSON.parse(strip(a)), 'même science, réservoir mis à part');
  assert.equal(strip(b.rails.left._reservoir), strip(m.rails.left._reservoir), 'même réservoir que la copie des outils');
  assert.ok(SIDES.every(s => !('_reservoir' in Sh.scientificProposeBoth(c).rails[s])), 'le drapeau ne survit pas à l\'appel');
  assert.equal(typeof Sh.reservoirOutils.lossRatio, 'function');
});

/* Un petit lot : cuts 1 à 3 validés (pose décalée de 3 mm), cut 4 différé. */
function scene() {
  const caps = new Map([1, 2, 3, 4].map(c => [c, capture(c, 10 + c)]));
  const valides = [1, 2, 3].map(cut => { const c = caps.get(cut); return { identity: { part: 91, cut, frameId: null }, rails: c.rails,
    positions: Object.fromEntries(SIDES.map(s => [s, [c.rails[s].positionSceneRelative[0], c.rails[s].positionSceneRelative[1] + 0.003, c.rails[s].positionSceneRelative[2]]])) }; });
  return { caps, valides };
}

test('hypothèses : identiques à celles des outils, trait par trait (famille lot, voisins du lot)', () => {
  const { caps, valides } = scene(), c4 = caps.get(4);
  const appuis = []; for (const v of valides) L.rememberAnchor(appuis, { identity: v.identity, positions: v.positions, stage: 'first-pass' }, 40);
  const voisinsOutil = valides.map(v => ({ identity: v.identity, positions: v.positions, stage: 'verifie', source: 'lot', decalage: G.decalageDepuisEsv(v.rails, v.positions, 'depart') }));
  let brut = null;
  RA.poseAriane({ identity: c4.identity, rails: c4.rails, points: c4.pointsSceneRelative, visible: c4.visibleByClipBoxes }, { appuis: { liste: appuis.slice() }, rappel: b => { brut = b; } });
  const sciOutil = G.moteurAvecReservoir().scientificProposeBoth(brut.capture);
  const hOutil = G.hypothesesDuCut({ capture: brut.capture, science: sciOutil, seul: brut.seul, chaine: brut.chaine, appuisAvant: brut.appuisAvant, voisins: voisinsOutil, gMed: 1450, voisinsLot: voisinsOutil, departEsv: null });
  const r = L1.deciderDiffere({ capture: brut.capture, science: Sh.scientificProposeBothAvecReservoir(brut.capture), appuis: appuis.slice(), options: {}, voisins: valides, zone: 'abords', modele: L1.modeleFige(PARAMS) });
  const hMod = r.hyp;
  assert.ok(hOutil.rails.left.length > 1);
  assert.equal(strip(hMod.rails), strip(hOutil.rails), 'hypothèses et traits');
  assert.equal(strip(hMod.voieH6), strip(hOutil.voieH6), 'voie de la série');
  /* Probabilités : celles de gcv2-predire-differes sur le même cas. */
  const kOutil = P.casDuDiffere({ designation: '9:91', cut: 4, zone: 'abords', hyp: hOutil, gMed: r.gMed, voieRef: hOutil.voieH6 ? G.avecRupture(hOutil.voieH6.lot, 4, new Map()) : null });
  const modO = P.modeleFige(PARAMS, 'lot');
  for (const s of SIDES) assert.deepEqual(Array.from(r.decision.probas[s]), kOutil.rails[s].hyps.map(h => P.probas(modO, h.x).p10), `probabilités ${s}`);
});

test('paramètres : un fichier altéré est refusé', () => {
  const p = JSON.parse(JSON.stringify(PARAMS)); p.usages.lot.colonnes.pop();
  assert.throws(() => L1.modeleFige(p), /colonnes/);
  assert.throws(() => L1.modeleFige({ ...PARAMS, format: 'autre' }), /format/);
});

/* Un cas fabriqué : rail gauche H0 et deux hypothèses, rail droit H0 et une. */
function cas({ decalG = [0, 20, 0], decalD = [0, 20, 0], zone = 'abords', G0 = 1450 } = {}) {
  const h = (decal, origines, g) => ({ rang: 0, hauteur: false, origines, sousOrigines: [], decal, g, x: null });
  return { cut: 4, zone, gMed: 1450, G0, voieRef: null, i0: { left: 0, right: 0 },
    rails: { left: { hyps: [h([0, 0, 0], ['H0'], 1450), h(decalG, ['H1'], 1450 - decalG[1])] }, right: { hyps: [h([0, 0, 0], ['H0'], 1450), h(decalD, ['H2'], 1450 + decalD[1])] } } };
}
const M = { seuils: { abords: { actif: true, tau: 0.44, delta: 2 }, pn: { actif: true, tau: 0.42, delta: 3 }, hors: { actif: true, tau: 0.45, delta: 3 } } };

test('règle L1 : valider, poser sans valider, rien ; L1-v', () => {
  const p = (a, b) => ({ left: [0.2, a], right: [0.2, b] });
  assert.equal(L1.deciderL1(cas(), M, L1.REGLE, p(0.9, 0.9)).etat, 'valider', 'au-dessus de τ');
  const sous = L1.deciderL1(cas(), M, L1.REGLE, p(0.6, 0.6));
  assert.equal(sous.etat, 'poser-sans-valider'); assert.equal(sous.motif, 'sous-tau');
  assert.equal(L1.deciderL1(cas(), M, L1.REGLE_V, p(0.6, 0.6)).etat, 'valider', 'L1-v valide sous τ');
  assert.equal(L1.deciderL1(cas(), M, L1.REGLE_V, p(0.6, 0.6)).aControler, true);
  const loin = cas({ decalG: [0, 160, 0], decalD: [0, 160, 0] });
  assert.equal(L1.deciderL1(loin, M, L1.REGLE, p(0.6, 0.6)).motif, 'plus-de-150-mm');
  assert.equal(L1.deciderL1(loin, M, L1.REGLE_V, p(0.6, 0.6)).etat, 'rien');
  assert.equal(L1.deciderL1(loin, M, L1.REGLE, p(0.9, 0.9)).etat, 'valider', 'au-dessus de τ, la distance ne compte pas (pas de couloir)');
  assert.equal(L1.deciderL1(cas({ decalG: [0, 1, 0], decalD: [0, 1, 0] }), M, L1.REGLE, p(0.9, 0.9)).motif, 'sous-delta');
  assert.equal(L1.deciderL1(cas(), M, L1.REGLE, p(0.01, 0.01)).motif, 'depart-le-plus-probable');
  /* Écartement : une paire hors de la médiane ± 15 mm et hors contrat n'est jamais retenue. */
  const hors = cas({ decalG: [0, 40, 0], decalD: [0, -40, 0] }); hors.rails.left.hyps[1].g = 1490; hors.rails.right.hyps[1].g = 1490;
  assert.equal(L1.deciderL1(hors, M, L1.REGLE, p(0.9, 0.9)).etat, 'rien');
});

test('commande d\'une pose de la GCV2 : décalages relus, écartement, vue', () => {
  const c = capture(5, 7), sci = Sh.scientificProposeBoth(c), runtime = Sh.toRuntimeRails(sci);
  const positions = Object.fromEntries(SIDES.map(s => [s, L.positionOf(c.rails[s], [0, 0.004, 0])]));
  const r = L1.commander({ positions, runtimeRails: runtime, before: c.rails, expectedPoses: K.expectedPoses, cameras: null, camerasLarges: null });
  assert.equal(r.action, 'refus'); assert.match(r.reason, /vue-inconnue/);
  const centre = F.trans(-5, -0.725, 0), cam = { projection: F.trans(0, 0, 0), sceneRelativeToCamera: centre };
  const ok = L1.commander({ positions, runtimeRails: runtime, before: c.rails, expectedPoses: K.expectedPoses, cameras: { left: cam, right: cam }, camerasLarges: null });
  assert.equal(ok.action, 'lot'); assert.equal(ok.vue, 'dans'); assert.equal(ok.rails.left.source, 'gcv2-l1');
  const exp = K.expectedPoses({ rails: c.rails }, ok.rails);
  for (const s of SIDES) assert.ok(Math.hypot(...exp[s].positionSceneRelative.map((v, i) => v - positions[s][i])) < 1e-9);
  const etroite = { projection: [10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], sceneRelativeToCamera: centre }, large = cam;
  const dep = L1.commander({ positions, runtimeRails: runtime, before: c.rails, expectedPoses: K.expectedPoses, cameras: { left: etroite, right: etroite }, camerasLarges: { left: large, right: large }, valider: false });
  assert.equal(dep.action, 'lot'); assert.equal(dep.vue, 'deplacer'); assert.equal(dep.reason, 'gcv2-l1-sans-valider');
  const ecart = Object.fromEntries(SIDES.map(s => [s, L.positionOf(c.rails[s], [0, s === 'left' ? 0.09 : -0.09, 0])]));
  assert.match(L1.commander({ positions: ecart, runtimeRails: runtime, before: c.rails, expectedPoses: K.expectedPoses, cameras: { left: cam, right: cam } }).reason, /^gauge-/);
});
