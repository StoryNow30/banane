'use strict';
/* CH-037 — `pageLost` (rechargement de la page ESV, fermeture de l'onglet) clôt la visite en cours et la classe, mais ne recopiait pas sa fin ni son
 * étiquette dans le résumé `n.visits` (seul `visit-ended` le faisait) : une visite validée (Maj+Espace observé) puis perdue avec la page restait sans
 * libellé (cut 9748 de la partie 11, 01/11, changement de partie par l'opérateur). Séance Écho réelle (src/native-session.js) ; données fabriquées. */
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
  return { b, ctx, st };
}

test('CH-037 : visite validée puis perdue avec la page : le résumé n.visits porte sa fin et l’étiquette de l’enregistrement', async () => {
  const { b, ctx, st } = await seance();
  await b.message({ kind: 'native-event', type: 'operator-event', payload: { ...ctx(), visitId: 'v1', identity: st.identity, stateObservedBeforeInput: st, event: { type: 'keydown', intent: 'VALIDATE', decisionKey: 'Shift+Space', observedAt: new Date().toISOString() } } }, esv);
  await b.fonction('native.pageLost("page-reloaded")');
  const v = b.fonction('engine.s.native.visits').find(x => x.visitId === 'v1'), rec = b.store.records.find(r => r.visitId === 'v1');
  assert.equal(rec.observedLabelCandidate, 'VALIDATE_NO_MOVEMENT');
  assert.equal(v.label, rec.observedLabelCandidate, 'étiquette recopiée dans le résumé');
  assert.equal(v.endedAt, rec.endedAt, 'fin recopiée dans le résumé');
  assert.equal(b.fonction('engine.s.native.status'), 'PAUSED_ADAPTER_UNRESPONSIVE');
});

test('CH-037 : visite sans décision perdue avec la page : PASS_NO_DECISION, comme une visite close', async () => {
  const { b } = await seance();
  await b.fonction('native.pageLost("tab-closed")');
  const v = b.fonction('engine.s.native.visits').find(x => x.visitId === 'v1');
  assert.equal(v.label, 'PASS_NO_DECISION'); assert.ok(v.endedAt);
});
