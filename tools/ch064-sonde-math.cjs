#!/usr/bin/env node
'use strict';
/* CH-064 : sonde de sémantique numérique. Compare, bit à bit (Object.is), les fonctions de std de Rust compilées en WASM
 * et leurs portages ariane-js à Math.* de la V8 qui exécute ce script (Node ; dans Chromium par --chromium).
 *   node tools/ch064-sonde-math.cjs [--tirages N] [--json SORTIE] [--chromium]
 * Entrées : générateur congruentiel à graine fixe, à l'échelle des nuages (± 0,1 m) et des angles (± 10 rad). */
const fs=require('node:fs'),path=require('node:path');const {construire}=require('./ch064-construire.cjs');
function sonder(exports,N){
 let s=12345;const rnd=()=>{s=(s*1103515245+12345)%2147483648;return s/2147483648;};
 const g1=()=>[(rnd()-.5)*20],gp=()=>[rnd()*10],g2=()=>[(rnd()-.5)*.2,(rnd()-.5)*.2],g3=()=>[(rnd()-.5)*.2,(rnd()-.5)*.2,(rnd()-.5)*3];
 const gr=()=>[rnd()<.5?Math.floor((rnd()-.5)*20)+.5:(rnd()-.5)*1e4];
 const gz=()=>[[-0,0,NaN,1,-1][Math.floor(rnd()*5)],[-0,0,NaN,1,-1][Math.floor(rnd()*5)]];
 const cas=[['sin',Math.sin,g1],['cos',Math.cos,g1],['exp',Math.exp,g1],['ln',Math.log,gp],['ln_1p',Math.log1p,gp],['log10',Math.log10,gp],
  ['powf',Math.pow,()=>[rnd()*10,(rnd()-.5)*6]],['hypot',Math.hypot,g2],['hypot3',Math.hypot,g3],['round',Math.round,gr],['max',Math.max,gz],['min',Math.min,gz],['sign',Math.sign,g1]];
 const res={};
 for(const [nom,ref,gen] of cas)for(const pre of ['std','js']){const f=exports[pre+'_'+nom];if(!f)continue;let d=0;
  for(let i=0;i<N;i++){const a=gen();if(!Object.is(f(...a),ref(...a)))d++;}res[pre+'_'+nom]=d;}
 return res;
}
module.exports={sonder};
if(require.main===module){
 const a=process.argv.slice(2),N=Number(a[a.indexOf('--tirages')+1])||200000,json=a.includes('--json')?a[a.indexOf('--json')+1]:null;
 const w=construire({silencieux:true});if(!w){console.error('cargo absent');process.exit(2);}
 /* le cœur importe les transcendantes du moteur (env.js_*) : mêmes imports que la coquille */
 const {IMPORTS}=require('../ariane-rs/coquille/coeur.js');
 const exports=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(w)),IMPORTS).exports;
 const out={format:'ch064-sonde-math-v1',moteur:'node '+process.version+' (V8 '+process.versions.v8+')',tirages:N,divergences:sonder(exports,N)};
 if(a.includes('--chromium')){
  const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();
   const v=await p.evaluate(async([b64,src,N])=>{const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const env={js_sin:Math.sin,js_cos:Math.cos,js_tan:Math.tan,js_atan2:Math.atan2,js_exp:Math.exp,js_log:Math.log,js_log10:Math.log10,js_log1p:Math.log1p,js_pow:Math.pow};const e=new WebAssembly.Instance(new WebAssembly.Module(o),{env}).exports;
    const module={};eval(src);return {ua:navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],div:module.exports.sonder(e,N)};},[fs.readFileSync(w).toString('base64'),
    'module.exports={sonder:'+sonder.toString()+'};',N]);await b.close();
   out.chromium={moteur:v.ua,divergences:v.div};fin(out,json);})().catch(e=>{console.error(e);process.exit(1);});
 }else fin(out,json);
}
function fin(out,json){const t=JSON.stringify(out,null,1);if(json)fs.writeFileSync(json,t+'\n');console.log(t);}
