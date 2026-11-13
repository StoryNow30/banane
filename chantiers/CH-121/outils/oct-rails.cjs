#!/usr/bin/env node
'use strict';
/* CH-121 : forme du nuage autour des rails du 14/10 partie 17 (lot Pilote 4.9.0.12), jointe aux rails jugés de CH-118 (rails-1410-p17.csv).
 * Hors ligne, lecture seule. Le GCV1 d'aujourd'hui est relancé sur la capture (dernière capture du cut) ; le calage refait donne dz, du et la
 * distribution des points de dessus et de flanc autour de la pose brute. On garde le rail seulement si dz d'aujourd'hui = dz consigné à 0,5 mm près.
 *   node chantiers/CH-121/outils/oct-rails.cjs --corpus SEG.json [--corpus …] --rails rails-1410-p17.csv --sortie R.jsonl */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const Sh = require(path.join(RACINE, 'src/gcv1-shadow.js'));
const Conv = require(path.join(RACINE, 'src/placement-convention.js'));
const a = process.argv.slice(2), corpus = []; let rails, sortie;
for (let i = 0; i < a.length; i++) { if (a[i] === '--corpus') corpus.push(a[++i]); else if (a[i] === '--rails') rails = a[++i]; else if (a[i] === '--sortie') sortie = a[++i]; else throw Error(a[i]); }
const t = fs.readFileSync(rails, 'utf8').trim().split('\n'), h = t[0].split(';');
const R = t.slice(1).map(l => Object.fromEntries(l.split(';').map((v, i) => [h[i], v === '' || isNaN(+v) ? v : +v])));
const voulus = new Set(R.map(r => r.cut)), caps = new Map();
for (const f of corpus) { const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const c of d.clouds || []) if (c && voulus.has(c.cut) && c.rails && c.pointsSceneRelative) { const p = caps.get(c.cut); if (!p || p.capturedAt < c.capturedAt) caps.set(c.cut, c); } }
const q = (v, p) => { const s = v.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const out = fs.openSync(sortie, 'w'); let n = 0, ok = 0;
for (const cut of voulus) {
  const c = caps.get(cut); if (!c) continue;
  const cap = { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: Array.isArray(c.visibleByClipBoxes) ? c.visibleByClipBoxes : null, identity: c.identity };
  let sc; try { sc = Sh.scientificProposeBoth(cap); } catch (e) { continue; }
  for (const s of ['left', 'right']) {
    const r = R.find(x => x.cut === cut && x.cote === s); if (!r) continue; n++;
    const rail = sc.rails && sc.rails[s], cc = rail && rail.conventionCalibration; if (!cc || !cc.rawDelta) continue;
    const b = Conv.bandOffsets(cap, s, cc.rawDelta, {}); if (!b.ok) continue;
    const memeDz = Number.isFinite(r.dz) && Number.isFinite(cc.dzMm) && Math.abs(r.dz - cc.dzMm) <= 0.5; if (memeDz) ok++;
    fs.writeSync(out, JSON.stringify({ cut, cote: s, refuse: r.convRaison === 'shift-out-of-domain', vertOp: r.vert, latOp: r.lat, dzConsigne: r.dz, dz: r1(cc.dzMm), du: r1(cc.duMm), memeDz,
      topN: b.top.length, faceN: b.face.length, top10: r1(q(b.top, .1)), top25: r1(q(b.top, .25)), top50: r1(q(b.top, .5)), top75: r1(q(b.top, .75)), top90: r1(q(b.top, .9)), top97: r1(q(b.top, .97)),
      face50: r1(q(b.face, .5)), points: c.pointsSceneRelative.length }) + '\n');
  }
}
fs.closeSync(out); console.log(`${n} rails joints, ${ok} au même dz à 0,5 mm`);
