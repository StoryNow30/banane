'use strict';
// Contrôle F : thème sombre, couleurs calculées du résumé au seuil adopté 4,5:1 (D-059).
const G = require('./resume-g-outils.cjs');
module.exports = {
  id: 'g-resume-sombre', view: 'automatic', requires: 'partSummary', colorScheme: 'dark',
  source: 'panel.css (G) .resume-partie ; panel.css:13-30',
  expected: 'En thème sombre, textes du résumé (titre, tuiles, notes, différés) au moins 4,5:1 sur le fond.',
  state: () => JSON.parse(JSON.stringify(G.CAS.complet.state)), history: () => JSON.parse(JSON.stringify(G.CAS.complet.history)),
  async run(p, o) {
    const { assert } = o; await G.attendre(p); await o.capture('sombre', '#part-summary');
    const couleurs = await p.evaluate(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      const sel = ['#part-summary-title', '#part-summary-counts .tuile b', '#part-summary-counts .tuile small', '#part-summary-counts .lbl', '#part-summary-deferred', '#part-summary-unknown', '#part-summary-note', '#part-summary-lots-title'];
      return { bg, sombre: matchMedia('(prefers-color-scheme: dark)').matches, textes: sel.map(s => ({ s, c: getComputedStyle(document.querySelector(s)).color })) };
    });
    const lum = c => c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    assert.ok(couleurs.sombre, 'thème sombre émulé');
    const ratios = couleurs.textes.map(t => ({ ...t, ratio: Math.round(ratio(t.c, couleurs.bg) * 100) / 100 }));
    for (const r of ratios) assert.ok(r.ratio >= 4.5, r.s + ' contraste ' + r.ratio);
    return { fond: couleurs.bg, ratios };
  },
};
