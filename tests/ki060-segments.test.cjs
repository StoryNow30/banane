const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const X = require('../src/native-export.js');
const { mergeFiles } = require('../tools/merge-segments.cjs');

/* KI-060 : le nuage qui ouvre un segment doit être lisible avec le dictionnaire
 * de CE segment. Chaque nuage a ici son propre repère de rail : une référence
 * qui vise le mauvais dictionnaire donne un autre repère, ou aucun. */
const TOOL = path.resolve(__dirname, '..', 'tools', 'export-simulate.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'banane-ki060-'));
function session(n) {
  const clouds = Array.from({ length: n }, (_, i) => ({
    format: 'banane-native-lidar-chunk-v1', chunkId: 'c' + i, side: 'left',
    identity: { pageId: 'p', part: 6, cut: 100 + i, shape: 'U50', frameId: 'f', projectId: null },
    rail: {
      railLocalToSceneRelative: Array.from({ length: 16 }, (_, k) => i + k / 3),
      profileLocalToSceneRelative: Array.from({ length: 16 }, (_, k) => i + k / 7),
      sceneRelativeToProfileLocal: Array.from({ length: 16 }, (_, k) => i + k / 11),
    },
    pointsSceneRelative: Array.from({ length: 40 }, (_, j) => [i + j / 1000, j / 1000, 1]),
  }));
  return { format: 'banane-native-session-v2', version: '4.7.19',
    session: { id: 's', status: 'FINISHED', cloudIds: clouds.map(c => c.chunkId) }, records: [], events: [], clouds };
}
function exporter(doc, legacy) {
  const dir = tmp(), input = path.join(dir, 'session.json'), out = path.join(dir, 'segs');
  fs.writeFileSync(input, JSON.stringify(doc));
  const r = spawnSync(process.execPath, [TOOL, '--input', input, '--out-dir', out, '--segment-bytes', '30000', ...(legacy ? ['--avant-ki060'] : [])], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return fs.readdirSync(out).sort().map(f => path.join(out, f));
}
const railOf = c => c.rail.railLocalToSceneRelative[0];

test('4.7.20 : chaque segment se relit seul, nuage de tête compris', () => {
  const doc = session(240), files = exporter(doc, false);
  assert.ok(files.length >= 3, files.length + ' segment(s)');
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(f));
    assert.equal(raw.segment.selfContained, true);
    assert.equal(X.misfiledHead(raw), false);
    const full = X.expand(raw);
    assert.equal(full.segmentRepair, undefined);
    for (const c of full.clouds) assert.equal(railOf(c), Number(c.chunkId.slice(1)), c.chunkId);
  }
});

test('avant 4.7.20 : le nuage de tête d’un segment est reconnu et relu avec le dictionnaire précédent', () => {
  const doc = session(240), files = exporter(doc, true);
  assert.ok(files.length >= 3);
  const raws = files.map(f => JSON.parse(fs.readFileSync(f)));
  assert.deepEqual(raws.map(r => X.misfiledHead(r)), raws.map((_, i) => i > 0));
  // Lu seul avec son propre dictionnaire, le nuage de tête est faux ou illisible : c'est le défaut.
  const head = raws[1].clouds[0];
  let wrong = false;
  try { const c = X.expandCloud(head, raws[1].dictionaries); wrong = railOf(c) !== Number(c.chunkId.slice(1)); } catch { wrong = true; }
  assert.ok(wrong, 'le fixture doit reproduire le défaut');
  // Lu seul par expand() : le nuage douteux est retiré, jamais lu faux.
  const alone = X.expand(raws[1]);
  assert.equal(alone.segmentRepair.action, 'dropped');
  assert.equal(alone.clouds.length, raws[1].clouds.length - 1);
  for (const c of alone.clouds) assert.equal(railOf(c), Number(c.chunkId.slice(1)));
  // Avec le segment précédent : relu juste.
  const fixed = X.expand(raws[1], { previousDictionaries: raws[0].dictionaries });
  assert.equal(fixed.segmentRepair.action, 'reread');
  assert.equal(fixed.clouds.length, raws[1].clouds.length);
  for (const c of fixed.clouds) assert.equal(railOf(c), Number(c.chunkId.slice(1)));
});

test('la fusion des segments répare un export d’avant 4.7.20 sans perdre de nuage', () => {
  const doc = session(240), files = exporter(doc, true);
  const { merged } = mergeFiles(files);
  assert.equal(merged.clouds.length, 240);
  assert.equal(merged.mergeTrace.ki060Repairs, files.length - 1);
  for (const c of merged.clouds) assert.equal(railOf(c), Number(c.chunkId.slice(1)), c.chunkId);
});
