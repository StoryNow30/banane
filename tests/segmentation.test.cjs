const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const S = require('../src/settings.js');

const TOOL = path.resolve(__dirname, '..', 'tools', 'export-simulate.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'banane-seg-'));

/* Session synthétique : des nuages de taille régulière, des métadonnées
 * réalistes mais petites, pour piloter le découpage par le budget. */
function session(nClouds, pointsParNuage = 40) {
  const rail = {
    railLocalToSceneRelative: Array.from({ length: 16 }, (_, i) => i / 3),
    profileLocalToSceneRelative: Array.from({ length: 16 }, (_, i) => i / 7),
    sceneRelativeToProfileLocal: Array.from({ length: 16 }, (_, i) => i / 11),
  };
  const clouds = Array.from({ length: nClouds }, (_, i) => ({
    format: 'banane-native-lidar-chunk-v1', chunkId: 'c' + i, side: i % 2 ? 'right' : 'left',
    identity: { pageId: 'p', part: 20, cut: 100 + i, shape: 'U50', frameId: 'f', projectId: null },
    rail, coordinateSystem: { name: 'scene-relative', matrixLayout: 'column-major; column vectors', units: 'u', frameId: 'f' },
    pointsSceneRelative: Array.from({ length: pointsParNuage }, (_, j) => [363714.5 + j / 1000, 6869854.9 + j / 1000, 23.2 + j / 1000]),
    visibleByClipBoxes: Array.from({ length: pointsParNuage }, (_, j) => j % 2 === 0),
  }));
  return {
    format: 'banane-native-session-v2', version: '4.5.0',
    session: { id: 's1', status: 'FINISHED', cloudIds: clouds.map(c => c.chunkId) },
    records: [{ recordId: 'r1', visitId: 'v1', rail }],
    events: [{ eventId: 'e1', eventSeq: 1, type: 'native-visit-started' }],
    clouds,
  };
}
function segmenter(doc, budget) {
  const dir = tmp(), input = path.join(dir, 'session.json'), out = path.join(dir, 'segs');
  fs.writeFileSync(input, JSON.stringify(doc));
  const r = spawnSync(process.execPath, [TOOL, '--input', input, '--out-dir', out, '--segment-bytes', String(budget)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const fichiers = fs.readdirSync(out).sort();
  return fichiers.map(f => ({ nom: f, octets: fs.statSync(path.join(out, f)).size, objets: JSON.parse(fs.readFileSync(path.join(out, f))).clouds.length }));
}

const PLANCHER = S.export.minObjectsPerSegment;

test('une session qui tient dans le budget reste en un seul fichier', () => {
  const segs = segmenter(session(20), 50 * S.Mo);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].objets, 20);
});

/* Terrain du 15/09 : un segment de queue isolait 1,8 Mo de nuages utiles au
 * prix de 13,4 Mo de métadonnées et de dictionnaires répétés. Couper pour si
 * peu coûte plus cher que de dépasser légèrement le budget. */
test('une queue trop courte n’est pas isolée dans son propre segment', () => {
  // Budget calibré pour forcer une coupure très tôt : sans plancher de queue,
  // le découpage produirait plusieurs fichiers dont un minuscule.
  const doc = session(PLANCHER + 10);
  const brut = Buffer.byteLength(JSON.stringify(doc));
  const segs = segmenter(doc, Math.floor(brut / 2));
  assert.equal(segs.length, 1, 'la queue de ' + 10 + ' objets ne justifie pas un segment');
  assert.equal(segs[0].objets, PLANCHER + 10, 'tous les objets sont présents');
});

test('une queue substantielle obtient bien son segment', () => {
  const doc = session(PLANCHER * 3);
  const brut = Buffer.byteLength(JSON.stringify(doc));
  const segs = segmenter(doc, Math.floor(brut / 3));
  assert.ok(segs.length >= 2, 'le découpage doit avoir lieu, ' + segs.length + ' segment(s)');
  for (const s of segs) assert.ok(s.objets >= PLANCHER || s === segs.at(-1), 'aucun segment minuscule avant la fin');
  assert.equal(segs.reduce((n, s) => n + s.objets, 0), PLANCHER * 3, 'aucun objet perdu au découpage');
});

test('aucun segment ne dégénère en une poignée d’objets', () => {
  // Une première correction du budget avait produit 802 segments d'un objet.
  const doc = session(300, 20);
  const brut = Buffer.byteLength(JSON.stringify(doc));
  const segs = segmenter(doc, Math.floor(brut / 6));
  assert.ok(segs.length <= 10, 'découpage trop fin : ' + segs.length + ' segments');
  for (const s of segs) assert.ok(s.objets > 1, 'segment d’un seul objet : ' + s.nom);
  assert.equal(segs.reduce((n, s) => n + s.objets, 0), 300);
});

test('le budget porte sur le fichier écrit, pas seulement sur les nuages', () => {
  // Le budget ignorait métadonnées et dictionnaires : 27,3 Mo de nuages
  // donnaient un fichier de 40,7 Mo. Le dépassement doit rester contenu.
  const doc = session(200, 30);
  const budget = 400 * 1024;
  const segs = segmenter(doc, budget);
  const tolerance = budget + S.export.segmentReserveBytes;
  for (const s of segs) assert.ok(s.octets <= tolerance * 2,
    s.nom + ' : ' + s.octets + ' octets pour un budget de ' + budget);
});
