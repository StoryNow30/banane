'use strict';
/* CH-064-L : scènes Potree reconstruites à partir des captures RÉELLES de banane-data (04, 05 et 06/11), sans rien copier ici.
 *
 * Une capture exportée (banane-lidar-capture-v1, union des vues G et D) porte, par nœud lu : sa matrice nodeToSceneRelative,
 * son nombre de points (inspected), sa boîte englobante, ses 17 sondes (positions brutes Float32 exactes) ; et, par point
 * retenu, sa position scène et son indice source (pointSources). On reconstruit chaque VUE : un nuage Potree par nuage
 * exporté, un nœud Float32 par nœud exporté, de la taille réelle, où
 *   - les points retenus sont replacés à leur indice source, en repère du nœud (inverse(model)·p, arrondi Float32) ;
 *   - les sondes sont replacées à leur indice, au bit près ;
 *   - les autres indices sont des points de remplissage tirés dans la boîte du nœud (générateur à graine fixe).
 * Les matrices des rails, les boîtes de découpe et les attributs (intensity, classification) sont ceux de l'export.
 * descriptions() rend des descriptions compactes (quelques dizaines de Ko) ; construireScene() fabrique les tampons, à
 * l'identique dans Node et dans Chromium (même texte de fonction). Aucune coordonnée n'est écrite dans les résultats. */
const {zips,entrees}=require('./ch064-corpus.cjs'),{execFileSync}=require('node:child_process'),path=require('node:path');
const C=require(path.join(__dirname,'..','vendor','capture-core.js'));
const MOTIF=/^2026-11-0[456]_/;

/* Description compacte d'une capture : {captureId, rails, vues:[{clouds:[{task,method,boxes}], nodes:[...]}]}. */
function decrire(c){
 const prefixe=s=>{const m=/^capture-(\d+)-(.*)$/.exec(s);return m?[Number(m[1]),m[2]]:[0,s];};
 const groupes=new Map(),nuages=new Map();
 c.clouds.forEach((cl,i)=>{const [o]=prefixe(cl.id);if(!nuages.has(o))nuages.set(o,[]);nuages.get(o).push(i);});
 c.nodes.forEach((n,i)=>{const [o,id]=prefixe(n.id);if(!groupes.has(o))groupes.set(o,[]);groupes.get(o).push({i,id});});
 // Points retenus par nœud fusionné ; mis en commun entre vues pour un même nœud (même id, même matrice, même compte) :
 // la fusion n'a gardé qu'un exemplaire des points communs aux deux vues.
 const parNoeud=new Map(),cle=n=>prefixe(n.id)[1]+'#'+n.inspected+'#'+(n.nodeToSceneRelative||[]).join(',');
 c.pointSources.forEach(([ni,si],k)=>{const n=c.nodes[ni],q=cle(n);if(!parNoeud.has(q))parNoeud.set(q,new Map());
  parNoeud.get(q).set(si,{p:c.pointsSceneRelative[k],it:c.attributes?.intensity?.[k]??null,cl:c.attributes?.classification?.[k]??null});});
 const offsetsN=[...groupes.keys()].sort((a,b)=>a-b),offsetsC=[...nuages.keys()].sort((a,b)=>a-b);
 if(offsetsN.length!==offsetsC.length)return null;
 const vues=offsetsN.map((o,v)=>{
  const idxNuages=nuages.get(offsetsC[v]),local=new Map(idxNuages.map((ci,k)=>[ci,k]));
  const clouds=idxNuages.map(ci=>{const k=c.clouds[ci].clipping||{};return {task:k.rawTask??null,method:k.rawMethod??null,boxes:k.boxesSceneRelativeToUnit||[]};});
  const nodes=[];
  for(const {i} of groupes.get(o)){const n=c.nodes[i];
   if(!n.nodeToSceneRelative||!Number.isInteger(n.inspected)||n.inspected<1||!local.has(n.cloudIndex))continue;
   const model=n.nodeToSceneRelative,inv=C.inverse(model),T=[model[12],model[13],model[14]];
   const pts=[],at=[];
   for(const pr of n.probes||[])if(pr.finite&&Array.isArray(pr.pointNodeLocal))pts.push([pr.sourceIndex,...pr.pointNodeLocal]);
   for(const [si,{p,it,cl}] of parNoeud.get(cle(n))||[]){if(si>=n.inspected)continue;
    const r=C.point(inv,p).map(Math.fround);pts.push([si,...r]);if(it!==null||cl!==null)at.push([si,it,cl]);}
   const bb=n.reportedGeometryBoundingBox;
   let lo,hi;if(bb&&bb.min&&bb.max){lo=bb.min.map((x,k)=>x-T[k]);hi=bb.max.map((x,k)=>x-T[k]);}
   else{lo=[Infinity,Infinity,Infinity];hi=[-Infinity,-Infinity,-Infinity];for(const q of pts)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],q[k+1]-20);hi[k]=Math.max(hi[k],q[k+1]+20);}}
   if(!lo.every(Number.isFinite)||!hi.every(Number.isFinite)){lo=[-50,-50,-5];hi=[50,50,5];}
   nodes.push({cloud:local.get(n.cloudIndex),model,count:n.inspected,lo,hi,pts,at});
  }
  return {clouds,nodes};
 });
 const rail=r=>({railMatrix:r.railLocalToSceneRelative,profileMatrix:r.profileLocalToSceneRelative,rotation:r.rotation,profileRotation:r.profileRotation});
 return {captureId:c.captureId,rails:[rail(c.rails.left),rail(c.rails.right)],vues};
}

/* Itère les descriptions (ordre stable : zip, entrée, rang), une par captureId, au plus `max`, en sautant les `saut` premières. */
function*descriptions({max=Infinity,saut=0,motif=MOTIF}={}){
 const vus=new Set();let n=0,k=0;
 for(const z of zips(motif))for(const e of entrees(z).sort()){
  const t=execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1}).toString('utf8');if(!t.includes('banane-lidar-capture-v1'))continue;
  const pile=[JSON.parse(t)];
  while(pile.length){const o=pile.pop();if(!o||typeof o!=='object')continue;
   if(o.format==='banane-lidar-capture-v1'){if(vus.has(o.captureId)||!o.nodes?.length)continue;vus.add(o.captureId);
    if(k++<saut)continue;const d=decrire(o);if(d){yield d;if(++n>=max)return;}continue;}
   const enf=Array.isArray(o)?o:Object.values(o);for(let i=enf.length-1;i>=0;i--)if(enf[i]&&typeof enf[i]==='object')pile.push(enf[i]);}
 }
}

/* Fabrique la scène d'une vue. Texte autonome : évalué tel quel dans Chromium. */
function construireScene(d,v,graine){
 let s=graine>>>0;const alea=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
 class BA{constructor(a,k){this.array=a;this.itemSize=k;this.count=a.length/k;this.version=0;this.normalized=false;}
  getX(i){return this.array[i*this.itemSize];}getY(i){return this.array[i*this.itemSize+1];}getZ(i){return this.array[i*this.itemSize+2];}}
 const vue=d.vues[v],pcs=vue.clouds.map(c=>({visible:true,parent:null,visibleNodes:[],
  material:{clipBoxes:c.boxes.map(b=>({inverse:{elements:b}})),clipPolygons:[],clipTask:c.task===null?undefined:c.task,clipMethod:c.method===null?undefined:c.method}}));
 let points=0;
 for(const n of vue.nodes){
  const N=n.count,pos=new Float32Array(3*N),it=new Uint16Array(N),cl=new Uint8Array(N);
  for(let i=0;i<N;i++){for(let k=0;k<3;k++)pos[3*i+k]=n.lo[k]+(n.hi[k]-n.lo[k])*alea();it[i]=i%4096;cl[i]=i%7;}
  for(const q of n.pts){const i=q[0];pos[3*i]=q[1];pos[3*i+1]=q[2];pos[3*i+2]=q[3];}
  for(const q of n.at){if(q[1]!==null)it[q[0]]=q[1];if(q[2]!==null)cl[q[0]]=q[2];}
  const obj={visible:true,parent:null,matrixWorld:{elements:n.model.slice()},
   geometry:{attributes:{position:new BA(pos,3),intensity:new BA(it,1),classification:new BA(cl,1)},drawRange:{start:0,count:Infinity},boundingBox:null}};
  pcs[n.cloud].visibleNodes.push({sceneNode:obj,geometryNode:null});points+=N;
 }
 const viewer={scene:{pointclouds:pcs,getActiveCamera:()=>null},renderer:null};
 const rails=d.rails.map(r=>({object:{},profile:{type:'Group',children:[]},railMatrix:r.railMatrix,profileMatrix:r.profileMatrix,rotation:r.rotation,profileRotation:r.profileRotation}));
 return {viewer,rails,origin:[0,0,0],points,enums:{ClipTask:{NONE:0,HIGHLIGHT:1,SHOW_INSIDE:2,SHOW_OUTSIDE:3},ClipMethod:{INSIDE_ANY:0,INSIDE_ALL:1}}};
}
module.exports={descriptions,decrire,construireScene,MOTIF};
