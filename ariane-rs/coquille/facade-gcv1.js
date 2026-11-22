/* CH-064 : façade de src/geometry-candidate-v1.js (GCV1) sur le cœur WASM, MÊME API, mêmes objets rendus.
 *   const G=ArianeFacadeGcv1.creer(coeur, CandidatV1) → {DEFAULTS, median, robustLine, enforcePairSupport, propose, proposeBoth, MIN_TOP_ROWS}
 * `lab.onCoarse` (fonction) : remplacé à l'envoi par la chaîne RAPPEL ; le cœur rend les appels (grille, méta) que la
 * façade rejoue ici dans l'ordre (les appelants ne font qu'y capturer la grille) ; la fonction est remise dans
 * parameters.lab. Toute autre fonction dans les options : refus du format, repli sur le JS (compté). */
(function(root,factory){const api=factory(typeof module==='object'?require('./facade-geometrie.js'):root.ArianeFacadeGeometrie);if(typeof module==='object')module.exports=api;else root.ArianeFacadeGcv1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(V46){
 'use strict';
 const RAPPEL='\u0000ariane:onCoarse';
 function creer(coeur,G){
  const n={coeur:0,repliHorsDomaine:0,repliFormat:0,rappelsRejoues:0};
  function preparer(options){
   if(options===undefined)return {envoi:undefined,fn:null};
   if(!options||typeof options!=='object'||Array.isArray(options))return null;
   const lab=options.lab;
   if(!lab||typeof lab!=='object'||typeof lab.onCoarse!=='function')return {envoi:options,fn:null,lab};
   return {envoi:{...options,lab:{...lab,onCoarse:RAPPEL}},fn:lab.onCoarse,lab};
  }
  function remettre(p,fn){if(fn&&p&&p.parameters&&p.parameters.lab&&p.parameters.lab.onCoarse===RAPPEL)p.parameters.lab.onCoarse=fn;}
  function appeler(fonction,capture,cote,options,js){
   const prep=preparer(options),sous=V46.sousEnsemble(capture);
   if(!prep||!sous){n.repliHorsDomaine++;return js();}
   let r;
   try{r=coeur.appeler(fonction,fonction===22?{capture:sous,side:cote,options:prep.envoi}:{capture:sous,options:prep.envoi});}
   catch(e){if(e&&e.name==='HorsDomaine'){n.repliHorsDomaine++;return js();}if(e instanceof TypeError&&/^VBA : /.test(e.message)){n.repliFormat++;return js();}throw e;}
   n.coeur++;
   const fn=prep.fn,res=r.resultat;
   for(const a of r.rappels){ // rejoué dans l'ordre où le JS l'aurait appelé
    const cells=new Array(a.cellules.length/3);for(let i=0;i<cells.length;i++)cells[i]={u:a.cellules[3*i],z:a.cellules[3*i+1],loss:a.cellules[3*i+2]};
    const ceLab=a.lab;if(ceLab.onCoarse===RAPPEL)ceLab.onCoarse=fn;
    fn.call(ceLab,cells,{best:{u:a.meilleur[0],z:a.meilleur[1],loss:a.meilleur[2]},uCenters:a.centres});n.rappelsRejoues++;}
   if(fonction===22)remettre(res,fn);else{remettre(res.left,fn);remettre(res.right,fn);}
   return res;
  }
  return {DEFAULTS:G.DEFAULTS,median:G.median,robustLine:G.robustLine,enforcePairSupport:G.enforcePairSupport,MIN_TOP_ROWS:G.MIN_TOP_ROWS,
   propose(capture,side,options={}){return appeler(22,capture,side,options,()=>G.propose(capture,side,options));},
   proposeBoth(capture,options={}){return appeler(23,capture,null,options,()=>G.proposeBoth(capture,options));},
   compteurs:()=>({...n})};
 }
 return {creer,RAPPEL};
});
