#!/usr/bin/env node
'use strict';
/*
 * export-compact.cjs — compacte / réhydrate un export Natif, et prouve l'équivalence.
 *
 *   node tools/export-compact.cjs --input SESSION.json --out COMPACT.json
 *   node tools/export-compact.cjs --expand COMPACT.json --out SESSION.json
 *   node tools/export-compact.cjs --verify SESSION.json
 *
 * --verify compacte puis réhydrate en mémoire et compare champ par champ tout
 * ce que la chaîne moteur consomme réellement. Il ne se contente pas de
 * mesurer un gain : il démontre que le gain ne coûte aucune information utile.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const X = require('../src/native-export.js');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = n => argv.includes(n);

const input = opt('--input');
const expandFrom = opt('--expand');
const verify = opt('--verify');
const out = opt('--out');
const mo = n => (n / 1e6).toFixed(1);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function readDoc(p) { const b = fs.readFileSync(p); return { doc: JSON.parse(b), bytes: b.length, sha: sha(b) }; }

if (input) {
  const { doc, bytes } = readDoc(input);
  const packed = X.compact(doc, { dropProfileLocal: !has('--keep-profile-local'), dropPointSources: !has('--keep-point-sources') });
  const buf = Buffer.from(JSON.stringify(packed));
  if (out) fs.writeFileSync(out, buf);
  console.log('source   : ' + mo(bytes) + ' Mo');
  console.log('compact  : ' + mo(buf.length) + ' Mo');
  console.log('gain     : ' + mo(bytes - buf.length) + ' Mo  (' + (100 - buf.length / bytes * 100).toFixed(1) + ' %)');
  console.log('dicos    : ' + JSON.stringify(packed.compaction.dictionarySizes));
  if (out) console.log('écrit    : ' + out);
  process.exit(0);
}

if (expandFrom) {
  const { doc, bytes } = readDoc(expandFrom);
  const full = X.expand(doc);
  const buf = Buffer.from(JSON.stringify(full));
  if (out) fs.writeFileSync(out, buf);
  console.log('compact  : ' + mo(bytes) + ' Mo  ->  réhydraté : ' + mo(buf.length) + ' Mo');
  if (out) console.log('écrit    : ' + out);
  process.exit(0);
}

if (verify) {
  const { doc, bytes } = readDoc(verify);
  console.log('════ VÉRIFICATION D\'ÉQUIVALENCE ════');
  console.log('source : ' + verify.split('/').pop() + '  ' + mo(bytes) + ' Mo');

  const packed = X.compact(doc, {});
  const packedBuf = Buffer.from(JSON.stringify(packed));
  const back = X.expand(packed);

  console.log('compact : ' + mo(packedBuf.length) + ' Mo   gain ' + (100 - packedBuf.length / bytes * 100).toFixed(1) + ' %');
  console.log('dicos   : ' + JSON.stringify(packed.compaction.dictionarySizes));
  console.log('');

  let ko = 0;
  const check = (label, ok, detail) => { console.log((ok ? '  OK   ' : '  ECHEC') + '  ' + label + (detail ? '   ' + detail : '')); if (!ok) ko++; };

  // 1. Structures de tête
  for (const k of ['format', 'version', 'exportedAt']) check('en-tête ' + k, JSON.stringify(back[k]) === JSON.stringify(doc[k]));
  check('session identique', JSON.stringify(back.session) === JSON.stringify(doc.session));
  check('events identiques', JSON.stringify(back.events) === JSON.stringify(doc.events));
  check('closureSummary identique', JSON.stringify(back.closureSummary) === JSON.stringify(doc.closureSummary));

  // 2. Records : tout ce que le banc lit
  check('nombre de records', back.records.length === doc.records.length, back.records.length + ' vs ' + doc.records.length);
  let recDiff = 0;
  for (let i = 0; i < doc.records.length; i++) if (JSON.stringify(back.records[i]) !== JSON.stringify(doc.records[i])) recDiff++;
  check('records identiques au bit près', recDiff === 0, recDiff ? recDiff + ' divergents' : '');

  // 3. Nuages : champs réellement consommés par buildEngineInput
  check('nombre de chunks', back.clouds.length === doc.clouds.length);
  let sceneDiff = 0, visDiff = 0, railDiff = 0, coordDiff = 0, qualDiff = 0, idDiff = 0, localMax = 0, localCount = 0;
  for (let i = 0; i < doc.clouds.length; i++) {
    const a = doc.clouds[i], b = back.clouds[i];
    if (JSON.stringify(a.pointsSceneRelative) !== JSON.stringify(b.pointsSceneRelative)) sceneDiff++;
    if (JSON.stringify(a.visibleByClipBoxes) !== JSON.stringify(b.visibleByClipBoxes)) visDiff++;
    if (JSON.stringify(a.rail) !== JSON.stringify(b.rail)) railDiff++;
    if (JSON.stringify(a.coordinateSystem) !== JSON.stringify(b.coordinateSystem)) coordDiff++;
    if (JSON.stringify(a.qualification) !== JSON.stringify(b.qualification)) qualDiff++;
    if (JSON.stringify(a.identity) !== JSON.stringify(b.identity)) idDiff++;
    // écart max sur le champ dérivé recalculé
    if (Array.isArray(a.pointsProfileLocal) && Array.isArray(b.pointsProfileLocal)) {
      for (let j = 0; j < a.pointsProfileLocal.length; j++) {
        localCount++;
        for (let k = 0; k < 3; k++) localMax = Math.max(localMax, Math.abs(a.pointsProfileLocal[j][k] - b.pointsProfileLocal[j][k]));
      }
    }
  }
  console.log('');
  console.log('  --- champs consommés par le moteur ---');
  check('pointsSceneRelative identiques', sceneDiff === 0, sceneDiff ? sceneDiff + ' chunks divergents' : '');
  check('visibleByClipBoxes identiques', visDiff === 0, visDiff ? visDiff + ' chunks divergents' : '');
  check('rail identique', railDiff === 0, railDiff ? railDiff + ' chunks divergents' : '');
  check('coordinateSystem identique', coordDiff === 0);
  check('qualification identique', qualDiff === 0);
  check('identity identique', idDiff === 0);
  console.log('');
  console.log('  --- champ dérivé recalculé (non lu par buildEngineInput) ---');
  console.log('  pointsProfileLocal : ' + localCount + ' points comparés, écart max ' + localMax.toExponential(3));
  console.log('  Cause : associativité flottante. L\'original calcule (A x model) x raw ; la');
  console.log('  réhydratation calcule A x (model x raw) = A x scene, avec scene ~3,6e5 et une');
  console.log('  translation ~-5,8e6 dans A, d\'où une annihilation de chiffres significatifs.');
  console.log('  Ce champ n\'est lu nulle part dans la chaîne moteur : buildEngineInput utilise');
  console.log('  pointsSceneRelative et visibleByClipBoxes, et native-offline-evaluate.cjs:79');
  console.log('  applique DÉJÀ ce même recalcul en repli. Tolérance retenue : 1e-7.');
  check('écart dérivé sous tolérance documentée (<1e-7)', localMax < 1e-7);

  console.log('');
  console.log(ko === 0 ? '>>> ÉQUIVALENCE DÉMONTRÉE : ' + (100 - packedBuf.length / bytes * 100).toFixed(1) + ' % de gain sans perte utile'
    : '>>> ' + ko + ' CONTRÔLES EN ÉCHEC');
  process.exit(ko === 0 ? 0 : 1);
}

console.error('Usage : --input S.json --out C.json | --expand C.json --out S.json | --verify S.json');
process.exit(1);
