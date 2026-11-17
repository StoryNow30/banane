'use strict';
/* D-363 (opérateur, 17/11) — un refus AVANT toute pose n'arrête plus la deuxième passe ; au redémarrage du service worker, la reprise repart APRÈS le cut refusé,
 * jamais sur lui, et ne compte pas le cut refusé comme écrit. Montage : tests/helpers/passe-redemarrage.cjs (comme t21d-passe-vol-avant-pose-sw) ; le 112 est vert
 * dans la liste d'ESV (refusé avant la pose : « rien n'est écrasé »), la vie 1 est tuée au début du 113. Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, bilan, CLE } = require('./helpers/passe-redemarrage.cjs');
const OPTS = { sansPoints: [112, 113, 114, 116], fin: 116, decider: (cut, n) => cut === 114 && n < 2 ? 'rien' : 'valider' };
const ecrits = B => B.ecr.filter(e => e[1] === 'ecrit').map(e => e[0]);
test('112 refusé avant la pose, arrêt au début du 113 : reprise sur le 113, 112 jamais refait ni compté écrit', async () => {
  const M = montage(OPTS); M.adapter.statuts[112] = 'valid';
  M.tuer(o => o[CLE]?.ecriture?.enVol?.cut === 113, { avant: false });
  const v1 = await M.lot(); assert.equal(v1.gelee, true); assert.deepEqual(M.adapter.enPlace.map(e => e.cut), [], 'vie 1 : rien d’écrit (112 refusé)');
  await M.reveil(); const B = bilan(M);
  assert.deepEqual(B.enPlace, { 113: 1, 114: 1 }); assert.deepEqual(ecrits(B), [113, 114]);
  const refus = M.ev('passe-differes-ecriture').filter(e => e.resultat === 'refuse').map(e => e.identity.cut); assert.deepEqual(refus, [112], 'le 112 n’est pas revisité au réveil');
  assert.equal(M.ev('passe-differes-ecriture-fin').at(-1).issue, 'fin');
});
