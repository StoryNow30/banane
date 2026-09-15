const { test } = require('node:test'), assert = require('node:assert/strict');
const { Sessions } = require('../src/native-session.js');

/* Terrain du 15/09 : sur une session de 92 visites, l'export s'arrêtait avec
 * « Message exceeded maximum allowed size of 64MiB ». Ce n'est pas la limite de
 * téléchargement mais celle de chrome.runtime.sendMessage : `dataset()`
 * renvoyait records et événements en un seul message. Deux segments écrits,
 * puis plus rien — 717 objets sur 977 mis à l'abri.
 *
 * Le manifeste ne doit donc JAMAIS transporter les gros tableaux. */
const LIMITE = 64 * 1024 * 1024;

function session({ records = 2, events = 2, clouds = 4, pointsParNuage = 10 } = {}) {
  const s = Object.create(Sessions.prototype);
  const n = {
    id: 'session-1', status: 'FINISHED', cloudIds: Array.from({ length: clouds }, (_, i) => 'c' + i),
    visits: [], incomplete: [], observationPeriods: [], metrics: {}, exportState: null,
  };
  const gros = Array.from({ length: 4000 }, (_, i) => [i, i + 1, i + 2]);
  s.e = { s: { native: n }, save: async () => { } };
  s.dataset = async () => ({
    format: 'banane-native-session-v2', version: '4.5.3', exportedAt: '2026-09-15T00:00:00.000Z',
    session: n, closureSummary: { visits: records },
    records: Array.from({ length: records }, (_, i) => ({ recordId: 'r' + i, nativeSessionId: n.id, lourd: gros })),
    events: Array.from({ length: events }, (_, i) => ({ eventId: 'e' + i, eventSeq: i, lourd: gros })),
    cloudIds: n.cloudIds.slice(),
  });
  return { s, n };
}

test('le manifeste ne transporte ni les visites ni les événements', async () => {
  const { s } = session({ records: 30, events: 60 });
  const m = await s.exportManifest();
  assert.equal(m.records, undefined, 'les records ne doivent pas être dans le message');
  assert.equal(m.events, undefined, 'les événements ne doivent pas être dans le message');
  // Leur nombre reste connu, pour que le panneau sache quoi aller chercher.
  assert.equal(m.recordCount, 30);
  assert.equal(m.eventCount, 60);
  assert.equal(m.sessionId, 'session-1');
});

test('le manifeste reste très en dessous de la limite de message', async () => {
  // Une session volumineuse : ce sont les records qui faisaient exploser le message.
  const { s } = session({ records: 200, events: 400, clouds: 1000 });
  const m = await s.exportManifest();
  const octets = Buffer.byteLength(JSON.stringify(m));
  assert.ok(octets < LIMITE / 8, 'manifeste de ' + octets + ' octets, trop lourd');
  // Pour comparaison, le jeu complet que l'ancien chemin envoyait :
  const complet = Buffer.byteLength(JSON.stringify(await s.dataset()));
  assert.ok(complet > octets * 10, 'le jeu complet doit être bien plus lourd que le manifeste');
});

test('le manifeste incrémental ne liste que les nuages pas encore écrits', async () => {
  const { s, n } = session({ clouds: 6 });
  n.exportState = { bytesStored: 1, bytesPending: 0, exportedCloudIds: ['c0', 'c1'], segments: 1 };
  const m = await s.exportManifest();
  assert.deepEqual(m.cloudIds, ['c2', 'c3', 'c4', 'c5']);
  assert.equal(m.alreadyExported, 2);
});

test('le manifeste complet liste tous les nuages, même déjà écrits', async () => {
  const { s, n } = session({ clouds: 6 });
  n.exportState = { bytesStored: 1, bytesPending: 0, exportedCloudIds: ['c0', 'c1'], segments: 1 };
  const m = await s.exportManifest(true);
  assert.equal(m.cloudIds.length, 6, 'un téléchargement final doit tout reprendre');
});

test('le manifeste garde l’état de session, que le panneau doit réécrire', async () => {
  const { s } = session();
  const m = await s.exportManifest();
  assert.ok(m.session, 'état de session présent');
  assert.ok(m.closureSummary, 'bilan de clôture présent');
  assert.equal(m.format, 'banane-native-session-v2');
});
