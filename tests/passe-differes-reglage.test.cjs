'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — RÉGLAGE de la deuxième passe des différés (`lot.passeDifferes`, src/settings.js). Décision de l'opérateur : livrée ALLUMÉE en écriture, sans
 * plafond de poses. Une clé absente vaut la valeur livrée ; `false` coupe ; toute autre valeur illisible coupe (jamais allumée par accident) ; l'écriture exige l'observateur passif ;
 * la recette est celle du banc (`deuxiemePasse` 2, `sansVoieRien`). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/settings.js');
const { production } = require('./helpers/perf-production.cjs');
const j = x => JSON.parse(JSON.stringify(x));

test('livré : allumée en écriture, sans plafond, recette du banc (2 passes, sansVoieRien)', () => {
  assert.deepEqual(j(S.lot.passeDifferes), { ombre: true, ecriture: true, ecritureMax: null, passes: 2, leviers: { sansVoieRien: true } });
  assert.equal(S.lot.passeDifferes, S.passeDifferesDefaut);
  assert.ok(Object.isFrozen(S.lot.passeDifferes) && Object.isFrozen(S.lot.passeDifferes.leviers));
  assert.match(S.describe().find(l => l.nom === 'Deuxième passe des différés (fin de lot)').valeur, /^ALLUMÉE, en écriture.*sans plafond de poses$/);
});

test('niveau : clé absente = livré ; false coupe ; toute valeur illisible coupe ; l’écriture exige l’observateur passif', () => {
  const b = production({}), niveau = (passe, observateur = true) => {
    b.ctx.BananeSettings = { ...S, lot: { ...S.lot, passeDifferes: passe }, observateurPassif: { ...S.observateurPassif, actif: observateur } };
    return b.get('passeDiffReglage')(); };
  const mode = (passe, observateur) => niveau(passe, observateur).mode;
  assert.equal(mode({}), 'ecriture', 'toutes les clés absentes : le livré');
  assert.equal(niveau({}).max, Infinity); assert.equal(niveau({}).passes, 2); assert.deepEqual(j(niveau({}).leviers), { sansVoieRien: true });
  assert.equal(mode({ ecriture: false }), 'ombre'); assert.equal(mode({ ombre: false }), 'off'); assert.equal(mode({ ombre: false, ecriture: true }), 'off', 'l’écriture seule ne s’allume pas');
  for (const v of ['true', 'false', 1, 0, 'oui', null, {}, [true]]) {
    assert.equal(mode({ ombre: v }), 'off', 'ombre ' + JSON.stringify(v)); assert.equal(mode({ ecriture: v }), 'ombre', 'ecriture ' + JSON.stringify(v));
  }
  for (const v of [0, -1, 1.5, '2', null, NaN]) assert.equal(mode({ passes: v }), 'off', 'passes ' + JSON.stringify(v));
  for (const v of ['x', null, 0, [], 'sansVoieRien']) assert.equal(mode({ leviers: v }), 'off', 'leviers ' + JSON.stringify(v));
  assert.equal(mode({}, false), 'ombre', 'observateur coupé : pas d’écriture, la preuve manquerait'); assert.equal(niveau({}, false).ecritureDemandee, true);
  assert.equal(niveau({ ecritureMax: 3 }).max, 3); assert.equal(niveau({ ecritureMax: null }).max, Infinity);
  for (const v of [0, -3, 2.5, '2', '', NaN, undefined]) assert.equal(mode({ ecritureMax: v }), 'ombre', 'ecritureMax ' + JSON.stringify(v) + ' : l’écriture est coupée');
});
