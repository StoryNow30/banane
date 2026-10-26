'use strict';
/* T21d (D-250, priorité 2) — LA DEUXIÈME PASSE SURVIT AU REDÉMARRAGE DU SERVICE WORKER : SANS REDÉMARRAGE (référence des autres essais) : état persistant écrit à chaque décision, effacé à la fin ; la passe rend la main à la boucle d'événements entre deux décisions.
 * Montage : tests/helpers/passe-redemarrage.cjs (deux vies du service worker, la première gelée comme un service worker tué). Lot 111 à 116, différés
 * 112, 113 et 114 ; le 114 est « rien » au premier tour, « valider » au second ; passe en écriture (livrée), deux tours. Sans redémarrage
 * (t21d-passe-sans-redemarrage-sw) : décisions 112, 113 (tour 1, poserait), 114 (tour 1, rien), 114 (tour 2, poserait), puis écritures 112, 113, 114. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, bilan, CLE } = require('./helpers/passe-redemarrage.cjs');
const j = x => JSON.parse(JSON.stringify(x ?? null));
const OPTS = { sansPoints: [112, 113, 114, 116], fin: 116, decider: (cut, n) => cut === 114 && n < 2 ? 'rien' : 'valider' };
const DECISIONS = [[112, 1, 'poserait'], [113, 1, 'poserait'], [114, 1, 'rien'], [114, 2, 'poserait']], ECRITS = [112, 113, 114];
const decisions = B => B.dec.map(d => d.slice(0, 3)), ecrits = B => B.ecr.filter(e => e[1] === 'ecrit').map(e => e[0]);
test('sans redémarrage : décisions et écritures de référence ; état écrit à chaque décision et à chaque phase, puis effacé ; la main est rendue entre deux décisions', async () => {
  const M = montage(OPTS), ecritures = [], ticks = { n: 0 }, auDecider = [];
  const tic = () => { ticks.n++; if (ticks.n < 100000) setTimeout(tic, 0); };
  const v = M.vie(); /* vie unique : on suit les écritures de l'état et la boucle d'événements */
  const set = M.local.set; M.local.set = async o => { if (o[CLE]) ecritures.push(j({ phase: o[CLE].phase, passe: o[CLE].passe, index: o[CLE].index, poses: o[CLE].poses.length })); return set(o); };
  const G = v.b.ctx.BananeGcv2L1, dec = G.deciderDiffere; v.b.ctx.BananeGcv2L1 = { ...G, deciderDiffere: a => { if (G.leviersActifs().sansVoieRien === true) auDecider.push(ticks.n); return dec(a); } };
  M.vies.pop(); M.vies.push(v);
  await v.b.api('connect', { tabId: 1 }); await v.b.api('settings', { mode: 'automatic-test' });
  M.adapter.identity.cut = 111; M.adapter.rails = require('./fixtures.cjs').K.clone(require('./fixtures.cjs').base.rails); M.adapter.ajuster();
  tic();
  await v.b.api('start', { part: 23, start: 111, end: 116, testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', geometryEngine: 'geometry-candidate-v1', lotDecision: 'apply' }); await v.b.settle();
  for (let i = 0; i < 400; i++) { const c = v.b.get('passeDiff').cours; if (c) await c; else if (i > 5) break; await new Promise(r => setTimeout(r, 10)); }
  ticks.n = 1e9;
  const B = bilan(M);
  assert.deepEqual(decisions(B), DECISIONS); assert.deepEqual(ecrits(B), ECRITS); assert.deepEqual(B.enPlace, { 112: 1, 113: 1, 114: 1 });
  assert.equal(B.etat, null, 'état effacé à la fin de la passe'); assert.equal('banane56PasseDiffEntree' in M.local.m, false);
  /* Une écriture de l'état par décision (4), par changement de tour (1), au départ (1), à la fin de l'ombre (1), au départ de l'écriture (1), avant et après chaque cut écrit (2 × 3), à chaque preuve (3), à la fin (1). */
  assert.equal(ecritures.filter(e => e.phase === 'ombre').length, 1 + 4 + 1, j(ecritures));
  assert.deepEqual(j(ecritures.filter(e => e.phase === 'ombre').map(e => [e.passe, e.index])), [[1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 3]]);
  assert.deepEqual(j(ecritures.map(e => e.phase).filter((p, i, l) => p !== l[i - 1])), ['ombre', 'ombre-finie', 'ecriture', 'finie']);
  /* Chaque décision de la passe part d'une tâche nouvelle : la boucle d'événements a tourné depuis la précédente (avant T21d, tout le second tour tenait en une seule tâche). */
  assert.equal(auDecider.length, 4); for (let i = 1; i < auDecider.length; i++) assert.ok(auDecider[i] > auDecider[i - 1], 'boucle d’événements immobile entre deux décisions : ' + j(auDecider));
});
