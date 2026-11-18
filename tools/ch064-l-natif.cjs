#!/usr/bin/env node
'use strict';
/* CH-064-L : temps du noyau en Rust NATIF (option B) sur des vues réelles, contre le même noyau en WASM et en JS élagué (Node).
 *   node --max-old-space-size=6000 tools/ch064-l-natif.cjs [--captures N] [--pas P] [--dossier TEMP]
 * Les tampons des vues reconstruites (tools/ch064-l-scene.cjs) et leurs matrices sont écrits dans un fichier TEMPORAIRE hors
 * du dépôt (défaut : dossier du système), lu par l'exemple Rust `natif` (cargo run --release --example natif), puis effacé.
 * Mesure : noyau seul (toutes les tranches de 4 096 points de tous les nœuds), 15 répétitions, médiane par vue.
 * Ce n'est PAS l'option B entière : sortir les tampons de la page jusqu'au programme coûte 256 ms par vue (CH-064, banc-b). */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const K=require('./ch064-l-commun.cjs'),S=require('./ch064-l-scene.cjs');
const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
const N=Number(arg('--captures')||10),PAS=Number(arg('--pas')||400),dossier=fs.mkdtempSync(path.join(arg('--dossier')||os.tmpdir(),'ch064-l-'));
const L=K.chargerNode(),C=L.C,W=L.W.noyauWasm(fs.readFileSync(K.construireWasm())),J=L.W.noyauJs();
const fichier=path.join(dossier,'vues.bin'),morceaux=[],res=[];
const u32=x=>{const b=Buffer.alloc(4);b.writeUInt32LE(x);return b;};
function noeuds(sc){const inv=L.origine.inventory(sc.viewer),frames=sc.rails.map(r=>C.serialRail(r,sc.origin));
 return inv.nodes.map(n=>{const model=C.rebase(n.world,sc.origin),tr=frames.map(f=>C.multiply(f.sceneRelativeToProfileLocal,model));
  const M=new Float64Array(131);M.set(model,0);M.set(C.inverse(model),16);M.set(tr[0],32);M.set(tr[1],48);
  M.set(frames[0].profileLocalToSceneRelative,64);M.set(frames[1].profileLocalToSceneRelative,80);M.set(frames[0].sceneRelativeToProfileLocal,96);M.set(frames[1].sceneRelativeToProfileLocal,112);M.set([.5,.4,.3],128);
  return {M,src:n.position.array,count:n.attribute.count,args:[model,C.inverse(model),tr,frames,[.5,.4,.3]]};});}
function tour(N,ns){let pts=0;for(const n of ns){N.debutNoeud(...n.args);const Ld={src:n.src,stride:3,offset:0,f64:false,capacite:4096};let rt=0;
 for(let di=0;di<n.count;){const t=N.tranche(Ld,di,Math.min(4096,n.count-di),Infinity,rt);rt=t.retour;di+=t.traites;pts+=t.traites;}}return pts;}
const med=f=>{f();const v=[];for(let i=0;i<15;i++){const t=performance.now();f();v.push(performance.now()-t);}v.sort((x,y)=>x-y);return v[7];};
let k=0;
for(const d of S.descriptions()){if(k++%PAS)continue;
 for(let v=0;v<d.vues.length;v++){const sc=S.construireScene(d,v,7+v),ns=noeuds(sc);
  res.push({points:sc.points,wasm:med(()=>tour(W,ns)),js:med(()=>tour(J,ns))});
  morceaux.push(u32(ns.length));for(const n of ns){morceaux.push(Buffer.from(n.M.buffer),u32(n.count),Buffer.from(n.src.buffer,n.src.byteOffset,3*n.count*4));}}
 if(res.length>=2*N)break;}
fs.writeFileSync(fichier,Buffer.concat([u32(res.length),...morceaux]));
const r=spawnSync('cargo',['run','--release','-q','-p','ariane-lidar','--example','natif','--',fichier],{cwd:path.join(K.RACINE,'ariane-rs'),encoding:'utf8'});
fs.rmSync(dossier,{recursive:true,force:true});
if(r.status!==0)throw Error(r.stderr);
const natif=r.stdout.trim().split('\n').map(Number);res.forEach((x,i)=>{x.natif=natif[i];});
const q=(x,f)=>{const s=x.slice().sort((u,v)=>u-v);return +s[Math.min(s.length-1,Math.floor(f*(s.length-1)))].toFixed(2);};
const out={date:new Date().toISOString(),node:process.version,vues:res.length,pointsParVue:q(res.map(x=>x.points),.5)};
for(const c of ['natif','wasm','js'])out[c]={msParVue:{mediane:q(res.map(x=>x[c]),.5),p90:q(res.map(x=>x[c]),.9)},nsParPoint:q(res.map(x=>x[c]*1e6/x.points),.5)};
console.log(JSON.stringify(out,null,1));if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(out,null,1)+'\n');
