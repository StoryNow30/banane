#!/usr/bin/env node
'use strict';
/* CH-064-D : sonde de Number::toString, String(x) de V8 contre ariane_decision::js::nombre_chaine (WASM).
 *   node tools/ch064-d-sonde-nombres.cjs [--n 1000000] [--chromium]
 * Tirages à graine fixe : bits aléatoires, décimaux arrondis au dixième et au micromètre (les arrondis des modules), entiers,
 * grands nombres (16 à 17 chiffres : départage au pair), petits (notation exponentielle), bornes. Rend les écarts. */
const fs=require('node:fs'),path=require('node:path');
const Coeur=require('../ariane-rs/coquille/coeur.js'),{construire}=require('./ch064-construire.cjs');
function tirages(n){let a=7>>>0;const r=()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
 const f=new Float64Array(1),u=new Uint32Array(f.buffer),out=[0,-0,NaN,Infinity,-Infinity,5e-324,Number.MAX_VALUE,Number.EPSILON,1e21,1e-7,1e-6,123e-20,2**53,2**53+2];
 for(let i=0;out.length<n;i++){const k=i%8;
  if(k===0){u[0]=r()*2**32;u[1]=r()*2**32;if(Number.isFinite(f[0]))out.push(f[0]);}
  else if(k===1)out.push(Math.round((r()-.5)*2e5*10)/10);
  else if(k===2)out.push(Math.round((r()-.5)*2e3*1e6)/1e6);
  else if(k===3)out.push(2**50+Math.floor(r()*2**50)+(i%16<8?0.25:0.75)); // égalités exactes à 17 chiffres : départage au pair
  else if(k===4)out.push((Math.floor(r()*2**53)+0.5)/(2**Math.floor(r()*4)));
  else if(k===5)out.push(r()*10**(Math.floor(r()*40)-20));
  else if(k===6)out.push(Math.round((r()-.5)*1e18*10)/10);
  else out.push((r()-.5)*1e-3*10**Math.floor(r()*10));}
 return out;}
if(require.main===module){const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null,n=Number(arg('--n')||1000000);
 const w=construire({silencieux:true}),octets=fs.readFileSync(w),xs=tirages(n);
 const jouer=(coeur,xs)=>{let ecarts=[],k=0;for(let i=0;i<xs.length;i+=20000){const l=xs.slice(i,i+20000),r=coeur.appeler(99,{f:'nombreChaine',a:[l]});
  for(let j=0;j<l.length;j++){k++;if(r[j]!==String(l[j]))ecarts.push([l[j].toPrecision(25),String(l[j]),r[j]]);}}return {tirages:k,ecarts:ecarts.length,premiers:ecarts.slice(0,10)};};
 if(a.includes('--chromium')){(async()=>{const {chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined});
  try{const p=await b.newPage();for(const s of ['ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js'])await p.addScriptTag({content:fs.readFileSync(path.join(__dirname,'..',s),'utf8')});
   const r=await p.evaluate(([b64,src,n,jsrc])=>{const coeur=ArianeCoeur.creer(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));const xs=(0,eval)('('+src+')')(n);const jouer=(0,eval)('('+jsrc+')');
    return {navigateur:navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0],...jouer(coeur,xs)};},[octets.toString('base64'),tirages.toString(),n,jouer.toString()]);
   console.log(JSON.stringify(r,null,1));if(r.ecarts)process.exitCode=1;}finally{await b.close();}})();}
 else{const r={moteur:'node '+process.version,...jouer(Coeur.creer(octets),xs)};console.log(JSON.stringify(r,null,1));if(r.ecarts)process.exitCode=1;}}
module.exports={tirages};
