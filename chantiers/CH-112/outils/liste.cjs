'use strict';
/* CH-112 : décodage d'un instantané de la liste d'ESV (`ariane-liste-instantane-1`).
 * r[i] = [statut + 4 × drapeaux, six bords] ; bords en 0,1 mm, première valeur connue absolue, puis écarts
 * à la précédente valeur connue de la même colonne. Rend, par cut : statut, drapeaux, rails gauche/droit en mètres. */
const fs = require('node:fs');
function lireListe(fichier) {
  const l = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const prec = [null, null, null, null, null, null];
  const out = new Array(l.r.length);
  for (let i = 0; i < l.r.length; i++) {
    const row = l.r[i];
    if (!row) { out[i] = null; continue; }
    const code = row[0], statut = code % 4, drapeaux = Math.floor(code / 4);
    const b = [];
    for (let k = 0; k < 6; k++) {
      const v = row[1 + k];
      if (v === null || v === undefined) { b.push(null); continue; }
      prec[k] = prec[k] === null ? v : prec[k] + v;
      b.push(prec[k] / 10000);
    }
    const ok = b.every(x => x !== null);
    out[i] = { statut, traite: (drapeaux & 1) === 1, vu: (drapeaux & 2) === 2,
      gauche: ok ? b.slice(0, 3) : null, droite: ok ? b.slice(3, 6) : null };
  }
  return { partie: l.partie, at: l.at, cuts: out };
}
module.exports = { lireListe };
