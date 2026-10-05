'use strict';
// Outils de la suite U1 « résumé de partie » : lecture du résumé tel qu'affiché
// dans le vrai panneau, et historiques synthétiques (IndexedDB réelle, profil jetable).
const { evenement, debutLot, identite } = require('./backend.cjs');

const VALIDE = (cut, s, lot, part = 23) => evenement('validation-accepted', cut, s, { batchId: lot, action: 'VALIDATE' }, part);
const DIFFERE = (cut, s, lot, motif = 'input', part = 23) => evenement('defer-finalized', cut, s, { batchId: lot, deferredConfirmed: true, rails: { left: { gcv1: { motif } } } }, part);
const ETAT = (cut, s, lot, state, part = 23) => evenement('batch-state', cut, s, { batchId: lot, state }, part);

// Partie 23 : lot-1 (cuts 1 et 2 posés, 3 différé, arrêté), puis lot-2 reprend le cut 3 et le pose.
const historiqueComplet = () => [
  debutLot('lot-1', 1, 0), VALIDE(1, 1, 'lot-1'), VALIDE(2, 2, 'lot-1'), DIFFERE(3, 3, 'lot-1'), ETAT(3, 4, 'lot-1', 'STOPPED'),
  debutLot('lot-2', 3, 10), VALIDE(3, 11, 'lot-2'), ETAT(3, 12, 'lot-2', 'COMPLETED'),
];
// Partie 24 : un lot, un cut posé.
const historiquePartie24 = () => [debutLot('lot-4', 1, 20, 24), VALIDE(1, 21, 'lot-4', 24)];
// Partiel : résultats d'un lot dont le début manque, et une identité incomplète.
const historiquePartiel = () => [
  debutLot('lot-1', 1, 0), VALIDE(1, 1, 'lot-1'), DIFFERE(3, 3, 'lot-1'),
  { ...VALIDE(2, 2, 'lot-1'), eventId: 'u2-identite-incomplete', identity: { ...identite(2), pageId: null } },
  VALIDE(5, 30, 'lot-orphelin'), DIFFERE(6, 31, 'lot-orphelin', 'gauge-out-of-contract'),
];

async function attendreResume(p) {
  await p.waitForFunction(() => { const n = document.getElementById('part-summary-note'); const s = document.getElementById('part-summary');
    return s && !s.hidden && n && n.textContent && !n.textContent.includes('Lecture de l’historique en cours'); }, null, { timeout: 2500, polling: 20 });
}
async function lireResume(p) {
  return p.evaluate(() => {
    const t = id => document.getElementById(id)?.textContent ?? null;
    return {
      visible: !document.getElementById('part-summary').hidden, titre: t('part-summary-title'),
      tuiles: [...document.querySelectorAll('#part-summary-counts .tuile')].map(x => ({ lbl: x.querySelector('.lbl')?.textContent, val: x.querySelector('b')?.textContent, sous: x.querySelector('small')?.textContent })),
      differes: t('part-summary-deferred'), inconnus: t('part-summary-unknown'), note: t('part-summary-note'), lotsTitre: t('part-summary-lots-title'),
      lots: [...document.querySelectorAll('#part-summary-lots li')].map(li => li.textContent),
    };
  });
}
const valeur = (r, lbl) => r.tuiles.find(x => x.lbl === lbl)?.val;
// Historique incomplet : aucun nombre nu (un zéro serait un inconnu écrit comme zéro).
const sansNombreNu = r => r.tuiles.every(x => /^(inconnu|au moins \d+)$/.test(x.val));

module.exports = { historiqueComplet, historiquePartie24, historiquePartiel, attendreResume, lireResume, valeur, sansNombreNu };
