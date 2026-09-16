(function(root,factory){
 const api=factory();
 if(typeof module==='object')module.exports=api;else root.BananePairOriginDistance1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Pair Lab V1 — grandeur mesurée : distance euclidienne entre les origines
  * de profil des deux rails, dans le repère de scène exporté.
  *
  * Ce n'est PAS l'écartement ESV. Aucune équivalence n'est affirmée.
  * Les unités sont des unités de scène. Elles ne sont pas appelées millimètres :
  * physicalCalibrationStatus ne l'atteste pas. Le facteur ×10³ n'est qu'une
  * échelle d'affichage, identique à celle des chiffres déjà publiés.
  *
  * Aucun seuil, aucune cible (y compris 1436), aucune décision automatique. */
 const SCALE=1e3;
 const fini=v=>Number.isFinite(v);
 function asPoint(v){
  if(!Array.isArray(v)||v.length<3)return null;
  const p=v.slice(0,3);
  return p.every(fini)?p:null;
 }
 function originOf(rail){
  if(!rail||typeof rail!=='object')return null;
  return asPoint(rail.profileOriginSceneRelative)||asPoint(rail.positionSceneRelative);
 }
 function pairOriginDistance(leftRail,rightRail){
  const left=originOf(leftRail),right=originOf(rightRail);
  if(!left||!right)return {status:'unavailable',reason:'origin-missing',leftOrigin:left,rightOrigin:right};
  const sceneUnits=Math.hypot(left[0]-right[0],left[1]-right[1],left[2]-right[2]);
  return {
   status:'measured',
   name:'pairOriginDistance',
   sceneUnits,
   sceneUnitsTimes1e3:sceneUnits*SCALE,
   unitName:'scene-units',
   displayScale:SCALE,
   physicalCalibrationStatus:'not-attested',
   notAnEsvGauge:true,
   leftOrigin:left,
   rightOrigin:right
  };
 }
 function stats(values){
  const a=values.filter(fini).slice().sort((x,y)=>x-y);
  if(!a.length)return {count:0,mean:null,std:null,median:null,min:null,max:null};
  const mean=a.reduce((s,x)=>s+x,0)/a.length;
  const variance=a.reduce((s,x)=>s+(x-mean)*(x-mean),0)/a.length;
  const mid=a.length>>1;
  const median=a.length%2?a[mid]:(a[mid-1]+a[mid])/2;
  return {count:a.length,mean,std:Math.sqrt(variance),median,min:a[0],max:a[a.length-1]};
 }
 function pearson(xs,ys){
  if(xs.length!==ys.length||xs.length<3)return null;
  const n=xs.length,mx=xs.reduce((s,x)=>s+x,0)/n,my=ys.reduce((s,x)=>s+x,0)/n;
  let num=0,dx=0,dy=0;
  for(let i=0;i<n;i++){const a=xs[i]-mx,b=ys[i]-my;num+=a*b;dx+=a*a;dy+=b*b;}
  if(!(dx>0)||!(dy>0))return null;
  return num/Math.sqrt(dx*dy);
 }
 return {SCALE,originOf,pairOriginDistance,stats,pearson};
});
