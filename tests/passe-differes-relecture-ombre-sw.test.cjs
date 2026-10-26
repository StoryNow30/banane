'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, seconde relecture, point 4) — une deuxième passe EN OMBRE (calcul seul, rien vers ESV) ne bloque pas la relecture. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse } = require('./helpers/passe-differes.cjs');

test('passe en ombre en cours de calcul au départ de la relecture : la relecture part', async () => {
  const x = await lotPasse({ passe: { passes: 1, ecriture: false }, relecture: 'ombre' });
  x.adapter.identity.cut = 114;
  const ping = x.adapter.ping.bind(x.adapter); let calcul = false;
  x.adapter.ping = async (...a) => { if (!calcul && x.b.get('relecture').passe?.etat === 'preparation') { calcul = true; x.b.get('passeDiff').cours = new Promise(() => {}); } return ping(...a); };
  await x.b.api('relecture-lancer');
  assert.ok(calcul); assert.equal(x.b.store.events.filter(e => e.type === 'relecture-debut').length, 1);
  await x.b.api('relecture-arreter'); await x.b.get('relecture').tache;
});
