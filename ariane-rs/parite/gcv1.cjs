'use strict';
/* CH-064 : parité de src/geometry-candidate-v1.js (GCV1) contre la façade WASM (ariane-geometrie::gcv1).
 * Cas, sur chaque nuage réel : (a) proposeBoth sans lab ; (b) propose avec le lab d'exécution de lot-decision
 * (uSeeds, recenterWindow, partialFaceKeep, onCoarse) et (c) celui de gcv1-shadow (aStarLab, onCoarse à deux arguments),
 * pour un rail chacun ; (d) une variante de laboratoire tournante (toutes les branches de `lab`, pairZTransfer compris).
 * La sortie comparée contient le résultat ET ce que onCoarse a capturé (grille et méta), dans l'ordre des appels. */
const G=require('../../src/geometry-candidate-v1.js'),F=require('../coquille/facade-gcv1.js'),{nuages}=require('../../tools/ch064-nuages.cjs');
let facade=null;
const fac=coeur=>facade&&facade.coeur===coeur?facade.f:(facade={coeur,f:F.creer(coeur,G)}).f;
const VARIANTES=[{cloudUSeed:true},{cloudUSeed:true,replaceOrigin:true},{cloudZSeed:true},{pairSeedZ:-0.003},{lockZToCloud:true},{supportPenalty:0.5},
 {multiMinima:true},{multiMinima:true,preferSupported:true},{preferSupported:true},{preserveCoarseSupport:true},{adaptiveFace:true},{relativeFace:true},
 {explicitFaceAbstain:true},{partialFaceKeep:true,adaptiveFace:true},{uSeeds:[0.01,'x',NaN,0.01],replaceOrigin:true},{pairZTransfer:true},{pairZTransfer:true,multiMinima:true}];
/* L'appel est décrit par des données ; js et rs fabriquent chacun leur onCoarse qui capture ses appels. */
function jouer(Mod,e){const vus=[];const opts=e.options===undefined?undefined:JSON.parse(JSON.stringify(e.options));
 if(e.rappel&&opts){opts.lab=opts.lab||{};opts.lab.onCoarse=function(cells,meta){vus.push(meta===undefined?[cells]:[cells,meta]);};}
 const r=e.f==='propose'?Mod.propose(e.capture,e.side,opts):Mod.proposeBoth(e.capture,opts);
 // la fonction rendue dans parameters.lab n'est pas comparable : on vérifie qu'elle est bien celle passée, puis on la nomme
 const nommer=p=>{if(p&&p.parameters&&p.parameters.lab&&'onCoarse' in p.parameters.lab)p.parameters.lab.onCoarse=p.parameters.lab.onCoarse===opts.lab.onCoarse?'(la fonction passée)':'(AUTRE fonction)';};
 if(e.rappel){if(e.f==='propose')nommer(r);else{nommer(r.left);nommer(r.right);}}
 return {resultat:r,rappels:vus};}
module.exports={nom:'gcv1',description:'src/geometry-candidate-v1.js (GCV1), propose et proposeBoth, lab compris',sources:['src/geometry-candidate-v1.js','vendor/capture-core.js'],
 *cas({max=Infinity}={}){let n=0;
  for(const c of nuages(max)){n++;const cote=n%2?'left':'right';
   yield {id:'nuage-'+n+'-sans-lab',entree:{f:'proposeBoth',capture:c}};
   yield {id:'nuage-'+n+'-lot-decision',entree:{f:'propose',capture:c,side:cote,rappel:true,options:{lab:{uSeeds:[((n*37)%41-20)/1000],replaceOrigin:false,recenterWindow:true,partialFaceKeep:true}}}};
   yield {id:'nuage-'+n+'-gcv1-shadow',entree:{f:'propose',capture:c,side:cote==='left'?'right':'left',rappel:true,options:{lab:{uSeeds:[((n*53)%29-14)/1000],replaceOrigin:false,recenterWindow:true}}}};
   const v=VARIANTES[n%VARIANTES.length];
   yield {id:'nuage-'+n+'-variante-'+(n%VARIANTES.length),entree:{f:v.pairZTransfer?'proposeBoth':'propose',capture:c,side:cote,rappel:n%3===0,options:{lab:{...v}}}};
  }},
 js(e){return jouer(G,e);},
 rs(e,coeur){return jouer(fac(coeur),e);},
 bilan:()=>facade?facade.f.compteurs():null,
 navigateur:{scripts:['vendor/capture-core.js','src/geometry-candidate-v1.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-geometrie.js','ariane-rs/coquille/facade-gcv1.js'],
  preparer:'coeur=>({G:globalThis.BananeGeometry3,f:ArianeFacadeGcv1.creer(coeur,globalThis.BananeGeometry3),jouer:('+jouer.toString()+')})',
  js:'(e,t)=>t.jouer(t.G,e)',rs:'(e,t)=>t.jouer(t.f,e)',bilan:'t=>t.f.compteurs()'}};
