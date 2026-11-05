'use strict';
/* CH-051 — GARDE « SÉRIE DE CAPTURES VIDES » dans le service worker (réglage `lot.serieCapturesVides`, coupé par défaut). Montage commun :
 * tests/helpers/lot-profil.cjs ; ESV simulé qui ne rend aucun point sur les cuts 112 à 114 (comme pendant un blocage du chargeur d'ESV), puis des
 * captures pleines. Coupée : une capture par cut, trois différés, aucun événement. Active (seuil 2, attente 5 ms) : au 113 la garde attend et
 * recapture ; encore vide et sans Constellation, elle diffère (« rechargement-impossible ») ; au 114 elle diffère sans attendre ; la capture pleine
 * du 115 referme la série. Dans ce montage la chaîne du lot pose les cuts vides depuis l'appui du 111 : la garde ne change ni les décisions ni les
 * cuts validés, elle ne fait qu'attendre et relire. Données synthétiques. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { production, base, K, S, SCOPE, attendre, EsvVue, decisions } = require('./helpers/lot-profil.cjs');

class EsvVideParBloc extends EsvVue {
  constructor() { super([]); this.captures = []; }
  async capture(expected) { const d = await super.capture(expected); if (this.identity.cut >= 112 && this.identity.cut <= 114) d.pointsSceneRelative = [];
    this.captures.push([this.identity.cut, d.pointsSceneRelative.length]); return d; }
}
async function lot(reglage) {
  const adapter = new EsvVideParBloc(), b = production({ adapter });
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false }, deplacerVue: { ...S.deplacerVue, actif: false },
    lot: { ...S.lot, gardeApresDiffere: false, ...(reglage ? { serieCapturesVides: reglage } : {}) } };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = 111; adapter.rails = K.clone(base.rails);
  await b.api('start', { part: 23, start: 111, end: 116, ...SCOPE }); await b.settle(); await attendre(30);
  return { b, adapter };
}
const parCut = x => x.adapter.captures.reduce((m, [c, n]) => { (m[c] = m[c] || []).push(n); return m; }, {});

test('série de captures vides : allumée par défaut (D-283) ; coupée = une capture par cut vide ; active (attente et recapture au seuil, puis différés sans attente, série refermée par une capture pleine)', async () => {
  assert.equal(S.lot.serieCapturesVides.actif, true, 'allumée par défaut (D-283, décision de l\'opérateur du 05/11)');
  const x = await lot({ ...S.lot.serieCapturesVides, actif: false });
  const cx = parCut(x);
  assert.deepEqual([cx[112], cx[113], cx[114]], [[0], [0], [0]], 'coupée : une seule capture par cut vide');
  assert.equal(x.b.store.events.filter(e => e.type === 'serie-captures-vides').length, 0);

  const y = await lot({ actif: true, seuil: 2, attenteMs: 5, attentesParEssai: 1, rechargement: true, rechargementsParSerie: 1, reessaiApresCuts: 10 });
  const cy = parCut(y);
  assert.deepEqual(cy[112], [0], 'sous le seuil : une capture');
  assert.deepEqual(cy[113], [0, 0], 'au seuil : attente puis recapture du même cut');
  assert.deepEqual(cy[114], [0], 'série en cours : différé sans attente');
  assert.ok(cy[115] && cy[115][0] > 0 && cy[115].length === 1, 'capture pleine : une seule, la série se referme');
  const ev = y.b.store.events.filter(e => e.type === 'serie-captures-vides');
  assert.deepEqual(ev.map(e => [e.identity.cut, e.action, e.motif]), [[113, 'attendre', null], [113, 'differer', 'rechargement-impossible'], [114, 'differer', 'serie-en-cours']],
    'sans Constellation, aucun rechargement : la garde diffère');
  assert.equal(ev[0].series, 1); assert.equal(ev[0].vides, 2);
  const issues = z => z.b.store.events.filter(e => ['validation-accepted', 'defer-finalized'].includes(e.type)).map(e => [e.identity.cut, e.type]);
  assert.deepEqual(issues(y), issues(x), 'mêmes cuts validés et différés : la garde ne pose rien et ne diffère rien de plus');
  assert.deepEqual(decisions(y.b).map(([c, d]) => [c, d && d.stage, d && d.reason]), decisions(x.b).map(([c, d]) => [c, d && d.stage, d && d.reason]), 'mêmes décisions du lot');
  const bilan = ev[ev.length - 1];
  assert.equal(bilan.rechargements, 0); assert.equal(bilan.attentes, 1); assert.equal(bilan.differesSansAttente, 2);
});
