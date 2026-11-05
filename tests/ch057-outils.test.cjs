'use strict';
/* CH-057 — outils hors ligne de l'apprentissage sur 9 parties : juge des paramètres GCV2 figés (chantiers/CH-057/gcv2-fige.cjs), synthèse en
 * validation croisée par partie (chantiers/CH-057/synthese.cjs), variantes ajoutées au rejeu (chantiers/CH-057/rejeu.cjs). Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const F = require('./helpers/gcv2-apprendre-fixture.cjs');
const A = require('../tools/gcv2-apprendre.cjs');
const Fige = require('../chantiers/CH-057/gcv2-fige.cjs');
const S = require('../chantiers/CH-057/synthese.cjs');

const jeu = (opt) => { const j = A.jeuDeLignes(F.jeuSynthetique(opt)); j.sha256 = 'x'.repeat(64); return j; };

test('gcv2-fige : le pli reconstruit depuis l’export décide comme le pli appris', () => {
  const ps = [jeu({ partie: '9:1', graine: 1, cuts: 40 }), jeu({ partie: '9:2', graine: 2, cuts: 40 }), jeu({ partie: '9:3', graine: 3, cuts: 40 })];
  const P = JSON.parse(A.serialiser(A.exporter(ps, { usages: ['relecture'], lambda: 10, date: '2026-11-05' })));
  const cas = ps.flatMap(j => A.construireCas(j, 'relecture'));
  const pli = A.apprendrePli(cas, { lambda: 10 }), reconstruit = Fige.pliDepuisExport(P, 'relecture');
  assert.deepEqual(reconstruit.modele.fit.noms, pli.modele.fit.noms);
  const juger = q => { const J = A.jugerPli(q, cas); return cas.map((k, i) => A.resultatDeDecision(k, A.decider(k, J.p10[i], q.seuils)).etat); };
  assert.deepEqual(juger(reconstruit), juger(pli), 'mêmes décisions (coefficients arrondis à 1e-6 dans l’export)');
  const r = Fige.juger(P, [ps[0]], { usage: 'relecture' });
  assert.equal(r.parPartie['9:1'].nCas, A.construireCas(ps[0], 'relecture').length);
});

test('gcv2-fige : un export dont les colonnes ne se reconstruisent pas est refusé', () => {
  const ps = [jeu({ partie: '9:1', graine: 1, cuts: 30 }), jeu({ partie: '9:2', graine: 2, cuts: 30 })];
  const P = JSON.parse(A.serialiser(A.exporter(ps, { usages: ['relecture'], lambda: 10, date: '2026-11-05' })));
  P.usages.relecture.colonnes = P.usages.relecture.colonnes.slice(1);
  assert.throws(() => Fige.pliDepuisExport(P, 'relecture'), /colonnes reconstruites/);
});

/* Détail synthétique : 3 parties, 2 différés jugés chacune (+ un posé jugé). La variante f50-c30 pose tout, mais une faute à 80 mm en 12:9. */
function details() {
  const d = (cut, posee, pire, classe = 'differee', source = posee ? 'ecart' : 'lot') => ({ cut, classe, posee, pire, source });
  const out = {};
  for (const p of ['11:10', '12:9', '12:10']) {
    out[p] = {
      temoin: [d(1, false, null), d(2, false, null), d(3, true, 2, 'posee', 'lot')],
      'b1-ecart-serie': [d(1, true, 4), d(2, false, null), d(3, true, 2, 'posee', 'lot')],
      'b1-ecart-serie-f50-c30': [d(1, true, 4), d(2, true, p === '12:9' ? 80 : 6), d(3, true, 2, 'posee', 'lot')],
      'plafond-serie': [d(1, true, 1), d(2, true, 1), d(3, true, 2, 'posee', 'lot')],
    };
    for (const v of Object.values(out[p])) v[1].pire = v[1].pire ?? null;
  }
  /* La pose humaine existe pour les cuts 1 et 2 (jugeables) : le témoin les a différés sans `pire`. */
  return out;
}

test('synthèse : validation croisée sans faute > 50 mm sur les autres parties, clés projet:partie', () => {
  const o = S.synthese({ details: details(), grosses: new Set() });
  assert.deepEqual(o.parties, ['11:10', '12:10', '12:9']);
  const vc = o.perimetres.tous.validationCroisee;
  /* Jugée 12:9 : sur 11:10 et 12:10, f50-c30 a 4 justes et 0 > 50 → choisie, et sa faute de 12:9 est comptée hors échantillon. */
  assert.equal(vc.parPartie['12:9'].choisie, 'b1-ecart-serie-f50-c30');
  assert.equal(vc.parPartie['12:9'].plus50, 1);
  /* Jugées 11:10 et 12:10 : 12:9 est parmi les autres, la faute > 50 écarte f50-c30 → le réglage livré. */
  assert.equal(vc.parPartie['11:10'].choisie, 'b1-ecart-serie');
  assert.equal(vc.parPartie['12:10'].choisie, 'b1-ecart-serie');
  assert.equal(vc.total.justes, 1 + 1 + 1);
  assert.ok(!S.estCandidate('plafond-serie') && !S.estCandidate('b1-ecart-serie-garde-pn-adv'));
  const b = o.lot['b1-ecart-serie-f50-c30'];
  assert.equal(b.plus50, 1); assert.equal(b.posesJuges, 9);
});

test('rejeu CH-057 : les variantes ajoutées ont les bons réglages et ne doublonnent pas', () => {
  const R = require('../tools/rejeu-voie-predite.cjs'), E = require('../chantiers/CH-057/rejeu.cjs');
  const avant = R.VARIANTES.length;
  E.installer(); const apres = R.VARIANTES.length; E.installer();
  assert.equal(R.VARIANTES.length, apres, 'deux installations, une seule fois les variantes');
  assert.ok(apres > avant);
  const f = R.VARIANTES.find(v => v.id === 'b1-ecart-serie-f50-c30');
  assert.equal(f.fenetre, 50); assert.equal(f.choix, 30); assert.equal(f.b1, true); assert.equal(f.ecart, 'les-deux');
  assert.ok(!R.VARIANTES.some(v => v.id === 'b1-ecart-serie-f30-c15'), 'le réglage livré n’est pas dupliqué');
  assert.ok(!R.VARIANTES.some(v => /^b1-ecart-serie-f20-c30$/.test(v.id)), 'jamais un choix plus large que la fenêtre');
  const g = R.VARIANTES.find(v => v.id === 'b1-ecart-serie-garde-pn-adv');
  assert.deepEqual(g.garde, { regle: 'R3', coupures: 2, appuisMin: 2, zone: 'pn-adv' });
});

test('garde réelle : bilan par zone, pose du témoin jugée, cuts non posés par le témoin hors du jugement', () => {
  const G = require('../chantiers/CH-057/garde-reelle.cjs');
  const rows = [
    { partie: '12:10', cut: 1, pnAdv: false, temoinPose: true, pireMm: 2.4 },
    { partie: '12:10', cut: 2, pnAdv: true, temoinPose: true, pireMm: 60.3 },
    { partie: '12:10', cut: 3, pnAdv: true, temoinPose: true, pireMm: 33 },
    { partie: '12:10', cut: 4, pnAdv: true, temoinPose: false, pireMm: null },
    { partie: '12:10', cut: 5, pnAdv: false, temoinPose: true, pireMm: null },
  ];
  const s = G.synthese(rows);
  assert.equal(s.tout.retenus, 5); assert.equal(s.tout.posesTemoin, 4); assert.equal(s.tout.juges, 3);
  assert.deepEqual([s.pnAdv.justes, s.pnAdv.faux10a50, s.pnAdv.plus50], [0, 1, 1]);
  assert.deepEqual([s.horsPnAdv.juges, s.horsPnAdv.justes, s.horsPnAdv.plus50], [1, 1, 0]);
});

test('agrégats : aucune coordonnée ne sort, l’écartement de l’opérateur est une distance en mm', () => {
  const A = require('../chantiers/CH-057/agregats.cjs');
  const table = { table: [
    { etiquetteEcho: 'VALIDATE_NO_MOVEMENT', poseHumaineFinale: { gauche: { x: 732923.354, y: 6571329.905, z: 255.868 }, droite: { x: 732921.919, y: 6571329.905, z: 255.868 } } },
    { etiquetteEcho: 'SKIP', poseHumaineFinale: { gauche: { x: 0, y: 0, z: 0 }, droite: { x: 9, y: 0, z: 0 } } },
  ] };
  const e = A.ecartements(table);
  assert.equal(e.n, 1); assert.equal(e.medianeMm, 1435); assert.equal(e.dans1430a1447, 1);
  assert.ok(!/\d{5,}\.\d/.test(JSON.stringify(e)));
});

test('écritures de la passe : seules les écritures « ecrit » comptent, jugées sur la pose vue à la première visite', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const E = require('../chantiers/CH-057/ecritures-passe.cjs');
  const j = { events: [
    { type: 'passe-differes-ecriture', resultat: 'ecrit', identity: { part: 14, cut: 4135 }, passe: 1 },
    { type: 'passe-differes-ecriture', resultat: 'refuse', identity: { part: 14, cut: 4136 }, passe: 1 },
    { type: 'passe-differes-ecriture', resultat: 'ecrit', identity: { part: 9, cut: 1 }, passe: 1 },
  ] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch057-'));
  fs.writeFileSync(path.join(dir, 'table11-14.json'), JSON.stringify({ table: [{ cut: 4135, dansEcho: true, base: 'premiere-visite', ecartHumain: { maxDist3dMm: 10.247 }, etiquetteEcho: 'VALIDATE_CORRECTED_BOTH' }] }));
  const rows = E.juger(E.ecritures(j), '11', dir);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].jugement, rows[0].ecartMm], ['faux', 10.2]);
  assert.equal(rows[1].jugement, 'hors-des-9');
  assert.deepEqual(E.bilan(rows), { ecrits: 2, faux: 1, 'hors-des-9': 1 });
});
