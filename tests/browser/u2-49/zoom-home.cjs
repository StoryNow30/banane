'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "zoom-home", "view": "home", "mode": "idle", "source": "panel.css:32-36,187-211", "expected": "Zoom natif confirmé à 2, texte non tronqué et commandes atteignables après défilement.", "reducedMotion": "reduce"},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;
const zoom=await zoom200(p);return {zoom,layout:await layout(p)};
 }};
