'use strict';
/* CH-070 : parité de Date.parse (ariane-session::js_extra::date, fonction 298) contre V8. Cas : dates réelles des
 * journaux de banane-data (forme relevée : toISOString), grammaire ISO tirée à graine fixe (bornes des champs, années
 * étendues, fractions, décalages, 24:00), et chaînes altérées (un caractère changé, retiré ou ajouté). Côté Rust : un
 * refus « hors domaine » rejoue Date.parse (compté) ; le banc exige 0 écart ET compte ce que le cœur a servi. */
const {graine,choisir}=require('./session-commun.cjs');
const corpus=()=>{try{return require('../../tools/ch064-corpus.cjs');}catch{return null;}};
let n={coeur:0,repli:0};
const deux=(r,max)=>String(Math.floor(r()*(max+1))).padStart(2,'0');
function tirer(r){
 const an=choisir(r,[()=>String(1900+Math.floor(r()*200)),()=>String(Math.floor(r()*10000)).padStart(4,'0'),()=>(r()<.5?'+':'-')+String(Math.floor(r()*275800)).padStart(6,'0'),()=>choisir(r,['+275760','-271821','-000000','+000000','0000','9999'])])();
 let s=an;if(r()<.9){s+='-'+choisir(r,[()=>deux(r,13),()=>choisir(r,['00','01','02','12','13'])])();if(r()<.9)s+='-'+choisir(r,[()=>deux(r,32),()=>choisir(r,['00','01','28','29','30','31','32'])])();}
 if(r()<.8&&s.length>=10){s+='T'+choisir(r,[()=>deux(r,25),()=>'24',()=>'23'])()+':'+choisir(r,[()=>deux(r,60),()=>'00',()=>'59'])();
  if(r()<.85){s+=':'+choisir(r,[()=>deux(r,60),()=>'00'])();if(r()<.8)s+='.'+choisir(r,[()=>String(Math.floor(r()*1000)).padStart(3,'0'),()=>'0'.repeat(1+Math.floor(r()*5)),()=>String(Math.floor(r()*1e7))])();}
  s+=choisir(r,[()=>'Z',()=>'Z',()=>(r()<.5?'+':'-')+deux(r,24)+':'+deux(r,60),()=>''])();}
 return s;}
function alterer(r,s){const i=Math.floor(r()*(s.length+1)),c=choisir(r,['','0','9','-',':','T','Z','z','t',' ','.','+',',','x','\u0661']);
 return r()<.5?s.slice(0,i)+c+s.slice(i+1):s.slice(0,i)+c+s.slice(i);}
module.exports={nom:'session-date',description:'Date.parse, forme ISO stricte',sources:[],
 *cas({max=Infinity}={}){const r=graine(298),vus=new Set();
  for(const s of ['','undefined','null','2026-11-06T07:21:00.000Z','2026-11-06T07:21:00','2026-11-06t07:21:00z',' 2026-11-06','+0100'])yield {id:'fixe-'+s,entree:s};
  const C=corpus();let k=0;
  if(C&&max>0)for(const z of C.zips()){for(const e of C.entrees(z)){if(!/echo|bilan/.test(e)||k>4)continue;k++;
   const t=require('node:child_process').execFileSync('unzip',['-p',z,e],{maxBuffer:2**31-1,encoding:'utf8'});
   for(const m of t.matchAll(/"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)"/g)){if(vus.has(m[1]))continue;vus.add(m[1]);if(vus.size>40000)break;yield {id:'reel-'+vus.size,entree:m[1]};}}}
  for(let i=0;i<200000;i++){const s=tirer(r);yield {id:'tire-'+i,entree:s};if(i%4===0)yield {id:'altere-'+i,entree:alterer(r,s)};}},
 js(s){return Date.parse(s);},
 rs(s,coeur){try{const v=coeur.appeler(298,{a:[s]});n.coeur++;return v;}catch(e){if(e.name==='HorsDomaine'){n.repli++;return Date.parse(s);}throw e;}},
 bilan:()=>({...n}),
 navigateur:{scripts:['ariane-rs/coquille/vba.js','ariane-rs/coquille/coeur.js'],preparer:'coeur=>({coeur,n:{coeur:0,repli:0}})',
  js:'s=>Date.parse(s)',rs:'(s,t)=>{try{const v=t.coeur.appeler(298,{a:[s]});t.n.coeur++;return v;}catch(e){if(e.name==="HorsDomaine"){t.n.repli++;return Date.parse(s);}throw e;}}',bilan:'t=>t.n'}};
