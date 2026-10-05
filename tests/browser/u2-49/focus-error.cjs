'use strict';
// Reprendre refusé par le backend : l'erreur est annoncée et le focus reste sur Reprendre.
module.exports = {
  id: 'focus-error', view: 'automatic', mode: 'paused', source: 'panel.js:131-135,548,873-875',
  expected: 'Erreur de reprise affichée dans la région live ; focus disponible sur Reprendre, erreur conservée au rafraîchissement.',
  async run(p, o) {
    const { assert } = o;
    await p.evaluate(() => __u2.fail('resume', 'Erreur synthétique U2 : reprise refusée'));
    await o.key(p, 'resume');
    await o.until(p, () => document.getElementById('notice').textContent.includes('Erreur synthétique U2'));
    await o.tick(p);
    await o.capture('apres-erreur');
    assert.ok((await p.locator('#notice').textContent()).includes('Erreur synthétique U2'), 'erreur conservée après refresh');
    assert.equal(await o.focusId(p), 'resume');
    assert.equal(await p.locator('#notice').getAttribute('role'), 'status');
    assert.equal(await p.locator('#notice').getAttribute('aria-live'), 'polite');
    assert.ok(await p.locator('#notice').evaluate(e => e.classList.contains('error')));
    return { focus: await o.focusAvailable(p), error: await p.locator('#notice').textContent(), calls: await o.calls(p, 'resume'), trace: await o.trace(p) };
  },
};
