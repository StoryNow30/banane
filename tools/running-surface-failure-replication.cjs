#!/usr/bin/env node
'use strict';
/* Running Surface Failure Replication V1 — hors ligne, lecture seule.
 *
 * Traceur INDÉPENDANT. Ce n'est pas G.propose. Recopie mécanique des
 * portions de src/geometry.js nécessaires pour observer coarse / refined /
 * topRows lorsque propose abandonne sans metrics.
 * Constantes = G.DEFAULTS ou littéraux cités depuis geometry.js.
 * Aucun runtime modifié. Aucun seuil choisi. Aucun correctif.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');

const ROOT = path.resolve(__dirname, '..');
const REASON_RUNNING = 'Plan de roulement non estimable.';
const REASON_WINDOW = 'Intersection hors de la fenêtre expérimentale.';
const DEGRADED_SESSION = '0c58c033-f2e7-4aa5-ad8c-80b081a83932';
const SESSION_17 = '3876864f-a864-4678-b7b0-3feecc4af418';
const HUMAN_FREE_BLOCKS = Object.freeze([
  'identity', 'engineObserved', 'traceValidation', 'coarseSearch', 'refinedSearch',
  'topSupport', 'localLandscape', 'nearestSupportValidPlacement',
  'sessionSideContext', 'degradationContext',
]);
const HUMAN_BLOCK = 'postHocEvaluation';

const LITERALS = Object.freeze({
  source: 'src/geometry.js propose()',
  refineHalf: 0.004,
  refineStep: 0.001,
  headZ: -0.04,
  headWidthZ: -0.012,
  roiX: 0.5,
  roiY: 0.18,
  roiZ: 0.10,
  minPointsAroundMushroom: 8,
  minHeadVertices: 6,
  widthLo: 0.025,
  widthHi: 0.12,
  topAnchorStart: 0.012,
  topAnchorStep: 0.006,
  topAnchorNear: 0.004,
  faceAnchorStart: -0.014,
  faceAnchorEnd: -0.033,
  faceAnchorStep: -0.004,
  faceAnchorNear: 0.004,
  minAnchors: 3,
  lossCap: 0.025 * 0.025,
  searchOriginU: 0,
  searchOriginZ: 0,
  topRowInner: 0.012,
  robustLineMinRows: 3,
  surfaceMargin: 0.01,
  faceDropLo: 0.009,
  faceDropHi: 0.034,
});
