const { test } = require('node:test'), assert = require('node:assert/strict');
const X = require('../src/native-export.js');
const K = require('../src/core.js');
const { base } = require('./fixtures.cjs');

/* Jeu minimal reproduisant la redondance réelle : un même repère de rail
 * recopié dans plusieurs chunks, et pointsProfileLocal dérivable. */
function chunk(id, side, n = 12) {
  const rail = K.clone(base.rails[side]);
  const local = Array.from({ length: n }, (_, i) => [-0.4 + 0.8 * i / (n - 1), 0.03, 0.02]);
  const scene = local.map(p => K.C.point(rail.profileLocalToSceneRelative, p));
  return {
    format: 'banane-native-lidar-chunk-v1', version: K.VERSION, chunkId: id, captureId: 'c1', visitId: 'v1', side,
    identity: { pageId: 'p', part: 23, cut: 100, shape: 'U50', frameId: 'f', projectId: null },
    capturedAt: '2026-01-01T00:00:00.000Z',
    viewObservation: { status: 'observed', viewEpochId: 'view-1', camera: { type: 'OrthographicCamera' } },
    rail, coordinateSystem: { name: 'scene-relative', matrixLayout: 'column-major; column vectors', units: 'u', frameId: 'f' },
    qualification: { status: 'qualified-candidate', chunkIds: [id], exclusionReasons: [] },
    pointsSceneRelative: scene,
    pointsProfileLocal: local.map(p => K.C.point(rail.sceneRelativeToProfileLocal, K.C.point(rail.profileLocalToSceneRelative, p))),
    pointSources: local.map((_, i) => [0, i]),
    visibleByClipBoxes: local.map((_, i) => i % 3 !== 0),
  };
}
const doc = () => ({
  format: 'banane-native-session-v2', version: K.VERSION, exportedAt: '2026-01-01T00:00:00.000Z',
  session: { id: 's1', status: 'FINISHED', cloudIds: ['a:left:0', 'a:right:0', 'b:left:0'] },
  records: [{ recordId: 'r1', visitId: 'v1', identity: { pageId: 'p', part: 23, cut: 100, shape: 'U50', frameId: 'f', projectId: null }, railSnapshots: { left: [{ snapshotId: 'a:left:0', rail: K.clone(base.rails.left) }], right: [] } }],
  events: [{ type: 'native-visit-started', eventSeq: 1, visitId: 'v1' }],
  closureSummary: { visits: 1 },
  cloudIds: ['a:left:0', 'a:right:0', 'b:left:0'],
  clouds: [chunk('a:left:0', 'left'), chunk('a:right:0', 'right'), chunk('b:left:0', 'left')],
});

test('compact interne les structures répétées au lieu de les recopier', () => {
  const packed = X.compact(doc(), {});
  assert.equal(packed.format, X.FORMAT);
  // Deux chunks gauche partagent exactement le même repère : un seul exemplaire stocké.
  assert.ok(packed.dictionaries.rails.length < 4, 'les repères doivent être dédupliqués');
  assert.equal(packed.dictionaries.coords.length, 1);
  // Les chunks portent des références, plus les objets complets.
  assert.ok(packed.clouds[0].rail[X.REF], 'rail doit être une référence');
  assert.ok(packed.clouds[0].coordinateSystem[X.REF]);
});

test('compact retire les champs dérivables et les déclare', () => {
  const packed = X.compact(doc(), {});
  const c = packed.clouds[0];
  assert.equal(c.pointsProfileLocal, undefined);
  assert.equal(c.pointSources, undefined);
  assert.deepEqual(c.droppedDerivedFields, ['pointsProfileLocal', 'pointSources']);
  assert.deepEqual(packed.compaction.droppedDerivedFields, ['pointsProfileLocal', 'pointSources']);
});

test('expand restaure tout ce que le moteur consomme, au bit près', () => {
  const original = doc();
  const back = X.expand(X.compact(original, {}));
  assert.equal(back.format, 'banane-native-session-v2');
  assert.deepEqual(back.session, original.session);
  assert.deepEqual(back.events, original.events);
  assert.deepEqual(back.records, original.records);
  assert.equal(back.clouds.length, original.clouds.length);
  for (let i = 0; i < original.clouds.length; i++) {
    const a = original.clouds[i], b = back.clouds[i];
    // buildEngineInput ne lit que ces deux tableaux, plus rail/coordinateSystem/qualification.
    assert.deepEqual(b.pointsSceneRelative, a.pointsSceneRelative, 'points scène identiques');
    assert.deepEqual(b.visibleByClipBoxes, a.visibleByClipBoxes, 'drapeaux de clipping identiques');
    assert.deepEqual(b.rail, a.rail, 'repère identique');
    assert.deepEqual(b.coordinateSystem, a.coordinateSystem);
    assert.deepEqual(b.qualification, a.qualification);
    assert.deepEqual(b.identity, a.identity);
  }
});

test('le champ dérivé recalculé reste sous la tolérance documentée', () => {
  const original = doc();
  const back = X.expand(X.compact(original, {}));
  let max = 0;
  for (let i = 0; i < original.clouds.length; i++) {
    const a = original.clouds[i].pointsProfileLocal, b = back.clouds[i].pointsProfileLocal;
    assert.equal(b.length, a.length);
    for (let j = 0; j < a.length; j++) for (let k = 0; k < 3; k++) max = Math.max(max, Math.abs(a[j][k] - b[j][k]));
  }
  assert.ok(max < 1e-7, 'écart ' + max + ' au-dessus de la tolérance');
});

test('compactage en flux : un interner partagé donne le même résultat', () => {
  const original = doc();
  const interner = X.createInterner();
  const packed = original.clouds.map(c => X.compactCloud(c, interner, {}));
  const back = packed.map(c => X.expandCloud(c, interner.dictionaries));
  for (let i = 0; i < original.clouds.length; i++) {
    assert.deepEqual(back[i].pointsSceneRelative, original.clouds[i].pointsSceneRelative);
    assert.deepEqual(back[i].rail, original.clouds[i].rail);
  }
});

test('une référence inconnue échoue franchement au lieu de produire un trou', () => {
  assert.throws(() => X.unfoldRefs({ x: { [X.REF]: 'rails:999' } }, { rails: [] }), /Référence de dictionnaire introuvable/);
});

test('les tableaux de points ne sont jamais internés par erreur', () => {
  const interner = X.createInterner();
  const pts = [[1, 2, 3], [4, 5, 6]];
  assert.deepEqual(X.foldRefs(pts, interner), pts);
});

test('le compactage réduit réellement le volume sérialisé', () => {
  const original = doc();
  const a = Buffer.byteLength(JSON.stringify(original));
  const b = Buffer.byteLength(JSON.stringify(X.compact(original, {})));
  assert.ok(b < a, 'compact ' + b + ' doit être plus petit que source ' + a);
});

/* Régression du 15/09/2026 : le budget de segment ne comptait que les nuages.
 * Sur un export réel, 27,3 Mo de nuages donnaient un fichier de 40,7 Mo une
 * fois ajoutés 7,2 Mo de dictionnaires et 6,2 Mo de métadonnées. Puis une
 * première correction, en mesurant les métadonnées NON repliées, a produit
 * 802 segments d'un objet chacun. Le suivi doit porter sur le poids réel. */
test('l’interner mesure le poids de ses dictionnaires', () => {
  const interner = X.createInterner();
  const depart = interner.bytes;
  const c = chunk('a:left:0', 'left');
  X.compactCloud(c, interner, {});
  const apres = interner.bytes;
  assert.ok(apres > depart, 'le dictionnaire doit peser quelque chose');
  const reel = Buffer.byteLength(JSON.stringify(interner.dictionaries));
  // Tolérance large : c'est un suivi de budget, pas une mesure exacte.
  assert.ok(Math.abs(apres - reel) < reel * 0.5 + 64,
    'suivi ' + apres + ' vs réel ' + reel);
});

test('réinterner la même structure ne regonfle pas le budget', () => {
  const interner = X.createInterner();
  X.compactCloud(chunk('a:left:0', 'left'), interner, {});
  const apres1 = interner.bytes;
  X.compactCloud(chunk('a:left:1', 'left'), interner, {});   // même rail, même identité
  assert.equal(interner.bytes, apres1, 'aucune entrée nouvelle, aucun octet de plus');
});

test('le poids suivi croît avec les structures distinctes', () => {
  const interner = X.createInterner();
  X.compactCloud(chunk('a:left:0', 'left'), interner, {});
  const apresGauche = interner.bytes;
  X.compactCloud(chunk('a:right:0', 'right'), interner, {});  // rail différent
  assert.ok(interner.bytes > apresGauche);
});
