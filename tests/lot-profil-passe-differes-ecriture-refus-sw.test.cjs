'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : ce qu'elle refuse et comment elle s'arrête (montage : tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x));

test('écriture : un cut que la liste d’ESV dit vert n’est jamais écrasé ; la passe s’arrête à la première pose non écrite', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true, statuts: { 112: 'valid' } }));
  assert.deepEqual(x.pasPasse, ['goToCut', 'capture'], 'lectures seulement : ni pose ni validation, et le cut 114 n’est pas visité');
  const e = ev(x.b, 'passe-differes-ecriture'); assert.deepEqual(e.map(q => [q.identity.cut, q.resultat]), [[112, 'refuse']]); assert.match(e[0].raison, /valid.*pas un cut rouge, rien n’est écrasé/);
  assert.equal(ev(x.b, 'passe-differes-ecriture-fin').at(-1).issue, 'refuse');
  assert.equal(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes).length, 0);
  assert.deepEqual([j(x.b.get('vuePanneau')().passeDifferes)].map(v => [v.etat, v.ecrites]), [['arretee', 0]]);
});

test('écriture : « Arrêter » du panneau arrête la passe avant le cut suivant', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true, opts: { arreterApres: 112 } }));
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112], 'le 114 n’est pas écrit');
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(fin.issue, 'arret'); assert.equal(fin.ecrites, 1); assert.equal(fin.demandees, 2);
});

test('écriture : une relecture choisie attend la passe (elle ne la bloque pas) et part après elle', async () => {
  const x = await relancer(await lotPasse({ passe: { passes: 1 }, deux: true, relecture: 'ombre' }));
  assert.match(x.refus.raison, /pose d’Ariane attend ta validation au cut 115/, 'refus pour la pose en attente, pas pour la relecture en préparation');
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112, 114]);
  const fins = x.b.store.events.map(e => e.type).filter(t => /^(passe-differes-ecriture-fin|relecture-fin)$/.test(t));
  assert.deepEqual(fins.slice(0, 2), ['passe-differes-ecriture-fin', 'relecture-fin'], 'la relecture ne part qu’après la passe');
});

test('écriture : une relecture en pause tient ESV, la passe n’y écrit pas', async () => {
  const x = await lotPasse({ passe: { passes: 1 } });
  x.b.get('relecture').passe = { etat: 'en-pause' };
  x.adapter.identity.cut = 116; await x.b.api('passe-differes-ecrire'); await x.b.get('passeDiff').cours;
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(fin.issue, 'refus-depart'); assert.match(fin.raison, /relecture est en cours ou en pause/);
  assert.deepEqual(x.adapter.enPlace, []);
});
