'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('../fixtures.cjs');
/* `store`, `local`, `session` (facultatifs) : partagés entre deux « vies » du service worker pour simuler son redémarrage. */
function production({enabled=true,adapter=new SimulatedESV(),store=new MemoryStore(),local=null,session=null}={}){
 const root=path.resolve(__dirname,'../..'),commands=[];let message;
 store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];
 const ctx={console,URL,TextEncoder,performance,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,Date,
  chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>message=f},onConnect:{addListener:()=>{}}},
   action:{onClicked:{addListener:()=>{}}},storage:{local:local||{get:async()=>({}),set:async()=>{}},...(session?{session}:{})},
   tabs:{get:async id=>({id,url:'https://esv.lidar.altametris.xyz/rails_validation/test'}),query:async()=>[],onRemoved:{addListener:()=>{}},
    sendMessage:async(id,m)=>{if(m.kind==='launcher-visibility')return {ok:true};if(m.kind==='liste-instantane')return {ok:false,reason:'banc-sans-table'};/* E1 : lecture de la mémoire de la page par le pont, pas une commande ESV */commands.push({action:m.action,args:m.args});return {result:await adapter[m.action](...m.args)};}},
   scripting:{executeScript:async options=>[{frameId:0,result:options.func?null:undefined}]},windows:{onRemoved:{addListener:()=>{}},create:async()=>({id:1}),update:async()=>{}}}};
 vm.createContext(ctx);ctx.importScripts=(...files)=>{for(const f of files){if(f==='src/perf-phase.js'&&!enabled)continue;
  if(f==='src/storage.js'){ctx.BananeStorage3=class{constructor(){return store;}};continue;}
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});}};
 vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx,{filename:'background.js'});
 const sender={id:'test',url:'chrome-extension://test/panel.html',tab:{id:20}};
 const api=(action,args={})=>new Promise((resolve,reject)=>{message({kind:'panel',action,args},sender,r=>r.error?reject(Error(r.error)):resolve(r.result));});
 const get=name=>vm.runInContext(name,ctx);
 /* Message brut au service worker, réponse synchrone ou aucune (sender réglable). */
 const esvSender={id:'test',tab:{id:1},url:'https://esv.lidar.altametris.xyz/rails_validation/test'};
 const raw=(m,sender=esvSender)=>{let out;const returned=message(m,sender,v=>{out=v;});return {get out(){return out;},returned};};   // `out` lu au moment voulu (réponse différée)
 const settle=async()=>{const e=get('engine');if(e.task)await e.task;return api('view');};
 return {ctx,api,raw,get,store,adapter,commands,settle};
}
function normalize(x){return JSON.parse(JSON.stringify(x,(k,v)=>k==='capturedAt'?'<clock>':v));}
/* Stockage chrome.storage.* en mémoire (get par clé, liste ou tout ; set ; remove). */
function memoire(){const m={};return {m,get:async k=>k==null?structuredClone(m):Object.fromEntries([].concat(k).filter(x=>x in m).map(x=>[x,structuredClone(m[x])])),
 set:async o=>{for(const k of Object.keys(o))m[k]=structuredClone(o[k]);},remove:async k=>{for(const x of [].concat(k))delete m[x];}};}
module.exports={production,normalize,memoire};
