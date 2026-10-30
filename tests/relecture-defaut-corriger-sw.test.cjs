'use strict';
/* Test 27 (CH-026, ordre de l'opérateur du 30/10) : la relecture après le lot est « corriger » PAR DÉFAUT et ne se règle plus. Service worker réel en VM
 * (tests/helpers/file-parties-sw.cjs, lot simulé : on lit le scope que le vrai « Démarrer » calcule). Un choix gardé par une version précédente
 * (« coupée », « ombre ») ne compte plus ; `relectureDefaut.modifiable:true` rend le choix d'avant. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer, LOT_ARGS, S } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);

const lancer = async M => { const b = await M.vie(); await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  await b.api('start', { part: 23, start: 5, end: 9, ...LOT_ARGS }); return M.lots.at(-1).scope; };

test('src/settings.js : relecture « corriger » par défaut, non modifiable, gelée', () => {
  assert.deepEqual({ ...S.relectureDefaut }, { mode: 'corriger', modifiable: false }); assert.ok(Object.isFrozen(S.relectureDefaut));
});

for (const garde of [undefined, 'coupee', 'ombre']) {
  test(`lot sans file, choix gardé ${garde ?? 'absent'} : le scope porte la relecture « corriger »`, async () => {
    const M = montage(); if (garde) M.local.m.banane50Relecture = garde;
    assert.equal((await lancer(M)).relecture, 'corriger');
  });
}

test('`relectureDefaut.modifiable:true` : le choix gardé revient (coupée par défaut, rien dans le scope)', async () => {
  const M = montage(), b = await M.vie();
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, relectureDefaut: { mode: 'corriger', modifiable: true } };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  await b.api('start', { part: 23, start: 5, end: 9, ...LOT_ARGS });
  assert.equal(Object.hasOwn(M.lots.at(-1).scope, 'relecture'), false);
});
