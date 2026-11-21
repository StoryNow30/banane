'use strict';
/* CH-150 (Lot D5 + D6, D-380 / D-381) :
 *  - D5a : `BananeSettings.deplacerVue.preVol === false` par défaut ;
 *  - D5b : dans `src/adapter-page.js` (`apply` + `amenerVue`), les rails hors-vue du plan `deplacerVue` sont traités EN PREMIER
 *          avant de cliquer un rail déjà dans la vue ; une dérive orthogonale aberrante (`|py| <= 5` et `|ΔndcY| > 0.5` ou `gain > 10`)
 *          remet immédiatement la caméra par `select` avant l'essai suivant ; et si `amenerVue` échoue sans avoir bougé aucun rail,
 *          le service worker replie proprement le cut en différé (`b.deferred`) et poursuit le lot sans `ERROR` ni `reconcileRequired` ;
 *  - D6a : dans `passeDiffPoser` (`background.js`), `cg.vue === 'deplacer'` avec `deplacerVue` actif construit le plan de vue
 *          et pose/valide le cut en 2e passe au lieu de refuser `cette passe ne déplace pas la vue` ;
 *  - D6b : dans `passeDiffEcrire`, le plafond `ecritureMax` (ex. 2 ou 10) est compté sur les SEULS cuts réellement écrits
 *          (les refus `avantPose` en tête ne mangent plus le quota des candidats suivants) ;
 *  - D6c : dans `commandLot`, un cut transformé en `defer` par `ancreCommande` (`reason === 'ancre'`) est réinscrit dans `l1Restes`
 *          pour être transmis à la 2e passe en fin de lot.
 * Toutes les données sont synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/settings.js');
const { page } = require('./helpers/vue-page.cjs');
const { EsvVue, SCOPE } = require('./helpers/deplacer-vue-lot.cjs');
const { production } = require('./helpers/perf-production.cjs');
const { lotPasse, relancer, ev } = require('./helpers/passe-differes.cjs');
const { K, base } = require('./fixtures.cjs');
const LM = require('../src/liste-memoire.js');

test('CH-150 (D5a) : deplacerVue.preVol est coupé par défaut dans src/settings.js', () => {
  assert.equal(S.deplacerVue.actif, true);
  assert.equal(S.deplacerVue.preVol, false, 'preVol coupé par défaut pour éliminer le double aller-retour caméra');
});

test('CH-150 (D5b) : apply traite le côté hors-vue en premier (0 rail bougé si échec) et replie en différé sans ERROR', async () => {
  /* 1. Sur la page (vue sourde) : si le rail gauche est dans la vue et seul le rail droit est hors-vue (`plan.cotes = { right: ... }`) et échoue,
   *    `apply` essaie `right` EN PREMIER et lève avant tout clic de pose sur `left` (0 rail modifié dans la scène). */
  const f = page();
  const before = await f.call('state');
  const posLeftAvant = f.pos(f.left);
  const posRightAvant = f.pos(f.right);
  const proposals = {
    left: { status: 'candidate', delta: [0, 0.01, 0] },
    right: { status: 'candidate', delta: [0, 0.23, 0] },
  };
  await assert.rejects(
    () => f.call('apply', before, proposals, { deplacerVue: { version: 'deplacer-vue-v1', cotes: { right: { geste: 'molette' } }, gestesMax: 1, dezoomMax: 1.5, glissementPxMax: 250, pixelMaxMm: 0.9, marge: 0.99 } }),
    /Vue ESV non amenée sur la cible du rail droit .* rien n’a été posé\./
  );
  assert.deepEqual(f.pos(f.left), posLeftAvant, 'le rail gauche (dans la vue) n\'a PAS été cliqué avant l\'échec du rail droit hors-vue');
  assert.deepEqual(f.pos(f.right), posRightAvant, 'le rail droit est intact');
  assert.ok(!f.evenements.some(e => e.type === 'click'), 'aucun clic canevas de pose envoyé');

  /* 2. Dans le lot SW (cuts 111..113, cut 112 hors-vue où `apply` échoue sans bouger les rails) :
   *    avec `preVol: false`, le cut 112 est replié proprement en différé (`b.deferred`), `reconcileRequired` reste `false`,
   *    et le lot continue et valide le cut 113 jusqu'à `COMPLETED` (zéro crash `ERROR` !). */
  class EsvEchecApply112 extends EsvVue {
    async apply(bef, props, ...reste) {
      if (bef.identity.cut === 112) {
        this.calls.push('apply-echec-sans-mouvement');
        throw Error('Position proposée hors de la vue (left, camera-immobile).');
      }
      return super.apply(bef, props, ...reste);
    }
  }
  const adapter = new EsvEchecApply112([112]), b = production({ adapter });
  const S2 = { ...b.ctx.BananeSettings };
  S2.deplacerVue = { ...S2.deplacerVue, actif: true, preVol: false, deplacement: { ...S2.deplacerVue.deplacement, actif: false } };
  S2.voiePrediteOmbre = { ...S2.voiePrediteOmbre, actif: false };
  S2.lot = { ...S2.lot, profil: 'actuel', rechercheLarge: { ...S2.lot.rechercheLarge, actif: false }, gardeApresDiffere: false };
  b.ctx.BananeSettings = S2;
  await b.api('connect', { tabId: 1 });
  await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = 111; adapter.rails = K.clone(base.rails);
  await b.api('start', { part: 23, start: 111, end: 114, ...SCOPE, unresolvedPolicy: 'defer' });
  await b.settle();
  await new Promise(r => setTimeout(r, 40));
  const batch = b.get('engine').s.batch;
  assert.equal(b.get('engine').s.reconcileRequired, false, 'aucune réconciliation requise puisque 0 rail n\'a bougé');
  assert.notEqual(batch.state, 'ERROR', `le lot ne doit jamais tomber en ERROR (état : ${batch.state})`);
  assert.ok(batch.deferred.some(d => d.cut === 112), 'le cut 112 est replié proprement en différé');
  assert.ok(batch.processed.some(p => p.cut === 113), 'le cut 113 suivant est bien traité et validé');
  assert.equal(batch.stoppedAtEnd?.cut, 114, 'le lot poursuit jusqu\'à la borne finale 114');
});

test('CH-150 (D6a + D6b) : passeDiffPoser déplace la vue quand deplacerVue est actif, et le plafond ecritureMax ne compte que les cuts réellement écrits', async () => {
  /* 1. D6b : 4 cuts candidats décidés en ombre (112, 113, 114, 115), plafond `ecritureMax: 2`,
   *    les cuts 112 et 113 sont déjà `valid` dans ESV (refusés `avantPose: true`), les cuts 114 et 115 sont rouges :
   *    la passe ne tronque plus aux 2 premiers (ce qui aurait écrit 0 cut !), elle poursuit et écrit bien 114 et 115 (2 écrits = plafond atteint) ! */
  const xPlafond = await lotPasse({
    passe: { passes: 1, ecritureMax: 2 },
    sansPoints: [112, 113, 114, 115, 116],
    fin: 116,
    statuts: { 112: 'valid', 113: 'valid' },
  });
  const ecrits = ev(xPlafond.b, 'validation-accepted').filter(q => q.passeDifferes).map(q => q.identity.cut);
  assert.deepEqual(ecrits, [114, 115], 'les 2 refus avantPose (112, 113) ne mangent pas le plafond de 2 : 114 et 115 sont écrits');

  /* 2. D6a : en 2e passe, `cg.vue === 'deplacer'` avec une caméra valide et `deplacerVue` actif planifie le déplacement et écrit le cut ! */
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
