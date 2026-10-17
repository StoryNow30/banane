'use strict';
/* I4 (audit 5.0) : réglages figés avant la partie suivante.
 *  Le fichier versionné datasets/reglages-figes.json garde la date, les valeurs et les parties qui ont servi. Cet essai
 *  vérifie que ces valeurs concordent avec les défauts du code et des outils : changer un défaut sans mettre à jour le
 *  fichier (donc sans repartir de zéro sur des parties neuves) fait échouer l'essai.
 *  - règle prudente de voie prédite (D-147) : tools/rejeu-voie-predite.cjs, variante « regle-wc-e10-p10 » ;
 *  - mémoire de série G1 (b) : tools/memoire-differes.cjs (grille, seuils, porte) et src/lot-decision.js (recentrage) ;
 *  - ombre verticale (nom : P8) : src/settings.js (présente seulement dans les versions qui la portent). Le nom « E2 » est réservé à l'ombre GCV1
 *    de l'Écho ; les clés de données (`ombreVerticaleRefusee`, `ombreVerticale`) et la chaîne de version `e2-vertical-refuse-v1` gardent « e2 » par
 *    compatibilité avec les exports déjà produits.
 *  - règles métier de l'opérateur expert : src/regles-metier.js (seuils) et src/settings.js (ombre active, activation coupée) ;
 *  - verts à contrôler : src/verts-a-controler.js (poids, zones mortes, fenêtre, seuil, temps par vert) et src/settings.js (liste active). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const racine = path.join(__dirname, '..');
const F = JSON.parse(fs.readFileSync(path.join(racine, 'datasets', 'reglages-figes.json'), 'utf8'));
const Manifeste = require('../tools/manifeste-parties.cjs');
const Rejeu = require('../tools/rejeu-voie-predite.cjs');
const G1 = require('../tools/memoire-differes.cjs');
const Lot = require('../src/lot-decision.js');
const Settings = require('../src/settings.js');
const ReglesMetier = require('../src/regles-metier.js');
const VertsAControler = require('../src/verts-a-controler.js');

test('le fichier porte une date, des valeurs et les parties qui ont servi, pour chaque réglage', () => {
  assert.equal(F.format, 'ariane-reglages-figes-v1');
  assert.match(F.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(Object.keys(F.reglages).sort(), ['fauxVertOmbre', 'hauteurApprise', 'memoireSerieB', 'ombreVerticale', 'reglesMetier', 'vertsAControler', 'voiePredite']);
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

test('règles métier : mêmes seuils que le module, ombre active et activation coupée dans le réglage livré', () => {
  const r = F.reglages.reglesMetier, v = r.valeurs, D = JSON.parse(JSON.stringify(ReglesMetier.DEFAULTS));
  for (const k of ['surface', 'pn', 'grappe', 'enPlace', 'ecartement', 'verts', 'adv']) assert.deepEqual(v[k], D[k], k);
  assert.equal(Settings.reglesMetier.ombre, true); assert.equal(Settings.reglesMetier.actif, false);
  assert.deepEqual(Object.keys(Settings.reglesMetier.regles).sort(), [...ReglesMetier.REGLES].sort());
  for (const id of ReglesMetier.REGLES) assert.equal(Settings.reglesMetier.regles[id], false, id);
  // les nombres que la fiche annonce : marges de 4 et 6 cuts, deux cœurs à 3 cuts, quarts à 50 %, grappe 2 différés dans 6 cuts dont un à 2, écartement à 15 mm
  assert.deepEqual([v.pn.margeAvant, v.pn.margeApres, v.pn.confirmation, v.pn.confirmationEcartCuts, v.surface.quadMinPct, v.grappe.differesMin, v.grappe.fenetreCuts, v.grappe.procheCuts, v.ecartement.seuilMm], [4, 6, 2, 3, 50, 2, 6, 2, 15]);
  // zone d'ADV (fiches/DETECTION_ADV.md) : rail de plus de 3 à 16 cm, deux alertes à 3 cuts, marges de 30 cuts ; poids nul dans la liste des verts
  assert.deepEqual([v.adv.largeurMinPas, v.adv.largeurMaxPas, v.adv.confirmation, v.adv.confirmationEcartCuts, v.adv.trouCuts, v.adv.margeAvant, v.adv.margeApres, v.adv.sautPas, v.adv.chutePas], [3, 16, 2, 3, 10, 30, 30, 3, 5]);
});

test('faux vert en ombre : mêmes seuils que le module et le réglage livré, chemin d\'activation coupé', () => {
  const FV = require('../src/faux-vert-ombre.js');
  const v = F.reglages.fauxVertOmbre.valeurs;
  assert.equal(v.dzMinMm, FV.REGLE.dzMinMm); assert.equal(v.epaisseurMinMm, FV.REGLE.epaisseurMinMm);
  assert.equal(v.dzMinMm, Settings.fauxVertOmbre.dzMinMm); assert.equal(v.epaisseurMinMm, Settings.fauxVertOmbre.epaisseurMinMm);
  assert.equal(v.differer, false); assert.equal(Settings.fauxVertOmbre.differer, false);
  assert.equal(v.memeRail, true);
  assert.equal(F.reglages.fauxVertOmbre.ombre.version, FV.VERSION);
});

test('hauteur apprise en ombre : même modèle que le module et le réglage livré, chemin d\'activation coupé', () => {
  const HA = require('../src/hauteur-apprise.js');
  const r = F.reglages.hauteurApprise, v = r.valeurs, s = Settings.hauteurApprise;
  assert.equal(r.ombre.version, HA.VERSION);
  assert.equal(v.appliquer, false); assert.equal(s.appliquer, false); assert.equal(s.actif, true);
  for (const k of ['plafondMm', 'pointsDessusMin']) { assert.equal(v[k], HA.MODELE[k], k); assert.equal(s[k], HA.MODELE[k], k); }
  assert.deepEqual(v.etages, [...HA.MODELE.etages]); assert.deepEqual([...s.etages], [...HA.MODELE.etages]);
  for (const g of ['applique', 'refuse']) { assert.deepEqual(v[g], { ...HA.MODELE[g] }, g); assert.deepEqual({ ...s[g] }, { ...HA.MODELE[g] }, g); }
});

test('verts à contrôler : mêmes poids, zones mortes, fenêtres, seuil et temps que le module ; liste active (lecture seule)', () => {
  const r = F.reglages.vertsAControler, v = r.valeurs, D = VertsAControler.DEFAULTS;
  assert.deepEqual(v.poids, { ...D.poids });
  assert.deepEqual(v.zonesMortes, { ...D.zonesMortes });
  assert.deepEqual([v.fenetreCuts, v.fenetreIsoleCuts, v.voisinsVoie, v.voisinsDenivele, v.seuil, v.tempsParVertS], [D.fenetreCuts, D.fenetreIsoleCuts, D.voisinsVoie, D.voisinsDenivele, D.seuil, D.tempsParVertS]);
  assert.equal(Settings.vertsAControler.actif, true);
});
