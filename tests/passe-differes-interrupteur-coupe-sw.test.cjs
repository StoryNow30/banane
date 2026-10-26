'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md) — INTERRUPTEUR DE LA DEUXIÈME PASSE dans Réglages (« Règles et choix du prochain lot », case « écrit dans ESV ») :
 * gardé par l'action existante `choix-lot` (clé `banane51PasseDifferes`), lu à la fin de chaque lot, à chaque relance et avant chaque cut écrit. Absent : allumée (livrée) ;
 * `false` ou toute autre valeur : coupée, ni calcul, ni écriture, rien au panneau. Service worker réel, ESV simulé (tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, ev } = require('./helpers/passe-differes.cjs');
const CLE = 'banane51PasseDifferes';

/* Une valeur gardée : la passe d'un lot entier pour `false` et `'true'`, la lecture seule (celle que la fin du lot, la relance et chaque cut écrit font) pour les autres. */
test('interrupteur coupé (false, ou valeur illisible) : la passe ne part pas, rien n’est envoyé à ESV, la relance est refusée', async () => {
  for (const v of [false, 'true']) {
    const x = await lotPasse({ passe: { passes: 1 }, stockage: { [CLE]: v } });
    assert.equal((await x.b.api('choix-lot-etat')).passeDifferes, false, JSON.stringify(v));
    assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin'), []); assert.deepEqual(ev(x.b, 'passe-differes-ombre'), []);
    assert.equal(x.b.get('vuePanneau')().passeDifferes, undefined);
    x.adapter.identity.cut = 114;
    await assert.rejects(x.b.api('passe-differes-ecrire'), /Deuxième passe coupée dans Réglages/);
    assert.deepEqual(x.pasPasse, []); assert.ok(!x.adapter.calls.includes('goToCut'));
    if (v !== false) continue;
    for (const w of [1, null, {}]) { await x.b.ctx.chrome.storage.local.set({ [CLE]: w }); assert.equal(await x.b.get('passeDiffAllumee')(), false, JSON.stringify(w)); }
  }
});
