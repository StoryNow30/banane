'use strict';
/* Test 24, décision de l'opérateur du 28/10 (D-259) — LA DEUXIÈME PASSE DES DIFFÉRÉS EST LIVRÉE ALLUMÉE EN ÉCRITURE, plafonnée à 10 cuts par lot, garde A active (D-251 l'avait
 * livrée en ombre pour les tests 21 à 23). L'ombre reste un réglage : `ecriture: false` calcule et journalise (`passe-differes-ombre`) sans rien écrire dans ESV (ni navigation, ni pose,
 * ni validation sur place) ; `ombre: false` coupe la passe. Service worker réel, ESV simulé (tests/helpers/passe-differes.cjs). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/settings.js');
const { production } = require('./helpers/perf-production.cjs');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x));

test('livré : ALLUMÉE en écriture (D-259), plafond de 10 cuts par lot, recette du banc ; le descriptif des Réglages le dit', () => {
  assert.deepEqual(j(S.passeDifferesDefaut), { ombre: true, ecriture: true, ecritureMax: 10, passes: 2, leviers: { sansVoieRien: true }, gardeAppuis: { actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 } });
  assert.equal(S.lot.passeDifferes, S.passeDifferesDefaut);
  assert.match(S.describe().find(l => l.nom === 'Deuxième passe des différés (fin de lot)').valeur, /^ALLUMÉE, en écriture : pose et valide sur place, 10 cut au plus$/);
});

test('niveau : sans réglage enregistré, écriture (observateur passif présent) ; ecriture:false ramène l’ombre ; ombre:false coupe', () => {
  const b = production({}), niveau = (passe, observateur = true) => {
    b.ctx.BananeSettings = { ...S, lot: { ...S.lot, passeDifferes: passe }, observateurPassif: { ...S.observateurPassif, actif: observateur } };
    return b.get('passeDiffReglage')(); };
  assert.equal(niveau({}).mode, 'ecriture'); assert.equal(niveau({}).ecritureDemandee, true); assert.equal(niveau({}).max, 10, 'le plafond livré est de 10 cuts écrits par lot');
  assert.equal(niveau({ ecriture: false }).mode, 'ombre'); assert.equal(niveau({ ecriture: false }).ecritureDemandee, false);
  assert.equal(niveau({ ecriture: true }).mode, 'ecriture'); assert.equal(niveau({ ecriture: true }, false).mode, 'ombre', 'sans l’observateur passif, la preuve manquerait');
  assert.equal(niveau({ ombre: false }).mode, 'off'); assert.equal(niveau({ ombre: false, ecriture: true }).mode, 'off');
});

test('réglage ecriture:false (ombre) : la passe journalise ses `passe-differes-ombre` et ne fait ni commande d’écriture, ni navigation, ni validation vers ESV, et « Relancer » est refusé', async () => {
  const x = await lotPasse({ ecritureAllumee: false, passe: { ecriture: false }, deux: true });
  const fin = ev(x.b, 'passe-differes-ombre-fin'); assert.equal(fin.length, 1); assert.equal(fin[0].mode, 'ombre'); assert.deepEqual(fin[0].cuts, [112, 114]);
  const dec = ev(x.b, 'passe-differes-ombre'); assert.deepEqual(dec.map(d => [d.identity.cut, d.decision]), [[112, 'poserait'], [114, 'poserait']]);
  assert.equal(x.b.get('vuePanneau')().passeDifferes.mode, 'ombre');
  assert.deepEqual(x.pasPasse, [], 'rien n’est envoyé à ESV après le lot');
  await assert.rejects(x.b.api('passe-differes-ecrire'), /aucune écriture à relancer/, '« Relancer » n’a rien à relancer : la passe n’écrit pas');
  assert.deepEqual(x.adapter.calls.filter(c => c === 'goToCut' || c === 'validateInPlace'), []);
  for (const k of ['goToCut', 'validateInPlace']) assert.ok(!x.adapter.calls.includes(k), k);
  assert.deepEqual(x.adapter.enPlace, []);
  for (const t of ['passe-differes-ecriture', 'passe-differes-ecriture-fin']) assert.equal(ev(x.b, t).length, 0, t);
  assert.ok(!ev(x.b, 'validation-accepted').some(q => q.passeDifferes), 'aucune validation de la passe');
});

test('réglage enregistré ecriture:true : l’écriture est rallumée, avec ses gardes (un cut rouge atteint, posé, validé sur place)', async () => {
  const x = await lotPasse({ passe: { ecriture: true, passes: 1, ecritureMax: 1 }, deux: true });
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112]);
  assert.equal(ev(x.b, 'passe-differes-ecriture').length, 1);
  assert.equal(x.b.get('vuePanneau')().passeDifferes.mode, 'ecriture');
});

