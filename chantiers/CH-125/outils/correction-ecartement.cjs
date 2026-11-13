#!/usr/bin/env node
'use strict';
/* CH-125 : la correction d'écartement de L1-e (rail déplacé pour prendre l'écartement de la liste) contre la pose finale de l'opérateur.
 *   CH116_TRAVAIL=… node chantiers/CH-125/outils/correction-ecartement.cjs [--lots …] [--rejeu livre]
 * Pour chaque cut jugé dont la pose du rejeu vient de la GCV2 ou de la chaîne refaite avec une correction d'écartement CONSIGNÉE (anomalie) : écart à la
 * pose finale (pire rail, 3D) de la paire posée et de la paire d'avant la correction (`test13.paire` pour la GCV2 ; pose − correction pour la chaîne),
 * écart de l'écartement à la référence, et l'écartement de la pose finale de l'opérateur. Hors ligne ; numéros de cut et millimètres. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const { LOTS, cle, travail } = require(path.join(RACINE, 'chantiers', 'CH-116', 'outils', 'lots.cjs'));
const a = process.argv.slice(2), o = { lots: ['0411', '0611', '0811a', '0811b', '1111', '1211'], rejeu: 'livre' };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--lots') o.lots = v().split(','); else if (k === '--rejeu') o.rejeu = v(); else throw Error('option inconnue ' + k); }
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const corpus = new Map(); for (const l of lire(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl'))) corpus.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
const pire = (p, q) => Math.max(...['left', 'right'].map(s => Math.hypot(p[s][0] - q[s][0], p[s][1] - q[s][1], p[s][2] - q[s][2])));
const r1 = v => v == null ? '' : Math.round(v * 10) / 10;
const L = [];
for (const e of LOTS.filter(x => o.lots.includes(x.lot) && !x.vierge)) {
  const k = cle(e);
  for (const l of lire(path.join(travail(), 'rejeux', o.rejeu, k + '.jsonl')).filter(x => x.type === 'cut')) {
    const x = l.profils['L1-se'], c = corpus.get(`${k}:${l.cut}`); if (!x || x.etat !== 'pose' || !x.decal) continue;
    const cor = x.l1 ? x.l1.correction : x.correction; if (!cor || !cor.anomalie) continue;
    const juge = c && c.poseFinale && !c.exclu;
    let avant = null;
    if (x.l1 && x.l1.test13 && x.l1.test13.paire) avant = x.l1.test13.paire;
    else if (x.correction && x.correction.appliquee && x.correction.rail) { avant = { left: x.decal.left.slice(), right: x.decal.right.slice() }; /* la correction a déplacé `rail` en travers de ± écart : sens inconnu ici, on essaie les deux */ avant._ambigu = true; }
    L.push({ lot: e.lot, partie: e.partie, cut: l.cut, zone: l.zone, source: x.source, etage: x.etage, motif: x.l1 ? x.l1.motif : null, hyp: x.l1 ? x.l1.hypothese : null, cor, juge,
      apres: juge ? pire(x.decal, c.poseFinale) : null,
      avant: juge && avant ? (avant._ambigu ? Math.min(...[1, -1].map(sg => { const d = { left: x.decal.left.slice(), right: x.decal.right.slice() }; d[cor.rail][1] += sg * cor.ecartMm; return pire(d, c.poseFinale); })) : pire(avant, c.poseFinale)) : null,
      deplace: avant && !avant._ambigu ? pire(avant, x.decal) : (cor.appliquee ? Math.abs(cor.ecartMm) : 0), gOp: juge && Number.isFinite(l.ecartDepartMm) ? null : null });
  }
}
const J = L.filter(l => l.juge);
console.log(`Poses du rejeu avec une anomalie d'écartement consignée : ${L.length} (correction appliquée ${L.filter(l => l.cor.appliquee).length}) ; jugées ${J.length} (appliquée ${J.filter(l => l.cor.appliquee).length}).`);
console.log('lot partie/cut | zone | source/étage | hypothèse, motif | référence − écartement mm | rail | soutenue | appliquée | écart à l\'opérateur : avant la correction → après');
for (const l of J) console.log(`${l.lot} ${l.partie}/${l.cut} | ${l.zone} | ${l.source}/${l.etage} | ${l.hyp || ''} ${l.motif || ''} | ${l.cor.ecartMm} | ${l.cor.rail} | ${l.cor.soutenue} | ${l.cor.appliquee} | ${r1(l.avant)} → ${r1(l.apres)}`);
const A = J.filter(l => l.cor.appliquee && l.avant != null);
console.log(`Correction appliquée et jugée : ${A.length} ; mieux après (> 2 mm) ${A.filter(l => l.apres < l.avant - 2).length}, pire après ${A.filter(l => l.apres > l.avant + 2).length}, égal ${A.filter(l => Math.abs(l.apres - l.avant) <= 2).length} ; ≤ 10 mm avant ${A.filter(l => l.avant <= 10).length}, après ${A.filter(l => l.apres <= 10).length}.`);
