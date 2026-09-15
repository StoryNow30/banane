/* Ordinary web-page fixture. ESV and Chrome APIs are SIMULATED.
 * The production background, panel, engine and IndexedDB storage code run unchanged.
 * This does not load a Manifest V3 extension or connect to ESV.
 */
(()=>{'use strict';const K=BananeCore3;
 const ready=fetch('tests/corpus/banane-lidar-part-23-cut-2855-1788941885642.json').then(r=>r.json());
 let live=JSON.parse(localStorage.getItem('simulatedESV')||'null'),listener;
 const save=()=>{localStorage.setItem('simulatedESV',JSON.stringify(live));document.getElementById('fixture-cut').textContent='Simulation ESV : cut '+live.identity.cut;};
 async function state(){const base=await ready;if(!live){live={identity:{pageId:'browser-fixture-page',frameId:'browser-fixture-frame',part:23,cut:100,shape:'U50'},rails:K.clone(base.rails)};save();}return {...K.clone(live),capturedAt:new Date().toISOString()};}
 async function page(action,args){const base=await ready;await state();
  if(action==='ping')return {version:'3.0.1',pageId:live.identity.pageId};
  if(action==='state')return state();
  if(action==='capture'){const d=K.clone(base);Object.assign(d,live.identity);d.identity=K.clone(live.identity);d.captureId=K.uid();d.rails=K.clone(live.rails);return d;}
  if(action==='apply'){K.assertTarget(args[0].identity,live.identity);live.rails=K.expectedPoses(args[0],args[1]);save();return state();}
  if(action==='restore'){K.assertTarget(args[0].identity,live.identity);live.rails=K.clone(args[0].rails);save();return state();}
  if(action==='next'||action==='validateAndNext'){live.identity.cut++;live.rails=K.clone(base.rails);save();return action==='next'?state():{navigationObserved:true,serverConfirmed:false,nextIdentity:K.clone(live.identity)};}
  if(action==='cancel')return {cancelRequested:true};throw Error('Unknown fixture command');
 }
 globalThis.importScripts=()=>{}; // Dependencies are loaded by explicit script tags in this fixture only.
 globalThis.chrome={
  runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,
   onMessage:{addListener:fn=>{listener=fn;}},sendMessage:m=>new Promise(resolve=>listener(m,{id:'fixture',url:'chrome-extension://fixture/panel.html'},resolve))},
  storage:{local:{get:async k=>({[k]:JSON.parse(localStorage.getItem('chrome-fixture:'+k)||'null')}),set:async o=>{for(const [k,v] of Object.entries(o))localStorage.setItem('chrome-fixture:'+k,JSON.stringify(v));}}},
  tabs:{get:async()=>({id:7,url:'https://esv.lidar.altametris.xyz/rails_validation/fixture'}),
   query:async({url})=>url.startsWith('chrome-extension:')?[]:[{id:7,title:'SIMULATION ESV — aucun serveur'}],
   sendMessage:async(id,m)=>{try{return {result:await page(m.action,m.args)};}catch(e){return {error:e.message};}}},
  scripting:{executeScript:async()=>[]},action:{onClicked:{addListener:()=>{}}},windows:{create:async()=>{},update:async()=>{}}
 };
 document.getElementById('fixture-next').onclick=()=>page('next',[]);
 document.getElementById('fixture-reset').onclick=()=>{localStorage.clear();const request=indexedDB.deleteDatabase('banane-test-v3');request.onsuccess=()=>location.reload();request.onblocked=()=>location.reload();};
 state();
})();
