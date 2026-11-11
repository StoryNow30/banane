'use strict';
/* CH-109 (B) — DANS UNE CONSTELLATION, UNE RELECTURE EN PAUSE QUI NE REPART PAS SEULE. Service worker réel en VM, faux adaptateur (tests/helpers/file-parties-sw.cjs).
 * Réglage `BananeSettings.file.relecturePauseMaxMs` : coupé (null, l'ancienne conduite : la file attend la relecture en pause SANS LIMITE) ; proposé 5 min.
 * Réglé : une relecture de la file restée en pause plus longtemps (rechargement CH-060 / CH-107 compris) est close « interrompue » ; la liste des cuts
 * non relus va au bilan de la partie ; la file passe à la partie suivante. Rien n'est écrit sur les cuts non relus (aucune commande ESV pendant la clôture). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer, FICHE, attendre } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);

/* Passe en pause au cut 7 (2e cut de la sélection 5, 7, 8, 9 ; plage 1 sautée) : non relus 7 et 8 (9 est dans une plage sautée). */
const enPause = M => { const lot = M.engine().s.batch;
  const point = { v: 1, lotId: lot.id, index: 1, faits: 1, total: 4, plagesSautees: [1], sel: { cuts: [{ cut: 5, plage: 0 }, { cut: 7, plage: 0 }, { cut: 8, plage: 0 }, { cut: 9, plage: 1 }], plages: [{ libelle: 'a' }, { libelle: 'b' }] }, savedAt: new Date().toISOString() };
  M.relire({ etat: 'en-pause', pauseRaison: 'esv', cut: 7, faits: 1, corriges: 0, point, reprise: true, debut: new Date().toISOString() });
  M.local.m.banane51RelectureReprise = point; return M.b.get('relecture').passe; };

test('réglage coupé (livré) : la file attend la relecture en pause sans limite, comme avant', async () => {
  const S = require('../src/settings.js'); assert.ok('relecturePauseMaxMs' in S.file); assert.equal(S.file.relecturePauseMaxMs, null, 'livré coupé');
  const M = montage({ fiche: { ...FICHE, relecturePauseMaxMs: null } }); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot'); M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture');
  enPause(M); await attendre(600);
  assert.equal(M.etat().etat, 'relecture'); assert.equal(M.b.get('relecture').passe.etat, 'en-pause');
});

test('réglé à 150 ms : relecture en pause close « interrompue », cuts non relus au bilan, rien écrit, la file passe à la partie suivante', async () => {
  const M = montage({ fiche: { ...FICHE, relecturePauseMaxMs: 150 } }); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot'); M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture');
  const p = enPause(M), avant = M.commandesEsv().length;
  await attendre(60); assert.equal(M.etat().etat, 'relecture', 'pas avant le délai');
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1, 3000, 'partie suivante');
  assert.equal(p.etat, 'arretee'); assert.equal(p.interrompue?.raison, 'pause-constellation');
  assert.deepEqual([...p.interrompue.nonRelus], [7, 8]);
  assert.match(p.message, /Relecture interrompue au cut 7 .*2 cuts non relus \(7, 8\).*rien n’a été écrit/);
  const bilan = M.etat().bilan[0];
  assert.equal(bilan.relecture.issue, 'interrompue'); assert.deepEqual([...bilan.relecture.nonRelus], [7, 8]);
  assert.ok(bilan.motifs.some(m => m.code === 'relecture-arretee'));
  /* Clôture : aucune commande vers ESV (seul le changement de partie suit). */
  assert.deepEqual(M.commandesEsv().slice(avant).filter(c => !/^(ping|readState|changerPartie|getState|state)/.test(c)), []);
  assert.equal('banane51RelectureReprise' in M.local.m, false, 'point de reprise effacé');
  const fin = M.journal('relecture-fin').at(-1); assert.equal(fin.issue, 'interrompue'); assert.deepEqual([...fin.nonRelus], [7, 8]);
});

test('réglé : une relecture qui repart avant le délai n’est pas close ; une passe en cours n’est jamais close', async () => {
  const M = montage({ fiche: { ...FICHE, relecturePauseMaxMs: 200 } }); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot'); M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture');
  const p = enPause(M); await attendre(120); p.etat = 'en-cours'; await attendre(400);
  assert.equal(M.etat().etat, 'relecture'); assert.equal(p.etat, 'en-cours');
  /* Nouvelle pause : le délai repart de zéro. */
  p.etat = 'en-pause'; await attendre(120); assert.equal(M.etat().etat, 'relecture', 'délai compté depuis la nouvelle pause');
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1, 3000, 'partie suivante');
});

test('réglé : une pause demandée par l’opérateur (« Pause ») n’est jamais close par la file', async () => {
  const M = montage({ fiche: { ...FICHE, relecturePauseMaxMs: 100 } }); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot'); M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture');
  const p = enPause(M); p.pauseRaison = 'mic'; await attendre(500);
  assert.equal(M.etat().etat, 'relecture'); assert.equal(p.etat, 'en-pause');
});

/* CH-109 (C) — LE CHANGEMENT DE PARTIE APRÈS UN F5 ATTEND QU'ESV REVIENNE, dans la borne `changementBorneMs`, au lieu de s'arrêter « esv-muet ». */
test('C : ESV muet au moment du changement de partie (page en rechargement), revenu dans la borne : la file change de partie et lance le lot suivant', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot'); M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture');
  M.adapter.muet = true; setTimeout(() => { M.adapter.muet = false; }, 250);
  M.relire();
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 1 && M.etat()?.partie?.lotId, 4000, 'lot de la partie 24');
  assert.equal(M.lots.at(-1).scope.part, 24);
  const a = M.journal('file-parties-esv-attente'); assert.equal(a.length, 1); assert.equal(a[0].issue, 'revenu');
});
test('C : ESV muet tout au long de la borne : arrêt « esv-muet » comme avant, après la borne', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot'); M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture');
  M.adapter.muet = true; const t = Date.now(); M.relire();
  await M.jusqua(() => M.etat()?.etat === 'arret', 4000, 'arrêt');
  assert.equal(M.etat().motifFin.code, 'esv-muet'); assert.ok(Date.now() - t >= FICHE.changementBorneMs - 50, 'après la borne : ' + (Date.now() - t));
  assert.equal(M.journal('file-parties-esv-attente')[0]?.issue, 'muet');
});
