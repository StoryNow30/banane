const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const X = require('../src/native-export.js');
const S = require('../src/settings.js');

/* Jeu d'essai extrait d'une session Natif RÉELLE (15/09/2026), réduit en
 * volume mais fidèle en structure : nuages incrémentaux, métadonnées complètes,
 * repères répétés, résumés de capture mêlés aux chunks de points.
 *
 * Pourquoi ce fichier existe : les cinq défauts d'export livrés les 14 et 15
 * septembre ont tous été trouvés par les données de terrain, jamais par les
 * tests synthétiques. Ceux-ci ne reproduisaient pas la forme réelle — en
 * particulier le fait qu'un segment porte des nuages incrémentaux MAIS un
 * instantané complet des métadonnées. Les tests ci-dessous travaillent sur la
 * vraie forme. */
const REEL = path.resolve(__dirname, 'fixtures', 'terrain-reel.json');
const SIMULATE = path.resolve(__dirname, '..', 'tools', 'export-simulate.cjs');
const MERGE = path.resolve(__dirname, '..', 'tools', 'merge-segments.cjs');
const charger = () => JSON.parse(fs.readFileSync(REEL, 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'banane-reel-'));

test('le jeu d’essai porte bien la structure réelle', () => {
  const d = charger();
  assert.equal(d.format, 'banane-native-session-v2');
  assert.ok(d.records.length >= 2, 'plusieurs visites');
  assert.ok(d.clouds.length >= 8, 'plusieurs nuages');
  assert.ok(d.events.length >= 10, 'des événements');
  // Les deux natures d'objets coexistent dans `clouds` : c'est cette forme qui
  // avait piégé la première analyse de composition.
  const chunks = d.clouds.filter(c => c.format === 'banane-native-lidar-chunk-v1');
  const resumes = d.clouds.filter(c => c.format === 'banane-native-lidar-capture-v2');
  assert.ok(chunks.length > 0 && resumes.length > 0, 'chunks ET résumés de capture');
  // Des repères répétés : c'est ce que le compactage doit interner.
  const rails = new Set(chunks.filter(c => c.rail).map(c => JSON.stringify(c.rail)));
  assert.ok(rails.size < chunks.length, 'des repères sont répétés entre chunks');
});

test('compactage puis réhydratation : ce que le moteur lit est intact', () => {
  const original = charger();
  const back = X.expand(X.compact(original, {}));
  assert.equal(back.clouds.length, original.clouds.length);
  assert.deepEqual(back.records, original.records, 'records identiques');
  assert.deepEqual(back.events, original.events, 'événements identiques');
  for (let i = 0; i < original.clouds.length; i++) {
    const a = original.clouds[i], b = back.clouds[i];
    assert.deepEqual(b.pointsSceneRelative, a.pointsSceneRelative);
    assert.deepEqual(b.visibleByClipBoxes, a.visibleByClipBoxes);
    assert.deepEqual(b.rail, a.rail);
    assert.deepEqual(b.qualification, a.qualification);
    assert.deepEqual(b.identity, a.identity);
    assert.deepEqual(b.railObservations, a.railObservations, 'résumés de capture intacts');
  }
});

test('le compactage gagne réellement sur la structure réelle', () => {
  const original = charger();
  const avant = Buffer.byteLength(JSON.stringify(original));
  const apres = Buffer.byteLength(JSON.stringify(X.compact(original, {})));
  assert.ok(apres < avant * 0.85, 'gain insuffisant : ' + apres + ' contre ' + avant);
});

/* L'INVARIANT central : quel que soit le découpage, refusionner rend la session
 * entière. C'est le contrôle qui aurait attrapé la fusion perdant 23 visites et
 * 845 événements en silence. */
function decouperPuisFusionner(budget) {
  const dir = tmp(), out = path.join(dir, 'segs'), fusion = path.join(dir, 'fusion.json');
  let r = spawnSync(process.execPath, [SIMULATE, '--input', REEL, '--out-dir', out, '--segment-bytes', String(budget)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const segs = fs.readdirSync(out).map(f => path.join(out, f));
  r = spawnSync(process.execPath, [MERGE, '--out', fusion, ...segs], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return { segments: segs.length, fusion: JSON.parse(fs.readFileSync(fusion, 'utf8')) };
}

for (const budget of [40 * S.Mo, 900 * 1024, 400 * 1024]) {
  test('découper à ' + Math.round(budget / 1024) + ' Ko puis fusionner rend la session entière', () => {
    const original = charger();
    const { segments, fusion } = decouperPuisFusionner(budget);
    assert.equal(fusion.clouds.length, original.clouds.length, 'tous les nuages, ' + segments + ' segment(s)');
    assert.equal(fusion.records.length, original.records.length, 'toutes les visites');
    assert.equal(fusion.events.length, original.events.length, 'tous les événements');
    assert.equal(fusion.mergeTrace.allDeclaredPresent, true);
    assert.equal(fusion.mergeTrace.missingCloudIds, 0);
    // Les points eux-mêmes, pas seulement les compteurs.
    const parId = new Map(fusion.clouds.map(c => [c.chunkId || c.captureId, c]));
    for (const c of original.clouds) {
      const b = parId.get(c.chunkId || c.captureId);
      assert.ok(b, 'objet absent après fusion : ' + (c.chunkId || c.captureId));
      assert.deepEqual(b.pointsSceneRelative, c.pointsSceneRelative);
      assert.deepEqual(b.visibleByClipBoxes, c.visibleByClipBoxes);
    }
  });
}

test('un budget serré découpe réellement, et la fusion reste exacte', () => {
  const original = charger();
  const { segments, fusion } = decouperPuisFusionner(400 * 1024);
  assert.ok(segments >= 2, 'le budget serré doit découper, ' + segments + ' segment(s)');
  assert.equal(fusion.clouds.length, original.clouds.length);
  assert.equal(fusion.records.length, original.records.length);
});

test('le plancher d’objets prime sur le budget', () => {
  // Avec moins d'objets que le plancher, on ne découpe pas, même à budget nul :
  // isoler une poignée d'objets coûterait plus cher en métadonnées répétées.
  const d = charger();
  const petit = { ...d, clouds: d.clouds.slice(0, 10), cloudIds: d.cloudIds.slice(0, 10) };
  const dir = tmp(), input = path.join(dir, 'petit.json'), out = path.join(dir, 'segs');
  fs.writeFileSync(input, JSON.stringify(petit));
  const r = spawnSync(process.execPath, [SIMULATE, '--input', input, '--out-dir', out, '--segment-bytes', '1024'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readdirSync(out).length, 1, '10 objets sous un plancher de ' + S.export.minObjectsPerSegment + ' restent groupés');
});

test('chaque segment reste autonome : lisible seul, sans dictionnaire manquant', () => {
  const dir = tmp(), out = path.join(dir, 'segs');
  const r = spawnSync(process.execPath, [SIMULATE, '--input', REEL, '--out-dir', out, '--segment-bytes', String(400 * 1024)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  for (const f of fs.readdirSync(out)) {
    const seg = JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
    assert.equal(seg.format, X.FORMAT);
    assert.ok(seg.dictionaries, f + ' sans dictionnaire');
    // Doit se réhydrater seul, sans lever sur une référence introuvable.
    const plein = X.expand(seg);
    assert.ok(plein.records.length > 0, f + ' sans métadonnées');
    for (const c of plein.clouds) {
      assert.ok(!c.rail || typeof c.rail === 'object', f + ' référence non résolue');
      assert.ok(!JSON.stringify(c).includes(X.REF), f + ' référence résiduelle');
    }
  }
});
