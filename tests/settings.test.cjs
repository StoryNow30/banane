const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/settings.js');
const { Observer } = require('../src/native-page.js');
const { Sessions } = require('../src/native-session.js');
const K = require('../src/core.js');

/* Limite de téléchargement constatée sur le terrain : au-delà d'environ 64 Mo,
 * la préparation du fichier échouait et la session entière devenait
 * intéléchargeable. Tous les seuils d'export doivent rester dessous. */
const MUR = 64 * S.Mo;

test('les seuils de file sont ordonnés et laissent de la marge', () => {
  assert.ok(S.derived.lowWater < S.derived.highWater, 'lowWater doit être sous highWater');
  assert.ok(S.derived.highWater < S.collector.maxQueue, 'highWater doit être sous la capacité');
  // L'écart évite le battement entre dégradation et rétablissement.
  assert.ok(S.derived.highWater - S.derived.lowWater >= 8, 'hystérésis trop faible');
  // 128 était atteint sur les deux sessions dégradées du corpus historique.
  assert.ok(S.collector.maxQueue > 128, 'la file doit dépasser la profondeur qui saturait');
});

test('un échec isolé ne peut pas couper le LiDAR', () => {
  assert.ok(S.collector.failuresBeforeMetadataOnly >= 2,
    'il faut plus d’un échec consécutif avant METADATA_ONLY');
  assert.ok(S.collector.recoveryMs > 0, 'le rétablissement doit être possible');
  assert.ok(S.collector.maxItemAttempts >= 2 && S.collector.maxItemAttempts <= 10);
  assert.ok(S.collector.retryBackoffMaxMs > S.collector.retryBackoffMs, 'la temporisation doit croître');
});

test('les seuils d’export restent sous la limite de téléchargement', () => {
  assert.ok(S.export.watermarkBytes < MUR, 'le vidage doit se déclencher avant la limite');
  assert.ok(S.export.segmentBytes < MUR, 'un segment doit rester sous la limite');
  assert.ok(S.export.segmentReserveBytes > 0 && S.export.segmentReserveBytes < S.export.segmentBytes);
  // Marge d'au moins 25 % sous le mur, pour absorber un dépassement.
  assert.ok(S.export.segmentBytes <= MUR * 0.75, 'marge insuffisante sous la limite');
});

test('le plancher d’objets par segment empêche l’émiettement', () => {
  // Une correction du budget mesurant les métadonnées non repliées avait
  // produit 802 segments d'un seul objet.
  assert.ok(S.export.minObjectsPerSegment >= 16, 'plancher trop bas');
  assert.ok(S.export.bytesPerPointEstimate > 0);
  assert.ok(S.export.bytesPerCloudOverhead > 0);
});

test('le collecteur applique bien les réglages centralisés', () => {
  const o = new Observer({}, {});
  assert.equal(o.maxQueue, S.collector.maxQueue);
  assert.equal(o.highWater, S.derived.highWater);
  assert.equal(o.lowWater, S.derived.lowWater);
  assert.equal(o.recoveryMs, S.collector.recoveryMs);
  assert.equal(o.maxItemAttempts, S.collector.maxItemAttempts);
  assert.equal(o.failuresBeforeMetadataOnly, S.collector.failuresBeforeMetadataOnly);
  assert.equal(o.maxCapturesPerVisit, S.collector.maxCapturesPerVisit);
  assert.equal(o.pollMs, S.collector.pollMs);
});

test('une surcharge explicite reste prioritaire, pour les tests et les essais', () => {
  const o = new Observer({}, { maxQueue: 64, recoveryMs: 10 });
  assert.equal(o.maxQueue, 64);
  assert.equal(o.recoveryMs, 10);
  // Les seuils dérivés suivent la capacité surchargée, pas la valeur par défaut.
  assert.ok(o.highWater < 64 && o.lowWater < o.highWater, 'seuils recalculés sur la file surchargée');
});

test('la session lit les mêmes réglages d’export', () => {
  assert.equal(Sessions.EXPORT_WATERMARK_BYTES, S.export.watermarkBytes);
  assert.equal(Sessions.BYTES_PER_POINT_ESTIMATE, S.export.bytesPerPointEstimate);
  assert.equal(Sessions.BYTES_PER_CLOUD_OVERHEAD, S.export.bytesPerCloudOverhead);
});

test('les réglages sont lisibles par l’interface', () => {
  const lignes = S.describe();
  assert.ok(lignes.length >= 8, 'trop peu de réglages exposés');
  for (const l of lignes) {
    for (const champ of ['groupe', 'nom', 'valeur', 'pourquoi']) {
      assert.equal(typeof l[champ], 'string', champ + ' manquant');
      assert.ok(l[champ].length > 0, champ + ' vide sur « ' + l.nom + ' »');
    }
  }
  const groupes = new Set(lignes.map(l => l.groupe));
  for (const g of ['Collecte', 'Export', 'Lecteur']) assert.ok(groupes.has(g), 'groupe absent : ' + g);
});

test('les réglages sont gelés : personne ne les modifie à chaud', () => {
  // Hors mode strict, une écriture sur un objet gelé échoue en silence plutôt
  // que de lever : on vérifie donc que la valeur n'a pas bougé.
  const file = S.collector.maxQueue, seuil = S.export.watermarkBytes;
  S.collector.maxQueue = 1;
  S.export.watermarkBytes = 1;
  assert.equal(S.collector.maxQueue, file, 'la profondeur de file doit rester figée');
  assert.equal(S.export.watermarkBytes, seuil, 'le seuil de vidage doit rester figé');
  assert.ok(Object.isFrozen(S.collector) && Object.isFrozen(S.export) && Object.isFrozen(S.reader));
});

test('la version officielle est cohérente entre le code et le manifeste', () => {
  const manifest = require('../manifest.json');
  assert.equal(manifest.version, K.VERSION, 'manifeste et core.js doivent annoncer la même version');
  assert.match(K.VERSION, /^4\.5\.\d+$/, 'version officielle attendue en 4.5.x');
});

test('les seuils du moteur ne sont pas dans les réglages de collecte', () => {
  // Le moteur est gelé : ses seuils vivent dans src/geometry.js et n'ont rien
  // à faire ici, sous peine de laisser croire qu'on peut les ajuster.
  const plat = JSON.stringify(S.collector) + JSON.stringify(S.export);
  for (const interdit of ['searchY', 'searchZ', 'minTop', 'minFace', 'maxResidual', 'minConfidence'])
    assert.ok(!plat.includes(interdit), 'seuil moteur exposé à tort : ' + interdit);
});
