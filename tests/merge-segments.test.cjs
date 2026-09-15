const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const X = require('../src/native-export.js');

const TOOL = path.resolve(__dirname, '..', 'tools', 'merge-segments.cjs');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'banane-seg-')); }
const cloud = id => ({
  format: 'banane-native-lidar-chunk-v1', chunkId: id, side: 'left',
  rail: { railLocalToSceneRelative: [1], profileLocalToSceneRelative: [1], sceneRelativeToProfileLocal: [1] },
  pointsSceneRelative: [[1, 2, 3], [4, 5, 6]], visibleByClipBoxes: [true, false],
});
/* Un segment tel que le panneau l'écrit : nuages incrémentaux, métadonnées
 * complètes à l'instant du vidage. */
function segment({ stamp, index, cloudIds, allCloudIds, records, events }) {
  return X.compact({
    format: 'banane-native-session-v2', version: '4.4.3',
    session: { id: 's1', status: 'RUNNING', cloudIds: allCloudIds },
    records: records.map(r => ({ recordId: r, visitId: r })),
    events: events.map(n => ({ eventId: 'e' + n, eventSeq: n, type: 'native-state-observed' })),
    closureSummary: { visits: records.length },
    clouds: cloudIds.map(cloud),
  }, {});
}
function write(dir, name, doc) {
  const d = { ...doc, segment: { index: 1, stamp: name, objects: (doc.clouds || []).length, format: 'banane-native-export-segment-v1' } };
  const p = path.join(dir, name + '.json');
  fs.writeFileSync(p, JSON.stringify(d));
  return p;
}
function run(dir, out, files) {
  const r = spawnSync(process.execPath, [TOOL, '--out', out, ...files], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/* Régression observée sur le terrain le 15/09/2026 : deux vidages automatiques
 * réels portaient 20 puis 43 records et 781 puis 1626 événements. L'ancienne
 * fusion prenait les métadonnées du PREMIER segment et perdait silencieusement
 * 23 visites et 845 événements, tout en annonçant « 0 manquant ». */
test('la fusion garde toutes les visites, pas seulement celles du premier segment', () => {
  const dir = tmp(), out = path.join(dir, 'fusion.json');
  const a = write(dir, '2026-09-15T06-39-29', segment({
    cloudIds: ['c1', 'c2'], allCloudIds: ['c1', 'c2'],
    records: ['r1', 'r2'], events: [1, 2, 3],
  }));
  const b = write(dir, '2026-09-15T06-41-00', segment({
    cloudIds: ['c3', 'c4'], allCloudIds: ['c1', 'c2', 'c3', 'c4'],
    records: ['r1', 'r2', 'r3', 'r4', 'r5'], events: [1, 2, 3, 4, 5, 6, 7],
  }));
  const r = run(dir, out, [a, b]);
  assert.equal(r.status, 0, r.stderr);

  const merged = JSON.parse(fs.readFileSync(out));
  assert.equal(merged.records.length, 5, 'toutes les visites du segment le plus avancé');
  assert.equal(merged.events.length, 7, 'tous les événements');
  assert.equal(merged.clouds.length, 4, 'nuages incrémentaux réunis');
  assert.equal(merged.session.cloudIds.length, 4, 'état de session le plus avancé retenu');
  assert.equal(merged.mergeTrace.allDeclaredPresent, true);
  assert.equal(merged.mergeTrace.missingCloudIds, 0);
});

test('les événements ressortent ordonnés et sans doublon', () => {
  const dir = tmp(), out = path.join(dir, 'fusion.json');
  const a = write(dir, '2026-09-15T06-39-29', segment({ cloudIds: ['c1'], allCloudIds: ['c1'], records: ['r1'], events: [1, 2, 3] }));
  const b = write(dir, '2026-09-15T06-41-00', segment({ cloudIds: ['c2'], allCloudIds: ['c1', 'c2'], records: ['r1', 'r2'], events: [1, 2, 3, 4, 5] }));
  assert.equal(run(dir, out, [b, a]).status, 0, 'l’ordre des arguments ne doit pas compter');

  const merged = JSON.parse(fs.readFileSync(out));
  const seqs = merged.events.map(e => e.eventSeq);
  assert.deepEqual(seqs, [1, 2, 3, 4, 5], 'union ordonnée, aucun doublon');
  assert.equal(merged.records.length, 2);
});

test('un nuage présent dans deux segments n’est gardé qu’une fois', () => {
  const dir = tmp(), out = path.join(dir, 'fusion.json');
  const a = write(dir, '2026-09-15T06-39-29', segment({ cloudIds: ['c1', 'c2'], allCloudIds: ['c1', 'c2'], records: ['r1'], events: [1] }));
  const b = write(dir, '2026-09-15T06-41-00', segment({ cloudIds: ['c2', 'c3'], allCloudIds: ['c1', 'c2', 'c3'], records: ['r1'], events: [1, 2] }));
  assert.equal(run(dir, out, [a, b]).status, 0);

  const merged = JSON.parse(fs.readFileSync(out));
  assert.deepEqual(merged.clouds.map(c => c.chunkId), ['c1', 'c2', 'c3']);
  assert.equal(merged.mergeTrace.segments[1].doublons, 1, 'le doublon est compté, pas caché');
});

test('un segment manquant est signalé au lieu d’être passé sous silence', () => {
  const dir = tmp(), out = path.join(dir, 'fusion.json');
  // Le dernier segment annonce trois nuages, on n'en fournit que deux.
  const a = write(dir, '2026-09-15T06-39-29', segment({ cloudIds: ['c1'], allCloudIds: ['c1'], records: ['r1'], events: [1] }));
  const b = write(dir, '2026-09-15T06-41-00', segment({ cloudIds: ['c2'], allCloudIds: ['c1', 'c2', 'c3'], records: ['r1'], events: [1, 2] }));
  const r = run(dir, out, [a, b]);
  assert.notEqual(r.status, 0, 'la fusion incomplète doit échouer bruyamment');
  assert.match(r.stdout + r.stderr, /manquants : 1/);
  assert.match(r.stderr, /ne pas présenter ce fichier comme une session entière/);
});

test('le fichier fusionné repart en format v2, lisible par le banc', () => {
  const dir = tmp(), out = path.join(dir, 'fusion.json');
  const a = write(dir, '2026-09-15T06-39-29', segment({ cloudIds: ['c1'], allCloudIds: ['c1'], records: ['r1'], events: [1] }));
  assert.equal(run(dir, out, [a]).status, 0);
  const merged = JSON.parse(fs.readFileSync(out));
  assert.equal(merged.format, 'banane-native-session-v2');
  assert.equal(merged.dictionaries, undefined, 'plus aucune référence de dictionnaire');
  assert.deepEqual(merged.clouds[0].pointsSceneRelative, [[1, 2, 3], [4, 5, 6]]);
});
