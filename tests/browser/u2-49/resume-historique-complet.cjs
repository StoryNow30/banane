'use strict';
const R = require('./resume-outils.cjs'), { fixtureResume } = require('./backend.cjs');
module.exports = {
  id: 'resume-historique-complet', view: 'automatic', requires: 'partSummary', state: () => fixtureResume(), history: R.historiqueComplet,
  source: 'panel.js (U1) afficherResumePartie ; src/part-summary-49.js summarize',
  expected: 'Historique lu et complet : comptes exacts ; la reprise du cut 3 (différé puis posé) ne compte pas deux fois ; aucun différé restant.',
  async run(p, o) {
    const { assert } = o; await R.attendreResume(p); const r = await R.lireResume(p); await o.capture('resume', '#part-summary');
    assert.equal(r.titre, 'Partie 23 · résumé');
    assert.ok(r.note.startsWith('Historique conservé lu.'), r.note);
    assert.deepEqual([R.valeur(r, 'Lots conservés'), R.valeur(r, 'Coupes distinctes'), R.valeur(r, 'Posées par Ariane'), R.valeur(r, 'Différés confirmés'), R.valeur(r, 'Reprises à la main'), R.valeur(r, 'SKIP transmis')],
      ['2', '3', '3', '0', '0', '0'], 'comptes exacts, reprise sans double compte');
    assert.equal(r.differes, 'Aucun différé confirmé dans les données disponibles.');
    assert.equal(r.lotsTitre, 'Lots conservés (2)');
    assert.ok(r.lots[0].startsWith('lot-1') && r.lots[0].includes('3 coupes · 2 posées · 1 différées'), r.lots[0]);
    assert.ok(r.lots[1].startsWith('lot-2') && r.lots[1].includes('1 coupes · 1 posées · 0 différées'), r.lots[1]);
    return r;
  },
};
