/* CH-118 — traits du moteur par cut et par rail, lus dans un journal de lot (lecture seule).
 *   node chantiers/CH-118/outils/traits-journal.cjs --journal J.json --partie N --sortie T.json
 * Pour chaque cut de la partie : la dernière ombre GCV1 (`gcv1-shadow-observed`) et, par rail, l'état du calage
 * « convention » (appliqué ou non, raison, du/dz proposés), points locaux, palier de la face, confiance, écartement prédit ;
 * le chemin de décision (`b1-ombre`, stage) et la zone (`regles-metier-ombre`, portée cut). Sortie : millimètres, numéros de cut. */
'use strict';
const fs = require('fs');
const a = process.argv.slice(2), o = {}; for (let i = 0; i < a.length; i += 2) o[a[i].slice(2)] = a[i + 1];
const J = JSON.parse(fs.readFileSync(o.journal, 'utf8')), partie = Number(o.partie), out = {};
const de = e => e.identity && e.identity.part === partie ? e.identity.cut : null;
const ts = e => Date.parse(e.timestamp || e.shadow && e.shadow.observedAt || 0);
for (const e of J.events) {
  const c = de(e); if (c == null) continue; const r = (out[c] = out[c] || { cut: c });
  if (e.type === 'gcv1-shadow-observed' && (!r._t || ts(e) >= r._t)) {
    r._t = ts(e); const R = {};
    for (const s of ['left', 'right']) { const x = e.shadow.rails && e.shadow.rails[s]; if (!x) continue; const cc = x.conventionCalibration || {};
      R[s] = { pts: x.frame && x.frame.pointsLocal, signe: x.frame && x.frame.sign, statut: x.next && x.next.status, palier: x.next && x.next.pick && x.next.pick.tier,
        conf: x.astar && x.astar.confidence, conv: !!cc.applied, convRaison: cc.reason || null, duMm: cc.duMm, dzMm: cc.dzMm, topN: cc.topN, faceN: cc.faceN,
        faible: !!x.publishedWeak, nextDelta: x.next && x.next.delta, convDelta: cc.delta, flancPartiel: !!x.partialFlankUsed, nClusters: x.next && x.next.nClusters };
    }
    r.rails = R; r.ecartementPreditMm = e.shadow.pairGauge && e.shadow.pairGauge.predictedMm;
  }
  if (e.type === 'b1-ombre' && e.reel) { r.stage = e.reel.stage; r.raison = e.reel.reason; r.appuis = e.reel.anchorsUsed ? e.reel.anchorsUsed.length : 0; }
  if (e.type === 'regles-metier-ombre' && e.portee === 'cut') { r.zone = e.zone ? (e.zone.pn ? 'pn' : e.zone.adv || 'courante') : null; r.flushPct = e.surface && e.surface.flushPct; r.ecartementReelMm = e.reel && e.reel.ecartementMm; }
}
for (const k in out) delete out[k]._t;
fs.writeFileSync(o.sortie, JSON.stringify(out));
console.log(Object.keys(out).length, 'cuts');
