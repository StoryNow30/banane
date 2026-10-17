(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/capture-core.js'),require('./lot-decision.js'));
  else root.BananeVoisinsSursDifferes=factory(root.BananeCaptureCore,root.BananeLotDecision);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,L){
 'use strict';
 /* 5.0 (D-170, chantier P7, hypothèse « voisins sûrs pour les différés ») — POST-TRAITEMENT d'un cut DIFFÉRÉ PAR LE LOT que la
  * chaîne d'appuis diffère encore (fiches/P7_VOISINS_SURS_DIFFERES.md).
  *
  * Constat du catalogue des échecs (ADV, abords, grappes) : sur ces cuts, la pose de départ est fausse (souvent la pose fictive
  * d'ESV, écartement 1 500 mm) et la chaîne n'a pas d'appui (`no-anchor`), alors que les VOISINS ont une pose actuelle sûre.
  * Correctif : la décision livrée est reprise (`LotDecision.decideCut`, option `validated`, §14 I amendé, D-054) avec pour appuis
  * validés les poses actuelles des voisins à ±`rayon` cuts :
  *   - jamais le cut lui-même, jamais un cut différé par le lot, jamais une pose fictive (écartement à 1 500 mm à 0,5 mm près) ;
  *   - jamais une pose de l'opérateur : l'appelant passe les poses ACTUELLES (celles qu'ESV montre avant toute correction humaine) ;
  *   - la garde de cohérence livrée (`consistentValidated` : 3 voisins au moins, alignés à 8 mm sur les deux rails) et les étapes
  *     livrées (fenêtre relancée, choix à 15 mm, gardes de paire et d'écartement) décident ; ce module ne choisit rien.
  * La pose reprise n'est JAMAIS un appui de la chaîne (`anchor: false`) : une reprise fausse ne se propage pas.
  *
  * Fonction PURE : ni horloge, ni réglage global, ni écriture ; rien n'est modifié dans les entrées. COUPÉE par défaut
  * (`options.actif` doit valoir `true`). Une panne de la décision rend la décision de la chaîne telle quelle. */
 const VERSION='voisins-surs-differes-v1';
 const SIDES=['left','right'];
 const DEFAUTS=Object.freeze({actif:false,rayon:5,ecartementFictifMm:1500,toleranceFictiveMm:0.5});
 const vec3=v=>Array.isArray(v)&&v.length>=3&&v.slice(0,3).every(x=>typeof x==='number'&&Number.isFinite(x));
 const cfgDe=options=>({...DEFAUTS,...(options||{})});

 /* Pose fictive d'ESV : écartement par défaut (1 500 mm) à `toleranceFictiveMm` près. */
 function estFictive(positions,options){
   const cfg=cfgDe(options);
   if(!positions||!SIDES.every(s=>vec3(positions[s])))return false;
   return Math.abs(1000*C.distance(positions.left,positions.right)-cfg.ecartementFictifMm)<cfg.toleranceFictiveMm;
 }
 /* Appuis validés candidats : `poses` = [{ identity:{part,cut,frameId}, positions:{left,right}, differe }] (poses actuelles). */
 function voisinsSurs(identity,poses,options){
   const cfg=cfgDe(options),out=[];
   if(!identity||!Number.isInteger(identity.cut))return out;
   for(const p of poses||[]){
     const id=p&&p.identity;
     if(!id||id.part!==identity.part||(id.frameId??null)!==(identity.frameId??null)||!Number.isInteger(id.cut))continue;
     if(id.cut===identity.cut||Math.abs(id.cut-identity.cut)>cfg.rayon)continue;
     if(p.differe!==false)continue;
     if(!p.positions||!SIDES.every(s=>vec3(p.positions[s]))||estFictive(p.positions,cfg))continue;
     out.push({identity:{part:id.part,cut:id.cut,frameId:id.frameId??null},positions:{left:p.positions.left.slice(0,3),right:p.positions.right.slice(0,3)}});
   }
   return out.sort((a,b)=>a.identity.cut-b.identity.cut);
 }
 /* `decision` : celle de la chaîne pour ce cut ; `differe` : le lot a-t-il différé ce cut ; `anchors` : appuis de la chaîne (lus,
  * jamais modifiés) ; `Lot` : la décision livrée (injectable pour les essais). Rend { decision, tentative } : `tentative` nul si la
  * reprise ne s'applique pas (coupée, cut non différé par le lot, chaîne qui pose déjà) ; sinon voisins sûrs, voisins gardés par la
  * cohérence, étape et motif de la reprise, et si elle pose. */
 function reprendre({decision,differe,capture,science,anchors,poses,Shadow,options,lotOptions,Lot=L}={}){
   const cfg=cfgDe(options);
   if(cfg.actif!==true||differe!==true||!decision||decision.positions||!capture||!capture.identity)return {decision,tentative:null};
   const validated=voisinsSurs(capture.identity,poses,cfg),min=(Lot&&Lot.DEFAULTS&&Lot.DEFAULTS.validatedMinInliers)||3;
   const tentative={version:VERSION,voisins:validated.length,gardes:[],stage:null,reason:null,pose:false};
   if(validated.length<min)return {decision,tentative:{...tentative,reason:'trop-peu-de-voisins'}};
   let d2;
   try{d2=Lot.decideCut({capture,science,anchors:(anchors||[]).slice(),validated,Shadow,...(lotOptions?{options:lotOptions}:{})});}
   catch{return {decision,tentative:{...tentative,reason:'panne'}};}
   const gardes=Array.isArray(d2&&d2.validatedAnchors)?d2.validatedAnchors.slice().sort((a,b)=>a-b):[];
   const t={...tentative,gardes,stage:d2&&d2.stage||null,reason:d2&&d2.reason||null};
   /* Sans voisin gardé par la cohérence, la décision est celle de la chaîne : rien de neuf. */
   if(!d2||!d2.positions||!gardes.length)return {decision,tentative:t};
   return {decision:{...d2,post:'voisins-surs',anchor:false},tentative:{...t,pose:true}};
 }
 return {VERSION,DEFAUTS,estFictive,voisinsSurs,reprendre};
});
