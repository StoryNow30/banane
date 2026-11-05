(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BananeSerieCapturesVides=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 /* CH-051 — GARDE « SÉRIE DE CAPTURES VIDES » DU LOT : détecteur pur, sans ESV, sans horloge, sans journal.
  *
  * Constat (lot du 04/11, version 5, `tools/series-sans-points.cjs`) : ESV cesse parfois de charger les nœuds de points (0 requête pendant 23 min
  * puis 76 s, chaque fois quelques secondes après une requête en échec 502) ; la page garde ses vieux nœuds, chaque capture rend 0 point, le moteur
  * répond « Aucun point LiDAR disponible » et le lot diffère cut après cut : 337 cuts en 22,7 min dans la partie 10, 25 dans la partie 13, soit 362
  * des 428 différés du lot. Les points existaient (l'Écho du soir les a lus sur les mêmes cuts).
  *
  * Règle (réglage `lot.serieCapturesVides`, COUPÉE par défaut) : après `seuil` captures vides consécutives d'un même lot, la garde demande d'ATTENDRE
  * `attenteMs` puis de recapturer le même cut ; si la recapture est encore vide, de RECHARGER la page ESV une fois par série (si l'appelant le dit
  * possible : Constellation active pour la reprise, rien de posé sur le cut) ; ensuite, de DIFFÉRER sans attendre, et de refaire un essai d'attente
  * tous les `reessaiApresCuts` cuts vides. La première capture pleine referme la série. La garde ne pose, ne valide et n'écrit jamais rien :
  * elle ne fait qu'attendre, relire, ou demander le rechargement d'une page ; un cut qu'elle laisse reste différé comme avant. */
 const DEFAUT=Object.freeze({actif:false,seuil:3,attenteMs:20000,attentesParEssai:1,rechargement:true,rechargementsParSerie:1,reessaiApresCuts:10});
 const entier=(v,min)=>Number.isInteger(v)&&v>=min;
 /* Lecture du réglage : une clé absente vaut la valeur livrée ; une valeur illisible COUPE la garde. */
 function reglage(S){
   const s=S&&typeof S==='object'?S:{};const r={...DEFAUT};
   if(s.actif===true)r.actif=true;else if(s.actif===undefined)r.actif=DEFAUT.actif;else r.actif=false;
   for(const [k,min] of [['seuil',1],['attenteMs',0],['attentesParEssai',1],['rechargementsParSerie',0],['reessaiApresCuts',1]]){
     if(s[k]===undefined)continue;if(entier(s[k],min))r[k]=s[k];else r.actif=false;}
   if(s.rechargement!==undefined){if(typeof s.rechargement==='boolean')r.rechargement=s.rechargement;else r.actif=false;}
   return Object.freeze(r);
 }
 function creer(S){return {reglage:reglage(S),vides:0,serie:false,series:0,attentes:0,rechargements:0,differesSansAttente:0,depuisDernierEssai:0,attentesEssai:0};}
 function fermer(e){e.vides=0;e.serie=false;e.attentes=0;e.rechargements=0;e.differesSansAttente=0;e.depuisDernierEssai=0;e.attentesEssai=0;}
 const reponse=(e,action,plus)=>({action,serie:e.series,vides:e.vides,...(plus||{})});
 function differer(e,motif){e.differesSansAttente++;return reponse(e,'differer',{motif});}
 function attendre(e){e.attentes++;e.attentesEssai++;e.depuisDernierEssai=0;return reponse(e,'attendre',{attenteMs:e.reglage.attenteMs});}
 /* `capture` : le résultat de capture ({points}) ou null en cas d'erreur. `ctx` : apresAttente (recapture après l'attente), apresRechargement
  * (capture après le rechargement), rechargementPossible (l'appelant sait reprendre le lot après un F5 et rien n'est posé). */
 function observer(e,capture,ctx){
   const R=e.reglage,c=ctx||{};
   if(!R.actif)return reponse(e,'rien');
   const points=capture&&typeof capture==='object'&&Number.isFinite(capture.points)?capture.points:null;
   if(points===null)return reponse(e,'rien');
   if(points>0){fermer(e);return reponse(e,'rien');}
   if(c.apresAttente){
     if(e.attentesEssai<R.attentesParEssai)return attendre(e);
     e.depuisDernierEssai=0;
     if(!R.rechargement)return differer(e,'rechargement-coupe');
     if(e.rechargements>=R.rechargementsParSerie)return differer(e,'serie-en-cours');
     if(c.rechargementPossible===false)return differer(e,'rechargement-impossible');
     e.rechargements++;e.depuisDernierEssai=0;return reponse(e,'recharger');}
   if(c.apresRechargement){e.depuisDernierEssai=0;return differer(e,'serie-en-cours');}
   e.vides++;
   if(!e.serie){if(e.vides<R.seuil)return reponse(e,'rien');e.serie=true;e.series++;e.attentesEssai=0;return attendre(e);}
   e.depuisDernierEssai++;
   if(e.depuisDernierEssai>=R.reessaiApresCuts){e.attentesEssai=0;return attendre(e);}
   return differer(e,'serie-en-cours');
 }
 function bilan(e){return {serie:e.serie,series:e.series,vides:e.vides,attentes:e.attentes,rechargements:e.rechargements,differesSansAttente:e.differesSansAttente};}
 return {VERSION:'serie-captures-vides-1',DEFAUT,reglage,creer,observer,bilan};
});
