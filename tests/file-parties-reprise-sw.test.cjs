'use strict';
/* CH-026 — REPRISE ET RELANCE DE LA FILE sans recharger l'extension. Service worker réel en VM, faux adaptateur (tests/helpers/file-parties-sw.cjs).
 * Une file arrêtée se reprend AU RANG INTERROMPU : `file-demarrer` {n: parties restantes, depuis: la partie du plan qui n'a pas fini} ; ESV doit
 * afficher cette partie, sinon refus en clair et rien ne change. Une file finie ou arrêtée se remplace par une nouvelle file d'un clic. Le journal
 * dit la file remplacée et la partie de reprise. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer, LOT_ARGS } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);

test('file de 2 parties arrêtée pendant la partie 23 (partie interrompue, au bilan) : reprise de 2 parties depuis la partie 23 (affichée) ; nouveau lot de la file sur 23', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  await M.b.api('file-arreter'); await M.jusqua(() => M.etat()?.etat === 'arret', 2000, 'arrêt');
  const avant = M.etat().id, vue = (await M.b.api('file-etat')).file;
  assert.deepEqual({ ...vue.reprise }, { rang: 0, part: 23, reste: 2 }, 'la partie 23, interrompue, est à refaire : reprise de 2 parties depuis 23');
  assert.equal(vue.bilan[0].interrompue, true);
  const v = await M.b.api('file-demarrer', { n: 2, depuis: 23, lotArgs: LOT_ARGS });
  assert.equal(v.file.etat, 'lot'); assert.deepEqual([...v.file.plan], [23, 24]); assert.notEqual(v.file.id, avant);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la reprise');
  assert.equal(M.lots.at(-1).scope.part, 23); assert.equal(M.lots.at(-1).scope.fileParties.rang, 0);
  const d = M.journal('file-parties').filter(e => e.evenement === 'demarrer');
  assert.equal(d.length, 2); assert.equal(d[1].reprise, 23); assert.deepEqual({ ...d[1].remplace }, { id: avant, etat: 'arret', faites: 0, n: 2 });
  const a = M.journal('file-parties').find(e => e.evenement === 'arreter'); assert.equal(a.origine, 'file-arreter');
});

test('reprise refusée si ESV n’affiche pas la partie interrompue : message clair, la file arrêtée reste telle quelle', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  await M.b.api('stop'); await M.jusqua(() => M.etat()?.etat === 'arret', 2000, 'arrêt par « Arrêter »');
  assert.equal(M.journal('file-parties').find(e => e.evenement === 'arreter').origine, 'stop');
  const avant = JSON.stringify(M.etat());
  M.engine().s.batch.state = 'STOPPED'; M.adapter.identity = { ...M.adapter.identity, part: 24 };
  await assert.rejects(M.b.api('file-demarrer', { n: 2, depuis: 23, lotArgs: LOT_ARGS }), /ESV affiche la partie 24 ; la reprise part de la partie 23/);
  assert.equal(JSON.stringify(M.etat()), avant);
  await assert.rejects(M.b.api('file-demarrer', { n: 2, depuis: 'x', lotArgs: LOT_ARGS }), /partie de reprise illisible/);
});

test('file finie : une nouvelle file part d’un clic depuis la partie affichée, sans « Oublier » ni recharger', async () => {
  const M = montage(); await M.vie(); await M.demarrer(1);
  await M.partie(0); await M.jusqua(() => M.etat()?.etat === 'fin', 3000, 'fin');
  M.engine().s.batch.state = 'STOPPED';
  const v = await M.b.api('file-demarrer', { n: 1, lotArgs: LOT_ARGS });
  assert.equal(v.file.etat, 'lot'); assert.equal(v.file.n, 1);
  const d = M.journal('file-parties').filter(e => e.evenement === 'demarrer');
  assert.equal(d.at(-1).remplace.etat, 'fin'); assert.equal(Object.hasOwn(d.at(-1), 'reprise'), false);
});

test('arrêt pendant la partie 24, la 23 finie : reprise de 2 parties (24 et 25) depuis la 24, la partie interrompue, pas depuis la 25', async () => {
  const M = montage(); await M.vie(); await M.demarrer(3);
  await M.partie(0);
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1 && M.etat()?.partie?.lotId, 3000, 'lot de la partie 24');
  await M.b.api('file-arreter'); await M.jusqua(() => M.etat()?.etat === 'arret', 2000, 'arrêt');
  const vue = (await M.b.api('file-etat')).file;
  assert.equal(JSON.stringify(vue.bilan.map(p => [p.part, !!p.interrompue])), '[[23,false],[24,true]]');
  assert.deepEqual({ ...vue.reprise }, { rang: 1, part: 24, reste: 2 });
});
