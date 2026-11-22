'use strict';
/* CH-070 : parité de src/core.js (expectedPoses, pairCorpus) contre ariane-session::noyau (285, 286), par la façade.
 * Cas : relevé des essais du tronc, rails réels des exports Écho de banane-data avec propositions tirées à graine fixe,
 * corpus de fichiers (réels découpés en enregistrements et nuages, et synthétiques : contradictions, doublons, JSON
 * invalide, listes mal formées), variantes. */
const K=require('../../src/core.js'),X=require('../../src/native-export.js'),F=require('../coquille/facade-session.js'),{releve,graine,perturber}=require('./session-commun.cjs');
const corpus=()=>{try{return require('../../tools/ch064-corpus.cjs');}catch{return null;}};
let facade=null;const fa=coeur=>{if(!facade||facade.coeur!==coeur)facade={coeur,K:F.noyau(coeur,K)};return facade.K;};
function* reels(max){const C=corpus();if(!C)return;let n=0;
 for(const z of C.zips()){for(const e of C.entrees(z)){if(n>=max)return;if(!/ariane-echo-/.test(e))continue;
  let j;try{j=X.expand(JSON.parse(require('node:child_process').execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'})));}catch{continue;}
  if(!Array.isArray(j.records))continue;n++;const id='reel-'+n,r=graine(3000+n);
  for(const [i,rec] of j.records.entries()){const b=rec.beforeEstablished;if(!b?.rails)continue;
   const d=()=>[(r()-.5)*0.02,(r()-.5)*0.02,(r()-.5)*0.002];
   yield {id:id+'-expectedPoses-'+i,entree:{f:'expectedPoses',a:[b,{left:{delta:d()},right:{delta:d()}}]}};
   if(i%5===0)yield {id:id+'-expectedPoses-absente-'+i,entree:{f:'expectedPoses',a:[b,{left:{delta:d()}}]}};}
  /* un corpus : chaque enregistrement et sa capture « reconstituée » (mêmes champs d'association), en fichiers séparés */
  const recs=j.records.slice(0,40).map(x=>({recordId:x.recordId,lidarCaptureId:x.lidarCaptureIds?.[0]||'c-'+x.recordId,part:x.identity?.part,cut:x.identity?.cut,shape:x.identity?.shape,
   sessionId:x.nativeSessionId,visitId:x.visitId,coordinateBridge:{sceneFrameId:x.identity?.frameId},rails:{left:{initial:x.beforeEstablished?.rails?.left},right:{initial:x.beforeEstablished?.rails?.right}}}));
  const caps=recs.map(x=>({captureId:x.lidarCaptureId,pointsSceneRelative:[[0,0,0]],part:x.part,cut:x.cut,shape:x.shape,sessionId:x.sessionId,visitId:x.visitId,coordinateBridge:x.coordinateBridge,rails:{left:x.rails.left.initial,right:x.rails.right.initial}}));
  const files=[{name:'refs',text:JSON.stringify({records:recs})},{name:'caps',text:JSON.stringify({clouds:caps})},{name:'doublon',text:JSON.stringify({manualReferences:recs.slice(0,5)})},
   {name:'contradiction',text:JSON.stringify({clouds:caps.slice(0,3).map(c=>({...c,part:-1}))})}];
  yield {id:id+'-pairCorpus',entree:{f:'pairCorpus',a:[files]}};
  for(let k=0;k<3;k++){const v=perturber({recs,caps},r,0.05);yield {id:id+'-pairCorpus-v'+k,entree:{f:'pairCorpus',a:[[{name:'a',text:JSON.stringify({records:v.recs})},{name:'b',text:JSON.stringify({clouds:v.caps})}]]}};}
 }}}
const SYNTH=[[],[{name:'x',text:'{}'}],[{name:'x',text:'[]'}],[{text:'null'}],[{name:'x',text:'{"clouds":5,"records":"a"}'}],[{name:'x',text:'{oups'}],
 [{name:'x',text:'{"captureId":"c","pointsSceneRelative":[],"__proto__":1}'}],[{name:'é',text:'{"records":[{"recordId":"r","lidarCaptureId":"c"}]}'},{name:'y',text:'{"captureId":"c","pointsSceneRelative":[1]}'}],
 [{name:'x',text:'{"records":[{"recordId":1},{"recordId":1},{"recordId":1,"a":2}]}'}],[{name:'n',text:'{"a":1e400,"b":-0,"c":"\\ud83d\\ude00","2":1,"1":0}'}]];
module.exports={nom:'session-noyau',description:'src/core.js : expectedPoses, pairCorpus',sources:['src/core.js','vendor/capture-core.js'],
 *cas({max=Infinity}={}){const vus=[];
  for(const c of releve('src/core.js:')){vus.push(c);yield {id:c.id,entree:{f:c.f,a:c.entree.a}};}
  for(const [i,f] of SYNTH.entries())yield {id:'synthetique-'+i,entree:{f:'pairCorpus',a:[f]}};
  const r=graine(73);for(let k=0;k<3;k++)for(const c of vus)yield {id:c.id+'-variante-'+k,entree:{f:c.f,a:perturber(c.entree.a,r,0.05)}};
  for(const c of reels(max))yield c;},
 js(e){return K[e.f](...structuredClone(e.a));},
 rs(e,coeur){return fa(coeur)[e.f](...structuredClone(e.a));},
 bilan:()=>facade?facade.K.compteurs():null,
 navigateur:{scripts:['vendor/capture-core.js','src/core.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-session.js'],
  preparer:'coeur=>({K:ArianeFacadeSession.noyau(coeur,BananeCore3)})',
  js:'e=>BananeCore3[e.f](...structuredClone(e.a))',rs:'(e,t)=>t.K[e.f](...structuredClone(e.a))',bilan:'t=>t.K.compteurs()'}};
