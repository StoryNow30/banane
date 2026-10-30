'use strict';
/* CH-026-c — UNE ACTIVITÉ DU LOT QUI ÉCRIT N'EST PAS UNE ÉCRITURE EN SUSPENS. Constat de l'opérateur sur un vrai ESV (4.9.5.27, 30/10) : pendant la
 * relecture de la partie 4, la file affichait « File arrêtée · pose écrite non validée (écriture de la deuxième passe en vol) » et la partie
 * « interrompue · relecture — », alors que la relecture tournait. Cause : à la fin du lot, la deuxième passe (en écriture depuis D-259) démarre
 * aussitôt ; le tic de la file classait le lot avec un registre qui compte l'écriture de la passe en vol, et arrêtait la file (sans rien arrêter
 * d'autre). Le lot se classe sur SES écritures (moteur) ; la passe se juge à sa fin ; la relecture à la sienne. Service worker réel en VM, lot simulé. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer, attendre } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);

test('lot clos alors que la deuxième passe écrit déjà : la file passe à « passe » et l’attend, pas d’« ecriture-incertaine » ; la passe finie, la relecture', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  const P = M.b.get('passeDiff'); P.ecriture = { attente: { cut: 5346 } }; P.etat = { ecriture: { enVol: true } };
  M.clore(); await attendre(200);
  assert.equal(M.etat().etat, 'passe', `la file attend la passe : ${JSON.stringify(M.etat().motifFin)}`);
  P.ecriture = null; P.etat = { ecriture: { enVol: false } };
  await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture attendue');
  assert.ok(!M.journal('file-parties').some(e => e.motif === 'ecriture-incertaine'));
});

test('passe finie avec une écriture vraiment restée en vol : la file s’arrête toujours en « ecriture-incertaine »', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  M.clore(); await M.jusqua(() => M.etat()?.etat === 'passe', 2000, 'passe');
  M.b.get('passeDiff').etat = { ecriture: { enVol: true } };
  await M.jusqua(() => M.etat()?.etat === 'arret', 3000, 'arrêt');
  assert.equal(M.etat().motifFin.code, 'ecriture-incertaine'); assert.match(M.etat().motifFin.detail, /deuxième passe en vol/);
});

test('file arrêtée (pose du lot vraiment non validée), la relecture de la partie finit ensuite : son issue va au bilan, plus de « relecture — »', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  const lotId = M.etat().partie.lotId; M.engine().s.applied = { identity: { part: 23, cut: 9 } }; M.clore();
  await M.jusqua(() => M.etat()?.etat === 'arret', 2000, 'arrêt');
  let v = (await M.b.api('file-etat')).file; assert.equal(v.bilan[0].relecture, null);
  M.b.get('relecture').passe = { gen: 7, lotId, mode: 'corriger', modeEffectif: 'corriger', etat: 'en-cours', total: 220, faits: 66, corriges: 6 };
  v = (await M.b.api('file-etat')).file; assert.equal(v.bilan[0].relecture, null, 'relecture en cours : rien de porté');
  Object.assign(M.b.get('relecture').passe, { etat: 'finie', faits: 220, corriges: 14 });
  v = (await M.b.api('file-etat')).file;
  assert.deepEqual({ ...v.bilan[0].relecture }, { issue: 'finie', corriges: 14, faits: 220, mode: 'corriger', apresArret: true });
  assert.equal(v.etat, 'arret'); assert.equal(v.motifFin.code, 'ecriture-incertaine', 'la file reste arrêtée, le motif aussi');
  assert.equal(M.journal('file-parties-bilan-complete').length, 1);
});
