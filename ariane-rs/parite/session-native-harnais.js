/* CH-070 : harnais commun (Node et Chromium) du banc session-native. Un cas : {f, a, ceci}. Chaque côté reçoit SA copie
 * (structuredClone) ; la sortie comparée est {retour, etat, alias} : valeur rendue, état modifié (`this.e.s.native` et
 * arguments), et les identités que le JS garde (n.metrics.quality === n.quality ; tableau degradationLevels conservé). */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.Ch070Harnais=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function executer(cote,c){
  // cote : {poseEqual, referenceParEcriture, methodes:{nom:function}}
  const a=structuredClone(c.a),ceci=c.ceci?structuredClone(c.ceci):null;
  const native=ceci?(ceci.native!==undefined?ceci.native:{metrics:ceci.metrics}):null;
  // `this` : une instance de Sessions sans moteur (classify appelle this.chooseGeometry et this.partialReason du prototype)
  const ici=Object.create(cote.proto);ici.e={s:{native}};
  if(c.f==='poseEqual'||c.f==='referenceParEcriture')return {retour:cote[c.f](...a)};
  const l0=native&&native.metrics&&native.metrics.degradationLevels;
  const retour=cote.methodes[c.f].call(ici,...a);
  const alias={};
  if(c.f==='mergeMetrics')alias.memeTableau=l0===(native&&native.metrics&&native.metrics.degradationLevels);
  if(c.f==='accountQuality'&&a[0]&&typeof a[0]==='object')alias.qualite=a[0].metrics?.quality===a[0].quality;
  return {retour,etat:{native:ici.e.s.native,a},alias};
 }
 return {executer};
});
