'use strict';
/* 02/11 (retour de l'opérateur : « un bug sur Écho où je n'arrive pas à vider le cache ») — `viderCacheExport` refusait « Écho est actif » dès que la session
 * Écho était ouverte, PAUSE comprise (page ESV rechargée : PAUSED_ADAPTER_UNRESPONSIVE ; Écho en pause). Le vidage garde déjà les données de la séance Écho
 * (ses événements, enregistrements et nuages) : seul un Écho qui TOURNE (STARTING, RUNNING) bloque désormais. Séance Écho réelle ; données fabriquées. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { K } = require('./fixtures.cjs'), Settings = require('../src/settings.js'), EC = require('../src/export-cache.js');
const { background } = require('./helpers/background-harness.cjs');
const esv = { id: 'test', url: require('../manifest.json').host_permissions[0].replace(/\*$/, '') + 'test', tab: { id: 1 } };

async function seance() {
  const b = background({ globals: { BananeCore3: K, BananeSettings: Settings, BananeExportCache: EC } });
  await b.api('connect', { tabId: 1 }); await b.api('native-start');
  const ctx = () => ({ sessionId: b.fonction('engine.s.native.id'), observationPeriodId: b.fonction('engine.s.native.currentPeriodId') });
  const st = await b.adapter.state();
  await b.message({ kind: 'native-event', type: 'visit-started', payload: { ...ctx(), visitId: 'v1', identity: st.identity, initialObserved: st } }, esv);
  return b;
}

test('Écho en pause (page ESV perdue) : le vidage manuel n’est plus refusé, et les données de la séance Écho sont gardées', async () => {
  const b = await seance();
  await b.fonction('native.pageLost("page-reloaded")');
  assert.equal(b.fonction('engine.s.native.status'), 'PAUSED_ADAPTER_UNRESPONSIVE');
  const avant = b.store.records.filter(r => r.nativeSessionId).length;
  assert.ok(avant >= 1);
  await b.api('export-cache-clear', { manuel: true });
  assert.equal(b.store.records.filter(r => r.nativeSessionId).length, avant, 'les enregistrements de la séance Écho sont gardés');
});

test('Écho qui tourne : le vidage reste refusé (« Écho est actif »)', async () => {
  const b = await seance();
  await assert.rejects(() => b.api('export-cache-clear', { manuel: true }), /Écho est actif/);
});
