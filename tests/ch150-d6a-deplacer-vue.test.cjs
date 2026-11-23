'use strict';
/* CH-150 (D6a, D-381) : dans `passeDiffPoser` (`background.js`), `cg.vue === 'deplacer'` avec
 * `deplacerVue` actif construit le plan de vue et pose/valide le cut en 2e passe au lieu de
 * refuser `cette passe ne déplace pas la vue`. Suite de tests/ch150-d5-d6-vue-et-passe.test.cjs.
 * Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');

test('CH-150 (D6a) : passeDiffPoser déplace la vue quand deplacerVue est actif', async () => {
  /* En 2e passe, `cg.vue === 'deplacer'` avec une caméra valide et `deplacerVue` actif planifie le déplacement et écrit le cut ! */
  const xVue = await lotPasse({ passe: { passes: 1 }, sansPoints: [112], fin: 115, statuts: {} });
  /* Forçons le lot à s'arrêter en pause à la fin ou relançons sur un reste hors-vue : testons via un lot neuf avec caméra étroite à la passe. */
  const xHorsVue = await lotPasse({
    passe: { passes: 1 },
    deux: true,
  });
  const VR = xHorsVue.b.ctx.BananeVoieRecentree;
  const origVueNec = VR.vueNecessaire.bind(VR);
  const G = xHorsVue.b.ctx.BananeGcv2L1, origCmd = G.commander.bind(G);
  xHorsVue.b.ctx.BananeGcv2L1 = { ...G, commander: a => ({ ...origCmd(a), vue: 'deplacer' }) };
  const origViewCams = xHorsVue.b.ctx.BananeLotDecision.viewCameras;
  xHorsVue.b.ctx.BananeLotDecision = {
    ...xHorsVue.b.ctx.BananeLotDecision,
    viewCameras: () => ({
      left: { viewport: { width: 1000, height: 800 }, projection: [4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], sceneRelativeToCamera: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1] },
      right: { viewport: { width: 1000, height: 800 }, projection: [4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], sceneRelativeToCamera: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1] },
    }),
  };
  xHorsVue.b.ctx.BananeVoieRecentree = {
    ...VR,
    vueNecessaire: () => ({
      inconnu: false,
      par: {
        left: { ok: false, dezoom: 1.25, panPx: 120, ndc: [-1.15, 0.05] },
        right: { ok: true, dezoom: 1, panPx: 0, ndc: [0, 0] },
      },
    }),
  };
  await relancer(xHorsVue);
  const ecritsVue = ev(xHorsVue.b, 'validation-accepted').filter(q => q.passeDifferes).map(q => q.identity.cut);
  assert.deepEqual(ecritsVue, [112, 114], 'les cuts hors-vue (112, 114) sont posés et validés en 2e passe avec deplacerVue');
  assert.ok(xHorsVue.adapter.restes.some(r => r[0]?.deplacerVue?.cotes?.left), 'apply a bien reçu le plan deplacerVue en 2e passe');
});
