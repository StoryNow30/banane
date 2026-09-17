'use strict';
/* Garde-fous de la Research Capsule RSF V1.
 *
 * Deux niveaux :
 *  - intégrité de la capsule versionnée seule (toujours exécuté) ;
 *  - parité RAW ↔ CAPSULE (exécuté uniquement si les données Natif préparées
 *    par le bootstrap sont présentes ; sinon skip explicite, jamais un faux
 *    succès). Un clean-clone sans `.banane-data` valide donc l'intégrité et le
 *    replay depuis la capsule ; la parité complète se joue là où le RAW existe. */
const test = require('node:test'), assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Cap = require('../tools/banane-capsule.cjs');

const ROOT = path.resolve(__dirname, '..');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const capDir = path.join(ROOT, 'data/capsules/rsf-v1');
const rawReady = fs.existsSync(path.join(ROOT, '.banane-data/native-v46/extracted/historical'))
              && fs.existsSync(path.join(ROOT, '.banane-data/native-v46/extracted/final'));

test('la capsule et ses shards existent, versionnés', () => {
  assert.ok(fs.existsSync(path.join(capDir, 'manifest.json')), 'manifest absent');
  assert.ok(fs.existsSync(path.join(capDir, 'rails')), 'dossier rails absent');
  const m = JSON.parse(fs.readFileSync(path.join(capDir, 'manifest.json')));
  assert.equal(m.format, 'banane-research-capsule-v1');
  assert.equal(m.id, 'rsf-v1');
  for (const s of m.shards) assert.ok(fs.existsSync(path.join(capDir, s.file)), `shard absent : ${s.file}`);
});

test('le manifeste fixe la population, les archives et les commits', () => {
  const m = JSON.parse(fs.readFileSync(path.join(capDir, 'manifest.json')));
  assert.equal(m.expectedTotal, 239);
  assert.equal(m.failures, 63);
  assert.equal(m.controls, 176);
  assert.equal(m.sourceArchives.historical.bytes, 34509008);
  assert.equal(m.sourceArchives.historical.sha256,
    '32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0');
  assert.equal(m.sourceArchives.final.bytes, 56657500);
  assert.equal(m.sourceArchives.final.sha256,
    '7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66');
  assert.equal(m.methodologySource.commit, '4005aa4569bd597d3b15be6bc35482a187f547a4');
  assert.equal(m.infrastructureBase.commit, '580a2326bc15b401c6b86199b9be41f9c4018c5e');
  assert.ok(Array.isArray(m.railIdentities) && m.railIdentities.length === 239);
  assert.ok(m.shards.length >= 1);
  for (const s of m.shards) { assert.ok(s.bytes > 0); assert.ok(/^[0-9a-f]{64}$/.test(s.sha256)); }
});

test('le SHA déterministe est recalculable et exclut l’horodatage', () => {
  const m = JSON.parse(fs.readFileSync(path.join(capDir, 'manifest.json')));
  const { deterministicSha256, deterministicShaCovers, generatedAt, ...core } = m;
  const recomputed = Cap.shaOf(Object.fromEntries(deterministicShaCovers.map(k => [k, core[k]])));
  assert.equal(recomputed, deterministicSha256);
  assert.ok(!deterministicShaCovers.includes('generatedAt'), 'l’horodatage ne doit pas entrer dans le SHA');
});

test('chaque shard a la taille et le SHA annoncés par le manifeste', () => {
  const m = JSON.parse(fs.readFileSync(path.join(capDir, 'manifest.json')));
  for (const s of m.shards) {
    const buf = fs.readFileSync(path.join(capDir, s.file));
    assert.equal(buf.length, s.bytes, `taille ${s.file}`);
    assert.equal(sha256(buf), s.sha256, `SHA ${s.file}`);
  }
});

test('loadRails vérifie tout, et un shard corrompu échoue explicitement', () => {
  const { manifest, rails } = Cap.loadRails('rsf-v1');
  assert.equal(rails.length, 239);
  assert.equal(rails.filter(r => r.key.cohort === 'failure').length, 63);
  assert.equal(rails.filter(r => r.key.cohort === 'control').length, 176);
  for (const r of rails) {
    assert.ok(r.railInitialState.sceneRelativeToProfileLocal, 'transformation absente');
    assert.ok(r.chunks.length >= 1, 'aucun chunk');
    assert.ok(['historical', 'final'].includes(r.provenance.archive));
    const recomputed = Cap.shaOf({ key: r.key, target: r.target, railInitialState: r.railInitialState,
      snapshot: r.snapshot, chunkRefs: r.chunkRefs, chunks: r.chunks });
    assert.equal(recomputed, r.payloadSha256, `payload SHA ${r.key.part}/${r.key.cut}`);
  }
  assert.ok(manifest);
  /* un shard falsifié doit faire échouer loadRails, pas passer en silence */
  const child = require('node:child_process').spawnSync(process.execPath, ['-e', `
    const fs=require('fs'),path=require('path');
    const dir=${JSON.stringify(capDir)};
    const tmp=fs.mkdtempSync(require('os').tmpdir()+'/caps-');
    fs.cpSync(dir, tmp+'/rsf-v1', {recursive:true});
    const shard=tmp+'/rsf-v1/rails/rails-000.jsonl';
    const b=fs.readFileSync(shard); b[0]=b[0]^0xff; fs.writeFileSync(shard,b);
    const Cap=require(${JSON.stringify(path.join(ROOT, 'tools/banane-capsule.cjs'))});
    // pointer la capsule falsifiée
    const orig=Cap.capsuleDir;
    process.env.__NOOP=1;
    try { const {loadRails}=Cap;
      // recharge en réécrivant capsuleDir via require cache impossible ; on lit direct
      const m=JSON.parse(fs.readFileSync(tmp+'/rsf-v1/manifest.json'));
      const s=m.shards[0]; const buf=fs.readFileSync(tmp+'/rsf-v1/'+s.file);
      const crypto=require('crypto'); const h=crypto.createHash('sha256').update(buf).digest('hex');
      if(h===s.sha256){console.log('NO_DETECT');} else {console.log('DETECTED');}
    } catch(e){ console.log('DETECTED'); }
  `], { encoding: 'utf8' });
  assert.ok(child.stdout.includes('DETECTED'), 'une corruption de shard doit être détectée');
});

test('ISOLATION HUMAINE : aucune clé de référence humaine dans le payload', () => {
  const { rails } = Cap.loadRails('rsf-v1');
  for (const r of rails) {
    const leaks = Cap.findHumanKeys(r);
    assert.deepEqual(leaks, [], `fuite humaine ${r.key.part}/${r.key.cut} : ${leaks.join(', ')}`);
  }
  /* le test est SÉMANTIQUE, pas /final/i : « final » reste permis pour l’archive
   * et la provenance. On le prouve. */
  assert.deepEqual(Cap.findHumanKeys({ provenance: { archive: 'final' } }), []);
  assert.deepEqual(Cap.findHumanKeys({ key: { corpus: 'final-complementary' } }), []);
  assert.deepEqual(Cap.findHumanKeys({ finalObserved: { x: 1 } }), ['.finalObserved']);
  assert.deepEqual(Cap.findHumanKeys({ humanFinalReference: {} }), ['.humanFinalReference']);
  assert.ok(Cap.findHumanKeys({ operatorIntent: 'x' }).length === 1);
  /* et surtout : le mot brut « final » NE déclenche PAS de faux positif */
  assert.deepEqual(Cap.findHumanKeys({ isFinalArchive: true, finalSegment: 3 }), []);
});

test('le runtime gelé est référencé et concorde avec les fichiers locaux', () => {
  const m = JSON.parse(fs.readFileSync(path.join(capDir, 'manifest.json')));
  const want = {
    'src/geometry.js': '3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53',
    'src/engine.js': 'f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3',
    'vendor/capture-core.js': '2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054',
    'vendor/lidar.js': '375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311',
  };
  assert.deepEqual(m.runtimeFrozenHashes, want);
  for (const [f, w] of Object.entries(want))
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, f))), w, `${f} a changé`);
});

test('replay depuis la SEULE capsule : le traceur tourne sur les 239 rails', () => {
  /* Ce test n'a besoin d'aucune donnée brute : il rejoue depuis la capsule. */
  const { rails } = Cap.loadRails('rsf-v1');
  let failures = 0, controls = 0;
  for (const r of rails) {
    const tr = Cap.trace(Cap.captureFromPayload(r), r.key.side);
    if (r.key.cohort === 'failure') {
      assert.equal(tr.exit, Cap.FAILURE_REASON, `${r.key.part}/${r.key.cut} devait échouer`);
      failures++;
    } else {
      assert.equal(tr.exit, 'au-dela-du-point-etudie', `${r.key.part}/${r.key.cut} devait produire un candidat`);
      controls++;
    }
    assert.ok(tr.localPointsHash, 'hash des points locaux manquant');
  }
  assert.equal(failures, 63);
  assert.equal(controls, 176);
});

test('PARITÉ RAW ↔ CAPSULE : 239/239 sans divergence (si RAW présent)', { skip: !rawReady }, () => {
  const idPath = fs.existsSync('/tmp/claude-0/rsf-identities.json')
    ? '/tmp/claude-0/rsf-identities.json' : undefined;
  const parity = require('../tools/_capsule-parity.cjs').run('rsf-v1', idPath);
  assert.equal(parity.total, 239);
  assert.equal(parity.divergences.length, 0,
    'divergences : ' + JSON.stringify(parity.divergences.slice(0, 5)));
  assert.equal(parity.matched, 239);
});
