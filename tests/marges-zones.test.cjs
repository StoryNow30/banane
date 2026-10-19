'use strict';
/* Marges de zone (RM-2) : essai hors ligne sur une partie inventée (aucune donnée de terrain) — zones, marges, ajustement, validation croisée,
 * proposition à part, zones notées par Mic, refus des témoins. Rien de ce fichier ne lit le disque de données. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const Z = require('../tools/marges-zones.cjs');
const root = path.resolve(__dirname, '..');

const s = Z.essai(), parties = [s, { ...s, designation: '9:2' }];
const ps = parties.map(x => Z.preparer(x));

test('livré : les marges de départ sont celles de l\'extension et de la relecture autonome', () => {
  const L = Z.LIVRE;
  assert.deepEqual([L.pn.avant, L.pn.apres, L.adv.avant, L.adv.apres, L.adv.trou, L.liste.marge, L.adv.ignorePN], [4, 6, 30, 30, 10, 0, -1]);
  assert.equal(L.adv.gap, 0);
  assert.equal(L.pn.seule, false);
});

test('zones : le PN et l\'ADV de la partie inventée sont retrouvés avec leurs marges', () => {
  const p = ps[0], T = Z.construireTable(p, Z.LIVRE);
  assert.deepEqual(p.pnBrutes, [[50, 56]]);
  assert.deepEqual(T.zonesPN.map(z => z.controle), [[46, 62]], 'PN : 4 cuts avant, 6 après');
  assert.deepEqual(T.zonesADV, [[120, 181]], 'ADV : 30 cuts avant la première alerte, 30 après la dernière');
  assert.deepEqual(p.alertes, [150, 151, 250]);
});

test('zones : alerte seule, cœur seul et chaînage ne jouent que si on le demande', () => {
  const p = ps[0], Q = k => Z.avec(Z.LIVRE, k);
  assert.deepEqual(Z.construireTable(p, Q({ 'adv.seule': true })).zonesADV, [[120, 181], [220, 280]]);
  assert.equal(Z.construireTable(p, Q({ 'pn.seule': true })).zonesPN.length, 2, 'le cœur isolé du cut 90 ouvre une zone');
  assert.deepEqual(Z.construireTable(p, Q({ 'adv.seule': true, 'adv.gap': 20 })).zonesADV, [[120, 181], [220, 280]], 'écart de 38 cuts entre les deux plages : 20 ne suffit pas');
  assert.deepEqual(Z.construireTable(p, Q({ 'adv.seule': true, 'adv.gap': 40 })).zonesADV, [[120, 280]], '40 relie les deux plages');
  assert.deepEqual(Z.construireTable(p, Q({ 'adv.seule': true, 'adv.apres': 40 })).zonesADV, [[120, 191], [220, 290]], 'sans chaînage, des marges qui ne se touchent pas restent deux plages');
  assert.deepEqual(Z.construireTable(p, Q({ 'adv.trou': 90, 'adv.seule': true })).zonesADV.length, 2, 'l\'alerte 250 est à 99 cuts de la zone : 90 ne la rejoint pas');
});

test('alertes ignorées près d\'un PN : seulement à la demande, jamais par défaut', () => {
  /* Une alerte à 10 cuts après le PN du cut 50–56 (zone de PN 46–62) s'ajoute aux alertes 150 et 151 : avec -1 elle ouvre une zone, avec 20 elle est ignorée. */
  const p = { ...ps[0], alertes: [66, 67, 150, 151] };
  assert.equal(Z.construireTable(p, Z.LIVRE).zonesADV.length, 2);
  assert.deepEqual(Z.construireTable(p, Z.avec(Z.LIVRE, { 'adv.ignorePN': 20 })).zonesADV, [[120, 181]]);
  assert.deepEqual(Z.construireTable(p, Z.avec(Z.LIVRE, { 'adv.ignorePN': 0 })).zonesADV.length, 2, 'à 0 : seules les alertes dans la zone de PN sont ignorées');
});

test('évaluation : le livré manque 3 grosses corrections sur 4, les cuts à relire se comptent sans les rouges', () => {
  const r = Z.evaluer(ps[0], Z.LIVRE);
  assert.equal(r.grosses, 4);
  assert.deepEqual(r.hors, [91, 110, 242]);
  assert.equal(r.cuts, r.verts + r.revisites);
});

test('ajustement : les marges ne rétrécissent jamais, le plafond de cuts tient, la grosse correction à 40 cuts est rattrapée', () => {
  const E = Z.Etude(ps), P = Z.ajuster(E, ps, { prix: 200, plafond: 1.75 });
  for (const k of Z.CLES) { const v = Z.lire(P, k), l = Z.lire(Z.LIVRE, k); assert.ok(v >= l, `${k} : ${v} < ${l}`); }
  const t = Z.totaux(E, ps, P);
  assert.ok(t.hors < t.horsAvant, `${t.horsAvant} > ${t.hors}`);
  assert.ok(t.pireRapport <= 1.75);
  assert.ok(!Z.evaluer(ps[0], P).hors.includes(110), 'le cut 110, à 40 cuts de l\'ADV, est dans la sélection');
  assert.ok(Z.lire(P, 'adv.avant') >= 40);
});

test('ajustement : une marge imposée n\'est jamais cherchée', () => {
  const E = Z.Etude(ps), P = Z.ajuster(E, ps, { prix: 200, plafond: 1.75, fixes: { 'adv.trou': 30, 'adv.gap': 40 } });
  assert.equal(Z.lire(P, 'adv.trou'), 30);
  assert.equal(Z.lire(P, 'adv.gap'), 40);
});

test('ajustement : si un cut de plus coûte plus qu\'une grosse correction, le livré est gardé', () => {
  const E = Z.Etude(ps), P = Z.ajuster(E, ps, { prix: 0.001, plafond: 1.75 }), t = Z.totaux(E, ps, P);
  assert.equal(t.hors, t.horsAvant);
  assert.equal(t.cuts, t.cutsAvant);
});

test('étude : validation par partie laissée de côté, tables, retraits et proposition à part', () => {
  const o = Z.etudier(parties, { prix: 200, plafond: 1.75 });
  assert.equal(o.croisee.length, 2);
  assert.deepEqual(o.croisee.map(c => c.partie), ['9:1', '9:2']);
  assert.ok(o.total.hors <= o.total.horsAvant);
  const prop = Z.proposer(o, { date: '2026-10-19' });
  assert.equal(prop.etat, 'proposées, non figées');
  assert.equal(prop.format, Z.FORMAT_PROPOSITION);
  const P = Z.margesDeProposition(JSON.parse(JSON.stringify(prop)));
  for (const k of Z.CLES) assert.equal(Z.lire(P, k), Z.lire(o.marges, k), k);
  assert.match(Z.texte(o), /validation croisée/);
});

test('proposition : une marge plus petite que le livré est refusée', () => {
  const o = Z.etudier(parties), prop = JSON.parse(JSON.stringify(Z.proposer(o, { date: '2026-10-19' })));
  prop.marges.adv.margeAvant = 10;
  assert.throws(() => Z.margesDeProposition(prop), /plus petit que le livré/);
  assert.throws(() => Z.margesDeProposition({ format: 'autre' }), /format/);
});

test('jugement : une proposition figée se mesure sans rien régler', () => {
  const P = Z.avec(Z.LIVRE, { 'adv.avant': 60 }), j = Z.juger(parties, P);
  assert.equal(j.parties.length, 2);
  assert.deepEqual(j.parties[0].horsCuts, [242], 'avec 60 cuts avant l\'ADV, le cut 110 et le cut 91 sont dans la sélection ; le cut 242 reste');
  assert.match(Z.texte(j), /aucun réglage/);
});

test('zones de Mic : couverture des cuts notés et écart du début et de la fin de la plage', () => {
  const notes = { format: Z.FORMAT_NOTES, zones: [{ partie: '9:1', genre: 'ADV', debut: 130, fin: 200, aiguilles: [150] }, { partie: '9:1', genre: 'PN', debut: 50, fin: 56 }, { partie: '9:2', genre: 'ADV', debut: 0, fin: 3 }] };
  const z = Z.zonesDeMic([s], Z.avec(Z.LIVRE, { 'adv.apres': 40 }), notes);
  assert.equal(z.length, 2, 'seules les zones de la partie chargée');
  const adv = z.find(x => x.genre === 'ADV'), pn = z.find(x => x.genre === 'PN');
  assert.equal(adv.cuts, 71);
  assert.equal(adv.couvertsAvant, 52, 'livré : 130 à 181');
  assert.equal(adv.couvertsApres, 62, 'proposé : 130 à 191');
  assert.deepEqual(adv.plagesAvant, [{ debut: 120, fin: 181, ecartDebut: -10, ecartFin: -19 }]);
  assert.deepEqual(adv.plagesApres, [{ debut: 120, fin: 191, ecartDebut: -10, ecartFin: -9 }]);
  assert.deepEqual([pn.cuts, pn.couvertsAvant], [7, 7]);
  assert.throws(() => Z.zonesDeMic([s], Z.LIVRE, { format: 'autre', zones: [] }), /format/);
  const reelles = JSON.parse(fs.readFileSync(Z.NOTES, 'utf8'));
  assert.equal(reelles.format, Z.FORMAT_NOTES);
  assert.ok(reelles.zones.every(x => ['ADV', 'PN'].includes(x.genre) && x.fin >= x.debut));
});

test('ligne de commande : l\'essai tourne, un témoin ne se règle pas, un mode inconnu échoue', () => {
  const run = (...a) => spawnSync(process.execPath, [path.join(root, 'tools', 'marges-zones.cjs'), ...a], { cwd: root, encoding: 'utf8' });
  const e = run('essai');
  assert.equal(e.status, 0, e.stderr);
  assert.match(e.stdout, /Marges proposées/);
  for (const t of ['1:11', '1:25']) {
    const r = run('etudier', '--partie', t, '--cas', '/nulle/part.jsonl', '--table', '/nulle/part.json');
    assert.equal(r.status, 1, t);
    assert.match(r.stderr, /témoin|réservée|apprentissage/i, t);
  }
  assert.equal(run('inconnu').status, 1);
});

test('ombre : ni les réglages figés ni le comportement par défaut ne lisent la proposition', () => {
  for (const f of ['src/regles-metier.js', 'datasets/reglages-figes.json', 'tools/relecture-autonome.cjs', 'src/verts-a-controler.js']) {
    assert.ok(!/marges-zones/.test(fs.readFileSync(path.join(root, f), 'utf8')), f);
  }
  const p = path.join(root, 'datasets', 'marges-zones-proposees.json');
  if (fs.existsSync(p)) assert.equal(JSON.parse(fs.readFileSync(p, 'utf8')).etat, 'proposées, non figées');
});
