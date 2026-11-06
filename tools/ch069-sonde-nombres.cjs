#!/usr/bin/env node
'use strict';
/* CH-069 : essai différentiel du chemin rapide de nombre_en_chaine (chantiers/CH-069/ariane-js-nombre-rapide.patch) contre
 * String(x) du moteur JS, dans Node et dans Chromium : cœur construit avec le patch (copie hors suivi).
 *   node tools/ch069-sonde-nombres.cjs [--n 10000000] [--chromium]
 * Tirages à graine fixe : n doubles sur TOUS les motifs de bits (finis), les n tirages de tools/ch064-sonde-nombres.cjs
 * (dont les milieux exacts à 17 chiffres), puis les cas dits : sous-normaux, puissances de 10, 2^53 ± 1, ± 2^k, entiers
 * proches de 2^53, milieux connus. Code 1 au premier écart. */
const fs=require('node:fs'),path=require('node:path');
const C=require('./ch069-commun.cjs'),Coeur=require('../ariane-rs/coquille/coeur.js'),{tirages}=require('./ch064-sonde-nombres.cjs');
function bits(n,graine){let a=graine>>>0;const r=()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return (t^t>>>14)>>>0;};
 const f=new Float64Array(1),u=new Uint32Array(f.buffer),out=[];while(out.length<n){u[0]=r();u[1]=r();if(Number.isFinite(f[0]))out.push(f[0]);}return out;}
function dits(){const o=[];const f=new Float64Array(1),u=new BigUint64Array(f.buffer);
 for(let i=1n;i<200000n;i+=1n){u[0]=i*22517998136n%4503599627370496n||1n;o.push(f[0],-f[0]);}
 for(let e=-323;e<=308;e++){o.push(Number('1e'+e),Number('5e'+e),Number('9.999999999999999e'+e));}
 for(let k=-1074;k<=1023;k++)o.push(2**k,2**k*1.5);
 for(let d=-2000;d<=2000;d++)o.push(2**53+d,2**53-d,2**52+d+0.5,2**51+d+0.25,2**51+d+0.75,1e21+d*131072,1e15+d+0.5);
 o.push(9007199254740991,9007199254740993,-9007199254740991,1860313443422875.2,1860313443422875.25,0.1,0.2,0.3,1/3,Number.MIN_VALUE,Number.MAX_VALUE,-0,0);
 return o;}
function jouer(coeur,xs){let ecarts=[],k=0;for(let i=0;i<xs.length;i+=20000){const l=xs.slice(i,i+20000),r=coeur.appeler(2,{a:l});
 for(let j=0;j<l.length;j++){k++;if(r[j]!==String(l[j]))ecarts.push([l[j].toPrecision(25),String(l[j]),r[j]]);}}return {tirages:k,ecarts:ecarts.length,premiers:ecarts.slice(0,10)};}
async function principal(){
 const a=process.argv.slice(2),n=Number(a.includes('--n')?a[a.indexOf('--n')+1]:1e7);
 const w=C.construireCoeur({patchs:[C.PATCH_NOMBRE]}),octets=fs.readFileSync(w);
 const lots={bits:()=>bits(n,69),ch064:()=>tirages(n),dits};
 if(!a.includes('--chromium')){const out={moteur:'node '+process.version};const coeur=Coeur.creer(octets);
  for(const [k,g] of Object.entries(lots))out[k]=jouer(coeur,g());return out;}
 const {chromium}=require('playwright'),b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 try{const p=await b.newPage();for(const s of ['ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js'])await p.addScriptTag({content:fs.readFileSync(path.join(C.RACINE,s),'utf8')});
  return await p.evaluate(([b64,n,src])=>{const coeur=ArianeCoeur.creer(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));const S=(0,eval)('('+src+')');
   const out={moteur:navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]};for(const [k,g] of Object.entries(S.lots(n)))out[k]=S.jouer(coeur,g);return out;},
   [octets.toString('base64'),n,`{lots:n=>({bits:(${bits})(n,69),ch064:(${tirages})(n),dits:(${dits})()}),jouer:${jouer}}`]);}finally{await b.close();}
}
if(require.main===module)principal().then(r=>{console.log(JSON.stringify(r,null,1));if(['bits','ch064','dits'].some(k=>r[k].ecarts))process.exitCode=1;}).catch(e=>{console.error(e);process.exit(1);});
