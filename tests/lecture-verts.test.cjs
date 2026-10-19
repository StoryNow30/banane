'use strict';
/* Lecture de verts au lot (RM-12) : essai hors ligne sur une partie et un journal inventés (aucune donnée de terrain) — rang des verts, phases, détecteur
 * figé contre détecteur adapté, plafond (écho complet), coût par distance, projection, refus des parties réservées et des témoins. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const L = require('../tools/lecture-verts.cjs');
const root = path.resolve(__dirname, '..');

const s = L.essai(), Y = L.preparerPartie(s);

test('lectures : un vert sur N parmi les verts (le lot ne compte pas), les N phases partagent les verts sans les répéter', () => {
  assert.equal(Y.lotLus.length, 10);
  assert.equal(Y.verts.length, 61, 'les cuts 280 à 340 ont un nuage et ne sont pas du lot');
  for (const n of [2, 3, 5, 10]) {
    const vus = new Map();
    for (let ph = 0; ph < n; ph++) for (const l of L.lectures(Y, n, ph).filter(x => !Y.lot.has(x.cut))) vus.set(l.cut, (vus.get(l.cut) || 0) + 1);
    assert.equal(vus.size, 61, `N=${n}`);
    assert.ok([...vus.values()].every(k => k === 1), `N=${n} : chaque vert est lu dans une seule phase`);
  }
  assert.equal(L.lectures(Y, 1, 0).length, 71, 'N = 1 : tout le lot et tous les verts à nuage (le plafond)');
  const gap = L.lectures(Y, 5, 0).filter(x => !Y.lot.has(x.cut)).map(x => x.cut);
  assert.ok(gap.every((c, i) => i === 0 || c - gap[i - 1] === 5), 'les verts lus sont espacés de N cuts');
});

test('rang : les cuts du lot sont sautés dans le compte des verts', () => {
  const X = { ...s, table: { ...s.table, lot: [{ cut: 281, differe: false }] } }, Z = L.preparerPartie(X);
  assert.equal(Z.verts.find(v => v.cut === 280).rang, 280);
  assert.equal(Z.verts.find(v => v.cut === 282).rang, 281, 'le cut 281, du lot, ne compte pas');
});

test('simuler : un PN posé entièrement en vert est invisible au lot, vu par la lecture de verts si les lectures se confirment', () => {
  const o = L.simuler([s], { ns: [2, 5], zones: { format: L.FORMAT_ZONES, parties: { '9:1': s.vrai } } }), t = o.total;
  assert.equal(t.lot.pnVu, 0);
  assert.equal(t.lot.hors, 3);
  assert.equal(t.echo.pnVu, 1);
  assert.equal(t.n['fige|2'].pnVu.min, 1, 'à 2 cuts, deux lectures tombent à moins de 3 cuts l\'une de l\'autre');
  assert.equal(t.n['fige|5'].pnVu.max, 0, 'à 5 cuts, le détecteur figé (écart de 3) ne confirme jamais');
  assert.equal(t.n['adapte|5'].pnVu.min, 1, 'écart de confirmation porté à N : le PN est vu dans toutes les phases');
  assert.equal(t.n['adapte|5'].hors.max, 1, 'les cuts 305 et 310 sont dans la zone ; le cut 50 reste hors');
  assert.ok(t.n['adapte|5'].cuts.moy > t.lot.cuts, 'voir la zone coûte des cuts à relire');
  assert.ok(t.echo.cuts >= t.n['adapte|5'].cuts.moy);
  assert.deepEqual(t.n['adapte|5'].fausses, { moy: 0, min: 0, max: 0 });
});

test('simuler : une partie sans liste de zones ne juge pas ses plages, elle les compte à part', () => {
  const o = L.simuler([s], { ns: [2], zones: { format: L.FORMAT_ZONES, parties: { '9:1': { liste: false } } } });
  assert.equal(o.total.echo.fausses, 0);
  assert.equal(o.total.echo.nonJugees, 1, 'le PN de 300 à 319 est une plage, non jugeable sans liste');
  assert.throws(() => L.zonesDe({ format: 'autre', parties: {} }, '9:1'), /format/);
});

test('zones de Mic : le fichier versionné est bien formé, des numéros de cut seulement', () => {
  const z = JSON.parse(fs.readFileSync(L.ZONES, 'utf8'));
  assert.equal(z.format, L.FORMAT_ZONES);
  for (const [d, p] of Object.entries(z.parties)) {
    assert.match(d, /^\d+:\d+$/);
    for (const [a, b] of [...(p.adv || []), ...(p.pn || [])]) assert.ok(Number.isInteger(a) && Number.isInteger(b) && b >= a, d);
    if (p.liste === false) assert.deepEqual([...(p.adv || []), ...(p.pn || [])], [], `${d} : pas de liste, pas de zones`);
  }
});

test('coût : les cuts lus du journal inventé, leurs phases et la distance au cut quitté', () => {
  const ev = L.evenements(L.journalEssai()), v = L.visites(ev, 1);
  assert.equal(v.length, 4);
  assert.deepEqual(v.map(x => x.delta), [1, 1, 10, 1]);
  assert.deepEqual(v.map(x => x.navMs), [1000, 800, 3000, 900]);
  assert.deepEqual(v.map(x => x.pose), [true, true, true, false]);
  assert.equal(v[3].differe, true, 'le dernier cut est abandonné sans pose');
  assert.equal(v[0].analyseMs, 300);
  assert.equal(v[0].poseMs, 700);
  assert.equal(L.visites(ev, 2).length, 0, 'une autre partie ne compte pas');
  assert.deepEqual(L.lecturesRelecture(ev, 1).map(r => r.totalMs), [810], 'la lecture sans pose de la relecture, durée mesurée par la page');
  assert.equal(L.lecturesRelecture(ev, 2).length, 0);
});

test('coût : projection en minutes, bas, centre et haut, et part du lot', () => {
  const v = L.visites(L.evenements(L.journalEssai()), 1);
  const [a, b] = L.projeter(v, { total: 400, lot: 4, ns: [2, 10], minutesLot: 0.5 });
  assert.equal(a.minutes, null, 'aucune visite à 2 cuts dans ce journal : pas de chiffre inventé');
  assert.equal(b.lectures, 40);
  assert.deepEqual(b.secondes, { bas: 3, centre: 3.1, haut: 3.4 });
  assert.equal(b.minutes.bas, 2, '40 lectures de 3 s');
  assert.ok(b.minutes.bas <= b.minutes.centre && b.minutes.centre <= b.minutes.haut);
  assert.equal(b.partDuLot, r(100 * 40 * 3.11 / 60 / 0.5));
  assert.deepEqual(L.seau(10), [6, 10]);
  assert.deepEqual(L.seau(3), [3, 3]);
  const o = L.cout([{ data: L.journalEssai(), partie: 1, total: 400, lot: 4, minutesLot: 0.5 }], { ns: [10] });
  assert.equal(o.ensemble.projection[0].lectures, 40);
  assert.equal(o.parties[0].projection[0].lectures, 40);
  assert.match(L.texteCout(o), /1 vert sur 10 : 40 lectures/);
});
function r(x) { return Math.round(x * 10) / 10; }

test('ligne de commande : l\'essai tourne, une partie réservée et un témoin ne se règlent pas, une option fausse échoue', () => {
  const run = (...a) => spawnSync(process.execPath, [path.join(root, 'tools', 'lecture-verts.cjs'), ...a], { cwd: root, encoding: 'utf8' });
  const e = run('essai');
  assert.equal(e.status, 0, e.stderr);
  assert.match(e.stdout, /1 vert sur 5 \(adapte\)/);
  assert.match(e.stdout, /Coût d'une lecture de vert/);
  for (const t of ['1:11', '1:25', '2:6']) {
    const r = run('simuler', '--partie', t, '--cas', '/nulle/part.jsonl', '--table', '/nulle/part.json');
    assert.equal(r.status, 1, t);
    assert.match(r.stderr, /témoin|réservée|apprentissage/i, t);
  }
  assert.equal(run('simuler', '--partie', '1:17', '--n', '1').status, 1);
  assert.equal(run('cout', '--partie', '3').status, 1);
  assert.equal(run('inconnu').status, 1);
});

test('ombre : ni les réglages figés ni l\'extension ne lisent l\'outil', () => {
  for (const f of ['src/regles-metier.js', 'src/verts-a-controler.js', 'datasets/reglages-figes.json', 'tools/relecture-autonome.cjs', 'tools/marges-zones.cjs']) {
    assert.ok(!/lecture-verts/.test(fs.readFileSync(path.join(root, f), 'utf8')), f);
  }
});
