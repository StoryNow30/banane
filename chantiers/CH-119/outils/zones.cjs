'use strict';
/* CH-119 : lecture d'un rejeu (patch banc-pool.patch, CH119_POOL=1) en suites de cuts, dans un repère commun. Hors ligne, lecture seule.
 * Un cut : géométrie de ses deux rails de départ (repère scène), sort au rejeu (L1-se), pool de la GCV2 (cuts ADV), vérité du corpus.
 * `enRepere(cutCible, cutSource, side, decal)` : un décalage [long, lat, vert] (mm) du cut source, lu dans le repère profil du rail de départ du
 * cut cible ([long, lat, vert], mm, origine = pose de départ du cut cible). */
const fs = require('node:fs'), path = require('node:path');
const C = require('../../../vendor/capture-core.js');
const { LOTS, cle, travail } = require('../../CH-116/outils/lots.cjs');
const SIDES = ['left', 'right'];
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function scene(geo, side, decal) {
  const g = geo[side]; if (!g.inv) g.inv = C.inverse(g.M);
  const w = C.point(g.inv, decal.map(v => v / 1000)), o = C.point(g.inv, [0, 0, 0]);
  return g.o.map((v, i) => v + w[i] - o[i]);
}
function local(geo, side, p) { const g = geo[side], q = C.point(g.M, p), o = C.point(g.M, g.o); return [0, 1, 2].map(i => 1000 * (q[i] - o[i])); }
function chargerCorpus() { return new Map(lire(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl')).map(l => [`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l])); }
const jugeable = c => !!(c && c.poseFinale && (!c.exclu || /^d285-/.test(c.exclu)));
/* Les lots-parties d'un rejeu : [{ e, cuts:[{ cut, zone, geo, etat, source, decal, pool, verite, classeCorpus, sortLot }] }] (ordre du lot). */
function charger(nom, { lots = null, corpus = chargerCorpus() } = {}) {
  const out = [];
  for (const e of LOTS) {
    if (lots && !lots.includes(e.lot)) continue;
    const f = path.join(travail(), 'rejeux', nom, cle(e) + '.jsonl'); if (!fs.existsSync(f)) continue;
    const cuts = [];
    for (const l of lire(f)) {
      if (l.type !== 'cut') continue;
      const x = (l.profils || {})['L1-se'] || {}, c = corpus.get(`${cle(e)}:${l.cut}`);
      cuts.push({ cut: l.cut, zone: l.zone || null, geo: l.geo || null, etat: x.etat, source: x.source || null, etage: x.etage || null, decal: x.etat === 'pose' && x.decal ? x.decal : null,
        pool: l.pool && !l.pool.erreur ? l.pool : null, verite: jugeable(c) ? c.poseFinale : null, classeCorpus: c ? c.classe : null, sortLot: c ? c.sortLot : null, reel: l.reel });
    }
    out.push({ e, cle: cle(e), cuts });
  }
  return out;
}
function enRepere(cible, source, side, decal) { if (!cible.geo || !source.geo || !decal) return null; return local(cible.geo, side, scene(source.geo, side, decal)); }
module.exports = { charger, enRepere, scene, local, d3, SIDES, chargerCorpus, jugeable };
