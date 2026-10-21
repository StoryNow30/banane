'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md) — INTERRUPTEUR DE LA DEUXIÈME PASSE dans Réglages (« Règles et choix du prochain lot », case « écrit dans ESV ») :
 * gardé par l'action existante `choix-lot` (clé `banane51PasseDifferes`), lu à la fin de chaque lot, à chaque relance et avant chaque cut écrit. Absent : allumée (livrée) ;
 * `false` ou toute autre valeur : coupée, ni calcul, ni écriture, rien au panneau. Service worker réel, ESV simulé (tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');

test('`choix-lot` garde l’interrupteur (oui ou non seulement) ; coupé pendant l’écriture, la passe s’arrête avant le cut suivant', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  await assert.rejects(x.b.api('choix-lot', { passeDifferes: 'non' }), /Deuxième passe : oui ou non/);
  const valider = x.adapter.surValidation;
  x.adapter.surValidation = async cut => { await valider(cut); if (cut === 112) assert.equal((await x.b.api('choix-lot', { passeDifferes: false })).passeDifferes, false); };
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112], 'le 114 n’est pas écrit');
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(fin.issue, 'arret'); assert.equal(fin.ecrites, 1); assert.equal(fin.demandees, 2);
  assert.equal(x.b.get('vuePanneau')().passeDifferes.etat, 'arretee');
  /* Rallumée : la relance pose le cut qui reste. */
  await x.b.api('choix-lot', { passeDifferes: true }); await x.b.api('passe-differes-ecrire'); await x.b.get('passeDiff').cours;
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112, 114]); assert.equal(ev(x.b, 'passe-differes-ecriture-fin').at(-1).issue, 'fin');
});
