'use strict';
/* Jointure Écho ↔ Orbite : Écho seul (--sans-journal) et règle « visité sans action = bon »
 * (--visite-sans-action-bonne), sur données SYNTHÉTIQUES (tests/helpers/jointure-synthetique.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const J = require('../tools/jointure-echo-orbite.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const proche = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const ligne = (table, cut) => table.find(l => l.cut === cut);
const G0 = [100, 200, 10], D0 = [101.42, 200, 10];
const m = (minutes, secondes = 0) => ({ minutes, secondes });
const OUTIL = path.join(__dirname, '..', 'tools', 'jointure-echo-orbite.cjs');

/* Un Écho seul : un opérateur corrige deux cuts de la partie 91, en regarde d'autres sans rien faire. */
function echoSeul() {
  const corrige = [S.decaler(G0, 0.003, 0.004), D0];
  const v = (index, cut, debut, fin, extra = {}) => S.visite({ session: 'sess-x', index, cut, partie: 91, debut, fin, initiale: [G0, D0], ...extra });
  const records = [
    v(0, 6001, m(1), m(1, 20), { derniere: corrige, validation: corrige }),                    // corrigé de 5 mm (3-4-0)
    v(1, 6001, m(2), m(2, 20), { derniere: corrige, validation: corrige, etiquette: 'VALIDATE_NO_MOVEMENT' }), // revu ensuite, sans changement
    v(2, 6002, m(3), m(3, 20), { validation: [G0, D0], etiquette: 'VALIDATE_NO_MOVEMENT' }),   // validé tel quel
    v(3, 6003, m(4), m(4, 0.4)),                                                               // survol de 0,4 s, rien fait
    v(4, 6004, m(5), m(5, 30)),                                                                // regardé 30 s, rien fait
    v(5, 6005, m(6), m(6, 10), { derniere: [S.decaler(G0, 0, 0, 0.012), D0] }),                 // déplacé de 12 mm, jamais validé
    v(6, 6006, m(7), m(7, 2)),                                                                 // regardé 2 s, rien fait
    S.visite({ session: 'sess-x', index: 7, cut: 7001, partie: 92, debut: m(8), fin: m(8, 10), initiale: [G0, D0], validation: [S.decaler(G0, 0.009), D0] }), // autre partie
  ];
  return S.exportEcho({ session: 'sess-x', debutSession: m(0), stamp: '2031-05-01T09-00-00', records });
}
const lire = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-modes-')); try { S.ecrire(d, 'ariane-echo-2031-05-01T09-00-00-seg01.json', echoSeul()); return J.lireEcho([d]); } finally { fs.rmSync(d, { recursive: true, force: true }); } };
const sansJournal = (options = {}) => { const echo = lire(); return { echo, ...J.joindre(echo.records, { events: [], records: [] }, { sansJournal: true, sessions: echo.sessions, ...options }) }; };

test('Écho seul : tous les cuts, classe « sans-journal », base = pose initiale de la première visite', () => {
  const { table, resume } = sansJournal({ partie: 91 });
  assert.deepEqual(table.map(l => l.cut), [6001, 6002, 6003, 6004, 6005, 6006]);
  assert.ok(table.every(l => l.classe === 'sans-journal' && !l.dansJournal && l.dansEcho));
  const l = ligne(table, 6001);
  assert.equal(l.base, 'premiere-visite');
  assert.equal(l.referenceHumaine, 'observee');
  assert.equal(l.visitesEcho, 2);
  proche(l.ecartHumain.gauche.longitudinalMm, 3); proche(l.ecartHumain.gauche.lateralMm, 4); proche(l.ecartHumain.gauche.dist3dMm, 5);
  proche(l.ecartHumain.droite.dist3dMm, 0);
  assert.equal(resume.sansJournal, true);
  assert.equal(resume.base, 'premiere');
  assert.equal(resume.repereScene.calibre, false);
  assert.equal(resume.cutsJournal, 0);
  assert.equal(resume.cutsJoints, 0);
  assert.deepEqual(resume.cutsParClasse, {});
  const c = resume.parClasse['sans-journal'];
  assert.equal(c.cuts, 6);
  assert.equal(c.avecReference, 2);              // 6001 et 6002 ; les autres n'ont pas de validation
  assert.equal(c.corrections.sup5mm.cuts, 0);    // 5,0 mm n'est pas strictement au-dessus de 5
  assert.equal(c.ecart3dMm.gauche.maxMm, 5);
});

test('Écho seul : sans --partie, toutes les parties de l\'Écho ; avec --partie, une seule', () => {
  const tout = sansJournal();
  assert.deepEqual([...new Set(tout.table.map(l => l.partie))], [91, 92]);
  assert.deepEqual(tout.resume.partiesEchoIgnorees, []);
  proche(ligne(tout.table, 7001).ecartHumain.gauche.dist3dMm, 9);
  assert.equal(sansJournal({ partie: 92 }).table.length, 1);
  assert.deepEqual(sansJournal({ partie: 92 }).resume.partiesEchoIgnorees, [91]);
});

test('Écho seul : --base derniere reste disponible, la base « auto » devient la première visite', () => {
  const derniere = ligne(sansJournal({ partie: 91, base: 'derniere' }).table, 6001);
  assert.equal(derniere.base, 'derniere-visite');
  proche(derniere.ecartHumain.gauche.dist3dMm, 5);     // la seconde visite repart de la pose initiale : même écart ici
  assert.equal(sansJournal({ partie: 91, base: 'auto' }).resume.base, 'premiere');
  assert.equal(sansJournal({ partie: 91, base: 'premiere' }).resume.base, 'premiere');
});

test('ligne de commande : --sans-journal accepté, --journal refusé en même temps, usage sinon', () => {
  const a = J.lireArguments(['--echo', 'x', 'y', '--sans-journal', '--partie', '91']);
  assert.equal(a.sansJournal, true); assert.equal(a.journal, null); assert.deepEqual(a.echo, ['x', 'y']);
  assert.throws(() => J.lireArguments(['--echo', 'x', '--sans-journal', '--journal', 'j.json']), /s'excluent/);
  assert.throws(() => J.lireArguments(['--echo', 'x']), /Usage.*--sans-journal.*--visite-sans-action-bonne/);
  assert.throws(() => J.lireArguments(['--journal', 'j.json']), /Usage/);
  assert.equal(J.lireArguments(['--echo', 'x', '--journal', 'j.json']).sansJournal, false);
});

test('ligne de commande : un Écho seul en dossier de fichiers ariane-echo-*, sorties JSON et résumé', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-seul-'));
  try {
    S.ecrire(tmp, 'ariane-echo-2031-05-01T09-00-00-seg01.json', echoSeul());
    const json = path.join(tmp, 't.json');
    const r = cp.spawnSync(process.execPath, [OUTIL, '--echo', tmp, '--sans-journal', '--partie', '91', '--sortie', json, '--sans-poses'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Écho seul \(sans journal\) : 6 cuts en Écho/);
    assert.match(r.stdout, /Classe « sans-journal »/);
    assert.match(r.stdout, /sans journal\./);
    const doc = JSON.parse(fs.readFileSync(json, 'utf8'));
    assert.equal(doc.options.sansJournal, true);
    assert.equal(doc.table.length, 6);
    assert.equal(doc.resume.sources.evenementsJournal, 0);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

/* ---------------------------------------------------------------------------------------------------------------
 * Règle « visité sans action = bon » (partie 93, cuts inventés). Cuts :
 *  - 7101 : visite de 0,4 s ; 7102 : exactement 0,8 s ; 7103 : 30 s, un rail déplacé de 0,4 mm (sous le seuil) ;
 *  - 7104 : 30 s, un rail déplacé de 12 mm sans validation ; 7105 : validé (la règle n'y touche pas) ;
 *  - 7106 : trois visites courtes dans deux sessions, dont une de 2 s ; 0 : cut 0, artefact de rechargement ;
 *  - 7107 : posé par Ariane (journal), regardé 5 s sans rien faire. */
const SCENE = [0, 0, 0];
function echoRegle() {
  const v = (session, index, cut, debut, fin, extra = {}) => S.visite({ session, index, cut, partie: 93, debut, fin, initiale: [G0, D0], ...extra });
  const bouge = mmZ => [S.decaler(G0, 0, 0, mmZ / 1000), D0];
  const s1 = [
    v('sess-x', 0, 7101, m(1), m(1, 0.4)),
    v('sess-x', 1, 7102, m(2), m(2, 0.8)),
    v('sess-x', 2, 7103, m(3), m(3, 30), { derniere: bouge(0.4) }),
    v('sess-x', 3, 7104, m(4), m(4, 30), { derniere: bouge(12) }),
    v('sess-x', 4, 7105, m(5), m(5, 30), { derniere: bouge(6), validation: bouge(6) }),
    v('sess-x', 5, 7106, m(6), m(6, 0.5)),
    v('sess-x', 6, 0, m(7), m(7, 30)),
    v('sess-x', 7, 7107, m(8), m(8, 5)),
  ];
  const s2 = [v('sess-y', 0, 7106, m(40), m(40, 2)), v('sess-y', 1, 7106, m(41), m(41, 0.3))];
  return [S.exportEcho({ session: 'sess-x', debutSession: m(0), stamp: '2031-05-01T09-10-00', records: s1 }),
    S.exportEcho({ session: 'sess-y', debutSession: m(30), stamp: '2031-05-01T09-50-00', records: s2 })];
}
const joindreRegle = (options = {}) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-regle-'));
  try {
    echoRegle().forEach((doc, i) => S.ecrire(d, `ariane-echo-2031-05-01T09-${i}0-00-seg01.json`, doc));
    const echo = J.lireEcho([d]), jr = S.journal([{ cut: 7107, partie: 93, gauche: G0.map((x, i) => x - SCENE[i]), droit: D0.map((x, i) => x - SCENE[i]) }]);
    return J.joindre(echo.records, jr, { partie: 93, sessions: echo.sessions, ...options });
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
};
const refus = (resume) => resume.visiteSansActionBonne.refus;

test('visité sans action : coupée par défaut, le comportement actuel ne change pas', () => {
  const { table, resume } = joindreRegle();
  assert.equal(resume.visiteSansActionBonne, null);
  for (const cut of [7101, 7102, 7103, 7104, 7106, 7107, 0]) {
    assert.equal(ligne(table, cut).referenceHumaine, 'sans-reference', `cut ${cut}`);
    assert.equal(ligne(table, cut).regleVisiteBon, undefined);
    assert.equal(ligne(table, cut).visiteSansAction, undefined);
  }
  assert.equal(ligne(table, 7105).referenceHumaine, 'observee');
  assert.equal(resume.parClasse['hors-journal'].dontVisiteSansAction, undefined);
});

test('visité sans action : durée par défaut 0,8 s ; un cut visité sans rien faire compte pour une correction nulle', () => {
  assert.equal(J.DUREE_VISITE_DEFAUT_S, 0.8);
  const { table, resume } = joindreRegle({ visiteSansActionBonne: true });
  const rg = resume.visiteSansActionBonne;
  assert.equal(rg.dureeMinimaleS, 0.8);
  assert.equal(rg.cuts, 4);
  assert.deepEqual(rg.parClasse, { 'hors-journal': 3, posee: 1 });
  assert.deepEqual(refus(resume), { 'deplace-sans-validation': 1, 'trop-court': 1, 'sans-mesure': 0, 'hors-cut': 1, 'apres-page-perdue': 0, 'captures-vides': 0 });
  for (const cut of [7102, 7103, 7106, 7107]) {
    const l = ligne(table, cut);
    assert.equal(l.referenceHumaine, 'observee', `cut ${cut}`);
    assert.equal(l.regleVisiteBon, true);
    assert.equal(l.ecartHumain.maxDist3dMm, 0);
    assert.equal(l.ecartHumain.gauche.dist3dMm, 0); assert.equal(l.ecartHumain.droite.verticalMm, 0);
    assert.equal(l.poseHumaineFinale, undefined);
  }
  /* 0,8 s pile suffit ; 0,4 s non ; un rail déplacé de 0,4 mm n'est pas « modifié » ; 12 mm sans validation, si. */
  assert.equal(ligne(table, 7101).referenceHumaine, 'sans-reference');
  assert.deepEqual([ligne(table, 7101).visiteSansAction.appliquee, ligne(table, 7101).visiteSansAction.raison], [false, 'trop-court']);
  assert.equal(ligne(table, 7104).referenceHumaine, 'sans-reference');
  assert.equal(ligne(table, 7104).visiteSansAction.raison, 'deplace-sans-validation');
  proche(ligne(table, 7104).visiteSansAction.deplacementMaxMm, 12, 0.05);
  assert.equal(ligne(table, 0).visiteSansAction.raison, 'hors-cut');
  assert.equal(ligne(table, 7105).regleVisiteBon, undefined);
  /* 7106 : trois visites dans deux sessions, la plus longue (2 s) fait foi. */
  assert.equal(ligne(table, 7106).visitesEcho, 3);
  assert.equal(ligne(table, 7106).visiteSansAction.dwellMaxS, 2);
  /* Le cut posé garde la pose d'Ariane pour base. */
  assert.equal(ligne(table, 7107).classe, 'posee');
  assert.equal(ligne(table, 7107).base, 'ariane');
  assert.equal(ligne(table, 7103).base, 'premiere-visite');
});

test('visité sans action : ces cuts sont comptés à part dans le résumé, et pèsent dans les statistiques', () => {
  const { resume } = joindreRegle({ visiteSansActionBonne: true });
  const h = resume.parClasse['hors-journal'], p = resume.parClasse.posee;
  assert.equal(h.cuts, 7);                        // 7101 à 7106 et le cut 0
  assert.equal(h.avecReference, 4);               // 7102, 7103, 7105, 7106
  assert.equal(h.dontVisiteSansAction, 3);
  assert.equal(h.avecValidationObservee, 1);
  assert.equal(h.sansReference, 3);
  assert.equal(p.avecReference, 1); assert.equal(p.dontVisiteSansAction, 1); assert.equal(p.avecValidationObservee, 0);
  assert.equal(p.ecart3dMm.parCut.maxMm, 0);
  /* 7105 : 6 mm de correction, comptée une fois au-dessus de 5 mm, parmi quatre cuts. */
  assert.equal(h.ecart3dMm.parCut.n, 4);
  assert.equal(h.corrections.sup5mm.cuts, 1);
});

test('visité sans action : durée minimale réglable (0 = toutes les visites, 1 s, 3 s)', () => {
  const cuts = d => joindreRegle({ visiteSansActionBonne: d }).resume.visiteSansActionBonne;
  assert.equal(cuts(0).cuts, 5);                                  // 7101 (0,4 s) s'ajoute
  assert.equal(cuts(1).cuts, 3);                                  // 7102 (0,8 s) tombe
  assert.deepEqual(cuts(1).refus, { 'deplace-sans-validation': 1, 'trop-court': 2, 'sans-mesure': 0, 'hors-cut': 1, 'apres-page-perdue': 0, 'captures-vides': 0 });
  assert.equal(cuts(3).cuts, 2);                                  // 7103 et 7107
  assert.throws(() => joindreRegle({ visiteSansActionBonne: -1 }), /durée en secondes/);
});

test('visité sans action : sans mesure de rail, la règle ne s\'applique pas', () => {
  const visite = { startedAt: '2031-05-01T08:00:00.000Z', endedAt: '2031-05-01T08:00:30.000Z', initialObserved: { rails: {} }, lastObserved: { rails: {} } };
  const r = J.visiteSansAction({ cut: 9, visites: [visite] }, 0.8);
  assert.equal(r.appliquee, false);
  assert.equal(r.raison, 'sans-mesure');
  assert.equal(r.deplacementMaxMm, null);
});

test('ligne de commande : --visite-sans-action-bonne avec ou sans durée, avant une autre option', () => {
  const lire = (...opts) => J.lireArguments(['--echo', 'x', '--sans-journal', ...opts]).visiteSansActionBonne;
  assert.equal(lire(), null);
  assert.equal(lire('--visite-sans-action-bonne'), 0.8);
  assert.equal(lire('--visite-sans-action-bonne', '--sans-poses'), 0.8);
  assert.equal(lire('--visite-sans-action-bonne', '2.5', '--sans-poses'), 2.5);
  assert.equal(lire('--visite-sans-action-bonne', '0'), 0);
  assert.throws(() => lire('--visite-sans-action-bonne', 'abc'), /durée en secondes/);
  assert.throws(() => lire('--visite-sans-action-bonne', '-1'), /durée en secondes/);
});

test('ligne de commande : la règle sur un Écho seul, résumé lisible et sortie JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-regle-cli-'));
  try {
    echoRegle().forEach((doc, i) => S.ecrire(tmp, `ariane-echo-2031-05-01T09-${i}0-00-seg01.json`, doc));
    const json = path.join(tmp, 't.json');
    const r = cp.spawnSync(process.execPath, [OUTIL, '--echo', tmp, '--sans-journal', '--partie', '93', '--visite-sans-action-bonne', '--sortie', json, '--sans-poses'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Règle « visité sans action = bon » \(visite d'au moins 0\.8 s/);
    assert.match(r.stdout, / 4 cuts comptés à correction nulle/);
    assert.match(r.stdout, /1 déplacés sans validation, 1 trop courts/);
    const doc = JSON.parse(fs.readFileSync(json, 'utf8'));
    assert.equal(doc.options.visiteSansActionBonne, 0.8);
    assert.equal(doc.resume.visiteSansActionBonne.cuts, 4);   // sans journal, 7107 n'est plus « posé » mais compte toujours
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
