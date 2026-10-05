'use strict';
// Ajout F : tabulation d'Écho en cours (commandes et tiroir d'abandon fermé).
module.exports = {
  id: 'tab-echo-running', view: 'native', mode: 'native-running', source: 'panel.js:334-549 ; panel.html:63-88',
  expected: 'Toutes les commandes visibles et disponibles atteintes dans l’ordre DOM, retour inverse, focus visible ; contenu d’un tiroir fermé exclu.',
  async run(p, o) { return { order: await o.tabOrder(p) }; },
};
