'use strict';
/* Harnais du service worker : `background.js` exécuté dans un contexte `vm`,
 * API Chrome et adaptateur ESV simulés. Partagé par `background.test.cjs` et
 * `background-lot.test.cjs` (découpés pour tenir sous 10 s par fichier). */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MemoryStore,SimulatedESV}=require('../fixtures.cjs');
function background({shadow,adapter=new SimulatedESV(),store=new MemoryStore(),globals={}}={}){store.all=async n=>n==='clouds'?[...store.clouds.values()]:store[n];store.keys=async()=>[...store.clouds.keys()];let onMessage,onConnect,click,onWindowRemoved,onTabRemoved;const opened=[],injected=[],panelTabs=[],launcherMessages=[];
 const ctx={URL,console,importScripts:()=>{},BananeEngine3:require('../../src/engine.js'),BananeManualSession4:require('../../src/manual-session.js'),BananeNativeSession4:require('../../src/native-session.js'),BananeGCV1Export:require('../../src/gcv1-export.js'),BananeStorage3:class{constructor(){return store;}},BananeGeometryBrain:require('../../src/geometry-brain.js'),
  BananeGCV1Shadow:shadow,...globals,
  chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>onMessage=f},onConnect:{addListener:f=>onConnect=f}},
   action:{onClicked:{addListener:f=>click=f}},storage:{local:{get:async()=>({}),set:async()=>{}}},
   tabs:{get:async id=>({id,url:'https://esv.lidar.altametris.xyz/rails_validation/test'}),query:async({url}={})=>!url?[{id:1,url:'https://esv.lidar.altametris.xyz/rails_validation/test',title:'ESV TEST'},...panelTabs]:
     Array.isArray(url)?[]:url.startsWith('chrome-extension:')?[]:[{id:1,title:'ESV TEST'}],
    sendMessage:async(id,m)=>m.kind==='launcher-visibility'?launcherMessages.push(m):({result:await adapter[m.action](...m.args)}),
    onRemoved:{addListener:fn=>onTabRemoved=fn}},
   scripting:{executeScript:async options=>injected.push(options)},windows:{create:async o=>{opened.push(o);panelTabs.push({id:opened.length+20,url:o.url,windowId:opened.length});return {id:opened.length};},
    update:async()=>{},onRemoved:{addListener:fn=>onWindowRemoved=fn}}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../../background.js'),'utf8'),ctx);
 const sender={id:'test',url:'chrome-extension://test/panel.html',tab:{id:20}};
 const message=(m,from=sender)=>new Promise(resolve=>{const ret=onMessage(m,from,resolve);if(ret!==true)resolve(undefined);});
 const api=async(action,args={})=>{const r=await message({kind:'panel',action,args});if(r.error)throw Error(r.error);return r.result;};
 return {adapter,store,api,message,click,opened,injected,launcherMessages,shadow,
  connectPanel:(url='chrome-extension://test/panel.html',windowId=99,tabId=199)=>{let disconnected;
   // V4.5.4 : le service worker demande un changement de vue par le port ;
   // le banc doit pouvoir l'observer pour vérifier qu'aucune fenêtre n'est ouverte en double.
   const posted=[];
   const port={name:'banane-panel-presence',sender:{id:'test',url,tab:{id:tabId,windowId}},
     postMessage:m=>posted.push(m),onDisconnect:{addListener:f=>disconnected=f}};
   onConnect(port);return {posted,disconnect:async()=>{disconnected();await new Promise(resolve=>setImmediate(resolve));}};},
 closeWindow:async id=>{const index=panelTabs.findIndex(tab=>tab.windowId===id);
   if(index>=0){const [tab]=panelTabs.splice(index,1);onTabRemoved?.(tab.id);}
   onWindowRemoved?.(id);await new Promise(resolve=>setImmediate(resolve));}};
}
function shadowHarness({fallback=false,pilotFailure=false,contractHash='candidate-hash'}={}){let enabled=false,activeAssistedEnabled=false,armed=false,last=null;
 const calls={arm:0,disarm:0,consume:0};
 return {calls,
  configure(options={}){if(Object.hasOwn(options,'enabled'))enabled=options.enabled;if(Object.hasOwn(options,'activeAssisted'))activeAssistedEnabled=options.activeAssisted;return this.state();},
  state:()=>({enabled,activeAssistedEnabled,selector:armed||'shadow',contract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:contractHash}}),journal:()=>last,
  armOnce(selector){assert.ok(['active-assisted','active-pilot-test'].includes(selector));if(selector==='active-assisted')assert.equal(activeAssistedEnabled,true);assert.equal(armed,false);armed=selector;calls.arm++;
   last={contract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:contractHash},selection:{selector,
     requestedEngine:'geometry-candidate-v1',selectedEngine:pilotFailure?null:fallback?'v4.6':'geometry-candidate-v1',fallback:pilotFailure?false:fallback,
     fallbackReason:fallback?'candidate-test-failure':null},comparison:{v46:{},gcv1:fallback?null:{},selectedEngine:fallback?'v4.6':'geometry-candidate-v1',fallback}};},
  disarm(){armed=false;calls.disarm++;return this.state();},
  consumeLast(){calls.consume++;const out=last;last=null;return out;},
 };
}
module.exports={background,shadowHarness};
