'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "motion-control", "view": "automatic", "mode": "running", "source": "panel.css:95,274-294", "expected": "Le témoin no-preference présente une animation réelle : la vérification reduce n’est pas vide.", "reducedMotion": "no-preference"},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

assert.ok(await p.evaluate(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches));
const styles=await p.locator('#lot-etapes [data-e="capture"]').evaluate(e=>({animation:getComputedStyle(e,'::before').animationName,transition:getComputedStyle(e).transitionDuration}));
assert.notEqual(styles.animation,'none','témoin positif : animation existe sans réduction');return styles;

 }};
