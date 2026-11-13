#!/usr/bin/env node
'use strict';
/* CH-125 : la constante c du niveau 1 (hauteur = médiane du dessus + c pour un rail refusé en hauteur), apprise par pli (hors ligne, lecture seule).
 *   node chantiers/CH-125/outils/c-par-pli.cjs --rails DOSSIER --gabarit G.json [--octobre DOSSIER_1410]
 * Population d'apprentissage : rails jugés (hors mauvaises voies) que le calage livré, relu à la pose livrée, refuse pour leur seule hauteur
 * (|q90 + 1| > 8 mm, |du| ≤ 8 mm) ; c = médiane de (hauteur finale − médiane du dessus en point fixe). Deux définitions sont données :
 *   « tous »      : tous ces rails, retouchés ou laissés par l'opérateur (RETENUE : la mesure s'applique à tous les rails refusés, sans savoir lesquels
 *                   l'opérateur retoucherait ; un rail laissé compte avec la hauteur qu'il a acceptée) ;
 *   « retouchés » : ceux que l'opérateur a retouchés en hauteur de plus de 2 mm (donnée pour comparaison).
 * Par pli : les lots réglables sauf celui tenu à l'écart ; avec `--octobre`, le 14/10 partie 17 (hors corpus du banc, jamais jugé par lui) est ajouté
 * à chaque pli, pour que c porte sur les deux époques. Arrondi au dixième de millimètre. */
const R = require('./rails.cjs'), E = require('./estimateurs.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--octobre') o.octobre = v(); else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), VIS = { origines: [0], xMax: 0.25 };
const pop = (dossier, lots) => R.lire(dossier, { lots }).filter(r => r.classeLot !== 'mauvaise-voie').map(r => { const c = E.conventionLivree(r.pts, gab, r.livre, VIS);
  if (c.applique || c.raison !== 'shift-out-of-domain' || !(Math.abs(c.dz) > 8) || !(Math.abs(c.du) <= 8)) return null;
  const m = E.centreBandes(r.pts, gab, r.livre, { ...VIS, lateral: false }); if (!m.deplaceVert) return null;
  return { lot: r.lot, c: (r.finale[1] - m.pose[1]) * 1000, ret: Math.abs(r.finale[1] - r.livre[1]) > 0.002 }; }).filter(Boolean);
const nov = pop(o.rails, R.LOTS_REGLABLES), oct = o.octobre ? pop(o.octobre, ['1410']) : [];
const r1 = v => Math.round(v * 10) / 10, c = (L, ret) => { const v = L.filter(l => !ret || l.ret).map(l => l.c); return v.length >= 5 ? { c: r1(N.mediane(v)), n: v.length } : { c: null, n: v.length }; };
console.log(`Rails refusés pour leur seule hauteur : novembre ${nov.length} (retouchés ${nov.filter(l => l.ret).length})${o.octobre ? ` ; 14/10 p17 ${oct.length} (retouchés ${oct.filter(l => l.ret).length}), c du 14/10 p17 seul : tous ${c(oct, false).c}, retouchés ${c(oct, true).c}` : ''}.`);
console.log('| lot tenu à l\'écart | c « tous » (mm), RETENUE | rails | c « retouchés » (mm) | rails |\n|---|---|---|---|---|');
const out = {};
for (const lot of [...R.LOTS_REGLABLES, '0511 et final (les 6 lots réglables)']) { const L = nov.filter(l => l.lot !== lot).concat(oct), x = c(L, false), y = c(L, true); out[R.LOTS_REGLABLES.includes(lot) ? lot : 'final'] = x.c; console.log(`| ${lot} | ${x.c} | ${x.n} | ${y.c} | ${y.n} |`); }
console.log(JSON.stringify(out));
