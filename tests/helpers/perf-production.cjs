'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('../fixtures.cjs');
function production({enabled=true,adapter=new SimulatedESV()}={}){
 const root=path.resolve(__dirname,'../..'),store=new MemoryStore(),commands=[];let message;
 store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];
 const ctx={console,URL,TextEncoder,performance,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,Date,
  chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>message=f},onConnect:{addListener:()=>{}}},
   action:{onClicked:{addListener:()=>{}}},storage:{local:{get:async()=>({}),set:async()=>{}}},
   tabs:{get:async id=>({id,url:'https://esv.lidar.altametris.xyz/rails_validation/test'}),query:async()=>[],onRemoved:{addListener:()=>{}},
    sendMessage:async(id,m)=>{if(m.kind==='launcher-visibility')return {ok:true};commands.push({action:m.action,args:m.args});return {result:await adapter[m.action](...m.args)};}},
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
 const raw=(m,sender=esvSender)=>{let out;const returned=message(m,sender,v=>{out=v;});return {out,returned};};
 const settle=async()=>{const e=get('engine');if(e.task)await e.task;return api('view');};
 return {ctx,api,raw,get,store,adapter,commands,settle};
}
function normalize(x){return JSON.parse(JSON.stringify(x,(k,v)=>k==='capturedAt'?'<clock>':v));}
module.exports={production,normalize};
