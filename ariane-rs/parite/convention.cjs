'use strict';
/* CH-064 : parité de src/placement-convention.js (calibrate, bandOffsets) contre la façade WASM.
 * Delta d'entrée : celui que V4.6 publie sur ce nuage (src/geometry.js), sinon un delta fabriqué ; variantes tournantes :
 * plafond (options et globale BananeSettings), décalage maximal petit (domaine, plafonnement), réglages limites, deltas invalides. */
const P=require('../../src/placement-convention.js'),G=require('../../src/geometry.js'),F=require('../coquille/facade-convention.js'),{nuages}=require('../../tools/ch064-nuages.cjs');
let facade=null;
const fac=coeur=>facade&&facade.coeur===coeur?facade.f:(facade={coeur,f:F.creer(coeur,P)}).f;
const VARIANTES=[{},{maxShiftMm:.5},{maxShiftMm:.5,plafond:true},{maxShiftMm:.5,plafond:'vertical'},{maxShiftMm:1.5,plafond:'vertical'},{global:true,maxShiftMm:.5},{global:'vertical',maxShiftMm:.5},
 {minFacePoints:0},{minFacePoints:1000},{faceFallbackMm:'0',minFacePoints:1000},{minTopPoints:0},{topQuantile:1},{bandMm:3},{version:{v:2}},{topQuantile:-1}];
function jouer(Mod,e){const g=globalThis.BananeSettings;try{if(e.global!==undefined)globalThis.BananeSettings={conventionPlafond:e.global};
  return Mod[e.f](e.capture,e.side,e.delta,e.options);}finally{if(g===undefined)delete globalThis.BananeSettings;else globalThis.BananeSettings=g;}}
module.exports={nom:'convention',description:'src/placement-convention.js, calibrate et bandOffsets',sources:['src/placement-convention.js','vendor/capture-core.js'],
 *cas({max=Infinity}={}){let n=0;
  for(const c of nuages(max)){n++;const pb=G.proposeBoth(c);
   for(const side of ['left','right']){const d=pb[side].delta||[0,(n%2?1:-1)*.01,.002];
    const {global,...options}=VARIANTES[(2*n+(side==='left'?0:1))%VARIANTES.length];
    yield {id:'nuage-'+n+'-'+side,entree:{f:'calibrate',capture:c,side,delta:d,options,global}};
    if(n%5===0)yield {id:'nuage-'+n+'-'+side+'-bande',entree:{f:'bandOffsets',capture:c,side,delta:d,options:{}}};}
   if(n<=2)for(const [nom,d] of [['delta-court',[0,.01]],['delta-nan',[0,NaN,0]],['delta-chaine',[0,'0.01',0]],['delta-trous',[0,,0]],['delta-null',null]])
    yield {id:'limite-'+n+'-'+nom,entree:{f:'calibrate',capture:c,side:'left',delta:d,options:{}}};
   if(n===1){yield {id:'limite-capture-absente',entree:{f:'calibrate',capture:undefined,side:'left',delta:[0,0,0]}};
    yield {id:'limite-sans-points',entree:{f:'calibrate',capture:{...c,pointsSceneRelative:undefined},side:'right',delta:[0,0,0]}};}
  }},
 js(e){return jouer(P,e);},
 rs(e,coeur){return jouer(fac(coeur),e);},
 bilan:()=>facade?facade.f.compteurs():null,
 navigateur:{scripts:['vendor/capture-core.js','src/placement-convention.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-geometrie.js','ariane-rs/coquille/facade-convention.js'],
  preparer:'coeur=>({P:BananePlacementConvention,f:ArianeFacadeConvention.creer(coeur,BananePlacementConvention),jouer:('+jouer.toString()+')})',
  js:'(e,t)=>t.jouer(t.P,e)',rs:'(e,t)=>t.jouer(t.f,e)',bilan:'t=>t.f.compteurs()'}};
