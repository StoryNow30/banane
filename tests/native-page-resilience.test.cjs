const { test } = require('node:test'), assert = require('node:assert/strict');
const { Observer } = require('../src/native-page.js'), { K, base } = require('./fixtures.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));

/* Harnais minimal : on pilote l'horloge et la réponse de `send`. */
function fixture(options = {}) {
  let clock = 0;
  const sent = [], failures = [];
  let sendImpl = async () => ({ saved: true });
  const api = {
    snapshot: () => ({ identity: { pageId: 'p', part: 23, cut: 100, shape: 'U50', frameId: 'f', projectId: null }, rails: K.clone(base.rails), capturedAt: new Date().toISOString(), status: 'complete', partialReasons: [] }),
    send: async (type, payload) => { sent.push({ type, payload }); return sendImpl(type, payload); },
    now: () => clock, performanceNow: () => clock,
    interval: () => 1, clearInterval: () => { }, defer: fn => queueMicrotask(fn),
    install: () => { }, uninstall: () => { }, editable: () => false, targetKind: () => 'other',
    signalFailure: m => failures.push(m),
  };
  Object.assign(api, options.api || {});
  const observer = new Observer(api, options.observer || {});
  observer.sessionId = 'native-session'; observer.periodId = 'period-1';
  return {
    observer, sent, failures,
    setSend: fn => { sendImpl = fn; },
    advance: ms => { clock += ms; },
    settle: async () => { for (let i = 0; i < 8; i++) await flush(); },
  };
}

test('un seul échec d’envoi ne coupe plus le LiDAR pour toute la session', async () => {
  const f = fixture();
  let calls = 0;
  f.setSend(async () => { calls++; if (calls === 1) throw Error('panne passagère'); return { saved: true }; });
  f.observer.enqueue('state-observed', { visitId: 'v1' });
  await f.settle();
  // Avant : METADATA_ONLY définitif dès la première panne. Maintenant : simple DEGRADED.
  assert.equal(f.observer.metrics.degradationLevel, 'DEGRADED');
  assert.notEqual(f.observer.metrics.degradationLevel, 'METADATA_ONLY');
});

test('trois échecs consécutifs font bien basculer en METADATA_ONLY', async () => {
  const f = fixture();
  f.setSend(async () => { throw Error('panne durable'); });
  for (let i = 0; i < 4; i++) {
    f.observer.enqueue('state-observed', { visitId: 'v' + i });
    await f.settle();
    f.advance(9000);            // dépasse la temporisation pour réessayer
    await f.observer.flush(); await f.settle();
  }
  assert.equal(f.observer.metrics.degradationLevel, 'METADATA_ONLY');
});

test('la dégradation se répare quand la file retombe et que les envois repassent', async () => {
  const f = fixture();
  f.setSend(async () => { throw Error('panne'); });
  for (let i = 0; i < 4; i++) {
    f.observer.enqueue('state-observed', { visitId: 'v' + i });
    await f.settle(); f.advance(9000); await f.observer.flush(); await f.settle();
  }
  assert.equal(f.observer.metrics.degradationLevel, 'METADATA_ONLY');

  f.setSend(async () => ({ saved: true }));
  // Il faut à la fois du temps écoulé et une file redescendue sous lowWater.
  for (let i = 0; i < 6; i++) { f.advance(5000); await f.observer.flush(); await f.settle(); }
  assert.equal(f.observer.metrics.degradationLevel, 'FULL', 'le collecteur doit revenir à FULL');
  assert.ok(f.observer.metrics.recoveries >= 1);
});

test('le pic de dégradation reste conservé pour le diagnostic', async () => {
  const f = fixture();
  f.setSend(async () => { throw Error('panne'); });
  for (let i = 0; i < 4; i++) { f.observer.enqueue('e', { i }); await f.settle(); f.advance(9000); await f.observer.flush(); await f.settle(); }
  f.setSend(async () => ({ saved: true }));
  for (let i = 0; i < 6; i++) { f.advance(5000); await f.observer.flush(); await f.settle(); }
  const snap = f.observer.metricSnapshot();
  assert.equal(snap.degradationLevel, 'FULL');
  assert.equal(snap.degradationPeak, 'METADATA_ONLY', 'la dégradation subie ne doit pas être effacée');
  assert.ok(snap.degradationEvents >= 1);
});

test('un élément systématiquement refusé est mis à l’écart avec sa cause, et la file repart', async () => {
  const f = fixture({ observer: { maxItemAttempts: 3 } });
  f.setSend(async (type, payload) => {
    if (payload.visitId === 'poison') throw Error('Le stockage a refusé cet envoi pour une raison inattendue.');
    return { saved: true };
  });
  f.observer.enqueue('capture-checkpoint', { visitId: 'poison' }, true);
  f.observer.enqueue('state-observed', { visitId: 'suivant' });
  for (let i = 0; i < 6; i++) { f.advance(9000); await f.observer.flush(); await f.settle(); }

  assert.equal(f.observer.metrics.setAside, 1, 'l’élément fautif doit être écarté');
  assert.match(f.observer.metrics.setAsideItems[0].reason, /raison inattendue/);
  assert.equal(f.observer.metrics.setAsideItems[0].attempts, 3, 'après épuisement des réessais bornés');
  assert.equal(f.observer.queue.length, 0, 'la file doit être repartie');
  assert.ok(f.sent.some(s => s.payload.visitId === 'suivant'), 'les éléments suivants doivent partir');
});

/* Refus définitifs par conception : un checkpoint dont le cut a changé, un
 * chunkId déjà utilisé, une visite inconnue. Les réessayer est inutile, et les
 * compter comme des pannes de transport dégradait le collecteur à tort — c'est
 * la cascade observée sur la session 1789370906681. */
test('un refus définitif sort immédiatement, sans réessai inutile', async () => {
  for (const motif of [
    'Cible différente : cut',
    'Identifiant de bloc LiDAR déjà utilisé : copie immuable non remplacée.',
    'Checkpoint LiDAR associé à une autre visite.',
    'La visite native ne correspond à aucun enregistrement conservé.',
  ]) {
    const f = fixture();
    f.setSend(async (type, payload) => { if (payload.visitId === 'refus') throw Error(motif); return { saved: true }; });
    f.observer.enqueue('capture-checkpoint', { visitId: 'refus' }, true);
    f.observer.enqueue('state-observed', { visitId: 'suivant' });
    await f.settle();

    assert.equal(f.observer.metrics.refused, 1, motif);
    assert.equal(f.observer.queue.length, 0, 'la file repart tout de suite : ' + motif);
    const trace = f.observer.metrics.setAsideItems[0];
    assert.equal(trace.permanent, true);
    assert.equal(trace.attempts, 1, 'un seul essai, pas cinq');
    assert.equal(trace.reason, motif, 'la cause exacte est conservée');
    assert.ok(f.sent.some(s => s.payload.visitId === 'suivant'));
  }
});

test('un refus définitif ne dégrade pas le collecteur', async () => {
  const f = fixture();
  f.setSend(async (type, payload) => {
    if (String(payload.visitId).startsWith('refus')) throw Error('Cible différente : cut');
    return { saved: true };
  });
  // Bien plus que le seuil de bascule en METADATA_ONLY.
  for (let i = 0; i < 10; i++) { f.observer.enqueue('capture-checkpoint', { visitId: 'refus' + i }, true); await f.settle(); }
  const snap = f.observer.metricSnapshot();
  assert.equal(snap.refused, 10);
  assert.equal(snap.sendFailures, 0, 'un rejet légitime n’est pas une panne de transport');
  assert.equal(snap.degradationLevel, 'FULL', 'le LiDAR doit rester actif');
  assert.equal(snap.degradationPeak, 'FULL', 'aucune dégradation, donc aucun pic enregistré');
  assert.equal(snap.degradationEvents, 0);
});

test('la file absorbe les rafales avant de jeter', () => {
  // 128 était atteint sur les deux sessions dégradées du terrain.
  const f = fixture();
  assert.ok(f.observer.maxQueue >= 512, 'profondeur de file : ' + f.observer.maxQueue);
  assert.ok(f.observer.lowWater < f.observer.highWater);
  assert.ok(f.observer.highWater < f.observer.maxQueue);
});

test('la perte est expliquée et comptée, jamais silencieuse', async () => {
  const f = fixture({ observer: { maxItemAttempts: 2 } });
  f.setSend(async () => { throw Error('refus permanent'); });
  f.observer.enqueue('state-observed', { visitId: 'v1' });
  for (let i = 0; i < 5; i++) { f.advance(9000); await f.observer.flush(); await f.settle(); }
  const snap = f.observer.metricSnapshot();
  assert.equal(snap.setAside, 1);
  assert.equal(snap.setAsideItems.length, 1);
  assert.equal(snap.setAsideItems[0].type, 'state-observed');
  assert.ok(snap.setAsideItems[0].observedAt, 'la mise à l’écart est horodatée');
  assert.ok(snap.sendFailures >= 2);
});

test('la temporisation de réessai croît au lieu de marteler', async () => {
  const f = fixture();
  f.setSend(async () => { throw Error('panne'); });
  f.observer.enqueue('a', {});
  await f.settle();
  const first = f.observer.retryAt;
  f.advance(9000); await f.observer.flush(); await f.settle();
  const second = f.observer.retryAt - 9000;
  assert.ok(second > first, 'la deuxième attente doit être plus longue que la première');
});
