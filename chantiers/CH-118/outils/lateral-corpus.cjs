/* CH-118 — biais latéral à un rail, lu dans le corpus de CH-116 (corpus.jsonl). Lecture seule.
 *   node chantiers/CH-118/outils/lateral-corpus.cjs corpus.jsonl [--avec-examen] [--csv sortie.csv]
 * Écart par rail = pose finale − pose d'Ariane, [long, lat, vert] mm, repère profil de la pose de départ. Écartement (calibré sur les jointures
 * des 11 et 12/11, à 1 mm près) = écartement de départ − (lat droit − lat gauche) ; « vers l'intérieur » : −lat à gauche, +lat à droite.
 * Le lot d'examen 0511 (D-285) est exclu sauf `--avec-examen`. Sortie : comptes, millimètres, numéros de cut. */
'use strict';
const fs = require('fs');
const a = process.argv.slice(2); const avecEx = a.includes('--avec-examen'); const ic = a.indexOf('--csv'), csv = ic >= 0 ? a[ic + 1] : null;
const C = fs.readFileSync(a[0], 'utf8').trim().split('\n').map(JSON.parse).filter(c => avecEx || !c.examen);
const q = (v, p) => { const s = v.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p, lo = Math.floor(k); return s[lo] + (s[Math.ceil(k)] - s[lo]) * (k - lo); };
const f1 = v => Number.isFinite(v) ? v.toFixed(1) : '';
const J = [];
for (const c of C) {
  if (c.sortLot !== 'pose' || !c.poseFinale || !c.poseAriane || !['juste', '10-50'].includes(c.classe) || c.exclu) continue;
  const e = s => c.poseFinale[s].map((v, i) => v - c.poseAriane[s][i]);
  const L = e('left'), R = e('right'), d3 = v => Math.hypot(...v);
  const ecA = c.ecartementDepartMm - (c.poseAriane.right[1] - c.poseAriane.left[1]), ecF = c.ecartementDepartMm - (c.poseFinale.right[1] - c.poseFinale.left[1]);
  const pire = d3(L) >= d3(R) ? 'left' : 'right', P = pire === 'left' ? L : R, A = pire === 'left' ? R : L;
  J.push({ lot: c.lot, partie: c.partie, cut: c.cut, zone: c.zone, etage: c.chemin && c.chemin.etage, pts: c.points, max: Math.max(d3(L), d3(R)), pire,
    latP: P[1], vertP: P[2], autre: d3(A), interieur: pire === 'left' ? -P[1] : P[1], ecA, ecF, dEc: ecF - ecA, poseApresLot: c.poseApresLot });
}
const unRail = J.filter(j => j.max > 5 && Math.abs(j.latP) > Math.abs(j.vertP) && j.autre < 2);
console.log(`posés jugés (hors mauvaise voie${avecEx ? '' : ', hors examen 0511'}) : ${J.length} ; > 5 mm : ${J.filter(j => j.max > 5).length} ; latéral à un rail (> 5, latéral dominant, autre rail < 2 mm) : ${unRail.length}`);
const grp = (nom, L) => console.log(`${nom.padEnd(36)} n ${String(L.length).padStart(3)} | vers l'intérieur : ${L.filter(j => j.interieur > 0).length} / extérieur ${L.filter(j => j.interieur < 0).length} | Δécart méd ${f1(q(L.map(j => j.dEc), .5))} | écart. Ariane méd ${f1(q(L.map(j => j.ecA), .5))} → opérateur ${f1(q(L.map(j => j.ecF), .5))} | |lat| méd ${f1(q(L.map(j => Math.abs(j.latP)), .5))}`);
grp('tous les latéraux à un rail', unRail);
for (const k of ['etage', 'zone', 'pire', 'lot']) for (const v of [...new Set(unRail.map(j => j[k]))]) grp(`${k} = ${v}`, unRail.filter(j => j[k] === v));
grp('écartement Ariane > 1440', unRail.filter(j => j.ecA > 1440)); grp('écartement Ariane ≤ 1440', unRail.filter(j => j.ecA <= 1440));
// contraste : les justes ≤ 2 mm, écartement d'Ariane
const ok = J.filter(j => j.max <= 2);
console.log(`\ncontraste justes ≤ 2 mm : n ${ok.length}, écartement Ariane méd ${f1(q(ok.map(j => j.ecA), .5))} [${f1(q(ok.map(j => j.ecA), .1))} ; ${f1(q(ok.map(j => j.ecA), .9))}] ; latéraux à un rail : écartement Ariane [${f1(q(unRail.map(j => j.ecA), .1))} ; ${f1(q(unRail.map(j => j.ecA), .9))}], opérateur [${f1(q(unRail.map(j => j.ecF), .1))} ; ${f1(q(unRail.map(j => j.ecF), .9))}]`);
if (csv) { const k = Object.keys(J[0]); fs.writeFileSync(csv, k.join(';') + '\n' + J.map(j => k.map(x => typeof j[x] === 'number' ? f1(j[x]) : j[x]).join(';')).join('\n') + '\n'); }
