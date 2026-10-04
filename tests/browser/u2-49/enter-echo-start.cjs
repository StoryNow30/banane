'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "enter-echo-start", "view": "native", "mode": "idle", "source": "panel.js:873-918", "expected": "Une activation clavier transmet exactement une commande au double, sans émission à ESV."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;
const before=(await calls(p,'native-start')).length;
await key(p,'native-start','Enter');
await until(p,a=>__u2.calls.filter(c=>c.action===a).length>0,'native-start');await tick(p);
const observed=await calls(p,'native-start');assert.equal(observed.length-before,1,'une seule action');return {backendCalls:observed};
 }};
