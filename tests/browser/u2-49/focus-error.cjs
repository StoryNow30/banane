'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "focus-error", "view": "automatic", "mode": "paused", "source": "panel.js:131-135,548,873-875", "expected": "Erreur de reprise affichée dans la région live ; focus disponible sur Reprendre, erreur conservée au rafraîchissement."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

await p.evaluate(()=>__u2.fail('resume','Erreur synthétique U2 : reprise refusée'));
await key(p,'resume');await until(p,()=>document.getElementById('notice').textContent.includes('Erreur synthétique U2'));
await tick(p);assert.ok((await p.locator('#notice').textContent()).includes('Erreur synthétique U2'),'erreur conservée après refresh');
assert.equal(await focusId(p),'resume');assert.equal(await p.locator('#notice').getAttribute('role'),'status');
assert.equal(await p.locator('#notice').getAttribute('aria-live'),'polite');assert.ok(await p.locator('#notice').evaluate(e=>e.classList.contains('error')));
return {focus:await focusAvailable(p),error:await p.locator('#notice').textContent(),calls:await calls(p,'resume')};

 }};
