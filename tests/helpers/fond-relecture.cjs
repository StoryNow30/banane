'use strict';
/* Harnais du service worker pour les essais de la relecture 4.7.12
 * (audit/chantiers/relecture-478.md). Repris de `tests/background.test.cjs`,
 * réduit à ce que ces essais utilisent : `background.js` exécuté dans un
 * contexte vm, ESV simulé, stockage en mémoire, et une composition GCV1 de
 * banc qui publie la science de la fixture à chaque armement. */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('../fixtures.cjs');
function background({shadow,adapter=new SimulatedESV(),store=new MemoryStore(),globals={}}={}){let onMessage;
 store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];
 const ctx={URL,console,setTimeout,clearTimeout,importScripts:()=>{},BananeEngine3:require('../../src/engine.js'),BananeManualSession4:require('../../src/manual-session.js'),
  BananeNativeSession4:require('../../src/native-session.js'),BananeGCV1Export:require('../../src/gcv1-export.js'),BananeStorage3:class{constructor(){return store;}},
  BananeGeometryBrain:require('../../src/geometry-brain.js'),BananeGCV1Shadow:shadow,...globals,
  chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>onMessage=f},onConnect:{addListener:()=>{}}},
   action:{onClicked:{addListener:()=>{}}},storage:{local:{get:async()=>({}),set:async()=>{}}},
   tabs:{get:async id=>({id,url:'https://esv.lidar.altametris.xyz/rails_validation/test'}),
    query:async({url}={})=>!url?[{id:1,url:'https://esv.lidar.altametris.xyz/rails_validation/test',title:'ESV TEST'}]:Array.isArray(url)||url.startsWith('chrome-extension:')?[]:[{id:1,title:'ESV TEST'}],
    sendMessage:async(id,m)=>m.kind==='launcher-visibility'?null:({result:await adapter[m.action](...m.args)}),onRemoved:{addListener:()=>{}}},
   scripting:{executeScript:async()=>{}},windows:{create:async()=>({id:1}),update:async()=>{},onRemoved:{addListener:()=>{}}}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../background.js'),'utf8'),ctx);
 const sender={id:'test',url:'chrome-extension://test/panel.html',tab:{id:20}};
 const message=m=>new Promise(resolve=>{const ret=onMessage(m,sender,resolve);if(ret!==true)resolve(undefined);});
 const api=async(action,args={})=>{const r=await message({kind:'panel',action,args});if(r.error)throw Error(r.error);return r.result;};
 const settle=async()=>{while(((await api('view')).batch?.state)==='RUNNING')await new Promise(r=>setImmediate(r));return api('view');};
 return {adapter,store,api,settle};
}
/* Composition GCV1 de banc : sélection GCV1 et science de la fixture à chaque armement. */
function gcv1Shadow(science){let armed=false,pending=null;
 const contract={id:'GEOMETRY_CANDIDATE_V1',geometrySha256:'candidate-hash'};
 return {configure(){return this.state();},state:()=>({enabled:false,activeAssistedEnabled:false,selector:armed||'shadow',contract}),journal:()=>pending,
  armOnce(selector){armed=selector;pending={contract,rails:science.rails,summary:science.summary,
   selection:{selector,requestedEngine:'geometry-candidate-v1',selectedEngine:'geometry-candidate-v1',fallback:false,fallbackReason:null},
   comparison:{v46:{},gcv1:{},selectedEngine:'geometry-candidate-v1',fallback:false}};},
  disarm(){armed=false;return this.state();},consumeLast(){const out=pending;pending=null;return out;},
  scientificProposeBoth:require('../../src/gcv1-shadow.js').scientificProposeBoth};
}
module.exports={background,gcv1Shadow};
