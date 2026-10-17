'use strict';
/* 5.0 — RELECTURE AUTONOME (tools/relecture-autonome.cjs, fiches/RELECTURE_AUTONOME.md), sur données SYNTHÉTIQUES : sélection « méthode de
 * Mic », jugement d'une action, règle prudente apprise sans la partie jugée, cuts différés jamais touchés, borne de Wilson, relevé SKIP,
 * réglages proposés relus par `juger`, manifeste des parties. Aucune donnée de terrain, aucune coordonnée en sortie. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const path = require('node:path'), { spawnSync } = require('node:child_process');
const T = require('../tools/relecture-autonome.cjs');

const v = (lat, z) => ({ left: [0, lat, z], right: [0, lat, z] });
const ligne = (o) => ({ partie: '9:1', cut: 1, zone: 'pn', genre: 'vert', ref: true, etat: 'calcule', conf: 80, ...o });
/* Une proposition : écart `d` (plus grand |latéral| ou |vertical|), erreur `e` contre Mic, écart d'écartement `dg`. */
const prop = (o) => ({ stage: 'first-pass', pire: o.d, latMax: o.d, coh: 0, dg: 1, ...o });

test('sélection : PN puis ADV puis abords (grappe, isolé, différé) puis liste, verts et revisites comptés', () => {
  const t = { cuts: [{ i: 0 }, { i: 300 }], lot: [{ cut: 100, differe: false }, { cut: 103, differe: false }, { cut: 106, differe: true }, { cut: 200, differe: false }],
    zonesPN: [{ debut: 10, fin: 12, controle: [6, 18] }], zonesADV: [[40, 60]] };
  const S = T.selection(t, { liste: [250, 15] });
  assert.equal(S.type.get(6), 'pn'); assert.equal(S.type.get(18), 'pn'); assert.equal(S.type.get(5), undefined);
  assert.equal(S.type.get(15), 'pn', 'un vert de la liste dans un PN reste « pn »');
  assert.equal(S.type.get(50), 'adv');
  for (const c of [97, 100, 104, 109]) assert.equal(S.type.get(c), 'abords', `grappe 100–106 et 3 cuts de marge : ${c}`);
  assert.equal(S.type.get(96), undefined); assert.equal(S.type.get(110), undefined);
  assert.deepEqual([199, 200, 201].map(c => S.type.get(c)), ['abords', 'abords', 'abords'], 'rouge isolé : avant et après');
  assert.equal(S.type.get(202), undefined);
  assert.equal(S.type.get(250), 'liste');
  assert.equal(S.grappes, 1); assert.equal(S.isoles, 1);
  assert.equal(S.revisites, 3, 'les trois rouges posés sont des revisites ; le différé non');
  assert.equal(S.verts.abords, S.compte.abords - 4);
});

test('issue d\'une action : reproduit, confirmé, gris, abîmé, aggravé, mauvaise voie, laissé', () => {
  assert.equal(T.issue({ mic: 30 }, { e: 3 }, true), 'reproduit5');
  assert.equal(T.issue({ mic: 30 }, { e: 8 }, true), 'reproduit10');
  assert.equal(T.issue({ mic: 30 }, { e: 20 }, true), 'faux-reste');
  assert.equal(T.issue({ mic: 12 }, { e: 20 }, true), 'aggrave');
  assert.equal(T.issue({ mic: 2 }, { e: 4 }, true), 'confirme');
  assert.equal(T.issue({ mic: 2 }, { e: 7 }, true), 'gris');
  assert.equal(T.issue({ mic: 2 }, { e: 14 }, true), 'abime');
  assert.equal(T.issue({ mic: 200 }, { e: 195 }, true), 'mauvaise-voie');
  assert.equal(T.issue({ mic: 30 }, { e: 3 }, false), 'laisse-faux');
  assert.equal(T.issue({ mic: 3 }, { e: 3 }, false), 'laisse-juste');
});

test('règle prudente : seuil, voie, confiance, cohérence, écartement, étapes ; jamais sur un cut différé ni (si demandé) posé par le lot', () => {
  const R = { variante: 'seul+h', X: 10, D: 45, Y: 50, C: 6, G: 10, stages: ['first-pass'], differes: false, poses: false };
  const l = ligne({ mic: 30, var: { 'seul+h': prop({ d: 30, e: 2, dg: 3 }) } });
  assert.equal(T.agit(l, R), true);
  assert.equal(T.agit({ ...l, genre: 'differe' }, R), false, 'différé : jamais');
  assert.equal(T.agit({ ...l, genre: 'pose' }, R), false, 'posé par le lot : pas avec poses:false');
  assert.equal(T.agit({ ...l, genre: 'pose' }, { ...R, poses: true }), true);
  assert.equal(T.agit({ ...l, var: { 'seul+h': { ...l.var['seul+h'], pire: 8 } } }, R), false, 'écart trop petit : on laisse');
  assert.equal(T.agit({ ...l, var: { 'seul+h': { ...l.var['seul+h'], latMax: 60 } } }, R), false, 'rail déplacé trop loin en travers : on laisse');
  assert.equal(T.agit({ ...l, var: { 'seul+h': { ...l.var['seul+h'], coh: 9 } } }, R), false, 'rails incohérents : on laisse');
  assert.equal(T.agit({ ...l, conf: -1 }, { ...R, Y: 0 }), false, 'confiance absente : refus');
  assert.equal(T.agit({ ...l, conf: 40 }, R), false);
  assert.equal(T.agit({ ...l, var: { 'seul+h': { ...l.var['seul+h'], dg: 12 } } }, R), false);
  assert.equal(T.agit({ ...l, var: { 'seul+h': { ...l.var['seul+h'], stage: 'crossing' } } }, R), false);
  assert.equal(T.agit({ ...l, var: { 'seul+h': { stage: 'deferred', d: null, e: null } } }, R), false, 'décision différée : abstention');
  const b = T.bilan([l, ligne({ mic: 2, var: { 'seul+h': prop({ d: 20, e: 19 }) } }), ligne({ mic: 30, var: { 'seul+h': { stage: 'deferred', d: null } } }), ligne({ ref: false })], R);
  assert.equal(b.visites, 3); assert.equal(b.agit, 2); assert.equal(b.corrigesJustes, 1); assert.equal(b.abime, 1); assert.equal(b.degats, 1); assert.equal(b.abstention, 1); assert.equal(b.laisseFaux, 1);
});

test('choix de la règle : le plus de corrections justes sous 0 mauvaise voie et ≤ 1 % de dégâts ; la plus prudente à égalité', () => {
  const ls = [];
  for (let i = 0; i < 100; i++) ls.push(ligne({ cut: i, mic: 1, var: { 'seul+h': prop({ d: 3, e: 2 }) } }));
  for (let i = 0; i < 10; i++) ls.push(ligne({ cut: 200 + i, mic: 35, var: { 'seul+h': prop({ d: 34, e: 2 }) } }));
  ls.push(ligne({ cut: 300, mic: 1, var: { 'seul+h': prop({ d: 14, e: 14 }) } }));
  ls.push(ligne({ cut: 301, mic: 1, var: { 'seul+h': prop({ d: 16, e: 16 }) } }));
  const grille = { variante: ['seul+h'], X: [5, 15, 20], Y: [0], G: [100], D: [60], C: [100], stages: [null], differes: [false], poses: [true] };
  const best = T.choisir(ls, { grille });
  assert.equal(best.b.corrigesJustes, 10); assert.ok(best.b.degats <= 1);
  assert.equal(best.R.X, 20, 'à gains égaux, la règle la plus prudente');
});

test('borne de Wilson à 95 %', () => {
  const w = T.wilson(0, 20); assert.equal(w.bas, 0); assert.ok(Math.abs(w.haut - 0.1611) < 0.001);
  const w2 = T.wilson(3, 60); assert.ok(w2.bas < 0.05 && w2.haut > 0.05 && Math.abs(w2.haut - 0.1369) < 0.002);
  assert.deepEqual(T.wilson(0, 0), { bas: null, haut: null });
});

test('zones depuis les surfaces des cas : PN confirmé avec ses marges, zones d\'ADV fusionnées', () => {
  const cas = [];
  for (let c = 0; c < 200; c++) cas.push({ cut: c, partie: 1, ariane: { surface: { flushPct: c >= 50 && c <= 53 ? 80 : 0, quadMin: c >= 50 && c <= 53 ? 70 : 0, coeurPN: c >= 50 && c <= 53, advRails: (c === 120 || c === 121 || c === 140 || c === 141) ? 1 : 0 } } });
  const z = T.zonesDepuisCas(cas);
  assert.deepEqual(z.zonesPN, [{ debut: 50, fin: 53, controle: [46, 59] }]);
  assert.deepEqual(z.zonesADV, [[90, 171]]);
  assert.deepEqual(T.fusionner([[10, 20], [21, 30], [40, 50]]), [[10, 30], [40, 50]]);
});

test('relevé SKIP : aucun point → SKIP ; scanners illisibles avec un seul nuage source ; sans capture : inconnu', () => {
  const r = [{ cut: 0, skipMic: true, ecritures: true, captures: 3, points_left: 0, points_right: 0, scanners_left: 0, scanners_right: 0 },
    { cut: 1, skipMic: true, ecritures: true, captures: 2, points_left: 4000, points_right: 3800, scanners_left: 1, scanners_right: 1 },
    { cut: 5, skipMic: false, ecritures: true, captures: 0, points_left: 0, points_right: 0, scanners_left: 0, scanners_right: 0 },
    { cut: 9, skipMic: false, ecritures: true, captures: 2, points_left: 0, points_right: 0, scanners_left: 0, scanners_right: 0 }];
  const b = T.bilanSkip(r);
  assert.equal(b.skipMic, 2); assert.equal(b.skipMicDebut, 2); assert.equal(b.retrouves, 1); assert.equal(b.fausseAlerte, 1); assert.equal(b.inconnus, 1);
  assert.equal(b.scannersLisibles, false);
  assert.equal(T.verdictSkip({ ...r[1], nuagesDistincts: 3 }), 'skip-un-scanner');
  assert.equal(T.verdictSkip({ ...r[1], points_left: 4000, scanners_left: 2, scanners_right: 2, nuagesDistincts: 3 }), 'visiter');
});

test('étude de la fixture, réglages proposés puis jugement : la règle corrige le PN sans abîmer, aucune coordonnée en sortie', () => {
  const { cas, table } = T.essai();
  const o = T.etudier([{ designation: '9:1', cas, table }, { designation: '9:2', cas, table }]);
  assert.equal(o.croisee.length, 2);
  for (const c of o.croisee) { assert.ok(c.regle); assert.equal(c.bilan.mauvaiseVoie, 0); assert.equal(c.bilan.degats, 0); assert.equal(c.bilan.corrigesJustes, 7); }
  assert.equal(o.couverture[0].micSup10DansSelection, 7);
  assert.ok(o.cout[0].minutesAriane[0] < o.cout[0].minutesAriane[1]);
  const g = T.reglagesProposes(o, { date: '2026-10-17' });
  /* Format lu par la passe de relecture (src/relecture-critere.js) : zones pn, adv, abords, vert-hors-zone ; corriger, seuilMm, confianceMin. */
  assert.equal(g.format, 'ariane-relecture-reglages-1'); assert.deepEqual(g.roles, ['vert']); assert.ok(g.jamais.includes('cut différé par le lot'));
  assert.deepEqual(Object.keys(g.zones), ['pn', 'adv', 'abords', 'vert-hors-zone']);
  assert.equal(g.zones.pn.corriger, true); assert.equal(g.zones.adv.corriger, false);
  for (const z of Object.values(g.zones)) { assert.ok(z.seuilMm >= 1 && z.seuilMm <= 500); assert.ok(z.confianceMin >= 0 && z.confianceMin <= 100); }
  assert.ok(g.voie.lateralMaxMm >= 1 && g.voie.lateralMaxMm <= 500);
  const relu = T.regleDuReglage(g); assert.equal(relu.regle.X, o.figeSobre.regle.X); assert.equal(relu.regle.D, o.fige.regle.D); assert.equal(relu.procedure.X, o.fige.regle.X); assert.deepEqual(relu.actifs, ['pn']);
  const j = T.juger([{ designation: '9:3', cas, table }], T.regleDuReglage(g));
  assert.equal(j.parties[0].bilan.corrigesJustes, 7); assert.equal(j.parties[0].porte.mauvaiseVoie, true);
  assert.ok(j.parties[0].wilsonErreur.haut > 0, 'borne haute non nulle même sans erreur');
  const s = JSON.stringify(o) + JSON.stringify(g) + JSON.stringify(j);
  assert.ok(!/"bords"|positionSceneRelative/.test(s), 'aucune coordonnée');
  assert.match(T.texte(o), /Validation croisée/); assert.match(T.texte(j), /Règle de service figée/);
});

test('manifeste : etudier refuse une partie réservée', () => {
  const outil = path.join(__dirname, '..', 'tools', 'relecture-autonome.cjs');
  const p = spawnSync(process.execPath, [outil, 'etudier', '--partie', '1:40', '--cas', 'absent.jsonl', '--table', 'absent.json'], { encoding: 'utf8' });
  assert.equal(p.status, 1); assert.match(p.stderr, /réservée/);
});
