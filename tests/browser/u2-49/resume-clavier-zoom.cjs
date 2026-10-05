'use strict';
const R = require('./resume-outils.cjs'), { fixtureResume } = require('./backend.cjs');
module.exports = {
  id: 'resume-clavier-zoom', view: 'automatic', requires: 'partSummary', state: () => fixtureResume(), history: R.historiqueComplet,
  source: 'panel.html (U1) #part-summary ; panel.css (U1) .part-summary',
  expected: 'Le tiroir « Lots conservés » est atteint et ouvert au clavier, focus conservé ; à 200 % le résumé ouvert ne déborde pas et reste lisible.',
  async run(p, o) {
    const { assert } = o; await R.attendreResume(p);
    const ordre = await o.tabOrder(p);
    assert.ok(ordre.some(x => x.id === 'part-summary-lots-title'), 'résumé atteint par Tab');
    await o.key(p, 'part-summary-lots-title');
    assert.equal(await o.focusId(p), 'part-summary-lots-title');
    assert.ok(await p.locator('#part-summary details').evaluate(d => d.open), 'tiroir ouvert au clavier');
    assert.ok(await p.locator('#part-summary-lots li').first().isVisible());
    const zoom = await o.zoom200(p);
    await o.capture('zoom-200', '#part-summary');
    const mise = await o.layout(p, 'résumé ouvert, 200 %');
    return { ordre, zoom, layout: mise };
  },
};
