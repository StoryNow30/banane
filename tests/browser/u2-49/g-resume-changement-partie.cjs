'use strict';
// Contrôle F : sans lot, ESV passe de la partie 23 à la 24 puis revient ; animations réduites.
const G = require('./resume-g-outils.cjs');
module.exports = {
  id: 'g-resume-changement-partie', view: 'automatic', requires: 'partSummary', reducedMotion: 'reduce',
  source: 'panel.js (G) afficherResume ; src/part-summary-49.js (G)',
  expected: 'Le résumé suit la partie affichée par ESV (23 → 24 → 23) sans mêler les lots ; aucune animation en cours (mouvement réduit).',
  state: () => { const s = JSON.parse(JSON.stringify(G.CAS.sansLot.state)); s.current.identity.part = 23; s.current.identity.cut = 3; return s; },
  history: () => JSON.parse(JSON.stringify(G.CAS.complet.history)),
  async run(p, o) {
    const { assert } = o; await G.attendre(p);
    const p23 = await G.lire(p); await o.capture('partie-23', '#part-summary');
    assert.equal(p23.titre, 'Résumé de la partie 23'); assert.equal(p23.lotsTitre, 'Lots de la partie (2)');
    await p.evaluate(() => { __u2.state.current.identity.part = 24; __u2.state.current.identity.cut = 1; });
    await o.until(p, () => document.getElementById('part-summary-title').textContent === 'Résumé de la partie 24');
    const p24 = await G.lire(p); await o.capture('partie-24', '#part-summary');
    assert.equal(p24.lotsTitre, 'Lots de la partie (0)'); assert.deepEqual(p24.lots, []);
    await p.evaluate(() => { __u2.state.current.identity.part = 23; __u2.state.current.identity.cut = 3; });
    await o.until(p, () => document.getElementById('part-summary-title').textContent === 'Résumé de la partie 23');
    const retour = await G.lire(p); assert.deepEqual(retour.tuiles, p23.tuiles); assert.deepEqual(retour.lots, p23.lots);
    G.controlerF(assert, p23); G.controlerF(assert, p24);
    const animations = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    assert.equal(animations, 0, 'aucune animation en cours avec mouvement réduit');
    return { p23, p24, retour, animations, lecture: await G.sansEcriture(p, assert) };
  },
};
