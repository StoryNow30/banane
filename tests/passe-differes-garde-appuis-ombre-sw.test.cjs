'use strict';
/* Garde A de la deuxième passe des différés (src/garde-passe-appuis.js, fiches/GARDE_PASSE_A.md), BRANCHÉE dans le service worker (`passeDiffOmbre`), en ombre comme en écriture.
 * Service worker réel en VM, ESV simulé (tests/helpers/passe-differes.cjs) : lot 111 à 115, les cuts 112 et 114 différés puis forcés à « valider » pendant la passe, à la pose
 * du 111 (38,4 mm du départ, pire rail). La chaîne normale du lot : 111, 113 et 115 (première passe). `surPasse` marque des voisins comme poses de L1 (GCV2 dans le lot),
 * comme le fait `lotCommands[cut].l1` pour une pose de la GCV2 dans le lot. Données synthétiques. Un lot par fichier (durée des essais). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, j, marquerL1, decisions } = require('./helpers/garde-appuis.cjs');

test('ombre, garde livrée : 112 et 114 poseraient (appui de la chaîne normale à 1 cut) ; l’événement porte la garde mesurée', async () => {
  const x = await lotPasse({ ecritureAllumee: false, passe: {}, deux: true });
  const dec = ev(x.b, 'passe-differes-ombre');
  assert.deepEqual(dec.map(e => [e.identity.cut, e.decision]), [[112, 'poserait'], [114, 'poserait']]);
  for (const e of dec) assert.deepEqual(j(e.garde), { bloque: false, motif: 'appui-normal', deplacementMm: 38.4, appuiNormalCuts: 1 });
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin')[0].cuts, [112, 114]);
});

test('réglage : garde illisible ou module absent, la passe est coupée ; clé absente : garde livrée', () => {
  const S = require('../src/settings.js'), { production } = require('./helpers/perf-production.cjs');
  const b = production({}), niveau = passe => { b.ctx.BananeSettings = { ...S, lot: { ...S.lot, passeDifferes: passe } }; return b.get('passeDiffReglage')(); };
  assert.deepEqual(j(niveau({}).garde), { ok: true, actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 });
  assert.equal(niveau({ gardeAppuis: { appuiNormalMaxCuts: 6 } }).garde.appuiNormalMaxCuts, 6);
  assert.equal(niveau({ gardeAppuis: { appuiNormalMaxCuts: 6 } }).garde.deplacementMaxMm, 100, 'clé par clé');
  assert.equal(niveau({ gardeAppuis: false }).mode, 'ombre'); assert.equal(niveau({ gardeAppuis: false }).garde.actif, false);
  for (const v of ['x', null, true, 0, [], { actif: 'oui' }, { deplacementMaxMm: -1 }, { appuiNormalMaxCuts: 1.5 }]) assert.equal(niveau({ gardeAppuis: v }).mode, 'off', JSON.stringify(v));
  assert.equal(niveau({ ecriture: true, gardeAppuis: 'x' }).mode, 'off', 'jamais d’écriture sans sa garde');
  const G = b.ctx.BananeGardePasseAppuis; b.ctx.BananeGardePasseAppuis = undefined;
  try { assert.equal(niveau({}).mode, 'off', 'module de la garde absent'); } finally { b.ctx.BananeGardePasseAppuis = G; }
  assert.equal(niveau({}).mode, 'ombre');
});
