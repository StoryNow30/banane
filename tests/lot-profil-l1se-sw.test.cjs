'use strict';
/* 4.9.5.14 (test 14, fiches/L1_APPRENTISSAGE.md) — LE PROFIL DU LOT « L1-se » (défaut) : sur le différé de la chaîne, la GCV2 décide avec la variante
 * L1-e et la référence d'écartement lue dans l'instantané de la liste d'ESV de la partie (stockage local) ; sans instantané : aucune référence.
 * Montage commun : tests/helpers/lot-profil.cjs. Données synthétiques : on regarde ce que le service worker DONNE à la GCV2, pas le modèle. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { production, memoire, base, K, S, scopeDe, attendre, EsvTrou, SCOPE } = require('./helpers/lot-profil.cjs');
const LM = require('../src/liste-memoire.js');

async function lotL1se({ liste }) {
  const local = memoire();
  if (liste) {
    const st = [], fl = [], ed = [];
    for (let i = 0; i < 200; i++) { st.push(i >= 111 && i <= 113 ? 1 : 0); fl.push(0); ed.push(i * 10000, 0, 0, i * 10000, 14350, 0); }
    local.m[LM.PRE_INST + 23] = LM.compacter({ st, fl, ed }, { partie: 23, at: '2026-10-20T00:00:00Z', cle: 'essai' });
  }
  const adapter = new EsvTrou([]), b = production({ adapter, local });
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false } };
  const G = b.ctx.BananeGcv2L1, appels = [];
  b.ctx.BananeGcv2L1 = { ...G, deciderDiffere: a => { appels.push({ cut: a.capture.identity.cut, variante: a.regle?.variante ?? null, reference: a.reference ?? null }); return G.deciderDiffere(a); } };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = 111; adapter.rails = K.clone(base.rails); adapter.ajuster();
  await b.api('start', { part: 23, start: 111, end: 113, ...SCOPE }); await b.settle(); await attendre(30);
  return { b, adapter, appels };
}

test('profil « L1-se » (défaut) : variante L1-e et référence d\'écartement de la liste d\'ESV ; sans instantané, pas de référence ; jamais de pose approchée', async () => {
  assert.equal(S.lot.profil, 'L1-se');
  const x = await lotL1se({ liste: true });
  assert.equal(scopeDe(x.b).lotProfil, 'L1-se');
  const a = x.appels.find(c => c.cut === 112);
  assert.ok(a, 'la GCV2 est appelée sur le différé de la chaîne');
  assert.equal(a.variante, 'L1-e');
  assert.equal(a.reference.mm, 1435, 'référence : les lignes valides non touchées de l\'instantané (1 435 mm)');
  assert.equal(x.b.store.events.filter(e => e.type === 'l1-pose-sans-valider').length, 0, 'aucune pose sans validation');
  const y = await lotL1se({ liste: false });
  const b = y.appels.find(c => c.cut === 112);
  assert.equal(b.variante, 'L1-e'); assert.equal(b.reference, null, 'sans instantané de la liste : aucune référence');
});
