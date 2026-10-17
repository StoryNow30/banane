(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeDifferesEnChaine=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* 5.0 — DIFFÉRÉS EN CHAÎNE, POUR LA RÈGLE DE RELECTURE (hypothèse H1 du catalogue des échecs ; fiches/P7_DIFFERES_EN_CHAINE.md).
  *
  * Fonction PURE de post-traitement : elle dit si un cut que le lot a DIFFÉRÉ peut entrer dans la règle de correction prudente de la
  * relecture. Elle ne décide aucune pose, ne commande rien et ne lit rien d'ESV : la pose vient de la décision du lot (src/lot-decision.js,
  * non modifié), le moteur (src/engine.js) n'est pas touché. Tout lui est passé.
  *
  * Règle « jamais un cut différé » (fiches/RELECTURE_AUTONOME.md § 4) : elle vient des 4 poses sur la mauvaise voie de la pose SEULE
  * (cut visité sans appui, partie 1 du second projet). En CHAÎNE (appuis : les poses qu'Ariane vient de donner aux cuts précédents de la
  * relecture, jamais une pose de Mic), le catalogue n'en relève aucune. D'où la condition :
  *   un différé est ADMIS si
  *     1. l'option est active (`actif`, COUPÉE par défaut) ;
  *     2. sa pose vient de la CHAÎNE (variante `chaine` ou `chaine+h`) : les différés posés seuls restent exclus ;
  *     3. l'étape de la décision en chaîne pose (`etages` : first-pass, window, choice, crossing) ;
  *     4. la décision s'appuie sur au moins `appuisMin` appuis (1 au moins ; 0 est refusé).
  *   Admis, il est jugé par le reste de la règle (seuil, confiance, cohérence, étapes de la règle) SANS les deux limites des verts :
  *   rail déplacé en travers (`sansVoie`) et écartement à la médiane de la partie (`sansEcartement`). Mic déplace ces différés de 140 à
  *   233 mm : la limite des verts (45 mm) les écarterait tous.
  *
  * RISQUES (non levés ici) : une erreur d'appui se propage dans la chaîne ; au rejeu, la chaîne suit les cuts visités par Mic, dans
  * l'ordre des cuts ; une cible à plus de ~200 mm de la pose d'ESV peut sortir de la vue (D-156, « déplacer la vue » coupé). Surtout,
  * lever la limite de voie pour un différé va contre l'invariant « jamais de changement de voie » du lecteur de la relecture (45 mm au
  * plus ; poses sur la mauvaise voie mesurées de 163 à 280 mm, D-159) : une bonne pose à 200 mm et une mauvaise voie ont la même
  * taille, seule la chaîne les distingue. Il faut l'accord de Mic et de la direction avant toute écriture.
  * Le fichier de réglages garde « cut différé par le lot » dans `jamais` ; l'exception est le bloc `differesEnChaine` (un lecteur qui ne
  * le connaît pas reste fermé). */
 const ETAGES=Object.freeze(['first-pass','window','choice','crossing']);
 const DEFAUT=Object.freeze({actif:false,appuisMin:1,etages:ETAGES,sansVoie:true,sansEcartement:true});
 const entier=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;

 /* Réglages validés : chaque valeur invalide ou absente prend celle du défaut. `actif` n'est vrai que s'il vaut exactement true. */
 function reglages(f){
  const x=f&&typeof f==='object'&&!Array.isArray(f)?f:{};
  const etages=Array.isArray(x.etages)&&x.etages.length&&x.etages.every(e=>ETAGES.includes(e))?x.etages.slice():ETAGES.slice();
  return {actif:x.actif===true,appuisMin:entier(x.appuisMin,1,40)?x.appuisMin:DEFAUT.appuisMin,etages,
   sansVoie:typeof x.sansVoie==='boolean'?x.sansVoie:DEFAUT.sansVoie,sansEcartement:typeof x.sansEcartement==='boolean'?x.sansEcartement:DEFAUT.sansEcartement};}

 /* Entrée : {genre, variante, etage, appuis (nombre)}. Sortie : {admis, regle, raison, sansVoie, sansEcartement}. */
 function admet(entree,cfg=DEFAUT){
  const e=entree&&typeof entree==='object'?entree:{},R=cfg&&typeof cfg==='object'?cfg:DEFAUT;
  const non=(regle,raison)=>({admis:false,regle,raison,sansVoie:false,sansEcartement:false});
  if(R.actif!==true)return non('coupe','option « différés en chaîne » coupée');
  if(e.genre!=='differe')return non('genre','pas un cut différé par le lot');
  if(typeof e.variante!=='string'||!e.variante.startsWith('chaine'))return non('seul','différé posé seul : exclu');
  const etages=Array.isArray(R.etages)?R.etages:ETAGES;
  if(!etages.includes(e.etage))return non('etage',`étape « ${e.etage??'?'} » : pas une pose de la chaîne`);
  const min=entier(R.appuisMin,1,40)?R.appuisMin:DEFAUT.appuisMin;
  if(!(Number.isInteger(e.appuis)&&e.appuis>=min))return non('appuis',`${Number.isInteger(e.appuis)?e.appuis:'?'} appui(s) de la chaîne, ${min} au moins`);
  return {admis:true,regle:'ok',raison:`différé posé en chaîne (${e.etage}, ${e.appuis} appui${e.appuis>1?'s':''})`,
   sansVoie:R.sansVoie!==false,sansEcartement:R.sansEcartement!==false};}

 /* Même jugement sur l'entrée de la passe de relecture (rôle, jugement.etage, jugement.appuis : liste des appuis). */
 function jugerRelecture(entree,cfg=DEFAUT){
  const e=entree&&typeof entree==='object'?entree:{},j=e.jugement||{};
  return admet({genre:e.role,variante:e.variante,etage:j.etage,appuis:Array.isArray(j.appuis)?j.appuis.length:j.appuis},cfg);}

 return {DEFAUT,ETAGES,reglages,admet,jugerRelecture};
});
