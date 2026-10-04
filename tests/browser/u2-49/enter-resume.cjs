'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "enter-resume", "view": "automatic", "mode": "paused", "source": "panel.js:873-918", "expected": "Une activation clavier transmet exactement une commande au double, sans émission à ESV."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;
const before=(await calls(p,'resume')).length;
await key(p,'resume','Enter');
await until(p,a=>__u2.calls.filter(c=>c.action===a).length>0,'resume');await tick(p);
const observed=await calls(p,'resume');assert.equal(observed.length-before,1,'une seule action');return {backendCalls:observed};
 }};
