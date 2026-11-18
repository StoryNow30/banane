'use strict';
/* CH-070 : parité de src/historique-parties.js (finDe, ficheFin, ajouterFin, historique) contre ariane-session::historique
 * (260 à 263), par la façade. Cas : relevé des essais du tronc, bilans réels (fichesDepart, finsLot, lot courant),
 * variantes à graine fixe. */
const H=require('../../src/historique-parties.js'),F=require('../coquille/facade-session.js'),{releve,graine,perturber}=require('./session-commun.cjs');
const corpus=()=>{try{return require('../../tools/ch064-corpus.cjs');}catch{return null;}};
let facade=null;const fa=coeur=>{if(!facade||facade.coeur!==coeur)facade={coeur,H:F.historique(coeur,H)};return facade.H;};
function* reels(max){const C=corpus();if(!C)return;let n=0;
 for(const z of C.zips()){for(const e of C.entrees(z)){if(n>=max)return;if(!/bilan-v4/.test(e))continue;
  let j;try{j=JSON.parse(require('node:child_process').execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'}));}catch{continue;}n++;
  const id='reel-'+n,b=j.state?.batch,fins=j.finsLot,departs=j.fichesDepart,r=graine(2000+n);
  yield {id:id+'-historique',entree:{f:'historique',a:[{departs,fins,courant:b,version:j.version}]}};
  yield {id:id+'-historique-sans-courant',entree:{f:'historique',a:[{departs,fins,version:j.version}]}};
  for(const st of [b?.state,'COMPLETED','STOPPED','ERROR','RUNNING'])if(b){const bb={...b,state:st};
   yield {id:id+'-finDe-'+st,entree:{f:'finDe',a:[bb]}};
   yield {id:id+'-ficheFin-'+st,entree:{f:'ficheFin',a:[bb,{version:j.version,motif:undefined,at:j.exportedAt,ecritsPasse:3}]}};}
  for(const [i,f] of (Array.isArray(fins)?fins:[]).entries())yield {id:id+'-ajouterFin-'+i,entree:{f:'ajouterFin',a:[fins,{...f,poses:null,motif:'x'}]}};
  for(let k=0;k<5;k++)yield {id:id+'-historique-v'+k,entree:{f:'historique',a:[perturber({departs,fins,courant:b,version:j.version},r,0.05)]}};
 }}}
module.exports={nom:'session-historique',description:'src/historique-parties.js (fonctions pures)',sources:['src/historique-parties.js'],
 *cas({max=Infinity}={}){const vus=[];
  for(const c of releve('src/historique-parties.js:')){vus.push(c);yield {id:c.id,entree:{f:c.f,a:c.entree.a}};}
  const r=graine(72);for(let k=0;k<5;k++)for(const c of vus)yield {id:c.id+'-variante-'+k,entree:{f:c.f,a:perturber(c.entree.a,r,0.1)}};
  for(const c of reels(max))yield c;},
 js(e){return H[e.f](...structuredClone(e.a));},
 rs(e,coeur){return fa(coeur)[e.f](...structuredClone(e.a));},
 bilan:()=>facade?facade.H.compteurs():null,
 navigateur:{scripts:['src/historique-parties.js','ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js','ariane-rs/coquille/facade-session.js'],
  preparer:'coeur=>({H:ArianeFacadeSession.historique(coeur,BananeHistoriqueParties)})',
  js:'e=>BananeHistoriqueParties[e.f](...structuredClone(e.a))',rs:'(e,t)=>t.H[e.f](...structuredClone(e.a))',bilan:'t=>t.H.compteurs()'}};
