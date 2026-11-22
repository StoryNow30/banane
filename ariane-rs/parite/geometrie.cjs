'use strict';
/* CH-064 : parité de src/geometry.js (V4.6 : proposeBoth et propose) contre la façade WASM (ariane-geometrie).
 * Cas : chaque nuage réel des collections du 04 et du 05/11, une fois avec les réglages par défaut (proposeBoth), puis
 * des cas limites (réglages invalides, rail absent, nuage vide, contours absents, découpe absente ou partielle, point
 * court qui fait lever C.point, réglages en plus). */
const G=require('../../src/geometry.js'),F=require('../coquille/facade-geometrie.js'),{nuages}=require('../../tools/ch064-nuages.cjs');
let facade=null;
const fac=coeur=>facade&&facade.coeur===coeur?facade.f:(facade={coeur,f:F.creer(coeur,G)}).f;
function*limites(c){
 yield ['reglage-invalide',{f:'proposeBoth',a:[c,{grid:0}]}];
 yield ['reglage-chaine',{f:'proposeBoth',a:[c,{searchY:'0.08'}]}];
 yield ['reglages-incoherents',{f:'proposeBoth',a:[c,{pairedSupportLateral:.07}]}];
 yield ['reglage-en-plus',{f:'proposeBoth',a:[c,{autre:1,lab:{x:[1,2]}}]}];
 yield ['reglage-bande-chaine',{f:'proposeBoth',a:[c,{topBand:'0.012'}]}];
 yield ['rail-absent',{f:'propose',a:[{...c,rails:{left:c.rails.left}},'right']}];
 yield ['nuage-vide',{f:'proposeBoth',a:[{...c,pointsSceneRelative:[]}]}];
 yield ['contours-absents',{f:'proposeBoth',a:[{...c,rails:{left:{...c.rails.left,profileContours:[]},right:{...c.rails.right,profileContours:undefined}}}]}];
 yield ['decoupe-absente',{f:'proposeBoth',a:[{...c,visibleByClipBoxes:undefined}]}];
 yield ['decoupe-partielle',{f:'proposeBoth',a:[{...c,visibleByClipBoxes:c.pointsSceneRelative.map((p,i)=>i%7?true:(i%14?false:null))}]}];
 yield ['point-court',{f:'proposeBoth',a:[{...c,pointsSceneRelative:[...c.pointsSceneRelative.slice(0,50),[0,0]]}]}];
 yield ['points-heterogenes',{f:'proposeBoth',a:[{...c,pointsSceneRelative:c.pointsSceneRelative.map((p,i)=>i%11?p:(i%22?null:['x',1,2]))}]}];
 yield ['options-nulles',{f:'proposeBoth',a:[c,null]}];
}
module.exports={nom:'geometrie',description:'src/geometry.js (V4.6), proposeBoth et propose',sources:['src/geometry.js','vendor/capture-core.js'],
 *cas({max=Infinity}={}){let n=0;
  for(const c of nuages(max)){n++;
   if(n<=3)for(const [nom,e] of limites(c))yield {id:'limite-'+n+'-'+nom,entree:e};
   yield {id:'nuage-'+n,entree:{f:'proposeBoth',a:[c,{...G.DEFAULTS}]}};}},
 js({f,a}){return G[f](...a);},
 rs({f,a},coeur){return fac(coeur)[f](...a);},
 bilan:()=>facade?facade.f.compteurs():null,
 /* Exécution dans Chromium (tools/ch064-parite.cjs --chromium) : scripts chargés dans la page, fonctions évaluées dans la page. */
 navigateur:{scripts:['vendor/capture-core.js','src/geometry.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-geometrie.js'],
  preparer:'coeur=>({facade:ArianeFacadeGeometrie.creer(coeur,BananeGeometry3)})',
  js:'(e)=>BananeGeometry3[e.f](...e.a)',rs:'(e,etat)=>etat.facade[e.f](...e.a)',bilan:'etat=>etat.facade.compteurs()'}};
