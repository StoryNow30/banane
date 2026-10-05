'use strict';
const R = require('./resume-outils.cjs'), { fixtureResume } = require('./backend.cjs');
module.exports = {
  id: 'resume-changement-partie', view: 'automatic', requires: 'partSummary', state: () => fixtureResume(),
  history: () => [...R.historiqueComplet(), ...R.historiquePartie24()],
  source: 'panel.js (U1) afficherResumePartie ; src/part-summary-49.js contextKey',
  expected: 'ESV passe de la partie 23 à la 24 puis revient : le résumé suit la partie affichée, sans mêler les lots des deux parties.',
  async run(p, o) {
    const { assert } = o; await R.attendreResume(p);
    const ids = r => r.lots.map(l => l.split(/\s/)[0].replace(/(lot-\d+).*/, '$1'));
    const p23 = await R.lireResume(p); await o.capture('partie-23', '#part-summary');
    assert.equal(p23.titre, 'Partie 23 · résumé'); assert.deepEqual(ids(p23), ['lot-1', 'lot-2']);
    await p.evaluate(() => { __u2.state.current.identity.part = 24; __u2.state.current.identity.cut = 2; });
    await o.until(p, () => document.getElementById('part-summary-title').textContent === 'Partie 24 · résumé');
    const p24 = await R.lireResume(p); await o.capture('partie-24', '#part-summary');
    assert.deepEqual(ids(p24), ['lot-4']); assert.equal(R.valeur(p24, 'Coupes distinctes'), '1'); assert.equal(R.valeur(p24, 'Posées par Ariane'), '1');
    await p.evaluate(() => { __u2.state.current.identity.part = 23; __u2.state.current.identity.cut = 30; });
    await o.until(p, () => document.getElementById('part-summary-title').textContent === 'Partie 23 · résumé');
    const retour = await R.lireResume(p);
    assert.deepEqual(ids(retour), ['lot-1', 'lot-2']); assert.deepEqual(retour.tuiles, p23.tuiles, 'retour à la partie 23 identique');
    return { p23, p24, retour };
  },
};
