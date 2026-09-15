const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { Observer } = require('../src/native-page.js');
const S = require('../src/settings.js');

/* Rejeu du collecteur avec injection de pannes, sur la forme d'événements
 * d'une session réelle.
 *
 * Pourquoi : le rétablissement après dégradation est le correctif le plus
 * important du chantier — deux échecs d'envoi suffisaient à couper le LiDAR
 * pour toute la session. Mais aucune session de terrain n'a dégradé depuis,
 * donc ce chemin n'a jamais été exercé en conditions réelles. À défaut, on
 * l'exerce ici sur la vraie séquence d'événements, avec des pannes provoquées.
 *
 * L'invariant central est la CONSERVATION : tout élément mis en file finit
 * envoyé, ou compté comme jeté, ou écarté AVEC sa cause. Rien ne disparaît en
 * silence. C'est la propriété que la V4.4.3 violait. */

const REEL = path.resolve(__dirname, 'fixtures', 'terrain-reel.json');
const evenementsReels = JSON.parse(fs.readFileSync(REEL, 'utf8')).events || [];

function banc({ envoi, options = {} } = {}) {
  let horloge = 0;
  const envoyes = [];
  const api = {
    now: () => horloge, performanceNow: () => horloge,
    send: async (type, payload) => {
      const verdict = envoi ? envoi(type, payload, envoyes.length) : { saved: true };
      if (verdict instanceof Error) throw verdict;
      envoyes.push({ type, collectorSeq: payload.collectorSeq });
      return verdict;
    },
    interval: () => 1, clearInterval: () => { }, defer: fn => queueMicrotask(fn),
    install: () => { }, uninstall: () => { }, editable: () => false, targetKind: () => 'other',
    signalFailure: () => { }, snapshot: () => ({}),
  };
  const o = new Observer(api, options);
  o.sessionId = 'session-reelle'; o.periodId = 'periode-1';
  return {
    observer: o, envoyes,
    avancer: ms => { horloge += ms; },
    reposer: async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); },
  };
}

/* Conservation : mis en file = envoyés + jetés + écartés + refusés + en attente. */
function conservation(o, envoyes) {
  const m = o.metricSnapshot();
  const compte = envoyes.length + m.dropped + (m.setAside || 0) + (m.refused || 0) + o.queue.length;
  return { attendu: m.enqueued, obtenu: compte, m };
}

test('la séquence réelle passe sans perte quand tout va bien', async () => {
  const b = banc();
  for (const e of evenementsReels) { b.observer.enqueue(e.type || 'native-state-observed', { visitId: e.visitId }); await b.reposer(); }
  const c = conservation(b.observer, b.envoyes);
  assert.equal(c.obtenu, c.attendu, 'conservation rompue');
  assert.equal(c.m.dropped, 0);
  assert.equal(c.m.degradationLevel, 'FULL');
  assert.equal(b.envoyes.length, evenementsReels.length, 'tous les événements envoyés');
});

test('une panne passagère dégrade puis se répare, et rien n’est perdu', async () => {
  // Panne sur une fenêtre au milieu de la séquence, puis retour à la normale.
  let appels = 0;
  const b = banc({
    envoi: () => {
      appels++;
      if (appels > 10 && appels <= 24) return Error('coupure réseau passagère');
      return { saved: true };
    },
  });
  for (const e of evenementsReels) {
    b.observer.enqueue(e.type || 'native-state-observed', { visitId: e.visitId });
    await b.reposer(); b.avancer(400); await b.observer.flush(); await b.reposer();
  }
  // Temps calme : la file se vide et le collecteur doit remonter.
  for (let i = 0; i < 8; i++) { b.avancer(5000); await b.observer.flush(); await b.reposer(); }

  const c = conservation(b.observer, b.envoyes);
  assert.equal(c.obtenu, c.attendu, 'conservation rompue après panne');
  assert.equal(c.m.degradationPeak !== 'FULL', true, 'la dégradation doit avoir été constatée');
  assert.equal(c.m.degradationLevel, 'FULL', 'le collecteur doit être revenu au niveau complet');
  assert.ok(c.m.recoveries >= 1, 'au moins un rétablissement enregistré');
});

test('deux échecs isolés ne coupent plus le LiDAR', async () => {
  // Le cas exact de la session 1789370906681 : deux échecs, puis plus rien.
  let appels = 0;
  const b = banc({ envoi: () => (++appels === 3 || appels === 9) ? Error('échec isolé') : { saved: true } });
  for (const e of evenementsReels.slice(0, 30)) {
    b.observer.enqueue(e.type || 'native-state-observed', { visitId: e.visitId });
    await b.reposer(); b.avancer(2000); await b.observer.flush(); await b.reposer();
  }
  for (let i = 0; i < 6; i++) { b.avancer(5000); await b.observer.flush(); await b.reposer(); }
  const m = b.observer.metricSnapshot();
  assert.equal(m.degradationLevel, 'FULL', 'le LiDAR doit rester actif');
  assert.ok(m.sendFailures >= 2, 'les échecs sont bien comptés');
  assert.equal(conservation(b.observer, b.envoyes).obtenu, m.enqueued);
});

test('un refus définitif au milieu du flux ne perturbe pas la suite', async () => {
  const b = banc({
    envoi: (type, payload) => payload.visitId === 'refus'
      ? Error('Cible différente : cut')
      : { saved: true },
  });
  const suite = evenementsReels.slice(0, 20);
  for (let i = 0; i < suite.length; i++) {
    b.observer.enqueue('capture-checkpoint', { visitId: i === 7 ? 'refus' : suite[i].visitId }, true);
    await b.reposer();
  }
  const m = b.observer.metricSnapshot();
  assert.equal(m.refused, 1, 'le refus est compté');
  assert.equal(m.sendFailures, 0, 'un refus légitime n’est pas une panne');
  assert.equal(m.degradationLevel, 'FULL');
  assert.equal(b.envoyes.length, suite.length - 1, 'tout le reste est passé');
  assert.equal(conservation(b.observer, b.envoyes).obtenu, m.enqueued);
});

test('sous saturation, ce qui est jeté est compté, jamais silencieux', async () => {
  // File volontairement minuscule et envoi bloqué : on force le rejet.
  const b = banc({ envoi: () => Error('stockage indisponible'), options: { maxQueue: 12, maxItemAttempts: 2 } });
  for (const e of evenementsReels) b.observer.enqueue(e.type || 'native-state-observed', { visitId: e.visitId });
  await b.reposer();
  for (let i = 0; i < 10; i++) { b.avancer(9000); await b.observer.flush(); await b.reposer(); }
  const c = conservation(b.observer, b.envoyes);
  assert.equal(c.obtenu, c.attendu, 'des éléments se sont volatilisés');
  assert.ok(c.m.dropped + c.m.setAside > 0, 'la saturation doit produire des pertes comptées');
  for (const item of c.m.setAsideItems) {
    assert.ok(item.reason && item.reason.length > 0, 'un élément écarté sans cause');
    assert.ok(item.observedAt, 'un élément écarté sans horodatage');
  }
});

test('le pic de dégradation subi reste lisible après retour à la normale', async () => {
  let appels = 0;
  const b = banc({ envoi: () => (++appels <= 15 ? Error('panne') : { saved: true }) });
  for (const e of evenementsReels.slice(0, 25)) {
    b.observer.enqueue(e.type || 'native-state-observed', { visitId: e.visitId });
    await b.reposer(); b.avancer(9000); await b.observer.flush(); await b.reposer();
  }
  for (let i = 0; i < 8; i++) { b.avancer(5000); await b.observer.flush(); await b.reposer(); }
  const m = b.observer.metricSnapshot();
  assert.equal(m.degradationLevel, 'FULL');
  assert.notEqual(m.degradationPeak, 'FULL', 'la dégradation subie ne doit pas être effacée');
  assert.ok(m.degradationEvents >= 1);
});

test('les réglages de récupération sont ceux de la source unique', () => {
  const b = banc();
  assert.equal(b.observer.recoveryMs, S.collector.recoveryMs);
  assert.equal(b.observer.failuresBeforeMetadataOnly, S.collector.failuresBeforeMetadataOnly);
});
