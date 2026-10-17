'use strict';
/* G1 (plan 5.0) : jugement complet de la mémoire des différés, sur les cas SYNTHÉTIQUES de tests/helpers/memoire-differes-fixture.cjs
 * (parties 91 à 95). Suite de tests/memoire-differes.test.cjs, séparé pour que chaque fichier reste loin de la limite de 20 s :
 * jamais la même partie des deux côtés, chiffres cohérents, seuils d'une partie jugée indépendants de cette partie. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const G = require('../tools/memoire-differes.cjs');
const { parties, rapportCommun } = require('./helpers/memoire-differes-fixture.cjs');

test('jugement complet : jamais la même partie des deux côtés, chiffres cohérents', () => {
  const p = parties(), r = rapportCommun();
  for (const m of Object.values(r.methodes)) {
    assert.deepEqual(Object.keys(m.parPartie).map(Number).sort(), [91, 92, 93, 94, 95]);
    const tot = Object.values(m.parPartie).reduce((s, v) => s + v.cas, 0);
    assert.equal(m.total.cas, tot); assert.equal(tot, [...p.values()].reduce((s, c) => s + c.length, 0), 'chaque cas est jugé exactement une fois');
    assert.equal(m.total.poses + m.total.abstentions, m.total.cas);
    assert.ok(m.total.juste5 <= m.total.juste10 && m.total.juste10 + m.total.faux === m.total.poses);
  }
  assert.ok(r.methodes['a-pool'].total.juste10 >= 20, JSON.stringify(r.methodes['a-pool'].total));
  assert.equal(r.methodes['a-pool'].total.mauvaiseVoie, 0);
  assert.ok(r.methodes['b-serie'].total.juste10 >= 5, JSON.stringify(r.methodes['b-serie'].total));
  assert.equal(r.methodes['b-serie'].total.mauvaiseVoie, 0);
  assert.equal(r.serieFigee[1].total.cas > 0, true);
  assert.ok(G.texte(r).includes('(b) à l\'intérieur d\'une série'));
  assert.throws(() => G.juger(new Map([[91, p.get(91)]])), /au moins deux parties/);
});

test('les seuils d\'une partie jugée ne dépendent pas de cette partie (changer ses réponses ne change pas les réglages appris)', () => {
  const p = parties(), r1 = rapportCommun();
  const p2 = new Map([...p].map(([k, v]) => [k, k === 95 ? v.map(c => ({ ...c, reponse: { ...c.reponse, mic: { gauche: [0, 123, 45], droite: [0, -123, 45] } } })) : v]));
  const r2 = G.juger(p2);
  assert.deepEqual(r2.methodes['a-pool'].modeles[95], r1.methodes['a-pool'].modeles[95], 'réglage (a) appris hors de la partie 95');
  assert.deepEqual(r2.methodes['b-serie'].modeles[95], r1.methodes['b-serie'].modeles[95], 'réglage (b) appris hors de la partie 95');
  assert.deepEqual(r2.methodes['c-voisin'].modeles[95], r1.methodes['c-voisin'].modeles[95], 'réglage (c) appris hors de la partie 95');
});
