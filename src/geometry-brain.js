(function(root,factory){const api=factory(
  typeof module==='object'?require('./geometry.js'):root.BananeGeometry3,
  typeof module==='object'?require('./brain.js'):root.BananeBrain1);
 if(typeof module==='object')module.exports=api;else{
  root.BananeGeometryBrain=api;
  /* SUBSTITUTION DÉCLARÉE, PAS UN DÉTOURNEMENT.
   *
   * `src/engine.js` est GELÉ : il lie sa géométrie une seule fois, au
   * chargement, depuis `globalThis.BananeGeometry3`. Il n'existe aucun autre
   * point d'accroche — la proposition est construite ligne 95 et rangée dans
   * `this.s.proposal`, que `apply` consomme directement.
   *
   * Ce fichier se charge ENTRE `geometry.js` et `engine.js` dans la liste
   * `importScripts` de `background.js`, et y remplace `BananeGeometry3` par une
   * composition : la géométrie gelée, puis le cerveau. Trois conséquences
   * voulues :
   *   — aucun fichier gelé n'est modifié ni muté ; les quatre empreintes
   *     SHA-256 restent identiques à la référence 4.4.0 ;
   *   — la substitution est visible en UN endroit, l'ordre de chargement, et
   *     porte le nom de ce qu'elle fait ;
   *   — quand le cerveau est éteint — ce qui est le DÉFAUT — `proposeBoth`
   *     renvoie l'objet de la géométrie gelée par IDENTITÉ, pas une copie.
   *     Rien n'est touché, et un test le vérifie.
   *
   * La géométrie gelée reste accessible sous `BananeGeometryFrozen` : elle
   * n'est jamais perdue de vue. */
  root.BananeGeometryFrozen=root.BananeGeometry3;
  root.BananeGeometry3=api;
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(G,Brain){
 'use strict';
 /* Réglages issus de tools/brain-fit.cjs, ajustés sur la part 20 du corpus de
  * CORRECTIONS. Ce corpus est biaisé — il ne contient que des cuts qu'il a
  * fallu corriger : geste médian 16,92e-3 contre 3,71e-3 en travail réel sur la
  * part 6, et 80 % de rails déplacés contre 56 %. Le garde-fou latéral, tiré du
  * p90 de ce corpus, est donc probablement TROP PERMISSIF sur le travail réel
  * (p90 observé : 33e-3). C'est la raison principale pour laquelle le cerveau
  * est éteint par défaut. Voir BRAIN_V1.md. */
 const AJUSTE=Object.freeze({
  biaisVertical:0.00455,
  biaisLateral:0,
  plausibiliteLaterale:0.0502,
  ecartVerticalMax:0.0145,
  selectionActive:true,
 });
 /* Autoriser le pilote à appliquer une sélection SANS pause, en politique
  * « Tenter ». Désactivé par défaut.
  *
  * Pourquoi ce réglage existe : couper les sélections dans ce mode met la
  * sûreté à l'abri, mais empêche aussi de les OBSERVER — or c'est exactement ce
  * qu'il faut faire en ce moment, parce que le seul chiffre de fiabilité dont
  * je dispose (« une sélection sur sept très fausse ») vient du corpus de
  * corrections, dont on a depuis démontré qu'il n'est pas représentatif du
  * travail réel. Refuser d'observer au nom d'un chiffre qu'on sait douteux,
  * c'est se condamner à ne jamais le corriger.
  *
  * Le choix reste conscient : il s'active explicitement, il est écrit dans les
  * réglages exportés, et chaque sélection reste marquée dans l'export. */
 let etat={actif:false,autoriserSelectionSansPause:false,...AJUSTE};
 /* Journal du dernier passage, lu par le panneau pour montrer ce que le cerveau
  * a fait. Un post-traitement invisible serait pire que pas de post-traitement. */
 let dernier=null;

 function configure(options={}){
  const suivant={...etat,...options};
  if(typeof suivant.actif!=='boolean')throw Error('Cerveau : « actif » doit être un booléen.');
  if(typeof suivant.autoriserSelectionSansPause!=='boolean')
   throw Error('Cerveau : « autoriserSelectionSansPause » doit être un booléen.');
  for(const k of ['biaisVertical','biaisLateral'])
   if(!Number.isFinite(suivant[k]))throw Error('Cerveau : réglage invalide : '+k);
  for(const k of ['plausibiliteLaterale','ecartVerticalMax'])
   if(!(suivant[k]>0))throw Error('Cerveau : garde-fou invalide : '+k);
  /* Borne dure : au-delà, le cerveau accepterait des déplacements que
   * l'opérateur ne fait jamais. 0,15 est la limite de recherche du moteur. */
  if(suivant.plausibiliteLaterale>0.15)throw Error('Cerveau : plausibilité latérale hors du domaine de recherche.');
  etat=suivant;return {...etat};
 }
 const reglages=()=>({...etat});
 const journal=()=>dernier?JSON.parse(JSON.stringify(dernier)):null;

 function proposeBoth(capture,options={}){
  const brut=G.proposeBoth(capture,options);
  if(!etat.actif){dernier={actif:false,action:'aucune — cerveau éteint'};return brut;}
  try{
   const {actif,autoriserSelectionSansPause,...params}=etat;
   const r=Brain.corrigerPaire(brut,params);
   dernier={actif:true,perRail:r.brain.perRail,parameters:r.brain.parameters};
   return r.proposals;
  }catch(e){
   /* Le cerveau ne doit JAMAIS empêcher le moteur de répondre. En cas de
    * défaillance on rend la proposition gelée telle quelle, et on le dit. */
   dernier={actif:true,action:'échec du cerveau',erreur:e.message};
   return brut;
  }
 }
 /* Tout le reste passe à la géométrie gelée, sans interposition. */
 return {DEFAULTS:G.DEFAULTS,median:G.median,robustLine:G.robustLine,
  enforcePairSupport:G.enforcePairSupport,propose:G.propose,
  proposeBoth,configure,reglages,journal,AJUSTE,frozen:G};
});
