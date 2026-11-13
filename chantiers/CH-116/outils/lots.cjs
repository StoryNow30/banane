'use strict';
/* CH-116 : les lots du corpus jugé (D-351). Hors ligne, lecture seule ; aucune donnée au dépôt.
 * Chemins relatifs à CH116_TRAVAIL (dossier local d'extraction, jamais au dépôt) ; voir extraire.sh.
 * Un lot est désigné par son étiquette, une partie et son RANG parmi les lots de cette partie dans le journal (1 = le premier) :
 * aucun identifiant de lot n'est écrit ici. `examen: true` = parties réservées (D-192, D-285 : 05/11, parties 8 à 12) :
 * jamais utilisées pour régler par le banc, sauf ordre contraire (`--examen` vide). */
const path = require('node:path');
const T = () => process.env.CH116_TRAVAIL || path.join(process.env.HOME || '/root', 'ch116');
const x = (...a) => path.join(T(), 'x', ...a);
const P = (lot, dossierLot, echo, parties, extra = {}) => parties.map(p => {
  const [partie, rang = 1] = Array.isArray(p) ? p : [p];
  return { lot, partie, rang, dossierLot: x(dossierLot), echo: (Array.isArray(echo) ? echo : [echo]).map(e => x(typeof e === 'function' ? e(partie) : e)), ...extra };
});
const LOTS = [
  ...P('0411', 'l0411', 'e0411', [10, 13, 14, 15]),
  ...P('0511', 'l0511', 'e0511', [8, [9, 1], [9, 2], 10, 11, 12], { examen: true }),
  ...P('0611', 'l0611', 'e0611', [13, 15, 16]),
  ...P('0811a', 'l0811-16-13-46', 'e0811-p34', [3, 4]),
  ...P('0811b', 'l0811-21-30-27', 'e0811-p6', [[6, 1], [6, 2]]),
  ...P('1111', 'l1111', p => 'e1211-p' + p, [15, 16, 17]),
  ...P('1211', 'l1211', p => 'e1211-p' + p, [0, 1, 2, 23]),
  /* Examen vierge (13/11) : Échos du 12/11 parties 3 et 4, jamais vus par aucun réglage. Hors du corpus commun (corpus.cjs ne les prend que
   * nommés par --lots 1211v) ; à ne transmettre à aucun autre chantier. */
  ...P('1211v', 'l1211', p => 'e1211-p' + p, [3, 4], { examen: true, vierge: true }),
];
/* Lots exportés sans Écho joignable (comptés au résumé, pas au corpus) : 08/11 parties 5 et 7, 10/11 partie 9 (séance Écho tirée au sort
 * non faite), 12/11 parties 21, 22 (partie 22 : une seule visite). */
const SANS_ECHO = [{ lot: '0811', parties: [5, 7] }, { lot: '1011', parties: [9] }, { lot: '1211', parties: [21, 22] }];
const cle = l => `${l.lot}-p${l.partie}-r${l.rang}`;
module.exports = { LOTS, SANS_ECHO, cle, travail: T };
