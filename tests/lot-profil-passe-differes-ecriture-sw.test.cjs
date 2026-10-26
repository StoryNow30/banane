'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS, NIVEAU « ÉCRITURE » (tests/helpers/passe-differes.cjs : lot 111 à 115 (`deux`), les cuts 112 et 114 différés
 * puis forcés à « valider » par la GCV2 pendant la passe). Livrée allumée en écriture, sans plafond de poses : elle pose et valide sur place dans l'ESV simulé, et ne touche à rien d'autre. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev, base } = require('./helpers/passe-differes.cjs');
const PS = require('../src/part-summary-49.js');
const j = x => JSON.parse(JSON.stringify(x)), ECRITURE = { passes: 1, ecritureMax: 1 };

test('écriture : un cut rouge est atteint, posé (clic « tout-recentre », relu), validé sur place et prouvé ; un seul cut (ecritureMax 1) ; compté posé', async () => {
  const x = await lotPasse({ passe: ECRITURE, deux: true });
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin')[0].cuts, [112, 114]);
  assert.deepEqual(x.pasPasse, [], 'rien n’est envoyé à ESV tant que la pose du dernier cut attend sa validation');
  await relancer(x); assert.equal(x.refus.issue, 'refus-depart'); assert.match(x.refus.raison, /pose d’Ariane attend ta validation au cut 115/);
  assert.deepEqual(x.pasPasse, ['goToCut', 'goToCut', 'capture', 'apply', 'validateInPlace']);
  assert.deepEqual(x.adapter.restes.at(-1), [{ clicHumain: 'tout-recentre' }], 'la pose de la passe ne clique jamais en direct');
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [112]);
  assert.equal(x.adapter.enPlace[0].options.commande, 'ctrl-entree');
  const e = ev(x.b, 'passe-differes-ecriture'); assert.equal(e.length, 1); assert.equal(e[0].identity.cut, 112); assert.equal(e[0].resultat, 'ecrit');
  assert.deepEqual(e[0].compteur, [100, 101, 200]);
  /* La pose écrite est celle que l'ombre a décidée (à 0,01 mm près). */
  const G = x.b.ctx.BananeGcv2L1, ecrit = G.decalage(base.rails.left, x.adapter.rails.left.positionSceneRelative);
  assert.ok(ecrit.every((v, i) => Math.abs(v - e[0].decal.left[i]) <= 0.011), 'pose écrite = pose décidée');
  const fin = ev(x.b, 'passe-differes-ecriture-fin').at(-1); assert.equal(fin.issue, 'fin'); assert.equal(fin.ecrites, 1); assert.equal(fin.demandees, 1); assert.equal(fin.decidees, 2);
  /* Compté : le résumé de la partie voit le 112 posé (validation d'Ariane), le 114 reste différé ; l'intention est effacée ; le panneau lit l'avancement. */
  const v = ev(x.b, 'validation-accepted').filter(q => q.passeDifferes); assert.deepEqual(v.map(q => q.identity.cut), [112]);
  const r = PS.summarize({ sessionId: x.b.get('engine').s.sessionId, batch: x.b.get('engine').s.batch, events: x.b.store.events, historyStatus: 'available', details: true });
  assert.deepEqual([112, 114].map(c => r.cuts.find(q => q.cut === c).status), ['posed', 'deferred']); assert.deepEqual(r.deferredCuts, [114]);
  assert.deepEqual(j(await x.b.get('relectureIntentions')()), []);
  assert.deepEqual(j(x.b.get('vuePanneau')().passeDifferes), { lotId: x.b.get('engine').s.batch.id, mode: 'ecriture', etat: 'finie', differes: 2, posees: 2, demandees: 1, ecrites: 1, cut: null, message: null });
  /* Les leviers de la passe ne valent que le temps de l'appel : le lot a les siens. */
  assert.deepEqual(x.appels.map(a => a.sansVoieRien), [false, false, true, true, true, true], 'lot, ombre de fin de lot, ombre refaite à la relance');
  assert.equal(x.b.ctx.BananeGcv2L1.leviersActifs().sansVoieRien, false);
});
