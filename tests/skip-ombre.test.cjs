'use strict';
/* CH-016 — SK en ombre : détecteur `src/skip-ombre.js` et outil hors ligne `tools/skip-ombre.cjs`. Données SYNTHÉTIQUES
 * (parties 97 et 98, cuts inventés). Rien du terrain. Ce que l'essai fixe avant le code :
 *   - règle D-172 : « aucun-point » après `min` (2) captures complètes vides de suite ; « un-scanner » seulement si la
 *     capture PORTE l'identifiant de source des points et qu'il n'y en a qu'un ; sinon le nombre de scanners est non mesurable
 *     (null), jamais inventé ;
 *   - le module est pur, déterministe, et n'est importé par aucune chaîne de décision ni par background.js ;
 *   - il ne contient aucune commande ESV, et l'événement qu'il fabrique dit `skipEnvoye:false` ;
 *   - l'outil compte, liste les cuts signalés et, avec des SKIP de l'opérateur vus par l'Écho, donne précision et rappel ;
 *     sans SKIP de l'opérateur, il dit « non mesuré » et ne conclut rien. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const S = require('../src/skip-ombre.js');
const T = require('../tools/skip-ombre.cjs');

const RACINE = path.join(__dirname, '..');
const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');

const capture = (left, right, extra = {}) => ({ quality: { perRail: { left, right } }, ...extra });
const avecSources = (ids, left = 10, right = 10) => capture(left, right, { attributes: { pointSourceId: ids } });

test('aucun-point : seulement après deux captures complètes vides de suite', () => {
  assert.equal(S.detecter([capture(0, 0)]).raison, null, 'une seule capture vide ne suffit pas');
  const d = S.detecter([capture(0, 0), capture(0, 0)]);
  assert.equal(d.raison, 'aucun-point');
  assert.deepEqual(JSON.parse(JSON.stringify(d.points)), { left: 0, right: 0 });
  assert.equal(d.captures, 2); assert.equal(d.capturesVides, 2);
  assert.equal(S.detecter([capture(0, 0), capture(3, 0)]).raison, null, 'la seconde a des points');
  assert.equal(S.detecter([capture(0, 12), capture(0, 12)]).raison, null, 'un rail sans point ne fait pas un cut vide');
  assert.equal(S.detecter(null).raison, null);
  assert.equal(S.detecter([]).raison, null);
});

test('un-scanner : seulement quand la capture porte l\'identifiant de source ET qu\'il n\'y en a qu\'un', () => {
  const un = avecSources([4, 4, 4, 4]);
  const d = S.detecter([un, un]);
  assert.equal(d.raison, 'un-scanner'); assert.equal(d.scannersMesurables, true); assert.equal(d.scanners, 1);
  assert.equal(S.detecter([un]).raison, null, 'une seule capture ne suffit pas');
  assert.equal(S.detecter([avecSources([4, 5, 4]), avecSources([4, 5])]).raison, null, 'deux scanners : on visite');
  const sans = capture(10, 10);
  const n = S.detecter([sans, sans]);
  assert.equal(n.raison, null, 'sans identifiant de source, jamais « un seul scanner »');
  assert.equal(n.scannersMesurables, false); assert.equal(n.scanners, null, 'non mesurable : null, pas 0 ni 1');
  assert.equal(S.detecter([un, sans]).raison, null, 'une capture non mesurable bloque la règle');
});

test('déterminisme et pureté : mêmes entrées, même sortie, entrées intactes', () => {
  const a = avecSources([1, 1, 1]), b = avecSources([1, 1]);
  const avant = JSON.stringify([a, b]);
  const r1 = S.detecter([a, b]), r2 = S.detecter([a, b]);
  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
  assert.equal(JSON.stringify([a, b]), avant, 'les captures ne sont pas modifiées');
  const id = { part: 97, cut: 1, shape: 'U50' };
  assert.equal(JSON.stringify(S.evenement(id, r1)), JSON.stringify(S.evenement(id, r2)));
});

test('l\'événement skip-ombre ne commande rien', () => {
  const e = S.evenement({ part: 97, cut: 1 }, S.detecter([capture(0, 0), capture(0, 0)]));
  assert.equal(e.type, 'skip-ombre'); assert.equal(e.raison, 'aucun-point');
  assert.equal(e.skipEnvoye, false); assert.equal(e.commande, null);
  assert.equal(e.version, S.VERSION);
  assert.equal(S.evenement({ part: 97, cut: 2 }, S.detecter([capture(5, 5)])).raison, null);
});

test('isolation : module non importé par la chaîne de décision ni par background.js ; 0 commande ESV', () => {
  const src = lire('src/skip-ombre.js');
  for (const f of fs.readdirSync(path.join(RACINE, 'src')).filter(n => n.endsWith('.js') && n !== 'skip-ombre.js'))
    assert.ok(!/skip-ombre|SkipOmbre/.test(lire('src/' + f)), `src/${f} ne doit pas importer le détecteur`);
  for (const f of ['background.js', 'manifest.json'])
    assert.ok(!/skip-ombre/.test(lire(f)), `${f} ne doit pas référencer le détecteur`);
  assert.ok(!/require\(/.test(src), 'module pur : aucune dépendance');
  for (const mot of ['skipAndNext', 'sendCommand', 'chrome.', 'fetch(', 'XMLHttpRequest', 'dispatchEvent', 'postMessage'])
    assert.ok(!src.includes(mot), `commande ou E/S interdite dans le module : ${mot}`);
});

/* ---------- outil hors ligne ---------- */
const id = (cut, part = 97) => ({ part, cut, shape: 'U50' });
const rel = (cut, raison, part = 97) => ({ type: 'relecture-ombre', identity: id(cut, part), skipOmbre: { raison, points: { left: 0, right: 0 }, captures: 2, capturesVides: raison ? 2 : 0 } });
const direct = (cut, raison, part = 97) => ({ type: 'skip-ombre', identity: id(cut, part), raison, scannersMesurables: false });
const visite = (cut, etiquette, part = 97) => ({ identity: id(cut, part), observedLabelCandidate: etiquette });
const journal = events => ({ events });

test('outil : comptes et cuts signalés, un cut compté une fois, par partie', () => {
  const j = journal([rel(1, 'aucun-point'), rel(1, 'aucun-point'), rel(2, null), direct(3, 'un-scanner'), rel(4, null), rel(5, 'aucun-point', 98), { type: 'batch-started' }]);
  const r = T.analyser({ journal: j, echo: null });
  assert.equal(r.evalues, 5, 'cuts évalués (partie, cut) distincts');
  assert.equal(r.signales, 3);
  assert.deepEqual(r.parRaison, { 'aucun-point': 2, 'un-scanner': 1 });
  assert.deepEqual(r.cutsSignales.map(c => `${c.part}:${c.cut}:${c.raison}`), ['97:1:aucun-point', '97:3:un-scanner', '98:5:aucun-point']);
  const p97 = T.analyser({ journal: j, echo: null, parties: [97] });
  assert.equal(p97.evalues, 4); assert.equal(p97.signales, 2);
});

test('outil : sans Écho, précision et rappel non mesurés', () => {
  const r = T.analyser({ journal: journal([rel(1, 'aucun-point')]), echo: null });
  assert.equal(r.mesure.etat, 'non-mesure'); assert.equal(r.mesure.precision, null); assert.equal(r.mesure.rappel, null);
  assert.match(T.texte(r), /non mesuré/);
});

test('outil : un Écho sans aucun SKIP de l\'opérateur ne conclut rien', () => {
  const r = T.analyser({ journal: journal([rel(1, 'aucun-point'), rel(2, null)]), echo: { records: [visite(1, 'VALIDATE_NO_MOVEMENT'), visite(2, 'VALIDATE_NO_MOVEMENT')] } });
  assert.equal(r.mesure.etat, 'non-mesure'); assert.equal(r.mesure.skipsOperateur, 0);
  assert.equal(r.mesure.precision, null); assert.equal(r.mesure.rappel, null);
  assert.match(T.texte(r), /aucun SKIP de l'opérateur/);
});

test('outil : précision et rappel contre les SKIP de l\'opérateur vus par l\'Écho', () => {
  const j = journal([rel(1, 'aucun-point'), rel(2, 'aucun-point'), rel(3, 'un-scanner'), rel(4, null), rel(5, null), rel(6, 'aucun-point')]);
  const echo = { records: [
    visite(1, 'SKIP'),                      // signalé, SKIP : vrai positif
    visite(2, 'VALIDATE_CORRECTED_BOTH'),   // signalé, pas SKIP : faux positif
    visite(3, 'SKIP'),                      // signalé, SKIP : vrai positif
    visite(4, 'SKIP'),                      // non signalé, SKIP : manqué
    visite(5, 'VALIDATE_NO_MOVEMENT'),      // non signalé, pas SKIP : vrai négatif
    // cut 6 : jamais vu par l'Écho : hors mesure
  ] };
  const r = T.analyser({ journal: j, echo });
  const m = r.mesure;
  assert.equal(m.etat, 'mesure');
  assert.equal(m.vus, 5, 'seuls les cuts évalués ET vus par l\'Écho entrent dans la mesure');
  assert.equal(m.skipsOperateur, 3); assert.equal(m.vraisPositifs, 2); assert.equal(m.fauxPositifs, 1); assert.equal(m.manques, 1);
  assert.equal(m.precision, 2 / 3); assert.equal(m.rappel, 2 / 3);
  assert.equal(m.signalesHorsEcho, 1);
  assert.ok(/2\/3/.test(T.texte(r)));
});

test('outil : un cut vu plusieurs fois par l\'Écho est SKIP si une visite finit en SKIP', () => {
  const r = T.analyser({ journal: journal([rel(1, 'aucun-point')]), echo: { records: [visite(1, null), visite(1, 'SKIP')] } });
  assert.equal(r.mesure.vraisPositifs, 1);
});

test('outil : arguments et déterminisme', () => {
  assert.throws(() => T.lireArguments([]), /dossier/);
  assert.throws(() => T.lireArguments(['x', '--inconnu']), /inconnu/);
  const j = journal([rel(1, 'aucun-point'), rel(2, null)]);
  assert.equal(JSON.stringify(T.analyser({ journal: j, echo: null })), JSON.stringify(T.analyser({ journal: j, echo: null })));
  const outil = lire('tools/skip-ombre.cjs');
  for (const mot of ['fetch(', 'chrome.', 'sendCommand', 'skipAndNext']) assert.ok(!outil.includes(mot), mot);
});
