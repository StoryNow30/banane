'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md) — INTERRUPTEUR DE LA DEUXIÈME PASSE dans Réglages (« Règles et choix du prochain lot », case « écrit dans ESV ») :
 * gardé par l'action existante `choix-lot` (clé `banane51PasseDifferes`), lu à la fin de chaque lot, à chaque relance et avant chaque cut écrit. Absent : allumée (livrée) ;
 * `false` ou toute autre valeur : coupée, ni calcul, ni écriture, rien au panneau. Service worker réel, ESV simulé (tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const CLE = 'banane51PasseDifferes';

test('interrupteur absent : allumée ; `choix-lot-etat` le dit ; `true` gardé : allumée aussi', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 } }));
  assert.equal((await x.b.api('choix-lot-etat')).passeDifferes, true);
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin').map(e => e.cuts), [[112], [112]], 'fin de lot, puis relance (décisions refaites)');
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112]);
  await x.b.ctx.chrome.storage.local.set({ [CLE]: true });
  assert.equal((await x.b.api('choix-lot-etat')).passeDifferes, true); assert.equal(await x.b.get('passeDiffAllumee')(), true);
});
