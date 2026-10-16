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
