'use strict';
/* tools/trace-ecritures.cjs sur données SYNTHÉTIQUES (tests/helpers/trace-synthetique.cjs) : partie 90 inventée, rien du terrain.
 * Le scénario : un lot Orbite de 40 cuts neufs (36 posés, 4 différés), un cycle presque constant ; une Écho qui revoit six de
 * ces cuts (ESV n'écrit plus « seen » : déjà écrit par le lot), traite 30 cuts neufs à un rythme humain (pauses comprises), et
 * fait ce qu'Ariane ne fait pas : un SKIP, une double validation, une écriture en échec reprise par ESV. Les contre-épreuves
 * ajoutent à Orbite, une à une, ce qui trahirait Ariane (un champ en plus, l'ordre inversé, un rythme de machine, trop de
 * lectures) et vérifient que l'outil le signale ; le témoin, qui imite l'humain, ne signale rien. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const T = require('../tools/trace-ecritures.cjs');
const S = require('./helpers/trace-synthetique.cjs');

const CUTS_LOT = Array.from({ length: 40 }, (_, i) => 1001 + i);
const DIFFERES = [1005, 1010, 1015, 1020];
const NEUFS = Array.from({ length: 30 }, (_, i) => 2001 + i);
const HUMAIN = S.intervallesHumain(40);

/* L'Écho : six cuts du lot revus (validation seule), puis 30 cuts neufs, puis trois cuts « à part ». */
function echoSynthetique({ extras = true } = {}) {
  const visites = [];
  let t = 5000;
  CUTS_LOT.slice(0, 6).forEach((cut, i) => { visites.push({ cut, t, seen: false, validation: true }); t += HUMAIN[i]; });
  NEUFS.forEach((cut, i) => { visites.push({ cut, t, seen: true, validation: i % 7 !== 3 }); t += HUMAIN[i % HUMAIN.length]; });   // un cut sur sept vu sans être validé
  const extra = [];
  if (extras) {
    const tt = t + 3000;
    visites.push({ cut: 2031, t: tt, seen: true, validation: false }, { cut: 2032, t: tt + 6000, seen: true, validation: true }, { cut: 2033, t: tt + 12000, seen: false, validation: false });
    extra.push(S.ecriture({ t: tt + 2500, cut: 2031, corps: S.CORPS_SKIP(2031) }));                                     // SKIP : le geste qu'Ariane ne fait pas
    extra.push(S.ecriture({ t: tt + 6000 + 4500, cut: 2032, corps: S.CORPS_VALIDATION(2032) }));                         // seconde validation du même cut
    extra.push(S.ecriture({ t: tt + 12000 + 600, cut: 2033, rowIndex: null, corps: S.CORPS_SEEN(), status: 502 }));      // échec, sans numéro de ligne…
    extra.push(S.ecriture({ t: tt + 12000 + 900, cut: 2033, corps: S.CORPS_SEEN(), attempt: 2 }));                       // … repris par ESV (tentative 2)
  }
  return S.exportEcho({ visites, extra });
}
const orbite = (options = {}) => S.journalOrbite({ cuts: CUTS_LOT, differes: DIFFERES, ...options });
const source = (nom, donnees) => nom === 'orbite' ? T.lireOrbiteDoc(donnees) : T.lireEchoDoc(donnees);
const analyser = (docOrbite, docEcho, options = { partie: S.PARTIE }) => T.analyser({ orbite: source('orbite', docOrbite), echo: source('echo', docEcho) }, options);
const drapeau = (comparaison, id) => comparaison.drapeaux.find(d => d.id === id);

test('nature d\'une écriture : seen, validation, autre (SKIP, corps absent, champs inattendus)', () => {
  assert.equal(T.natureDe({ SeenByOperator: true }), 'seen');
  assert.equal(T.natureDe(S.CORPS_VALIDATION(1)), 'validation');
  assert.equal(T.natureDe(S.CORPS_SKIP(1)), 'autre');
  assert.equal(T.natureDe(null), 'autre');
  assert.equal(T.natureDe({ SeenByOperator: true, Inattendu: 1 }), 'autre');
  assert.equal(T.sousNatureDe(S.CORPS_SKIP(1)), 'ExtractionStatus=skipped');
  assert.equal(T.sousNatureDe(null), 'sans-corps');
  assert.equal(T.sousNatureDe({ A: 1, B: 2 }), 'champs:A+B');
});

test('outils statistiques : Kolmogorov-Smirnov, Fisher exact, régularité, histogramme', () => {
  const a = Array.from({ length: 50 }, (_, i) => i);
  assert.equal(T.kolmogorovSmirnov(a, a).D, 0);
  assert.equal(T.kolmogorovSmirnov(a, a).p, 1);
  const loin = T.kolmogorovSmirnov(a, a.map(x => x + 100));
  assert.equal(loin.D, 1);
  assert.ok(loin.p < 1e-10);
  assert.equal(T.kolmogorovSmirnov([1], [2]), null);
  assert.ok(Math.abs(T.fisherExact(3, 1, 1, 3) - 0.4857) < 0.0005);   // tableau classique de la dégustation de thé
  assert.equal(T.fisherExact(5, 5, 5, 5), 1);
  assert.ok(T.fisherExact(0, 50, 10, 40) < 0.01);
  assert.equal(T.regularite([2, 2, 2, 2, 2]).cv, 0);
  assert.equal(T.regularite([2, 2, 2, 2, 2]).madSurMediane, 0);
  assert.equal(T.regularite([1, 2]).cv, undefined);
  const h = T.histogramme([0.2, 0.7, 1.2, 1.7, 2.5, 4, 7, 20, 60, 500]);
  assert.deepEqual(Object.values(h), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
});

test('Orbite seule : natures, séquences par cut, enchaînements, codes, lectures', () => {
  const ex = T.extraire(T.lireOrbiteDoc(orbite()), { partie: S.PARTIE });
  const m = T.mesurer(ex);
  assert.deepEqual([m.natures.seen, m.natures.validation, m.natures.autres], [40, 36, 0]);
  assert.equal(m.cuts.cutsVisites, 40);
  assert.deepEqual(m.ordre.sequencesParCut, { 'S>V': 36, S: 4 });
  assert.deepEqual(m.ordre.enchainements, { 'S>V même': 36, 'V>S autre': 35, 'S>S autre': 4 });
  assert.deepEqual(m.codes.status, { 204: 76 });
  assert.equal(m.codes.echecs, 0);
  assert.deepEqual(Object.keys(m.champs.signatures.validation), ['ExtractionStatus+SeenByOperator+TreatedByOperator+RailType+RailOrientationLeft+RailOrientationRight+XLeftEdge+YLeftEdge+ZLeftEdge+XRightEdge+YRightEdge+ZRightEdge']);
  assert.equal(m.champs.valeurs.ExtractionStatus.valid, 36);
  assert.equal(m.rythme.cycleValidation.n, 35);                      // 36 validations, 35 intervalles entre elles
  assert.equal(m.lectures.requetesParCutVisite, 2);
  assert.equal(m.lectures.listPagesParValidation, 1);
  assert.equal(m.ordre.parcours.partPasDeUn, 1);
  assert.equal(m.ordre.parcours.retoursEnArriere, 0);
});

test('Écho : strates (cuts déjà vus par le lot), échec repris, SKIP et double validation comptés à part', () => {
  const { mE, mN } = analyser(orbite(), echoSynthetique());
  assert.equal(mE.entrees.origineEcritures, 'esv-observation');
  assert.equal(mE.entrees.reattribueesParReprise, 1);
  assert.equal(mE.entrees.ecrituresSansCut, 0);
  assert.equal(mE.codes.status['502'], 1);
  assert.equal(mE.codes.reprises, 1);
  assert.deepEqual(mE.natures.autresDetail, { 'ExtractionStatus=skipped': 1 });
  assert.deepEqual(mE.strates.dansLot, { ...mE.strates.dansLot, cuts: 6, cutsAvecSeen: 0, seenTotal: 0, cutsAvecValidation: 6 });
  assert.equal(mE.strates.horsLot.cuts, 33);
  assert.equal(mE.strates.horsLot.partCutsAvecSeen, part(mE.strates.horsLot.cutsAvecSeen, 33));
  assert.equal(mE.parCut.cutsAvecPlusieursValidations, 1);
  assert.equal(mE.parCut.cutsAvecPlusieursSeen, 0);
  assert.equal(mE.parCut.validationSansSeenAvant, 6);
  assert.equal(mN.cuts.cutsVisites, 33);
  assert.equal(mN.parCut.validationSansSeenAvant, 0);
});
const part = (n, d) => Math.round(n / d * 10000) / 10000;

test('comparaison : mêmes champs et mêmes codes ; l\'Écho fait en plus ce qu\'Ariane ne fait jamais ; rien que l\'humain ne fasse pas chez Orbite', () => {
  const { comparaison: c, comparaisonCutsNeufs: n } = analyser(orbite(), echoSynthetique());
  assert.deepEqual(c.jamaisHumain, []);
  assert.deepEqual(n.jamaisHumain, []);
  assert.equal(c.champs.seulementOrbite.length, 0);
  const seuls = c.jamaisAriane.map(x => `${x.rubrique}=${x.valeur}`);
  assert.ok(seuls.includes('valeur.ExtractionStatus=skipped'));
  assert.ok(seuls.includes('ordre.sequenceParCut=S>V>V'));
  assert.ok(seuls.includes('code.status=502'));
  assert.ok(seuls.includes('code.tentative=2'));
  assert.equal(drapeau(c, 'champs').niveau, 'difference');
  assert.equal(drapeau(c, 'codes').niveau, 'difference');
  assert.equal(drapeau(c, 'enchainements').niveau, 'identique');
  assert.equal(drapeau(n, 'enchainements').niveau, 'identique');
  assert.equal(drapeau(c, 'lectures').niveau, 'identique');
  assert.equal(n.rythme, undefined);                                   // le rythme se juge sur l'Écho entière, pas sur les cuts neufs seuls
});

test('contre-épreuve : un champ de plus dans l\'écriture d\'Orbite est signalé comme trahison possible', () => {
  const { comparaison: c } = analyser(orbite({ traitement: { extra: { Automatique: true } } }), echoSynthetique());
  assert.equal(drapeau(c, 'champs').niveau, 'trahison-possible');
  assert.ok(c.jamaisHumain.some(x => x.rubrique === 'champs.validation' && /Automatique/.test(x.valeur)));
  assert.ok(c.jamaisHumain.some(x => x.rubrique === 'type.Automatique'));
});

test('contre-épreuve : la validation écrite avant le seen est signalée (séquence et enchaînement propres à Orbite)', () => {
  const { comparaison: c } = analyser(orbite({ traitement: { ordreInverse: true } }), echoSynthetique());
  assert.equal(drapeau(c, 'natures-et-sequences').niveau, 'trahison-possible');
  assert.ok(c.jamaisHumain.some(x => x.rubrique === 'ordre.sequenceParCut' && x.valeur === 'V>S'));
  assert.equal(drapeau(c, 'enchainements').niveau, 'trahison-possible');
});

test('contre-épreuve : un cycle de machine (2 s, gigue de 2 %, aucune pause) est signalé ; un cycle qui imite l\'humain ne l\'est pas', () => {
  const machine = analyser(orbite(), echoSynthetique()).comparaison;
  assert.equal(drapeau(machine, 'rythme').niveau, 'trahison-possible');
  assert.ok(machine.rythme.rapportMAD < 0.5);
  assert.ok(machine.rythme.kolmogorovSmirnovCycle.p < 0.01);
  assert.equal(machine.rythme.queue.cycleSup10s.orbite.n, 0);
  const temoin = analyser(orbite({ intervalles: HUMAIN }), echoSynthetique()).comparaison;
  assert.notEqual(drapeau(temoin, 'rythme').niveau, 'trahison-possible');
  assert.ok(temoin.rythme.kolmogorovSmirnovCycle.p > 0.05);
});

test('contre-épreuve : trop de lectures par cut chez Orbite est signalé', () => {
  const trop = analyser(orbite({ intervalles: HUMAIN, traitement: { lectures: 6 } }), echoSynthetique()).comparaison;
  assert.equal(drapeau(trop, 'lectures').niveau, 'trahison-possible');
  assert.equal(trop.lectures.requetesParCutVisite.orbite, 6);
  assert.equal(trop.lectures.requetesParCutVisite.echo, 2);
});

test('parcours : un lot qui saute de cut en cut, toujours vers l\'avant, se distingue d\'un humain qui avance de un', () => {
  const saute = Array.from({ length: 40 }, (_, i) => 1001 + i * 7);
  const { comparaison: c } = analyser(S.journalOrbite({ cuts: saute, differes: [], intervalles: HUMAIN }), echoSynthetique());
  assert.equal(drapeau(c, 'parcours').niveau, 'difference');
  assert.equal(c.parcours.orbite.partPasDeUn, 0);
});

test('repli : sans relevé `write`, les `serverWrites` des visites de l\'Écho servent de source', () => {
  const doc = S.exportEcho({ visites: NEUFS.slice(0, 5).map((cut, i) => ({ cut, t: 5000 + i * 4000 })), sansEvenementsWrite: true });
  const ex = T.extraire(T.lireEchoDoc(doc), { partie: S.PARTIE });
  assert.equal(ex.origine, 'serverWrites');
  assert.equal(ex.ecritures.length, 10);
  assert.equal(T.mesurer(ex).natures.validation, 5);
  /* Avec les relevés `write`, le recoupement montre que tous les `serverWrites` y figurent. */
  const avec = T.extraire(T.lireEchoDoc(S.exportEcho({ visites: NEUFS.slice(0, 5).map((cut, i) => ({ cut, t: 5000 + i * 4000 })) })), { partie: S.PARTIE });
  assert.equal(avec.origine, 'esv-observation');
  assert.deepEqual(avec.recoupement, { serverWrites: 10, dansEvenements: 10, seulementServerWrites: 0 });
});

test('une écriture hors des cuts visités est comptée à part, et le filtre --partie écarte les autres parties', () => {
  const doc = orbite();
  doc.events.push(S.ecriture({ t: 900000, cut: 9999, corps: S.CORPS_SEEN() }));
  const m = T.mesurer(T.extraire(T.lireOrbiteDoc(doc), { partie: S.PARTIE }));
  assert.equal(m.entrees.ecrituresHorsCutVisite, 1);
  assert.equal(m.entrees.ecrituresDansCutVisite, 76);
  const autre = T.extraire(T.lireOrbiteDoc(doc), { partie: 91 });
  assert.equal(autre.cuts.size, 0);
});

test('ligne de commande : lit un dossier d\'exports, écrit le JSON agrégé et le CSV par cut, sans rien d\'autre', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-ecritures-'));
  try {
    const j = path.join(dossier, 'lot'), e = path.join(dossier, 'echo');
    fs.mkdirSync(j); fs.mkdirSync(e);
    S.ecrire(j, 'ariane-journal-v4-1.json', orbite());
    S.ecrire(j, 'ariane-bilan-v4-1.json', { format: 'autre' });                                    // ignoré : pas un journal
    S.ecrire(e, 'ariane-echo-2031-05-01T09-00-00-seg01.json', echoSynthetique());
    S.ecrire(e, 'notes.json', { format: 'autre' });                                                // ignoré : nom sans rapport
    const json = path.join(dossier, 'sortie', 'res.json'), csv = path.join(dossier, 'sortie', 'cuts.csv');
    const lignes = [];
    const res = T.executer(['--orbite', j, '--echo', e, '--partie', String(S.PARTIE), '--sortie', json, '--csv-cuts', csv], l => lignes.push(l));
    assert.equal(res.format, 'ariane-trace-ecritures-v1');
    assert.equal(res.orbite.natures.validation, 36);
    assert.equal(res.echo.natures.autres, 1);
    assert.ok(res.comparaison.drapeaux.length >= 6 && res.comparaisonCutsNeufs.drapeaux.length >= 4);
    assert.equal(JSON.parse(fs.readFileSync(json, 'utf8')).orbite.cuts.cutsVisites, 40);
    assert.equal(res.orbite._tables, undefined);
    const table = fs.readFileSync(csv, 'utf8').trim().split('\n');
    assert.equal(table[0], 'source;cut;visites;seen;validation;autres;sequence;seenAValidationS');
    assert.equal(table.length, 1 + 40 + 39 + 33);                                                   // Orbite, Écho (39 cuts), Écho cuts neufs (33)
    assert.match(lignes.join('\n'), /Comparaison Orbite \/ Écho \(cuts neufs\)/);
    /* Un dossier sans journal, des arguments absents ou inconnus : erreurs nettes. */
    assert.throws(() => T.executer(['--orbite', e, '--echo', e]), /Aucun journal Orbite/);
    assert.throws(() => T.executer([]), /Usage/);
    assert.throws(() => T.executer(['--bidon']), /Argument inconnu/);
    assert.throws(() => T.lireArguments(['--echo', e, '--pause-s', '0']), /--pause-s/);
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});

test('Écho seule : mesure sans comparaison', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-ecritures-'));
  try {
    S.ecrire(dossier, 'ariane-echo-2031-05-01T09-00-00-seg01.json', echoSynthetique());
    const res = T.executer(['--echo', dossier], () => {});
    assert.equal(res.orbite, null);
    assert.equal(res.comparaison, null);
    assert.equal(res.echo.strates, undefined);                                                      // sans lot, pas de strates
    assert.equal(res.echo.natures.validation, 6 + 26 + 2);                                          // 4 cuts neufs sur 30 vus sans validation, un cut validé deux fois
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});
