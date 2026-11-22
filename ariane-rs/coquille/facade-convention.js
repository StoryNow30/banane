/* CH-064 : façade de src/placement-convention.js (BananePlacementConvention) sur le cœur WASM, MÊME API.
 *   const P=ArianeFacadeConvention.creer(coeur, BananePlacementConvention)
 * calibrate et bandOffsets passent par le cœur (30, 31) ; DEFAULTS, quantile, template (qui rend des fonctions) restent JS.
 * Le plafond (`plafondMode`) lit `options.plafond` puis la globale `BananeSettings.conventionPlafond` AU MOMENT DE
 * L'APPEL : la façade le résout ici, comme le JS, et le passe au cœur. */
(function(root,factory){const api=factory(typeof module==='object'?require('./facade-geometrie.js'):root.ArianeFacadeGeometrie);if(typeof module==='object')module.exports=api;else root.ArianeFacadeConvention=api;})(typeof globalThis!=='undefined'?globalThis:this,function(V46){
 'use strict';
 function plafondMode(P,options){const cfg={...P.DEFAULTS,...options};
  const v=cfg.plafond!==undefined&&cfg.plafond!==null?cfg.plafond:(typeof globalThis!=='undefined'?globalThis.BananeSettings?.conventionPlafond:undefined);
  return v===true?true:v==='vertical'?'vertical':false;}
 function sousEnsemble(capture){if(capture===undefined||capture===null)return {ok:true,v:capture};const s=V46.sousEnsemble(capture);return s?{ok:true,v:s}:{ok:false};}
 function creer(coeur,P){
  const n={coeur:0,repliHorsDomaine:0,repliFormat:0};
  function appeler(f,entree,js){
   try{const v=coeur.appeler(f,entree);n.coeur++;return v;}
   catch(e){if(e&&e.name==='HorsDomaine'){n.repliHorsDomaine++;return js();}if(e instanceof TypeError&&/^VBA : /.test(e.message)){n.repliFormat++;return js();}throw e;}
  }
  return {DEFAULTS:P.DEFAULTS,quantile:P.quantile,template:P.template,
   calibrate(capture,side,delta,options={}){const c=sousEnsemble(capture),js=()=>P.calibrate(capture,side,delta,options);
    if(!c.ok||(options!==undefined&&(options===null||typeof options!=='object'))){n.repliHorsDomaine++;return js();}
    return appeler(30,{capture:c.v,side,delta,options,plafond:plafondMode(P,options)},js);},
   bandOffsets(capture,side,delta,options={}){const c=sousEnsemble(capture),js=()=>P.bandOffsets(capture,side,delta,options);
    if(!c.ok){n.repliHorsDomaine++;return js();}return appeler(31,{capture:c.v,side,delta,options},js);},
   compteurs:()=>({...n})};
 }
 return {creer,plafondMode};
});
