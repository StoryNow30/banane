const { test } = require('node:test'), assert = require('node:assert/strict');
const { Sessions } = require('../src/native-session.js');
const X = require('../src/native-export.js');

/* Ces méthodes ne dépendent que de l'état de session : on les exerce sur un
 * support minimal, sans adaptateur ni stockage. */
function stub() {
  const s = Object.create(Sessions.prototype);
  let saves = 0;
  s.e = { s: { native: { cloudIds: [], metrics: {} } }, save: async () => { saves++; } };
  s.saves = () => saves;
  return s;
}
const cloudOf = (id, points) => ({
  format: 'banane-native-lidar-chunk-v1', chunkId: id,
  pointsSceneRelative: Array.from({ length: points }, (_, i) => [i, i, i]),
});

test('le volume stocké est comptabilisé au fil de la collecte', () => {
  const s = stub(), n = s.e.s.native;
  s.accountStored(n, cloudOf('a', 1000));
  assert.ok(n.exportState.bytesStored > 0);
  assert.equal(n.exportState.bytesStored, n.exportState.bytesPending);
  const first = n.exportState.bytesStored;
  s.accountStored(n, cloudOf('b', 1000));
  assert.equal(n.exportState.bytesStored, first * 2);
  assert.equal(n.metrics.bytesStored, n.exportState.bytesStored);
});

test('aucun conseil de vidage tant que le seuil n’est pas atteint', () => {
  const s = stub(), n = s.e.s.native;
  n.cloudIds.push('a');
  s.accountStored(n, cloudOf('a', 10));
  const advice = s.exportAdvice();
  assert.equal(advice.due, false);
  assert.equal(advice.watermark, Sessions.EXPORT_WATERMARK_BYTES);
});

test('le vidage est conseillé avant le mur de téléchargement', () => {
  const s = stub(), n = s.e.s.native;
  const points = Math.ceil(Sessions.EXPORT_WATERMARK_BYTES / Sessions.BYTES_PER_POINT_ESTIMATE) + 1;
  n.cloudIds.push('gros');
  s.accountStored(n, cloudOf('gros', points));
  const advice = s.exportAdvice();
  assert.equal(advice.due, true);
  assert.equal(advice.reason, 'watermark-reached');
  assert.equal(advice.pendingClouds, 1);
  // Le seuil doit rester sous la limite observée d'environ 64 Mo.
  assert.ok(Sessions.EXPORT_WATERMARK_BYTES < 64 * 1024 * 1024);
});

test('un segment acquitté remet le compteur en attente à zéro sans perdre l’historique', async () => {
  const s = stub(), n = s.e.s.native;
  const points = Math.ceil(Sessions.EXPORT_WATERMARK_BYTES / Sessions.BYTES_PER_POINT_ESTIMATE) + 1;
  n.cloudIds.push('a', 'b');
  s.accountStored(n, cloudOf('a', points));
  assert.equal(s.exportAdvice().due, true);
  const r = await s.ackExported(['a']);
  assert.equal(r.acknowledged, 1);
  assert.equal(r.segments, 1);
  assert.equal(n.exportState.bytesPending, 0);
  assert.ok(n.exportState.bytesStored > 0, 'le volume cumulé reste connu');
  const after = s.exportAdvice();
  assert.equal(after.due, false);
  assert.equal(after.pendingClouds, 1, 'b reste à exporter');
});

test('un acquittement répété n’invente pas de doublon', async () => {
  const s = stub(), n = s.e.s.native;
  n.cloudIds.push('a');
  s.accountStored(n, cloudOf('a', 10));
  await s.ackExported(['a']);
  const r = await s.ackExported(['a']);
  assert.equal(r.acknowledged, 0);
  assert.equal(n.exportState.exportedCloudIds.length, 1);
});

test('la comptabilité n’interrompt jamais la collecte', () => {
  const s = stub(), n = s.e.s.native;
  const hostile = {};
  Object.defineProperty(hostile, 'pointsSceneRelative', { get() { throw Error('lecture impossible'); } });
  assert.doesNotThrow(() => s.accountStored(n, hostile));
});

/* Fusion de segments : le contrat que merge-segments.cjs applique. */
test('des segments compactés se refusionnent sans perte ni doublon', () => {
  const mk = id => ({
    format: 'banane-native-lidar-chunk-v1', chunkId: id, side: 'left',
    rail: { railLocalToSceneRelative: [1], profileLocalToSceneRelative: [1], sceneRelativeToProfileLocal: [1] },
    pointsSceneRelative: [[1, 2, 3], [4, 5, 6]], visibleByClipBoxes: [true, false],
  });
  const meta = { format: 'banane-native-session-v2', session: { id: 's' }, records: [], events: [], cloudIds: ['a', 'b', 'c'] };
  const seg = ids => X.compact({ ...meta, clouds: ids.map(mk) }, {});
  const segments = [seg(['a', 'b']), seg(['b', 'c'])];   // 'b' présent deux fois

  const seen = new Set(); const clouds = [];
  for (const sgm of segments) for (const c of X.expand(sgm).clouds) {
    if (seen.has(c.chunkId)) continue;
    seen.add(c.chunkId); clouds.push(c);
  }
  assert.deepEqual(clouds.map(c => c.chunkId), ['a', 'b', 'c']);
  assert.equal(meta.cloudIds.filter(id => !seen.has(id)).length, 0, 'tous les cloudIds déclarés sont présents');
  assert.deepEqual(clouds[0].pointsSceneRelative, [[1, 2, 3], [4, 5, 6]]);
});
