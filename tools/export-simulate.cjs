#!/usr/bin/env node
'use strict';
/*
 * export-simulate.cjs — reproduit hors ligne le chemin d'export du panneau.
 *
 * panel.js écrit les segments dans le navigateur ; ce script applique la même
 * découpe et le même compactage sur un export complet, afin de vérifier la
 * chaîne sur données réelles : segmentation -> fusion -> rejeu du banc.
 *
 *   node tools/export-simulate.cjs --input SESSION.json --out-dir DOSSIER [--segment-bytes 32000000]
 */
const fs = require('node:fs');
const path = require('node:path');
const X = require('../src/native-export.js');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const input = opt('--input'), outDir = opt('--out-dir'), segmentBytes = Number(opt('--segment-bytes', 48 * 1024 * 1024));
if (!input || !outDir) { console.error('Usage : --input SESSION.json --out-dir DOSSIER [--segment-bytes N]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const doc = JSON.parse(fs.readFileSync(input));
const { clouds, ...metadata } = doc;
const stamp = '20260101T000000';

const MIN_OBJECTS_PER_SEGMENT = 48;
const SEGMENT_RESERVE_BYTES = 4 * 1024 * 1024;
let interner = null, head = '', parts = [], bytes = 0, inSegment = 0, segment = 0;
// En-tête REPLIÉ + nuages + dictionnaires = taille réelle du fichier.
const fileBytes = () => bytes + (interner ? interner.bytes : 0);
const written = [];
const openSegment = () => {
  interner = X.createInterner();
  head = JSON.stringify(X.foldRefs(metadata, interner)).slice(0, -1);
  parts = []; bytes = head.length; inSegment = 0;
};
const closeSegment = () => {
  if (!inSegment) return;
  segment++;
  const info = ',"segment":' + JSON.stringify({ index: segment, stamp, objects: inSegment, format: 'banane-native-export-segment-v1' });
  const dict = ',"dictionaries":' + JSON.stringify(interner.dictionaries);
  const fmt = ',"format":"' + X.FORMAT + '","compactedFrom":"' + (metadata.format || 'banane-native-session-v2') + '"';
  const name = 'banane-native-v4-' + stamp + '-seg' + String(segment).padStart(2, '0') + '.json';
  const buf = Buffer.concat([head, info, fmt, ',"clouds":[', ...parts, ']', dict, '}'].map(s => Buffer.from(s)));
  fs.writeFileSync(path.join(outDir, name), buf);
  written.push({ name, objects: inSegment, bytes: buf.length });
  parts = [];
};

openSegment();
const tous = clouds || [];
for (let i = 0; i < tous.length; i++) {
  const cloud = tous[i];
  const text = JSON.stringify(X.compactCloud(cloud, interner, {}));
  const restant = tous.length - i;
  if (inSegment >= MIN_OBJECTS_PER_SEGMENT && restant >= MIN_OBJECTS_PER_SEGMENT &&
      fileBytes() + text.length + SEGMENT_RESERVE_BYTES > segmentBytes) { closeSegment(); openSegment(); }
  if (inSegment) parts.push(',');
  parts.push(text); bytes += text.length + 1; inSegment++;
}
closeSegment();

console.log('segments écrits : ' + written.length + '  (budget ' + (segmentBytes / 1e6).toFixed(0) + ' Mo)');
let total = 0;
for (const w of written) { console.log('   ' + w.name + '  ' + w.objects + ' objets  ' + (w.bytes / 1e6).toFixed(1) + ' Mo'); total += w.bytes; }
console.log('total sur disque : ' + (total / 1e6).toFixed(1) + ' Mo   source : ' + (fs.statSync(input).size / 1e6).toFixed(1) + ' Mo');
console.log('plus gros segment : ' + (Math.max(...written.map(w => w.bytes)) / 1e6).toFixed(1) + ' Mo');
