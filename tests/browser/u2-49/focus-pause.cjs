'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "focus-pause", "view": "automatic", "mode": "running", "source": "panel.js:334,495-516,873-875,914", "expected": "Après disparition de Pause, le focus reste sur une commande visible/disponible du panneau ; il ne se perd pas sur body."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

await key(p,'pause','Space');await until(p,()=>!document.getElementById('resume').hidden);await tick(p);
return {focus:await focusAvailable(p),calls:await calls(p,'pause')};

 }};
