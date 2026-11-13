#!/usr/bin/env node
'use strict';
/* CH-121 : garde statique du 14/10 partie 17 (lot Pilote 4.9.0.12) pour un réglage de l'étage (`ajusterPoseFinale` de la copie CH121_CODE).
 * Hors ligne, lecture seule. Pose d'Ariane de chaque rail = rail publié par le GCV1 d'aujourd'hui sur la dernière capture du cut (calé, ou brut si le
 * calage est refusé) ; contrôle : dz d'aujourd'hui = dz consigné à 0,5 mm (cut écarté sinon). Erreur après = erreur consignée (rails-1410-p17.csv,
 * opérateur − Ariane, repère profil) − déplacement de l'étage. Cuts jugés aux deux rails ; pire rail 3D.
 *   CH121_CODE=… node chantiers/CH-121/outils/oct-garde.cjs --corpus SEG … --rails rails-1410-p17.csv --reglage JSON [--detail] */
const fs = require('node:fs'), path = require('node:path');
const RACINE = process.env.CH121_CODE || path.join(__dirname, '..', '..', '..');
const Sh = require(path.join(RACINE, 'src/gcv1-shadow.js')), G = require(path.join(RACINE, 'src/gcv2-l1.js'));
const a = process.argv.slice(2), corpus = []; let rails, R = {}, detail = false;
for (let i = 0; i < a.length; i++) { if (a[i] === '--corpus') corpus.push(a[++i]); else if (a[i] === '--rails') rails = a[++i]; else if (a[i] === '--reglage') R = JSON.parse(a[++i]); else if (a[i] === '--detail') detail = true; else throw Error(a[i]); }
const t = fs.readFileSync(rails, 'utf8').trim().split('\n'), h = t[0].split(';');
const Rw = t.slice(1).map(l => Object.fromEntries(l.split(';').map((v, i) => [h[i], v === '' || isNaN(+v) ? v : +v])));
const parCut = new Map(); for (const r of Rw) { if (!parCut.has(r.cut)) parCut.set(r.cut, {}); parCut.get(r.cut)[r.cote] = r; }
const caps = new Map();
for (const f of corpus) { const d = JSON.parse(fs.readFileSync(f, 'utf8')); for (const c of d.clouds || []) if (c && parCut.has(c.cut) && c.rails && c.pointsSceneRelative) { const p = caps.get(c.cut); if (!p || p.capturedAt < c.capturedAt) caps.set(c.cut, c); } }
const r1 = v => Math.round(v * 10) / 10;
let juges = 0, ecartes = 0, av10 = 0, ap10 = 0, gagnes = 0, perdus = [], p20 = [], deg5 = [], bouges = 0, dmax = 0; const lignes = [];
for (const [cut, c] of parCut) {
  if (!c.left || !c.right) continue; const k = caps.get(cut); if (!k) { ecartes++; continue; }
  const cap = { rails: k.rails, pointsSceneRelative: k.pointsSceneRelative, visibleByClipBoxes: Array.isArray(k.visibleByClipBoxes) ? k.visibleByClipBoxes : null, identity: k.identity };
  let sc; try { sc = Sh.scientificProposeBoth(cap); } catch { ecartes++; continue; }
  const decal = {}; let ok = true;
  for (const s of ['left', 'right']) { const rail = sc.rails[s], cc = rail && rail.conventionCalibration; if (!rail || !cc || !Array.isArray(cc.delta) || !(Math.abs((cc.dzMm ?? NaN) - c[s].dz) <= 0.5)) { ok = false; break; } decal[s] = cc.delta.map(v => v * 1000); }
  if (!ok) { ecartes++; continue; }
  juges++;
  const r = G.ajusterPoseFinale(cap, decal, R), D = s => [0, 1, 2].map(i => r.decal[s][i] - decal[s][i]);
  let av = 0, ap = 0, depl = 0;
  for (const s of ['left', 'right']) { const x = c[s], lon = Math.sqrt(Math.max(0, x.d3 ** 2 - x.lat ** 2 - x.vert ** 2)), d = D(s);
    av = Math.max(av, x.d3); ap = Math.max(ap, Math.hypot(lon, x.lat - d[1], x.vert - d[2])); depl = Math.max(depl, Math.hypot(...d)); }
  if (depl > 0.5) bouges++; dmax = Math.max(dmax, depl);
  if (av <= 10) av10++; if (ap <= 10) ap10++; if (av > 10 && ap <= 10) gagnes++; if (av <= 10 && ap > 10) perdus.push(`${cut} ${r1(av)}→${r1(ap)}`);
  if (av <= 20 && ap > 20) p20.push(`${cut} ${r1(av)}→${r1(ap)}`); if (ap > av + 5) deg5.push(`${cut} ${r1(av)}→${r1(ap)}`);
  if (detail && depl > 0.5) lignes.push(`${cut} ${r1(av)} → ${r1(ap)} mm (déplacé ${r1(depl)}) ${JSON.stringify(r.info)}`);
}
console.log(`14/10 p17, réglage ${JSON.stringify(R)} : cuts jugés ${juges} (écartés ${ecartes}) ; ≤ 10 mm ${av10} → ${ap10} ; gagnés ${gagnes} / perdus ${perdus.length} [${perdus.join(', ')}] ; passés au-delà de 20 mm ${p20.length} [${p20.join(', ')}] ; dégradés de plus de 5 mm ${deg5.length} [${deg5.join(', ')}] ; posés déplacés ${bouges}, au plus ${r1(dmax)} mm`);
if (detail) console.log(lignes.join('\n'));
