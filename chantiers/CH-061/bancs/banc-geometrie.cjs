/* CH-061, poste « géométrie et décision de pose » : la façade proposeBoth (chaîne du service worker, src/geometry.js d'origine
 * ou `search` remplacé) sur des nuages réels, dans Chromium. Passe 1 = à froid (page neuve), passes 2-4 = à chaud.
 * Sortie : resultats/banc-geometrie.json (temps seulement, aucune coordonnée). */
'use strict';
const fs=require('fs'),path=require('path');
const {listeScripts,RACINE}=require('./charger-sw.cjs'),N=require('./noyaux.js'),{nuages}=require('./nuages.cjs'),{navigateur,page}=require('./chromium.cjs');
const W=v=>path.join(__dirname,'../rust/'+(v?'target-simd':'target')+'/wasm32-unknown-unknown/release/ariane_noyau.wasm');
const NB=Number(process.argv[2]||300);
(async()=>{
  const C=nuages(NB);const nav=await navigateur();const out={date:new Date().toISOString(),nuages:C.length,
    points:{mediane:C.map(c=>c.pointsSceneRelative.length).sort((a,b)=>a-b)[C.length>>1]},variantes:{}};
  const noyaux=fs.readFileSync(path.join(__dirname,'noyaux.js'),'utf8');
  for(const nom of (process.env.VARIANTES||'origine,origine-chrono,js-reecrit,js-elague,wasm,wasm-simd,wasm-elague').split(',')){
    const scripts=[noyaux,...listeScripts().map(f=>{const t=fs.readFileSync(path.join(RACINE,f),'utf8');return f==='src/geometry.js'&&nom!=='origine'?N.variante(t,nom):t;})];
    const p=await page(nav,scripts);
    const wasmMs=nom.startsWith('wasm')?await p.evaluate(async ({b,f})=>{const t=performance.now();const {instance}=await WebAssembly.instantiate(new Uint8Array(b));
      globalThis.__CH061_NOYAU=CH061Noyaux.wasm(instance,f);return performance.now()-t;},{b:[...fs.readFileSync(W(nom==='wasm-simd'))],f:nom==='wasm-elague'?'geo_search_elague':'geo_search'}):null;
    if(nom==='js-elague')await p.evaluate(()=>{globalThis.__CH061_NOYAU={search:CH061Noyaux.jsElague()};});
    if(nom==='js-reecrit')await p.evaluate(()=>{globalThis.__CH061_NOYAU={search:CH061Noyaux.jsOpt()};});
    if(nom==='origine-chrono')await p.evaluate(()=>{globalThis.__CH061_NOYAU={search:CH061Noyaux.origine()};});
    if(nom!=='origine')await p.evaluate(()=>{const k=__CH061_NOYAU,f=k.search;globalThis.__SMS=0;k.search=(...a)=>{const t=performance.now();try{return f.apply(k,a);}finally{__SMS+=performance.now()-t;}};});
    await p.evaluate(()=>{globalThis.__N=[];});
    for(let i=0;i<C.length;i+=10)await p.evaluate(t=>{__N.push(...JSON.parse(t));},JSON.stringify(C.slice(i,i+10)));
    const tasAvant=await p.tas();
    const r=await p.evaluate(()=>{const G=BananeGeometry3,reg={...G.DEFAULTS},passes=[];let sha='';
      for(let k=0;k<4;k++){const t=[];let s=0;for(const c of __N){const a=performance.now();const o=G.proposeBoth(c,reg);t.push(performance.now()-a);if(k===0)s+=JSON.stringify(o).length;}passes.push(t);if(k===0)globalThis.__SMS0=globalThis.__SMS||0;if(k===0)sha=s;}
      return {passes,longueur:sha,searchMs:globalThis.__SMS!=null?[__SMS0,__SMS-__SMS0]:null};});
    const tasApres=await p.tas();
    const q=(a,x)=>{a=[...a].sort((u,v)=>u-v);return +a[Math.floor(x*(a.length-1))].toFixed(2);};const s=a=>+a.reduce((u,v)=>u+v,0).toFixed(1);
    const chaud=r.passes.slice(1).flat();
    out.variantes[nom]={instanciationWasmMs:wasmMs&&+wasmMs.toFixed(2),froidMsParNuage:{mediane:q(r.passes[0],.5),p90:q(r.passes[0],.9),total:s(r.passes[0])},
      chaudMsParNuage:{mediane:q(chaud,.5),p90:q(chaud,.9),max:q(chaud,1)},longueurSorties:r.longueur,searchMsParNuage:r.searchMs&&{froid:+(r.searchMs[0]/C.length).toFixed(2),chaud:+(r.searchMs[1]/(3*C.length)).toFixed(2)},tasRetenuOctets:tasApres-tasAvant};
    console.log(nom,JSON.stringify(out.variantes[nom]));await p.close();
  }
  await nav.close();fs.mkdirSync(path.join(__dirname,'../resultats'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../resultats/banc-geometrie.json'),JSON.stringify(out,null,1));
})();
