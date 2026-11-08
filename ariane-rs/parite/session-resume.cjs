'use strict';
/* CH-070 : parité de src/part-summary-49.js (entier) contre ariane-session::resume (fonctions 250 à 254), par la façade
 * ariane-rs/coquille/facade-session.js. Cas : relevé des essais du tronc, exports réels de banane-data (fromJournal puis
 * summarize, projectEvent de chaque événement), variantes à graine fixe. */
const P=require('../../src/part-summary-49.js'),F=require('../coquille/facade-session.js'),{releve,graine,perturber}=require('./session-commun.cjs');
const corpus=()=>{try{return require('../../tools/ch064-corpus.cjs');}catch{return null;}};
let facade=null;
const fa=coeur=>{if(!facade||facade.coeur!==coeur)facade={coeur,R:F.resume(coeur,P)};return facade.R;};
const appeler=(M,{f,a})=>M[f](...a);
/* Exports réels : un journal de lot porte {events, state:{sessionId, batch, current, events}}. */
function* reels(max,navigateur){const C=corpus();if(!C)return;let n=0;
 for(const z of C.zips()){for(const e of C.entrees(z)){if(n>=max)return;if(!/bilan-v4/.test(e))continue;
  let j;try{j=JSON.parse(require('node:child_process').execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'}));}catch{continue;}
  if(!j||typeof j!=='object'||!(Array.isArray(j.events)||Array.isArray(j.state?.events)))continue;n++;
  const id='reel-'+n;
  /* journal entier (85 Mo) : Node seulement (la page de Chromium n'y survit pas) ; tronqué à 3 000 événements : partout */
  const court={...j,events:j.events.slice(-3000),state:{...j.state,events:(j.state?.events||[]).slice(-150)}};
  for(const [nomJ,jj] of navigateur?[['court',court]]:[['entier',j],['court',court]]){
   yield {id:id+'-'+nomJ+'-fromJournal',entree:{f:'fromJournal',a:[jj]}};
   const xx=P.fromJournal(jj);
   for(const h of ['available','loading'])yield {id:id+'-'+nomJ+'-summarize-'+h,entree:{f:'summarize',a:[{...xx,historyStatus:h,details:true}]}};
   yield {id:id+'-'+nomJ+'-summarize-esv',entree:{f:'summarize',a:[{...xx,batch:null}]}};}
  const x=P.fromJournal(j);
  /* chemin du panneau : l'historique est projeté (projectEvent) avant summarize */
  const proj=x.events.map(P.projectEvent).filter(Boolean);
  for(const h of ['available','unavailable'])yield {id:id+'-summarize-projete-'+h,entree:{f:'summarize',a:[{...x,events:proj,historyStatus:h,details:true}]}};
  const ev=x.events;for(let i=0;i<ev.length;i+=Math.max(1,Math.floor(ev.length/200)))yield {id:id+'-projectEvent-'+i,entree:{f:'projectEvent',a:[ev[i]]}};
  const r=graine(n);for(let k=0;k<3;k++)yield {id:id+'-variante-'+k,entree:{f:'summarize',a:[{...perturber({...x,events:proj},r,0.02),details:true}]}};
 }}}
module.exports={nom:'session-resume',description:'src/part-summary-49.js, entier',sources:['src/part-summary-49.js'],
 *cas({max=Infinity,navigateur=false}={}){const vus=[];
  for(const c of releve('src/part-summary-49.js:')){vus.push(c);yield {id:c.id,entree:{f:c.f,a:c.entree.a}};}
  const r=graine(70);
  for(let k=0;k<4;k++)for(const c of vus)if(c.f==='summarize'||c.f==='projectEvent')yield {id:c.id+'-variante-'+k,entree:{f:c.f,a:perturber(c.entree.a,r,0.08)}};
  for(const c of reels(max,navigateur))yield c;},
 js(e){return appeler(P,e);},
 rs(e,coeur){return appeler(fa(coeur),e);},
 bilan:()=>facade?facade.R.compteurs():null,
 navigateur:{scripts:['src/part-summary-49.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-session.js'],
  preparer:'coeur=>({R:ArianeFacadeSession.resume(coeur,ArianePartSummary49)})',
  js:'e=>ArianePartSummary49[e.f](...e.a)',rs:'(e,t)=>t.R[e.f](...e.a)',bilan:'t=>t.R.compteurs()'}};
