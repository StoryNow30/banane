(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./garde-voie-ombre.js'),require('./gcv2-l1e.js'));
  else root.BananeSerrageLotOmbre=factory(root.BananeGardeVoieOmbre,root.BananeGcv2L1e);
})(typeof globalThis!=='undefined'?globalThis:this,function(G,L1e){
 'use strict';
 /* CH-079 (D-308, mesure 3) — SERRAGE DU LOT, EN OMBRE. Module pur : il CALCULE la pose corrigée d'un cut posé par la décision sur le lot et la rend à
  * côté de la pose réelle ; il ne pose rien et ne change aucune décision. Le lot serre la voie d'environ 8 mm (Écho du 08/11) : chaque rail est
  * desserré de la moitié de l'écart entre la référence (lignes valides de la liste, `referenceEcartement` de L1-e ; sinon 1435) et l'écartement posé,
  * le long de l'axe gauche→droite (deltaGaucheMm < 0 : le rail gauche s'écarte). Au-delà de `plafondMm`, l'écart n'est pas un serrage mais une mauvaise
  * voie (affaire de la garde) : aucun desserrage. Seul le sens en travers de la voie change. Événement : numéros de cut et mm seulement. */
 const VERSION='serrage-lot-ombre-v1';
 const REGLAGE=Object.freeze({plafondMm:20,gRefDefautMm:1435});
 const fini=v=>typeof v==='number'&&Number.isFinite(v);
 const r2=v=>fini(v)?Math.round(v*100)/100+0:null;
 function referenceMm(table,cut,o){const r=L1e.referenceEcartement(table,cut);return r&&fini(r.mm)?r.mm:o.gRefDefautMm;}
 /* Rend { version, cut, referenceMm, ecartAvantMm, ecartApresMm, deltaGaucheMm, deltaDroiteMm }. */
 function evaluer({cut=null,positions=null,table=null,reglage={}}={}){
   const o={...REGLAGE,...reglage},nul={version:VERSION,cut,referenceMm:null,ecartAvantMm:null,ecartApresMm:null,deltaGaucheMm:0,deltaDroiteMm:0};
   try{
     const g=G.ecartementMm(positions);if(g===null)return nul;
     const ref=referenceMm(table,cut,o),e=ref-g,agit=Math.abs(e)<=o.plafondMm;
     const dG=agit?-e/2:0,dD=agit?e/2:0;
     return {version:VERSION,cut,referenceMm:r2(ref),ecartAvantMm:r2(g),ecartApresMm:r2(g+dD-dG),deltaGaucheMm:r2(dG),deltaDroiteMm:r2(dD)};
   }catch{return nul;}
 }
 return {VERSION,REGLAGE,evaluer};
});
