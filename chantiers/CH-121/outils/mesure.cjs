#!/usr/bin/env node
'use strict';
/* CH-121 : mesure, pour chaque posé jugé d'un rejeu du banc de CH-116, de l'erreur par rail (latéral, vertical) et de ce que dit le nuage autour de la pose.
 * Hors ligne, lecture seule ; rien n'est commandé dans ESV.
 *   CH116_TRAVAIL=… CH116_CORPUS=… node chantiers/CH-121/outils/mesure.cjs --nom livre [--lots 1111,1211] --sortie M.jsonl
 * Par rail : erreur = pose finale de l'opérateur − pose du rejeu (mm, repère profil de la pose de départ : [long, lat, vert]) ; nuage à la pose du rejeu :
 * points de dessus et de flanc dans la bande du gabarit (`placement-convention.js` `bandOffsets`), quantiles des écarts au gabarit, densité de la bande,
 * points du rail. Sorties : numéros de cut et millimètres seulement. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const { LOTS, cle, travail } = require(path.join(RACINE, 'chantiers/CH-116/outils/lots.cjs'));
const D = require(path.join(RACINE, 'tools/diag-differes.cjs'));
const Conv = require(path.join(RACINE, 'src/placement-convention.js'));
const SIDES = ['left', 'right'];
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r1 = v => v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
function args(a) { const o = { nom: 'livre', lots: null }; for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i];
  if (k === '--nom') o.nom = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--sortie') o.sortie = v(); else if (k === '--tous') o.tous = true; else throw Error('option ' + k); } return o; }
function capturesDe(m, ids) {
  const out = new Map(), voulu = new Set(ids);
  for (const f of [].concat(m.captures)) { const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const c of doc.clouds || []) if (c && voulu.has(c.captureId) && c.rails && Array.isArray(c.pointsSceneRelative))
      out.set(c.captureId, { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: Array.isArray(c.visibleByClipBoxes) ? c.visibleByClipBoxes : null }); }
  return out;
}
/* Ce que dit le nuage autour d'un rail posé au décalage `d` (mm). */
function nuage(capture, s, d) {
  const b = Conv.bandOffsets(capture, s, d.map(v => v / 1000), {});
  if (!b.ok) return { ok: false, raison: b.reason };
  return { ok: true, sign: b.sign, topN: b.top.length, faceN: b.face.length, top50: r1(q(b.top, .5)), top90: r1(q(b.top, .9)), face25: r1(q(b.face, .25)), face50: r1(q(b.face, .5)),
    dzConv: r1(q(b.top, .9) + 1), duConv: b.face.length >= 6 ? r1(q(b.face, .5) - 2.6) : null };
}
function main() {
  const o = args(process.argv.slice(2)), corpus = new Map();
  for (const l of lireJsonl(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl'))) corpus.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
  const out = fs.openSync(o.sortie, 'w');
  for (const e of LOTS.filter(e => !o.lots || o.lots.includes(e.lot))) {
    const k = cle(e), m = JSON.parse(fs.readFileSync(path.join(travail(), 'meta', k + '.json'), 'utf8'));
    const fr = path.join(travail(), 'rejeux', o.nom, k + '.jsonl'); if (!fs.existsSync(fr)) continue;
    const rej = lireJsonl(fr).filter(x => x.type === 'cut');
    const lot = D.lotsDuJournal(JSON.parse(fs.readFileSync(m.journal, 'utf8'))).find(x => x.partie === e.partie && x.id === m.lotId);
    const idDe = new Map(lot.cuts.map(c => [c.cut, c.captureId]));
    const voulus = rej.filter(x => { const c = corpus.get(`${k}:${x.cut}`), p = x.profils && x.profils['L1-se']; return c && p && p.etat === 'pose' && p.decal && (o.tous || (c.poseFinale && !c.exclu)); });
    const caps = capturesDe(m, voulus.map(x => idDe.get(x.cut)).filter(Boolean));
    for (const x of voulus) {
      const c = corpus.get(`${k}:${x.cut}`), p = x.profils['L1-se'], cap = caps.get(idDe.get(x.cut));
      const ligne = { cle: k, lot: e.lot, partie: e.partie, cut: x.cut, zone: c.zone, etage: p.etage || p.source, source: p.source, points: cap ? cap.pointsSceneRelative.length : 0, rails: {} };
      let pire = 0;
      for (const s of SIDES) {
        const err = c.poseFinale ? [0, 1, 2].map(i => r1(c.poseFinale[s][i] - p.decal[s][i])) : null;
        if (err) pire = Math.max(pire, Math.hypot(...err));
        ligne.rails[s] = { decal: p.decal[s], err, nuage: cap ? nuage(cap, s, p.decal[s]) : null };
      }
      ligne.pire = c.poseFinale ? r1(pire) : null;
      fs.writeSync(out, JSON.stringify(ligne) + '\n');
    }
    process.stdout.write(`${k} : ${voulus.length} posés mesurés\n`);
  }
  fs.closeSync(out);
}
module.exports = { nuage };
if (require.main === module) main();
