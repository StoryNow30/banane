'use strict';
/* CH-159 (D-382) — Essais dédiés :
 *  - Seuil de 10 % d'échecs par portion dans le service worker (`relecturePasse`, `relecture-qualite-portion`, arrêt de la partie courante) ;
 *  - Lecteur LiDAR (`vendor/lidar.js`, `vendor/lidar-rust.js`, `tests/lidar.js`) : copie multi-composants `rgba`/`color`/`rgb` (itemSize 3/4)
 *    et scalaires `pointSourceID`/`pointSourceId`/`source`/`chain`/`chainId`/`chainID`/`scannerId`/`scannerID`, suppression des attributs vides
 *    (y compris tableaux de null), allowlist stricte, non-régression sur `intensity` et `classification`. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/settings.js');
const C = require('../vendor/capture-core.js');
const LidarVendor = require('../vendor/lidar.js');
const LidarRust = require('../vendor/lidar-rust.js');
const LidarTest = require('./lidar.js');
const F242 = require('./v242/fixtures.cjs');
const { H, PERMISSIF } = require('./helpers/relecture-essais.cjs');

test('10b. Service worker (relecturePasse) : dépassement de 10 % d’échecs journalise relecture-qualite-portion et arrête la partie courante avec le motif qualite-portion', async () => {
  // Portion 10 = [100..109] (10 ER). Les cuts 108 et 109 sont en refus de pose -> 2 échecs sur 10 coupes = 20 % > 10 %.
  // Dès la fin de la portion [100..109] (après le cut 109, avant le cut 110 de la portion [110..119]), la passe s'arrête sur `qualite-portion`.
  const { b } = await H.lotRelecture({
    mode: 'corriger',
    decisions: { 108: 14, 109: 14, 115: 14 },
    reglagesProposes: PERMISSIF,
    esv: (a, sw) => {
      a.total = 120;
      a.refusApply = cut => cut === 108 || cut === 109;
      sw.ctx.BananeSettings = {
        ...sw.ctx.BananeSettings,
        relectureCasParticuliers: {
          ...S.relectureCasParticuliers,
          portions: { ...S.relectureCasParticuliers.portions, portionMaxEr: 10 },
        },
      };
    },
  });
  const p = await H.finPasse(b);
  const evPortion = H.evenements(b, 'relecture-qualite-portion');
  assert.equal(evPortion.length, 1, 'événement relecture-qualite-portion émis à la fin de la portion [100..109]');
  assert.equal(evPortion[0].debut, 100);
  assert.equal(evPortion[0].fin, 109);
  assert.equal(evPortion[0].totalEr, 10);
  assert.equal(evPortion[0].echecs, 2);
  assert.equal(evPortion[0].tauxEchecPct, 20);
  assert.equal(evPortion[0].seuilDepasse, true);
  assert.equal(evPortion[0].motif, 'qualite-portion');
  const fin = H.evenements(b, 'relecture-fin').at(-1);
  assert.equal(fin.issue, 'qualite-portion');
  assert.equal(fin.faits, 2, 'la relecture s’est arrêtée à la fin de la portion en dépassement (cuts 110..116 non visités)');
  assert.deepEqual(fin.nonRelus, [110, 113, 114, 115, 116]);
  assert.equal(fin.qualitePortion?.seuilDepasse, true);
  assert.equal(fin.qualitePortion?.motif, 'qualite-portion');
  assert.equal(p.etat, 'arretee');
});

test('11. Lecteur LiDAR (vendor/lidar.js, vendor/lidar-rust.js, tests/lidar.js) : rgba/color/rgb (itemSize 3/4) et source/chain/scannerId copiés, attributs vides (dont tableaux de null) supprimés, allowlist stricte', async () => {
  for (const [nom, L] of [['vendor/lidar.js', LidarVendor], ['vendor/lidar-rust.js', LidarRust], ['tests/lidar.js', LidarTest]]) {
    // 1. Capture existante avec intensity + classification seules : inchangée
    const fBase = F242.scene();
    fBase.mesh.geometry.attributes.intensity = { array: new Uint16Array([10, 20, 30, 40, 50]), count: 5, itemSize: 1, version: 0 };
    fBase.mesh.geometry.attributes.classification = { array: new Uint8Array([1, 2, 1, 2, 1]), count: 5, itemSize: 1, version: 0 };
    const capBase = await L.capture({
      viewer: fBase.viewer,
      rails: [fBase.left, fBase.right].map(C.railState),
      origin: [513237, 6638161, 60],
      guard: () => {},
      enums: F242.enums,
      meta: { part: 20, cut: 0, shape: 'U50' },
      pause: async () => {},
    });
    assert.deepEqual(Object.keys(capBase.attributes).sort(), ['classification', 'intensity'], `${nom} : seules les clés non vides sont conservées`);
    assert.deepEqual(capBase.attributes.intensity, [10, 20, 30, 40]);
    assert.deepEqual(capBase.attributes.classification, [1, 2, 1, 2]);

    // 2. Capture avec rgba (itemSize 4), color (itemSize 3), pointSourceID, source, scannerId, attribut vide (chainId tout NaN et rgb tout NaN), et clé hors allowlist (secretUrl)
    const f = F242.scene();
    f.mesh.geometry.attributes.rgba = {
      array: new Uint8Array([
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 0, 255, 128,
        255, 255, 0, 255,
        10, 20, 30, 40,
      ]),
      count: 5,
      itemSize: 4,
      version: 0,
    };
    f.mesh.geometry.attributes.color = {
      array: new Float32Array([
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
        0.5, 0.5, 0.5,
        0.1, 0.2, 0.3,
      ]),
      count: 5,
      itemSize: 3,
      version: 0,
    };
    f.mesh.geometry.attributes.rgb = {
      array: new Float32Array(15).fill(NaN), // 5 points * 3 composantes toutes NaN -> tableau de null -> doit être supprimé !
      count: 5,
      itemSize: 3,
      version: 0,
    };
    f.mesh.geometry.attributes.pointSourceID = { array: new Uint16Array([1, 1, 2, 2, 1]), count: 5, itemSize: 1, version: 0 };
    f.mesh.geometry.attributes.source = { array: new Uint8Array([10, 10, 20, 20, 10]), count: 5, itemSize: 1, version: 0 };
    f.mesh.geometry.attributes.scannerId = { array: new Uint8Array([1, 2, 1, 2, 1]), count: 5, itemSize: 1, version: 0 };
    f.mesh.geometry.attributes.chainId = { array: new Float32Array(5).fill(NaN), count: 5, itemSize: 1, version: 0 };
    f.mesh.geometry.attributes.secretUrl = { array: new Uint8Array([1, 2, 3, 4, 5]), count: 5, itemSize: 1, version: 0 };

    const cap = await L.capture({
      viewer: f.viewer,
      rails: [f.left, f.right].map(C.railState),
      origin: [513237, 6638161, 60],
      guard: () => {},
      enums: F242.enums,
      meta: { part: 20, cut: 0, shape: 'U50' },
      pause: async () => {},
    });

    assert.deepEqual(
      cap.attributes.rgba,
      [
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 0, 255, 128],
        [255, 255, 0, 255],
      ],
      `${nom} : rgba (itemSize 4) copié avec ses 4 composantes`
    );
    assert.deepEqual(
      cap.attributes.color,
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0.5, 0.5, 0.5],
      ],
      `${nom} : color (itemSize 3) copié avec ses 3 composantes`
    );
    assert.deepEqual(cap.attributes.pointSourceID, [1, 1, 2, 2], `${nom} : pointSourceID scalaire conservé`);
    assert.deepEqual(cap.attributes.source, [10, 10, 20, 20], `${nom} : source scalaire copié`);
    assert.deepEqual(cap.attributes.scannerId, [1, 2, 1, 2], `${nom} : scannerId scalaire copié`);
    assert.equal('rgb' in cap.attributes, false, `${nom} : rgb composé uniquement de [null,null,null] doit être supprimé`);
    assert.equal('chainId' in cap.attributes, false, `${nom} : chainId entièrement null doit être supprimé`);
    assert.equal('secretUrl' in cap.attributes, false, `${nom} : clé hors allowlist jamais copiée`);
  }
});
