/* CH-070 : façades des modules de session sur le cœur WASM (ariane-session, fonctions 250 à 299), MÊME API, mêmes objets.
 *   const R=ArianeFacadeSession.resume(coeur, ArianePartSummary49)   → {FORMAT, projectEvent, summarize, fromJournal, contextOf, deferKind}
 * Entrée du cœur : {a:[arguments]} ; un refus « hors domaine » ou un refus du format (fonction, Map, Date… dans
 * l'entrée) rejoue le JS d'origine, compté. Les modules JS ne sont jamais modifiés. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ArianeFacadeSession=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function compteur(){return {coeur:0,repliHorsDomaine:0,repliFormat:0,motifs:{}};}
 /* Appel du cœur ; repli sur `js()` si le cœur ne sait pas reproduire l'entrée. Les autres exceptions (celles du JS) passent. */
 function appel(coeur,n,fonction,entree,js){
  let r;
  try{r=coeur.appeler(fonction,entree);}
  catch(e){const repli=e&&e.name==='HorsDomaine'?'repliHorsDomaine':e instanceof TypeError&&/^VBA : /.test(e.message)?'repliFormat':null;if(!repli)throw e;
   n[repli]++;const m=fonction+' '+String(e.message).slice(0,60);n.motifs[m]=(n.motifs[m]||0)+1;return js();}
  n.coeur++;return r;
 }
 /* part-summary-49 (250–254). Un événement déjà projeté est rendu tel quel par le JS (identité de l'objet) : pas de cœur. */
 function resume(coeur,P){
  const n=compteur(),a=(f,args,js)=>appel(coeur,n,f,{a:args},js);
  return {FORMAT:P.FORMAT,
   projectEvent(e){if(e&&typeof e==='object'&&e.projection===P.FORMAT)return P.projectEvent(e);return a(250,[e],()=>P.projectEvent(e));},
   summarize(...x){return a(251,x,()=>P.summarize(...x));},
   fromJournal(...x){return a(252,x,()=>P.fromJournal(...x));},
   contextOf(...x){return a(253,x,()=>P.contextOf(...x));},
   deferKind(...x){return a(254,x,()=>P.deferKind(...x));},
   compteurs:()=>({...n,motifs:{...n.motifs}})};
 }
 return {resume,appel,compteur};
});
