'use strict';
/* CH-150 (D6c, D-381) : dans `commandLot`, un cut transformé en `defer` par `ancreCommande`
 * (`reason === 'ancre'`) est réinscrit dans `l1Restes` pour être transmis à la 2e passe en fin
 * de lot. Suite de tests/ch150-d5-d6-vue-et-passe.test.cjs. Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, ev } = require('./helpers/passe-differes.cjs');
const { base } = require('./fixtures.cjs');
const LM = require('../src/liste-memoire.js');

test('CH-150 (D6c) : un cut différé par ancreCommande (defer:ancre) reste inscrit dans l1Restes pour la 2e passe', async () => {
  /* Table synthétique où le cut 112 a une fausse ligne déportée de +150 mm : la pose de 112 est refusée par `ancreCommande`,
   * et doit figurer dans `l1Restes` (donc dans `differes` de `passe-differes-ombre-fin`) au lieu d'en être effacée par `l1ResteOter`. */
  const pL0 = base.rails.left.positionSceneRelative, pR0 = base.rails.right.positionSceneRelative;
  const dx = pL0[0] - pR0[0], dy = pL0[1] - pR0[1], g0 = Math.hypot(dx, dy), ex = dx / g0, ey = dy / g0, nx = ey, ny = -ex;
  const gSain = 1.437, Mx0 = (pL0[0] + pR0[0]) / 2, My0 = (pL0[1] + pR0[1]) / 2, T = [10, -10, 2];
  const n = 250, st = [], fl = [], ed = [];
  for (let i = 0; i < n; i++) {
    const s = (i - 111) * 1.0;
    const cx = Mx0 + s * nx, cy = My0 + s * ny;
    st.push(i >= 111 && i <= 113 ? 1 : 0);
    fl.push(0);
    /* Sur la voie courante saine, écartement 1.437 m ; aux cuts 111..113 alignons sur `base.rails` pour le calage rigide, sauf l'axe qui est à +150 mm ! */
    const deportVoie = (i >= 111 && i <= 113) ? 0 : -0.150;
    const demi = (i >= 111 && i <= 113) ? g0 / 2 : gSain / 2;
    ed.push(
      Math.round((cx + (deportVoie + demi) * ex + T[0]) * 1e4), Math.round((cy + (deportVoie + demi) * ey + T[1]) * 1e4), Math.round((pL0[2] + T[2]) * 1e4),
      Math.round((cx + (deportVoie - demi) * ex + T[0]) * 1e4), Math.round((cy + (deportVoie - demi) * ey + T[1]) * 1e4), Math.round((pR0[2] + T[2]) * 1e4)
    );
  }
  const snap = LM.compacter({ st, fl, ed }, { partie: 23, at: '2026-11-21T08:00:00Z', version: '5', cle: 'c23' });
  const x = await lotPasse({
    passe: { passes: 1, ecriture: false },
    sansPoints: [],
    fin: 113,
    stockage: { [LM.CLE_INDEX]: [{ partie: 23, at: snap.at }], [LM.PRE_INST + 23]: snap },
  });
  const obsAncre = ev(x.b, 'gcv1-shadow-observed').filter(e => e.lotObservation?.command?.reason === 'ancre');
  assert.ok(obsAncre.length >= 1, 'au moins un cut a été différé par ancreCommande');
  const finOmbre = ev(x.b, 'passe-differes-ombre-fin').at(-1);
  assert.ok(finOmbre && finOmbre.differes >= obsAncre.length, `les ${obsAncre.length} cuts defer:ancre sont bien transmis à passeDiffOmbre (differes=${finOmbre?.differes})`);
});
