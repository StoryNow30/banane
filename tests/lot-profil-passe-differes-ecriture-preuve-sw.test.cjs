'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : la preuve de la validation (montage : tests/helpers/passe-differes.cjs). Une validation refusée avant
 * l'envoi remet la pose d'avant ; une validation envoyée dont l'écriture n'est pas vue laisse la pose, note l'intention et arrête la passe : le cut est à contrôler dans ESV. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, K, base } = require('./helpers/passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x)), ECRITURE = { passes: 1 };

test('écriture : validation refusée avant l’envoi : la pose d’avant est remise, rien n’est compté, la passe s’arrête', async () => {
  const x = await relancer(await lotPasse({ passe: ECRITURE, opts: { refusAvantEnvoi: true } }));
  assert.deepEqual(x.pasPasse, ['goToCut', 'goToCut', 'capture', 'apply', 'validateInPlace', 'restore']);
  assert.ok(K.equalPoses(x.adapter.rails, base.rails, .001), 'la pose d’avant est remise');
  const e = ev(x.b, 'passe-differes-ecriture'); assert.deepEqual(e.map(q => [q.identity.cut, q.resultat]), [[112, 'refuse']]); assert.match(e[0].raison, /validation refusée avant l’envoi.*pose remise/);
  assert.equal(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes).length, 0);
  assert.deepEqual(j(await x.b.get('relectureIntentions')()), [], 'intention effacée');
});

test('écriture : validation envoyée sans écriture vue : la pose reste, l’intention est notée, la passe s’arrête, rien n’est compté', async () => {
  const x = await relancer(await lotPasse({ passe: ECRITURE, ecritureVue: false }));
  assert.deepEqual(x.pasPasse, ['goToCut', 'goToCut', 'capture', 'apply', 'validateInPlace'], 'ni remise ni cut suivant');
  const e = ev(x.b, 'passe-differes-ecriture'); assert.deepEqual(e.map(q => [q.identity.cut, q.resultat]), [[112, 'incertain']]); assert.match(e[0].raison, /validation incertaine.*aucune écriture de validation vue.*Contrôle ce cut dans ESV/);
  assert.equal(ev(x.b, 'passe-differes-ecriture-fin').at(-1).issue, 'incertain');
  assert.equal(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes).length, 0);
  assert.deepEqual(j(await x.b.get('relectureIntentions')()).map(q => q.cut), [112], 'le cut à contrôler est noté');
  await assert.rejects(x.b.api('start', { part: 23, start: 111, end: 112 }), /Une correction de la deuxième passe a été interrompue au cut 112/);
  await assert.rejects(x.b.api('passe-differes-ecrire'), /Une correction de la deuxième passe a été interrompue au cut 112/, 'pas de relance tant que le cut n’est pas contrôlé');
  /* La garde de la passe elle-même (départ automatique) dit la même chose. */
  await x.b.get('passeDiffEcrireDemande')(); await x.b.get('passeDiff').cours;
  assert.match(ev(x.b, 'passe-differes-ecriture-fin').at(-1).raison, /^une correction de la deuxième passe a été interrompue au cut 112/);
});
