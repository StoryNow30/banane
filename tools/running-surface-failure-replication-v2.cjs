#!/usr/bin/env node
'use strict';
/* Running Surface Failure Replication V2 — exécution capsule RSF V1.
 * Traceur INDÉPENDANT (préexistant à la capsule). Ce n'est pas G.propose.
 * Résultats q1–q9 produits sans appeler le traceur embarqué de la capsule.
 *
 * Adaptateur autorisé : Cap.loadRails + Cap.captureFromPayload.
 * captureFromPayload concatène points + visible dans l'ordre des chunks et
 * pose rails[side] = railInitialState. Aucune métrique Running Surface.
 *
 * Constantes = G.DEFAULTS + littéraux geometry.js. Aucun seuil choisi.
 * Aucune valeur humaine hors postHocEvaluation.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const Cap = require('./banane-capsule.cjs');

const ROOT = path.resolve(__dirname, '..');
const REASON_RUNNING = 'Plan de roulement non estimable.';
const DEGRADED_SESSION = '0c58c033-f2e7-4aa5-ad8c-80b081a83932';
const SESSION_17 = '3876864f-a864-4678-b7b0-3feecc4af418';
const LOSSLESS_FRONTIER_VISIT_INDEX = 245;
const CAPSULE_ID = 'rsf-v1';
const HUMAN_FREE = Object.freeze([
  'identity', 'engineObserved', 'assembly', 'traceValidation',
  'coarseSearch', 'refinedSearch', 'topSupport', 'localLandscape',
  'nearestSupportValidPlacement', 'verticalAgreement', 'sessionSideContext',
  'degradationContext',
]);
const LITERALS = Object.freeze({
  source: 'src/geometry.js propose()',
  refineHalf: 0.004, refineStep: 0.001,
  headZ: -0.04, headWidthZ: -0.012,
  roiX: 0.5, roiY: 0.18, roiZ: 0.10,
  minPointsAroundMushroom: 8, minHeadVertices: 6,
  widthLo: 0.025, widthHi: 0.12,
  topAnchorStart: 0.012, topAnchorStep: 0.006, topAnchorNear: 0.004,
  faceAnchorStart: -0.014, faceAnchorEnd: -0.033, faceAnchorStep: -0.004, faceAnchorNear: 0.004,
  minAnchors: 3, lossCap: 0.025 * 0.025,
  topRowInner: 0.012, robustLineMinRows: 3,
  faceDropLo: 0.009, faceDropHi: 0.034,
});
const ARCHIVES = Object.freeze({
  historical: { name: 'banane-native-v4.6-2026-09-16.7z', sha256: '32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0', bytes: 34509008 },
  finalComplement: { name: 'banane-native-v4.6-2026-09-16-final.7z', sha256: '7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66', bytes: 56657500 },
});
const EXPECTED_CAPSULE_SHA = 'a8bb638f63e415ddf5bfede627f869a564c8af9afd68c556c2af2f943dcbdbb9';
SEE_LOCAL_FILE_38963_BYTES
