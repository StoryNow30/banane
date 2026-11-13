#!/usr/bin/env node
'use strict';
/* CH-125 : extraction, par rail posé et jugé, du nuage autour de la pose livrée (hors ligne, lecture seule ; sortie HORS dépôt).
 *   CH116_TRAVAIL=… node chantiers/CH-125/outils/extraire-rails.cjs --sortie DOSSIER [--lots 0411,0611,…] [--rejeu livre] [--tous]
 * Entrées : captures réduites et rejeu « livre » du banc de CH-116, corpus jugé (CH116_CORPUS ou travail/corpus.jsonl).
 * Par défaut, les 6 lots réglables seulement : le lot d'examen 05/11 n'est extrait que nommé par --lots (jamais pendant la conception).
 * Une ligne JSON par rail d'un cut posé par le rejeu livré (jugé au corpus ; `--tous` : tous les posés) :
 *   lot, partie, rang, cut, ordre, cote, zone, etage, source, signe, largeur (m), livre [u, z] (m, u orienté vers le champignon, depuis la pose de
 *   départ), finale [u, z] ou null, ref, classeLot, exclu, autre rail : `ecartementDepartMm` ; points : base64 d'un Float32Array [x, u, z, origine]…
 *   avec origine 0 = point visible de la coupe (celui que le moteur lit), 1 = point chargé hors de la découpe (|x| de 0,25 à 0,5 m), 2 = coupe
 *   voisine (cut ±1 ou ±2 du même lot, lu dans le repère du rail courant). Fenêtre : ±160 mm en travers, de −200 à +110 mm en hauteur autour de la pose
 *   livrée (patin compris), |x| ≤ 2,6 m. Aucun identifiant de lot, aucune coordonnée absolue. */
const fs = require('node:fs'), path = require('node:path');
const N = require('./nuage.cjs');
const { LOTS, cle, travail } = require(path.join(N.RACINE, 'chantiers', 'CH-116', 'outils', 'lots.cjs'));
const C = N.C, Conv = N.Conv, SIDES = ['left', 'right'];
const a = process.argv.slice(2), o = { lots: ['0411', '0611', '0811a', '0811b', '1111', '1211'], rejeu: 'livre', tous: false, sortie: null, voisins: 2 };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--lots') o.lots = v().split(','); else if (k === '--rejeu') o.rejeu = v(); else if (k === '--tous') o.tous = true; else if (k === '--sortie') o.sortie = v(); else if (k === '--voisins') o.voisins = Number(v()); else throw Error('option inconnue ' + k); }
if (!o.sortie) throw Error('--sortie DOSSIER (hors dépôt)');
fs.mkdirSync(o.sortie, { recursive: true });
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const corpus = new Map(); for (const l of lireJsonl(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl'))) corpus.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
const DU = 0.16, DZ_HAUT = 0.11, DZ_BAS = 0.20, DX = 2.6; /* la fenêtre descend jusqu'au patin (−153 mm) */

for (const e of LOTS.filter(x => o.lots.includes(x.lot) && !x.vierge)) {
  const k = cle(e), meta = JSON.parse(fs.readFileSync(path.join(travail(), 'meta', k + '.json'), 'utf8'));
  const caps = new Map();
  for (const f of [].concat(meta.captures)) { let d = JSON.parse(fs.readFileSync(f, 'utf8')); for (const c of d.clouds || []) if (c && c.rails && Array.isArray(c.pointsSceneRelative)) { const p = caps.get(c.cut); if (!p || String(p.capturedAt) < String(c.capturedAt)) caps.set(c.cut, c); } d = null; }
  const R = lireJsonl(path.join(travail(), 'rejeux', o.rejeu, k + '.jsonl')).filter(x => x.type === 'cut');
  const fd = fs.openSync(path.join(o.sortie, k + '.jsonl'), 'w'); let n = 0, nj = 0;
  R.forEach((l, ordre) => {
    const x = (l.profils || {})['L1-se'] || {}, c = corpus.get(`${k}:${l.cut}`), cap = caps.get(l.cut);
    if (x.etat !== 'pose' || !x.decal || !cap) return;
    const juge = !!(c && c.poseFinale && !c.exclu);
    if (!juge && !o.tous) return;
    for (const side of SIDES) {
      const rail = cap.rails[side], t = Conv.template(rail); if (!t) continue;
      const M = rail.sceneRelativeToProfileLocal, bu = t.sign * x.decal[side][1] / 1000, bz = x.decal[side][2] / 1000, pts = [];
      const o0 = C.point(M, rail.positionSceneRelative);
      const prendre = (K, origine) => { const P = K.pointsSceneRelative, V = K.visibleByClipBoxes;
        for (let i = 0; i < P.length; i++) { const s = P[i]; if (!Array.isArray(s) || !(s[0] === s[0])) continue; const q = C.point(M, s), xx = q[0] - o0[0], u = t.sign * (q[1] - o0[1]), z = q[2] - o0[2];
          if (Math.abs(u - bu) < DU && z - bz < DZ_HAUT && z - bz > -DZ_BAS && Math.abs(xx) <= DX) pts.push(xx, u, z, origine === 2 ? 2 : (V && V[i] === false ? 1 : 0)); } };
      prendre(cap, 0);
      for (let d = -o.voisins; d <= o.voisins; d++) { if (!d) continue; const v = caps.get(l.cut + d); if (v) prendre(v, 2); }
      const f32 = Float32Array.from(pts), fin = juge ? [t.sign * c.poseFinale[side][1] / 1000, c.poseFinale[side][2] / 1000] : null;
      const ligne = { lot: e.lot, partie: e.partie, rang: e.rang, cut: l.cut, ordre, cote: side, zone: l.zone || null, etage: x.etage || null, source: x.source || null, passe: !!(x.passe2 && Number.isInteger(x.passe2.passe)),
        signe: t.sign, largeur: t.width, livre: [bu, bz], finale: fin, ref: c ? c.ref : null, classeLot: c ? c.classe : null, exclu: c ? c.exclu : null, juge,
        ecartementDepartMm: l.ecartDepartMm ?? null, autreLivre: (() => { const s2 = side === 'left' ? 'right' : 'left'; return [x.decal[s2][1] / 1000, x.decal[s2][2] / 1000]; })(),
        n: f32.length / 4, points: Buffer.from(f32.buffer).toString('base64') };
      fs.writeSync(fd, JSON.stringify(ligne) + '\n'); n++; if (juge) nj++;
    }
  });
  fs.closeSync(fd);
  process.stdout.write(`${k} : ${n} rails extraits (${nj} jugés)\n`);
}
