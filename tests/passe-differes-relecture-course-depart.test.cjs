'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, relecture adversariale) — la deuxième passe et la relecture n'écrivent jamais ensemble dans ESV. Lot arrêté sur une pose non
 * validée (la passe ne part pas) ; l'opérateur valide, lance la relecture, puis clique « Relancer la deuxième passe » pendant qu'elle se prépare : la relance est refusée,
 * la relecture part seule. Dans l'autre ordre, une relecture qui trouverait la passe au travail au moment de partir ne part pas. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse } = require('./helpers/passe-differes.cjs');

test('relecture qui trouve la deuxième passe au travail au moment de partir : non lancée', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, relecture: 'ombre' });
  x.adapter.identity.cut = 114;
  const lot = x.b.get('engine').s.batch; lot.stoppedAtEnd = { ...lot.stoppedAtEnd, at: new Date(Date.now() - 60000).toISOString() };
  const ping = x.adapter.ping.bind(x.adapter); let pose = false;
  x.adapter.ping = async (...a) => { if (!pose && x.b.get('relecture').passe?.etat === 'preparation') { pose = true; x.b.get('passeDiff').ecriture = { arret: false, attente: null }; } return ping(...a); };
  await assert.rejects(x.b.api('relecture-lancer'), /la deuxième passe des différés travaille dans ESV/);
  assert.equal(x.b.store.events.filter(e => e.type === 'relecture-debut').length, 0);
});
