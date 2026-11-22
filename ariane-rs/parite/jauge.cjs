'use strict';
/* CH-064 : parité de src/gauge.js (partie numérique : classifyMm, gaugeMmOf, predictedGaugeMm, assessPair) contre
 * ariane-geometrie::jauge (fonction 32). Pas de façade (bibliothèque interne de la décision du lot) : appel direct. */
const J=require('../../src/gauge.js'),C=require('../../vendor/capture-core.js'),G=require('../../src/geometry.js'),{nuages}=require('../../tools/ch064-nuages.cjs');
let horsDomaine=0;
const BORNES=[1419.9999999999998,1420,1429.9999999999998,1430,1470,1470.0000000000002,NaN,Infinity,-Infinity,-0,'1430',null,undefined];
module.exports={nom:'jauge',description:'src/gauge.js, partie numérique',sources:['src/gauge.js','vendor/capture-core.js'],
 *cas({max=Infinity}={}){let i=0;for(const v of BORNES)yield {id:'borne-'+(i++),entree:{f:'classifyMm',a:[v]}};
  let n=0;for(const c of nuages(max)){n++;const pb=G.proposeBoth(c),deltas={left:pb.left.delta||[0,.003,-.001],right:pb.right.delta||[0,-.002,.001]};
   yield {id:'nuage-'+n+'-assessPair',entree:{f:'assessPair',a:[c.rails,deltas]}};
   yield {id:'nuage-'+n+'-gaugeMmOf',entree:{f:'gaugeMmOf',a:[c.rails]}};
   if(n<=2){yield {id:'limite-'+n+'-delta-absent',entree:{f:'predictedGaugeMm',a:[c.rails,{left:deltas.left}]}};
    yield {id:'limite-'+n+'-rails-null',entree:{f:'assessPair',a:[null,deltas]}};}}},
 js({f,a}){return f==='classifyMm'?J.classifyMm(...a):J[f](...a,C);},
 rs(e,coeur){try{return coeur.appeler(32,e);}catch(x){if(x.name==='HorsDomaine'){horsDomaine++;return this.js(e);}throw x;}},
 bilan:()=>({horsDomaineRejouesEnJs:horsDomaine}),
 navigateur:{scripts:['vendor/capture-core.js','src/gauge.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js'],preparer:'coeur=>({coeur,hd:0})',
  js:'e=>e.f==="classifyMm"?BananeGauge4.classifyMm(...e.a):BananeGauge4[e.f](...e.a,BananeCaptureCore)',
  rs:'(e,t)=>{try{return t.coeur.appeler(32,e);}catch(x){if(x.name==="HorsDomaine"){t.hd++;return e.f==="classifyMm"?BananeGauge4.classifyMm(...e.a):BananeGauge4[e.f](...e.a,BananeCaptureCore);}throw x;}}',bilan:'t=>({horsDomaineRejouesEnJs:t.hd})'}};
