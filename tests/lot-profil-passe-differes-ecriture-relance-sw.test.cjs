'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — DEUXIÈME PASSE DES DIFFÉRÉS, NIVEAU « ÉCRITURE » (tests/helpers/passe-differes.cjs : lot 111 à 115 (`deux`), les cuts 112 et 114 différés
 * puis forcés à « valider » par la GCV2 pendant la passe). Livrée allumée en écriture, sans plafond de poses : elle pose et valide sur place dans l'ESV simulé, et ne touche à rien d'autre. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');

test('relance : les décisions sont refaites (des voisins ont pu changer) ; un cut que la GCV2 ne valide plus n’est pas écrit', async () => {
  const x = await lotPasse({ passe: { passes: 1 }, deux: true });
  const G = x.b.ctx.BananeGcv2L1, decider = G.deciderDiffere;
  G.deciderDiffere = a => { const r = decider(a); return a.capture.identity.cut === 112 ? { ...r, decision: { ...r.decision, etat: 'rien', motif: 'essai' } } : r; };
  await relancer(x);
  assert.deepEqual(x.adapter.enPlace.map(e => e.cut), [114], 'le 112, décidé « valider » en fin de lot, ne l’est plus à la relance');
  assert.deepEqual(ev(x.b, 'passe-differes-ombre-fin').map(e => e.cuts), [[112, 114], [114]]);
});
