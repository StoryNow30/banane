(function(root,factory){
 const api=factory();
 if(typeof module==='object')module.exports=api;else root.BananePairOriginDistance1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Pair Lab V1 — deux grandeurs distinctes, aucune substitution silencieuse.
  *
  * pairProfileOriginDistance (canonique)
  *   origines : rail.profileOriginSceneRelative uniquement.
  *
  * pairRailPositionDistance (secondaire)
  *   origines : rail.positionSceneRelative uniquement.
  *
  * Si le champ canonique manque, la mesure canonique est unavailable.
  * On ne recopie jamais l'autre champ.
  *
  * Ce ne sont pas l'écartement ESV. Unités de scène, pas des millimètres
  * certifiés. Aucun seuil, aucune cible (y compris 1436). */
 const SCALE=1e3;
 const CANONICAL_FIELD='profileOriginSceneRelative';
 const SECONDARY_FIELD='positionSceneRelative';
 const fini=v=>Number.isFinite(v);
 function asPoint(v){
  if(!Array.isArray(v)||v.length<3)return null;
  const p=v.slice(0,3);
  return p.every(fini)?p:null;
 }
 function originFrom(rail,field){
  if(!rail||typeof rail!=='object')return null;
  return asPoint(rail[field]);
 }
 function distance(name,field,leftRail,rightRail){
  const left=originFrom(leftRail,field),right=originFrom(rightRail,field);
  if(!left||!right)return {
   status:'unavailable',reason:field+'-missing',name,provenance:field,
   leftOrigin:left,rightOrigin:right,notAnEsvGauge:true,
   unitName:'scene-units',physicalCalibrationStatus:'not-attested'
  };
  const sceneUnits=Math.hypot(left[0]-right[0],left[1]-right[1],left[2]-right[2]);
  return {
   status:'measured',name,provenance:field,sceneUnits,
   sceneUnitsTimes1e3:sceneUnits*SCALE,unitName:'scene-units',
   displayScale:SCALE,physicalCalibrationStatus:'not-attested',
   notAnEsvGauge:true,leftOrigin:left,rightOrigin:right
  };
 }
 function pairProfileOriginDistance(leftRail,rightRail){
  return distance('pairProfileOriginDistance',CANONICAL_FIELD,leftRail,rightRail);
 }
 function pairRailPositionDistance(leftRail,rightRail){
  return distance('pairRailPositionDistance',SECONDARY_FIELD,leftRail,rightRail);
 }
 function pairOriginDistance(leftRail,rightRail){
  return pairProfileOriginDistance(leftRail,rightRail);
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
 return {
  SCALE,CANONICAL_FIELD,SECONDARY_FIELD,originFrom,
  pairProfileOriginDistance,pairRailPositionDistance,pairOriginDistance,
  stats,pearson
 };
});
