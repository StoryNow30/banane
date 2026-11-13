#!/usr/bin/env node
'use strict';
/* CH-121 : simulation STATIQUE d'un étage d'ajustement final sur les posés d'un rejeu du banc (sans ricochet sur les appuis : le rejeu du vrai code juge ensuite).
 * Hors ligne, lecture seule.
 *   node chantiers/CH-121/outils/simuler.cjs cache --nom livre --sortie CACHE.json [--tous]     (captures des posés jugés, ou de tous les posés)
 *   node chantiers/CH-121/outils/simuler.cjs juger --cache CACHE.json --etage ETAGE.cjs [--reglage JSON] [--lots …] [--detail]
 * ETAGE.cjs exporte ajuster(capture, decal{left,right} mm, reglage) → { decal, info }. Sortie : posés jugés, ≤ 10, 10-50, > 50, gagnés / perdus à 10 mm,
 * déplacement maximal, par lot. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const { LOTS, cle, travail } = require(path.join(RACINE, 'chantiers/CH-116/outils/lots.cjs'));
const D = require(path.join(RACINE, 'tools/diag-differes.cjs'));
const SIDES = ['left', 'right'];
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pire = (p, q) => Math.max(dist(p.left, q.left), dist(p.right, q.right));
const r1 = v => Math.round(v * 10) / 10;
function args(a) { const o = { mode: a[0], lots: null }; for (let i = 1; i < a.length; i++) { const k = a[i], v = () => a[++i];
  if (k === '--nom') o.nom = v(); else if (k === '--sortie') o.sortie = v(); else if (k === '--tous') o.tous = true; else if (k === '--cache') o.cache = v();
  else if (k === '--etage') o.etage = path.resolve(v()); else if (k === '--reglage') o.reglage = JSON.parse(v()); else if (k === '--lots') o.lots = v().split(',');
  else if (k === '--detail') o.detail = true; else if (k === '--json') o.json = v(); else throw Error('option ' + k); } return o; }
function cache(o) {
  const corpus = new Map(); for (const l of lireJsonl(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl'))) corpus.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
  const fd = fs.openSync(o.sortie, 'w'); let n = 0; fs.writeSync(fd, '[');
  for (const e of LOTS) {
    const k = cle(e), m = JSON.parse(fs.readFileSync(path.join(travail(), 'meta', k + '.json'), 'utf8'));
    const rej = lireJsonl(path.join(travail(), 'rejeux', o.nom, k + '.jsonl')).filter(x => x.type === 'cut');
    const lot = D.lotsDuJournal(JSON.parse(fs.readFileSync(m.journal, 'utf8'))).find(x => x.partie === e.partie && x.id === m.lotId);
    const idDe = new Map(lot.cuts.map(c => [c.cut, c.captureId]));
    const voulus = new Map();
    for (const x of rej) { const c = corpus.get(`${k}:${x.cut}`), p = x.profils && x.profils['L1-se'];
      if (!p || p.etat !== 'pose' || !p.decal) continue; const juge = !!(c && c.poseFinale && !c.exclu); if (!juge && !o.tous) continue;
      voulus.set(idDe.get(x.cut), { cle: k, lot: e.lot, partie: e.partie, cut: x.cut, zone: c ? c.zone : null, source: p.source, etage: p.etage, decal: p.decal, finale: juge ? c.poseFinale : null }); }
    for (const f of [].concat(m.captures)) { const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
      for (const c of doc.clouds || []) { const v = c && voulus.get(c.captureId); if (!v) continue;
        v.capture = { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: Array.isArray(c.visibleByClipBoxes) ? c.visibleByClipBoxes : null };
        fs.writeSync(fd, (n++ ? ',\n' : '') + JSON.stringify(v)); voulus.delete(c.captureId); } }
    process.stdout.write(`${k} : ${n} au cache\n`);
  }
  fs.writeSync(fd, ']'); fs.closeSync(fd);
}
function juger(o, items = JSON.parse(fs.readFileSync(o.cache, 'utf8'))) {
  const E = require(o.etage), parLot = {}, det = [];
  const T = () => ({ juges: 0, j10: 0, d1050: 0, p50: 0, gagnes: 0, perdus: 0, degradesJustes: 0, deplMax: 0, plus30: 0, bouges: 0, n50nouv: 0 });
  const tot = T();
  for (const it of items) {
    if (o.lots && !o.lots.includes(it.lot)) continue;
    const r = E.ajuster(it.capture, it.decal, o.reglage || {}), nd = r.decal;
    const depl = pire(nd, it.decal), t = (parLot[it.lot] = parLot[it.lot] || T());
    for (const x of [t, tot]) { x.deplMax = Math.max(x.deplMax, depl); if (depl > 30) x.plus30++; if (depl > 0.5) x.bouges++; }
    if (!it.finale) continue;
    const a = pire(it.decal, it.finale), b = pire(nd, it.finale);
    for (const x of [t, tot]) {
      x.juges++; if (b <= 10) x.j10++; else if (b <= 50) x.d1050++; else x.p50++;
      if (a > 10 && a <= 50 && b <= 10) x.gagnes++; if (a <= 10 && b > 10) { x.perdus++; x.degradesJustes++; } if (a <= 50 && b > 50) x.n50nouv++;
    }
    if (o.detail && (Math.abs(a - b) > 1 || (a > 10 && a <= 50))) det.push(`${it.cle} ${it.cut} ${it.zone} ${it.source}/${it.etage} ${r1(a)} → ${r1(b)} mm (déplacé ${r1(depl)}) ${r.info ? JSON.stringify(r.info) : ''}`);
  }
  const hors = x => x.j10 + x.d1050;
  const ligne = (n, x) => `| ${n} | ${x.juges} | ${x.j10} | ${x.d1050} | ${x.p50} | ${(100 * x.j10 / hors(x)).toFixed(1)} % | ${x.gagnes} / ${x.perdus} | ${x.n50nouv} | ${x.bouges} | ${r1(x.deplMax)} | ${x.plus30} |`;
  const out = ['| lot | jugés | ≤ 10 | 10–50 | > 50 | ≤ 10 hors > 50 | gagnés / perdus | nouv. > 50 | posés bougés > 0,5 | dépl. max | > 30 |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(parLot).map(([k, x]) => ligne(k, x)), ligne('**total**', tot)];
  return { texte: out.join('\n') + (det.length ? '\n\n' + det.join('\n') : ''), parLot, tot };
}
if (require.main === module) {
  const o = args(process.argv.slice(2));
  if (o.mode === 'cache') cache(o); else if (o.mode === 'juger') { const J = juger(o); console.log(J.texte); if (o.json) fs.writeFileSync(o.json, JSON.stringify({ parLot: J.parLot, tot: J.tot })); }
  else throw Error('mode : cache | juger');
}
module.exports = { juger };
