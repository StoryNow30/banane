'use strict';
const H=require('./helpers.cjs');
module.exports={...{"id": "contrast-dark", "view": "automatic", "mode": "running", "source": "panel.css:13-30,78 ; audit/chantiers/qualite-480/reponse.md:19", "expected": "Tokens corrigés et couleurs calculées live/muted respectent le seuil 4,5:1 déjà adopté.", "colorScheme": "dark"},
 async run(p){const {assert,key,until,calls,tick,tabOrder,focusId,focusAvailable,zoom200,layout}=H;

const colors=await p.evaluate(()=>{
 const cs=getComputedStyle(document.documentElement);
 const tokens=Object.fromEntries(['--bg','--ok','--amber','--voie','--text-3'].map(t=>[t,cs.getPropertyValue(t).trim()]));
 const actual={live:getComputedStyle(document.getElementById('lot-etat')).color,muted:getComputedStyle(document.querySelector('.muted')).color};
 return {tokens,actual};});
const lum=color=>{const rgb=color.startsWith('#')?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):color.match(/[\d.]+/g).slice(0,3).map(Number);
 return rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const ratios=Object.fromEntries(Object.entries(colors.tokens).filter(([k])=>k!=='--bg').map(([k,v])=>[k,ratio(v,colors.tokens['--bg'])]));
for(const [token,r] of Object.entries(ratios))assert.ok(r>=4.5,token+' contraste '+r+' < seuil D-059');
for(const [selector,color] of Object.entries(colors.actual))assert.ok(ratio(color,colors.tokens['--bg'])>=4.5,selector+' couleur calculée');
return {colors,ratios,criterion:'D-059/U02 : 4,5:1 texte ordinaire ; pas une certification globale'};

 }};
