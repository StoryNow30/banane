#!/usr/bin/env node
'use strict';
/* CH-122 : précalcul de l'axe prédit de la voie (ancre de trajectoire de CH-124, lib utilisée TELLE QUELLE depuis sa branche) pour chaque cut des lots
 * du banc, au départ du lot (liste du départ reconstituée, comme `ancre.cjs juger` sans `--fin`). Hors dépôt : un fichier par lot-partie
 * dans CH116_TRAVAIL/ancre/<clé>.json = { cut: travers de l'axe dans le repère « coupe » du cut, mm, vers la gauche } (null si l'ancre se tait).
 *   CH124_OUTILS=<arbre de chantier/CH-124>/chantiers/CH-124/outils CH116_TRAVAIL=… node chantiers/CH-122/outils/axes-ancre.cjs */
const fs = require('node:fs'), path = require('node:path');
const D = process.env.CH124_OUTILS; if (!D) throw Error('CH124_OUTILS absent');
const Lb = require(path.join(D, 'lib.cjs')), T = require(path.join(D, 'trajectoire.cjs')), A = require(path.join(D, 'ancre.cjs'));
const out = path.join(Lb.travail(), 'ancre'); fs.mkdirSync(out, { recursive: true });
for (const e of Lb.entrees()) {
  const k = Lb.cle(e), m = Lb.meta(k); if (!m.liste) { process.stdout.write(`${k} : sans liste\n`); continue; }
  const rowsFin = T.lignes(m.liste), caps = Lb.captures(k), cal = A.calage(rowsFin, caps);
  if (!cal) { fs.writeFileSync(path.join(out, k + '.json'), '{}'); process.stdout.write(`${k} : sans calage\n`); continue; }
  const rows = A.listeDeDepart(rowsFin, caps, cal), Mo = A.modele(rows), axes = {}; let n = 0;
  for (const [cut, cap] of caps) {
    const r = rows[cut]; if (!r) { axes[cut] = null; continue; }
    const ax = Mo.axe(cut); if (!ax) { axes[cut] = null; continue; }
    const rep = Lb.repere(cap), Ow = rep.O.map((v, i) => v + cal.t[i]), yM = 1000 * ((r.M[0] - Ow[0]) * rep.Y[0] + (r.M[1] - Ow[1]) * rep.Y[1]);
    axes[cut] = Math.round((yM + ax.mm) * 10) / 10; n++;
  }
  fs.writeFileSync(path.join(out, k + '.json'), JSON.stringify(axes));
  process.stdout.write(`${k} : ${n}/${caps.size} cuts avec axe (sens ${Mo.P.sens > 0 ? '+' : '−'}, a ${Mo.P.a}, w ${Mo.P.w})\n`);
}
