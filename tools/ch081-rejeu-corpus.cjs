#!/usr/bin/env node
'use strict';
/* CH-081 (D-311) — REJEU DE LA ZONE DU PRÉCHAUFFAGE SUR UN CORPUS RÉEL, hors de Potree, sans rien modifier.
 * Usage : node tools/ch081-rejeu-corpus.cjs <dossier d'un export dézippé (fichiers ariane-gcv1-corpus-*.json)> [--rayon 0.75]
 * Le corpus vit dans `banane-data` ; cet outil ne rend QUE des comptes (aucune adresse, clé, position ni identifiant).
 * Pour chaque capture (ordre du temps), les nœuds visibles de ses vues qui n'étaient visibles dans aucune capture d'avant sont les « nouveaux » : ceux
 * que Potree a dû charger à l'arrivée. On compte ceux que couvre la boîte de découpe (src/prechauffage-boite.js, rails de la capture) et ceux que couvre
 * le cube de `rayon` autour de chaque rail (zone de CH-077 / CH-080), par saut ; puis les nœuds connus (vus un jour) qui coupent la boîte sans être
 * visibles (« en trop »). */
const fs = require('fs'), path = require('path');
const B = require('../src/prechauffage-boite.js');
const args = process.argv.slice(2), dir = args.find(a => !a.startsWith('--'));
const rayon = Number((args[args.indexOf('--rayon') + 1]) || 0.75) || 0.75;
if (!dir || !fs.existsSync(dir)) { console.error('usage : node tools/ch081-rejeu-corpus.cjs <dossier> [--rayon 0.75]'); process.exit(2); }
const caps = [];
for (const f of fs.readdirSync(dir).filter(f => /gcv1-corpus.*\.json$/.test(f)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const c of j.clouds || []) {
    if (!c.camera || !Array.isArray(c.nodes) || !c.rails?.left || !c.rails?.right) continue;
    let O = null; const noeuds = [];
    for (const n of c.nodes) { const b = n.reportedPotreeGeometryNodeBoundingBox, T = n.nodeToSceneRelative?.slice(12, 15); if (!b || !T) continue;
      O ||= [0, 1, 2].map(i => b.min[i] - T[i]); noeuds.push({ cle: b.min.map(x => x.toFixed(4)).join(',') + '|' + (b.max[0] - b.min[0]).toFixed(4), bm: [b.min.map((x, i) => x - O[i]), b.max.map((x, i) => x - O[i])], absMin: b.min, absMax: b.max }); }
    if (O) caps.push({ at: c.capturedAt, part: c.part, cut: c.cut, O, L: c.rails.left.positionSceneRelative, R: c.rails.right.positionSceneRelative, clip: c.clouds?.[0]?.clipping?.boxesSceneRelativeToUnit?.[0] || null, noeuds });
  }
}
caps.sort((a, b) => a.at < b.at ? -1 : 1);
const univ = new Map(); for (const c of caps) for (const n of c.noeuds) univ.set(n.cle, n);
const cube = (bm, rails) => rails.some(p => [0, 1, 2].every(i => bm[0][i] <= p[i] + rayon && bm[1][i] >= p[i] - rayon));
const classe = s => s === 1 ? '1' : s >= 2 && s <= 10 ? '2-10' : s >= 11 && s <= 50 ? '11-50' : s > 50 ? '>50' : s < 0 ? 'arriere' : '0';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const out = { captures: caps.length, visiblesHorsBoite: 0, visibles: 0, calibrees: 0, parSaut: {}, enTrop: [] };
const vus = new Set();
for (let k = 0; k < caps.length; k++) {
  const c = caps[k], z = B.zone(c.L, c.R); if (!z) continue;
  const vis = new Map(c.noeuds.map(n => [n.cle, n])); if (vis.size <= 4) continue;   /* capture vide (points non affichés) */
  if (c.clip) { /* la boîte de Potree de cette coupe : matrice monde de la boîte unité = inverse de la matrice rendue */
    const M = inverse(c.clip); if (B.calibrer(M, c.L, c.R)) out.calibrees++; }
  for (const n of vis.values()) { out.visibles++; if (!z.coupe(n.bm)) out.visiblesHorsBoite++; }
  if (k > 0 && caps[k - 1].part === c.part) {
    const g = out.parSaut[classe(c.cut - caps[k - 1].cut)] ||= { passages: 0, nouveaux: 0, boite: 0, cube: 0 };
    g.passages++;
    for (const n of vis.values()) if (!vus.has(n.cle)) { g.nouveaux++; if (z.coupe(n.bm)) g.boite++; if (cube(n.bm, [c.L, c.R])) g.cube++; }
  }
  let trop = 0; for (const [cle, n] of univ) if (!vis.has(cle) && z.coupe([n.absMin.map((x, i) => x - c.O[i]), n.absMax.map((x, i) => x - c.O[i])])) trop++;
  out.enTrop.push(trop);
  for (const cle of vis.keys()) vus.add(cle);
}
out.enTrop = { mediane: q(out.enTrop, 0.5), p90: q(out.enTrop, 0.9), max: Math.max(...out.enTrop) };
console.log(JSON.stringify(out, null, 1));

function inverse(m) { /* 4x4 colonne-major */
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
    b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
}
