'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "tab-orbite-paused", "view": "automatic", "mode": "paused", "source": "panel.js:334-549 ; panel.html:1-167", "expected": "Toutes les commandes visibles et disponibles atteintes dans l’ordre DOM, retour inverse, focus visible."},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;
return {order:await tabOrder(p)};
 }};
