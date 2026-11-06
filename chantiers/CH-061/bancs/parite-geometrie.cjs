/* CH-061 : parité de la géométrie. La vraie façade (chaîne du service worker) tourne trois fois sur les mêmes nuages réels :
 * src/geometry.js d'origine, `search` réécrit en JS sur tableaux typés, `search` en Rust/WASM. Sorties comparées en JSON (tous les bits).
 * Usage : node parite-geometrie.cjs [nombre de nuages] */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {charger}=require('./charger-sw.cjs'),N=require('./noyaux.js'),{nuages}=require('./nuages.cjs');
const WASM=path.join(__dirname,'../rust/target/wasm32-unknown-unknown/release/ariane_noyau.wasm');
(async()=>{
  const max=Number(process.argv[2]||Infinity);const C=nuages(max);
  const inst=(await WebAssembly.instantiate(fs.readFileSync(WASM))).instance;
  const variantes={origine:null,'js-reecrit':N.jsOpt(),'js-elague':N.jsElague(),wasm:N.wasm(inst),'wasm-elague':N.wasm(inst,'geo_search_elague')};const res={};
  for(const [nom,noyau] of Object.entries(variantes)){
    const ctx=charger(noyau?{'src/geometry.js':t=>N.variante(t,nom)}:{},{__CH061_NOYAU:noyau&&{search:noyau.search||noyau}});
    const G=ctx.BananeGeometry3,reglages={...ctx.BananeGeometry3.DEFAULTS};
    const h=crypto.createHash('sha256');const t0=performance.now();let diffs=0;
    res[nom]={sorties:C.map(c=>{const s=JSON.stringify(G.proposeBoth(c,reglages));h.update(s);return s;})};
    res[nom].ms=performance.now()-t0;res[nom].sha=h.digest('hex');
  }
  const ref=res.origine.sorties;
  for(const nom of Object.keys(res)){const d=res[nom].sorties.filter((s,i)=>s!==ref[i]).length;
    console.log(nom.padEnd(11),'nuages',C.length,'écarts',d,'sha256',res[nom].sha.slice(0,16),'ms',res[nom].ms.toFixed(0));}
  const statuts={};for(const s of ref){const o=JSON.parse(s);for(const k of ['left','right'])statuts[o[k].status]=(statuts[o[k].status]||0)+1;}
  console.log('statuts',statuts);
  fs.mkdirSync(path.join(__dirname,'../resultats'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../resultats/parite-geometrie.json'),JSON.stringify({date:new Date().toISOString(),nuages:C.length,rails:2*C.length,statuts,
    variantes:Object.fromEntries(Object.entries(res).map(([k,v])=>[k,{sha256:v.sha,ecarts:v.sorties.filter((s,i)=>s!==ref[i]).length,msNode:Math.round(v.ms)}]))},null,1));
})();
