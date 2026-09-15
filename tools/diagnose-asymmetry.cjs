#!/usr/bin/env node
'use strict';
/*
 * diagnose-asymmetry.cjs — où se trouve réellement le champignon, par rapport
 * à la fenêtre de recherche du moteur ?
 *
 *   node tools/diagnose-asymmetry.cjs --input SESSION.json [--json OUT.json]
 *
 * Constat de terrain (15/09/2026, deux sessions indépendantes) : à capture
 * strictement symétrique — mêmes points en ROI, mêmes tranches longitudinales —
 * le moteur trouve 43 à 50 points de plan de roulement à droite et 6 à gauche,
 * pour un seuil de 15. Ce script cherche pourquoi.
 *
 * Il REPRODUIT la projection du moteur sans le modifier : profil local via
 * `sceneRelativeToProfileLocal`, normalisation du côté par le signe de la
 * médiane latérale du contour, puis coordonnées moteur u = signe × latéral et
 * z = vertical. Ce sont exactement les lignes 33 à 44 de `src/geometry.js`.
 *
 * Il ne touche à rien : lecture seule, aucune proposition, aucun seuil modifié.
 */
const fs = require('node:fs');
const K = require('../src/core.js');
const Lab = require('./placement-lab.cjs');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const input = opt('--input'), jsonOut = opt('--json');
if (!input) { console.error('Usage : --input SESSION.json [--json OUT.json]'); process.exit(1); }

/* Fenêtre de recherche du moteur, lue dans ses paramètres gelés. */
const G = require('../src/geometry.js');
const cfg = G.DEFAULTS;

const median = xs => { if (!xs.length) return NaN; const a = xs.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
const quant = (xs, p) => { if (!xs.length) return NaN; const a = xs.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };

/* Projection identique à celle du moteur. */
function engineFrame(capture, side) {
  const rail = capture.rails[side];
  const contour = (rail.profileContours || []).reduce((a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  if (!contour) return null;
  const shape = contour.verticesSceneRelative.map(p => K.C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(median(shape.map(p => p[1])));
  if (!sign) return null;
  const vertices = shape.map(p => [sign * p[1], p[2]]);
  const head = vertices.filter(p => p[1] > -0.04);
  if (head.length < 6) return null;
  const width = Math.max(...head.filter(p => p[1] > -0.012).map(p => p[0]));

  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes?.[i] === false) continue;
    const q = K.C.point(rail.sceneRelativeToProfileLocal, capture.pointsSceneRelative[i]);
    if (q.every(Number.isFinite) && Math.abs(q[0]) <= 0.5 && Math.abs(q[1]) < 0.18 && Math.abs(q[2]) < 0.10)
      points.push([sign * q[1], q[2]]);
  }
  return { sign, width, head, points };
}

/* Surface supérieure observée : pour chaque tranche latérale, le z le plus haut.
 * C'est le plan de roulement tel que le nuage le montre. */
function observedTop(points, width) {
  const bins = new Map();
  for (const [u, z] of points) {
    const b = Math.round(u / 0.006);
    const cur = bins.get(b);
    if (cur === undefined || z > cur) bins.set(b, z);
  }
  const rows = [...bins.entries()].map(([b, z]) => [b * 0.006, z]).sort((a, b) => a[0] - b[0]);
  // On garde la bande latérale où le champignon est censé se trouver.
  const dansLarge = rows.filter(r => r[0] > -width && r[0] < 2 * width);
  return { rows, dansLarge };
}

const doc = JSON.parse(fs.readFileSync(input));
const clouds = new Map((doc.clouds || []).map(c => [c.chunkId, c]));
const observed = new Map();
for (const e of doc.events || []) if (e.visitId && ['native-visit-started', 'native-state-observed'].includes(e.type)) {
  const rows = observed.get(e.visitId) || [];
  rows.push({ type: e.type, eventSeq: e.eventSeq, state: e.type === 'native-visit-started' ? e.initialObserved : e.state });
  observed.set(e.visitId, rows);
}
for (const rows of observed.values()) rows.sort((a, b) => a.eventSeq - b.eventSeq);

const parCote = { left: [], right: [] };
for (const record of doc.records || []) {
  const prepared = Lab.prepareVisit(record, clouds, observed.get(record.visitId) || []);
  for (const side of ['left', 'right']) {
    const input = prepared.rails[side];
    if (input.status !== 'ready') continue;
    const f = engineFrame(input.capture, side);
    if (!f || f.points.length < 8) continue;
    const { dansLarge } = observedTop(f.points, f.width);
    if (!dansLarge.length) continue;
    const zTop = dansLarge.map(r => r[1]);
    const us = f.points.map(p => p[0]);
    parCote[side].push({
      cut: record.identity.cut, side, sign: f.sign, width: f.width,
      points: f.points.length,
      // Hauteur du plan de roulement observé, dans le repère du moteur.
      zTopMedian: median(zTop),
      // Position latérale du nuage par rapport à l'origine du profil.
      uMedian: median(us), uP10: quant(us, 0.1), uP90: quant(us, 0.9),
      // Points réellement dans la fenêtre de recherche.
      dansFenetre: f.points.filter(p => Math.abs(p[0]) <= cfg.searchY && Math.abs(p[1]) <= cfg.searchZ).length,
      _points: f.points, _capture: input.capture,
    });
  }
}

function bloc(side) {
  const rows = parCote[side];
  if (!rows.length) { console.log('  ' + side + ' : aucun rail exploitable'); return null; }
  const z = rows.map(r => r.zTopMedian), u = rows.map(r => r.uMedian);
  const dedans = rows.map(r => r.dansFenetre / r.points * 100);
  const signes = [...new Set(rows.map(r => r.sign))];
  const r = {
    rails: rows.length, signe: signes.join(','),
    zTopMedian: median(z), zTopP10: quant(z, 0.1), zTopP90: quant(z, 0.9),
    uMedian: median(u), pointsDansFenetrePct: median(dedans),
    largeurProfil: median(rows.map(x => x.width)),
  };
  const mm = v => (v * 1000).toFixed(1);
  console.log('  ' + side.padEnd(6) + ' ' + String(r.rails).padStart(3) + ' rails   signe ' + r.signe);
  console.log('        plan de roulement observé : z médian ' + mm(r.zTopMedian) + ' (p10 ' + mm(r.zTopP10) + ', p90 ' + mm(r.zTopP90) + ') ×1e-3 u');
  console.log('        nuage latéral : u médian ' + mm(r.uMedian) + ' ×1e-3 u   largeur de profil ' + mm(r.largeurProfil));
  console.log('        points dans la fenêtre de recherche : ' + r.pointsDansFenetrePct.toFixed(0) + ' %');
  return r;
}

console.log('════ OÙ EST LE CHAMPIGNON, VU PAR LE MOTEUR ════');
console.log('fenêtre de recherche : ±' + (cfg.searchY * 1000).toFixed(0) + 'e-3 u latéral, ±' + (cfg.searchZ * 1000).toFixed(0) + 'e-3 u vertical');
console.log('le moteur attend le plan de roulement autour de z = 0, dans une bande de ±' + (cfg.topBand * 1000).toFixed(0) + 'e-3 u');
console.log('');
const G_ = { left: bloc('left'), right: bloc('right') };

if (G_.left && G_.right) {
  const dz = G_.left.zTopMedian - G_.right.zTopMedian;
  const du = G_.left.uMedian - G_.right.uMedian;
  console.log('');
  console.log('── écart gauche − droite ──');
  console.log('   plan de roulement : ' + (dz * 1000).toFixed(1) + 'e-3 u en vertical');
  console.log('   nuage latéral     : ' + (du * 1000).toFixed(1) + 'e-3 u');
  const horsZ = Math.abs(G_.left.zTopMedian) > cfg.searchZ;
  const horsU = Math.abs(G_.left.uMedian) > cfg.searchY;
  console.log('');
  console.log('   plan de roulement gauche hors fenêtre verticale (±' + (cfg.searchZ * 1000).toFixed(0) + 'e-3) : ' + (horsZ ? 'OUI' : 'non'));
  console.log('   nuage gauche hors fenêtre latérale (±' + (cfg.searchY * 1000).toFixed(0) + 'e-3) : ' + (horsU ? 'OUI' : 'non'));
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({
  format: 'banane-asymmetry-diagnostic-v1', generatedAt: new Date().toISOString(),
  source: input, engineWindow: { searchY: cfg.searchY, searchZ: cfg.searchZ, topBand: cfg.topBand },
  unit: 'scene-unit; physical calibration NOT independently verified',
  summary: G_, cases: [...parCote.left, ...parCote.right],
}, null, 2));
if (jsonOut) console.log('\ndétail : ' + jsonOut);

/* ── Question décisive ──────────────────────────────────────────────────────
 * Le moteur échoue-t-il parce que le nuage ne CONTIENT pas de plan de roulement
 * exploitable, ou parce que sa recherche se pose au mauvais endroit ?
 *
 * On balaie la même fenêtre que lui et on compte, pour chaque position, les
 * points qui tomberaient dans la bande du plan de roulement. Le maximum
 * atteignable se compare alors au seuil `minTop`.
 *   - maximum < minTop  -> la donnée ne porte pas la surface : problème de vue.
 *   - maximum >= minTop -> la surface est là : problème de choix de position.
 */
function meilleurTopAtteignable(points, width) {
  let best = { count: 0, u: 0, z: 0 };
  for (let u = -cfg.searchY; u <= cfg.searchY + 1e-10; u += cfg.grid * 2) {
    for (let z = -cfg.searchZ; z <= cfg.searchZ + 1e-10; z += cfg.grid * 2) {
      let n = 0;
      for (const p of points) {
        if (p[0] > u + 0.012 && p[0] < u + width - 0.012 && Math.abs(p[1] - z) < cfg.topBand) n++;
      }
      if (n > best.count) best = { count: n, u, z };
    }
  }
  return best;
}

console.log('');
console.log('════ LA SURFACE EST-ELLE SEULEMENT PRÉSENTE ? ════');
console.log('balayage de la fenêtre du moteur, meilleur nombre de points de plan de roulement atteignable');
console.log('seuil requis : minTop = ' + cfg.minTop);
console.log('');
const bilan = {};
for (const side of ['left', 'right']) {
  const rows = parCote[side];
  if (!rows.length) continue;
  const atteignables = [];
  for (const r of rows) {
    if (!r._points) continue;
    atteignables.push(meilleurTopAtteignable(r._points, r.width).count);
  }
  if (!atteignables.length) continue;
  const suffisants = atteignables.filter(n => n >= cfg.minTop).length;
  bilan[side] = { rails: atteignables.length, median: median(atteignables), p90: quant(atteignables, 0.9), suffisants };
  console.log('  ' + side.padEnd(6) + ' meilleur topCount atteignable : médiane ' + median(atteignables) +
    '  (p90 ' + quant(atteignables, 0.9) + ')');
  console.log('        rails où une position suffirait : ' + suffisants + ' / ' + atteignables.length);
}
if (bilan.left && bilan.right) {
  console.log('');
  const l = bilan.left;
  console.log(l.suffisants === 0
    ? '  >>> À GAUCHE, AUCUNE position de la fenêtre ne donne assez de points.'
    : '  >>> À gauche, ' + l.suffisants + ' rail(s) auraient une position suffisante : la surface existe.');
}

/* ── Le flanc interne est-il seulement visible ? ────────────────────────────
 * Le moteur ajuste sa position sur DEUX familles d'ancres : le plan de
 * roulement et le flanc interne. Si le flanc n'est pas observé, son terme de
 * perte devient trompeur et peut tirer la position loin du vrai plan de
 * roulement — ce qui détruirait aussi l'estimation du dessus.
 * On mesure donc, à la meilleure position pour le dessus, combien de points
 * tomberaient dans la bande du flanc. */
console.log('');
console.log('════ LE FLANC INTERNE EST-IL VISIBLE ? ════');
console.log('seuil requis : minFace = ' + cfg.minFace + '   bande de flanc ±' + (cfg.faceBand * 1000).toFixed(0) + 'e-3 u');
console.log('');
for (const side of ['left', 'right']) {
  const rows = parCote[side].filter(r => r._points);
  if (!rows.length) continue;
  const faces = [], tops = [];
  for (const r of rows) {
    const b = meilleurTopAtteignable(r._points, r.width);
    tops.push(b.count);
    // Points sous le dessus, à l'aplomb du flanc interne, comme le fait le moteur.
    let n = 0;
    for (const p of r._points) {
      const drop = b.z - p[1];
      if (drop > 0.009 && drop < 0.034 && Math.abs(p[0] - b.u) < cfg.faceBand) n++;
    }
    faces.push(n);
  }
  const suffisants = faces.filter(n => n >= cfg.minFace).length;
  console.log('  ' + side.padEnd(6) + ' points de flanc à la meilleure position : médiane ' + median(faces) +
    '  (p90 ' + quant(faces, 0.9) + ')');
  console.log('        rails où le flanc suffirait : ' + suffisants + ' / ' + rows.length +
    '   (' + Math.round(suffisants / rows.length * 100) + ' %)');
}

/* ── Le moteur se pose-t-il ailleurs que sur la bonne surface ? ─────────────
 * On compare la position que le moteur retient réellement (sa graine) à celle
 * qui maximise les points de plan de roulement. Un écart important signifie
 * que la recherche a préféré une autre surface. */
const Geometry = require('../src/geometry.js');
console.log('');
console.log('════ LA RECHERCHE SE POSE-T-ELLE AU BON ENDROIT ? ════');
for (const side of ['left', 'right']) {
  const rows = parCote[side].filter(r => r._points && r._capture);
  if (!rows.length) continue;
  const ecarts = [], topsMoteur = [], topsPossibles = [];
  for (const r of rows) {
    let prop = null;
    try { prop = Geometry.propose(r._capture, side, Geometry.DEFAULTS); } catch { continue; }
    const seed = prop?.metrics?.seed;
    if (!Array.isArray(seed)) continue;
    const b = meilleurTopAtteignable(r._points, r.width);
    // La graine est exprimée en (latéral signé, vertical) comme notre balayage.
    ecarts.push(Math.hypot(Math.abs(seed[0]) - Math.abs(b.u), seed[1] - b.z));
    topsMoteur.push(prop?.metrics?.topCount ?? 0);
    topsPossibles.push(b.count);
  }
  if (!ecarts.length) continue;
  console.log('  ' + side.padEnd(6) + ' écart graine moteur / meilleure position : médiane ' +
    (median(ecarts) * 1000).toFixed(1) + 'e-3 u  (p90 ' + (quant(ecarts, 0.9) * 1000).toFixed(1) + ')');
  console.log('        topCount obtenu ' + median(topsMoteur) + '   atteignable ' + median(topsPossibles));
}
