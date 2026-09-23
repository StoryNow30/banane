#!/usr/bin/env node
'use strict';
/*
 * merge-segments.cjs — refusionne les segments d'export Natif V4.5-R.
 *
 *   node tools/merge-segments.cjs --out SESSION.json seg01.json seg02.json ...
 *   node tools/merge-segments.cjs --out SESSION.json --dir DOSSIER
 *
 * Chaque segment est autonome. Deux natures de contenu s'y mélangent :
 *
 *  - les NUAGES sont incrémentaux : un segment ne porte que les objets pas
 *    encore écrits sur disque ;
 *  - les MÉTADONNÉES (session, records, events, closureSummary) sont un
 *    instantané COMPLET de la session au moment du vidage, donc le dernier
 *    segment en sait plus que le premier.
 *
 * Une fusion qui prendrait les métadonnées du premier segment perdrait toutes
 * les visites observées ensuite. Vérifié sur le terrain : deux segments réels
 * portaient 20 puis 43 records, et l'ancienne fusion n'en gardait que 20.
 * On fait donc l'union des records et des événements, et on retient l'état de
 * session le plus avancé.
 */
const fs = require('node:fs');
const path = require('node:path');
const X = require('../src/native-export.js');

/* Fusion en mémoire, réutilisable par les outils d'analyse : une session
 * fusionnée peut dépasser la taille maximale d'une chaîne JavaScript
 * (≈ 512 Mo), donc ne jamais passer par un fichier intermédiaire. */
function mergeFiles(files) {
  const loaded = files.map(f => {
    const doc = JSON.parse(fs.readFileSync(f));
    return { file: f, seg: doc.segment || {}, stampKey: String((doc.segment || {}).stamp || '') };
  });
  /* Ordre de fusion : par horodatage de segment puis par index. Le nom de fichier
   * n'est pas fiable — chaque vidage automatique repart à seg01. */
  loaded.sort((a, b) =>
    a.stampKey.localeCompare(b.stampKey) ||
    (a.seg.index || 0) - (b.seg.index || 0) ||
    a.file.localeCompare(b.file));

  const clouds = [], seenClouds = new Set();
  const records = new Map(), events = new Map();
  const declared = new Set();
  let base = null, baseScore = -1, totalPoints = 0;
  const trace = [];

  // Un segment à la fois : relu, fusionné, libéré.
  for (const { file, seg } of loaded) {
    const full = X.expand(JSON.parse(fs.readFileSync(file)));

    // Nuages : incrémentaux, dédupliqués de façon non destructive.
    let added = 0, dup = 0;
    for (const c of full.clouds || []) {
      const id = c.chunkId || c.captureId;
      if (id && seenClouds.has(id)) { dup++; continue; }
      if (id) seenClouds.add(id);
      clouds.push(c); added++;
      totalPoints += (c.pointsSceneRelative || []).length;
    }

    // Records et événements : union par identifiant, le plus récent l'emporte.
    for (const r of full.records || []) records.set(r.recordId || r.id || JSON.stringify(r).slice(0, 64), r);
    for (const e of full.events || []) events.set(e.eventId || `${e.eventSeq}`, e);

    for (const id of (full.cloudIds || full.session?.cloudIds || full.declaredCloudIds || [])) declared.add(id);

    // État de session le plus avancé : celui qui connaît le plus de nuages.
    const score = (full.session?.cloudIds || full.declaredCloudIds || []).length;
    if (score >= baseScore) {
      baseScore = score;
      const { clouds: _c, segment: _s, records: _r, events: _e, ...rest } = full;
      base = rest;
    }

    trace.push({ file: path.basename(file), stamp: seg.stamp ?? null, index: seg.index ?? null, objets: added, doublons: dup, records: (full.records || []).length, events: (full.events || []).length });
  }

  const mergedRecords = [...records.values()];
  const mergedEvents = [...events.values()].sort((a, b) => (a.eventSeq || 0) - (b.eventSeq || 0));
  const missing = [...declared].filter(id => !seenClouds.has(id));
  const merged = {
    ...base, records: mergedRecords, events: mergedEvents, clouds,
    mergeTrace: {
      tool: 'merge-segments.cjs', mergedAt: new Date().toISOString(), segments: trace,
      cloudObjects: clouds.length, pointsMerged: totalPoints,
      records: mergedRecords.length, events: mergedEvents.length,
      declaredCloudIds: declared.size, missingCloudIds: missing.length,
      allDeclaredPresent: missing.length === 0,
      note: 'Nuages incrémentaux dédupliqués ; records et événements en union sur tous les segments ; état de session le plus avancé retenu.',
    },
  };
  return { merged, trace, missing, totalPoints };
}
/* Une session d'entrée : un fichier JSON, ou un dossier de segments fusionnés en mémoire. */
function loadSession(input) {
  if (fs.statSync(input).isDirectory()) {
    const files = fs.readdirSync(input).filter(f => f.endsWith('.json')).sort().map(f => path.join(input, f));
    return mergeFiles(files).merged;
  }
  return JSON.parse(fs.readFileSync(input, 'utf8'));
}

function main() {
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const out = opt('--out');
const dir = opt('--dir');
let files = argv.filter(a => a.endsWith('.json') && a !== out);
if (dir) files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => path.join(dir, f));
if (!out || !files.length) { console.error('Usage : --out SESSION.json seg01.json seg02.json…  (ou --dir DOSSIER)'); process.exit(1); }
const { merged, trace, missing, totalPoints } = mergeFiles(files);
const clouds = merged.clouds, mergedRecords = merged.records, mergedEvents = merged.events, declared = { size: merged.mergeTrace.declaredCloudIds };
const loaded = trace;
const buf = Buffer.from(JSON.stringify(merged));
fs.writeFileSync(out, buf);

console.log('segments fusionnés : ' + loaded.length);
for (const t of trace) console.log('   ' + t.file + '  -> ' + t.objets + ' objets' + (t.doublons ? ' (' + t.doublons + ' doublons ignorés)' : '') + ', ' + t.records + ' records, ' + t.events + ' events');
console.log('objets LiDAR : ' + clouds.length + '   points : ' + totalPoints);
console.log('records : ' + mergedRecords.length + '   events : ' + mergedEvents.length);
console.log('cloudIds déclarés (union) : ' + declared.size + '   manquants : ' + missing.length + (missing.length ? '  ' + missing.slice(0, 5).join(', ') : ''));
console.log('écrit : ' + out + '  (' + (buf.length / 1e6).toFixed(1) + ' Mo)');
if (missing.length) { console.error('ATTENTION : segments incomplets, ne pas présenter ce fichier comme une session entière.'); process.exit(2); }
}
if (require.main === module) main();
module.exports = { mergeFiles, loadSession };
