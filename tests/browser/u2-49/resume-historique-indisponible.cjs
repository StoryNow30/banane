'use strict';
const R = require('./resume-outils.cjs'), { fixtureResume } = require('./backend.cjs');
module.exports = {
  id: 'resume-historique-indisponible', view: 'automatic', requires: 'partSummary', fault: 'indexeddb-indisponible',
  state: () => fixtureResume({ batch: { id: 'lot-3', state: 'RUNNING', startedAt: '2026-10-02T08:01:00.000Z' } }), history: R.historiqueComplet,
  source: 'panel.js (U1) lireHistoriquePartie / afficherResumePartie',
  expected: 'Lecture IndexedDB en panne (injectée) : « Historique indisponible », inconnus écrits « inconnu » ou « au moins N », jamais 0 ; commandes du lot intactes.',
  async run(p, o) {
    const { assert } = o; await R.attendreResume(p); const r = await R.lireResume(p); await o.capture('resume', '#part-summary');
    assert.ok(r.note.startsWith('Historique indisponible'), r.note);
    assert.ok(R.sansNombreNu(r), 'aucun nombre nu : ' + JSON.stringify(r.tuiles.map(x => x.val)));
    assert.equal(R.valeur(r, 'Lots conservés'), 'au moins 1');
    assert.ok(r.differes.startsWith('Différés restants inconnus'), r.differes);
    assert.ok(!r.lots.some(l => l.startsWith('lot-1') || l.startsWith('lot-2')), 'historique non lu ne s’affiche pas');
    assert.ok(await p.locator('#pause').isVisible() && await p.locator('#pause').isEnabled(), 'Pause disponible malgré la panne de lecture');
    return r;
  },
};
