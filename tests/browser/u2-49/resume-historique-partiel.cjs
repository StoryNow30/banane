'use strict';
const R = require('./resume-outils.cjs'), { fixtureResume } = require('./backend.cjs');
module.exports = {
  id: 'resume-historique-partiel', view: 'automatic', requires: 'partSummary', state: () => fixtureResume(), history: R.historiquePartiel,
  source: 'panel.js (U1) nombre() ; src/part-summary-49.js missingStarts / identityUnknown',
  expected: 'Début de lot manquant et identité incomplète : « Historique incomplet », comptes « au moins N », liste des différés marquée partielle, aucun zéro affirmé.',
  async run(p, o) {
    const { assert } = o; await R.attendreResume(p); const r = await R.lireResume(p); await o.capture('resume', '#part-summary');
    assert.ok(r.note.includes('Historique incomplet : comptes partiels.'), r.note);
    assert.ok(R.sansNombreNu(r), 'aucun nombre nu : ' + JSON.stringify(r.tuiles.map(x => x.val)));
    assert.deepEqual([R.valeur(r, 'Lots conservés'), R.valeur(r, 'Coupes distinctes'), R.valeur(r, 'Posées par Ariane'), R.valeur(r, 'Différés confirmés')],
      ['au moins 2', 'au moins 4', 'au moins 2', 'au moins 2']);
    assert.equal(r.differes, 'Différés restants connus (liste partielle) : 3, 6.');
    assert.ok(r.inconnus.includes('au moins 1 identité(s) incomplète(s)'), r.inconnus);
    return r;
  },
};
