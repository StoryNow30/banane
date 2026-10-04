'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "reduced-motion", "view": "automatic", "mode": "running", "source": "panel.js:13-24 ; panel.css:294", "expected": "Préférence reduce réellement émulée ; CSS/pseudoéléments et Web Animations restent figés sur un cut qui change.", "reducedMotion": "reduce"},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

assert.ok(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
await p.evaluate(()=>{__u2.state.current.identity.cut=11;__u2.state.batch.activeIdentity.cut=11;});await tick(p);
const styles=await p.evaluate(()=>[...document.querySelectorAll('*')].flatMap(e=>[null,'::before','::after'].map(pseudo=>{
 const s=getComputedStyle(e,pseudo);return {el:e.id||e.tagName,pseudo,name:s.animationName,duration:s.transitionDuration};}))
 .filter(s=>s.name!=='none'||s.duration.split(',').some(x=>parseFloat(x)!==0)));
assert.deepEqual(styles,[],'CSS animations et transitions désactivées');
const animations=await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>({state:a.playState,id:a.id})));
assert.deepEqual(animations,[],'aucune animation Web Animations en cours');
return {styles,animations,cut:await p.locator('#lot-cut').textContent()};

 }};
