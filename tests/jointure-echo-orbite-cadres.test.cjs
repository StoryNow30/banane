'use strict';
/* Jointure Écho ↔ Orbite, audit 5.0 (I2, I3 (a), U5), sur données SYNTHÉTIQUES (tests/helpers/jointure-synthetique.cjs,
 * parties 94 à 96, cuts et coordonnées inventés) :
 *  - I2 : translation de scène estimée PAR CADRE DE SCÈNE (pageId, frameId), le lot ayant changé de page en cours de route ;
 *  - I3 (a) : la règle « visité sans action = bon » refusée pour une visite ouverte moins de 60 s après un rechargement de la
 *    page (`native-page-lost`) et pour une visite dont les captures sont vides (`read-complete-empty`) ; comptes publiés avec
 *    et sans la règle ;
 *  - U5 : deux sessions Écho dont les intervalles de temps se recouvrent sont signalées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const J = require('../tools/jointure-echo-orbite.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const proche = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const ligne = (table, cut) => table.find(l => l.cut === cut);
const m = (minutes, secondes = 0) => ({ minutes, secondes });
const OUTIL = path.join(__dirname, '..', 'tools', 'jointure-echo-orbite.cjs');
const G0 = [100, 200, 10], D0 = [101.42, 200, 10];
const avancer = (pos, k) => S.decaler(pos, 0.6 * k);                 // un cut tous les 0,6 m le long de la voie
const moinsT = (pos, T) => pos.map((x, i) => x - T[i]);

/* Écrit les exports dans un dossier temporaire, les relit comme la ligne de commande, joint. */
function joindreExports(exports, jr, options = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-cadres-'));
  try {
    exports.forEach((doc, i) => S.ecrire(d, `ariane-echo-2031-05-01T1${i}-00-00-seg01.json`, doc));
    const echo = J.lireEcho([d]);
    return { echo, ...J.joindre(echo.records, jr, { sessions: echo.sessions, pagesPerdues: echo.pagesPerdues, capturesParVisite: echo.capturesParVisite, ...options }) };
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

/* ---------------------------------------------------------------------------------------------------------------
 * I2. Partie 94 : le lot Orbite a posé les cuts 8001 à 8004 sur la page A, puis, après un rechargement d'ESV, les cuts
 * 8005 à 8008 sur la page B. L'origine de scène du journal change avec la page : la translation Écho − journal vaut T_A
 * pour les premiers, T_B (65 m plus loin) pour les seconds. L'Écho de l'opérateur voit tout dans un seul cadre. */
const PAGE_A = { pageId: 'page-a', frameId: 'frame-a' }, PAGE_B = { pageId: 'page-b', frameId: 'frame-b' }, PAGE_E = { pageId: 'page-e', frameId: 'frame-e' };
const T_A = [1000, 2000, 30], T_B = [1065, 2003, 31];
const CUTS_A = [8001, 8002, 8003, 8004], CUTS_B = [8005, 8006, 8007, 8008];
function lotDeuxPages({ cadreEcho = PAGE_E, sansRailsEcho = [] } = {}) {
  const poses = [], records = [];
  [...CUTS_A, ...CUTS_B].forEach((cut, k) => {
    const g = avancer(G0, k), d = avancer(D0, k), T = CUTS_A.includes(cut) ? T_A : T_B;
    poses.push({ cut, partie: 94, gauche: moinsT(g, T), droit: moinsT(d, T), cadre: CUTS_A.includes(cut) ? PAGE_A : PAGE_B });
    /* Corrections de l'opérateur : 3 mm latéral sur 8002, 12 mm vertical sur 8006 ; les autres validés tels quels. */
    const valide = cut === 8002 ? [S.decaler(g, 0, 0.003), d] : cut === 8006 ? [g, S.decaler(d, 0, 0, 0.012)] : [g, d];
    const r = S.visite({ session: 'sess-e', index: k, cut, partie: 94, debut: m(k + 1), fin: m(k + 1, 20), initiale: [g, d], validation: valide, cadre: cadreEcho });
    if (sansRailsEcho.includes(cut)) { r.initialObserved = { ...r.initialObserved, rails: {} }; r.firstObserved = { ...r.firstObserved, rails: {} }; }
    records.push(r);
  });
  return { exports: [S.exportEcho({ session: 'sess-e', debutSession: m(0), stamp: '2031-05-01T10-00-00', records })], jr: S.journal(poses) };
}

test('I2 : deux cadres de scène au journal, une translation par cadre, aucun cut en repli', () => {
  const { exports, jr } = lotDeuxPages();
  const { table, resume } = joindreExports(exports, jr, { partie: 94 });
  for (const cut of [...CUTS_A, ...CUTS_B]) {
    assert.equal(ligne(table, cut).base, 'ariane', `cut ${cut}`);
    proche(ligne(table, cut).controleRepereMm, 0, 0.001);
  }
  assert.equal(resume.repereScene.calibre, true);
  assert.equal(resume.repereScene.cadres, 2);
  assert.equal(resume.repereScene.translationsDistinctes, 2);
  assert.equal(resume.repereScene.paires, 16);
  proche(resume.repereScene.residuP90Mm, 0, 0.001);
  assert.deepEqual(resume.repereScene.parCadre.map(c => [c.rang, c.paires, c.residuP90Mm]), [[1, 8, 0], [2, 8, 0]]);
  assert.deepEqual(resume.bases, { ariane: 8 });
  proche(ligne(table, 8002).ecartHumain.gauche.lateralMm, 3);
  proche(ligne(table, 8006).ecartHumain.droite.verticalMm, 12);
  assert.equal(resume.parClasse.posee.corrections.sup10mm.cuts, 1);
  /* La ligne dit dans quel cadre la translation a été prise (rang, jamais d'identifiant). */
  assert.equal(ligne(table, 8001).cadreScene, 1);
  assert.equal(ligne(table, 8008).cadreScene, 2);
});

test('I2 : un seul cadre, une seule translation ; la table ne change pas de forme', () => {
  const unCadre = () => {
    const poses = [], records = [];
    [8001, 8002, 8003].forEach((cut, k) => {
      const g = avancer(G0, k), d = avancer(D0, k);
      poses.push({ cut, partie: 94, gauche: moinsT(g, T_A), droit: moinsT(d, T_A) });
      records.push(S.visite({ session: 'sess-e', index: k, cut, partie: 94, debut: m(k + 1), fin: m(k + 1, 20), initiale: [g, d], validation: [g, S.decaler(d, 0, 0.004)] }));
    });
    return joindreExports([S.exportEcho({ session: 'sess-e', debutSession: m(0), stamp: '2031-05-01T10-00-00', records })], S.journal(poses), { partie: 94 });
  };
  const { table, resume } = unCadre();
  assert.equal(resume.repereScene.cadres, 1);
  assert.equal(resume.repereScene.paires, 6);
  for (const l of table) { assert.equal(l.base, 'ariane'); assert.equal('cadreScene' in l, false); proche(l.ecartHumain.droite.lateralMm, 4); }
  assert.match(J.texte(resume), /Repère de scène : translation constante Écho − journal estimée sur 6 rails ; résidu médian 0\.0 mm, P90 0\.0 mm\./);
});

test('I2 : plusieurs cadres de même translation (rechargement sans changement d\'origine) : la table garde la forme d\'avant', () => {
  /* L'Écho a deux sessions (deux pages) mais l'origine de scène n'a pas bougé : une seule translation distincte. */
  const poses = [], records = [];
  [8001, 8002, 8003, 8004].forEach((cut, k) => {
    const g = avancer(G0, k), d = avancer(D0, k);
    poses.push({ cut, partie: 94, gauche: moinsT(g, T_A), droit: moinsT(d, T_A) });
    records.push(S.visite({ session: k < 2 ? 'sess-1' : 'sess-2', index: k % 2, cut, partie: 94, debut: m(k * 30 + 1), fin: m(k * 30 + 1, 20), initiale: [g, d], validation: [g, d], cadre: k < 2 ? PAGE_A : PAGE_B }));
  });
  const { table, resume } = joindreExports([S.exportEcho({ session: 'sess-1', debutSession: m(0), stamp: '2031-05-01T10-00-00', records: records.slice(0, 2) }),
    S.exportEcho({ session: 'sess-2', debutSession: m(50), stamp: '2031-05-01T11-00-00', records: records.slice(2) })], S.journal(poses), { partie: 94 });
  assert.equal(resume.repereScene.cadres, 2);
  assert.equal(resume.repereScene.translationsDistinctes, 1);
  for (const l of table) { assert.equal(l.base, 'ariane'); assert.equal('cadreScene' in l, false); }
});

test('I2 : un cadre sans aucun rail pour estimer sa translation retombe sur la première visite, et le dit', () => {
  /* 8005 à 8008 (page B) : l'Écho n'a pas de pose initiale à rails, la translation de la page B est inconnue. */
  const { exports, jr } = lotDeuxPages({ sansRailsEcho: CUTS_B });
  const { table, resume } = joindreExports(exports, jr, { partie: 94 });
  for (const cut of CUTS_A) assert.equal(ligne(table, cut).base, 'ariane');
  for (const cut of CUTS_B) assert.equal(ligne(table, cut).base, 'premiere-visite (cadre-non-calibre)', `cut ${cut}`);
  assert.equal(resume.repereScene.cadres, 1);
  assert.equal(resume.repereScene.cadresNonCalibres, 1);
});

test('I2 : le résumé lisible donne la translation par cadre', () => {
  const { exports, jr } = lotDeuxPages();
  const { resume } = joindreExports(exports, jr, { partie: 94 });
  const t = J.texte(resume);
  assert.match(t, /Repère de scène : translation Écho − journal estimée par cadre de scène \(2 cadres, 2 translations distinctes\) sur 16 rails ; résidu médian 0\.0 mm, P90 0\.0 mm\./);
  assert.match(t, /cadre 1 : 8 rails, P90 0\.0 mm ; cadre 2 : 8 rails, P90 0\.0 mm/);
});

/* ---------------------------------------------------------------------------------------------------------------
 * I3 (a). Partie 95. Session sess-p : la page ESV est rechargée à 10 min (`native-page-lost`). Cuts :
 *  - 8101 : regardé 30 s, ouvert 20 s après le rechargement → refusé (après page perdue) ;
 *  - 8102 : regardé 5 s, ouvert 90 s après → règle appliquée ;
 *  - 8103 : regardé 5 s, sa seule capture est vide (`read-complete-empty`) → refusé (captures vides) ;
 *  - 8104 : regardé 5 s, une capture vide et une capture avec des points → règle appliquée ;
 *  - 8105 : une visite de 30 s juste après le rechargement, puis une de 2 s plus tard → appliquée sur la seconde ;
 *  - 8106 : 0,5 s, juste après le rechargement → trop court (comme avant) ;
 *  - 8107 : posé par Ariane, regardé 5 s, capture vide → refusé ;
 *  - 8108 : posé par Ariane, corrigé de 12 mm (validation observée) ;
 *  - 8109 : posé par Ariane, regardé 5 s, capture avec des points → règle appliquée ;
 *  - 8110 : sess-p, regardé 5 s à 30 min 10 s ; la page de l'AUTRE session (sess-q) a été rechargée à 30 min → appliquée.
 * Session sess-q : 8111, regardé 5 s, ouvert 20 s après le rechargement de sa propre page → refusé. */
function echoPagePerdue() {
  const v = (session, index, cut, debut, fin, extra = {}) => S.visite({ session, index, cut, partie: 95, debut, fin, initiale: [G0, D0], ...extra });
  const p = [
    v('sess-p', 0, 8103, m(2), m(2, 5)),
    v('sess-p', 1, 8104, m(3), m(3, 5)),
    v('sess-p', 2, 8107, m(4), m(4, 5)),
    v('sess-p', 3, 8108, m(5), m(5, 20), { derniere: [S.decaler(G0, 0, 0, 0.012), D0], validation: [S.decaler(G0, 0, 0, 0.012), D0] }),
    v('sess-p', 4, 8109, m(6), m(6, 5)),
    v('sess-p', 5, 8105, m(10, 5), m(10, 35)),
    v('sess-p', 6, 8101, m(10, 20), m(10, 50)),
    v('sess-p', 7, 8106, m(10, 52), m(10, 52.5)),
    v('sess-p', 8, 8102, m(11, 30), m(11, 35)),
    v('sess-p', 9, 8105, m(20), m(20, 2)),
    v('sess-p', 10, 8110, m(30, 10), m(30, 15)),
  ];
  const vid = cut => p.find(r => r.identity.cut === cut).visitId;
  const evP = [
    S.pagePerdue({ session: 'sess-p', a: m(10) }),
    S.captureFaite({ session: 'sess-p', visitId: vid(8103), statut: 'read-complete-empty' }),
    S.captureFaite({ session: 'sess-p', visitId: vid(8104), statut: 'read-complete-empty' }),
    S.captureFaite({ session: 'sess-p', visitId: vid(8104), statut: 'partial-resource-limit', n: 1 }),
    S.captureFaite({ session: 'sess-p', visitId: vid(8107), statut: 'read-complete-empty' }),
    S.captureFaite({ session: 'sess-p', visitId: vid(8109), statut: 'complete-loaded-buffers' }),
  ];
  const q = [v('sess-q', 0, 8111, m(30, 20), m(30, 25))];
  return [
    S.exportEcho({ session: 'sess-p', debutSession: m(0), stamp: '2031-05-01T10-00-00', records: p, events: evP }),
    S.exportEcho({ session: 'sess-q', debutSession: m(29), stamp: '2031-05-01T11-00-00', records: q, events: [S.pagePerdue({ session: 'sess-q', a: m(30) })] }),
  ];
}
const jrPagePerdue = () => S.journal([8107, 8108, 8109].map(cut => ({ cut, partie: 95, gauche: G0, droit: D0 })));
const regle = (options = {}) => joindreExports(echoPagePerdue(), jrPagePerdue(), { partie: 95, visiteSansActionBonne: 0.8, ...options });

test('lecture : les rechargements de page et les statuts de capture de l\'Écho sont lus avec les records', () => {
  const { echo } = regle();
  assert.deepEqual(echo.pagesPerdues.map(p => [p.session, p.at]), [['sess-p', S.horodatage(10)], ['sess-q', S.horodatage(30)]]);
  const vid = echo.records.find(r => r.identity.cut === 8104).visitId;
  assert.deepEqual(echo.capturesParVisite[vid], ['read-complete-empty', 'partial-resource-limit']);
});

test('I3 (a) : visite ouverte moins de 60 s après un rechargement de page, ou aux captures vides : règle refusée', () => {
  assert.equal(J.DELAI_APRES_PAGE_PERDUE_S, 60);
  const { table, resume } = regle();
  const rg = resume.visiteSansActionBonne;
  assert.deepEqual(rg.refus, { 'deplace-sans-validation': 0, 'trop-court': 1, 'sans-mesure': 0, 'hors-cut': 0, 'apres-page-perdue': 2, 'captures-vides': 2 });
  assert.equal(rg.cuts, 5);
  assert.deepEqual(rg.parClasse, { 'hors-journal': 4, posee: 1 });
  for (const cut of [8102, 8104, 8105, 8109, 8110]) assert.equal(ligne(table, cut).regleVisiteBon, true, `cut ${cut}`);
  const raison = cut => ligne(table, cut).visiteSansAction.raison;
  assert.equal(raison(8101), 'apres-page-perdue');
  assert.equal(raison(8111), 'apres-page-perdue');
  assert.equal(raison(8103), 'captures-vides');
  assert.equal(raison(8107), 'captures-vides');
  assert.equal(raison(8106), 'trop-court');
  for (const cut of [8101, 8103, 8106, 8107, 8111]) assert.equal(ligne(table, cut).referenceHumaine, 'sans-reference', `cut ${cut}`);
  /* 8105 : la visite de 30 s est écartée, la règle tient sur la visite de 2 s. */
  const v5 = ligne(table, 8105).visiteSansAction;
  assert.equal(v5.dwellMaxS, 2);
  assert.equal(v5.dwellMaxToutesS, 30);
  assert.deepEqual(v5.visitesEcartees, { apresPagePerdue: 1, capturesVides: 0 });
  assert.deepEqual(ligne(table, 8101).visiteSansAction.visitesEcartees, { apresPagePerdue: 1, capturesVides: 0 });
  /* Une visite sans visite écartée garde la forme d'avant. */
  assert.equal('visitesEcartees' in ligne(table, 8102).visiteSansAction, false);
  assert.equal('dwellMaxToutesS' in ligne(table, 8102).visiteSansAction, false);
});

test('I3 (a) : sans les événements de l\'Écho (anciens appels), la règle se comporte comme avant', () => {
  const { table, resume } = regle({ pagesPerdues: undefined, capturesParVisite: undefined });
  assert.equal(resume.visiteSansActionBonne.cuts, 9);
  assert.equal(ligne(table, 8101).regleVisiteBon, true);
});

test('I3 (b) : les deux comptes, avec et sans la règle, sont publiés par classe et dans le résumé lisible', () => {
  const { resume } = regle();
  const p = resume.parClasse.posee;
  assert.equal(p.avecReference, 2);                 // 8108 (validé) et 8109 (règle)
  assert.equal(p.corrections.sup10mm.cuts, 1);
  assert.deepEqual(p.sansLaRegle, { avecReference: 1, sup5mm: 1, sup10mm: 1 });
  assert.deepEqual(resume.parClasse['hors-journal'].sansLaRegle, { avecReference: 0, sup5mm: 0, sup10mm: 0 });
  const t = J.texte(resume);
  assert.match(t, /restent sans référence : .*2 ouverts moins de 60 s après un rechargement de page, 2 aux captures vides/);
  assert.match(t, /> 10 mm : avec la règle 1 cut sur 2 avec référence, sans la règle 1 sur 1/);
  /* Sans la règle, rien de tout cela. */
  const sans = joindreExports(echoPagePerdue(), jrPagePerdue(), { partie: 95 }).resume;
  assert.equal(sans.parClasse.posee.sansLaRegle, undefined);
});

/* ---------------------------------------------------------------------------------------------------------------
 * U5. Partie 96 : deux sessions Écho (deux fenêtres) dont les intervalles se recouvrent ; puis deux sessions séquentielles. */
function deuxSessions(decalageMin) {
  const v = (session, index, cut, debut, fin) => S.visite({ session, index, cut, partie: 96, debut, fin, initiale: [G0, D0], validation: [G0, D0] });
  return [
    S.exportEcho({ session: 'sess-1', debutSession: m(0), stamp: '2031-05-01T10-00-00', records: [v('sess-1', 0, 8201, m(1), m(1, 30)), v('sess-1', 1, 8202, m(10), m(12))] }),
    S.exportEcho({ session: 'sess-2', debutSession: m(decalageMin), stamp: '2031-05-01T11-00-00',
      records: [v('sess-2', 0, 8203, m(decalageMin + 1), m(decalageMin + 1, 30)), v('sess-2', 1, 8204, m(decalageMin + 5), m(decalageMin + 6))] }),
  ];
}
test('U5 : deux sessions qui se chevauchent dans le temps sont signalées', () => {
  const { resume } = joindreExports(deuxSessions(5), { events: [], records: [] }, { sansJournal: true, partie: 96 });
  assert.equal(resume.sessionsChevauchantes.length, 1);
  const c = resume.sessionsChevauchantes[0];
  assert.deepEqual(c.sessions, [1, 2]);
  proche(c.chevauchementS, 5 * 60);                 // de 6 min à 11 min
  assert.match(J.texte(resume), /Attention : sessions Écho qui se chevauchent dans le temps : 1 et 2 \(300 s en commun\)/);
});
test('U5 : deux sessions séquentielles ne sont pas signalées', () => {
  const { resume } = joindreExports(deuxSessions(30), { events: [], records: [] }, { sansJournal: true, partie: 96 });
  assert.deepEqual(resume.sessionsChevauchantes, []);
  assert.doesNotMatch(J.texte(resume), /se chevauchent/);
});

test('ligne de commande : rechargements de page lus depuis les fichiers, résumé avec les deux comptes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-cadres-cli-'));
  try {
    echoPagePerdue().forEach((doc, i) => S.ecrire(tmp, `ariane-echo-2031-05-01T1${i}-00-00-seg01.json`, doc));
    const jr = path.join(tmp, 'ariane-journal-v4-synthetique.json');
    fs.writeFileSync(jr, JSON.stringify(jrPagePerdue()));
    const r = cp.spawnSync(process.execPath, [OUTIL, '--echo', tmp, '--journal', jr, '--partie', '95', '--visite-sans-action-bonne', '--sans-poses'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, / 5 cuts comptés à correction nulle/);
    assert.match(r.stdout, /2 ouverts moins de 60 s après un rechargement de page, 2 aux captures vides/);
    assert.match(r.stdout, /sans la règle 1 sur 1/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
