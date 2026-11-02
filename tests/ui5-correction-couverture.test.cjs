'use strict';
/* CH-040 — SIGNAL DIT CE QUE L'AURORE COUVRE (src/signal-rendu.js, lecture de la vue ; habillage de CH-036) : les parties nommées, le nombre de lots quand
 * une partie en porte plusieurs (file relancée), et « N lots » sur la ligne de la partie. Contre la page minimale ; session fabriquée. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { monter } = require('./helpers/ui5-page.cjs');
const CL = require('../src/correction-liste.js');
const { session } = require('./helpers/aurore-session.cjs');
const K = CL.couverture(session());
const LOT = { id: 'C', state: 'COMPLETED', scope: { part: 1, start: 12, end: 14 }, processed: [], deferred: [] };
async function page(listes) {
  const p = await monter({ etat: { batch: LOT, current: { identity: { part: 1, cut: 14 } }, connection: { status: 'ready', tabId: 12 }, native: { status: 'IDLE', visits: [] },
    correction: { id: 'X2', etat: 'proposee', creeA: '2026-11-02T09:00:00Z', listes } } });
  p.els.tabs.options = [{ value: '12', textContent: 'ESV · partie 1' }]; p.els.tabs.value = '12';
  for (const id of ['correction-demarrer', 'correction-ouvrir', 'correction-terminer', 'correction-fermer', 'correction-liste']) p.els[id].disabled = false;
  p.ui.agir('sg:onglet-correction'); return p.hote.innerHTML;
}

test('deux parties, trois lots : « Parties 0, 1 · 3 lots », et « 2 lots » sur la partie 1 seulement', async () => {
  const h = await page(K.listes);
  assert.match(h, /Parties 0, 1 · 3 lots · 4 à corriger, 3 à poser/);
  assert.match(h, /data-partie="1"[^>]*><b class="sg-mono">Partie 1<\/b><span class="sg-n">0 sur 4<\/span><span class="sg-d">2 lots/);
  assert.doesNotMatch(h, /<b class="sg-mono">Partie 0<\/b><span class="sg-n">0 sur 3<\/span><span class="sg-d">\d lots/);
});

test('un lot par partie (une seule file) : pas de compte de lots, comme avant', async () => {
  const h = await page([K.listes[0]]);
  assert.match(h, /Partie 0 · 2 à corriger, 1 à poser/);
  assert.doesNotMatch(h, /\d lots/);
});
