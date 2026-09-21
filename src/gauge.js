(function(root,factory){const api=factory();
 if(typeof module==='object')module.exports=api;else root.BananeGauge4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* Contrat d'écartement de la paire de rails — SOURCE DE VÉRITÉ UNIQUE.
  *
  * Les trois bornes ci-dessous sont les seules valeurs métier du module. Tout
  * le reste en dérive, y compris l'ancien classement de plage et l'ancienne
  * lecture du texte ESV : aucune borne n'est réécrite ailleurs.
  *
  * Ce module ne DÉCIDE rien. Il classe une valeur en millimètres. La décision
  * appartient aux couches GCV1 et moteur, et un hors-contrat y est une
  * ABSTENTION : il n'existe plus aucun outcome SKIP dans ce fichier, parce
  * qu'aucun chemin automatique ne doit pouvoir dériver un SKIP d'une mesure.
  * Le SKIP reste une décision de l'opérateur seul. */
 const CONTRACT=Object.freeze({version:'gauge-contract-v2',
   lowMm:1405,      // en dessous : hors contrat
   nominalMm:1430,  // à partir d'ici : nominal
   maximumMm:1470});// au-delà : hors contrat
 const CLASSES=Object.freeze({LOW:'LOW_INVALID',TOLERANCE:'TOLERANCE',NOMINAL:'NOMINAL',
   HIGH:'HIGH_INVALID',INDETERMINATE:'INDETERMINATE'});
 /* La comparaison porte sur la valeur numérique, jamais sur un affichage
  * arrondi : aucun toFixed, aucune tolérance de frontière. */
 function classifyMm(valueMm){
   if(!Number.isFinite(valueMm))return CLASSES.INDETERMINATE;
   if(valueMm<CONTRACT.lowMm)return CLASSES.LOW;
   if(valueMm<CONTRACT.nominalMm)return CLASSES.TOLERANCE;
   if(valueMm<=CONTRACT.maximumMm)return CLASSES.NOMINAL;
   return CLASSES.HIGH;
 }
 const admissible=gaugeClass=>gaugeClass===CLASSES.TOLERANCE||gaugeClass===CLASSES.NOMINAL;

 /* Mesure : distance euclidienne entre les origines des deux rails, dans le
  * repère de la capture. Elle est donc invariante par translation globale, par
  * changement de repère de scène et par échange gauche/droite, et ne dépend
  * d'aucune convention de signe ni de sens de profil. */
 function gaugeMmOf(rails,C){
   const a=rails&&rails.left&&rails.left.positionSceneRelative;
   const b=rails&&rails.right&&rails.right.positionSceneRelative;
   if(!Array.isArray(a)||!Array.isArray(b))return NaN;
   return C.distance(a,b)*1000;
 }
 /* Écartement APRÈS application des deltas, sans jamais consulter l'état
  * AVANT comme critère : le BEFORE ESV vaut couramment ~1500 mm et c'est
  * précisément ce que Banane corrige.
  *
  * Le déplacement du repère d'un rail translate son origine du même vecteur,
  * donc l'origine attendue est `position + d`, avec `d` le delta profil-local
  * porté dans le repère de scène. C'est le même calcul que
  * `BananeCore3.expectedPoses`, dont un test vérifie l'égalité numérique. */
 function shifted(rail,delta,C){
   if(!rail||!Array.isArray(delta)||!Array.isArray(rail.positionSceneRelative)||!rail.profileLocalToSceneRelative)return null;
   const world=C.point(rail.profileLocalToSceneRelative,delta);
   const origin=C.point(rail.profileLocalToSceneRelative,[0,0,0]);
   return rail.positionSceneRelative.map((v,i)=>v+(world[i]-origin[i]));
 }
 function predictedGaugeMm(rails,deltas,C){
   const a=shifted(rails&&rails.left,deltas&&deltas.left,C);
   const b=shifted(rails&&rails.right,deltas&&deltas.right,C);
   if(!a||!b)return NaN;
   return C.distance(a,b)*1000;
 }
 /* Rapport complet d'un couple, tel que les diagnostics le conservent. */
 function assessPair(rails,deltas,C){
   const beforeMm=gaugeMmOf(rails,C),predictedMm=predictedGaugeMm(rails,deltas,C);
   const gaugeClass=classifyMm(predictedMm);
   /* `measurable` sépare « mesuré hors contrat » de « non mesurable ». Les deux
    * étages en tirent des conclusions volontairement différentes, décrites à
    * leur point d'appel. */
   return {contract:CONTRACT.version,beforeMm,predictedMm,gaugeClass,measurable:Number.isFinite(predictedMm),
     admissible:admissible(gaugeClass),
     lowMm:CONTRACT.lowMm,nominalMm:CONTRACT.nominalMm,maximumMm:CONTRACT.maximumMm};
 }

 /* ---- lecture de l'écartement AFFICHÉ par ESV, conservée ----
  * Elle n'alimente aucune décision : `KI-001` note que la source, la
  * fraîcheur et la précision internes de cette valeur ne sont pas observées.
  * Elle ne sert qu'à relever ce qu'ESV montre, et ses bornes dérivent
  * désormais de CONTRACT — la dérive 1410 est corrigée. */
 const RULE=Object.freeze({version:'gauge-range-v1',minimumMm:CONTRACT.nominalMm,maximumMm:CONTRACT.maximumMm});
 const OPERATOR_RULES=Object.freeze([
   Object.freeze({id:'below-'+CONTRACT.lowMm,minimumMm:null,maximumMm:CONTRACT.lowMm,minimumInclusive:false,maximumInclusive:false,outcome:CLASSES.LOW}),
   Object.freeze({id:'tolerance-'+CONTRACT.lowMm+'-'+CONTRACT.nominalMm,minimumMm:CONTRACT.lowMm,maximumMm:CONTRACT.nominalMm,minimumInclusive:true,maximumInclusive:false,outcome:CLASSES.TOLERANCE}),
   Object.freeze({id:'nominal-'+CONTRACT.nominalMm+'-'+CONTRACT.maximumMm,minimumMm:CONTRACT.nominalMm,maximumMm:CONTRACT.maximumMm,minimumInclusive:true,maximumInclusive:true,outcome:CLASSES.NOMINAL}),
   Object.freeze({id:'above-'+CONTRACT.maximumMm,minimumMm:CONTRACT.maximumMm,maximumMm:null,minimumInclusive:false,maximumInclusive:false,outcome:CLASSES.HIGH})
 ]);
 function parse(rawText){
   if(typeof rawText!=='string'||!rawText.trim()||/^\s*[—-]\s*$/.test(rawText))return {status:'indeterminate',rawText,reason:'missing-value'};
   const normalized=rawText.replace(/[  ]/g,' ').trim();
   const match=normalized.match(/^(\d{1,3}(?: \d{3})+|\d+)(?:[,.](\d+))?\s*mm$/i);
   if(!match)return {status:'indeterminate',rawText,reason:'unsupported-format-or-unit'};
   const integer=match[1].replace(/ /g,''),valueMm=Number(integer+(match[2]?'.'+match[2]:''));
   if(!Number.isFinite(valueMm)||valueMm<=0)return {status:'indeterminate',rawText,reason:'invalid-value'};
   return {status:'measured',rawText,valueMm,unit:'mm'};
 }
 function classify(measurement,rule=RULE){
   if(measurement?.status!=='measured'||!Number.isFinite(measurement.valueMm))return {status:'indeterminate',ruleVersion:rule.version,reason:measurement?.reason||'missing-measurement'};
   const valueMm=measurement.valueMm,status=valueMm<rule.minimumMm?'below-range':valueMm>rule.maximumMm?'above-range':'within-range';
   return {status,valueMm,minimumMm:rule.minimumMm,maximumMm:rule.maximumMm,ruleVersion:rule.version};
 }
 function assessOperatorPolicy(measurement,rules=OPERATOR_RULES){
   if(measurement?.status!=='measured'||!Number.isFinite(measurement.valueMm))return {status:'indeterminate',outcomes:[],reason:measurement?.reason||'missing-measurement'};
   const valueMm=measurement.valueMm,contains=(rule)=>
     (rule.minimumMm===null||(rule.minimumInclusive?valueMm>=rule.minimumMm:valueMm>rule.minimumMm))&&
     (rule.maximumMm===null||(rule.maximumInclusive?valueMm<=rule.maximumMm:valueMm<rule.maximumMm));
   const matches=rules.filter(contains),outcomes=[...new Set(matches.map(r=>r.outcome))];
   return {status:outcomes.length===1?'specified':outcomes.length>1?'ambiguous':'uncovered',valueMm,outcomes,ruleIds:matches.map(r=>r.id),
     automaticDecisionAllowed:false};
 }
 return {CONTRACT,CLASSES,classifyMm,admissible,gaugeMmOf,predictedGaugeMm,assessPair,
   RULE,OPERATOR_RULES,parse,classify,assessOperatorPolicy};
});
