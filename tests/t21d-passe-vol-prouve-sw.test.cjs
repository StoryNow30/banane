'use strict';
/* T21d (D-250, priorité 2) — LA DEUXIÈME PASSE SURVIT AU REDÉMARRAGE DU SERVICE WORKER : ARRÊT APRÈS LA PREUVE D'UNE VALIDATION, AVANT L'EFFACEMENT DE SON INTENTION : le cut est compté écrit, l'écriture continue.
 * Montage : tests/helpers/passe-redemarrage.cjs (deux vies du service worker, la première gelée comme un service worker tué). Lot 111 à 116, différés
 * 112, 113 et 114 ; le 114 est « rien » au premier tour, « valider » au second ; passe en écriture (livrée), deux tours. Sans redémarrage
 * (t21d-passe-sans-redemarrage-sw) : décisions 112, 113 (tour 1, poserait), 114 (tour 1, rien), 114 (tour 2, poserait), puis écritures 112, 113, 114. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, bilan, CLE } = require('./helpers/passe-redemarrage.cjs');
const j = x => JSON.parse(JSON.stringify(x ?? null));
const OPTS = { sansPoints: [112, 113, 114, 116], fin: 116, decider: (cut, n) => cut === 114 && n < 2 ? 'rien' : 'valider' };
const DECISIONS = [[112, 1, 'poserait'], [113, 1, 'poserait'], [114, 1, 'rien'], [114, 2, 'poserait']], ECRITS = [112, 113, 114];
const decisions = B => B.dec.map(d => d.slice(0, 3)), ecrits = B => B.ecr.filter(e => e[1] === 'ecrit').map(e => e[0]);
test('arrêt juste après la preuve du 113 : compté écrit (rattrapé), intention effacée, le 114 est écrit ensuite ; une validation par cut', async () => {
  const M = montage(OPTS);
  M.tuer(o => o[CLE]?.ecriture?.prouves?.includes(113), { avant: false });
  const v1 = await M.lot(); assert.equal(v1.gelee, true);
  assert.deepEqual((M.local.m.banane50RelectureIntention || []).map(x => x.cut), [113], 'gelée avant l’effacement de l’intention');
  await M.reveil(); const B = bilan(M);
  assert.deepEqual(B.enPlace, { 112: 1, 113: 1, 114: 1 }); assert.deepEqual(ecrits(B), ECRITS);
  const e113 = M.ev('passe-differes-ecriture').filter(e => e.identity.cut === 113); assert.equal(e113.length, 1); assert.equal(e113[0].recupere, 'sw-redemarre');
  assert.equal(M.ev('validation-accepted').filter(e => e.passeDifferes && e.identity.cut === 113).length, 1, 'une seule validation consignée pour le 113');
  assert.deepEqual(B.intentions, []); assert.equal(M.ev('passe-differes-ecriture-fin').at(-1).issue, 'fin'); assert.equal(M.ev('passe-differes-ecriture-fin').at(-1).ecrites, 3);
  assert.equal(M.ev('passe-differes-reprise')[0].enVol, 'ecrit'); assert.equal(B.etat, null);
});
