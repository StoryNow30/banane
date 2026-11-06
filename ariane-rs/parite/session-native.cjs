'use strict';
/* CH-070 : parité des fonctions pures et méthodes de src/native-session.js portées (fonctions 270, 271, 273 à 281) contre ariane-session::session, par la façade. Sortie comparée : retour ET état modifié (harnais). Cas : relevé
 * des essais du tronc, exports Écho réels de banane-data (session, enregistrements, nuages), variantes à graine fixe. */
const NS=require('../../src/native-session.js'),S=require('../../src/settings.js'),K=require('../../src/core.js'),X=require('../../src/native-export.js');
const F=require('../coquille/facade-session.js'),H=require('./session-native-harnais.js'),{releve,graine,perturber}=require('./session-commun.cjs');
const FONCTIONS=['poseEqual','referenceParEcriture','visitRelation','redactedEvent','mergeMetrics','accountQuality','health','exportAdvice','chooseGeometry','classify','referenceFromWrite'];
const JS={proto:NS.Sessions.prototype,poseEqual:NS.poseEqual,referenceParEcriture:NS.referenceParEcriture,methodes:Object.fromEntries(FONCTIONS.slice(2).map(f=>[f,NS.Sessions.prototype[f]]))};
let facade=null;const fa=coeur=>{if(!facade||facade.coeur!==coeur)facade={coeur,F:{...F.session(coeur,NS,S,K),proto:NS.Sessions.prototype}};return facade.F;};
const corpus=()=>{try{return require('../../tools/ch064-corpus.cjs');}catch{return null;}};
function* reels(max){const C=corpus();if(!C)return;let n=0;
 for(const z of C.zips()){for(const e of C.entrees(z)){if(n>=max)return;if(!/ariane-echo-/.test(e))continue;
  let j;try{j=X.expand(JSON.parse(require('node:child_process').execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'})));}catch{continue;}
  if(!j?.session||!Array.isArray(j.records))continue;n++;const id='reel-'+n,nat=j.session,r=graine(1000+n);
  yield {id:id+'-health',entree:{f:'health',a:[],ceci:{native:nat}}};
  yield {id:id+'-exportAdvice',entree:{f:'exportAdvice',a:[],ceci:{native:nat}}};
  yield {id:id+'-mergeMetrics',entree:{f:'mergeMetrics',a:[nat.metrics],ceci:{metrics:{...nat.metrics,degradationLevels:[]}}}};
  for(let k=0;k<3;k++)yield {id:id+'-mergeMetrics-v'+k,entree:{f:'mergeMetrics',a:[perturber(nat.metrics,r,0.2)],ceci:{metrics:nat.metrics}}};
  const cross=new Map();
  for(const [i,rec] of j.records.entries()){
   for(const s of ['left','right']){const a=rec.beforeEstablished?.rails?.[s],b=rec.humanFinalReference?.state?.rails?.[s];if(a&&b)yield {id:id+'-poseEqual-'+i+s,entree:{f:'poseEqual',a:[a,b]}};}
   for(const w of rec.serverWrites||[])if(w?.body&&rec.humanFinalReference?.state)yield {id:id+'-referenceParEcriture-'+i,entree:{f:'referenceParEcriture',a:[rec.humanFinalReference.state,rec.lastObserved,w.body]}};
   const nn={id:nat.id,visits:nat.visits.slice(0,i)};
   yield {id:id+'-visitRelation-'+i,entree:{f:'visitRelation',a:[nn,rec.identity,rec.observationPeriodId,cross]}};
   cross.set(K.cutKey(rec.identity),{visitId:rec.visitId,nativeSessionId:'autre-session'});
   for(const s of ['left','right'])yield {id:id+'-chooseGeometry-'+i+s,entree:{f:'chooseGeometry',a:[rec,s]}};
   yield {id:id+'-classify-'+i,entree:{f:'classify',a:[rec]}};
   const w=(rec.serverWrites||[]).find(x=>x?.body);
   if(w)yield {id:id+'-referenceFromWrite-'+i,entree:{f:'referenceFromWrite',a:[rec,{...w,eventId:'e-'+i,at:w.at||rec.endedAt,status:w.status??200,rowIndex:w.rowIndex??0},Date.parse(rec.humanFinalReference?.observedAt||'')+5]}};
   yield {id:id+'-classify-v-'+i,entree:{f:'classify',a:[perturber(rec,r,0.03)]}};}
  for(const [i,ev] of (j.events||[]).entries()){const t=String(ev.type||'').replace(/^native-/,'');
   if(t==='capture-ready'||t==='capture-checkpoint'||t==='operator-gesture')yield {id:id+'-redactedEvent-'+i,entree:{f:'redactedEvent',a:[t,ev]}};}
  /* accountQuality : état cumulé nuage après nuage (calculé ici par le JS sur sa propre copie) */
  let etat={};for(const [i,c] of (j.clouds||[]).entries()){const cloud={...c,pointsSceneRelative:undefined};
   yield {id:id+'-accountQuality-'+i,entree:{f:'accountQuality',a:[structuredClone(etat),cloud]}};
   NS.Sessions.prototype.accountQuality.call({},etat,cloud);}
 }}}
module.exports={nom:'session-native',description:'src/native-session.js : fonctions pures et méthodes portées',sources:['src/native-session.js','src/core.js','src/settings.js'],
 *cas({max=Infinity}={}){const vus=[];
  for(const c of releve('src/native-session.js:')){const f=c.f.replace(/^proto\./,'');if(!FONCTIONS.includes(f))continue;const e={f,a:c.entree.a,ceci:c.entree.ceci};vus.push(e);yield {id:c.id,entree:e};}
  const r=graine(71);for(let k=0;k<3;k++)for(const [i,e] of vus.entries())yield {id:'variante-'+k+'-'+i+'-'+e.f,entree:{...e,a:perturber(e.a,r,0.1),ceci:e.ceci?perturber(e.ceci,r,0.05):undefined}};
  for(const c of reels(max))yield c;},
 js(e){return H.executer(JS,e);},
 rs(e,coeur){return H.executer(fa(coeur),e);},
 bilan:()=>facade?facade.F.compteurs():null,
 navigateur:{scripts:['vendor/capture-core.js','src/core.js','src/settings.js','src/raison-correction.js','src/continuity-observer.js','src/native-session.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-session.js','ariane-rs/parite/session-native-harnais.js'],
  preparer:'coeur=>{const NS=BananeNativeSession4,F=["visitRelation","redactedEvent","mergeMetrics","accountQuality","health","exportAdvice","chooseGeometry","classify","referenceFromWrite"];return {JS:{proto:NS.Sessions.prototype,poseEqual:NS.poseEqual,referenceParEcriture:NS.referenceParEcriture,methodes:Object.fromEntries(F.map(f=>[f,NS.Sessions.prototype[f]]))},R:{...ArianeFacadeSession.session(coeur,NS,BananeSettings,BananeCore3),proto:NS.Sessions.prototype}};}',
  js:'(e,t)=>Ch070Harnais.executer(t.JS,e)',rs:'(e,t)=>Ch070Harnais.executer(t.R,e)',bilan:'t=>t.R.compteurs()'}};
