'use strict';
// Zoom navigateur 200 % (niveau de zoom de l'onglet, comme Ctrl + ou le menu), viewport inchangé.
module.exports = {
  id: 'zoom-home', view: 'home', mode: 'idle', reducedMotion: 'reduce', source: 'panel.css:32-36,187-211',
  expected: 'Zoom natif confirmé à 2, texte non tronqué et commandes atteignables après défilement.',
  async run(p, o) {
    const zoom = await o.zoom200(p);
    await o.capture('zoom-200');
    const rendu = await o.layout(p);
    const ouverts = await o.ouvrirTiroirs(p);
    await o.capture('zoom-200-tiroirs-ouverts');
    return { zoom, layout: rendu, tiroirsOuverts: { ouverts, ...(await o.layout(p, 'tiroirs ouverts')) } };
  },
};
