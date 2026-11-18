#!/usr/bin/env node
'use strict';
/* D-303 : parité de la lecture LiDAR dans la configuration relevée sur ESV le 08/11 : window.THREE (r124) présent, mais les
 * attributs des nœuds appartiennent à la COPIE de three.js propre à Potree (fonctions distinctes, texte à trois tabulations).
 * Chaque vue reconstruite des captures réelles est lue par capture() d'origine et par la variante Rust ; comparaison stricte
 * (Object.is, ordre des clés, exceptions). Compte les tranches servies par le noyau : la configuration d'ESV doit être servie.
 *   BANANE_DATA=<clone> node --max-old-space-size=6000 tools/ch064-l-parite-potree.cjs [--max N] [--json SORTIE]
 * Code de sortie 1 au premier écart, ou si aucune tranche n'est servie. */
const fs=require('node:fs');
const K=require('./ch064-l-commun.cjs'),S=require('./ch064-l-scene.cjs'),{comparer}=require('./ch064-comparer.cjs');
const a=process.argv.slice(2),val=k=>{const i=a.indexOf(k);return i>=0?a[i+1]:null;};
const max=Number(val('--max')||Infinity),sortie=val('--json');
const POTREE_R124=['function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize ];\n\n\t\t}',
 'function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize + 1 ];\n\n\t\t}',
 'function ( index ) {\n\n\t\t\treturn this.array[ index * this.itemSize + 2 ];\n\n\t\t}'];
const BA=function(){};{const f=POTREE_R124.map(t=>(0,eval)('('+t+')'));BA.prototype={getX:f[0],getY:f[1],getZ:f[2]};}
const pause=()=>new Promise(r=>setTimeout(r,0));
const opts=sc=>({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,enums:sc.enums,guard:()=>{},pause,meta:{captureId:'parite-potree'}});
(async()=>{
 const L=K.chargerNode(),nw=L.W.noyauWasm(fs.readFileSync(K.construireWasm()));
 const fab=(d,v)=>{const sc=S.construireScene(d,v,7);for(const e of sc.viewer.scene.pointclouds.flatMap(p=>p.visibleNodes))Object.setPrototypeOf(e.sceneNode.geometry.attributes.position,BA.prototype);return sc;};
 let captures=0,vues=0,ecarts=0;const t0=Date.now();
 for(const d of S.descriptions({max})){captures++;
  for(let v=0;v<d.vues.length;v++){vues++;
   globalThis.ArianeLidarNoyau=undefined;let ref,w;
   try{ref=K.net({sortie:await L.origine.capture(opts(fab(d,v)))});}catch(e){ref={exception:String(e.message)};}
   globalThis.ArianeLidarNoyau=nw;
   try{w=K.net({sortie:await L.variante.capture(opts(fab(d,v)))});}catch(e){w={exception:String(e.message)};}
   const diff=comparer(ref,w,{max:3});if(diff.length){ecarts++;console.error('ÉCART',d.captureId,v,JSON.stringify(diff).slice(0,400));process.exitCode=1;}
  }
  if(captures%200===0)console.log(`${captures} captures, ${vues} vues, ${ecarts} écarts, ${nw.tranches()} tranches au noyau`);}
 globalThis.ArianeLidarNoyau=undefined;
 const r={captures,vues,ecarts,tranchesNoyau:nw.tranches(),refus:L.W.refus(),dureeS:Math.round((Date.now()-t0)/1000)};
 if(!r.tranchesNoyau){console.error('aucune tranche servie');process.exitCode=1;}
 console.log(JSON.stringify(r));if(sortie)fs.writeFileSync(sortie,JSON.stringify(r,null,1));
})().catch(e=>{console.error(e.stack);process.exit(1);});
