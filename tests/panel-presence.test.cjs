const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('every Banane page announces its presence and reconnects after a worker interruption',async()=>{
 const ports=[],timeouts=[];
 const element=()=>({classList:{toggle(){}},setAttribute(){},replaceChildren(){},textContent:'',hidden:false});
 const elements=new Map(),document={body:{dataset:{window:'home'}},querySelectorAll:()=>[],getElementById:id=>{
  if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
 // V4.5.4 : le panneau écoute aussi les demandes de changement de vue envoyées
 // par le service worker, et lit la vue courante dans le fragment d'URL.
 const chrome={runtime:{connect(options){let disconnect;
  const port={options,onMessage:{addListener:()=>{}},onDisconnect:{addListener:fn=>disconnect=fn},drop(){disconnect();}};ports.push(port);return port;},
  sendMessage:async message=>({result:message.action==='view'?{connection:{status:'ready'},settings:{}}:[]})}};
 const context={document,chrome,location:{hash:''},addEventListener:()=>{},
  setInterval:()=>{},setTimeout:fn=>timeouts.push(fn),console};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8'),context);
 assert.equal(ports.length,1);assert.equal(ports[0].options.name,'banane-panel-presence');
 ports[0].drop();assert.equal(timeouts.length,1);timeouts[0]();assert.equal(ports.length,2);
 await new Promise(resolve=>setImmediate(resolve));
});
