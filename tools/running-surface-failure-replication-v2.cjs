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
