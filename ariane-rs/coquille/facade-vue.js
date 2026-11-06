/* CH-072 : façade des fonctions pures de src/deplacement-vue.js et src/gestes-vue.js sur le module WASM
 * (numéros 350–376), même API que les modules d'origine. Repli : HorsDomaine ou refus VBA → JS d'origine.
 * Restent en JS : suites à Math.random (sequence, sequenceMolette, sequenceGlisser, sequenceClicDroit),
 * émission DOM (construire, emettre) et deplacer (async).
 * forcerWasm : le banc de parité passe par le module même si une fonction est plus lente (voir LENT).
 * Jamais branchée dans le paquet sans décision écrite de l'opérateur. */
(function(root,factory){
 const vba=typeof module==='object'?require('./vba.js'):root.ArianeVba;
 const api=factory(vba);
 if(typeof module==='object')module.exports=api;else root.ArianeFacadeVue=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Vba){
 'use strict';
 /* Banc Chromium, 15 répétitions de 400 appels, médiane : chaque fonction portée est plus lente en WASM
  * (traversée comprise) que le JS. Elles restent donc en JS. Le banc de parité passe forcerWasm. */
 const LENT={350:1,351:1,352:1,353:1,354:1,355:1,356:1,357:1,358:1,359:1,360:1,361:1,362:1,370:1,371:1,372:1,373:1,374:1,375:1,376:1};
 function repli(e){return !!(e&&(e.name==='HorsDomaine'||(e instanceof TypeError&&/^VBA : /.test(e.message))));}
 function appel(coeur,n,entree,js,forcer){
  if(!forcer&&LENT[n])return js();
  try{return coeur.appeler(n,entree);}
  catch(e){if(repli(e))return js();throw e;}
 }
 function champs(e){
  return {type:e.type,isTrusted:e.isTrusted,clientX:e.clientX,clientY:e.clientY,pointerId:e.pointerId,pointerType:e.pointerType,
   button:e.button,buttons:e.buttons,deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,wheelDeltaY:e.wheelDeltaY};
 }
 function cameraPlate(c){
  if(c==null)return null;
  const vp=c.viewport;
  return {cameraToSceneRelative:c.cameraToSceneRelative,projection:c.projection,
   viewport:vp&&typeof vp==='object'?{width:vp.width,height:vp.height}:vp};
 }
 function creer(coeur,DV,GV,opts){
  const forcer=!!(opts&&opts.forcerWasm);
  function a(n,entree,js){return appel(coeur,n,entree,js,forcer);}
  class Journal{
   constructor(){this.etat=a(351,{},()=>null);if(this.etat==null){this.js=new DV.Journal();}}
   noter(geste,e){if(this.js)return this.js.noter(geste,e);this.etat=a(352,{etat:this.etat,geste,e},()=>null);}
   resume(){if(this.js)return this.js.resume();return a(353,{etat:this.etat},()=>this.js&&this.js.resume());}
  }
  class Bilan{
   constructor(o){this.etat=a(358,{},()=>null);if(this.etat==null){this.js=new DV.Bilan(o);return;}if(o&&typeof o==='object')this.etat={...this.etat,...o};}
   noterDeplacement(d){if(this.js)return this.js.noterDeplacement(d);this.etat=a(359,{etat:this.etat,d},()=>this.etat);}
   noterRemise(r){if(this.js)return this.js.noterRemise(r);this.etat=a(360,{etat:this.etat,r},()=>this.etat);}
   vide(){if(this.js)return this.js.vide();return a(361,{etat:this.etat},()=>false);}
   resume(){if(this.js)return this.js.resume();return a(362,{etat:this.etat},()=>null);}
  }
  class Releveur{
   constructor(o){
    this.opts=o;this.lireCamera=o.lireCamera;this.emettreResume=o.emettre;this.planifier=o.planifier;this.maintenant=o.maintenant;this.estVue=o.estVue;
    this.entame=false;this._e=null;
    try{
     const v=coeur.appeler(376,{action:{faire:'creer',reglages:o.reglages||{}}});
     this.etat=v.etat;this.mode='wasm';
    }catch(e){if(!repli(e))throw e;this.mode='js';this.js=new GV.Releveur(o);}
   }
   camera(){try{return cameraPlate(this.lireCamera()||null);}catch{return null;}}
   boucle(action){
    let req=action;
    for(;;){
     const v=coeur.appeler(376,{etat:this.etat,action:req});
     this.etat=v.etat;
     const d=v.demande;
     if(d==null)return;
     if(d.quoi==='maintenant'){req={...req,phase:v.phase,mem:v.mem,reponse:this.maintenant()};continue;}
     if(d.quoi==='cibleEstVue'){req={...req,phase:v.phase,mem:v.mem,reponse:!!this.estVue(this._e&&this._e.target)};continue;}
     if(d.quoi==='camera'){req={...req,phase:v.phase,mem:v.mem,reponse:this.camera()};continue;}
     if(d.quoi==='planifier'){
      const suite=d.suite;
      this.planifier(()=>this.boucle(suite),d.ms);
      if(v.phase!=null){req={...req,phase:v.phase,mem:v.mem,reponse:undefined};continue;}
      return;
     }
     if(d.quoi==='emettre'){
      this.emettreResume(d.resume);
      if(v.phase!=null){req={...req,phase:v.phase,mem:v.mem,reponse:undefined};continue;}
      return;
     }
     throw new TypeError('VBA : demande de relevé inconnue');
    }
   }
   evenement(e){
    if(this.mode==='js')return this.js.evenement(e);
    if(!e||e.isTrusted===false)return;
    this._e=e;
    const sauve=this.etat;
    try{this.boucle({faire:'evenement',e:champs(e)});}
    catch(err){
     if(repli(err)){
      this.etat=sauve;
      if(!this.entame){this.mode='js';this.js=new GV.Releveur(this.opts);return this.js.evenement(e);}
      throw err;
     }
     const c=this.etat.compte;
     this.etat={...this.etat,compte:{...c,ignores:c.ignores+1}};
    }
    this.entame=true;
   }
  }
  return {
   VERSION:DV.VERSION,GESTES:DV.GESTES,PLAFOND_TENTATIVES:DV.PLAFOND_TENTATIVES,DEFAUTS:DV.DEFAUTS,
   reglages(S){return a(350,{s:S===undefined?null:S},()=>DV.reglages(S));},
   Journal,sequence:DV.sequence,juger(geste,plan,avant,apres,r){return a(354,{geste,plan,avant,apres,r},()=>DV.juger(geste,plan,avant,apres,r));},
   deplacer:DV.deplacer,
   detailDeplacement(c,ctx){return a(356,{c:c==null?null:c,ctx:ctx===undefined?{}:ctx},()=>DV.detailDeplacement(c,ctx));},
   detailRemise(remise,erreur,ctx){return a(357,{remise:remise==null?null:remise,erreur:erreur==null?null:erreur,ctx:ctx===undefined?{}:ctx},()=>DV.detailRemise(remise,erreur,ctx));},
   Bilan,
   gestes:{
    VERSION:GV.VERSION,EMISSION:GV.EMISSION,RELEVE:GV.RELEVE,TYPES_RELEVE:GV.TYPES_RELEVE,POINTEUR:GV.POINTEUR,
    approche(x,y,boutons,dernier){const e={x,y};if(boutons!==undefined)e.boutons=boutons;if(dernier!==undefined)e.dernier=dernier;return a(370,e,()=>GV.approche(x,y,boutons,dernier));},
    sequenceMolette:GV.sequenceMolette,sequenceGlisser:GV.sequenceGlisser,sequenceClicDroit:GV.sequenceClicDroit,
    construire:GV.construire,emettre:GV.emettre,
    pixelMm(cam){return a(374,{cam:cameraPlate(cam)},()=>GV.pixelMm(cam));},
    resumeCamera(cam){return a(375,{cam:cameraPlate(cam)},()=>GV.resumeCamera(cam));},
    ecartCamera(avant,apres){const v=a(372,{avant:cameraPlate(avant),apres:cameraPlate(apres)},()=>GV.ecartCamera(avant,apres));return v==null?null:v;},
    memeCamera(x,y){return a(373,{a:x,b:y},()=>GV.memeCamera(x,y));},
    besoin(ndc,viewport,marge){const e={ndc,viewport};if(marge!==undefined)e.marge=marge;return a(371,e,()=>GV.besoin(ndc,viewport,marge));},
    Releveur,
   },
  };
 }
 return {creer,LENT,repli};
});
