'use strict';
/* P1 du plan 5.0 : outil de rejeu `tools/p1-plafond.cjs` (réglage `conventionPlafond` activé contre désactivé).
 * Lot SYNTHÉTIQUE d'un seul cut, construit sur la capture versionnée de tests/corpus (rails, points) : aucune
 * donnée de terrain, aucun identifiant de projet. La pose de Mic du cas de jugement est fabriquée ici. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const T = require('../tools/p1-plafond.cjs');
const Shadow = require('../src/gcv1-shadow.js');
const pilote = require('./corpus/pilot-part18-cut6704-partial-flank.json');

const SIDES = ['left', 'right'];
const mm3 = v => v.map(x => x * 1000);
function lotSynthetique() {
  const identity = { pageId: 'page-synthetique', part: 99, cut: 105, shape: 'U50', frameId: 'cadre-synthetique', projectId: null };
  const capture = { identity, rails: pilote.rails, pointsSceneRelative: pilote.pointsSceneRelative, visibleByClipBoxes: pilote.visibleByClipBoxes };
  const science = Shadow.scientificProposeBoth(capture);
  const observation = { observationEventId: 'obs-1', identity, timestamp: '2026-10-01T08:00:00.000Z', batchId: null, lidar: { captureId: 'capture-1' }, error: null, summary: science.summary,
    rails: Object.fromEntries(SIDES.map(s => [s, { scientificRail: JSON.parse(JSON.stringify(science.rails[s])) }])) };
  return { science, lot: { label: 'synthetique', diagnostic: { version: '4.9.5.4', observations: [observation] }, journal: null, corpus: { clouds: [{ captureId: 'capture-1', ...capture }] } } };
}

test('rejeu d’un lot : le rail refusé est plafonné, la décision et les compteurs sont consignés', () => {
  const { lot } = lotSynthetique();
  const r = T.rejouerLot(lot);
  assert.equal(r.comptes.cuts, 1);
  assert.deepEqual(r.controle, { observations: 1, identiques: 1, sansNuage: 0 }, 'le relancement sans plafond redonne la science consignée');
  assert.equal(r.cutsAvecRailRefuse, 1);
  assert.equal(r.rails.refuses, 1);assert.equal(r.rails.plafonnes, 1);
  assert.ok(r.rails.deplacementMedianMm > 1 && r.rails.deplacementMaxMm <= 8 * Math.SQRT2 + 1e-9, 'le décalage ne dépasse pas 8 mm par axe');
  /* Un cut posé avant et après ; sa pose a bougé, par un rail refusé. */
  assert.equal(r.comptes.off.pose, 1);assert.equal(r.comptes.on.pose, 1);
  assert.equal(r.resume.posesDeplaces.n, 1);assert.equal(r.resume.posesDeplaces.avecRailRefuse, 1);assert.equal(r.resume.posesDeplaces.sansRailRefuse, 0);
  assert.equal(r.resume.nouveauxPoses.n, 0);assert.equal(r.resume.posesPerdus.n, 0);
  assert.equal(r.comptes.gardePaire.off, r.comptes.gardePaire.on);
});

test('jugement à la pose de Mic : l’erreur du pire rail avant et après', () => {
  const { lot, science } = lotSynthetique();
  const avec = T.avecReglage(true, () => Shadow.scientificProposeBoth(lot.corpus.clouds[0]));
  /* Mic a posé exactement la pose plafonnée : l’erreur après est nulle, celle d’avant est la distance au brut. */
  const ecart = Object.fromEntries(SIDES.map(s => { const d = mm3(avec.rails[s].next.delta); return [s === 'left' ? 'gauche' : 'droite', { repere: 'profil', longitudinalMm: d[0], lateralMm: d[1], verticalMm: d[2] }]; }));
  const zero = { repere: 'profil', longitudinalMm: 0, lateralMm: 0, verticalMm: 0 };
  const table = [{ partie: 99, cut: 105, classe: 'posee', base: 'ariane', referenceHumaine: 'observee', ecartHumain: ecart, arianeDeplacement: { gauche: zero, droite: zero } }];
  const r = T.rejouerLot(lot, { jointure: table });
  assert.equal(r.mic.cuts, 1);
  const attendu = Math.max(...SIDES.map(s => Math.hypot(...mm3(science.rails[s].next.delta).map((v, i) => v - mm3(avec.rails[s].next.delta)[i]))));
  assert.ok(Math.abs(r.mic.lignes[0].offMm - Math.round(attendu * 100) / 100) <= 0.01);
  assert.equal(r.mic.lignes[0].onMm, 0);
  assert.equal(r.mic.tousEtages.cuts, 1);assert.equal(r.mic.tousEtages.avant.plus5, 1);assert.equal(r.mic.tousEtages.apres.plus5, 0);
  assert.equal(r.mic.nouveauxPoses.n, 0);assert.equal(r.mic.posesPerdus.n, 0);
  assert.equal(r.mic.avant.plus5, 1);assert.equal(r.mic.apres.plus5, 0);assert.equal(r.mic.gagnes5, 1);assert.equal(r.mic.perdus5, 0);
});

test('le réglage est remis à zéro après le rejeu', () => {
  const { lot } = lotSynthetique();
  T.rejouerLot(lot);
  assert.equal(globalThis.BananeSettings, undefined);
});

test('classes de décision, égalité de décisions, somme des lots et texte', () => {
  assert.equal(T.classe({ stage: 'deferred' }), 'differe');assert.equal(T.classe({ stage: 'choice' }), 'pose');assert.equal(T.classe(null), 'aucune');
  const p = { left: [1, 2, 3], right: [4, 5, 6] };
  assert.ok(T.memeDecision({ stage: 'first-pass', positions: p }, { stage: 'first-pass', positions: JSON.parse(JSON.stringify(p)) }));
  assert.ok(!T.memeDecision({ stage: 'first-pass', positions: p }, { stage: 'choice', positions: p }));
  assert.ok(!T.memePositions(p, { left: [1, 2, 3.001], right: [4, 5, 6] }));
  const un = { etiquette: 'A', comptes: { cuts: 3, off: { pose: 2, differe: 1 }, on: { pose: 3 }, gardePaire: { off: 1, on: 1 }, ecartementRejete: { off: 0, on: 0 } }, transitions: { 'pose > pose': 2, 'differe > pose': 1 },
    parite: { comparees: 3, identiques: 3 }, controle: { observations: 2, identiques: 2, sansNuage: 0 }, cutsAvecRailRefuse: 2,
    resume: { nouveauxPoses: { n: 1, avecRailRefuse: 1, sansRailRefuse: 0 }, posesPerdus: { n: 0, avecRailRefuse: 0, sansRailRefuse: 0 }, posesDeplaces: { n: 1, avecRailRefuse: 1, sansRailRefuse: 0 }, differesMotifChange: 0, autresChangementsDeStade: 0 }, rails: { refuses: 2, plafonnes: 2 } };
  const t = T.fusion([un, un]);
  assert.equal(t.cuts, 6);assert.equal(t.off.pose, 4);assert.equal(t.on.pose, 6);assert.equal(t.transitions['differe > pose'], 2);assert.equal(t.resume.nouveauxPoses.n, 2);assert.equal(t.rails.plafonnes, 4);
  assert.match(T.texte(t), /nouveaux posés 2/);
});
