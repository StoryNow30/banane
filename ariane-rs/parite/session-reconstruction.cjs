'use strict';
/* CH-070 : parité de src/native-reconstruction.js contre ariane-session::reconstruction (290 à 294), par la façade.
 * Cas : relevé des essais du tronc, enregistrements réels des exports Écho (sans nuages, et avec nuages : chemin de la
 * couverture recalculée, rejoué en JS), variantes à graine fixe (instantanés reclassés, poses déplacées). */
const NR=require('../../src/native-reconstruction.js'),X=require('../../src/native-export.js'),F=require('../coquille/facade-session.js'),{releve,graine,perturber}=require('./session-commun.cjs');
const corpus=()=>{try{return require('../../tools/ch064-corpus.cjs');}catch{return null;}};
let facade=null;const fa=coeur=>{if(!facade||facade.coeur!==coeur)facade={coeur,R:F.reconstruction(coeur,NR)};return facade.R;};
function* reels(max){const C=corpus();if(!C)return;let n=0;
 for(const z of C.zips()){for(const e of C.entrees(z)){if(n>=max)return;if(!/ariane-echo-/.test(e))continue;
  let j;try{j=X.expand(JSON.parse(require('node:child_process').execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'})));}catch{continue;}
  if(!Array.isArray(j.records))continue;n++;const id='reel-'+n,r=graine(4000+n);
  for(const [i,rec] of j.records.entries()){
   yield {id:id+'-reconstruireCut-'+i,entree:{f:'reconstruireCut',a:[rec]}};
   yield {id:id+'-reconstruireCut-tol-'+i,entree:{f:'reconstruireCut',a:[rec,{tolMm:5}]}};
   for(const s of ['left','right']){const d=rec.startPose?.rails?.[s]||rec.beforeEstablished?.rails?.[s];
    yield {id:id+'-etiquette-'+i+s,entree:{f:'etiquette',a:[rec,s,d]}};
    yield {id:id+'-distMm-'+i+s,entree:{f:'distMm',a:[rec.beforeEstablished?.rails?.[s],rec.humanFinalReference?.state?.rails?.[s]]}};}
   const v=perturber(rec,r,0.02);for(const s of ['left','right'])for(const sn of v.railSnapshots?.[s]||[])if(r()<.3&&sn&&typeof sn==='object')sn.clipStatus='reclassified-to-current-clip';
   yield {id:id+'-reconstruireCut-v-'+i,entree:{f:'reconstruireCut',a:[v]}};}
 }}}
module.exports={nom:'session-reconstruction',description:'src/native-reconstruction.js (sans couverture recalculée)',sources:['src/native-reconstruction.js','src/native-session.js'],
 *cas({max=Infinity}={}){const vus=[];
  for(const c of releve('src/native-reconstruction.js:')){vus.push(c);yield {id:c.id,entree:{f:c.f,a:c.entree.a}};}
  const r=graine(74);for(let k=0;k<5;k++)for(const c of vus)yield {id:c.id+'-variante-'+k,entree:{f:c.f,a:perturber(c.entree.a,r,0.05)}};
  for(const c of reels(max))yield c;},
 js(e){return NR[e.f](...structuredClone(e.a));},
 rs(e,coeur){return fa(coeur)[e.f](...structuredClone(e.a));},
 bilan:()=>facade?facade.R.compteurs():null,
 navigateur:{scripts:['vendor/capture-core.js','vendor/lidar.js','src/core.js','src/settings.js','src/raison-correction.js','src/continuity-observer.js','src/native-session.js','src/native-lidar.js','src/native-reconstruction.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-session.js'],
  preparer:'coeur=>({R:ArianeFacadeSession.reconstruction(coeur,BananeNativeReconstruction)})',
  js:'e=>BananeNativeReconstruction[e.f](...structuredClone(e.a))',rs:'(e,t)=>t.R[e.f](...structuredClone(e.a))',bilan:'t=>t.R.compteurs()'}};
