'use strict';
/* CH-124 — LA LISTE DE L'ANCRE AU DÉPART DU LOT (service worker). Mesuré sur les journaux des 24 lots-parties du corpus : l'instantané de la liste d'ESV s'écrit
 * pendant que le premier cut du lot se décide (fiche de départ 0,3 à 2,3 s après le départ du lot ; première pose de −0,2 à 9,4 s après la fiche, à moins d'une
 * seconde dans 5 lots). Le levier d'ancre, allumé, lit la liste dès la première pose du lot, donc plus tôt que la décision L1-e. Il ne doit :
 *  - ni garder « pas de liste » pour tout le lot quand l'instantané arrive juste après sa première lecture ;
 *  - ni remplir plus tôt qu'avant la mémoire de la liste de la décision L1-e (`l1eTable`) : la référence d'écartement donnée à la GCV2 reste celle du livré.
 * Montage : tests/helpers/lot-profil.cjs (cuts 111 à 113 ; le 111 est posé par la chaîne, le 112 est le différé donné à la GCV2). Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { production, memoire, base, K, S, attendre, EsvTrou, SCOPE } = require('./helpers/lot-profil.cjs');
const LM = require('../src/liste-memoire.js');
const CLE = LM.PRE_INST + 23;
function instantane() {
  const st = [], fl = [], ed = [];
  /* voie droite, une coupe par mètre, numéros croissants dans le sens de la marche : bord gauche à gauche (convention d'ESV), écartement 1 435 mm */
  for (let i = 0; i < 600; i++) { st.push(i >= 111 && i <= 113 ? 1 : 0); fl.push(0); ed.push(i * 10000, 14350, 0, i * 10000, 0, 0); }
  return LM.compacter({ st, fl, ed }, { partie: 23, at: '2026-10-20T00:00:00Z', cle: 'essai' });
}
/* `quand` : 'avant' (instantané présent au départ du lot) ; 'apres-le-premier-cut' (il n'est écrit qu'une fois le premier cut décidé) ; 'jamais'. */
async function lot({ quand, ancre }) {
  const local = memoire(); if (quand === 'avant') local.m[CLE] = instantane();
  const lectures = [], get0 = local.get; local.get = async k => { const r = await get0(k); if (k != null && [].concat(k).includes(CLE)) lectures.push(CLE in r); return r; };
  const adapter = new EsvTrou([]), b = production({ adapter, local });
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false } };
  const put0 = b.store.putEvent.bind(b.store);
  b.store.putEvent = e => { if (quand === 'apres-le-premier-cut' && e && e.type === 'gcv1-shadow-observed' && !(CLE in local.m)) local.m[CLE] = instantane(); return put0(e); };
  const G = b.ctx.BananeGcv2L1, appels = [];
  b.ctx.BananeGcv2L1 = { ...G, deciderDiffere: a => { appels.push({ cut: a.capture.identity.cut, reference: a.reference ?? null }); return G.deciderDiffere(a); } };
  G.reglerLeviers({ ancre: ancre ? true : null });
  try {
    await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
    adapter.identity.cut = 111; adapter.rails = K.clone(base.rails); adapter.ajuster();
    await b.api('start', { part: 23, start: 111, end: 113, ...SCOPE }); await b.settle(); await attendre(30);
    return { reference: (appels.find(c => c.cut === 112) || {}).reference, gcv2: appels.length, lectures, ancre: b.get('ancreLot'), ancres: b.store.events.filter(e => e.type === 'gcv1-shadow-observed').map(e => e.lotObservation && e.lotObservation.ancre ? (e.lotObservation.ancre.muet || (e.lotObservation.ancre.erreur ? 'erreur' : 'parle')) : null) };
  } finally { G.reglerLeviers(null); }
}

test('instantané présent au départ : la GCV2 a sa référence, l’ancre a son modèle', async () => {
  const x = await lot({ quand: 'avant', ancre: true });
  assert.equal(x.reference.mm, 1435); assert.ok(x.ancre.etat && x.ancre.etat.modele.ok, 'modèle de l’ancre calculé');
});
test('instantané écrit juste après le premier cut, levier coupé : le livré (la GCV2 lit la liste à sa première décision)', async () => {
  const x = await lot({ quand: 'apres-le-premier-cut', ancre: false });
  assert.equal(x.reference.mm, 1435, 'référence d’écartement du livré');
  assert.deepEqual(x.lectures, [true], 'une seule lecture de la liste, par la décision L1-e, après son écriture');
});
test('instantané écrit juste après le premier cut, levier allumé : la référence de la GCV2 reste celle du livré, et l’ancre retrouve la liste au cut suivant', async () => {
  const x = await lot({ quand: 'apres-le-premier-cut', ancre: true });
  assert.equal(x.lectures[0], false, 'première lecture, par l’ancre, avant l’écriture de l’instantané');
  assert.ok(x.reference && x.reference.mm === 1435, 'la décision L1-e garde sa référence d’écartement (la lecture de l’ancre ne remplit pas sa mémoire)');
  assert.ok(x.ancre.etat && x.ancre.etat.modele.ok, 'l’absence n’est pas gardée pour le lot : modèle calculé dès que la liste est là');
});
test('aucun instantané : l’ancre se tait sans erreur et relit à chaque cut ; la GCV2 n’a pas de référence, comme le livré', async () => {
  const x = await lot({ quand: 'jamais', ancre: true });
  assert.equal(x.reference, null); assert.equal(x.ancre.etat, null); assert.ok(x.lectures.every(v => v === false));
  assert.ok(!x.ancres.includes('erreur'));
});
