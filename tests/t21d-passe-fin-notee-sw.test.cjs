'use strict';
/* T21d (D-250, priorité 2) — LA DEUXIÈME PASSE SURVIT AU REDÉMARRAGE DU SERVICE WORKER : FIN NOTÉE : au réveil, la passe a été coupée dans Réglages ; la relecture qui l'attendait part ensuite.
 * Montage : tests/helpers/passe-redemarrage.cjs (deux vies du service worker, la première gelée comme un service worker tué). Lot 111 à 116, différés
 * 112, 113 et 114 ; le 114 est « rien » au premier tour, « valider » au second ; passe en écriture (livrée), deux tours. Sans redémarrage
 * (t21d-passe-sans-redemarrage-sw) : décisions 112, 113 (tour 1, poserait), 114 (tour 1, rien), 114 (tour 2, poserait), puis écritures 112, 113, 114. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, bilan, CLE } = require('./helpers/passe-redemarrage.cjs');
const j = x => JSON.parse(JSON.stringify(x ?? null));
const OPTS = { sansPoints: [112, 113, 114, 116], fin: 116, decider: (cut, n) => cut === 114 && n < 2 ? 'rien' : 'valider' };
const DECISIONS = [[112, 1, 'poserait'], [113, 1, 'poserait'], [114, 1, 'rien'], [114, 2, 'poserait']], ECRITS = [112, 113, 114];
const decisions = B => B.dec.map(d => d.slice(0, 3)), ecrits = B => B.ecr.filter(e => e[1] === 'ecrit').map(e => e[0]);
test('interrupteur coupé pendant l’arrêt : fin notée (motif sw-redemarre), aucune décision ni écriture de plus ; la relecture (ombre) part ensuite', async () => {
  const M = montage({ ...OPTS, relecture: 'ombre' });
  M.tuer(o => o[CLE]?.phase === 'ombre' && o[CLE].index >= 2, { avant: true });
  const v1 = await M.lot(); assert.equal(v1.gelee, true);
  assert.equal(M.ev('relecture-debut').length, 0, 'vie 1 : la relecture attendait la passe');
  M.local.m.banane51PasseDifferes = false;
  await M.reveil(); const B = bilan(M);
  const fin = M.ev('passe-differes-ombre-fin'); assert.equal(fin.length, 1); assert.deepEqual([fin[0].issue, fin[0].motif], ['interrompue', 'sw-redemarre']); assert.match(fin[0].raison, /interrupteur/);
  assert.deepEqual(decisions(B), [[112, 1, 'poserait']]); assert.deepEqual(B.enPlace, {}); assert.equal(B.etat, null); assert.equal('banane56PasseDiffEntree' in M.local.m, false);
  assert.equal(M.ev('relecture-debut').length, 1, 'la relecture qui devait suivre est partie'); assert.equal(M.ev('passe-differes-reprise').length, 0);
});
