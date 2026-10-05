'use strict';
// Contrôle F : tiroir des lots au clavier, puis zoom 200 % du résumé ouvert.
const G = require('./resume-g-outils.cjs');
module.exports = {
  id: 'g-resume-clavier-zoom', view: 'automatic', requires: 'partSummary',
  source: 'panel.html (G) #part-summary ; panel.css (G) .resume-partie',
  expected: 'Tiroir « Lots de la partie » atteint par Tab et ouvert par Entrée, focus conservé ; à 200 % pas de débordement ni de texte tronqué.',
  state: () => JSON.parse(JSON.stringify(G.CAS.complet.state)), history: () => JSON.parse(JSON.stringify(G.CAS.complet.history)),
  async run(p, o) {
    const { assert } = o; await G.attendre(p);
    const ordre = await o.tabOrder(p);
    assert.ok(ordre.some(x => x.id === 'part-summary-lots-title'), 'résumé atteint par Tab');
    await o.key(p, 'part-summary-lots-title'); assert.equal(await o.focusId(p), 'part-summary-lots-title');
    assert.ok(await p.locator('#part-summary details').evaluate(d => d.open), 'tiroir ouvert au clavier');
    const zoom = await o.zoom200(p); await o.capture('zoom-200', '#part-summary');
    return { ordre, zoom, layout: await o.layout(p, 'résumé G ouvert, 200 %') };
  },
};
