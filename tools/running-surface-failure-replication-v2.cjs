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
const HUMAN_FREE = Object.freeze(['identity','engineObserved','assembly','traceValidation','coarseSearch','refinedSearch','topSupport','localLandscape','nearestSupportValidPlacement','verticalAgreement','sessionSideContext','degradationContext']);
const LITERALS = Object.freeze({source:'src/geometry.js propose()',refineHalf:0.004,refineStep:0.001,headZ:-0.04,headWidthZ:-0.012,roiX:0.5,roiY:0.18,roiZ:0.10,minPointsAroundMushroom:8,minHeadVertices:6,widthLo:0.025,widthHi:0.12,topAnchorStart:0.012,topAnchorStep:0.006,topAnchorNear:0.004,faceAnchorStart:-0.014,faceAnchorEnd:-0.033,faceAnchorStep:-0.004,faceAnchorNear:0.004,minAnchors:3,lossCap:0.025*0.025,topRowInner:0.012,robustLineMinRows:3,faceDropLo:0.009,faceDropHi:0.034});
const ARCHIVES = Object.freeze({historical:{name:'banane-native-v4.6-2026-09-16.7z',sha256:'32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0',bytes:34509008},finalComplement:{name:'banane-native-v4.6-2026-09-16-final.7z',sha256:'7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66',bytes:56657500}});
const EXPECTED_CAPSULE_SHA = 'a8bb638f63e415ddf5bfede627f869a564c8af9afd68c556c2af2f943dcbdbb9';
function sha256File(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
function sha256Obj(o){return crypto.createHash('sha256').update(stable(o)).digest('hex');}
function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}
function nearEq(a,b,eps=1e-12){if(a===b)return true;if(typeof a!=='number'||typeof b!=='number')return false;if(!Number.isFinite(a)&&!Number.isFinite(b))return true;return Math.abs(a-b)<=eps;}
function vecEq(a,b,eps=1e-12){if(a==null&&b==null)return true;if(!a||!b||a.length!==b.length)return false;return a.every((x,i)=>nearEq(x,b[i],eps));}
function quantile(sorted,q){if(!sorted.length)return null;const i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?sorted[lo]:sorted[lo]*(hi-i)+sorted[hi]*(i-lo);}
function stats(arr){const s=arr.filter(Number.isFinite).slice().sort((a,b)=>a-b);return {n:s.length,min:s[0]??null,p25:quantile(s,0.25),median:quantile(s,0.5),p75:quantile(s,0.75),max:s.length?s[s.length-1]:null};}
function frozenHashes(){const out={present:{},expected:{},match:{}};const map=JSON.parse(fs.readFileSync(path.join(ROOT,'audit/v4.4.0-frozen-engine-hashes.json')));for(const [rel,want] of Object.entries(map)){if(!/geometry\.js$|capture-core\.js$|lidar\.js$/.test(rel))continue;const got=fs.existsSync(path.join(ROOT,rel))?sha256File(path.join(ROOT,rel)):null;out.expected[rel]=want;out.present[rel]=got;out.match[rel]=got===want;}const b=JSON.parse(fs.readFileSync(path.join(ROOT,'audit/v4.6.0-engine-baseline.json')));out.engineV46Expected=b.engine['src/engine.js'];out.engineV46Present=fs.existsSync(path.join(ROOT,'src/engine.js'))?sha256File(path.join(ROOT,'src/engine.js')):null;out.engineV46Match=out.engineV46Present===out.engineV46Expected;out.defaults={...G.DEFAULTS};return out;}
function topRowsAt(points,u,z,width,topBand){return points.filter(p=>p[0]>u+LITERALS.topRowInner&&p[0]<u+width-LITERALS.topRowInner&&Math.abs(p[1]-z)<topBand).map(p=>[p[0],p[1]]);}
module.exports.PLACEHOLDER_SEE_FULL_LOCAL='use artifacts/pair-lab/running-surface-failure-replication-v2.cjs';
