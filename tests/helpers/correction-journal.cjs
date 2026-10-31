'use strict';
/* CH-028 — un journal de lot FABRIQUÉ pour la liste de cuts à corriger (src/correction-liste.js) : partie 5, lot « B1 », cibles 10 à 19.
 *   - 13 et 14 différés par le lot ; 14 ensuite écrit par la deuxième passe ;
 *   - 15 posé juste après (R1), sans appui, par le moteur ; 16 posé (R1, n − 2 = 14) avec 2 appuis ;
 *   - 17 posé par une commande du lot sans appui ; 18 posé, la relecture dit « je corrigerais » sans corriger ; 19 voisin d'un cut gardé ;
 *   - 10, 11, 12 posés sans signal ; 12 est aussi relu « je corrigerais » mais corrigé par la relecture (n'entre pas) ;
 *   - un vert d'avant le lot (cut 40) relu « je corrigerais » : hors lot, n'entre pas.
 * Aucun nom, aucune coordonnée réelle. */
const T0 = Date.parse('2026-10-31T10:00:00Z');
const at = s => new Date(T0 + s * 1000).toISOString();
function journal({ partie = 5, lot = 'B1' } = {}) {
  const ev = [];
  const id = cut => ({ part: partie, cut });
  ev.push({ type: 'batch-started', timestamp: at(0), batch: { id: lot }, identity: id(10) });
  const obs = (cut, s, L) => ev.push({ type: 'gcv1-shadow-observed', timestamp: at(s), batchId: lot, identity: id(cut), lotObservation: L });
  const ecrit = (cut, s) => ev.push({ type: 'esv-observation', kind: 'write', timestamp: at(s + 1), status: 204, rowIndex: cut, body: { ExtractionStatus: 'valid', TreatedByOperator: true } });
  const moteur = (n) => ({ command: { action: 'engine', reason: 'first-pass' }, anchorsUsed: Array.from({ length: n }, (_, i) => i) });
  let s = 1;
  for (const cut of [10, 11, 12]) { obs(cut, s, moteur(2)); ecrit(cut, s); s += 2; }
  obs(13, s, { command: { action: 'defer', reason: 'candidat' }, anchorsUsed: [] }); s += 2;
  obs(14, s, { command: { action: 'defer', reason: 'garde-apres-differe' }, anchorsUsed: [] });
  ev.push({ type: 'garde-apres-differe', timestamp: at(s), batchId: lot, identity: id(14) }); s += 2;
  obs(15, s, moteur(0)); ecrit(15, s); s += 2;
  obs(16, s, moteur(2)); ecrit(16, s); s += 2;
  obs(17, s, { command: { action: 'lot', reason: 'choice' }, anchorsUsed: [] }); ecrit(17, s); s += 2;
  obs(18, s, moteur(2)); ecrit(18, s); s += 2;
  obs(19, s, moteur(1)); ecrit(19, s);
  ev.push({ type: 'garde-apres-differe-suivant', timestamp: at(s), batchId: lot, identity: id(19), cutsGarde: [14] }); s += 2;
  ev.push({ type: 'batch-stopped-at-end', timestamp: at(s) });
  ev.push({ type: 'passe-differes-ecriture', timestamp: at(s + 10), batchId: lot, identity: id(14), resultat: 'ecrit', decal: { left: [0, -2, 38.4], right: [0, 1, 3] } });
  for (const [cut, action] of [[18, 'visite'], [12, 'corrige'], [40, 'visite']])
    ev.push({ type: 'relecture-ombre', timestamp: at(s + 20 + cut), batchId: lot, identity: id(cut), verdict: 'je corrigerais', action, pireMm: 7.26 });
  return ev;
}
module.exports = { journal, at, T0 };
