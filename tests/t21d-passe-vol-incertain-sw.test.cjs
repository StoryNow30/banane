'use strict';
/* T21d (D-250, priorité 2) — LA DEUXIÈME PASSE SURVIT AU REDÉMARRAGE DU SERVICE WORKER : ARRÊT PENDANT UNE ÉCRITURE EN VOL (validation envoyée, preuve non vue) : écriture incertaine, la passe s'arrête, jamais réécrite (D-248).
 * Montage : tests/helpers/passe-redemarrage.cjs (deux vies du service worker, la première gelée comme un service worker tué). Lot 111 à 116, différés
 * 112, 113 et 114 ; le 114 est « rien » au premier tour, « valider » au second ; passe en écriture (livrée), deux tours. Sans redémarrage
 * (t21d-passe-sans-redemarrage-sw) : décisions 112, 113 (tour 1, poserait), 114 (tour 1, rien), 114 (tour 2, poserait), puis écritures 112, 113, 114. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, bilan, CLE } = require('./helpers/passe-redemarrage.cjs');
const j = x => JSON.parse(JSON.stringify(x ?? null));
const OPTS = { sansPoints: [112, 113, 114, 116], fin: 116, decider: (cut, n) => cut === 114 && n < 2 ? 'rien' : 'valider' };
const DECISIONS = [[112, 1, 'poserait'], [113, 1, 'poserait'], [114, 1, 'rien'], [114, 2, 'poserait']], ECRITS = [112, 113, 114];
const decisions = B => B.dec.map(d => d.slice(0, 3)), ecrits = B => B.ecr.filter(e => e[1] === 'ecrit').map(e => e[0]);
test('arrêt pendant la validation du 113 (envoyée, écriture « valid » pas encore vue) : incertain, intention gardée, rien de réécrit ni d’écrit ensuite', async () => {
  const M = montage(OPTS);
  M.surValidationVie = (cut, v) => { if (v.n === 1 && cut === 113) v.geler(); };
  const v1 = await M.lot(); assert.equal(v1.gelee, true);
  assert.equal(M.etat().ecriture.enVol.cut, 113); assert.deepEqual(M.etat().ecriture.prouves, [112]);
  const v2 = await M.reveil(); const B = bilan(M);
  assert.deepEqual(B.enPlace, { 112: 1, 113: 1 }, 'le 113 n’est jamais revalidé ; le 114 n’est pas écrit');
  const e113 = M.ev('passe-differes-ecriture').filter(e => e.identity.cut === 113); assert.equal(e113.length, 1); assert.equal(e113[0].resultat, 'incertain'); assert.equal(e113[0].reprise, 'sw-redemarre');
  const fin = M.ev('passe-differes-ecriture-fin'); assert.equal(fin.length, 1); assert.deepEqual([fin[0].issue, fin[0].motif], ['incertain', 'sw-redemarre']); assert.match(fin[0].raison, /cut 113/);
  assert.deepEqual(B.intentions, [113], 'l’intention reste : « J’ai contrôlé le cut 113 »'); assert.equal(B.etat, null);
  assert.equal(M.ev('passe-differes-reprise').length, 0, 'pas de reprise : fin notée');
  /* D-248 : rien ne repart tant que le cut n'est pas contrôlé (relance de la passe, nouveau lot). */
  await assert.rejects(v2.b.api('passe-differes-ecrire'), /interrompue au cut 113/);
  assert.equal(j(v2.b.get('vuePanneau')().passeDifferes).etat, 'arretee');
});
