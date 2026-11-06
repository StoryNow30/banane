/* CH-061 : charge, dans un contexte vm, les modules du service worker dans l'ordre de background.js
 * (jusqu'à gcv2-l1.js), pour appeler la vraie façade de géométrie sans rien modifier. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const RACINE=path.resolve(__dirname,'../../..');
function listeScripts(){
  const bg=fs.readFileSync(path.join(RACINE,'background.js'),'utf8');
  const m=bg.match(/importScripts\(([\s\S]*?)\);/);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
}
function charger(substituts={},extra={}){
  const ctx={console,setTimeout,clearTimeout,performance,crypto:globalThis.crypto,structuredClone,TextEncoder,TextDecoder,
    chrome:{storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{}},indexedDB:undefined,navigator:{},
    Blob:globalThis.Blob,URL};
  Object.assign(ctx,extra);ctx.globalThis=ctx;ctx.self=ctx;vm.createContext(ctx);
  for(const f of listeScripts()){
    try{const txt=fs.readFileSync(path.join(RACINE,f),'utf8');vm.runInContext(substituts[f]?substituts[f](txt):txt,ctx,{filename:f});}
    catch(e){/* modules qui exigent le navigateur : signalés, pas bloquants */ctx.__echecs=(ctx.__echecs||[]).concat(f+': '+e.message);}
  }
  return ctx;
}
module.exports={charger,listeScripts,RACINE};
