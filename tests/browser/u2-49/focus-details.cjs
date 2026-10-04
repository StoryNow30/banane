'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "focus-details", "view": "automatic", "mode": "idle", "source": "panel.js:325-329,919 ; panel.html:149-163", "expected": "Le tiroir est cohérent avec aria-expanded, garde le focus du bouton, exclut ses enfants fermés."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

await key(p,'lot-details-toggle');assert.ok(await p.locator('#lot-details').isHidden());
assert.equal(await focusId(p),'lot-details-toggle');assert.equal(await p.locator('#lot-details-toggle').getAttribute('aria-expanded'),'false');
await tabOrder(p);
await key(p,'lot-details-toggle','Space');assert.ok(await p.locator('#lot-details').isVisible());
assert.equal(await focusId(p),'lot-details-toggle');assert.equal(await p.locator('#lot-details-toggle').getAttribute('aria-expanded'),'true');
await key(p,'lot-details-toggle');await p.keyboard.press('Tab');
assert.equal(await p.evaluate(()=>!!document.activeElement.closest('#lot-details')),false);
return {focus:await focusAvailable(p)};

 }};
