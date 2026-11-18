/* CH-064 : façade de src/geometry.js (BananeGeometry3, V4.6) sur le cœur WASM, MÊME API, mêmes objets rendus.
 *   const G=ArianeFacadeGeometrie.creer(coeur, BananeGeometry3) → {DEFAULTS, median, robustLine, enforcePairSupport, propose, proposeBoth}
 * propose et proposeBoth passent par le cœur (fonctions 21 et 20) ; les autres restent ceux du JS.
 * Repli : toute entrée hors du domaine du port (HorsDomaine du cœur, ou refus du format VBA) est rejouée par le JS
 * d'origine, et comptée (compteurs()). Jamais branchée dans le paquet sans décision écrite de l'opérateur (D-291). */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.ArianeFacadeGeometrie=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SIDES=['left','right'];
 /* Sous-ensemble lu par propose : seulement ce que le JS lit, sans rien copier d'autre (les points sont passés par
  * référence et encodés une fois). Rend null si la forme sort de ce que le sous-ensemble reproduit : repli sur le JS. */
 function sousEnsemble(c){
  if(!c||typeof c!=='object'||Array.isArray(c))return null;
  const r=c.rails;let rails;
  if(r===undefined||r===null)rails=r;
  else if(typeof r==='object'&&!Array.isArray(r)){rails={};
   for(const s of SIDES){if(!(s in r))continue;const x=r[s];
    if(!x||typeof x!=='object'||Array.isArray(x)){rails[s]=x;continue;}
    const pc=x.profileContours;let contours;
    if(pc===undefined||pc===null)contours=pc;
    else if(Array.isArray(pc)){contours=new Array(pc.length);for(let i=0;i<pc.length;i++){const e=pc[i];if(!e||typeof e!=='object')return null;contours[i]={verticesSceneRelative:e.verticesSceneRelative};}}
    else return null;
    rails[s]={sceneRelativeToProfileLocal:x.sceneRelativeToProfileLocal,profileContours:contours};}}
  else return null;
  return {rails,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes};
 }
 function creer(coeur,G){
  const n={coeur:0,repliHorsDomaine:0,repliFormat:0};
  function appeler(fonction,entree,js){
   if(!entree.capture){n.repliHorsDomaine++;return js();}
   try{const v=coeur.appeler(fonction,entree);n.coeur++;return v;}
   catch(e){if(e&&e.name==='HorsDomaine'){n.repliHorsDomaine++;return js();}if(e instanceof TypeError&&/^VBA : /.test(e.message)){n.repliFormat++;return js();}throw e;}
  }
  return {DEFAULTS:G.DEFAULTS,median:G.median,robustLine:G.robustLine,enforcePairSupport:G.enforcePairSupport,
   propose(capture,side,options={}){return appeler(21,{capture:sousEnsemble(capture),side,options},()=>G.propose(capture,side,options));},
   proposeBoth(capture,options={}){return appeler(20,{capture:sousEnsemble(capture),options},()=>G.proposeBoth(capture,options));},
   compteurs:()=>({...n})};
 }
 return {creer,sousEnsemble};
});
