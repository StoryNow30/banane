'use strict';
/* D-143 : tools/jointure-echo-orbite.cjs applique aux exports déjà collectés la règle de l'Écho (src/native-session.js,
 * noteServerWriteNow) : l'écriture serveur de validation (PUT 2xx, rattachée à la visite par numéro de ligne) fait foi sur
 * la référence humaine quand ses rails diffèrent de plus de 1 mm de la référence figée à la touche. Données SYNTHÉTIQUES. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const J = require('../tools/jointure-echo-orbite.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const proche = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const G0 = [100, 200, 10], D0 = [101.5, 200, 10];                       // écartement présenté par ESV : 1 500 mm
const HORS_JOURNAL = { events: [], records: [] };
const joindre = (records, options = {}) => J.joindre(records, HORS_JOURNAL, { sansJournal: true, partie: 90, ...options });
const ligne = (table, cut) => table.find(l => l.cut === cut);
const m = (minutes, secondes = 0) => ({ minutes, secondes });

/* Cas du cut 428 : la référence lue à la touche a la gauche déjà déplacée (+132 mm vers l'extérieur) mais pas la droite,
 * que le clic déplace 11 ms après la touche (190 mm vers l'intérieur) ; l'écriture de validation porte les deux. */
const GAUCHE = S.decaler(G0, -0.1324), DROIT = S.decaler(D0, -0.19);
const obsolete = [GAUCHE, D0], finale = [GAUCHE, DROIT];
const cut428 = (extra = {}) => S.visite({ session: 'sess', index: 0, cut: 6001, debut: m(1), fin: m(1, 3), initiale: [G0, D0], derniere: finale, validation: obsolete,
  etiquette: 'VALIDATE_CORRECTED_LEFT_ONLY', ecritures: [{ rails: finale }], ...extra });

test('D-143 : la référence périmée est remplacée par l\'écriture de validation, l\'écart humain suit', () => {
  const { table, resume } = joindre([cut428()]);
  const l = ligne(table, 6001);
  proche(l.ecartHumain.gauche.dist3dMm, 132.4); proche(l.ecartHumain.droite.dist3dMm, 190);
  proche(l.ecartHumain.maxDist3dMm, 190);
  assert.equal(l.referenceCorrigeeParEcriture.par, 'outil');
  assert.equal(l.referenceCorrigeeParEcriture.poseDe, 'last-observed-state');
  proche(l.referenceCorrigeeParEcriture.ecartMaxMm, 190);
  assert.equal(l.etiquetteEcho, 'VALIDATE_CORRECTED_LEFT_ONLY', 'l\'étiquette de l\'Écho est gardée telle quelle');
  assert.equal(l.etiquetteEchoApresCorrection, 'VALIDATE_CORRECTED_BOTH');
  assert.equal(resume.referencesCorrigees.cuts, 1);
  assert.equal(resume.referencesCorrigees.parLOutil, 1); assert.equal(resume.referencesCorrigees.parLEcho, 0);
  assert.deepEqual(resume.referencesCorrigees.liste.map(x => [x.partie, x.cut]), [[90, 6001]]);
});

test('D-143 : l\'écartement de la référence corrigée rentre dans 1 420–1 470 mm ; celui de la périmée en sortait', () => {
  const avec = joindre([cut428()]).resume;
  assert.deepEqual(avec.ecartementsReferenceHorsPlage.liste, []);
  assert.equal(avec.ecartementsReferenceHorsPlage.minMm, 1420); assert.equal(avec.ecartementsReferenceHorsPlage.maxMm, 1470);
  /* Sans écriture jointe (export sans serverWrites) : la référence périmée sort de la plage et est listée. */
  const sans = joindre([cut428({ ecritures: undefined })]).resume;
  assert.equal(sans.referencesCorrigees.cuts, 0);
  assert.equal(sans.ecartementsReferenceHorsPlage.cuts, 1);
  assert.deepEqual(sans.ecartementsReferenceHorsPlage.liste.map(x => [x.partie, x.cut]), [[90, 6001]]);
  proche(sans.ecartementsReferenceHorsPlage.liste[0].ecartementMm, 1632.4, 0.1);
});

test('D-143 : si le dernier état observé ne concorde pas, les positions de l\'écriture font la pose', () => {
  const ecrit = S.decaler(DROIT, 0, 0.005);                                  // l'écriture porte le rail droit 5 mm plus loin que le dernier état
  const l = ligne(joindre([cut428({ ecritures: [{ rails: [GAUCHE, ecrit] }] })]).table, 6001);
  assert.equal(l.referenceCorrigeeParEcriture.poseDe, 'write');
  proche(l.ecartHumain.droite.dist3dMm, Math.hypot(190, 5), 0.1);
  assert.equal(l.ecartHumain.droite.repere, 'profil');
});

test('D-143 : sous 1 mm d\'écart avec la référence, rien n\'est corrigé', () => {
  const quasi = [GAUCHE, S.decaler(D0, 0, 0.0008)];
  const { table, resume } = joindre([cut428({ validation: quasi, derniere: quasi, ecritures: [{ rails: [GAUCHE, D0] }] })]);
  assert.equal(ligne(table, 6001).referenceCorrigeeParEcriture, undefined);
  assert.equal(resume.referencesCorrigees.cuts, 0);
});

test('D-143 : seule une validation réussie rattachée par numéro de ligne, au cut de la visite, corrige', () => {
  const faux = [
    { rails: finale, status: 500 },                                           // échec serveur
    { rails: finale, kind: 'seen' },                                          // « vu par l'opérateur »
    { rails: finale, joinMethod: 'time-current-visit' },                      // rattachée par l'heure
    { rails: finale, rowIndex: 6002 },                                        // ligne voisine
  ];
  for (const ecriture of faux) {
    const { table, resume } = joindre([cut428({ ecritures: [ecriture] })]);
    assert.equal(ligne(table, 6001).referenceCorrigeeParEcriture, undefined, JSON.stringify(ecriture).slice(0, 80));
    assert.equal(resume.referencesCorrigees.cuts, 0);
    proche(ligne(table, 6001).ecartHumain.droite.dist3dMm, 0);
  }
  /* Un export sans `kind` (ancienne version) : la validation se reconnaît à son corps. */
  const ancien = cut428({ ecritures: [{ corps: { XLeftEdge: GAUCHE[0], YLeftEdge: GAUCHE[1], ZLeftEdge: GAUCHE[2], XRightEdge: DROIT[0], YRightEdge: DROIT[1], ZRightEdge: DROIT[2], ExtractionStatus: 'valid', TreatedByOperator: true } }] });
  delete ancien.serverWrites[0].kind;
  assert.equal(joindre([ancien]).resume.referencesCorrigees.cuts, 1);
});

test('D-143 : la dernière écriture de validation de la visite fait foi', () => {
  const entre = [GAUCHE, S.decaler(D0, -0.1)];
  const { table } = joindre([cut428({ ecritures: [{ rails: entre }, { rails: finale }] })]);
  proche(ligne(table, 6001).ecartHumain.droite.dist3dMm, 190);
});

test('D-143 : une référence déjà corrigée par l\'Écho est comptée à part, l\'ancienne n\'est pas une validation de plus', () => {
  const r = cut428({ validation: finale, ecritures: [{ rails: finale }], referenceSource: 'validation-write' });
  r.humanFinalReference.replacedByWrite = { poseFrom: 'last-observed-state', maxDiffMm: 190.3, diffMm: { left: 0, right: 190.3 } };
  r.humanFinalReferences = [{ state: S.etat(6001, obsolete, 90), supersededBy: 'validation-write' }, r.humanFinalReference];
  const { table, resume } = joindre([r]);
  const l = ligne(table, 6001);
  assert.equal(l.validationsDeLaVisite, 1);
  assert.equal(l.referenceCorrigeeParEcriture.par, 'echo');
  assert.equal(resume.referencesCorrigees.cuts, 1); assert.equal(resume.referencesCorrigees.parLEcho, 1); assert.equal(resume.referencesCorrigees.parLOutil, 0);
  proche(l.ecartHumain.droite.dist3dMm, 190);
});

test('D-143 : les écartements de référence hors 1 420–1 470 mm sont listés, bornes comprises', () => {
  const ecart = (mm) => [G0, S.decaler(G0, mm / 1000)];
  const visites = [1420, 1470, 1419, 1471, 1500].map((mm, i) => S.visite({ session: 'sess', index: i, cut: 6100 + i, debut: m(2 + i), fin: m(2 + i, 3), initiale: ecart(mm), validation: ecart(mm) }));
  const { resume } = joindre(visites);
  assert.deepEqual(resume.ecartementsReferenceHorsPlage.liste.map(x => x.cut), [6102, 6103, 6104]);
  assert.deepEqual(resume.ecartementsReferenceHorsPlage.liste.map(x => Math.round(x.ecartementMm)), [1419, 1471, 1500]);
  assert.equal(resume.ecartementsReferenceHorsPlage.cuts, 3);
});

test('D-143 : le résumé en texte dit les cuts corrigés et les écartements hors plage', () => {
  const { resume } = joindre([cut428(), cut428({ index: 1, cut: 6002, ecritures: undefined })]);
  const t = J.texte(resume);
  assert.match(t, /Références humaines corrigées par l'écriture serveur : 1 cut/);
  assert.match(t, /Écartements de la référence hors 1420–1470 mm : 1 cut/);
  assert.match(t, /6002/);
});
