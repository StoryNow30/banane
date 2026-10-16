'use strict';
/* Jointure Écho ↔ Orbite : plusieurs sessions Écho et exports nommés `ariane-echo-*`, sur données SYNTHÉTIQUES
 * (tests/helpers/jointure-synthetique.cjs). `visitIndex` repart de 0 dans chaque session : la clé de visite est
 * (session, visitIndex), l'ordre des visites est celui du temps, la référence humaine est la dernière validation
 * toutes sessions confondues. Les cas de visites sont choisis pour qu'un tri sur `visitIndex` seul donne un autre
 * résultat (la seconde session a des index plus petits que la première). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const J = require('../tools/jointure-echo-orbite.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const proche = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const ligne = (table, cut) => table.find(l => l.cut === cut);
const G0 = [100, 200, 10], D0 = [101.42, 200, 10];                    // pose présentée par ESV (mètres)
const m = (minutes, secondes = 0) => ({ minutes, secondes });
const T = { s1: m(0), s2: m(30) };

/* Session 1 (08:00-08:20), session 2 (08:30-08:50), index de visite : 3 à 6 dans la première, 0 à 4 dans la seconde. */
function sessions() {
  const lat4 = [S.decaler(G0, 0, 0.004), D0], vert3 = [S.decaler(G0, 0, 0.004, 0.003), D0];
  const s1 = [
    // 5001 : corrigé de 4 mm en session 1, revu sans changement en session 2.
    S.visite({ session: 'sess-a', index: 3, cut: 5001, debut: m(5), fin: m(5, 20), initiale: [G0, D0], derniere: lat4, validation: lat4 }),
    // 5002 : validé en session 1, puis revalidé 3 mm plus haut en session 2.
    S.visite({ session: 'sess-a', index: 4, cut: 5002, debut: m(6), fin: m(6, 20), initiale: [G0, D0], derniere: lat4, validation: lat4 }),
    // 5003 : validé en session 1, revu sans validation en session 2.
    S.visite({ session: 'sess-a', index: 5, cut: 5003, debut: m(7), fin: m(7, 20), initiale: [G0, D0], derniere: lat4, validation: lat4 }),
    // 5005 : posé par Ariane (journal), corrigé de 2 mm en session 1.
    S.visite({ session: 'sess-a', index: 6, cut: 5005, debut: m(8), fin: m(8, 20), initiale: [G0, D0], derniere: [S.decaler(G0, 0.002), D0], validation: [S.decaler(G0, 0.002), D0] }),
  ];
  const s2 = [
    S.visite({ session: 'sess-b', index: 0, cut: 5001, debut: m(40), fin: m(40, 10), initiale: lat4, validation: lat4, etiquette: 'VALIDATE_NO_MOVEMENT' }),
    S.visite({ session: 'sess-b', index: 1, cut: 5002, debut: m(41), fin: m(41, 10), initiale: lat4, derniere: vert3, validation: vert3 }),
    S.visite({ session: 'sess-b', index: 2, cut: 5003, debut: m(42), fin: m(42, 10), initiale: lat4 }),
    S.visite({ session: 'sess-b', index: 3, cut: 5004, debut: m(43), fin: m(43, 10), initiale: [G0, D0], derniere: lat4, validation: lat4 }),
    S.visite({ session: 'sess-b', index: 4, cut: 5005, debut: m(44), fin: m(44, 10), initiale: [S.decaler(G0, 0.002), D0] }),
  ];
  return [S.exportEcho({ session: 'sess-a', debutSession: T.s1, stamp: '2031-05-01T08-20-00', records: s1 }),
    S.exportEcho({ session: 'sess-b', debutSession: T.s2, stamp: '2031-05-01T08-50-00', records: s2 })];
}
/* Le journal est dans une autre scène que l'Écho (translation constante) ; 5005 y est posé là où ESV l'a présenté. */
const SCENE = [1000, 2000, 30];
const journalSynthetique = () => S.journal([{ cut: 5005, gauche: G0.map((v, i) => v - SCENE[i]), droit: D0.map((v, i) => v - SCENE[i]) }]);
const joindre = (docs, options = {}) => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-sessions-'));
  try {
    docs.forEach((d, i) => S.ecrire(dossier, `ariane-echo-2031-05-01T08-${i}0-00-seg01.json`, d));
    const echo = J.lireEcho([dossier]);
    return { echo, ...J.joindre(echo.records, options.journal || journalSynthetique(), { partie: 90, sessions: echo.sessions, ...options }) };
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
};

test('sessions : lues, rangées dans l\'ordre du temps, chaque record garde la sienne', () => {
  const { echo } = joindre(sessions());
  assert.deepEqual(echo.sessions.map(s => [s.id, s.rang]), [['sess-a', 0], ['sess-b', 1]]);
  assert.equal(echo.records.length, 9);
  assert.equal(echo.records.filter(r => r.nativeSessionId === 'sess-b').length, 5);
  assert.equal(echo.segments.length, 2);
});

test('deux sessions : la première visite est la plus ancienne dans le temps, pas celle de plus petit visitIndex', () => {
  const { table, resume } = joindre(sessions());
  const l = ligne(table, 5001);
  assert.equal(l.visitesEcho, 2);
  assert.equal(l.base, 'premiere-visite');
  /* Écart de 4 mm latéral, mesuré à la pose présentée avant la correction (session 1). Rangées par visitIndex, la
   * visite de la session 2 (index 0, déjà corrigée) passait la première et l'écart tombait à 0. */
  proche(l.ecartHumain.gauche.lateralMm, 4);
  proche(l.ecartHumain.maxDist3dMm, 4);
  assert.equal(resume.cutsVusDansPlusieursSessions, 4);
});

test('deux sessions : la référence est la dernière validation dans le temps, toutes sessions confondues', () => {
  const { table } = joindre(sessions());
  const l = ligne(table, 5002);
  assert.equal(l.visiteReference, 2);
  proche(l.ecartHumain.gauche.lateralMm, 4); proche(l.ecartHumain.gauche.verticalMm, 3);
  proche(l.ecartHumain.gauche.dist3dMm, 5);
  /* Revu ensuite sans validation : la validation de la session 1 reste la référence (rang 1 sur 2 visites). */
  const t = ligne(table, 5003);
  assert.equal(t.visitesEcho, 2);
  assert.equal(t.visiteReference, 1);
  proche(t.ecartHumain.gauche.dist3dMm, 4);
});

test('deux sessions : un cut vu dans une seule session ne change pas ; un cut posé garde la pose d\'Ariane pour base', () => {
  const { table, resume } = joindre(sessions());
  const seul = ligne(table, 5004);
  assert.equal(seul.visitesEcho, 1);
  proche(seul.ecartHumain.gauche.lateralMm, 4);
  const pose = ligne(table, 5005);
  assert.equal(pose.classe, 'posee');
  assert.equal(pose.base, 'ariane');
  assert.equal(pose.visiteReference, 1);
  proche(pose.ecartHumain.gauche.longitudinalMm, 2);
  assert.ok(resume.repereScene.calibre);
});

test('sans identifiant de record : (session, visitIndex) distingue deux visites 0, et réunit un même vidage relu', () => {
  const v = (session, minutes, validation) => S.visite({ session, index: 0, cut: 5101, debut: m(minutes), fin: m(minutes, 5), initiale: [G0, D0], validation, sansId: true });
  const corrige = [S.decaler(G0, 0, 0.006), D0];
  const docs = [
    S.exportEcho({ session: 'sess-a', debutSession: m(0), stamp: '2031-05-01T08-10-00', index: 1, records: [v('sess-a', 1)] }),
    S.exportEcho({ session: 'sess-a', debutSession: m(0), stamp: '2031-05-01T08-15-00', index: 2, records: [v('sess-a', 1, corrige)] }),
    S.exportEcho({ session: 'sess-b', debutSession: m(30), stamp: '2031-05-01T08-40-00', index: 1, records: [v('sess-b', 31)] }),
  ];
  const { echo, table } = joindre(docs);
  assert.equal(echo.records.length, 2);
  const l = ligne(table, 5101);
  assert.equal(l.visitesEcho, 2);
  /* Le vidage le plus récent de la session 1 l'emporte (il porte la validation). */
  assert.equal(l.visiteReference, 1);
  proche(l.ecartHumain.gauche.lateralMm, 6);
});

test('mode dossier : les exports `ariane-echo-*` sont lus, comme `ariane-native-v4-*` et `banane-native-v4-*`', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-dossier-'));
  try {
    const [a, b] = sessions();
    S.ecrire(dossier, 'ariane-echo-2031-05-01T08-20-00-seg01.json', a);
    S.ecrire(dossier, 'ariane-native-v4-2031-05-01T08-50-00-seg01.json', b);
    S.ecrire(dossier, 'banane-native-v4-2031-05-01T08-55-00-seg01.json', S.exportEcho({ session: 'sess-c', debutSession: m(55), stamp: '2031-05-01T08-55-00', records: [S.visite({ session: 'sess-c', index: 0, cut: 5201, debut: m(56), initiale: [G0, D0] })] }));
    S.ecrire(dossier, 'autre.json', { format: 'autre' });
    S.ecrire(dossier, 'ariane-journal-v4-1.json', { events: [], records: [] });
    const echo = J.lireEcho([dossier]);
    assert.deepEqual(echo.sessions.map(s => s.id), ['sess-a', 'sess-b', 'sess-c']);
    assert.equal(echo.segments.length, 3);
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
  const vide = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-vide-'));
  try {
    S.ecrire(vide, 'ariane-journal-v4-1.json', { events: [], records: [] });
    assert.throws(() => J.lireEcho([vide]), /Aucun export Écho \(ariane-echo-\*/);
  } finally { fs.rmSync(vide, { recursive: true, force: true }); }
});

test('ligne de commande : le résumé dit le nombre de sessions et de cuts vus dans plusieurs sessions', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-cli-'));
  try {
    const [a, b] = sessions();
    S.ecrire(dossier, 'ariane-echo-2031-05-01T08-20-00-seg01.json', a);
    S.ecrire(dossier, 'ariane-echo-2031-05-01T08-50-00-seg01.json', b);
    const jf = S.ecrire(dossier, 'journal.json', journalSynthetique());
    const lignes = [];
    const doc = J.executer(['--echo', dossier, '--journal', jf, '--partie', '90'], l => lignes.push(l));
    assert.match(lignes.join('\n'), /2 session\(s\)/);
    assert.match(lignes.join('\n'), /Cuts vus dans plusieurs sessions Écho : 4/);
    assert.equal(doc.resume.sources.sessionsEcho, 2);
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});
