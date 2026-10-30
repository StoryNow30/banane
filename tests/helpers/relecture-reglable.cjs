'use strict';
/* Test 27 : la relecture après le lot est « corriger » par défaut et n'est plus réglable (src/settings.js `relectureDefaut`). Les essais qui
 * éprouvent les trois choix du panneau (coupée, ombre, corriger) et le lot « tel qu'avant » remettent l'ancien état : choix réglable,
 * coupée par défaut. À charger AVANT tout autre module qui lit les réglages. */
const path = require('node:path');
const chemin = require.resolve('../../src/settings.js');
const S = require(chemin);
if (!S.relectureDefaut.modifiable) {
  require.cache[chemin].exports = Object.freeze({ ...S, relectureDefaut: Object.freeze({ mode: 'coupee', modifiable: true }) });
}
module.exports = {};
