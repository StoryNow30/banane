'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — RÉGLAGE de la deuxième passe des différés (`lot.passeDifferes`, src/settings.js) : coupée par défaut, deux niveaux distincts ; rien ne s'allume
 * par accident (toute valeur autre que `true` laisse le niveau coupé) ; l'écriture exige l'observateur passif ; la recette est celle du banc (`deuxiemePasse` 2, `sansVoieRien`). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/settings.js');
const { production } = require('./helpers/perf-production.cjs');

test('livré : coupé, recette du banc (2 passes, sansVoieRien), un cut écrit au plus', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(S.lot.passeDifferes)), { ombre: false, ecriture: false, ecritureMax: 1, passes: 2, leviers: { sansVoieRien: true } });
  assert.ok(Object.isFrozen(S.lot.passeDifferes) && Object.isFrozen(S.lot.passeDifferes.leviers));
  assert.equal(S.describe().find(l => l.nom === 'Deuxième passe des différés (fin de lot)').valeur, 'coupée');
});

test('niveau : « ombre » et « ecriture » sont deux réglages ; toute valeur inconnue laisse coupé ; l’écriture exige l’observateur passif', () => {
  const b = production({}), niveau = (passe, observateur = true) => {
    b.ctx.BananeSettings = { ...S, lot: { ...S.lot, passeDifferes: { ...S.lot.passeDifferes, ...passe } }, observateurPassif: { ...S.observateurPassif, actif: observateur } };
    return b.get('passeDiffReglage')(); };
  const mode = (passe, observateur) => niveau(passe, observateur).mode;
  assert.equal(mode({}), 'off');
  assert.equal(mode({ ombre: true }), 'ombre'); assert.equal(mode({ ombre: true, ecriture: true }), 'ecriture');
  assert.equal(mode({ ombre: false, ecriture: true }), 'off', 'l’écriture seule ne s’allume pas');
  for (const v of ['true', 1, 'oui', null, {}, [true]]) {
    assert.equal(mode({ ombre: v }), 'off', 'ombre ' + JSON.stringify(v)); assert.equal(mode({ ombre: true, ecriture: v }), 'ombre', 'ecriture ' + JSON.stringify(v));
  }
  for (const v of [0, -1, 1.5, '2', null, undefined]) assert.equal(mode({ ombre: true, ecriture: true, passes: v }), 'off', 'passes ' + JSON.stringify(v));
  assert.equal(mode({ ombre: true, ecriture: true }, false), 'ombre', 'observateur coupé : pas d’écriture, la preuve manquerait');
  assert.equal(niveau({ ombre: true, ecriture: true }, false).ecritureDemandee, true);
  for (const v of [0, -3, 2.5, '2', null, undefined, NaN]) assert.equal(niveau({ ombre: true, ecriture: true, ecritureMax: v }).max, 1, 'ecritureMax ' + JSON.stringify(v));
  assert.equal(niveau({ ombre: true, ecriture: true, ecritureMax: 3 }).max, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(niveau({ ombre: true, leviers: 'x' }).leviers)), {}, 'leviers illisibles : aucun');
});
