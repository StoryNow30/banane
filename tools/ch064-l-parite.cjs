#!/usr/bin/env node
'use strict';
/* CH-064-L : banc de PARITÉ de la lecture LiDAR (capture() de vendor/lidar.js) contre sa variante Rust/WASM et sa variante
 * JS élaguée, sur toutes les vues reconstruites des captures réelles (tools/ch064-l-scene.cjs) et sur des cas synthétiques
 * (NaN, projections infinies, budgets, Float64, entrelacé, plage de dessin partielle, normalisé, indexé…).
 *   node --max-old-space-size=6000 tools/ch064-l-parite.cjs [--moteur node|chromium] [--max N] [--saut K] [--json SORTIE]
 * Comparaison stricte (tools/ch064-comparer.cjs : Object.is sur chaque nombre, ordre des clés, exceptions) de la sortie
 * entière de capture(), horodatages retirés. Code de sortie 1 au premier écart. */
const fs=require('node:fs'),path=require('node:path');
const K=require('./ch064-l-commun.cjs'),S=require('./ch064-l-scene.cjs'),{comparer}=require('./ch064-comparer.cjs');

/* Cas synthétiques : chaque cas rend {scene, options} ; exécuté par les trois variantes. Texte autonome. */
function casSynthetiques(){
 const id=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],tr=(x,y,z)=>{const m=id();m[12]=x;m[13]=y;m[14]=z;return m;};
 let s=99;const al=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296-0.5);
 function scene({n=20000,stride=3,offset=0,type=Float32Array,inter=false,norm=false,index=false,drawRange,model=tr(10,-3,1),rot=false,nan=0,w15=null,echelle=null,gros=[],
  railG=tr(10,-3,1),railD=tr(10,-1.5,1)}={}){
  const a=new type(n*stride+offset+stride);
  for(let i=0;i<n;i++){const b=i*stride+offset;const proche=i%5===0;
   a[b]=proche?al()*1.2:al()*30;a[b+1]=proche?(i%10===0?0:1.5)+al()*0.9:al()*30;a[b+2]=proche?al()*0.7:al()*6;
   for(let k=3;k<stride;k++)a[b+k]=al();}
  for(const i of gros)a[i*stride+offset]=1e9;
  for(let k=0;k<nan;k++)a[(37*k+11)%n*stride+offset+(k%3)]=k%2?NaN:Infinity;
  const BA=inter?{array:undefined,data:{array:a,stride,version:0},isInterleavedBufferAttribute:true,offset,itemSize:3,count:n,normalized:norm,version:undefined,
   getX(i){return a[i*stride+offset];},getY(i){return a[i*stride+offset+1];},getZ(i){return a[i*stride+offset+2];}}
   :{array:a,itemSize:3,count:a.length/3|0,version:0,normalized:norm,getX(i){return a[i*3];},getY(i){return a[i*3+1];},getZ(i){return a[i*3+2];}};
  if(!inter){BA.count=n;}
  const m=model.slice();if(rot){m[0]=Math.cos(.3);m[1]=Math.sin(.3);m[4]=-Math.sin(.3);m[5]=Math.cos(.3);}
  if(w15!==null)m[15]=w15;if(echelle!==null){m[0]=echelle;m[5]=echelle;m[10]=echelle;}
  const geo={attributes:{position:BA,intensity:{array:new Uint16Array(n).map((_,i)=>i),itemSize:1,count:n,version:0,normalized:false,getX(i){return this.array[i];}}},drawRange:drawRange||{start:0,count:Infinity},boundingBox:null};
  if(index)geo.index={array:new Uint32Array(n).map((_,i)=>n-1-i),itemSize:1,count:n,version:0,getX(i){return this.array[i];}};
  const obj={visible:true,parent:null,matrixWorld:{elements:m},geometry:geo};
  const pc={visible:true,parent:null,visibleNodes:[{sceneNode:obj,geometryNode:null},{sceneNode:{...obj,geometry:{...geo,attributes:{position:{...BA}}}},geometryNode:null}],
   material:{clipBoxes:[{inverse:{elements:[0.3,0,0,0,0,0.3,0,0,0,0,0.3,0,-3,0.9,-0.3,1]}}],clipPolygons:[],clipTask:2,clipMethod:0}};
  const rail=r=>({object:{},profile:{type:'Group',children:[]},railMatrix:r,profileMatrix:r,rotation:[0,0,0,'XYZ'],profileRotation:[0,0,0,'XYZ']});
  return {viewer:{scene:{pointclouds:[pc],getActiveCamera:()=>null},renderer:null},rails:[rail(railG),rail(railD)],origin:[0.5,0.25,0],
   enums:{ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}}};
 }
 return [
  ['simple',()=>({scene:scene()})],
  ['rotation',()=>({scene:scene({rot:true})})],
  ['non-finis',()=>({scene:scene({nan:40})})],
  ['float64',()=>({scene:scene({type:Float64Array})})],
  ['entrelace-pas-5',()=>({scene:scene({stride:5,offset:1,inter:true})})],
  ['plage-partielle',()=>({scene:scene({drawRange:{start:777.6,count:9001}})})],
  ['plage-fractionnaire',()=>({scene:scene({drawRange:{start:3,count:5000.5}})})],
  ['normalise (repli JS)',()=>({scene:scene({norm:true})})],
  ['indexe (repli JS)',()=>({scene:scene({index:true})})],
  ['maxPoints-17',()=>({scene:scene(),options:{maxPoints:17}})],
  ['maxPoints-fractionnaire',()=>({scene:scene(),options:{maxPoints:100.5}})],
  ['maxInspected-5000',()=>({scene:scene(),options:{maxInspected:5000}})],
  ['maxInspected-fractionnaire',()=>({scene:scene(),options:{maxInspected:4097.25}})],
  ['yieldEvery-1000',()=>({scene:scene(),options:{yieldEvery:1000}})],
  ['yieldEvery-7',()=>({scene:scene({n:3000}),options:{yieldEvery:7}})],
  ['yieldEvery-0 (repli JS)',()=>({scene:scene({n:3000}),options:{yieldEvery:0}})],
  ['bornes-larges',()=>({scene:scene(),options:{bounds:[3,3,2]}})],
  ['bornes-NaN (repli JS)',()=>({scene:scene(),options:{bounds:[NaN,.4,.3]}})],
  ['w-non-unitaire (division faite)',()=>({scene:scene({w15:1+2**-45})})],
  ['transformation-infinie (exception)',()=>({scene:scene({echelle:1e300,gros:[5,6,4001]})})],
  ['bornes-immenses (tout retenu)',()=>({scene:scene({echelle:1e-3,model:tr(0,0,0),gros:[]}),options:{bounds:[1e300,1e300,1e300]}})],
  ['grand-pas-float64-pas-9',()=>({scene:scene({stride:9,inter:true,type:Float64Array})})],
 ];
}

async function noeudNode(arg){
 const L=K.chargerNode(),wasm=L.W.noyauWasm(fs.readFileSync(K.construireWasm())),js=L.W.noyauJs();
 const pause=()=>Promise.resolve();
 return {
  moteur:'node '+process.version,
  async vue(d,v){const sc=S.construireScene(d,v,7+v);return comparerTrois(L,sc,pause,undefined,sc.points);},
  async synth(fab){const {scene,options}=fab();return comparerTrois(L,scene,pause,options,0);},
  memoire:()=>wasm.memoireOctets(),fermer(){},relances:()=>0,tranches:()=>({wasm:wasm.tranches(),js:js.tranches()}),
  noyaux:{wasm,js}};
 async function comparerTrois(L,sc,pause,options,points){
  const o=await K.executerCapture(L.origine,sc,undefined,pause,options),w=await K.executerCapture(L.variante,sc,wasm,pause,options),j=await K.executerCapture(L.variante,sc,js,pause,options);
  const ref=K.net(o),ew=comparer(ref,K.net(w),{max:5}),ej=comparer(ref,K.net(j),{max:5});
  return {points,statut:o.erreur?'exception: '+o.erreur.message:o.sortie.status,lus:o.sortie?.quality.inspected,retenus:o.sortie?.quality.retained,
   ms:{origine:o.ms,wasm:w.ms,js:j.ms},ecartsWasm:ew,ecartsJs:ej};
 }
}

/* Chromium : une page ; relancée (navigateur neuf) si elle plante, et tous les 150 cas pour borner la mémoire du banc.
 * Une relance est comptée dans le bilan ; la vue en cours est rejouée une fois sur la page neuve. */
async function noeudChromium(){
 const {chromium}=require('playwright'),b64=fs.readFileSync(K.construireWasm()).toString('base64');
 async function ouvrir(){
  const nav=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
  const p=await nav.newPage();
  for(const f of [K.SOURCES.core,K.SOURCES.lidar,K.SOURCES.coquille])await p.addScriptTag({content:K.lire(f)});
  await p.addScriptTag({content:'(function(){const module={};'+K.lire(K.SOURCES.comparer).replace("'use strict';",'')+';window.Ch064Comparer=module.exports;})();'});
  await p.addScriptTag({content:'window.classeAttribut='+S.classeAttribut.toString()+';(typeof ArianeLidarWasm==="object"&&ArianeLidarWasm.accesseursConnus)&&ArianeLidarWasm.accesseursConnus(classeAttribut().prototype);window.construireScene='+S.construireScene.toString()+';window.executerCapture='+K.executerCapture.toString()+';window.net='+K.net.toString()+';window.casSynthetiques='+casSynthetiques.toString()+';'});
  const ua=await p.evaluate(async ({texte,b64})=>{
   (0,eval)(ArianeLidarWasm.variante(texte).replace('root.BananeLidar=api','root.LidarVariante=api'));
   const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));window.NW=ArianeLidarWasm.noyauWasm(o);window.NJ=ArianeLidarWasm.noyauJs();
   window.comparerTrois=async(sc,options,points)=>{const pause=()=>scheduler.yield();
    const o=await executerCapture(BananeLidar,sc,undefined,pause,options),w=await executerCapture(LidarVariante,sc,NW,pause,options),j=await executerCapture(LidarVariante,sc,NJ,pause,options);
    const ref=net(o),C=Ch064Comparer.comparer;
    return {points,statut:o.erreur?'exception: '+o.erreur.message:o.sortie.status,lus:o.sortie?.quality.inspected,retenus:o.sortie?.quality.retained,
     ms:{origine:o.ms,wasm:w.ms,js:j.ms},ecartsWasm:C(ref,net(w),{max:5}),ecartsJs:C(ref,net(j),{max:5})};};
   return navigator.userAgent.match(/Chrome\/[\d.]+/)[0];},{texte:K.lire(K.SOURCES.lidar),b64});
  // La variante est bien LidarVariante, distincte de BananeLidar d'origine.
  if(!await p.evaluate(()=>typeof LidarVariante?.capture==='function'&&BananeLidar!==LidarVariante))throw Error('variante non chargée');
  return {nav,p,ua};
 }
 let E=await ouvrir(),relances=0,depuis=0;
 const relancer=async()=>{await E.nav.close().catch(()=>{});E=await ouvrir();depuis=0;};
 async function appel(f){
  try{return await f(E.p);}
  catch(e){if(!/closed|crash/i.test(e.message))throw e;relances++;console.log('relance du navigateur : '+e.message.split('\n')[0]);await relancer();return f(E.p);}
 }
 return {moteur:E.ua,relances:()=>relances,
  vue:async(d,v)=>{if(++depuis>300)await relancer();
   return appel(p=>p.evaluate(async ({d,v})=>{const sc=construireScene(d,v,7+v);return comparerTrois(sc,undefined,sc.points);},{d,v}));},
  synth:(nom)=>appel(p=>p.evaluate(async nom=>{const c=casSynthetiques().find(x=>x[0]===nom)[1]();return comparerTrois(c.scene,c.options,0);},nom)),
  memoire:()=>appel(p=>p.evaluate(()=>NW.memoireOctets())),fermer:()=>E.nav.close(),
  // compte de la page courante (remis à zéro à chaque relance du navigateur)
  tranches:()=>appel(p=>p.evaluate(()=>({wasm:NW.tranches(),js:NJ.tranches()})))};
}

async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const moteur=arg('--moteur')||'node',max=Number(arg('--max')||Infinity),saut=Number(arg('--saut')||0),sortie=arg('--json');
 const M=moteur==='chromium'?await noeudChromium():await noeudNode();
 const bilan={moteur:M.moteur,date:new Date().toISOString(),synthetiques:[],vues:0,captures:0,points:0,identiquesWasm:0,identiquesJs:0,ecarts:[],
  statuts:{},msTotal:{origine:0,wasm:0,js:0},memoireWasmOctets:null};
 const noter=(nom,r)=>{const ok=!r.ecartsWasm.length,okj=!r.ecartsJs.length;if(ok)bilan.identiquesWasm++;if(okj)bilan.identiquesJs++;
  if((!ok||!okj)&&bilan.ecarts.length<20)bilan.ecarts.push({cas:nom,wasm:r.ecartsWasm,js:r.ecartsJs});return ok&&okj;};
 for(const [nom,fab] of casSynthetiques()){const r=moteur==='chromium'?await M.synth(nom):await M.synth(fab);
  const ok=noter(nom,r);bilan.synthetiques.push({cas:nom,identique:ok,statut:r.statut,lus:r.lus,retenus:r.retenus});
  console.log((ok?'=':'≠')+' '+nom+' : '+r.statut+' ('+r.lus+' lus, '+r.retenus+' retenus)');}
 const t0=Date.now();
 for(const d of S.descriptions({max,saut})){bilan.captures++;
  for(let v=0;v<d.vues.length;v++){const r=await M.vue(d,v);bilan.vues++;bilan.points+=r.points;
   noter('capture '+(saut+bilan.captures)+' vue '+v,r);bilan.statuts[r.statut]=(bilan.statuts[r.statut]||0)+1;
   for(const k in r.ms)bilan.msTotal[k]+=r.ms[k];}
  if(bilan.captures%100===0)console.log(bilan.captures+' captures, '+bilan.vues+' vues, identiques wasm '+bilan.identiquesWasm+' js '+bilan.identiquesJs+', '+((Date.now()-t0)/1000|0)+' s');
 }
 bilan.memoireWasmOctets=await M.memoire();bilan.relancesNavigateur=M.relances();bilan.tranchesNoyau=await M.tranches();await M.fermer();
 for(const k in bilan.msTotal)bilan.msTotal[k]=Math.round(bilan.msTotal[k]);
 const total=bilan.synthetiques.length+bilan.vues;bilan.identique=bilan.identiquesWasm===total&&bilan.identiquesJs===total;
 console.log(JSON.stringify({...bilan,synthetiques:undefined},null,1));
 if(sortie)fs.writeFileSync(sortie,JSON.stringify(bilan,null,1)+'\n');
 process.exit(bilan.identique?0:1);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(2);});
module.exports={casSynthetiques};
