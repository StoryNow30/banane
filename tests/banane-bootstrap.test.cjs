'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const B = require('../tools/banane-bootstrap.cjs');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures/bootstrap');

async function tmp() {
  return await fsp.mkdtemp(path.join(os.tmpdir(), 'banane-bootstrap-test-'));
}
function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('lock native-v46 fixe les deux assets de release exacts', () => {
  const L = B.loadLock(path.join(ROOT, 'data/native-v46.lock.json'));
  assert.equal(L.source.repository, 'StoryNow30/banane-data');
  assert.equal(L.source.releaseTag, 'native-v4.6-2026-09-16');
  assert.deepEqual(L.assets.map(a => [a.key, a.assetId, a.bytes, a.sha256]), [
    ['historical', 567662835, 34509008, '32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0'],
    ['final', 568307664, 56657500, '7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66'],
  ]);
});

test('fixtures rapides sont versionnées et hashables sans corpus LiDAR', async () => {
  const h = path.join(FIX, 'assets/historical.bin');
  const f = path.join(FIX, 'assets/final.bin');
  assert.equal(sha(h), '157e8d1e1e1f417bcde0daffd19bf373f4bdb92dc495c5c971d77154000e3c1b');
  assert.equal(sha(f), 'b8e98eac4b195d8e6a8090368944fb7a3bdc387f2077f4fa3faf8a963e71b189');
  const vh = await B.verifyAssetFile(h, { bytes: 39, sha256: sha(h) });
  const vf = await B.verifyAssetFile(f, { bytes: 34, sha256: sha(f) });
  assert.equal(vh.ok, true);
  assert.equal(vf.ok, true);
});

test('taille incorrecte bloque avant même un SHA accepté', async () => {
  const dir = await tmp();
  const p = path.join(dir, 'asset.bin');
  await fsp.writeFile(p, 'abc');
  const v = await B.verifyAssetFile(p, { bytes: 4, sha256: crypto.createHash('sha256').update('abc').digest('hex') });
  assert.equal(v.ok, false);
  assert.equal(v.code, 'SIZE_MISMATCH');
});

test('SHA incorrect est fail-closed', async () => {
  const dir = await tmp();
  const p = path.join(dir, 'asset.bin');
  await fsp.writeFile(p, 'abc');
  const v = await B.verifyAssetFile(p, { bytes: 3, sha256: '0'.repeat(64) });
  assert.equal(v.ok, false);
  assert.equal(v.code, 'SHA256_MISMATCH');
});

test('ordre de résolution : variable asset, répertoire env, fallbacks, cache canonique', () => {
  const L = B.loadLock(path.join(ROOT, 'data/native-v46.lock.json'));
  const a = L.assets[0];
  const env = {
    BANANE_NATIVE_HISTORICAL: '/mnt/one/archive.7z',
    BANANE_NATIVE_DIR: '/mnt/two',
  };
  const c = B.archiveCandidates(L, a, env, '/work/repo');
  assert.equal(c[0], path.normalize('/mnt/one/archive.7z'));
  assert.equal(c[1], path.normalize(`/mnt/two/${a.name}`));
  assert.ok(c.some(x => x === path.normalize(`/work/repo/.banane-data/native-v46/downloads/${a.name}`)));
  assert.ok(c.some(x => x === path.normalize(`/tmp/native-v46/${a.name}`)));
});

test('scan JSON récursif ignore les autres fichiers', async () => {
  const dir = await tmp();
  await fsp.mkdir(path.join(dir, 'a/b'), { recursive: true });
  await fsp.writeFile(path.join(dir, 'a/x.json'), '{}');
  await fsp.writeFile(path.join(dir, 'a/b/y.JSON'), '{}');
  await fsp.writeFile(path.join(dir, 'a/b/no.txt'), '{}');
  const files = await B.scanJsonFiles(dir);
  assert.equal(files.length, 2);
});

test('marker d’extraction lie dataset, asset, lock et nombre de JSON', async () => {
  const L = B.loadLock(path.join(ROOT, 'data/native-v46.lock.json'));
  const a = L.assets[0];
  const dir = await tmp();
  await fsp.copyFile(path.join(FIX, 'extracted/historical/fixture-export.json'), path.join(dir, 'fixture-export.json'));
  const marker = {
    format: 'banane-bootstrap-extraction-v1',
    dataset: L.dataset,
    assetKey: a.key,
    assetName: a.name,
    assetSha256: a.sha256,
    assetBytes: a.bytes,
    lockSha256: B.lockFingerprint(L),
    jsonFiles: 1,
    sourceVerified: true,
  };
  await fsp.writeFile(path.join(dir, L.extraction.provenanceMarker), JSON.stringify(marker));
  const ok = await B.readExtractionMarker(dir, L, a);
  assert.equal(ok.ok, true);
  await fsp.writeFile(path.join(dir, 'extra.json'), '{}');
  const bad = await B.readExtractionMarker(dir, L, a);
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'JSON_COUNT_MISMATCH');
});

test('repositoryStatus détecte fichier critique manquant et hash altéré', async () => {
  const dir = await tmp();
  await fsp.mkdir(path.join(dir, 'critical'), { recursive: true });
  await fsp.writeFile(path.join(dir, 'critical/a.txt'), 'A');
  const lock = {
    compatibleCode: {
      requiredRepositoryFiles: ['critical/a.txt', 'required.txt'],
      criticalFiles: { 'critical/a.txt': crypto.createHash('sha256').update('B').digest('hex') },
    },
  };
  const s = B.repositoryStatus(lock, dir);
  assert.equal(s.ok, false);
  assert.ok(s.missing.includes('required.txt'));
  assert.equal(s.mismatched.length, 1);
});

test('doctor ne transforme jamais archives absentes en READY', async () => {
  const dir = await tmp();
  const payload = 'CODE';
  await fsp.writeFile(path.join(dir, 'code.txt'), payload);
  const lock = {
    format: 'banane-research-data-lock-v1',
    dataset: 'native-v46',
    canonicalRoot: '.banane-data/native-v46',
    source: { repository: 'StoryNow30/banane-data', releaseTag: 'x' },
    compatibleCode: {
      referenceCommit: 'x',
      requiredRepositoryFiles: ['code.txt'],
      criticalFiles: { 'code.txt': crypto.createHash('sha256').update(payload).digest('hex') },
    },
    assets: [
      { key: 'historical', name: 'h.7z', assetId: 1, bytes: 1, sha256: '1'.repeat(64), extractDir: 'historical' },
      { key: 'final', name: 'f.7z', assetId: 2, bytes: 1, sha256: '2'.repeat(64), extractDir: 'final' },
    ],
    lookup: { directoryEnvironment: [], perAssetEnvironment: {}, fallbackDirectories: [] },
    extraction: { programs: [], jsonRequired: true, provenanceMarker: '.banane-bootstrap.json' },
  };
  const s = await B.doctor(lock, {}, dir);
  assert.equal(s.code.ok, true);
  assert.equal(s.ready, false);
  assert.equal(s.assets.every(a => a.archive.ok === false), true);
});

test('aucun token shell n’est inventé', () => {
  assert.equal(B.tokenFromEnvironment({}), null);
  assert.equal(B.tokenFromEnvironment({ GH_TOKEN: 'x' }), 'x');
  assert.equal(B.tokenFromEnvironment({ GITHUB_TOKEN: 'y' }), 'y');
});
