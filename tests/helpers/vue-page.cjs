'use strict';
/* Page ESV simulée pour les essais « déplacer la vue » (src/adapter-page.js réel, chargé en VM) : deux rails à 1,435 m, une
 * vue orthographique de ±0,2 unité de scène centrée sur le rail sélectionné (800 × 600 px), un `click` dans la vue qui pose le
 * rail courant au pixel entier (comme ESV, D-088 P1). La navigation (molette, glisser) est celle du MODÈLE SUPPOSÉ
 * (tests/helpers/modele-navigation.js), greffé seulement si `navigation` est donné : sans lui, la vue n'écoute rien d'autre que
 * le clic, comme la maquette ESV. Tout ce que la page reçoit est consigné dans `evenements` (types et champs), pour comparer
 * les commandes d'une version à l'autre. Horloge simulée (les attentes ne durent rien). */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../../vendor/capture-core.js'),K=require('../../src/core.js'),F=require('../v242/fixtures.cjs');
const racine=path.join(__dirname,'..','..');
const ECHELLE=5,LARGEUR=800,HAUTEUR=600;
/* Repère : rails écartés le long de Y, vertical Z ; la caméra regarde vers −X (droite = +Y, haut = +Z). */
const matriceCamera=([x,y,z])=>[0,1,0,0, 0,0,1,0, 1,0,0,0, x+10,y,z,1];
function page({navigation=null,adaptateur=path.join(racine,'src/adapter-page.js'),gestes=true,settings=null,proprietaire='test'}={}){
 const left=F.rail(0,[0,0,0],0),right=F.rail(1.435,[0,0,0],0);right.children[1].children[0].geometry.attributes.position=F.buffer([[0,0,0],[0,-.035,0],[0,-.035,-.05]]);
 const root=F.object([0,0,0],'Scene');F.add(root,left);F.add(root,right);
 const projection=()=>[ECHELLE,0,0,0, 0,ECHELLE*LARGEUR/HAUTEUR,0,0, 0,0,-1e-4,0, 0,0,0,1];
 const camera={type:'OrthographicCamera',matrixWorldAutoUpdate:false,matrixWorld:{elements:matriceCamera([0,0,0])},position:{x:10,y:0,z:0},projectionMatrix:{elements:projection()}};
 let selected='left',clock=0;const nodes=new Map(),responses=new Map(),progress=[],evenements=[],ecouteurs=new Map(),fenetre=new Map(),releves=[],natifs=[];
 const pos=r=>[r.position.x,r.position.y,r.position.z];
 function recentrer(side){const p=pos(side==='left'?left:right),m=matriceCamera(p);camera.matrixWorld.elements=m;Object.assign(camera.position,{x:m[12],y:m[13],z:m[14]});
   camera.projectionMatrix.elements=projection();}
 const canvas={tagName:'CANVAS',width:LARGEUR,height:HAUTEUR,clientWidth:LARGEUR,clientHeight:HAUTEUR,getBoundingClientRect:()=>({left:0,top:0,width:LARGEUR,height:HAUTEUR}),
  closest:s=>s==='canvas'?canvas:null,
  addEventListener:(t,f)=>{(ecouteurs.get(t)||ecouteurs.set(t,[]).get(t)).push(f);},removeEventListener:(t,f)=>{const l=ecouteurs.get(t);if(l)l.splice(l.indexOf(f)>>>0,1);},
  dispatchEvent:e=>{try{e.target=canvas;}catch{}
   const champs={};for(const k of ['clientX','clientY','button','buttons','pressure','detail','deltaY','deltaMode','wheelDeltaY','pointerId','pointerType'])if(e[k]!==undefined)champs[k]=e[k];
   evenements.push({type:e.type,genre:e.constructor?.name||null,...champs});
   for(const f of fenetre.get(e.type)||[])f(e);
   for(const f of (ecouteurs.get(e.type)||[]).slice())f(e);
   if(e.type==='click'){const rail=selected==='left'?left:right,P=camera.projectionMatrix.elements,m=camera.matrixWorld.elements;
     const px=Math.trunc(e.clientX),py=Math.trunc(e.clientY),ndc=[px/LARGEUR*2-1,1-py/HAUTEUR*2];
     const dy=ndc[0]/P[0],dz=ndc[1]/P[5];const monde=[rail.position.x,m[13]+dy,m[14]+dz];
     [rail.position.x,rail.position.y,rail.position.z]=monde;rail.matrixWorld={elements:C.worldMatrix(rail)};}
   return true;}};
 for(const [id,text] of [['O2N3DCutDescription','Cut 100 of part 23'],['O2N3DCutShapeInfo','U50']])nodes.set(id,{textContent:text});
 for(const [id,side] of [['O2N3DCutLRClick','left'],['O2N3DCutRRClick','right']])nodes.set(id,{click(){evenements.push({type:'bouton',id});selected=side;recentrer(side);}});
 nodes.set('O2N3DCutValidate3DRail',{title:'Press ↵ to validate both rails (Load next non validated cut)',click(){evenements.push({type:'bouton',id:'valider'});nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';recentrer('left');}});
 nodes.set('O2N3DCutNextInvalid3DRail',{click(){evenements.push({type:'bouton',id:'suivant'});nodes.get('O2N3DCutDescription').textContent='Cut 101 of part 23';recentrer('left');}});
 class Evt{constructor(type,init={}){this.type=type;Object.assign(this,init);this.isTrusted=false;}}
 class MouseEvent extends Evt{}class PointerEvent extends MouseEvent{}class WheelEvent extends MouseEvent{}class KeyboardEvent extends Evt{}
 const S=settings?{...require('../../src/settings.js'),...settings}:require('../../src/settings.js');
 const ctx={console,window:null,location:{origin:'https://esv.example.invalid'},screenX:0,screenY:0,
  document:{getElementById:id=>nodes.get(id),dispatchEvent:e=>{evenements.push({type:e.type,key:e.key});return true;},documentElement:{append(){}},createElement:()=>({style:{},setAttribute(){}})},
  BananeCaptureCore:C,BananeCore3:K,BananeSettings:S,BananeLodSignature:require('../../src/lod-signature.js'),BananeLidar:{...require('../../vendor/lidar.js')},
  BananeNativeLidar4:require('../../src/native-lidar.js'),BananeMerge3:require('../../src/merge-clouds.js'),BananeNativePage4:require('../../src/native-page.js'),
  viewer:{scene:{scene:root,pointclouds:[],getActiveCamera:()=>camera},renderer:{domElement:canvas}},
  Date:class extends Date{static now(){return clock;}},performance:{now:()=>clock},setTimeout:(fn,ms=0)=>{clock+=ms;queueMicrotask(()=>fn());return 0;},clearTimeout:()=>{},
  setInterval:()=>0,clearInterval:()=>{},queueMicrotask,
  MouseEvent,PointerEvent,WheelEvent,KeyboardEvent,Math,
  __ARIANE_PROPRIETAIRE:proprietaire!==null?{id:proprietaire,version:K.VERSION}:undefined,
  addEventListener:(t,f)=>{(fenetre.get(t)||fenetre.set(t,[]).get(t)).push(f);},removeEventListener:(t,f)=>{const l=fenetre.get(t);if(l)l.splice(l.indexOf(f)>>>0,1);},
  postMessage:m=>{if(m.kind==='banane3:progress')progress.push(m);else if(m.kind==='banane3:releve')releves.push(m);else if(m.kind==='banane4:native-event'){natifs.push(m);}
   else if(m.kind==='banane3:result')responses.get(m.id)?.(m);},crypto:{randomUUID:K.uid}};
 ctx.window=ctx;vm.createContext(ctx);
 if(gestes)vm.runInContext(fs.readFileSync(path.join(racine,'src/gestes-vue.js'),'utf8'),ctx,{filename:'src/gestes-vue.js'});
 vm.runInContext(fs.readFileSync(adaptateur,'utf8'),ctx,{filename:'adapter-page.js'});
 if(navigation){ctx.__modeleNavigation=navigation;vm.runInContext(fs.readFileSync(path.join(__dirname,'modele-navigation.js'),'utf8'),ctx,{filename:'modele-navigation.js'});}
 const fen=vm.runInContext('window',ctx),message=data=>{for(const f of (fenetre.get('message')||[]).slice())f({source:fen,origin:ctx.location.origin,data});};
 function call(action,...args){const id=K.uid();return new Promise((resolve,reject)=>{responses.set(id,m=>m.error?reject(Error(m.error)):resolve(m.result));
   message({kind:'banane3:command',channel:'fixture',proprietaire:'test',id,action,args});});}
 /* Projection d'un point de scène dans la vue courante : NDC [x, y]. */
 const ndc=p=>{const m=camera.matrixWorld.elements,P=camera.projectionMatrix.elements;return [P[0]*(p[1]-m[13]),P[5]*(p[2]-m[14])];};
 return {ctx,left,right,root,camera,canvas,nodes,call,progress,evenements,releves,natifs,fenetre,ndc,pos,recentrer,selected:()=>selected,
   navigation:()=>ctx.__navigation||null,clock:()=>clock,advance:ms=>{clock+=ms;}};
}
/* Cible décalée de `mm` (latéral, le long de +Y pour les deux rails) depuis la pose de départ. */
function cible(f,side,mmLat,mmVert=0){const p=f.pos(side==='left'?f.left:f.right);return [p[0],p[1]+mmLat/1000,p[2]+mmVert/1000];}
module.exports={page,cible,ECHELLE,LARGEUR,HAUTEUR};
