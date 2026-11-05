'use strict';
/* Essais de src/serie-captures-vides.js : le détecteur pur d'une série de captures vides pendant un lot (CH-051). Aucune donnée de terrain. */
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/serie-captures-vides.js');

const R = { actif: true, seuil: 3, attenteMs: 20000, attentesParSerie: 1, rechargement: true, rechargementsParSerie: 1, reessaiApresCuts: 10 };
const pleine = { points: 5000 }, vide = { points: 0 };

test('réglage éteint : jamais rien, même après dix captures vides', () => {
  const e = G.creer({ ...R, actif: false });
  for (let i = 0; i < 10; i++) assert.equal(G.observer(e, vide).action, 'rien');
  assert.equal(e.vides, 0);
});

test('sous le seuil : rien ; une capture pleine remet le compte à zéro', () => {
  const e = G.creer(R);
  assert.equal(G.observer(e, vide).action, 'rien');
  assert.equal(G.observer(e, vide).action, 'rien');
  assert.equal(G.observer(e, pleine).action, 'rien');
  assert.equal(e.vides, 0);
  assert.equal(G.observer(e, vide).action, 'rien');
  assert.equal(G.observer(e, vide).action, 'rien');
  assert.equal(e.vides, 2);
});

test('au seuil : attendre une fois, puis recharger une fois, puis différer sans attente jusqu’au réessai', () => {
  const e = G.creer(R);
  G.observer(e, vide); G.observer(e, vide);
  const a = G.observer(e, vide);
  assert.equal(a.action, 'attendre');
  assert.equal(a.attenteMs, 20000);
  assert.equal(a.serie, 1);
  assert.equal(a.vides, 3);
  /* La recapture après l'attente est encore vide : recharger. */
  const r = G.observer(e, vide, { apresAttente: true });
  assert.equal(r.action, 'recharger');
  assert.equal(e.rechargements, 1);
  /* Après le rechargement, encore vide : on diffère sans attendre, et on le fait pendant `reessaiApresCuts` cuts. */
  const d = G.observer(e, vide, { apresRechargement: true });
  assert.equal(d.action, 'differer');
  assert.equal(d.motif, 'serie-en-cours');
  for (let i = 0; i < 9; i++) assert.equal(G.observer(e, vide).action, 'differer');
  /* Au 10e cut vide suivant, un nouvel essai d'attente (une seule attente, aucun rechargement de plus dans la même série). */
  const a2 = G.observer(e, vide);
  assert.equal(a2.action, 'attendre');
  assert.equal(G.observer(e, vide, { apresAttente: true }).action, 'differer', 'le rechargement de la série est consommé');
  /* La série se referme à la première capture pleine ; la suivante repart de zéro, avec droit à un nouveau rechargement. */
  assert.equal(G.observer(e, pleine).action, 'rien');
  assert.equal(e.vides, 0);
  assert.equal(e.rechargements, 0);
  assert.equal(e.series, 1);
});

test('rechargement interdit par le réglage : on attend, puis on diffère', () => {
  const e = G.creer({ ...R, rechargement: false });
  G.observer(e, vide); G.observer(e, vide);
  assert.equal(G.observer(e, vide).action, 'attendre');
  const d = G.observer(e, vide, { apresAttente: true });
  assert.equal(d.action, 'differer');
  assert.equal(d.motif, 'rechargement-coupe');
});

test('le rechargement n’est proposé que si l’appelant le dit possible (Constellation active, rien de posé)', () => {
  const e = G.creer(R);
  G.observer(e, vide); G.observer(e, vide); G.observer(e, vide);
  const d = G.observer(e, vide, { apresAttente: true, rechargementPossible: false });
  assert.equal(d.action, 'differer');
  assert.equal(d.motif, 'rechargement-impossible');
  assert.equal(e.rechargements, 0, 'un rechargement impossible n’est pas compté');
});

test('un échec de capture (erreur) ne compte ni comme vide ni comme pleine', () => {
  const e = G.creer(R);
  G.observer(e, vide); G.observer(e, vide);
  assert.equal(G.observer(e, null).action, 'rien');
  assert.equal(e.vides, 2);
  assert.equal(G.observer(e, { points: undefined }).action, 'rien');
  assert.equal(e.vides, 2);
});

test('bilan : des comptes pour le journal, sans identifiant', () => {
  const e = G.creer(R);
  G.observer(e, vide); G.observer(e, vide); G.observer(e, vide);
  const b = G.bilan(e);
  assert.deepEqual(Object.keys(b).sort(), ['attentes', 'differesSansAttente', 'rechargements', 'serie', 'series', 'vides']);
  assert.equal(b.series, 1);
  assert.equal(b.serie, true);
});

test('réglage : les clés absentes prennent la valeur livrée, une valeur illisible coupe', () => {
  const d = G.reglage(undefined);
  assert.equal(d.actif, false);
  assert.equal(d.seuil, 3);
  assert.equal(G.reglage({ actif: true }).actif, true);
  assert.equal(G.reglage({ actif: 'oui' }).actif, false);
  assert.equal(G.reglage({ actif: true, seuil: 0 }).actif, false, 'un seuil illisible coupe la garde');
  assert.equal(G.reglage({ actif: true, attenteMs: -5 }).actif, false);
});
