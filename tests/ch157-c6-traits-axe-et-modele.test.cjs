'use strict';
/* CH-157 (Lot C6, D-379 / D-380 / D-381) :
 *  1. Les trois traits d'accord à l'axe de trajectoire (`ecartAxeMm`, `paireMilieuAxeMm`, `ancrePresente`)
 *     figurent dans `BananeGcv2L1.NUM` et dans la liste blanche de `tools/gcv2-apprendre.cjs` (`node tools/gcv2-apprendre.cjs essai`) ;
 *  2. Rétrocompatibilité stricte : l'ancien modèle figé (`src/gcv2-parametres-l1.js`) qui ne nomme pas ces 3 colonnes
 *     se charge sans erreur et produit des probabilités `p10`/`p5` identiques au bit près qu'une ancre soit présente ou non ;
 *  3. Activation sur un modèle v2 : lorsqu'un fichier de paramètres déclare `ecartAxeMm`, `paireMilieuAxeMm` et `ancrePresente`,
 *     `hypothesesDuCut` + `casDuDiffere` peuplent ces traits depuis la graine d'axe (`axeGraine`), et `probas` les pondère
 *     (pénalisant une hypothèse éloignée de l'axe par rapport à une hypothèse sur l'axe).
 * Données 100 % synthétiques / issues de `tests/fixtures.cjs`. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const L1 = require('../src/gcv2-l1.js');
const Jeu = require('../tools/gcv2-jeu.cjs');
const Sh = require('../src/gcv1-shadow.js');
const PARAM = require('../src/gcv2-parametres-l1.js');
const { base } = require('./fixtures.cjs');

test('CH-157 (C6a) : NUM contient ecartAxeMm, paireMilieuAxeMm et ancrePresente, et gcv2-apprendre.cjs essai passe', () => {
  const noms = L1.NUM.map(t => t.nom);
  for (const nom of ['ecartAxeMm', 'paireMilieuAxeMm', 'ancrePresente']) {
    assert.ok(noms.includes(nom), `le trait ${nom} doit figurer dans BananeGcv2L1.NUM`);
  }
  const App = require('../tools/gcv2-apprendre.cjs');
  assert.equal(App.verifierListeBlanche(), true);
  for (const nom of ['ecartAxeMm', 'paireMilieuAxeMm', 'ancrePresente']) {
    assert.ok(App.NUM.some(t => t.nom === nom), `le trait ${nom} figure aussi dans tools/gcv2-apprendre.cjs`);
  }
});

test('CH-157 (C6b) : rétrocompatibilité au bit près avec l\'ancien modèle figé et pondération effective par un modèle v2', () => {
  const cap = { identity: { part: 23, cut: 2855, frameId: null }, rails: base.rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.visibleByClipBoxes };
  const sci = Sh.scientificProposeBothAvecReservoir(cap);
  const seul = L1.variante(cap, sci, [], L1.REGLE.lotOptions);

  const hypSansAxe = L1.hypothesesDuCut({ capture: cap, science: sci, seul, voisins: [], gMed: 1437 });
  const hypAvecAxe = L1.hypothesesDuCut({ capture: cap, science: sci, seul, voisins: [], gMed: 1437, axeGraine: { left: [2, 0], right: [-3, 0], axeMm: -0.5 } });

  assert.equal(hypSansAxe.cut.ancrePresente, false);
  assert.equal(hypAvecAxe.cut.ancrePresente, true);
  const h1 = hypAvecAxe.rails.left.find(h => h.origines.includes('H1')) || hypAvecAxe.rails.left[1];
  assert.ok(Number.isFinite(h1.traits.ecartAxeMm), 'ecartAxeMm est renseigné quand axeGraine est fourni');
  assert.ok(Number.isFinite(h1.traits.paireMilieuAxeMm), 'paireMilieuAxeMm est renseigné sur H1 quand axeGraine est fourni');

  /* 1. Avec le modèle historique `PARAM`, les probabilités sont strictement identiques au bit près avec ou sans `axeGraine` ! */
  const modV1 = L1.modeleFige(PARAM, 'lot');
  const cas1 = L1.casDuDiffere({ cut: 2855, zone: 'adv', hyp: hypSansAxe, gMed: 1437, voieRef: null });
  const cas2 = L1.casDuDiffere({ cut: 2855, zone: 'adv', hyp: hypAvecAxe, gMed: 1437, voieRef: null });
  for (const s of ['left', 'right']) {
    const p1 = cas1.rails[s].hyps.map(h => L1.probas(modV1, h.x).p10);
    const p2 = cas2.rails[s].hyps.map(h => L1.probas(modV1, h.x).p10);
    assert.deepStrictEqual(p2, p1, `probabilités v1 inchangées au bit près sur ${s}`);
  }

  /* 2. Avec un modèle v2 déclarant `ecartAxeMm` (coefficient négatif -1.5 : plus loin de l'axe = moins probable),
   *    une hypothèse proche de l'axe reçoit un score supérieur à la même hypothèse quand l'axe est à 150 mm ! */
  const pV2 = JSON.parse(JSON.stringify(PARAM));
  const uLot = pV2.usages.lot;
  const idxInsert = uLot.colonnes.indexOf('h6DansReservoir:manque') + 1;
  uLot.normalisation.push({ nom: 'ecartAxeMm', moyenne: 20, ecartType: 30, manque: true });
  uLot.colonnes.splice(idxInsert, 0, 'ecartAxeMm', 'ecartAxeMm:manque');
  uLot.modele10.coefficients.splice(idxInsert, 0, -1.5, 0);
  uLot.modele5.coefficients.splice(idxInsert, 0, -1.5, 0);
  const modV2 = L1.modeleFige(pV2, 'lot');

  const hypAxeLoin = L1.hypothesesDuCut({ capture: cap, science: sci, seul, voisins: [], gMed: 1437, axeGraine: { left: [160, 0], right: [160, 0], axeMm: 160 } });
  const casProche = L1.casDuDiffere({ cut: 2855, zone: 'adv', hyp: hypAvecAxe, gMed: 1437, voieRef: null });
  const casLoin = L1.casDuDiffere({ cut: 2855, zone: 'adv', hyp: hypAxeLoin, gMed: 1437, voieRef: null });
  const scoreProche = L1.probas(modV2, casProche.rails.left.hyps[0].x).p10;
  const scoreLoin = L1.probas(modV2, casLoin.rails.left.hyps[0].x).p10;
  assert.ok(scoreProche > scoreLoin, `modèle v2 : hypothèse proche de l'axe (${scoreProche.toFixed(4)}) > loin de l'axe (${scoreLoin.toFixed(4)})`);
});

test('CH-157 (C6c) : le constructeur de jeu propage la graine d’axe sans étiquette jusqu’au contexte appris', () => {
  const cap = { identity: { part: 23, cut: 2855, frameId: null }, rails: base.rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.visibleByClipBoxes };
  const sci = Sh.scientificProposeBothAvecReservoir(cap);
  const seul = L1.variante(cap, sci, [], L1.REGLE.lotOptions);
  const obs = Jeu.creerObservateur({ partie: 23, graineAxe: () => ({ left: [2, 0], right: [-3, 0], axeMm: -0.5 }) });
  obs.etat.verifiees = [];
  obs.etat.gMed = 1437;
  obs.cut({ c: { cut: 2855 }, v0: { startedAt: '2026-01-01T00:00:00Z' }, o: { ariane: { etat: 'calcule' }, mic: { ref: null }, visites: 1 }, entree: null,
    brut: { capture: cap, science: sci, seul, chaine: null, appuisAvant: [] } });
  const rec = obs.etat.cuts[0];
  assert.equal(rec.hyp.cut.ancrePresente, true, 'la graine fournie au constructeur devient un trait du cut');
  assert.ok(Number.isFinite(rec.hyp.rails.left[0].traits.ecartAxeMm) || rec.hyp.rails.left.some(h => Number.isFinite(h.traits.ecartAxeMm)));
  const lignes = Jeu.lignesDuJeu({ designation: '1:23', jeu: 'apprentissage', observateur: obs, cas: null, zones: new Map([[2855, { zone: 'abords', genre: 'differe' }]]) });
  const cut = lignes.find(l => l.type === 'cut');
  assert.equal(cut.contexte.ancrePresente, true, 'le contexte JSONL transmis à gcv2-apprendre porte ancrePresente');
  assert.ok(Jeu.args(['construire', '--partie', '1:23', '--echo', '/tmp/echo', '--sans-lot', '--sortie', '/tmp/jeu.jsonl', '--liste', '/tmp/liste.json']).liste, 'la ligne de commande accepte --liste');
});

test('CH-157 (C6d) : la décision L1 alimente les traits d’axe sans changer le modèle v1', () => {
  const cap = { identity: { part: 23, cut: 2855, frameId: null }, rails: base.rails, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.visibleByClipBoxes };
  const sci = Sh.scientificProposeBothAvecReservoir(cap), mod = L1.modeleFige(PARAM, 'lot');
  const entree = { capture: cap, science: sci, appuis: [], options: L1.REGLE.lotOptions, voisins: [], zone: 'abords', plagesADV: [], modele: mod, regle: L1.REGLE };
  const sans = L1.deciderDiffere(entree);
  const avec = L1.deciderDiffere({ ...entree, axeGraine: { left: [2, 0], right: [-3, 0], axeMm: -0.5 } });
  assert.equal(avec.hyp.cut.ancrePresente, true, 'deciderDiffere transmet axeGraine aux hypothèses');
  assert.deepStrictEqual(avec.decision, sans.decision, 'la décision du modèle v1 reste identique au bit près');
  assert.deepStrictEqual(avec.positions, sans.positions, 'les positions du modèle v1 restent identiques au bit près');
});
