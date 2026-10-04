'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "hidden-disabled", "view": "automatic", "mode": "busy", "source": "panel.js:334-549 ; panel.html:1-167", "expected": "Start désactivé et Pause cachée exclus de la tabulation ; Start ne produit aucune commande."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

assert.ok(await p.locator('#start-batch').isDisabled());assert.ok(await p.locator('#pause').isHidden());
await tabOrder(p); // aucune activation forcée d’une commande indisponible
await p.locator('#start-batch').focus();await p.keyboard.press('Enter');await p.keyboard.press('Space');
assert.equal((await calls(p,'start')).length,0);assert.equal((await calls(p,'pause')).length,0);
return {startCalls:await calls(p,'start'),pauseCalls:await calls(p,'pause')};

 }};
