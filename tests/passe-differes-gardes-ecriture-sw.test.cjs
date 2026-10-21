'use strict';
/* Test 18 (fiches/PASSATION_T17_INTEGRATION.md, relecture adversariale, points 2 à 4) — CHAQUE GARDE D'ÉCRITURE DE LA DEUXIÈME PASSE, une par essai (tests/helpers/passe-differes.cjs :
 * lot 111 à 115, 112 et 114 différés puis décidés « valider » en fin de lot ; le lot s'arrête sur une pose non validée, l'opérateur la valide, la passe est relancée).
 * Chaque essai rougit si la garde est retirée. Aucune garde ne laisse partir une pose ni une validation vers ESV, sauf la preuve de validation (pose envoyée, gardée, à contrôler). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, K } = require('./helpers/passe-differes.cjs');
const ecrit = x => x.pasPasse.filter(c => c === 'apply' || c === 'validateInPlace');
const fin = x => ev(x.b, 'passe-differes-ecriture-fin').at(-1);

test('le cut n’est posé qu’atteint par un pas (boutons d’ESV), jamais juste après un saut de la carte', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  const aller = x.adapter.goToCut.bind(x.adapter);
  x.adapter.goToCut = async (t, o, id) => ({ ...await aller(t, o, id), chemin: 'evenement' });
  await relancer(x);
  assert.deepEqual(x.pasPasse, ['goToCut', 'goToCut'], 'saut au cut d’avant, puis pas demandé ; rien de lu ni d’écrit');
  assert.equal(fin(x).issue, 'refuse'); assert.match(fin(x).raison, /atteint par la carte \(saut\) : pas de pose juste après un saut/);
});

test('cut bloqué par un résultat incertain archivé : rien n’est écrit', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  x.b.get('engine').s.blockedTargets = [K.key({ ...x.adapter.identity, cut: 112 })];
  await relancer(x);
  assert.deepEqual(ecrit(x), []); assert.match(fin(x).raison, /cible bloquée par un résultat incertain archivé/);
});

test('pose d’ESV du cut changée depuis la visite du lot (1 mm) : rien n’est écrit', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  const aller = x.adapter.goToCut.bind(x.adapter);
  x.adapter.goToCut = async (t, o, id) => { const r = await aller(t, o, id); if (t.cut === 112) x.adapter.rails.left.railLocalToSceneRelative[12] += 0.005; return r; };
  await relancer(x);
  assert.deepEqual(ecrit(x), []); assert.match(fin(x).raison, /pose d’ESV du cut changée depuis la visite du lot/);
});

test('cut rouge mais « traité par un opérateur » dans la liste d’ESV : jamais écrasé', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  x.adapter.operateur = [112];
  await relancer(x);
  assert.deepEqual(ecrit(x), []); assert.match(fin(x).raison, /invalid, traité par un opérateur/);
});

test('cible hors de la vue : la passe ne déplace pas la vue, rien n’est écrit', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  const G = x.b.ctx.BananeGcv2L1, commander = G.commander;
  G.commander = a => ({ ...commander(a), vue: 'deplacer' });
  await relancer(x);
  assert.deepEqual(ecrit(x), []); assert.match(fin(x).raison, /cible hors de la vue/);
});

test('validation envoyée mais compteur « N on M treated » inchangé : non prouvée, la pose reste, la passe s’arrête', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true, opts: { sansEffet: true } });
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112], 'le 114 n’est pas visité');
  assert.equal(fin(x).issue, 'incertain'); assert.match(fin(x).raison, /compteur ou cut affiché inattendus/);
  assert.deepEqual(ev(x.b, 'validation-accepted').filter(q => q.passeDifferes), [], 'rien n’est compté');
});

test('le lot change pendant l’écriture : la passe s’arrête avant le cut suivant', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  const valider = x.adapter.surValidation;
  x.adapter.surValidation = async cut => { await valider(cut); if (cut === 112) { const s = x.b.get('engine').s; s.batch = { ...s.batch, id: 'un-autre-lot' }; } };
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112]); assert.equal(fin(x).issue, 'lot-change');
});
