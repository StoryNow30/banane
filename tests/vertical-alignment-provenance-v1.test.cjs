'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const lab = require('../tools/vertical-alignment-provenance-v1.cjs');

const ROOT = path.resolve(__dirname, '..');
const DATA = process.env.BANANE_DATA_NATIVE_V46
  || '/tmp/banane-work/banane-data-frozen/datasets/native-v4.6-2026-09-16';
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const ALLOWED_STAGES = new Set(Object.values(lab.STAGES));

function walkKeys(v, fn, p = '') {
  if (Array.isArray(v)) { for (const x of v) walkKeys(x, fn, p + '[]'); return; }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      fn(k, p ? `${p}.${k}` : k);
      walkKeys(x, fn, p ? `${p}.${k}` : k);
    }
  }
}

function writeJson(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v));
}

function makeMaterializedFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vap-fix-'));
  const cloudA = {
    format: 'banane-native-lidar-chunk-v1', chunkId: 'aa:left:0',
    captureId: 'aa', visitId: 'v1', side: 'left',
    capturedAt: '2026-09-16T10:00:00.000Z',
    pointsSceneRelative: [[1, 2, 3], [4, 5, 6]],
    visibleByClipBoxes: [true, false]
  };
  const cloudB = {
    format: 'banane-native-lidar-chunk-v1', chunkId: 'bb:right:1',
    captureId: 'bb', visitId: 'v2', side: 'right',
    capturedAt: '2026-09-16T10:00:01.000Z',
    pointsSceneRelative: [[7, 8, 9]],
    visibleByClipBoxes: [true]
  };
  const cloudOver = {
    format: 'banane-native-lidar-chunk-v1', chunkId: 'cc:left:2',
    captureId: 'cc', visitId: 'v3', side: 'left',
    capturedAt: '2026-09-16T10:00:02.000Z',
    pointsSceneRelative: Array.from({ length: 4 }, (_, i) => [i, i, i]),
    visibleByClipBoxes: [true, true, true, true]
  };
  const cloudCopy = {
    format: 'banane-native-lidar-chunk-v1', chunkId: 'dd:left:0',
    captureId: 'dd', visitId: 'v4', side: 'left',
    pointsSceneRelative: [[0, 0, 1]],
    visibleByClipBoxes: [true]
  };

  writeJson(path.join(dir, 'historical/src-large/root-object-0000.json'), {
    session: { id: 's1' }, clouds: [cloudA]
  });
  writeJson(path.join(dir, 'historical/src-large/_index.json'), {
    format: 'banane-data-json-shard-index-v1',
    sourceName: 'src-large.json',
    semanticRepresentation: {
      kind: 'object-shards', keys: 2,
      shards: [{ path: 'historical/src-large/root-object-0000.json' }],
      largeEntries: {
        clouds: {
          kind: 'array-shards', length: 2,
          shards: [
            { path: 'historical/src-large/root-key-clouds/value-part-0000.json' },
            {
              oversizeItem: true, index: 1,
              node: { kind: 'single-json', file: { path: 'historical/src-large/root-key-clouds/item-0001/value.json' } }
            }
          ]
        }
      }
    }
  });
  writeJson(path.join(dir, 'historical/src-large/root-key-clouds/value-part-0000.json'), [cloudB]);
  writeJson(path.join(dir, 'historical/src-large/root-key-clouds/item-0001/value.json'), cloudOver);

  writeJson(path.join(dir, 'final/src-embed/root-object-0000.json'), { session: { id: 's2' } });
  writeJson(path.join(dir, 'final/src-embed/root-object-0001.json'), { clouds: [cloudA] });
  writeJson(path.join(dir, 'final/src-embed/_index.json'), {
    format: 'banane-data-json-shard-index-v1',
    sourceName: 'src-embed.json',
    semanticRepresentation: {
      kind: 'object-shards', keys: 2,
      shards: [
        { path: 'final/src-embed/root-object-0000.json' },
        { path: 'final/src-embed/root-object-0001.json' }
      ],
      largeEntries: {}
    }
  });

  writeJson(path.join(dir, 'final/exact.json'), {
    session: { id: 's3' }, clouds: [cloudCopy]
  });

  writeJson(path.join(dir, 'final/src-scalar/_index.json'), {
    format: 'banane-data-json-shard-index-v1',
    sourceName: 'src-scalar.json',
    semanticRepresentation: {
      kind: 'object-shards', keys: 1,
      shards: [],
      largeEntries: {
        clouds: {
          kind: 'scalar-text-parts',
          parts: [{ path: 'final/src-scalar/clouds-scalar-0000.txt' }]
        }
      }
    }
  });
  fs.mkdirSync(path.join(dir, 'final/src-scalar'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'final/src-scalar/clouds-scalar-0000.txt'), JSON.stringify([cloudB]));

  const manifest = {
    format: 'banane-data-materialized-dataset-v1',
    files: [
      {
        cohort: 'historical', sourceRelPath: 'src-large.json',
        representation: 'object-shards',
        index: { path: 'historical/src-large/_index.json' }
      },
      {
        cohort: 'final', sourceRelPath: 'src-embed.json',
        representation: 'object-shards',
        index: { path: 'final/src-embed/_index.json' }
      },
      {
        cohort: 'final', sourceRelPath: 'exact.json',
        representation: 'exact-json-copy',
        outputs: [{ path: 'final/exact.json' }]
      },
      {
        cohort: 'final', sourceRelPath: 'src-scalar.json',
        representation: 'object-shards',
        index: { path: 'final/src-scalar/_index.json' }
      }
    ]
  };
  writeJson(path.join(dir, 'manifest.json'), manifest);
  return dir;
}

test('capsule registry is exactly 239 rails, 63 failures, 176 controls', () => {
  const { rows } = lab.loadCapsuleRegistry(ROOT);
  assert.equal(rows.length, 239);
  assert.equal(rows.filter(r => r.key.cohort === 'failure').length, 63);
  assert.equal(rows.filter(r => r.key.cohort === 'control').length, 176);
});

test('frozen runtime hashes match exactly', () => {
  const h = lab.runtimeHashes(ROOT);
  assert.equal(h.allMatch, true);
  for (const [p, expected] of Object.entries(lab.EXPECTED_RUNTIME_HASHES)) {
    assert.equal(h.actual[p], expected, p);
  }
});

test('capsule registry has no human/manual correction payload leakage', () => {
  const { rows } = lab.loadCapsuleRegistry(ROOT);
  const banned = [];
  for (const r of rows) {
    walkKeys({ railInitialState: r.railInitialState, chunks: r.chunks, target: r.target, snapshot: r.snapshot }, (k, p) => {
      if (/^(human|manual|operator|corrected|correction|humanReference|manualReference)$/i.test(k)) banned.push(p);
    });
  }
  assert.deepEqual(banned, []);
});

test('findHumanKeys matches the capsule semantic list', () => {
  assert.deepEqual(lab.findHumanKeys({ humanFinalReference: 1, provenance: { archive: 'final' } }), ['.humanFinalReference']);
  assert.deepEqual(lab.findHumanKeys({ archive: 'final', finalObserved: true }), ['.finalObserved']);
});

test('independent projection is not a C.point wrapper', () => {
  const source = lab.projectPointIndependently.toString() + lab.analyzeRail.toString() + lab.applyAffine.toString();
  assert.match(source, /independentAffineInverse|applyAffine/);
  assert.doesNotMatch(lab.projectPointIndependently.toString(), /C\.point|capture-core|require\(/);
});

test('independent inverse recovers translation and rotation', () => {
  const ang = Math.PI / 7;
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1];
  const inv = lab.independentAffineInverse(P);
  assert.equal(inv.ok, true);
  const p = [1, 2, 3];
  const scene = lab.applyAffine(P, p);
  const back = lab.applyAffine(inv.matrix, scene);
  assert.ok(Math.hypot(...back.map((x, i) => x - p[i])) < 1e-12);
});

test('shear: axis-dot is not used as profile-local z; inverse still works', () => {
  const P = [1, 0.3, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const inv = lab.independentAffineInverse(P);
  assert.equal(inv.ok, true);
  const audit = lab.auditMatrix(
    { profileLocalToSceneRelative: P, sceneRelativeToProfileLocal: inv.matrix, profileContours: [] },
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    []
  );
  assert.equal(audit.linear.hasShear, true);
  assert.equal(audit.linear.orthogonal, false);
  const p = [2, 0, 0];
  const ip = lab.projectPointIndependently(p, audit);
  const provided = lab.applyAffine(inv.matrix, p);
  assert.ok(Math.abs(ip.independentLocalZ - provided[2]) < 1e-12);
  assert.equal(ip.axisDotMethodValid, false);
  assert.equal(ip.axisDotScaleAdjustedZ, null);
});

test('non-uniform scale: independent z is inverse, not a unit-axis dot', () => {
  const P = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 5, 1];
  const inv = lab.independentAffineInverse(P);
  const audit = lab.auditMatrix(
    { profileLocalToSceneRelative: P, sceneRelativeToProfileLocal: inv.matrix, profileContours: [] },
    [[0, 0, 9]],
    []
  );
  const ip = lab.projectPointIndependently([0, 0, 9], audit);
  assert.ok(Math.abs(ip.independentLocalZ - 1) < 1e-12);
  assert.equal(ip.axisDotMethodValid, true);
  assert.ok(Math.abs(ip.axisDotScaleAdjustedZ - 1) < 1e-12);
});

test('scanner recursively finds clouds in largeEntries, oversizeItem, root shards, exact-json-copy and scalar-text-parts', () => {
  const dir = makeMaterializedFixture();
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const entries = lab.listMaterializedEntries(dir, manifest);
  const needed = {
    historical: new Set(['aa:left:0', 'bb:right:1', 'cc:left:2']),
    final: new Set(['aa:left:0', 'dd:left:0', 'bb:right:1'])
  };
  const scanned = lab.scanNeededChunks(dir, entries, needed);
  assert.equal(scanned.found.historical.size, 3);
  assert.equal(scanned.found.final.size, 3);
  assert.ok(scanned.found.historical.get('cc:left:2').points.length === 4);
  assert.ok(scanned.consulted.some(f => f.includes('item-0001')));
  assert.ok(scanned.consulted.some(f => f.includes('exact.json')));
  assert.ok(scanned.consulted.some(f => f.includes('clouds-scalar')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('missing chunk is fail-closed', () => {
  const dir = makeMaterializedFixture();
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const entries = lab.listMaterializedEntries(dir, manifest);
  assert.throws(() => lab.scanNeededChunks(dir, entries, {
    historical: new Set(['does-not-exist']),
    final: new Set()
  }), /missing historical chunks/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('causal classification is never inferred from provenance stage', () => {
  const stage = lab.classifyFirstObservedStage(
    { usable: true },
    { passes: true, visible: { independentLocalZ: { count: 3 } } },
    [{ pointCount: 3, statistics: {} }],
    { directContradiction: false }
  );
  assert.equal(stage, lab.STAGES.SCENE_PROFILE_RELATION);
  assert.equal(ALLOWED_STAGES.has(stage), true);
});

test('written artifact, when present, has 239 rails and unknown causalSource', (t) => {
  const p = path.join(ROOT, 'audit/vertical-alignment-provenance-v1.json');
  if (!fs.existsSync(p)) { t.skip('artifact not written yet'); return; }
  const disk = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(disk.rails.length, 239);
  assert.equal(disk.integrity.payloadParityMatches, 239);
  assert.equal(disk.integrity.payloadParityMismatches, 0);
  assert.equal(disk.summary.cohorts.failure.rails, 63);
  assert.equal(disk.summary.cohorts.control.rails, 176);
  assert.equal(disk.runtime.allMatch, true);
  for (const r of disk.rails) {
    assert.equal(r.causalSource, 'unknown');
    assert.equal(ALLOWED_STAGES.has(r.firstObservedStage), true);
    assert.ok(r.matrixAudit.roundTrip || r.matrixAudit.usable === false);
    if (r.matrixAudit.usable) {
      assert.equal(r.matrixAudit.roundTrip.passesNumericEnvelope, true);
      assert.ok(Number.isFinite(r.matrixAudit.roundTrip.sceneToProfileLocalToScene.max));
    }
    assert.equal(r.perChunkStatistics.length, r.sourceProvenance.chunkCount);
    assert.ok(r.perChunkStatistics.length >= 1);
    for (const c of r.perChunkStatistics) {
      assert.ok(c.pointCount >= 1);
      assert.ok(c.statistics);
    }
    assert.match(r.projectionIndependentVsTransform.method, /not C\.point|no C\.point/i);

  }
  const payload = JSON.parse(JSON.stringify(disk));
  delete payload.generatedAt;
  delete payload.deterministicSha256;
  assert.equal(sha256(lab.canonicalize(payload)), disk.deterministicSha256);
  const banned = [];
  walkKeys(disk, (k, pth) => {
    if (/^(humanFinalReference|humanFinal|humanDeltaLocal|finalObserved|operatorIntent|operatorIntents|operatorEvents|usableForTraining)$/i.test(k)) {
      banned.push(pth);
    }
  });
  assert.deepEqual(banned, []);
});


const dataPresent = fs.existsSync(path.join(DATA, 'manifest.json'));

test('payload parity 239/239 from materialized data (integration)', { skip: !dataPresent }, () => {
  const hashes = lab.runtimeHashes(ROOT);
  assert.equal(hashes.allMatch, true);
  const { rows } = lab.loadCapsuleRegistry(ROOT);
  const dataManifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));
  const entries = lab.listMaterializedEntries(DATA, dataManifest);
  assert.ok(entries.length >= 50);
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [
    path.join(ROOT, 'tools/vertical-alignment-provenance-v1.cjs'),
    '--data', DATA, '--parity-only', '--root', ROOT
  ], { encoding: 'utf8', timeout: 180000 });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const out = JSON.parse(r.stdout);
  assert.equal(out.payloadParityMatches, 239);
  assert.equal(out.payloadParityMismatches, 0);
  assert.equal(rows.length, 239);
});

