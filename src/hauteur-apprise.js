(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./placement-convention.js'));
  else root.BananeHauteurApprise=factory(root.BananeCaptureCore,root.BananePlacementConvention);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,Convention){
 'use strict';
 /* HAUTEUR APPRISE, EN OMBRE (5.0, chantier « hauteur apprise », fiches/HAUTEUR_APPRISE.md).
  *
  * 70 des 85 faux verts relus (parties 17, 24, 29 du premier projet, partie 1 du second) viennent de la HAUTEUR du rail :
  * l'opérateur garde le minimum d'Ariane et ne corrige que la hauteur (fiches/FAUX_VERTS.md). Le sens de sa correction
  * est en partie prévisible, rail par rail, à partir de deux signaux connus À LA DÉCISION :
  *   - le GROUPE du rail : calage de convention appliqué (le dessus est monté au 90e centile des points du dessus) ou
  *     refusé (`shift-out-of-domain` : rail posé brut), lu dans la science du cut (`conventionCalibration`) ;
  *   - l'ÉPAISSEUR de la bande des points du dessus à la pose DÉCIDÉE (90e moins 10e centile des écarts verticaux au gabarit,
  *     `placement-convention.js` `bandOffsets`, comme `faux-vert-ombre.js`).
  * Modèle (appris sur les quatre parties, validé en les retenant chacune à tour de rôle) :
  *   correction = part × (a + b × épaisseur), par groupe, bornée à ± `plafondMm` ; « + » = vers le haut, repère profil du rail.
  * Rail calé : l'opérateur descend un dessus épais (b < 0), de la moitié seulement de la droite apprise (`part` 0,5).
  * Rail refusé : l'opérateur remonte le rail posé brut, moins quand le dessus est épais.
  * ABSTENTION (correction nulle, motif consigné) : étage hors `etages` (ornière d'un PN), calage absent ou ni appliqué ni
  * refusé hors domaine, bande du dessus indisponible ou de moins de `pointsDessusMin` points.
  *
  * CE MODULE NE DÉCIDE RIEN ET NE COMMANDE RIEN. `src/lot-decision.js` consigne son résultat dans la décision
  * (`hauteurApprise`, réglage `hauteurApprise.actif`) : à côté de la pose réelle, la pose corrigée. Le chemin qui la
  * poserait (`hauteurActivation`, `commandRails`) existe mais il est COUPÉ (`hauteurApprise.appliquer:false`) : il change
  * la pose, seul l'opérateur l'ouvrira, après une mesure en ombre sur des parties neuves. Aucune référence humaine n'entre
  * ici : la capture, la science du cut et la décision seulement. Valeurs figées : datasets/reglages-figes.json
  * (`hauteurApprise`). */
 const VERSION='hauteur-apprise-v1';
 const MODELE=Object.freeze({version:VERSION,forme:'lineaire-epaisseur',plafondMm:5,pointsDessusMin:15,
   etages:Object.freeze(['first-pass','window','choice']),
   applique:Object.freeze({a:3.28,b:-0.5,part:0.5}),
   refuse:Object.freeze({a:17.89,b:-1.14,part:1})});
 const SIDES=['left','right'];
 const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
 const um=v=>Math.round(v*1e6)/1e6;
 /* Groupe du rail d'après le calage de convention de la science : 'applique', 'refuse' (hors domaine, posé brut), sinon null. */
 function groupe(cal){
   if(!cal)return null;
   if(cal.applied===true)return 'applique';
   if(cal.applied===false&&cal.reason==='shift-out-of-domain')return 'refuse';
   return null;
 }
 function deltaDe(rail,p){
   const M=rail.sceneRelativeToProfileLocal,a=C.point(M,p),o=C.point(M,rail.positionSceneRelative);
   return [a[0]-o[0],a[1]-o[1],a[2]-o[2]];
 }
 /* Signaux d'un rail à la pose décidée. */
 function signalRail(capture,science,side,position){
   const cal=science?.rails?.[side]?.conventionCalibration||null,rail=capture?.rails?.[side];
   let n=null,nf=null,ep=null;
   if(rail?.sceneRelativeToProfileLocal&&Array.isArray(position)){
     const b=Convention.bandOffsets(capture,side,deltaDe(rail,position));
     if(b.ok){n=b.top.length;nf=b.face.length;ep=n?Convention.quantile(b.top,.9)-Convention.quantile(b.top,.1):null;}
   }
   return {groupe:groupe(cal),calage:cal?(cal.applied===true?'applique':(cal.reason||'refuse')):null,
     dzMm:Number.isFinite(cal?.dzMm)?r1(cal.dzMm):null,duMm:Number.isFinite(cal?.duMm)?r1(cal.duMm):null,
     epaisseurDessusMm:r1(ep),pointsDessus:n,pointsFlanc:nf};
 }
 /* Les signaux d'une décision qui pose (sinon null). */
 function signaux({capture,science,decision}){
   if(!decision?.positions||!capture?.rails||!SIDES.every(s=>Array.isArray(decision.positions[s])))return null;
   return {etage:decision.stage??null,rails:Object.fromEntries(SIDES.map(s=>[s,signalRail(capture,science,s,decision.positions[s])]))};
 }
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const groupeValide=g=>g&&fini(g.a)&&fini(g.b)&&fini(g.part);
 /* Le modèle effectif : le modèle figé, chaque champ remplaçable par un réglage valide. */
 function modeleDe(reglage){
   const m={...MODELE};
   if(reglage){
     if(fini(reglage.plafondMm)&&reglage.plafondMm>=0)m.plafondMm=reglage.plafondMm;
     if(fini(reglage.pointsDessusMin))m.pointsDessusMin=reglage.pointsDessusMin;
     if(Array.isArray(reglage.etages))m.etages=reglage.etages.slice();
     for(const g of ['applique','refuse'])if(groupeValide(reglage[g]))m[g]={a:reglage[g].a,b:reglage[g].b,part:reglage[g].part};
   }
   return m;
 }
 /* Correction verticale (mm, + vers le haut) d'un rail, ou abstention avec son motif. */
 function correctionRail(sig,etage,modele=MODELE){
   const m=modele;
   if(!m.etages.includes(etage))return {correctionMm:0,abstention:'etage'};
   if(!sig||!sig.groupe)return {correctionMm:0,abstention:'calage'};
   if(!fini(sig.pointsDessus)||sig.pointsDessus<m.pointsDessusMin||!fini(sig.epaisseurDessusMm))return {correctionMm:0,abstention:'dessus-peu-observe'};
   const g=m[sig.groupe];if(!groupeValide(g))return {correctionMm:0,abstention:'modele'};
   const brut=g.part*(g.a+g.b*sig.epaisseurDessusMm),borne=Math.sign(brut)*Math.min(Math.abs(brut),m.plafondMm);
   const mm=r1(borne);
   return {correctionMm:mm===0?0:mm,abstention:null,...(Math.abs(brut)>m.plafondMm?{borne:true}:{})};
 }
 /* Déplacement de `mm` vers le haut dans le repère profil du rail (repère scène). */
 function versLeHaut(rail,mm){
   const P=rail.profileLocalToSceneRelative,a=C.point(P,[0,0,0]),b=C.point(P,[0,0,mm/1000]);
   return b.map((v,i)=>v-a[i]);
 }
 /* Résultat de l'ombre pour une décision qui pose ; null sans pose. */
 function evaluer({capture,science,decision,reglage}){
   const sig=signaux({capture,science,decision});
   if(!sig)return null;
   const m=modeleDe(reglage),rails={};
   for(const side of SIDES){
     const s=sig.rails[side],c=correctionRail(s,sig.etage,m),pose=decision.positions[side],rail=capture.rails[side];
     const out={groupe:s.groupe,calage:s.calage,dzMm:s.dzMm,epaisseurDessusMm:s.epaisseurDessusMm,pointsDessus:s.pointsDessus,
       correctionMm:c.correctionMm,abstention:c.abstention,...(c.borne?{borne:true}:{}),reelle:pose.map(um)};
     if(c.correctionMm!==0&&rail?.profileLocalToSceneRelative){const h=versLeHaut(rail,c.correctionMm);out.corrigee=pose.map((v,i)=>um(v+h[i]));}
     rails[side]=out;
   }
   return {version:VERSION,etage:sig.etage,repere:'profil du rail, + = vers le haut',
     modele:{plafondMm:m.plafondMm,applique:{...m.applique},refuse:{...m.refuse}},rails};
 }
 return {VERSION,MODELE,groupe,signaux,signalRail,modeleDe,correctionRail,evaluer};
});
