'use strict';
/* CH-026-b — COURSE À LA FIN DU LOT. Mesuré sur la maquette (integration/t27, essai file-parties, 30/10 17:16) : la dernière pose (cut 103) part en
 * validation sur place ; le moteur marque la fin du lot (`batch-stopped-at-end`) AVANT que la validation soit acceptée (25 ms plus tard) ; le tic de la
 * file voyait le lot clos, lisait « pose d'Ariane au cut 103 non validée » et arrêtait la file en « ecriture-incertaine ». La file doit attendre que la
 * boucle du lot soit finie (`engine.task`) avant de classer le lot ; une pose vraiment laissée sans validation, boucle finie, l'arrête toujours.
 * Service worker réel en VM, lot simulé (tests/helpers/file-parties-sw.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer, attendre } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);

test('lot clos pendant que sa dernière validation est en vol : la file attend la fin de la boucle du lot, puis continue (pas d’« ecriture-incertaine »)', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  const eng = M.engine(); let finir; eng.task = new Promise(r => { finir = r; });
  eng.s.applied = { identity: { part: 23, cut: 9 } }; M.clore();
  await attendre(200);
  assert.equal(M.etat().etat, 'lot', `la file attend : ${JSON.stringify(M.etat().motifFin)}`);
  eng.s.applied = null; eng.task = null; finir();
  await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture attendue');
  assert.equal(M.etat().bilan.length, 0); assert.ok(!M.journal('file-parties').some(e => e.motif === 'ecriture-incertaine'));
});

test('boucle du lot finie avec une pose vraiment non validée : la file s’arrête toujours en « ecriture-incertaine »', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  M.engine().s.applied = { identity: { part: 23, cut: 9 } }; M.clore();
  await M.jusqua(() => M.etat()?.etat === 'arret', 2000, 'arrêt');
  assert.equal(M.etat().motifFin.code, 'ecriture-incertaine'); assert.match(M.etat().motifFin.detail, /pose d’Ariane au cut 9 non validée/);
});
