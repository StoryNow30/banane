#!/usr/bin/env node
'use strict';
/* CH-125 : combien de rails posés ont moins de 6 points de flanc, et combien en gagnent assez avec plus de nuage ? (hors ligne, lecture seule)
 *   CH116_TRAVAIL=… node chantiers/CH-125/outils/flanc-compte.cjs [--lots …] [--rejeu livre]
 * Pour chaque rail d'un cut posé par le rejeu livré (jugé ou non), à la pose livrée, points de la bande du flanc (définition du calage livré) :
 *   a) points visibles de la coupe (ce que lit le moteur) ; b) tous les points chargés de la capture (±0,5 m) ; c) avec les coupes voisines du même
 *   lot (cut ±1, puis ±2), lues dans le repère du rail, le rail suivi en ligne droite jusqu'à la pose livrée du voisin. Comptes seulement. */
const fs = require('node:fs'), path = require('node:path');
const N = require('./nuage.cjs');
const { LOTS, cle, travail } = require(path.join(N.RACINE, 'chantiers', 'CH-116', 'outils', 'lots.cjs'));
const C = N.C, Conv = N.Conv, SIDES = ['left', 'right'];
const a = process.argv.slice(2), o = { lots: ['0411', '0611', '0811a', '0811b', '1111', '1211'], rejeu: 'livre' };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--lots') o.lots = v().split(','); else if (k === '--rejeu') o.rejeu = v(); else throw Error('option inconnue ' + k); }
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const T = {}, add = (g, k, v = 1) => { T[g] = T[g] || {}; T[g][k] = (T[g][k] || 0) + v; };
for (const e of LOTS.filter(x => o.lots.includes(x.lot) && !x.vierge)) {
  const k = cle(e), meta = JSON.parse(fs.readFileSync(path.join(travail(), 'meta', k + '.json'), 'utf8')), caps = new Map();
  for (const f of [].concat(meta.captures)) { let d = JSON.parse(fs.readFileSync(f, 'utf8')); for (const c of d.clouds || []) if (c && c.rails && Array.isArray(c.pointsSceneRelative)) { const p = caps.get(c.cut); if (!p || String(p.capturedAt) < String(c.capturedAt)) caps.set(c.cut, c); } d = null; }
  const R = new Map(lire(path.join(travail(), 'rejeux', o.rejeu, k + '.jsonl')).filter(x => x.type === 'cut').map(l => [l.cut, l]));
  for (const [cut, l] of R) {
    const x = l.profils['L1-se'], cap = caps.get(cut); if (!x || x.etat !== 'pose' || !x.decal || !cap) continue;
    for (const side of SIDES) {
      const rail = cap.rails[side], t = Conv.template(rail); if (!t) continue;
      const M = rail.sceneRelativeToProfileLocal, o0 = C.point(M, rail.positionSceneRelative), bu = t.sign * x.decal[side][1] / 1000, bz = x.decal[side][2] / 1000;
      const compter = (K, visibles, pente) => { let n = 0; const P = K.pointsSceneRelative, V = K.visibleByClipBoxes;
        for (let i = 0; i < P.length; i++) { if (visibles && V && V[i] === false) continue; const s = P[i]; if (!Array.isArray(s) || !(s[0] === s[0])) continue; const q = C.point(M, s), xx = q[0] - o0[0];
          const lu = t.sign * (q[1] - o0[1]) - bu - pente[0] * xx, lz = q[2] - o0[2] - bz - pente[1] * xx;
          if (lz < -0.009 && lz > -0.034 && Math.abs(lu) < 0.012) { const u = t.faceAt(lz); if (u !== null && Math.abs(lu - u) < 0.012) n++; } }
        return n; };
      const nVis = compter(cap, true, [0, 0]), nChg = compter(cap, false, [0, 0]);
      const voisin = d => { const kv = caps.get(cut + d), lv = R.get(cut + d); if (!kv) return null; let pente = [0, 0];
        const xv = lv && lv.profils['L1-se']; if (xv && xv.etat === 'pose' && xv.decal) { const rv = kv.rails[side], pv = C.point(rv.profileLocalToSceneRelative, C.point(rv.sceneRelativeToProfileLocal, rv.positionSceneRelative).map((v, i) => v + xv.decal[side][i] / 1000)), q = C.point(M, pv);
          const xx = q[0] - o0[0]; if (Math.abs(xx) > 0.3) pente = [(t.sign * (q[1] - o0[1]) - bu) / xx, (q[2] - o0[2] - bz) / xx]; }
        return compter(kv, false, pente); };
      const v1 = [voisin(-1), voisin(1)], v2 = [voisin(-2), voisin(2)], n1 = nChg + v1.reduce((s, v) => s + (v || 0), 0), n2 = n1 + v2.reduce((s, v) => s + (v || 0), 0);
      for (const g of [e.lot, 'total']) { add(g, 'rails'); if (nVis < 6) { add(g, 'sous6'); if (nVis === 0) add(g, 'zero'); if (nChg >= 6) add(g, 'charges6'); if (v1.some(v => v !== null)) add(g, 'aVoisin1'); if (n1 >= 6) add(g, 'voisins1_6'); if (n2 >= 6) add(g, 'voisins2_6'); } }
    }
  }
}
console.log('| lot | rails posés lus | flanc < 6 points visibles | dont 0 point | atteignent 6 avec les points chargés (±0,5 m) | ont une coupe voisine ±1 au lot | atteignent 6 avec ±1 | avec ±2 |\n|---|---|---|---|---|---|---|---|');
for (const [g, t] of Object.entries(T)) console.log(`| ${g} | ${t.rails} | ${t.sous6 || 0} | ${t.zero || 0} | ${t.charges6 || 0} | ${t.aVoisin1 || 0} | ${t.voisins1_6 || 0} | ${t.voisins2_6 || 0} |`);
