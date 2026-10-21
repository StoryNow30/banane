'use strict';
/* Cap 5, piste 1 (fiches/L1_CAP5.md) — CAPTURE VIDE DANS UN LOT : réglage `lot.recaptureVide`, coupé par défaut. Actif : une capture de moins de
 * `minPoints` points est refaite après l'attente, la plus fournie est gardée, un événement `recapture-vide` le dit. Coupé : une seule capture.
 * Montage commun : tests/helpers/lot-profil.cjs. Données synthétiques (capture d'essai de 4 764 points ; la première capture du cut 112 est vide). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { production, base, K, S, SCOPE, attendre, EsvVue } = require('./helpers/lot-profil.cjs');

class EsvVideUneFois extends EsvVue {
  constructor() { super([]); this.vides = 1; this.captures = []; }
  async capture(expected) { const d = await super.capture(expected); if (this.identity.cut === 112 && this.vides > 0) { this.vides--; d.pointsSceneRelative = []; }
    this.captures.push([this.identity.cut, d.pointsSceneRelative.length]); return d; }
}
async function lot(reglage) {
  const adapter = new EsvVideUneFois(), b = production({ adapter });
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false }, ...(reglage ? { lot: { ...S.lot, recaptureVide: reglage } } : {}) };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = 111; adapter.rails = K.clone(base.rails);
  await b.api('start', { part: 23, start: 111, end: 113, ...SCOPE }); await b.settle(); await attendre(30);
  return { b, adapter };
}

test('recapture d\'une capture vide : coupée par défaut (une capture), active (la capture refaite est gardée, événement consigné)', async () => {
  assert.equal(S.lot.recaptureVide.actif, false, 'coupée par défaut');
  const x = await lot(null);
  assert.deepEqual(x.adapter.captures.filter(([c]) => c === 112).map(([, n]) => n), [0], 'coupée : une seule capture, vide');
  assert.equal(x.b.store.events.filter(e => e.type === 'recapture-vide').length, 0);
  const y = await lot({ actif: true, minPoints: 100, attenteMs: 5, essais: 2 });
  assert.deepEqual(y.adapter.captures.filter(([c]) => c === 112).map(([, n]) => n), [0, 4764], 'active : refaite une fois, pleine');
  const ev = y.b.store.events.filter(e => e.type === 'recapture-vide');
  assert.equal(ev.length, 1); assert.equal(ev[0].identity.cut, 112); assert.equal(ev[0].pointsAvant, 0); assert.equal(ev[0].pointsApres, 4764);
  assert.deepEqual(y.adapter.captures.filter(([c]) => c !== 112).map(([, n]) => n), [4764, 4764], 'les captures pleines ne sont pas refaites');
});
