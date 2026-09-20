/* Harnais du bridge isolé, partagé par tests/bridge.test.cjs et les essais de
 * navigation sans décision. Extrait tel quel : aucune assertion ne change. */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function bridge({launcherStatus}={}){let listener,onMessage,pill,counter=0,clock=0,actualVisible=true;const timers=new Map(),sent=[],traces=[];
 const ctx={window:null,location:{origin:'https://esv.lidar.altametris.xyz'},crypto:{randomUUID:()=>String(++counter)},__banane4NativeGate:{active:false,channel:null},
  Date:class extends Date{static now(){return clock;}},setTimeout:(fn,ms)=>{const id=++counter;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>{},
  addEventListener:(name,fn)=>listener=fn,postMessage:m=>sent.push(m),document:{createElement:()=>pill={style:{},isConnected:false,remove(){this.isConnected=false;}},documentElement:{append:el=>{el.isConnected=true;}}},
  chrome:{runtime:{id:'test',onMessage:{addListener:fn=>onMessage=fn},sendMessage:async m=>m.kind==='launcher-status'?(launcherStatus?launcherStatus():{visible:actualVisible}):traces.push(m)}}};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/bridge.js'),'utf8'),ctx);
 function command(action){const replies=[];onMessage({kind:'page-command',action,args:[]},{id:'test'},r=>replies.push(r));return {request:sent.at(-1),replies,timer:[...timers.keys()].at(-1)};}
 function deliver(c,data){listener({source:vm.runInContext('window',ctx),origin:ctx.location.origin,data:{id:c.request.id,channel:c.request.channel,...data}});}
 function timeout(c){const t=timers.get(c.timer);clock+=t.ms;t.fn();}
 function emit(data){listener({source:vm.runInContext('window',ctx),origin:ctx.location.origin,data});}
 return {command,deliver,timeout,emit,sent,traces,timers,pill:()=>pill,setActualVisible:value=>actualVisible=value,
  uiMessage:(m,sender={id:'test'})=>{const replies=[];onMessage(m,sender,r=>replies.push(r));return replies;}};
}
module.exports={bridge};
