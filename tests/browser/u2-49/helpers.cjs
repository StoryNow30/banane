'use strict';
const assert=require('node:assert/strict');
class Blocked extends Error { constructor(message){super(message);this.name='Blocked';} }
const focusId=p=>p.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName);
// Interactions clavier uniquement ; focus() sert à fixer le point de départ.
async function key(p,id,key='Enter') {
 const e=p.locator('#'+id);assert.ok(await e.isVisible(),id+' visible');assert.ok(await e.isEnabled(),id+' disponible');
 await e.focus();await p.keyboard.press(key);
}
async function until(p,fn,arg){await p.waitForFunction(fn,arg,{timeout:2000,polling:20});}
async function calls(p,action){return p.evaluate(a=>__u2.calls.filter(c=>c.action===a),action);}
async function tick(p){const n=await p.evaluate(()=>__u2.views);await until(p,n=>__u2.views>n,n);}
async function available(p){return p.evaluate(()=>[...document.querySelectorAll('button,input,select,summary,a[href],[tabindex]')]
 .filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length&&getComputedStyle(e).visibility==='visible')
 .map(e=>({id:e.id||e.closest('details')?.id||e.textContent.trim(),tag:e.tagName,tabindex:e.tabIndex})));}
async function tabOrder(p){
 const expected=await available(p);assert.ok(expected.length>0);assert.ok(expected.every(e=>e.tabindex===0),'pas de tabindex positif');
 const selectors='button,input,select,summary,a[href],[tabindex]';
 await p.evaluate(sel=>[...document.querySelectorAll(sel)].find(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length)?.focus(),selectors);
 const seen=[];
 for(let i=0;i<expected.length;i++){
  const cur=await p.evaluate(()=>{const e=document.activeElement;return {id:e.id||e.closest('details')?.id||e.textContent.trim(),tag:e.tagName,tabindex:e.tabIndex};});
  seen.push(cur);
  const focusStyle=await p.evaluate(()=>{const s=getComputedStyle(document.activeElement);return {width:s.outlineWidth,style:s.outlineStyle};});
  // Tab suivant établit :focus-visible. Le premier focus programmatique n'est pas évalué.
  if(i>0)assert.ok(parseFloat(focusStyle.width)>0&&focusStyle.style!=='none','focus clavier visible : '+cur.id);
  if(i<expected.length-1)await p.keyboard.press('Tab');
 }
 assert.deepEqual(seen,expected,'ordre Tab DOM visible/disponible');
 const reversed=[];
 for(let i=expected.length-1;i>=0;i--){
  const cur=await p.evaluate(()=>{const e=document.activeElement;return {id:e.id||e.closest('details')?.id||e.textContent.trim(),tag:e.tagName,tabindex:e.tabIndex};});
  reversed.push(cur);if(i>0)await p.keyboard.press('Shift+Tab');
 }
 assert.deepEqual(reversed,[...expected].reverse(),'retour inverse sans piège');return seen;
}
async function focusAvailable(p){const id=await focusId(p);assert.notEqual(id,'BODY','focus perdu sur body');assert.notEqual(id,'HTML');
 assert.ok(await p.evaluate(()=>{const e=document.activeElement;return !e.disabled&&e.getClientRects().length>0;}),'focus sur commande disponible');return id;}
async function zoom200(p){
 const before=await p.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}));
 let zoom;
 try{zoom=await p.evaluate(async()=>{const t=await chrome.tabs.getCurrent();if(!t?.id)throw Error('tab id absent');
   await chrome.tabs.setZoom(t.id,2);return chrome.tabs.getZoom(t.id);});}
 catch(e){throw new Blocked('Zoom navigateur via chrome.tabs.setZoom refusé : '+e.message);}
 if(zoom!==2)throw new Blocked('getZoom ne confirme pas 200 % : '+zoom);
 try{await until(p,b=>devicePixelRatio>b.dpr*1.8||innerWidth<b.width*.6,before);}
 catch(e){throw new Blocked('getZoom confirme 2 mais le changement de métriques CSS/DPR n’est pas obtenu : '+e.message);}
 const after=await p.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}));
 return {method:'chrome.tabs.setZoom(2), chrome.tabs.getZoom() et métriques CSS ; viewport inchangé',zoom,before,after};
}
async function layout(p){
 const result=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
   truncated:[...document.querySelectorAll('p,label,button,summary,.lbl')].filter(e=>e.getClientRects().length)
    .filter(e=>{const s=getComputedStyle(e);return ['hidden','clip'].includes(s.overflowX)&&e.scrollWidth>e.clientWidth+1;})
    .map(e=>e.id||e.textContent.trim().slice(0,60))}));
 assert.ok(result.scroll<=result.width+1,'débordement horizontal '+JSON.stringify(result));
 assert.deepEqual(result.truncated,[],'texte tronqué');
 // Après défilement réel, centre de chaque commande visible atteignable, hors recouvrement sticky.
 const ids=await p.evaluate(()=>[...document.querySelectorAll('button,input,select,summary')]
  .filter(e=>!e.disabled&&e.getClientRects().length).map((e,i)=>{e.setAttribute('data-u2-control',String(i));return String(i);}));
 for(const id of ids){const el=p.locator('[data-u2-control="'+id+'"]');await el.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
  assert.ok(await el.evaluate(e=>{const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
    return b.width>0&&b.height>0&&b.left>=-1&&b.right<=innerWidth+1&&y>=0&&y<innerHeight&&e.contains(document.elementFromPoint(x,y));}),'commande masquée '+await el.textContent());}
 return result;
}
module.exports={assert,Blocked,key,until,calls,tick,available,tabOrder,focusId,focusAvailable,zoom200,layout};
