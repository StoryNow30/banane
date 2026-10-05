'use strict';
// Après Pause (activée au clavier), le bouton Pause disparaît : le focus ne doit pas tomber sur body.
module.exports = {
  id: 'focus-pause', view: 'automatic', mode: 'running', source: 'panel.js:334,495-516,873-875,914',
  expected: 'Après disparition de Pause, le focus reste sur une commande visible/disponible du panneau ; il ne se perd pas sur body.',
  async run(p, o) {
    await o.key(p, 'pause', 'Space');
    await o.until(p, () => !document.getElementById('resume').hidden); await o.tick(p);
    await o.capture('apres-pause');
    return { focus: await o.focusAvailable(p), calls: await o.calls(p, 'pause'), trace: await o.trace(p) };
  },
};
