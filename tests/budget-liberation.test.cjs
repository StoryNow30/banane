const { test } = require('node:test'), assert = require('node:assert/strict');
const { Observer } = require('../src/native-page.js');
const { Sessions } = require('../src/native-session.js');
const S = require('../src/settings.js');

/* Trois correctifs issus du terrain du 15/09 (11 sessions, 616 « échecs » de
 * capture, 0 panne réelle). */

/* ---------------------------------------------------------------- budget --
 * 530 des 616 échecs étaient `capture-limit-per-visit-reached` : le budget
 * plat de 8 captures par visite. Sur les 48 visites où il a coupé, 26 (54 %)
 * n'avaient PAS les deux côtés qualifiés — il refusait exactement les captures
 * qui auraient complété la géométrie. */

function collecteur({ qualifie = () => false } = {}) {
  let horloge = 0, n = 0;
  const captures = [];
  const api = {
    now: () => horloge, performanceNow: () => horloge,
    send: async () => ({ saved: true }),
    interval: () => 1, clearInterval: () => { }, defer: fn => queueMicrotask(fn),
    install: () => { }, uninstall: () => { }, editable: () => false, targetKind: () => 'other',
    signalFailure: () => { }, snapshot: () => ({}),
    capture: async (state, vivant, request) => {
      const index = n++;
      captures.push(index);
      const cote = index % 2 ? 'right' : 'left';
      await request.onCheckpoint({
        chunkId: 'c' + index, captureId: request.captureId, side: cote,
        qualification: { status: qualifie(index, cote) ? 'qualified-candidate' : 'insufficient' },
        pointsSceneRelative: [[0, 0, 0]],
      });
      return { format: 'banane-native-lidar-capture-v2', captureId: request.captureId };
    },
  };
  const o = new Observer(api, {});
  o.sessionId = 's'; o.periodId = 'p';
  o.checkpointReceipts = { get: () => ({ storageConfirmedAt: 'oui' }), delete: () => { } };
  return { o, captures, avancer: ms => { horloge += ms; },
    reposer: async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); } };
}
function visite(o) {
  const v = { visitId: 'v1', state: { identity: { part: 28, cut: 1 } },
    attemptedCaptureKeys: new Set(), pendingCaptureState: null,
    captureCount: 0, qualifiedSides: new Set() };
  o.current = v; o.active = true; return v;
}

test('sans qualification, le budget ne coupe pas à 8', () => {
  const { o } = collecteur();
  const v = visite(o);
  assert.equal(o.captureBudget(v), S.collector.maxCapturesPerVisitUnqualified);
  assert.ok(S.collector.maxCapturesPerVisitUnqualified > S.collector.maxCapturesPerVisit,
    'le plafond non qualifié doit être plus haut, sinon le correctif ne sert à rien');
});

test('une fois les DEUX côtés qualifiés, le budget serré s’applique', () => {
  const { o } = collecteur();
  const v = visite(o);
  v.qualifiedSides.add('left');
  assert.equal(o.captureBudget(v), S.collector.maxCapturesPerVisitUnqualified,
    'un seul côté ne suffit pas : il faut les deux');
  v.qualifiedSides.add('right');
  assert.equal(o.captureBudget(v), S.collector.maxCapturesPerVisit);
});

test('le budget atteint n’est pas compté comme une panne', () => {
  const { o } = collecteur();
  const v = visite(o);
  v.qualifiedSides.add('left'); v.qualifiedSides.add('right');
  v.captureCount = S.collector.maxCapturesPerVisit;
  o.startCapture(v, { identity: { part: 28, cut: 1 } });
  const m = o.metricSnapshot();
  assert.equal(m.captureBudgeted, 1, 'le budget est compté à part');
  assert.equal(m.captureFailed, 0, 'un budget respecté n’est pas une panne');
});

test('le motif distingue un budget qualifié d’un budget prématuré', async () => {
  const { o } = collecteur();
  const envoyes = [];
  o.api.send = async (type, p) => { envoyes.push({ type, reason: p.reason }); return { saved: true }; };
  const v = visite(o);
  v.captureCount = S.collector.maxCapturesPerVisitUnqualified;
  o.startCapture(v, { identity: { part: 28, cut: 1 } });
  await new Promise(r => setImmediate(r));
  const refus = envoyes.find(e => e.type === 'capture-failed');
  assert.equal(refus.reason, 'capture-limit-per-visit-reached-still-unqualified',
    'le motif doit dire que la géométrie manquait encore');
});

test('un refus de cut n’est pas compté comme une panne de capture', async () => {
  const { o, reposer } = collecteur();
  o.api.capture = async () => { throw Error('Cible différente : cut'); };
  const v = visite(o);
  o.startCapture(v, { identity: { part: 28, cut: 1 } });
  await reposer();
  const m = o.metricSnapshot();
  assert.equal(m.captureRefused, 1, 'le refus est compté à part');
  assert.equal(m.captureFailed, 0, 'un refus légitime n’est pas une panne');
});

test('une vraie panne reste comptée comme telle', async () => {
  const { o, reposer } = collecteur();
  o.api.capture = async () => { throw Error('lecture LiDAR impossible'); };
  const v = visite(o);
  o.startCapture(v, { identity: { part: 28, cut: 1 } });
  await reposer();
  const m = o.metricSnapshot();
  assert.equal(m.captureFailed, 1);
  assert.equal(m.captureRefused, 0);
});

/* ------------------------------------------------------------ libération --
 * Terrain : le vidage automatique écrivait bien un segment, mais rien n'était
 * libéré. Session 3dd20460 — segment auto de 314 objets à 09:39, export final
 * de 680 à 09:41 : les 314 réécrits. Session 28bfe0a5 en 4.5.3 — 77,3 Mo pour
 * 646 objets dont 315 déjà sur disque. */

function sessionStub() {
  const clouds = new Map();
  const s = Object.create(Sessions.prototype);
  s.store = {
    getCloud: async id => clouds.get(id),
    deleteCloud: async id => { clouds.delete(id); },
    all: async () => [],
    deleteRecord: async () => { }, deleteEvent: async () => { },
  };
  s.adapter = { nativeFinish: async () => { } };
  s.e = { s: { native: { id: 'sess', cloudIds: [], metrics: {} } }, save: async () => { } };
  s.clouds = clouds;
  return s;
}
const nuage = (id, points) => ({ chunkId: id, captureId: id,
  pointsSceneRelative: Array.from({ length: points }, (_, i) => [i, i, i]) });

async function remplir(s, n, points = 500) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const c = nuage('c' + i, points);
    s.clouds.set(c.chunkId, c);
    s.e.s.native.cloudIds.push(c.chunkId);
    s.accountStored(s.e.s.native, c);
    ids.push(c.chunkId);
  }
  return ids;
}

test('acquitter un segment libère réellement la place', async () => {
  const s = sessionStub(), n = s.e.s.native;
  const ids = await remplir(s, 20);
  const avant = n.exportState.bytesStored;
  assert.equal(s.clouds.size, 20);
  const r = await s.ackExported(ids.slice(0, 12));
  assert.equal(r.released, 12, 'les objets acquittés sont purgés');
  assert.equal(s.clouds.size, 8, 'il ne reste que ce qui n’est pas encore écrit');
  assert.ok(n.exportState.bytesStored < avant, 'le volume stocké doit baisser');
  assert.equal(n.exportState.bytesPending, 0);
});

test('les identifiants purgés restent DÉCLARÉS, donc une perte reste détectable', async () => {
  const s = sessionStub(), n = s.e.s.native;
  const ids = await remplir(s, 20);
  await s.ackExported(ids.slice(0, 12));
  assert.equal(n.cloudIds.length, 20,
    'la session doit continuer à déclarer les 20 objets, sinon un segment manquant disparaît en silence');
  assert.equal(n.exportState.releasedCloudIds.length, 12);
});

test('le manifeste ne redemande pas ce qui est déjà écrit', async () => {
  const s = sessionStub(), n = s.e.s.native;
  const ids = await remplir(s, 20);
  s.dataset = async () => ({ session: n, records: [], events: [], cloudIds: n.cloudIds.slice() });
  s.exportAdvice = () => ({ due: false });
  await s.ackExported(ids.slice(0, 12));
  const m = await s.exportManifest(true);
  assert.equal(m.cloudIds.length, 8, 'seuls les objets encore lisibles sont demandés');
  assert.equal(m.declaredCloudIds.length, 20, 'la déclaration complète accompagne le manifeste');
  assert.equal(m.released, 12);
});

test('un objet impossible à purger ne bloque pas l’acquittement', async () => {
  const s = sessionStub(), n = s.e.s.native;
  const ids = await remplir(s, 5);
  s.store.deleteCloud = async () => { throw Error('stockage occupé'); };
  const r = await s.ackExported(ids);
  assert.equal(r.acknowledged, 5, 'l’acquittement reste acquis');
  assert.equal(r.released, 0, 'aucune purge annoncée à tort');
});

/* --------------------------------------------------------------- abandon -- */

test('abandonner une session supprime ses données et rend le compte', async () => {
  const s = sessionStub(), n = s.e.s.native;
  await remplir(s, 7);
  s.store.all = async name => name === 'records'
    ? [{ recordId: 'r1', nativeSessionId: 'sess' }, { recordId: 'r2', nativeSessionId: 'autre' }]
    : [{ eventId: 'e1', sessionId: 'sess' }, { eventId: 'e2', sessionId: 'autre' }];
  const r = await s.discard();
  assert.equal(r.discarded, true);
  assert.equal(r.clouds, 7);
  assert.equal(r.records, 1, 'seule la session visée est touchée');
  assert.equal(r.events, 1);
  assert.equal(s.clouds.size, 0);
  assert.equal(s.e.s.native, null, 'la session est retirée de l’état');
});

test('abandonner sans session en cours est refusé clairement', async () => {
  const s = sessionStub();
  s.e.s.native = null;
  await assert.rejects(() => s.discard(), /Aucune session Natif conservée/);
});

test('l’abandon n’échoue pas si la page ESV ne répond plus', async () => {
  const s = sessionStub();
  await remplir(s, 3);
  s.adapter.nativeFinish = async () => { throw Error('onglet fermé'); };
  const r = await s.discard();
  assert.equal(r.clouds, 3, 'les données sont supprimées malgré l’adaptateur muet');
});
