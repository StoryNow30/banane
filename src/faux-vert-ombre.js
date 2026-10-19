(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./placement-convention.js'));
  else root.BananeFauxVertOmbre=factory(root.BananeCaptureCore,root.BananePlacementConvention);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,Convention){
 'use strict';
 /* FAUX VERT EN OMBRE (5.0, chantier « faux verts », fiches/FAUX_VERTS.md).
  *
  * Un faux vert est un cut qu'Ariane valide et que l'opérateur corrige de plus de 10 mm. Sur les 85 faux verts relus
  * (parties 17, 24, 29 du premier projet, partie 1 du second), la cause dominante est VERTICALE : le dessus du rail est
  * ambigu (bande de points du dessus épaisse), le calage de convention monte ou descend le rail de plusieurs millimètres,
  * et l'opérateur le pose ailleurs dans cette bande. Ce module lit, À LA DÉCISION, deux signaux de la science du cut :
  *   - `dzMm` : décalage vertical que le calage de convention a mesuré sur le rail publié par le moteur (appliqué ou
  *     refusé, `science.rails[side].conventionCalibration.dzMm`) ;
  *   - `epaisseurDessusMm` : épaisseur de la bande des points du dessus (90e moins 10e centile des écarts verticaux au
  *     gabarit, `placement-convention.js` `bandOffsets`) à la pose DÉCIDÉE (`decision.positions`).
  * Règle « hauteur ambiguë » : un même rail porte |dzMm| ≥ `dzMinMm` ET `epaisseurDessusMm` ≥ `epaisseurMinMm` → verdict
  * « différer », sinon « valider ». Aucune référence humaine n'entre ici : seulement la capture, la science et la décision.
  *
  * CE MODULE NE DÉCIDE RIEN ET NE COMMANDE RIEN. `src/lot-decision.js` consigne son verdict dans la décision
  * (`fauxVertOmbre`, réglage `fauxVertOmbre.actif`) ; le chemin d'activation (différer un cut « différer » au lieu de le
  * valider, `commandRails`) existe mais il est COUPÉ (`fauxVertOmbre.differer:false`). Ouvert, il ne pourrait que
  * différer : jamais une pose nouvelle. Les seuils sont figés dans datasets/reglages-figes.json (`fauxVertOmbre`). */
 const VERSION='faux-vert-ombre-v1';
 const REGLE=Object.freeze({version:VERSION,dzMinMm:11,epaisseurMinMm:14});
 const SIDES=['left','right'];
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
 /* Décalage (m) d'une position scène dans le repère profil de la pose de départ d'ESV du rail. */
 function deltaDe(rail,p){
   const M=rail.sceneRelativeToProfileLocal,a=C.point(M,p),o=C.point(M,rail.positionSceneRelative);
   return [a[0]-o[0],a[1]-o[1],a[2]-o[2]];
 }
 function bande(capture,side,position){
   const rail=capture?.rails?.[side];
   if(!rail?.sceneRelativeToProfileLocal||!Array.isArray(position))return null;
   const b=Convention.bandOffsets(capture,side,deltaDe(rail,position));
   if(!b.ok)return null;
   const n=b.top.length;
   return {pointsDessus:n,pointsFlanc:b.face.length,
     epaisseurDessusMm:n?r1(Convention.quantile(b.top,.9)-Convention.quantile(b.top,.1)):null};
 }
 /* Les signaux d'une décision qui pose (sinon null). */
 function signaux({capture,science,decision}){
   if(!decision?.positions||!capture?.rails||!SIDES.every(s=>Array.isArray(decision.positions[s])))return null;
   const rails={};
   for(const side of SIDES){
     const cal=science?.rails?.[side]?.conventionCalibration||null,b=bande(capture,side,decision.positions[side]);
     rails[side]={dzMm:Number.isFinite(cal?.dzMm)?r1(cal.dzMm):null,
       calage:cal?(cal.applied===true?'applique':(cal.reason||'refuse')):null,
       epaisseurDessusMm:b?.epaisseurDessusMm??null,pointsDessus:b?.pointsDessus??null,pointsFlanc:b?.pointsFlanc??null};
   }
   return {rails};
 }
 function seuilsDe(reglage){
   const v=(k)=>Number.isFinite(reglage?.[k])?reglage[k]:REGLE[k];
   return {dzMinMm:v('dzMinMm'),epaisseurMinMm:v('epaisseurMinMm')};
 }
 const suspect=(r,s)=>r.dzMm!==null&&Math.abs(r.dzMm)>=s.dzMinMm&&r.epaisseurDessusMm!==null&&r.epaisseurDessusMm>=s.epaisseurMinMm;
 /* Verdict de l'ombre pour une décision qui pose ; null sans pose. */
 function evaluer({capture,science,decision,reglage}){
   const sig=signaux({capture,science,decision});
   if(!sig)return null;
   const seuils=seuilsDe(reglage),railsSuspects=SIDES.filter(side=>suspect(sig.rails[side],seuils));
   return {version:VERSION,verdict:railsSuspects.length?'differer':'valider',motif:railsSuspects.length?'hauteur-ambigue':null,
     railsSuspects,rails:sig.rails,seuils};
 }
 return {VERSION,REGLE,signaux,evaluer,seuilsDe};
});
