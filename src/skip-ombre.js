(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeSkipOmbre=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* SK EN OMBRE (5.0, chantier CH-016, D-172, D-241) : « ce cut ressemble à un cut à SKIP ».
  *
  * Règle de l'opérateur (D-172) : un cut est à SKIP si AUCUN POINT ne s'affiche, ou si UN SEUL SCANNER s'affiche. Ariane n'envoie
  * jamais de SKIP (D-241) : ce module détecte pour mesurer, rien d'autre.
  *   - « aucun-point » : `min` captures complètes de suite (2 par défaut) sans aucun point près des deux rails (`quality.perRail`,
  *     sinon les points de la capture). Une seule capture vide ne suffit pas (visites brèves : fausses alertes de l'étude).
  *   - « un-scanner » : seulement si la capture PORTE l'identifiant de source des points (`attributes.pointSourceId`, ou
  *     `attributes.scannerId`) et que toutes les captures n'en comptent qu'un, avec des points. Les captures actuelles d'ESV n'ont
  *     que l'intensité et la classe : le nombre de scanners est alors NON MESURABLE (`scanners:null`, `scannersMesurables:false`),
  *     jamais supposé. La règle reste prête pour le jour où l'identifiant arrive.
  *
  * MODULE PUR : aucune dépendance, aucune entrée-sortie, aucune commande. Il n'est importé ni par le moteur, ni par la décision du lot,
  * ni par background.js (essai `tests/skip-ombre.test.cjs`). L'événement `skip-ombre` qu'il fabrique est un enregistrement pour le
  * journal : `skipEnvoye:false`, `commande:null`. */
 const VERSION='skip-ombre-v1';
 const REGLE=Object.freeze({version:VERSION,min:2});
 const SIDES=['left','right'];
 const CHAMPS_SOURCE=['pointSourceId','scannerId'];
 /* Points par rail (ou seulement le total) d'une capture ; null si illisible. */
 function pointsDe(capture){
   const q=capture?.quality?.perRail;
   if(q&&SIDES.every(s=>Number.isInteger(q[s])))return {left:q.left,right:q.right,total:q.left+q.right};
   const n=Array.isArray(capture?.pointsSceneRelative)?capture.pointsSceneRelative.length:null;
   return n===null?null:{left:null,right:null,total:n};
 }
 /* Nombre de scanners distincts si la capture le dit, sinon null. */
 function scannersDe(capture){
   const a=capture?.attributes;
   for(const k of CHAMPS_SOURCE){
     const v=a?.[k];
     if(Array.isArray(v)&&v.length>0)return new Set(v).size;
   }
   return null;
 }
 function comptes(capture){
   const p=pointsDe(capture);
   return {points:p,scanners:scannersDe(capture)};
 }
 /* Détection sur les captures successives d'un même cut (la plus récente en dernier). */
 function detecter(captures,{min=REGLE.min}={}){
   const liste=(Array.isArray(captures)?captures:[captures]).filter(Boolean),cs=liste.map(comptes);
   const premier=cs[0]||null,n=liste.length;
   const vides=cs.filter(c=>c.points&&c.points.total===0).length;
   const mesurables=n>0&&cs.every(c=>c.scanners!==null);
   const scanners=mesurables?Math.max(...cs.map(c=>c.scanners)):null;
   let raison=null;
   if(n>=min&&vides===n)raison='aucun-point';
   else if(n>=min&&mesurables&&cs.every(c=>c.scanners===1&&c.points&&c.points.total>0))raison='un-scanner';
   return {version:VERSION,raison,points:premier&&premier.points?{left:premier.points.left,right:premier.points.right}:null,
     scanners,scannersMesurables:mesurables,captures:n,capturesVides:vides};
 }
 /* Événement de journal (lecture seule) pour un cut. */
 function evenement(identity,detection){
   return {type:'skip-ombre',version:VERSION,identity:identity||null,raison:detection.raison,points:detection.points,
     scanners:detection.scanners,scannersMesurables:detection.scannersMesurables,captures:detection.captures,
     capturesVides:detection.capturesVides,skipEnvoye:false,commande:null};
 }
 return {VERSION,REGLE,pointsDe,scannersDe,detecter,evenement};
});
