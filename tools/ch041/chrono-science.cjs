#!/usr/bin/env node
'use strict';
/* CH-041 — le PRIX D'UNE RELANCE du moteur gelé sur cette machine : `scientificProposeBothAvecReservoir` sur N captures d'un fichier de corpus, en ms
 * (médiane, P90), à comparer au span `science-public-total` du journal du même lot (machine de l'opérateur, tools/ch041/cycle-lot.cjs).
 *   node tools/ch041/chrono-science.cjs <corpus.json> [N=40] */
const fs = require('node:fs');
const Sh = require('../../src/gcv1-shadow.js');
const { med, q } = require('./cycle-lot.cjs');
const f = process.argv[2], N = Number(process.argv[3] || 40);
const doc = JSON.parse(fs.readFileSync(f, 'utf8')), clouds = (doc.clouds || []).filter(c => c && c.rails && Array.isArray(c.pointsSceneRelative) && c.pointsSceneRelative.length).slice(0, N);
const ms = [], pts = [];
for (const c of clouds) { const cap = { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: c.visibleByClipBoxes }; const t0 = process.hrtime.bigint(); Sh.scientificProposeBothAvecReservoir(cap); ms.push(Number(process.hrtime.bigint() - t0) / 1e6); pts.push(c.pointsSceneRelative.length); }
console.log(`${clouds.length} captures, points médiane ${med(pts)} ; science par capture : médiane ${Math.round(med(ms))} ms, P90 ${Math.round(q(ms, .9))} ms, min ${Math.round(Math.min(...ms))}, max ${Math.round(Math.max(...ms))}`);
