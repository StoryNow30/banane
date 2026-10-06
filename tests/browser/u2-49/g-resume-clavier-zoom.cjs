'use strict';
// Repris de la proposition de G (missions/G_PANNEAU/pour-F/g-resume-clavier-zoom.cjs), avec une étape de F en plus :
// le tiroir « Lots de la partie » doit rester atteignable au clavier À 200 %, bloc replié puis déplié.
// Le résumé est replié par défaut (« Détail du résumé »), la ligne de comptes reste visible.
const G = require('./resume-g-outils.cjs');
module.exports = {
  id: 'g-resume-clavier-zoom', view: 'automatic', requires: 'partSummary',
  source: 'panel.html (G) #part-summary ; panel.css (G) .resume-partie',
  expected: 'Bloc replié par défaut avec sa ligne de comptes visible ; « Détail du résumé » puis « Lots de la partie » atteints par Tab et ouverts par Entrée, focus conservé ; à 200 % : replié sans débordement, puis déplié au clavier (détail et lots) sans débordement ni texte tronqué.',
  state: () => JSON.parse(JSON.stringify(G.CAS.complet.state)), history: () => JSON.parse(JSON.stringify(G.CAS.complet.history)),
  async run(p, o) {
    const { assert } = o; await G.attendre(p);
    // 100 % : replié par défaut, puis déplié au clavier.
    assert.equal(await p.locator('#part-summary-details').evaluate(d => d.open), false, 'détail replié par défaut');
    assert.ok(await p.locator('#part-summary-line').isVisible(), 'ligne de comptes visible bloc replié');
    assert.equal(await p.locator('#part-summary-counts').isVisible(), false, 'tuiles cachées bloc replié');
    const ordre = await o.tabOrder(p);
    assert.ok(ordre.some(x => x.id === 'part-summary-details-toggle'), 'détail atteint par Tab');
    assert.ok(!ordre.some(x => x.id === 'part-summary-lots-title'), 'tiroir des lots hors de la tabulation tant que le détail est replié');
    await o.key(p, 'part-summary-details-toggle'); assert.equal(await o.focusId(p), 'part-summary-details-toggle');
    assert.ok(await p.locator('#part-summary-details').evaluate(d => d.open), 'détail ouvert au clavier');
    assert.ok(await p.locator('#part-summary-counts').isVisible(), 'tuiles visibles détail ouvert');
    const ordre2 = await o.tabOrder(p);
    assert.ok(ordre2.some(x => x.id === 'part-summary-lots-title'), 'tiroir des lots atteint par Tab, détail ouvert');
    await o.key(p, 'part-summary-lots-title'); assert.equal(await o.focusId(p), 'part-summary-lots-title');
    assert.ok(await p.locator('#part-summary-lots-title').evaluate(s => s.parentElement.open), 'tiroir des lots ouvert au clavier');
    // 200 % : déplié (comme G), puis replié au clavier, puis redéplié au clavier : atteignable dans les trois états.
    const zoom = await o.zoom200(p); await o.capture('zoom-200', '#part-summary');
    const deplie = await o.layout(p, 'résumé G déplié, 200 %');
    await o.key(p, 'part-summary-lots-title'); await o.key(p, 'part-summary-details-toggle');
    assert.equal(await p.locator('#part-summary-details').evaluate(d => d.open), false, 'détail replié au clavier à 200 %');
    const replie = await o.layout(p, 'résumé G replié, 200 %'); await o.capture('zoom-200-replie', '#part-summary');
    await o.key(p, 'part-summary-details-toggle'); assert.ok(await p.locator('#part-summary-details').evaluate(d => d.open), 'détail rouvert au clavier à 200 %');
    assert.equal(await o.focusId(p), 'part-summary-details-toggle', 'focus conservé à 200 %');
    const ordre200 = await o.tabOrder(p);
    assert.ok(ordre200.some(x => x.id === 'part-summary-lots-title'), 'tiroir des lots atteint par Tab à 200 %');
    await o.key(p, 'part-summary-lots-title'); assert.ok(await p.locator('#part-summary-lots-title').evaluate(s => s.parentElement.open), 'tiroir des lots rouvert à 200 %');
    const rouvert = await o.layout(p, 'résumé G redéplié, 200 %');
    return { ordre, ordre2, ordre200, zoom, layout: { deplie, replie, rouvert } };
  },
};
