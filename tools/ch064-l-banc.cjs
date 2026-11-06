#!/usr/bin/env node
'use strict';
/* CH-064-L : banc de TEMPS et de MÉMOIRE de la lecture LiDAR dans Chromium (/opt/pw-browsers/chromium), machine au repos.
 *   node --max-old-space-size=6000 tools/ch064-l-banc.cjs [--captures N] [--pas P] [--rep R] [--json SORTIE]
 * Vues reconstruites des captures réelles (une capture sur P, N captures, deux vues chacune ; tools/ch064-l-scene.cjs).
 * Par vue, R répétitions à chaud de capture() (échauffement exclu), variantes entrelacées :
 *   origine   : vendor/lidar.js tel quel ;
 *   js-elague : la même variante, boucle par point remplacée par le noyau JS sans allocation (coquille, noyauJs) ;
 *   wasm      : la même variante, noyau Rust/WASM (copie des tranches dans l'arène comprise).
 * Pauses : scheduler.yield() (chemin « rapide » du lot, comme CH-061) ; --pause timeout : setTimeout(0), pause par défaut de
 * capture() (lecture « référence »). Médiane par vue, puis médiane et p90 des vues ;
 * aussi en ms pour 505 000 points (volume de vue de CH-061).
 * Mémoire : tas JS (performance.memory, précis) au plus haut pendant la lecture (relevé à chaque pause) et retenu par la
 * sortie après gc ; mémoire linéaire du WASM avant, au plus haut et après ; coût de compilation et d'instanciation. */
const fs=require('node:fs');
const K=require('./ch064-l-commun.cjs'),S=require('./ch064-l-scene.cjs');
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const N=Number(arg('--captures')||30),PAS=Number(arg('--pas')||150),R=Number(arg('--rep')||15),sortie=arg('--json'),PAUSE=arg('--pause')||'yield';
 const b64=fs.readFileSync(K.construireWasm()).toString('base64');
 // Pour le choix de l'export (module autonome ou lien dans le cœur) : taille et compilation du cœur actuel, sans la lecture.
 const {spawnSync}=require('node:child_process'),path=require('node:path');
 spawnSync('cargo',['build','--release','--target','wasm32-unknown-unknown','-p','ariane-coeur'],{cwd:path.join(K.RACINE,'ariane-rs')});
 const coeur64=fs.readFileSync(path.join(K.RACINE,'ariane-rs/target/wasm32-unknown-unknown/release/ariane_coeur.wasm')).toString('base64');
 const {chromium}=require('playwright'),nav=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--enable-precise-memory-info','--js-flags=--expose-gc']});
 const p=await nav.newPage();
 for(const f of [K.SOURCES.core,K.SOURCES.lidar,K.SOURCES.coquille])await p.addScriptTag({content:K.lire(f)});
 await p.addScriptTag({content:'window.classeAttribut='+S.classeAttribut.toString()+';(typeof ArianeLidarWasm==="object"&&ArianeLidarWasm.accesseursConnus)&&ArianeLidarWasm.accesseursConnus(classeAttribut().prototype);window.construireScene='+S.construireScene.toString()+';'});
 const init=await p.evaluate(async ({texte,b64,coeur64})=>{
  (0,eval)(ArianeLidarWasm.variante(texte).replace('root.BananeLidar=api','root.LidarVariante=api'));
  const o=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const compil=[],inst=[];let mod;
  for(let k=0;k<11;k++){let t=performance.now();mod=new WebAssembly.Module(o);compil.push(performance.now()-t);t=performance.now();ArianeLidarWasm.noyauWasm(mod);inst.push(performance.now()-t);}
  const med=x=>x.slice(1).sort((u,v)=>u-v)[(x.length-1)>>1];
  window.NW=ArianeLidarWasm.noyauWasm(mod);window.NJ=ArianeLidarWasm.noyauJs();
  const oc=Uint8Array.from(atob(coeur64),c=>c.charCodeAt(0)),cc=[];
  for(let k=0;k<11;k++){const t=performance.now();new WebAssembly.Module(oc);cc.push(performance.now()-t);}
  return {coeurSansLidarOctets:oc.length,coeurCompilationMs:med(cc),ua:navigator.userAgent.match(/Chrome\/[\d.]+/)[0],moduleOctets:o.length,compilationMs:med(compil),instanciationMs:med(inst),memoireWasmInitiale:NW.memoireOctets()};
 },{texte:K.lire(K.SOURCES.lidar),b64,coeur64});
 console.log(init);
 const vues=[];let k=0;
 for(const d of S.descriptions()){if(k++%PAS)continue;
  for(let v=0;v<d.vues.length;v++){
   const r=await p.evaluate(async ({d,v,R,PAUSE})=>{
    const sc=construireScene(d,v,7+v);let pic=0,pausesMs=0,pauses=0,noyauMs=0;
    const attendre=PAUSE==='timeout'?()=>new Promise(r=>setTimeout(r,0)):()=>scheduler.yield();
    const pause=async()=>{const u=performance.memory.usedJSHeapSize;if(u>pic)pic=u;const t=performance.now();await attendre();pausesMs+=performance.now()-t;pauses++;};
    // Noyaux chronométrés (tranche entière : copie, appel, vues) ; deux lectures d'horloge par tranche de 4 096 points.
    const chrono=N=>({...N,tranche(...x){const t=performance.now();const r=N.tranche(...x);noyauMs+=performance.now()-t;return r;}});
    const CW=chrono(NW),CJ=chrono(NJ);
    const run=async(L,N)=>{globalThis.ArianeLidarNoyau=N;pausesMs=0;pauses=0;noyauMs=0;const t=performance.now();
     const o=await L.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,enums:sc.enums,guard:()=>{},pause,meta:{captureId:'banc'}});
     const ms=performance.now()-t;globalThis.ArianeLidarNoyau=undefined;return {ms,o,pausesMs,pauses,noyauMs};};
    const V=[['origine',BananeLidar,undefined],['js-elague',LidarVariante,CJ],['wasm',LidarVariante,CW]];
    const ms={origine:[],'js-elague':[],wasm:[]},part={origine:[],'js-elague':[],wasm:[]},tas={},memW={avant:NW.memoireOctets(),haut:0};
    for(let rep=0;rep<=R;rep++)for(const [nom,L,N] of (rep%2?V.slice().reverse():V)){const x=await run(L,N);if(rep){ms[nom].push(x.ms);part[nom].push([x.noyauMs,x.pausesMs,x.pauses]);}
     if(nom==='wasm')memW.haut=Math.max(memW.haut,NW.memoireOctets());}
    // Mémoire par variante, à froid du tas : gc, lecture (pic relevé à chaque pause), gc, tas retenu par la sortie.
    for(const [nom,L,N] of V){gc();gc();const base=performance.memory.usedJSHeapSize;pic=base;const x=await run(L,N);const picL=pic;gc();
     tas[nom]={picPendantLectureOctets:picL-base,retenuParLaSortieOctets:performance.memory.usedJSHeapSize-base,retenus:x.o.quality.retained};x.o=null;}
    memW.apres=NW.memoireOctets();
    const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
    return {points:sc.points,noeuds:sc.viewer.scene.pointclouds.reduce((n,pc)=>n+pc.visibleNodes.length,0),
     med:{origine:med(ms.origine),'js-elague':med(ms['js-elague']),wasm:med(ms.wasm)},
     noyau:{'js-elague':med(part['js-elague'].map(x=>x[0])),wasm:med(part.wasm.map(x=>x[0]))},
     pausesMs:{origine:med(part.origine.map(x=>x[1])),'js-elague':med(part['js-elague'].map(x=>x[1])),wasm:med(part.wasm.map(x=>x[1]))},pauses:part.wasm[0][2],tas,memW};
   },{d,v,R,PAUSE});
   vues.push(r);console.log(vues.length,r.points,r.noeuds,JSON.stringify(r.med));
  }
  if(vues.length>=2*N)break;
 }
 await nav.close();
 const q=(x,f)=>{const s=x.slice().sort((u,v)=>u-v);return +s[Math.min(s.length-1,Math.floor(f*(s.length-1)+1e-9))].toFixed(2);};
 const res={date:new Date().toISOString(),...init,pause:PAUSE==='timeout'?'setTimeout(0) (lecture « référence »)':'scheduler.yield() (lecture « rapide »)',repetitions:R,vues:vues.length,captures:N,pas:PAS,
  pointsParVue:{mediane:q(vues.map(v=>v.points),.5),p90:q(vues.map(v=>v.points),.9)},noeudsParVue:{mediane:q(vues.map(v=>v.noeuds),.5)},variantes:{}};
 for(const nom of ['origine','js-elague','wasm']){
  const t=vues.map(v=>v.med[nom]),n=vues.map(v=>v.med[nom]*505000/v.points),pz=vues.map(v=>v.pausesMs[nom]);
  res.variantes[nom]={msParVue:{mediane:q(t,.5),p90:q(t,.9)},msPour505000Points:{mediane:q(n,.5),p90:q(n,.9)},
   pausesMsParVue:{mediane:q(pz,.5),p90:q(pz,.9)},horsPausesMsParVue:{mediane:q(vues.map(v=>v.med[nom]-v.pausesMs[nom]),.5),p90:q(vues.map(v=>v.med[nom]-v.pausesMs[nom]),.9)},
   ...(nom==='origine'?{}:{noyauMsParVue:{mediane:q(vues.map(v=>v.noyau[nom]),.5),p90:q(vues.map(v=>v.noyau[nom]),.9)}}),
   tasPicPendantLectureMo:{mediane:q(vues.map(v=>v.tas[nom].picPendantLectureOctets/2**20),.5),max:q(vues.map(v=>v.tas[nom].picPendantLectureOctets/2**20),1)},
   tasRetenuParLaSortieMo:{mediane:q(vues.map(v=>v.tas[nom].retenuParLaSortieOctets/2**20),.5)}};
 }
 res.memoireWasm={avant:Math.max(...vues.map(v=>v.memW.avant)),hauteEau:Math.max(...vues.map(v=>v.memW.haut)),apres:Math.max(...vues.map(v=>v.memW.apres))};
 res.pausesParVue={mediane:q(vues.map(v=>v.pauses),.5)};
 res.parVue=vues.map(v=>({points:v.points,noeuds:v.noeuds,ms:v.med,noyau:v.noyau,pausesMs:v.pausesMs}));
 console.log(JSON.stringify({...res,parVue:undefined},null,1));
 if(sortie)fs.writeFileSync(sortie,JSON.stringify(res,null,1)+'\n');
}
main().catch(e=>{console.error(e);process.exit(2);});
