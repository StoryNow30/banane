'use strict';
/* CH-150 (D6b, D-381) : dans `passeDiffEcrire`, le plafond `ecritureMax` (ex. 2 ou 10) est compté
 * sur les SEULS cuts réellement écrits (les refus `avantPose` en tête ne mangent plus le quota
 * des candidats suivants). Suite de tests/ch150-d5-d6-vue-et-passe.test.cjs. Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');

test('CH-150 (D6b) : le plafond ecritureMax ne compte que les cuts réellement écrits', async () => {
  /* 4 cuts candidats décidés en ombre (112, 113, 114, 115), plafond `ecritureMax: 2`,
   * les cuts 112 et 113 sont déjà `valid` dans ESV (refusés `avantPose: true`), les cuts 114 et 115 sont rouges :
   * la passe ne tronque plus aux 2 premiers (ce qui aurait écrit 0 cut !), elle poursuit et écrit bien 114 et 115 (2 écrits = plafond atteint) ! */
  const xPlafond = await lotPasse({
    passe: { passes: 1, ecritureMax: 2 },
    sansPoints: [112, 113, 114, 115, 116],
    fin: 116,
    statuts: { 112: 'valid', 113: 'valid' },
  });
  const ecrits = ev(xPlafond.b, 'validation-accepted').filter(q => q.passeDifferes).map(q => q.identity.cut);
  assert.deepEqual(ecrits, [114, 115], 'les 2 refus avantPose (112, 113) ne mangent pas le plafond de 2 : 114 et 115 sont écrits');
});
