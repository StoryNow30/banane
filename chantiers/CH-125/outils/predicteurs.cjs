#!/usr/bin/env node
'use strict';
/* CH-125 : quel ajustement du gabarit prédit le mieux la pose de l'opérateur ? (hors ligne, lecture seule ; statique, depuis la pose livrée)
 *   node chantiers/CH-125/outils/predicteurs.cjs --rails DOSSIER --gabarit G.json [--lots …]
 * Pour chaque prédicteur P (ajustement robuste du gabarit sur un choix de surfaces ; enveloppe du dessus ; médianes), l'écart (pose finale − P),
 * hauteur et travers, sur les rails RETOUCHÉS de l'axe (> 2 mm) : médiane, étendue q75 − q25, écart absolu médian autour de la médiane, et part
 * des rails à plus de 5 mm de la médiane (queue). Le meilleur prédicteur est le plus resserré. Rien n'est appris ici ; comptes et millimètres. */
const R = require('./rails.cjs'), E = require('./estimateurs.cjs'), Ch = require('./champ.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = { lots: R.LOTS_REGLABLES };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--lots') o.lots = v().split(','); else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), champ = Ch.construire(gab.contour, gab.largeur), rails = R.lire(o.rails, { lots: o.lots }).filter(r => r.classeLot !== 'mauvaise-voie');
const med = N.mediane, q = N.quantile, r1 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 10;
const W = (...s) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => [k, s.includes(k) ? 1 : 0]));
const P = {
  'pose livrée': r => ({ pose: r.livre, ok: true }),
  'dessus : médiane (point fixe)': r => { const m = E.centreBandes(r.pts, gab, r.livre, { origines: [0], xMax: .25, lateral: false }); return { pose: m.pose, ok: m.deplaceVert }; },
  'dessus : 8e plus haut': r => { const m = E.enveloppeDessus(r.pts, gab, r.livre, { k: 8 }); return { pose: m.pose, ok: m.ok }; },
  'gabarit : champignon (dessus, congés, flancs)': r => { const m = Ch.ajuster(r.pts, champ, r.livre, { poids: W(1, 2, 3, 4, 5) }); return { pose: m.pose, ok: !!m.cov && m.converge, m }; },
  'gabarit : champignon côté voie (dessus, congé et flanc voie)': r => { const m = Ch.ajuster(r.pts, champ, r.livre, { poids: W(1, 2, 3) }); return { pose: m.pose, ok: !!m.cov && m.converge, m }; },
  'gabarit : champignon + patin': r => { const m = Ch.ajuster(r.pts, champ, r.livre, { poids: W(1, 2, 3, 4, 5, 8, 9) }); return { pose: m.pose, ok: !!m.cov && m.converge, m }; },
  'gabarit : patin seul (hauteur) ': r => { const m = Ch.ajuster(r.pts, champ, r.livre, { poids: W(8, 9), axes: 'z' }); return { pose: m.pose, ok: !!m.cov && m.converge && m.n >= 30, m }; },
  'gabarit : flancs et patin (sans le dessus)': r => { const m = Ch.ajuster(r.pts, champ, r.livre, { poids: W(3, 5, 8, 9) }); return { pose: m.pose, ok: !!m.cov && m.converge && m.n >= 30, m }; },
  'gabarit : champignon + patin, points chargés': r => { const m = Ch.ajuster(r.pts, champ, r.livre, { poids: W(1, 2, 3, 4, 5, 8, 9), origines: [0, 1], xMax: 0.5 }); return { pose: m.pose, ok: !!m.cov && m.converge, m }; },
};
const res = {}; for (const [k, f] of Object.entries(P)) res[k] = rails.map(r => ({ r, ...f(r) }));
const ligne = (nom, v) => { v = v.filter(Number.isFinite); if (v.length < 5) return `| ${nom} | ${v.length} | | | | | |`; const m = med(v); return `| ${nom} | ${v.length} | ${r1(m)} | ${r1(q(v, .75) - q(v, .25))} | ${r1(med(v.map(x => Math.abs(x - m))))} | ${(100 * v.filter(x => Math.abs(x - m) > 5).length / v.length).toFixed(0)} % | ${r1(q(v, .05))} … ${r1(q(v, .95))} |`; };
const ENT = '| prédicteur | rails | médiane de (finale − P) | q75 − q25 | écart abs. médian | à plus de 5 mm de la médiane | q5 … q95 |\n|---|---|---|---|---|---|---|';
const retV = r => Math.abs(r.finale[1] - r.livre[1]) > 0.002, retL = r => Math.abs(r.finale[0] - r.livre[0]) > 0.002;
const out = [`Rails jugés : ${rails.length} ; retouchés en hauteur ${rails.filter(retV).length}, en travers ${rails.filter(retL).length}.`, '', 'HAUTEUR, rails retouchés en hauteur', ENT];
for (const k of Object.keys(P)) out.push(ligne(k, res[k].filter(x => x.ok && retV(x.r)).map(x => (x.r.finale[1] - x.pose[1]) * 1000)));
out.push('', 'TRAVERS, rails retouchés en travers', ENT);
for (const k of Object.keys(P)) if (!/dessus|hauteur/.test(k)) out.push(ligne(k, res[k].filter(x => x.ok && retL(x.r)).map(x => (x.r.finale[0] - x.pose[0]) * 1000)));
out.push('', 'HAUTEUR, rails laissés (< 0,5 mm)', ENT);
for (const k of Object.keys(P)) out.push(ligne(k, res[k].filter(x => x.ok && Math.abs(x.r.finale[1] - x.r.livre[1]) < 0.0005).map(x => (x.r.finale[1] - x.pose[1]) * 1000)));
out.push('', 'TRAVERS, rails laissés (< 0,5 mm)', ENT);
for (const k of Object.keys(P)) if (!/dessus|hauteur/.test(k)) out.push(ligne(k, res[k].filter(x => x.ok && Math.abs(x.r.finale[0] - x.r.livre[0]) < 0.0005).map(x => (x.r.finale[0] - x.pose[0]) * 1000)));
process.stdout.write(out.join('\n') + '\n');
