'use strict';
/* CH-134 : classe les écarts de chantiers/CH-134/mesures/equivalence.json. Classes attendues :
 *  bouton   : le bouton de vue (30 px, marges −6 px) donne 18 px à la ligne d'état au lieu de 15,9 et pousse « Partie N » (margin-left:auto) :
 *             hauteurs, positions, origines et marges automatiques qui en découlent (propriétés géométriques seulement) ;
 *  consigne : bordure gauche de largeur nulle (style « solid » hérité d'une remise à zéro au lieu de « none ») : rien de visible ;
 *  --n      : variable de la trace en points, retirée avec elle ;
 *  temps    : classe d'animation `sg-tic` présente dans l'un des deux rendus selon la seconde (bruit de mesure).
 * Tout autre écart est « AUTRE » et listé. Usage : node chantiers/CH-134/outils/classer-equivalence.cjs [equivalence.json] */
const r = require(require('node:path').resolve(process.argv[2] || 'chantiers/CH-134/mesures/equivalence.json'));
const GEO = /\{ (block-size|height|inline-size|width|top|bottom|inset-block-start|inset-block-end|perspective-origin|transform-origin|margin-top|margin-block-start|margin-bottom|margin-block-end|margin-left|margin-inline-start|d|cy|y|r): /;
const classe = x => /\{ --n: /.test(x) ? '--n' : /sg-consigne:\d+ \{ border-(left|inline-start)-(style|color)/.test(x) ? 'consigne' : /sg-tic|sg-pause-depuis/.test(x) ? 'temps' : GEO.test(x) ? 'bouton' : 'AUTRE';
const tot = {}, autres = [], vues = { avec: 0, sans: 0 }, sansBoutonAvecEcart = [];
for (const [k, v] of Object.entries(r)) { if (v.length) vues.avec++; else vues.sans++;
  for (const x of v) { const c = classe(x); tot[c] = (tot[c] || 0) + 1; if (c === 'AUTRE') autres.push(`${k} | ${x}`); } }
console.log(JSON.stringify({ vues, classes: tot }, null, 1));
for (const a of autres.slice(0, 40)) console.log('AUTRE', a);
