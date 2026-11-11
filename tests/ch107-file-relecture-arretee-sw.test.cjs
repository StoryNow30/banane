'use strict';
/* CH-107 — CONSTELLATION : la relecture d'une partie s'arrête sur une série de cuts sans point (pause et reprise éteintes) ; la file continue,
 * la partie suivante démarre normalement, et le bilan de la partie dit la relecture arrêtée (motif `relecture-arretee`, issue « erreur »), pas « finie ».
 * Service worker réel en VM, file réelle, lot simulé (tests/helpers/file-parties-sw.cjs). La relecture y est un ÉTAT posé (comme dans les essais de la
 * file) : celui que la garde laisse, avec son message ; la garde elle-même est essayée dans tests/ch107-relecture-points-vides.test.cjs. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const j = x => JSON.parse(JSON.stringify(x ?? null));
const { montage, fermer } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);
const MESSAGE = 'Relecture arrêtée au cut 113 : ESV n’affiche plus les points (3 cuts de suite sans point, dès le cut 113). 4 cuts non relus, du cut 113 au cut 116 ; rien n’a été écrit sur ces cuts. Recharge ESV (F5) puis relance la relecture.';

test('relecture arrêtée par la série de cuts vides : la file passe à la partie suivante, le bilan dit « relecture arrêtée » avec le message', async () => {
  const M = montage(); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === 0 && M.etat()?.partie?.lotId, 3000, 'lot 1');
  M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture attendue');
  M.relire({ etat: 'erreur', total: 7, faits: 3, corriges: 1, message: MESSAGE });
  /* La partie suivante démarre normalement (lot de rang 1), puis la file finit. */
  await M.partie(1); await M.jusqua(() => M.etat()?.etat === 'fin', 3000, 'fin de file');
  const bilan = j(M.etat().bilan);
  assert.equal(bilan.length, 2); assert.equal(M.etat().motifFin?.code ?? M.etat().motifFin, 'nombre-atteint');
  assert.deepEqual(bilan[0].motifs.map(m => m.code), ['fin-normale', 'relecture-arretee']);
  assert.equal(bilan[0].motifs[1].detail, MESSAGE, 'le bilan garde le message : cut d’arrêt et cuts non relus');
  assert.equal(bilan[0].relecture.issue, 'erreur'); assert.notEqual(bilan[0].relecture.issue, 'finie');
  assert.deepEqual(bilan[1].motifs.map(m => m.code), ['fin-normale']); assert.equal(bilan[1].relecture.issue, 'finie');
  assert.ok(M.commandesEsv().includes('changerPartie'), 'changement de partie envoyé');
});
