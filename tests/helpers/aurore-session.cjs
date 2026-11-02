'use strict';
/* CH-040 — UNE SESSION FABRIQUÉE pour la couverture de l'Aurore (src/correction-liste.js, `couverture`) : plusieurs lots, plusieurs files, un lot
 * arrêté sur erreur, un lot déjà repris par une Aurore terminée. Forme du cas réel du 02/11 (parties 0 puis 1 par une première file arrêtée sur une
 * erreur, puis la partie 1 seule par une seconde file), en petit. Aucun nom, aucune coordonnée réelle, aucun identifiant réel.
 *   - lot A, partie 0 (file 1, t = 0) : 1 posé, 2 différé, 3 posé par le lot sans appui (après un différé), 4 posé ; fin normale ;
 *   - lot B, partie 1 (file 1, t = 600) : 10 différé, 11 posé par le lot sans appui, 12 différé ; arrêté sur erreur (aucun `batch-stopped-at-end`) ;
 *   - lot C, partie 1 (file 2, t = 1200) : 12 posé proprement (il n'est plus à poser), 13 différé, 14 posé par le lot sans appui ; fin normale ;
 *   - lot D, partie 2 (t = 1800, option) : 20 posé par le lot sans appui, 21 différé, puis une Aurore terminée (`correction-debut`, `correction-fin`).
 * Avant fusion : A 3 (2, 3, 4 : 4 suit un différé à n − 2), B 3 (10, 11, 12), C 2 (13, 14), D 2 (20, 21). */
const T0 = Date.parse('2026-11-02T08:00:00Z');
const at = s => new Date(T0 + s * 1000).toISOString();
function lot(ev, { id, partie, t, cuts, fin = true }) {
  ev.push({ type: 'batch-started', timestamp: at(t), batch: { id }, identity: { part: partie, cut: cuts[0][0] } });
  let s = t + 1;
  for (const [cut, k] of cuts) {
    const L = k === 'differe' ? { command: { action: 'defer', reason: 'candidat' }, anchorsUsed: [] }
      : k === 'lot' ? { command: { action: 'lot', reason: 'choice' }, anchorsUsed: [] } : { command: { action: 'engine', reason: 'first-pass' }, anchorsUsed: [0, 1] };
    ev.push({ type: 'gcv1-shadow-observed', timestamp: at(s), batchId: id, identity: { part: partie, cut }, lotObservation: L });
    if (k !== 'differe') ev.push({ type: 'esv-observation', kind: 'write', timestamp: at(s + 1), status: 204, rowIndex: cut, body: { ExtractionStatus: 'valid', TreatedByOperator: true } });
    s += 2;
  }
  if (fin) ev.push({ type: 'batch-stopped-at-end', timestamp: at(s) });
  return s;
}
function session({ avecD = true, finD = 'operateur', lignesD = null } = {}) {
  const ev = [];
  lot(ev, { id: 'A', partie: 0, t: 0, cuts: [[1, 'ok'], [2, 'differe'], [3, 'lot'], [4, 'ok']] });
  ev.push({ type: 'file-parties', timestamp: at(500), fileId: 'F1', evenement: 'changement-ok' });
  lot(ev, { id: 'B', partie: 1, t: 600, cuts: [[10, 'differe'], [11, 'lot'], [12, 'differe']], fin: false });
  ev.push({ type: 'batch-error', timestamp: at(700), message: 'délai dépassé' });
  ev.push({ type: 'file-parties', timestamp: at(1199), fileId: 'F2', evenement: 'demarrer' });
  lot(ev, { id: 'C', partie: 1, t: 1200, cuts: [[12, 'ok'], [13, 'differe'], [14, 'lot']] });
  if (avecD) {
    const s = lot(ev, { id: 'D', partie: 2, t: 1800, cuts: [[20, 'lot'], [21, 'differe']] });
    ev.push({ type: 'correction-debut', timestamp: at(s + 30), correctionId: 'X', batchIds: ['D'], cuts: 2 });
    ev.push({ type: 'correction-fin', timestamp: at(s + 90), correctionId: 'X', raison: finD,
      lignes: lignesD || [{ part: 2, cut: 20, groupe: 'corriger', statut: 'corrige' }, { part: 2, cut: 21, groupe: 'poser', statut: 'a-faire' }] });
  }
  return ev;
}
module.exports = { session, lot, at, T0 };
