/* CH-053-C — définition ASSOUPLIE de l'« état initial qualifié » d'un rail, hors ligne, lecture seule.
 *
 * Définition stricte (src/native-session.js, chooseGeometry) : un instantané qualifié existe dont la pose de rail est celle
 * de l'état initial et qui a été acquis avant le premier geste. Elle perd les cuts dont la 1re capture est interrompue (découpe
 * qui bouge, geste de l'opérateur) et dont l'instantané suivant a été pris rail déplacé.
 *
 * Définition assouplie : MÊMES critères que chooseGeometry (couverture, source stable, découpe vérifiée, transformation, repère,
 * unités, reçu de stockage, identité, durée), sauf trois, relâchés un à un et nommés :
 *   - pose : l'instantané peut avoir été pris rail déplacé. Ses points sont en repère scène, indépendants de la pose du rail ;
 *     la couverture est RECALCULÉE dans le repère de l'état initial (si les points sont dans l'export) ; sans les points, seul
 *     un écart de pose ≤ tolérance est accepté ;
 *   - intention : l'instantané peut avoir été acquis après le geste de l'opérateur (même raison : les points ne bougent pas) ;
 *   - découpe reclassée (piste 2 de native-lidar.js) : un bloc `reclassified-to-current-clip` est accepté.
 * Elle exige en plus que l'ÉTIQUETTE ne change pas : la pose de départ de l'étiquette (`startPose`) doit être celle de l'état
 * initial à la tolérance près. Le nuage ne sert jamais à fabriquer l'étiquette (pose finale et correction viennent de la
 * référence humaine et de la pose de départ) ; l'essai d'accord le montre sur les cuts qui satisfont les deux définitions.
 */
(function(root,factory){
 const api=factory(typeof module==='object'?require('./native-session.js'):root.BananeNativeSession4,
  typeof module==='object'?require('../vendor/capture-core.js'):root.BananeCaptureCore,
  typeof module==='object'?require('./native-lidar.js'):root.BananeNativeLidar4);
 if(typeof module==='object')module.exports=api;else root.BananeNativeReconstruction=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Session,C,Lidar){
 'use strict';
 const SIDES=['left','right'],TOL_MM=1;
 const pos=rail=>Array.isArray(rail?.positionSceneRelative)&&rail.positionSceneRelative.length===3?rail.positionSceneRelative:null;
 const distMm=(a,b)=>{const p=pos(a),q=pos(b);return p&&q?Math.hypot(...q.map((v,i)=>v-p[i]))*1000:null;};
 const clone=v=>JSON.parse(JSON.stringify(v));
 const choose=(record,side)=>Session.Sessions.prototype.chooseGeometry.call({},record,side);

 /* Étiquette (pose finale, correction) d'un rail par rapport à une pose de départ donnée, en mm. */
 function etiquette(record,side,depart){
  const fin=pos(record.humanFinalReference?.state?.rails?.[side]),d=pos(depart);
  if(!fin||!d)return null;
  return {finale:fin.slice(),correctionMm:fin.map((v,i)=>(v-d[i])*1000)};
 }
 const memeEtiquette=(a,b,tolMm=TOL_MM)=>!!a&&!!b&&a.correctionMm.every((v,i)=>Math.abs(v-b.correctionMm[i])<=tolMm)&&a.finale.every((v,i)=>Math.abs(v-b.finale[i])*1000<=tolMm);

 /* Couverture d'un instantané recalculée dans le repère `base` (état initial), à partir des points de ses blocs. */
 function couvertureDansRepere(snapshot,base,nuages,settings){
  const inv=base?.sceneRelativeToProfileLocal;if(!Array.isArray(inv)||inv.length!==16)return {status:'indisponible',raison:'repere-initial-absent'};
  const acc=Lidar.coverageAccumulator(settings);let lus=0;
  for(const id of snapshot.chunkIds||[]){const c=nuages.get(id);
   if(!c||!Array.isArray(c.pointsSceneRelative))return {status:'indisponible',raison:'points-absents'};
   c.pointsSceneRelative.forEach((p,i)=>{lus++;if(c.visibleByClipBoxes&&c.visibleByClipBoxes[i]!==true)return;
    const local=C.point(inv,p);if(local.every((v,k)=>Math.abs(v)<=settings.bounds[k]))acc.add(local);});}
  const cov=Lidar.coverageFrom(acc,settings,{valid:true},'same-target-and-rail-pose',null);
  return {status:cov.status,couverture:cov,pointsLus:lus};
 }

 /* État initial d'un rail : stricte si chooseGeometry l'accepte, sinon reconstruction par un instantané du même cut. */
 function reconstruireRail(record,side,{nuages=null,tolMm=TOL_MM,settings=Lidar.DEFAULTS}={}){
  const stricte=choose(record,side);
  if(stricte.status==='qualified-candidate')return {qualifie:true,voie:'stricte',captureId:stricte.captureId,chunkIds:stricte.chunkIds,raisons:[]};
  const before=record.beforeEstablished?.rails?.[side];
  if(!before)return {qualifie:false,voie:null,raisons:['etat-initial-absent']};
  const depart=record.startPose?.rails?.[side]||before,ecartEtiquette=distMm(before,depart);
  if(ecartEtiquette===null||ecartEtiquette>tolMm)return {qualifie:false,voie:null,raisons:['pose-de-depart-etiquette-differente-de-etat-initial'],ecartEtiquetteMm:ecartEtiquette};
  const refus=[];
  for(const snap of record.railSnapshots?.[side]||[]){
   const copie=clone(record);
   copie.railSnapshots={[side]:[clone(snap)]};
   copie.beforeEstablished={...copie.beforeEstablished,rails:{...copie.beforeEstablished.rails,[side]:clone(snap.rail)}};   // relâche « pose »
   copie.operatorIntents=[];                                                                                              // relâche « intention »
   const reclasse=snap.clipStatus==='reclassified-to-current-clip';
   if(reclasse)copie.railSnapshots[side][0].clipStatus='verified-classifiable';                                          // relâche « découpe »
   const g=choose(copie,side);
   if(g.status!=='qualified-candidate'){refus.push(...g.reasons);continue;}
   const ecartPose=distMm(before,snap.rail),memePose=ecartPose!==null&&ecartPose<=tolMm;
   let couverture=null;
   if(!memePose){
    if(!nuages){refus.push('pose-differente-points-absents');continue;}
    couverture=couvertureDansRepere(snap,before,nuages,settings);
    if(couverture.status!=='qualified-candidate'){refus.push('couverture-repere-initial-insuffisante');continue;}
   }
   const intention=record.operatorIntents?.[0],apresIntention=!!intention&&Date.parse(snap.acquiredThroughAt)>Date.parse(intention.observedAt||'');
   return {qualifie:true,voie:reclasse?'reclasse-decoupe':memePose?'instantane-meme-pose':'instantane-pose-differente',captureId:snap.captureId,snapshotId:snap.snapshotId,chunkIds:snap.chunkIds.slice(),
    ecartPoseMm:ecartPose,apresIntention,couverture,raisons:[]};
  }
  return {qualifie:false,voie:null,raisons:[...new Set(refus.length?refus:stricte.reasons)]};
 }

 function reconstruireCut(record,options){
  const rails=Object.fromEntries(SIDES.map(side=>[side,reconstruireRail(record,side,options)]));
  return {qualifie:SIDES.every(side=>rails[side].qualifie),stricte:SIDES.every(side=>rails[side].voie==='stricte'),rails};
 }

 return {reconstruireRail,reconstruireCut,etiquette,memeEtiquette,couvertureDansRepere,distMm,TOL_MM};
});
