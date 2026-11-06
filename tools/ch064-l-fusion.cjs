#!/usr/bin/env node
'use strict';
/* CH-064-L : coût, dans Chromium, des étapes JS de la lecture qui suivent capture(), pour décider de leur portage :
 *   merge (src/merge-clouds.js, union des vues G et D, une fois par cut) et ses parts numériques portables : clés de
 *   dédoublonnage (p.join('|')) et recomptage perRail (C.point + inBox par point fusionné) ;
 *   compactNodes + messageBytes (JSON.stringify de la capture fusionnée) ;
 *   signature du niveau de détail (src/lod-signature.js, toutes les 80 ms pendant l'attente du chargement), inventaire compris.
 *   node --max-old-space-size=6000 tools/ch064-l-fusion.cjs [--captures N] [--pas P] [--rep R] [--json SORTIE]
 * Vues reconstruites des captures réelles (tools/ch064-l-scene.cjs), lues par vendor/lidar.js d'origine. */
const fs=require('node:fs');
const K=require('./ch064-l-commun.cjs'),S=require('./ch064-l-scene.cjs');
async function main(){
 const a=process.argv.slice(2),arg=k=>a.includes(k)?a[a.indexOf(k)+1]:null;
 const N=Number(arg('--captures')||20),PAS=Number(arg('--pas')||200),R=Number(arg('--rep')||15),sortie=arg('--json');
 const {chromium}=require('playwright'),nav=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
 const p=await nav.newPage();
 await p.addScriptTag({content:'window.threeSynthetique='+S.threeSynthetique.toString()+';window.THREE=threeSynthetique();'});
 for(const f of [K.SOURCES.core,K.SOURCES.lidar,'src/core.js','src/merge-clouds.js','src/lod-signature.js'])await p.addScriptTag({content:K.lire(f)});
 await p.addScriptTag({content:'window.classeAttribut='+S.classeAttribut.toString()+';window.construireScene='+S.construireScene.toString()+';'});
 const mes=[];let k=0;
 for(const d of S.descriptions()){if(k++%PAS)continue;if(d.vues.length!==2)continue;
  const r=await p.evaluate(async ({d,R})=>{
   const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1];};
   const t=f=>{f();const v=[];for(let i=0;i<R;i++){const t0=performance.now();f();v.push(performance.now()-t0);}return med(v);};
   const identite={project:'banc',part:1,cut:1,shape:'s'},vues=[];
   for(let v=0;v<2;v++){const sc=construireScene(d,v,7+v);
    const o=await BananeLidar.capture({viewer:sc.viewer,rails:sc.rails,origin:sc.origin,enums:sc.enums,guard:()=>{},pause:()=>scheduler.yield(),meta:{captureId:'v'+v,identity:identite}});
    vues.push({o,sc});}
   const [A,B]=vues.map(x=>x.o),fus=BananeMerge3.merge(A,B);
   const objets=new Map(),id=o=>{if(!objets.has(o))objets.set(o,'id-'+objets.size);return objets.get(o);};
   const sig=()=>BananeLodSignature.signature(BananeLidar.inventory(vues[0].sc.viewer),id);
   return {points:A.pointsSceneRelative.length+B.pointsSceneRelative.length,fusionnes:fus.pointsSceneRelative.length,noeuds:fus.nodes.length,
    mergeMs:t(()=>BananeMerge3.merge(A,B)),
    clesMs:t(()=>{const s=new Map();for(const c of [A,B])for(const q of c.pointsSceneRelative){const k=q.join('|');if(!s.has(k))s.set(k,s.size);}}),
    parRailMs:t(()=>{for(const sd of ['left','right'])fus.pointsSceneRelative.filter(q=>BananeCaptureCore.point(fus.rails[sd].sceneRelativeToProfileLocal,q).every((x,i)=>Math.abs(x)<=fus.scope.halfExtentsProfileLocal[i])).length;}),
    compacterEtMesurerMs:t(()=>{const c={...fus,nodes:fus.nodes.slice(),warnings:fus.warnings.slice()};BananeMerge3.compactNodes(c);BananeMerge3.messageBytes(c);}),
    octetsMessage:BananeMerge3.messageBytes(fus),
    signatureMs:t(sig),inventaireMs:t(()=>BananeLidar.inventory(vues[0].sc.viewer))};
  },{d,R});
  mes.push(r);console.log(mes.length,JSON.stringify(r));if(mes.length>=N)break;
 }
 await nav.close();
 const q=(x,f)=>{const s=x.slice().sort((u,v)=>u-v);return +s[Math.min(s.length-1,Math.floor(f*(s.length-1)+1e-9))].toFixed(3);};
 const res={date:new Date().toISOString(),captures:mes.length,repetitions:R,resume:{}};
 for(const c of Object.keys(mes[0]))res.resume[c]={mediane:q(mes.map(m=>m[c]),.5),p90:q(mes.map(m=>m[c]),.9)};
 console.log(JSON.stringify(res,null,1));if(sortie)fs.writeFileSync(sortie,JSON.stringify({...res,parCapture:mes},null,1)+'\n');
}
main().catch(e=>{console.error(e);process.exit(2);});
