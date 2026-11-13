#!/usr/bin/env node
'use strict';
/* CH-125 : contrôle statique des estimateurs sur le lot du 14/10 partie 17 (époque d'octobre, nuages denses et dessus épais ; déjà « vu » par
 * CH-118 et CH-121, hors de la garde scellée). Hors ligne, lecture seule.
 *   node chantiers/CH-125/outils/oct-p17.cjs --corpus SEG.json [--corpus …] --rails rails-1410-p17.csv --gabarit G.json [--sortie DOSSIER]
 * Entrée de vérité : la table par rail de CH-118 (`banane-data/outils/analyse-lots/CH-118/sorties/rails-1410-p17.csv` : pose d'Ariane `adLat`,
 * `adVert`, écart de l'opérateur `lat`, `vert`, calage `conv`, `dz`, `du`). Écrit des rails au format d'extraire-rails.cjs (lot « 1410 », hors dépôt)
 * pour que mesure.cjs, enveloppe.cjs et les autres outils les lisent comme un lot de plus. */
const fs = require('node:fs'), path = require('node:path');
const N = require('./nuage.cjs');
const C = N.C, Conv = N.Conv;
const a = process.argv.slice(2), o = { corpus: [] };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--corpus') o.corpus.push(v()); else if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--sortie') o.sortie = v(); else throw Error('option inconnue ' + k); }
const t = fs.readFileSync(o.rails, 'utf8').trim().split('\n'), h = t[0].split(';');
const Rw = t.slice(1).map(l => Object.fromEntries(l.split(';').map((v, i) => [h[i], v === '' || isNaN(+v) ? v : +v])));
const parCut = new Map(); for (const r of Rw) { if (!parCut.has(r.cut)) parCut.set(r.cut, {}); parCut.get(r.cut)[r.cote] = r; }
const caps = new Map();
for (const f of o.corpus) { let d = JSON.parse(fs.readFileSync(f, 'utf8')); for (const c of d.clouds || []) if (c && parCut.has(c.cut) && c.rails && Array.isArray(c.pointsSceneRelative)) { const p = caps.get(c.cut); if (!p || String(p.capturedAt) < String(c.capturedAt)) caps.set(c.cut, c); } d = null; }
fs.mkdirSync(o.sortie, { recursive: true });
const fd = fs.openSync(path.join(o.sortie, '1410-p17-r1.jsonl'), 'w'); let n = 0, ecartes = 0;
const DU = 0.16, DZ_HAUT = 0.11, DZ_BAS = 0.20;
for (const [cut, c] of parCut) {
  const cap = caps.get(cut); if (!cap || !c.left || !c.right) { ecartes++; continue; }
  for (const side of ['left', 'right']) {
    const x = c[side], rail = cap.rails[side], tpl = Conv.template(rail); if (!tpl || !Number.isFinite(x.adLat) || !Number.isFinite(x.adVert)) { ecartes++; continue; }
    const M = rail.sceneRelativeToProfileLocal, o0 = C.point(M, rail.positionSceneRelative), bu = tpl.sign * x.adLat / 1000, bz = x.adVert / 1000, pts = [], V = cap.visibleByClipBoxes;
    for (let i = 0; i < cap.pointsSceneRelative.length; i++) { const s = cap.pointsSceneRelative[i]; if (!Array.isArray(s) || !(s[0] === s[0])) continue; const q = C.point(M, s), xx = q[0] - o0[0], u = tpl.sign * (q[1] - o0[1]), z = q[2] - o0[2];
      if (Math.abs(u - bu) < DU && z - bz < DZ_HAUT && z - bz > -DZ_BAS) pts.push(xx, u, z, Array.isArray(V) && V[i] === false ? 1 : 0); }
    const f32 = Float32Array.from(pts), autre = c[side === 'left' ? 'right' : 'left'];
    const classe = Math.max(c.left.d3, c.right.d3) <= 10 ? 'juste' : Math.max(c.left.d3, c.right.d3) <= 50 ? '10-50' : 'mauvaise-voie';
    fs.writeSync(fd, JSON.stringify({ lot: '1410', partie: 17, rang: 1, cut, ordre: n, cote: side, zone: x.zone || null, etage: x.stage || null, source: 'lot', passe: false, signe: tpl.sign, largeur: tpl.width,
      livre: [bu, bz], finale: [bu + tpl.sign * x.lat / 1000, bz + x.vert / 1000], ref: null, classeLot: classe, exclu: null, juge: true, conv: x.conv, convRaison: x.convRaison || null, dzConv: x.dz, duConv: x.du,
      autreLivre: [autre.adLat / 1000, autre.adVert / 1000], n: f32.length / 4, points: Buffer.from(f32.buffer).toString('base64') }) + '\n'); n++;
  }
}
fs.closeSync(fd);
console.log(`14/10 p17 : ${n} rails écrits, ${ecartes} écartés (capture ou pose absente)`);
