'use strict';
/* T21d (D-250, priorité 2) — LA DEUXIÈME PASSE SURVIT AU REDÉMARRAGE DU SERVICE WORKER : FIN NOTÉE : au réveil, le lot n'est plus celui de la passe.
 * Montage : tests/helpers/passe-redemarrage.cjs (deux vies du service worker, la première gelée comme un service worker tué). Lot 111 à 116, différés
 * 112, 113 et 114 ; le 114 est « rien » au premier tour, « valider » au second ; passe en écriture (livrée), deux tours. Sans redémarrage
 * (t21d-passe-sans-redemarrage-sw) : décisions 112, 113 (tour 1, poserait), 114 (tour 1, rien), 114 (tour 2, poserait), puis écritures 112, 113, 114. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, bilan, CLE } = require('./helpers/passe-redemarrage.cjs');
const j = x => JSON.parse(JSON.stringify(x ?? null));
const OPTS = { sansPoints: [112, 113, 114, 116], fin: 116, decider: (cut, n) => cut === 114 && n < 2 ? 'rien' : 'valider' };
const DECISIONS = [[112, 1, 'poserait'], [113, 1, 'poserait'], [114, 1, 'rien'], [114, 2, 'poserait']], ECRITS = [112, 113, 114];
const decisions = B => B.dec.map(d => d.slice(0, 3)), ecrits = B => B.ecr.filter(e => e[1] === 'ecrit').map(e => e[0]);
test('lot changé pendant l’arrêt : fin notée, rien de décidé ni d’écrit de plus, aucune relecture lancée pour un autre lot', async () => {
  const M = montage({ ...OPTS, relecture: 'ombre' });
  M.tuer(o => o[CLE]?.phase === 'ombre' && o[CLE].index >= 2, { avant: true });
  const v1 = await M.lot(); assert.equal(v1.gelee, true);
  M.store.state.batch.id = 'un-autre-lot';
  await M.reveil(); const B = bilan(M);
  const fin = M.ev('passe-differes-ombre-fin'); assert.equal(fin.length, 1); assert.deepEqual([fin[0].issue, fin[0].motif, fin[0].raison], ['interrompue', 'sw-redemarre', 'le lot a changé']);
  assert.deepEqual(decisions(B), [[112, 1, 'poserait']]); assert.deepEqual(B.enPlace, {}); assert.equal(B.etat, null); assert.equal(M.ev('relecture-debut').length, 0);
});
