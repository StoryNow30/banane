'use strict';
/* I4 (audit 5.0) : réglages figés avant la partie suivante.
 *  Le fichier versionné datasets/reglages-figes.json garde la date, les valeurs et les parties qui ont servi. Cet essai
 *  vérifie que ces valeurs concordent avec les défauts du code et des outils : changer un défaut sans mettre à jour le
 *  fichier (donc sans repartir de zéro sur des parties neuves) fait échouer l'essai.
 *  - règle prudente de voie prédite (D-147) : tools/rejeu-voie-predite.cjs, variante « regle-wc-e10-p10 » ;
 *  - mémoire de série G1 (b) : tools/memoire-differes.cjs (grille, seuils, porte) et src/lot-decision.js (recentrage) ;
 *  - ombre verticale (nom : P8) : src/settings.js (présente seulement dans les versions qui la portent). Le nom « E2 » est réservé à l'ombre GCV1
 *    de l'Écho ; les clés de données (`ombreVerticaleRefusee`, `ombreVerticale`) et la chaîne de version `e2-vertical-refuse-v1` gardent « e2 » par
 *    compatibilité avec les exports déjà produits. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const racine = path.join(__dirname, '..');
const F = JSON.parse(fs.readFileSync(path.join(racine, 'datasets', 'reglages-figes.json'), 'utf8'));
const Manifeste = require('../tools/manifeste-parties.cjs');
const Rejeu = require('../tools/rejeu-voie-predite.cjs');
const G1 = require('../tools/memoire-differes.cjs');
const Lot = require('../src/lot-decision.js');
const Settings = require('../src/settings.js');

test('le fichier porte une date, des valeurs et les parties qui ont servi, pour chaque réglage', () => {
  assert.equal(F.format, 'ariane-reglages-figes-v1');
  assert.match(F.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(F.reglages).sort(), ['memoireSerieB', 'ombreVerticale', 'voiePredite']);
  for (const [nom, r] of Object.entries(F.reglages)) {
    assert.ok(r.libelle && r.valeurs && typeof r.valeurs === 'object', nom);
    assert.match(r.fige, /^\d{4}-\d{2}-\d{2}$/, `${nom} : date de gel`);
    assert.ok(Array.isArray(r.parties) && r.parties.length, `${nom} : parties qui ont servi`);
  }
});

test('les parties qui ont servi à régler sont des parties d\'apprentissage du manifeste (B1)', () => {
  const m = Manifeste.lire();
  for (const [nom, r] of Object.entries(F.reglages)) for (const b of r.parties) for (const n of b.parties) assert.equal(Manifeste.statut(m, b.projet, n), 'apprentissage', `${nom} : partie ${n} du projet ${b.projet}`);
});

test('règle prudente de voie prédite (D-147) : mêmes valeurs que la variante de l\'outil de rejeu', () => {
  const r = F.reglages.voiePredite, v = r.valeurs, variante = Rejeu.VARIANTES.find(x => x.id === r.variante);
  assert.ok(variante, 'variante de l\'outil de rejeu');
  assert.deepEqual(variante.regle.etages, v.etages);
  assert.equal(variante.regle.confMin, v.confMin);
  assert.equal(variante.regle.profMax, v.chaineMax);
  assert.equal(variante.regle.ecartVoisinMm, v.ecartVoisinMm);
  assert.equal(variante.fenetre, v.fenetreMm, 'fenêtre d\'acceptation de la variante');
  assert.equal(Lot.DEFAULTS.guardMm, v.fenetreMm, 'garde de continuité du lot');
  assert.equal(variante.memoire, v.memoire);
  assert.equal(variante.choix, Lot.DEFAULTS.chooseMm);
  // les valeurs que la fiche annonce (D-147) : étage moteur, confiance ≥ 55, chaîne ≤ 10, écartement à 10 mm, fenêtre de 30 mm
  assert.deepEqual([v.etages.join(), v.confMin, v.chaineMax, v.ecartVoisinMm, v.fenetreMm], ['window', 55, 10, 10, 30]);
});

test('mémoire de série G1 (b) : mêmes valeurs que la grille, les seuils et la porte de l\'outil', () => {
  const r = F.reglages.memoireSerieB, v = r.valeurs;
  for (const porteDisp of v.porteDispersionMm) {
    const g = G1.GRILLE_B.find(x => x.base === v.base && x.K === v.derniersCuts && x.porteDisp === porteDisp && x.nBack === v.coupPrecedentCompris && x.minMemoire === v.memoireMin && x.mode === v.mode);
    assert.ok(g, `réglage de la grille avec dispersion ≤ ${porteDisp} mm`);
    assert.equal(g.tol, v.recentrageMm);
  }
  assert.equal(v.recentrageMm, Lot.DEFAULTS.chooseMm, 'recentrage = choix du minimum de la reprise « depuis la voie » du lot');
  assert.equal(v.minDessus, Lot.DEFAULTS.minTop); assert.equal(v.minFlanc, Lot.DEFAULTS.minFace);
  assert.equal(v.seuilJusteMm, G1.SEUIL_JUSTE_MM); assert.equal(v.seuilFauxMm, G1.SEUIL_FAUX_MM); assert.equal(v.seuilMauvaiseVoieMm, G1.SEUIL_MAUVAISE_VOIE_MM);
  assert.equal(v.porteFaux, G1.PORTE_FAUX);
  assert.equal(v.propagation, true);
  // la fiche G1 écrit les mêmes nombres : voie prolongée depuis les poses de l'opérateur, 3 derniers cuts, dispersion ≤ 6 ou 10 mm, moteur recentré à 15 mm
  assert.deepEqual([v.base, v.derniersCuts, v.porteDispersionMm.join('|'), v.recentrageMm], ['M', 3, '6|10', 15]);
});

test('ombre verticale : même valeur que le réglage de src/settings.js quand cette version le porte', t => {
  const v = F.reglages.ombreVerticale.valeurs;
  assert.equal(v.mm, 3.6);
  if (!Settings.ombreVerticaleRefusee) return t.skip('cette branche ne porte pas encore l\'ombre verticale (livrée par la ligne de test 4.9.5.4) : à vérifier après la fusion');
  assert.equal(Settings.ombreVerticaleRefusee.mm, v.mm);
});
