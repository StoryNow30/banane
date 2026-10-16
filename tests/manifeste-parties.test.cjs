'use strict';
/* B1 (audit 5.0) : manifeste des parties d'apprentissage et parties réservées.
 *  - le fichier versionné déclare les parties 17, 24 et 29 du projet 1 et la partie 1 du projet 2 en apprentissage ;
 *  - toute autre partie est réservée ;
 *  - les outils de réglage refusent une partie réservée quand ils reçoivent une option de partie, sauf avec
 *    --juger-partie-reservee ;
 *  - aucun identifiant de projet ni nom d'opérateur dans le fichier (les projets sont « projet 1 » et « projet 2 »). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const M = require('../tools/manifeste-parties.cjs');
const racine = path.join(__dirname, '..');
const outil = nom => path.join(racine, 'tools', nom);
const lancer = (nom, args) => cp.spawnSync(process.execPath, [outil(nom), ...args], { encoding: 'utf8' });

test('le manifeste versionné déclare les parties d\'apprentissage et rien d\'autre', () => {
  const m = M.lire();
  assert.equal(m.format, M.FORMAT);
  assert.match(m.date, /^\d{4}-\d{2}-\d{2}$/);
  for (const n of [17, 24, 29]) assert.equal(M.statut(m, 1, n), 'apprentissage', `projet 1, partie ${n}`);
  assert.equal(M.statut(m, 2, 1), 'apprentissage');
  assert.equal(M.statut(m, 1, 1), 'reservee', 'la partie 1 du projet 1 n\'est pas celle du projet 2');
  assert.equal(M.statut(m, 2, 17), 'reservee');
  assert.equal(M.statut(m, 1, 30), 'reservee', 'une partie reçue plus tard est réservée');
  assert.equal(M.statut(m, 3, 17), 'reservee', 'un projet inconnu est réservé');
});

test('le fichier ne nomme ni projet, ni adresse, ni opérateur', () => {
  const texte = fs.readFileSync(path.join(racine, 'datasets', 'manifeste-parties.json'), 'utf8');
  assert.match(texte, /projet 1/); assert.match(texte, /projet 2/);
  assert.ok(!/https?:\/\//i.test(texte));
  assert.ok(!/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(texte), 'pas d\'identifiant');
  assert.ok(!/\bMic\b/.test(texte));
});

test('lecture : un manifeste mal formé est refusé', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manif-'));
  try {
    const ecrire = (nom, o) => { const f = path.join(tmp, nom); fs.writeFileSync(f, typeof o === 'string' ? o : JSON.stringify(o)); return f; };
    assert.throws(() => M.lire(ecrire('a.json', 'pas du json')), /manifeste/);
    assert.throws(() => M.lire(ecrire('b.json', { format: 'autre', date: '2026-10-16', apprentissage: [] })), /format/);
    assert.throws(() => M.lire(ecrire('c.json', { format: M.FORMAT, date: 'hier', apprentissage: [] })), /date/);
    assert.throws(() => M.lire(ecrire('d.json', { format: M.FORMAT, date: '2026-10-16', apprentissage: [{ projet: 1, parties: ['x'] }] })), /partie/);
    assert.throws(() => M.lire(ecrire('e.json', { format: M.FORMAT, date: '2026-10-16', apprentissage: [{ projet: 1, parties: [3] }, { projet: 1, parties: [3] }] })), /deux fois/);
    const bon = M.lire(ecrire('f.json', { format: M.FORMAT, date: '2026-10-16', apprentissage: [{ projet: 1, parties: [3] }] }));
    assert.equal(M.statut(bon, 1, 3), 'apprentissage');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('désignation « projet:partie » : liste, doublons et formes refusées', () => {
  assert.deepEqual(M.lireDesignations('1:17,1:24'), [{ projet: 1, partie: 17 }, { projet: 1, partie: 24 }]);
  assert.deepEqual(M.lireDesignations('2:1'), [{ projet: 2, partie: 1 }]);
  for (const mauvais of ['17', '1:', ':17', '1:x', '0:3', '1:0', '1:17,', '']) assert.throws(() => M.lireDesignations(mauvais), /projet:partie|--partie/, mauvais);
});

test('contrôle : une partie réservée est refusée, sauf avec l\'option explicite, qui la signale', () => {
  const m = M.lire();
  const ok = M.controler(m, [{ projet: 1, partie: 17 }, { projet: 2, partie: 1 }], { outil: 'essai' });
  assert.deepEqual(ok.reservees, []);
  const refus = () => M.controler(m, [{ projet: 1, partie: 17 }, { projet: 1, partie: 31 }], { outil: 'essai' });
  assert.throws(refus, /la partie 31 du projet 1 est réservée/);
  assert.throws(() => M.controler(m, [{ projet: 1, partie: 31 }, { projet: 2, partie: 5 }], { outil: 'essai' }), /les parties 31 du projet 1, 5 du projet 2 sont réservées/);
  assert.throws(refus, /--juger-partie-reservee/);
  const permis = M.controler(m, [{ projet: 1, partie: 17 }, { projet: 1, partie: 31 }], { outil: 'essai', jugerReservee: true });
  assert.deepEqual(permis.reservees, [{ projet: 1, partie: 31 }]);
  assert.match(permis.avis, /partie 31 du projet 1/); assert.match(permis.avis, /aucun réglage/);
  assert.deepEqual(M.controler(m, [], { outil: 'essai' }).reservees, [], 'sans option de partie, rien à contrôler');
});

/* ------------------------------------------------------------------ les trois outils de réglage */
test('memoire-differes construire : une partie réservée est refusée avant toute lecture de fichier', () => {
  const r = lancer('memoire-differes.cjs', ['construire', '--partie', '1:31', '--jeu', 'absent.jsonl', '--jointure', 'absent.json', '--corpus', 'absent.json', '--sortie', 'x.jsonl']);
  assert.equal(r.status, 2); assert.match(r.stderr, /la partie 31 du projet 1 est réservée/);
  const nue = lancer('memoire-differes.cjs', ['construire', '--partie', '17', '--jeu', 'a', '--jointure', 'b', '--corpus', 'c', '--sortie', 'd']);
  assert.equal(nue.status, 2); assert.match(nue.stderr, /projet:partie/);
});

test('memoire-differes construire : l\'option explicite lève le refus (l\'erreur suivante vient du fichier absent)', () => {
  const r = lancer('memoire-differes.cjs', ['construire', '--partie', '1:31', '--juger-partie-reservee', '--jeu', '/inexistant/jeu.jsonl', '--jointure', '/inexistant/j.json', '--corpus', '/inexistant/c.json', '--sortie', '/inexistant/x.jsonl']);
  assert.equal(r.status, 2); assert.match(r.stderr, /ENOENT/); assert.ok(!/est réservée/.test(r.stderr));
  assert.match(r.stderr, /partie 31 du projet 1/, 'l\'avis est donné');
});

test('rejeu-voie-predite : une partie réservée est refusée, une partie d\'apprentissage passe', () => {
  const refus = lancer('rejeu-voie-predite.cjs', ['--partie', '2:9', '--corpus', 'x', '--journal', 'y', '--jointure', 'z']);
  assert.notEqual(refus.status, 0); assert.match(refus.stderr, /la partie 9 du projet 2 est réservée/);
  const passe = lancer('rejeu-voie-predite.cjs', ['--partie', '1:29', '--essai']);
  assert.equal(passe.status, 0, passe.stderr);
  const libre = lancer('rejeu-voie-predite.cjs', ['--partie', '2:9', '--juger-partie-reservee', '--essai']);
  assert.equal(libre.status, 0, libre.stderr); assert.match(libre.stderr, /partie 9 du projet 2/);
});

test('apprentissage-g0 : une partie réservée est refusée, l\'option explicite la laisse passer en le disant', () => {
  const refus = lancer('apprentissage-g0.cjs', ['--partie', '1:17,1:40', '--jeu', 'absent.jsonl']);
  assert.equal(refus.status, 2); assert.match(refus.stderr, /la partie 40 du projet 1 est réservée/);
  const libre = lancer('apprentissage-g0.cjs', ['--partie', '1:40', '--juger-partie-reservee', '--jeu', '/inexistant/a.jsonl']);
  assert.equal(libre.status, 2); assert.match(libre.stderr, /ENOENT/); assert.ok(!/est réservée/.test(libre.stderr));
  const aide = lancer('apprentissage-g0.cjs', ['--aide']);
  assert.match(aide.stdout, /--partie/); assert.match(aide.stdout, /--juger-partie-reservee/);
});
