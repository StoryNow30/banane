'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, relecture adversariale) — la deuxième passe et la relecture n'écrivent jamais ensemble dans ESV. Lot arrêté sur une pose non
 * validée (la passe ne part pas) ; l'opérateur valide, lance la relecture, puis clique « Relancer la deuxième passe » pendant qu'elle se prépare : la relance est refusée,
 * la relecture part seule. Dans l'autre ordre, une relecture qui trouverait la passe au travail au moment de partir ne part pas. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, ev } = require('./helpers/passe-differes.cjs');
const attendre = ms => new Promise(r => setTimeout(r, ms));

test('relecture en préparation : « Relancer la deuxième passe » est refusée, rien n’est écrit par la passe pendant la relecture', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, relecture: 'ombre' });
  x.adapter.identity.cut = 114;
  const lot = x.b.get('engine').s.batch; lot.stoppedAtEnd = { ...lot.stoppedAtEnd, at: new Date(Date.now() - 60000).toISOString() };
  const ping = x.adapter.ping.bind(x.adapter); let relance = null;
  x.adapter.ping = async (...a) => { if (!relance && x.b.get('relecture').passe?.etat === 'preparation') relance = x.b.api('passe-differes-ecrire').then(() => 'acceptée', e => e.message); return ping(...a); };
  await x.b.api('relecture-lancer');
  assert.match(await relance, /Relecture après le lot en préparation/);
  /* La relecture est partie seule ; on l'arrête (l'essai n'a pas besoin de ses 61 cuts). */
  assert.equal(x.b.store.events.filter(e => e.type === 'relecture-debut').length, 1);
  await x.b.api('relecture-arreter');
  for (let i = 0; i < 300 && x.b.get('relecture').passe?.etat === 'en-cours'; i++) await attendre(20);
  assert.equal(x.b.get('relecture').passe.etat, 'arretee');
  assert.equal(ev(x.b, 'passe-differes-ecriture').length, 0, 'aucune pose de la passe'); assert.deepEqual(x.adapter.enPlace, []);
});
