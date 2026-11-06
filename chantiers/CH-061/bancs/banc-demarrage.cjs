/* CH-061, poste « démarrage du service worker » et « mémoire de base » : évaluation des scripts de background.js (ordre réel)
 * dans une page Chromium neuve, 7 fois ; compilation et instanciation du module WASM du prototype. Résultat : resultats/banc-demarrage.json. */
'use strict';
const fs=require('fs'),path=require('path');const {listeScripts,RACINE}=require('./charger-sw.cjs'),{navigateur,page}=require('./chromium.cjs');
const WASM=path.join(__dirname,'../rust/target/wasm32-unknown-unknown/release/ariane_noyau.wasm');
(async()=>{
  const textes=[...listeScripts(),'background.js'].map(f=>({f,t:fs.readFileSync(path.join(RACINE,f),'utf8')}));
  const octetsJs=textes.reduce((s,x)=>s+Buffer.byteLength(x.t),0);
  const nav=await navigateur();const res=[];
  for(let k=0;k<7;k++){const p=await page(nav,[]);
    const r=await p.evaluate(async ({textes,b})=>{gc();const h0=performance.memory.usedJSHeapSize;const t0=performance.now();
      for(const {f,t} of textes){if(f==='background.js')continue;try{(0,eval)(t+'\n//# sourceURL='+f);}catch(e){}}
      const ms=performance.now()-t0;gc();const h1=performance.memory.usedJSHeapSize;
      const u=new Uint8Array(b);const t1=performance.now();const m=await WebAssembly.compile(u);const t2=performance.now();const i=await WebAssembly.instantiate(m);const t3=performance.now();
      return {evalScriptsMs:ms,tasScriptsOctets:h1-h0,wasmCompileMs:t2-t1,wasmInstancieMs:t3-t2,wasmMemoireInitialeOctets:i.exports.memory.buffer.byteLength};},
      {textes,b:[...fs.readFileSync(WASM)]});
    res.push(r);await p.close();}
  await nav.close();const med=k=>{const a=res.map(r=>r[k]).sort((x,y)=>x-y);return +a[a.length>>1].toFixed(2);};
  const out={date:new Date().toISOString(),scripts:textes.length-1,octetsJs,wasmOctets:fs.statSync(WASM).size,
    mediane:Object.fromEntries(Object.keys(res[0]).map(k=>[k,med(k)])),essais:res.length};
  console.log(JSON.stringify(out,null,1));fs.writeFileSync(path.join(__dirname,'../resultats/banc-demarrage.json'),JSON.stringify(out,null,1));
})();
