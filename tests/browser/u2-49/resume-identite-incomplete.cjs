'use strict';
const R = require('./resume-outils.cjs'), { fixtureResume } = require('./backend.cjs');
module.exports = {
  id: 'resume-identite-incomplete', view: 'automatic', requires: 'partSummary', history: R.historiqueComplet,
  state: () => { const s = fixtureResume(); delete s.current.identity.pageId; return s; },
  source: 'panel.js (U1) afficherResumePartie, branche !r.counts',
  expected: 'Identité de coupe incomplète : résumé déclaré inconnu, aucun compte affiché.',
  async run(p, o) {
    const { assert } = o;
    await o.until(p, () => document.getElementById('part-summary-note').textContent.startsWith('Identité incomplète'));
    const r = await R.lireResume(p); await o.capture('resume', '#part-summary');
    assert.equal(r.tuiles.length, 0); assert.equal(r.differes, 'Différés restants inconnus.'); assert.equal(r.lotsTitre, 'Lots inconnus');
    assert.equal(r.note, 'Identité incomplète : résumé inconnu. Total de la partie inconnu.');
    return r;
  },
};
