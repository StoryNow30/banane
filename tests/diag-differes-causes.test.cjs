'use strict';
/* Essais de tools/diag-differes-causes.cjs sur un journal fictif. Aucune donnée de terrain. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../tools/diag-differes-causes.cjs');

const T0 = Date.parse('2026-10-26T08:00:00Z');
const iso = s => new Date(T0 + s * 1000).toISOString();
const rail = (status, motif) => ({ next: status ? { status, motif: motif || null } : null });

function decision(lot, part, cut, s, lo, shadow) {
  return { type: 'gcv1-shadow-observed', timestamp: iso(s), eventId: `d-${lot}-${cut}`, batchId: lot,
    identity: { part, cut }, lotObservation: lo, shadow };
}
const valide = (lot, part, cut, s) => ({ type: 'validation-accepted', timestamp: iso(s), batchId: lot, identity: { part, cut } });
const debut = (lot, part, s, version) => ({ type: 'batch-started', timestamp: iso(s), batch: { id: lot, scope: { part, start: 0, end: 999999, extensionVersion: version } } });

function journalFictif() {
  const A = 'lot-alpha';
  const sh = (l, r) => ({ rails: { left: rail(l && l[0], l && l[1]), right: rail(r && r[0], r && r[1]) }, summary: {} });
  const cand = ['candidate', null];
  return { version: '4.9.5.23', events: [
    debut(A, 7, 0, '4.9.5.23'),
    /* Posé : ne compte pas parmi les différés. */
    decision(A, 7, 10, 1, { stage: 'first-pass', command: { action: 'engine', reason: 'first-pass' } }, sh(cand, cand)),
    valide(A, 7, 10, 2),
    /* Déjà vert au départ : le lot le voit et passe. Hors cibles. */
    decision(A, 7, 0, 3, { stage: 'first-pass', command: { action: 'engine', reason: 'first-pass' } }, sh(cand, cand)),
    /* La passe poserait : récupérable par l'écriture, sans que la garde bloque. */
    decision(A, 7, 11, 4, { stage: 'deferred', reason: 'no-anchor', command: { action: 'engine', reason: 'deferred' } }, sh(['unresolved', 'minTop'], cand)),
    { type: 'passe-differes-ombre', timestamp: iso(5), identity: { part: 7, cut: 11 }, passe: 1, decision: 'poserait', garde: { bloque: false, motif: 'loin-du-depart' } },
    /* La passe poserait, la garde bloque : non récupérable par l'écriture livrée. */
    decision(A, 7, 12, 6, { stage: 'deferred', reason: 'no-anchor', command: { action: 'engine', reason: 'deferred' } }, sh(['unresolved', 'ambiguity'], cand)),
    { type: 'passe-differes-ombre', timestamp: iso(7), identity: { part: 7, cut: 12 }, passe: 1, decision: 'poserait', garde: { bloque: true, motif: 'garde-appuis' } },
    /* Nuage absent, la passe n'a rien. */
    decision(A, 7, 13, 8, { stage: 'deferred', reason: 'no-anchor', command: { action: 'engine', reason: 'deferred' } }, { rails: { left: {}, right: {} }, summary: {} }),
    { type: 'passe-differes-ombre', timestamp: iso(9), identity: { part: 7, cut: 13 }, passe: 1, decision: 'rien', motif: 'sans-voie' },
    /* Molette sans effet, glisser dans la limite : la vue était le seul refus. */
    decision(A, 7, 14, 10, { stage: 'window', command: { action: 'engine', reason: 'hors-vue-left' } }, sh(cand, cand)),
    { type: 'deplacer-vue', timestamp: iso(11), identity: { part: 7, cut: 14 }, phase: 'decision', refus: 'pre-vol:camera-immobile',
      plan: { cotes: { left: { geste: 'dezoom', dezoom: 1.04, panPx: 20 } }, glissementPxMax: 250 } },
    { type: 'molette', timestamp: iso(11.2), identity: { part: 7, cut: 14 }, action: 'amenerDansLaVue', camera: 'immobile', crans: 1, sens: 1 },
    /* Fragment : un seul cut, hors base. */
    debut('lot-fragment', 8, 20, '4.9.5.23'),
    decision('lot-fragment', 8, 1, 21, { stage: 'deferred', reason: 'no-anchor', command: { action: 'engine', reason: 'deferred' } }, sh(['unresolved', 'minTop'], cand)),
  ] };
}

test('causes : un différé, une cause, la part des cibles, le levier', () => {
  const R = C.analyser([{ fichier: 'fictif.json', journal: journalFictif() }, { fichier: 'copie.json', journal: journalFictif() }]);
  assert.equal(R.population.lots, 1, 'la copie du même lot ne compte pas deux fois');
  assert.equal(R.population.fragments, 1);
  assert.equal(R.population.cibles, 5, 'le cut déjà vert est hors cibles, le posé compte');
  assert.equal(R.population.differes, 4);
  assert.equal(R.population.horsCibles, 1);
  const par = Object.fromEntries(R.causes.map(c => [c.cause, c]));
  assert.equal(par['passe-poserait'].nombre, 1);
  assert.equal(par['passe-poserait'].recuperable, 'oui');
  assert.equal(par['passe-bloquee-garde'].nombre, 1);
  assert.equal(par['passe-bloquee-garde'].recuperable, 'non');
  assert.equal(par['nuage-absent'].nombre, 1);
  assert.equal(par['nuage-absent'].recuperable, 'non');
  assert.equal(par['molette-sans-effet'].nombre, 1);
  assert.equal(par['molette-sans-effet'].recuperable, 'oui');
  assert.equal(par['molette-sans-effet'].gestesMolette, 1);
  assert.equal(par['molette-sans-effet'].camerasImmobiles, 1);
  const somme = R.causes.reduce((s, c) => s + c.nombre, 0);
  assert.equal(somme, 4);
  assert.ok(Math.abs(par['passe-poserait'].partCibles - 20) < 0.05);
  assert.equal(R.texte.includes('lot-alpha'), false, 'aucun identifiant de lot dans le texte');
});

test('molette hors limite de glisser : le repli ne tient pas', () => {
  const j = journalFictif();
  const ev = j.events.find(e => e.type === 'deplacer-vue');
  ev.plan.cotes.left.panPx = 400;
  const R = C.analyser([{ fichier: 'f.json', journal: j }]);
  const c = R.causes.find(x => x.cause === 'molette-sans-effet');
  assert.equal(c.recuperable, 'non');
});
