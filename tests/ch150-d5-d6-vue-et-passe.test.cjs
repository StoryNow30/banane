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
 * Les essais D6a, D6b et D6c sont dans des fichiers séparés : le délai de verify
 * (60 s par fichier en CI) est trop court pour les réunir.
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
