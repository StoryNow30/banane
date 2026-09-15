const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function bridge({launcherStatus}={}){let listener,onMessage,pill,counter=0,clock=0,actualVisible=true;const timers=new Map(),sent=[],traces=[];
 const ctx={window:null,location:{origin:'https://esv.lidar.altametris.xyz'},crypto:{randomUUID:()=>String(++counter)},__banane4NativeGate:{active:false,channel:null},
  Date:class extends Date{static now(){return clock;}},setTimeout:(fn,ms)=>{const id=++counter;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>{},
  addEventListener:(name,fn)=>listener=fn,postMessage:m=>sent.push(m),document:{createElement:()=>pill={style:{},isConnected:false,remove(){this.isConnected=false;}},documentElement:{append:el=>{el.isConnected=true;}}},
  chrome:{runtime:{id:'test',onMessage:{addListener:fn=>onMessage=fn},sendMessage:async m=>m.kind==='launcher-status'?(launcherStatus?launcherStatus():{visible:actualVisible}):traces.push(m)}}};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/bridge.js'),'utf8'),ctx);
 function command(action){const replies=[];onMessage({kind:'page-command',action,args:[]},{id:'test'},r=>replies.push(r));return {request:sent.at(-1),replies,timer:[...timers.keys()].at(-1)};}
 function deliver(c,data){listener({source:vm.runInContext('window',ctx),origin:ctx.location.origin,data:{id:c.request.id,channel:c.request.channel,...data}});}
 function timeout(c){const t=timers.get(c.timer);clock+=t.ms;t.fn();}
 function emit(data){listener({source:vm.runInContext('window',ctx),origin:ctx.location.origin,data});}
 return {command,deliver,timeout,emit,sent,traces,timers,pill:()=>pill,setActualVisible:value=>actualVisible=value,
  uiMessage:(m,sender={id:'test'})=>{const replies=[];onMessage(m,sender,r=>replies.push(r));return replies;}};
}
test('the floating Banane button follows window visibility signals without intercepting ESV input',async()=>{
 const f=bridge();assert.equal(f.pill().hidden,true);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pill().hidden,false);
 assert.equal(f.pill().isConnected,true);f.setActualVisible(false);assert.equal(f.uiMessage({kind:'launcher-visibility',visible:false})[0].ok,true);
 assert.equal(f.pill().hidden,true);assert.equal(f.pill().isConnected,false);
 f.setActualVisible(true);f.uiMessage({kind:'launcher-visibility',visible:true});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.pill().hidden,false);assert.equal(f.pill().isConnected,true);
 f.uiMessage({kind:'launcher-visibility',visible:false},{id:'foreign'});assert.equal(f.pill().isConnected,true);
});
test('an obsolete initial status cannot restore the button after a panel opens',async()=>{
 let settle,calls=0,actual=false;const f=bridge({launcherStatus:()=>++calls===1?new Promise(resolve=>settle=resolve):{visible:actual}});
 assert.equal(f.pill().isConnected,false);f.uiMessage({kind:'launcher-visibility',visible:false});settle({visible:true});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pill().isConnected,false);
 actual=true;f.uiMessage({kind:'launcher-visibility',visible:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pill().isConnected,true);
 f.pill().onclick();assert.equal(f.pill().isConnected,false);
});
test('an out-of-order show message cannot reinsert the button while a panel exists',async()=>{
 const f=bridge();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pill().isConnected,true);
 f.setActualVisible(false);f.uiMessage({kind:'launcher-visibility',visible:true});
 assert.equal(f.pill().isConnected,false);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pill().isConnected,false);
});
test('a read-only observation timeout never cancels an active ESV operation',()=>{
 const f=bridge(),read=f.command('state');f.timeout(read);
 assert.match(read.replies[0].error,/Clique sur Connecter/);assert.equal(read.replies[0].diagnostic.acknowledged,false);assert.equal(f.sent.filter(x=>x.action==='cancel').length,0);
});
test('a validation timeout records its last acknowledged stage, cancels once, and ignores late replies',()=>{
 const f=bridge(),write=f.command('validateAndNext');f.deliver(write,{kind:'banane3:progress',stage:'received',detail:{}});
 f.deliver(write,{kind:'banane3:progress',stage:'validation-click-returned',detail:{label:{cut:7460}}});f.timeout(write);
 assert.equal(write.replies[0].diagnostic.lastStage,'validation-click-returned');assert.equal(f.traces.length,2);
 assert.equal(f.sent.filter(x=>x.action==='validateAndNext').length,1);assert.equal(f.sent.filter(x=>x.action==='cancel').length,1);
 f.deliver(write,{kind:'banane3:result',result:{navigationObserved:true}});assert.equal(write.replies.length,1);
});
test('native observation messages are forwarded and passive adapter timeouts never send cancel',async()=>{
 const f=bridge(),start=f.command('nativeStart');f.timeout(start);assert.equal(f.sent.filter(x=>x.action==='cancel').length,0);
 f.emit({kind:'banane4:native-event',channel:start.request.channel,requestId:'native-1',type:'visit-started',payload:{sessionId:'s'}});
 await new Promise(resolve=>setImmediate(resolve));assert.ok(f.traces.some(x=>x.kind==='native-event'&&x.type==='visit-started'));
 assert.ok(f.sent.some(x=>x.kind==='banane4:native-ack'&&x.requestId==='native-1'));
});
