#!/usr/bin/env node
'use strict';
/* Audit en lecture seule : panneau réel dans un DOM simulé, compteurs terrain,
 * coûts de copie Node et mesures horodatées. Aucun code de production modifié.
 * Usage : node tools/audit-qualite-480.cjs KIT [SORTIE.json]
 * Le DOM simulé ne prouve ni le rendu ni la réactivité dans ESV. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),os=require('node:os');
const {performance}=require('node:perf_hooks');
const ROOT=path.resolve(__dirname,'..'),SOURCE=fs.readFileSync(path.join(ROOT,'panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',onclick:null,oninput:null,
 attrs:{},style:{},classList:{toggle(){},add(){}},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
 replaceChildren(){},append(){},addEventListener(){},click(){},set onchange(_){}});
/* `chromeExtra` (4.8.0) : API chrome supplémentaires, par exemple un faux chrome.downloads. */
async function panneau(state,{hash='#automatic',reponses={},globals={},chromeExtra={}}={}){
 const elements=new Map(),appels=[],notes=[],downloads=[],intervals=[];
 const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
 getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
 Object.defineProperty(document.getElementById('notice'),'textContent',{get(){return notes.at(-1)||'';},set(v){notes.push(v);}});
 const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendMessage:async({action,args})=>{
 appels.push({action,args});return {result:action in reponses?(typeof reponses[action]==='function'?await reponses[action](args):reponses[action]):action==='view'?state:action==='list-tabs'?[]:{}};}},...chromeExtra};
 const context={document,chrome,location:{hash},addEventListener(){},setInterval:f=>intervals.push(f),setTimeout(){},clearTimeout(){},console,Date,Blob,
 URL:{createObjectURL:b=>{downloads.push(b);return 'blob:audit';},revokeObjectURL(){}},...globals};
 vm.createContext(context);vm.runInContext(SOURCE,context);
 const attendre=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};await attendre();
 return {$:id=>document.getElementById(id),appels,notes,downloads,attendre,intervals};
}
function read(f){const b=fs.readFileSync(f);return JSON.parse(f.endsWith('.gz')?zlib.gunzipSync(b):b);}
function files(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):[path.join(d,e.name)]);}
async function run(kit){
 const K=require('../src/core.js'),{Engine}=require('../src/engine.js'),Perf=require('./perf-lot.cjs');
 const f=files(path.join(kit,'lots')).find(f=>f.includes('p12-lot')&&f.includes('journal'));
 const journal=read(f),state={...journal.state,records:journal.records||[],incomplete:journal.incomplete||[]},b=state.batch,p=await panneau(state);
 const result={conditions:{at:new Date().toISOString(),node:process.version,os:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,
 logicalCPUs:os.cpus().length,totalMemoryGiB:os.totalmem()/2**30,scope:'Node, DOM simulé ; aucune mesure ESV en direct'},
 panneauP12:{compteurs:p.$('lot-compteurs').innerHTML,batch:p.$('batch').textContent,sequence:b.sequence.length,processed:b.processed.length,deferred:b.deferred.length,stoppedAtEnd:b.stoppedAtEnd},terrain:[]};
 for(const f of files(path.join(kit,'lots')).filter(f=>/journal|bilan/.test(path.basename(f)))){
  const data=read(f),m=Perf.measure(data,{tous:f.includes('p14-4721')||f.includes('p13-4721')});
  result.terrain.push({file:path.relative(kit,f),source:m.source,cycleMs:m.cycleMs,analyseMs:m.analyseMs,decisionMs:m.decisionMs,captureMs:m.commandesMs.capture,capture:m.capture,
  note:f.includes('p13-4721')?'Inclus dans p14 : ne pas additionner':null});}
 const exp=await panneau(state,{reponses:{'journal':{events:[],records:[]},'dataset':{cloudIds:[],events:[],records:[]},
 'gcv1-diagnostic-export':{observationCount:1},'gcv1-corpus-export-plan':{cloudIds:[],missingCaptureIds:['capture-manquante']}}});
 await exp.$('export-tout').onclick();await exp.attendre();
 result.exportIncomplet={notes:exp.notes,statutFinal:exp.$('export-status').textContent,fichiersDemandes:exp.downloads.length};
 const manual=await panneau({...state,batch:{...b,state:'MANUAL_TAKEOVER'}},{hash:'#native'});
 result.transitionManuelle={nativeStartHidden:manual.$('native-start').hidden,nativeStartDisabled:manual.$('native-start').disabled,notice:manual.$('notice').textContent};
 const ordered=journal.events.slice().sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));let before=null;const full=[];
 for(const e of ordered){if(e.type==='before-captured')before=e;
  if(e.type==='gcv1-shadow-observed'&&before?.identity?.cut===e.identity?.cut){full.push(Date.parse(e.timestamp)-Date.parse(before.timestamp));before=null;}}
 result.p12AnalyseAvecDecision=Perf.stats(full);
 const lum=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 result.contrastes=[['#138a4a','#ffffff'],['#b86e00','#ffffff'],['#3e6ae1','#000000'],['#6b6b6b','#ffffff'],['#8a8a8a','#000000']].map(([text,bg])=>{const a=[lum(text),lum(bg)].sort((x,y)=>x-y);return {text,bg,ratio:(a[1]+.05)/(a[0]+.05)};});
 result.copies=[];
 for(const count of [106,1000,8000]){
  const s=K.clone(state),arrays=['processed','deferred','sequence','lotPosed'];
  if(count!==106)s.records=Array.from({length:Math.round(count*state.records.length/106)},(_,i)=>({...state.records[i%state.records.length],id:'mesure-'+i}));
  for(const a of arrays)if(count!==106&&b[a]?.length)s.batch[a]=Array.from({length:Math.max(1,Math.round(count*b[a].length/106))},(_,i)=>b[a][i%b[a].length]);
  const e=new Engine({},{});e.s=s;const times=[];
  for(let i=0;i<4;i++){const t=performance.now();e.view();times.push(performance.now()-t);}
  result.copies.push({cuts:count,synthetique:count!==106,bytes:Buffer.byteLength(JSON.stringify(s)),viewMs:times});
 }
 result.structure=['background.js','panel.js','src/engine.js','src/lot-decision.js','src/adapter-page.js','src/storage.js'].map(f=>{
 const s=fs.readFileSync(path.join(ROOT,f),'utf8');return {file:f,lines:s.split('\n').length,bytes:Buffer.byteLength(s)};});
 const tests=files(path.join(ROOT,'tests')).filter(f=>f.endsWith('.test.cjs'));
 result.tests={files:tests.length,sourceReadingFiles:tests.filter(f=>/readFileSync[\s\S]*(?:panel\.js|background\.js|\.css|\.html)/.test(fs.readFileSync(f,'utf8'))).map(f=>path.relative(ROOT,f)),
 note:'Inventaire de lecture de sources, pas classement en tests purement textuels : certains exécutent le source en VM.'};
 return result;
}
if(require.main===module)run(path.resolve(process.argv[2])).then(r=>{const s=JSON.stringify(r,null,2);if(process.argv[3])fs.writeFileSync(process.argv[3],s+'\n');else console.log(s);}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={panneau,run};
