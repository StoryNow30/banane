'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "focus-view", "view": "home", "mode": "idle", "source": "panel.js:94-117 ; panel.html:35-42", "expected": "Focus conservé sur l’onglet déclencheur après changement de vue ; Tab atteint une commande disponible."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

await key(p,'tab-automatic');await until(p,()=>document.body.dataset.window==='automatic');
assert.equal(await focusId(p),'tab-automatic','navigation conserve le déclencheur');
await p.keyboard.press('Tab');assert.notEqual(await focusId(p),'BODY');
await key(p,'tab-native');await until(p,()=>document.body.dataset.window==='native');
assert.equal(await focusId(p),'tab-native');return {focus:await focusAvailable(p)};

 }};
