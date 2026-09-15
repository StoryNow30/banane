const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){const handlers=new Map(),messages=[];const ctx={window:null,location:{origin:'https://esv.lidar.altametris.xyz'},
 addEventListener:(type,fn)=>{if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);},postMessage:m=>messages.push(m)};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/early-input.js'),'utf8'),ctx);
 let native=0;ctx.addEventListener('keydown',()=>native++);ctx.addEventListener('click',()=>native++);
 function emit(extra={}){let stopped=false;const targetKind=extra.targetKind||'canvas';const event={type:'keydown',isTrusted:true,code:'Space',key:' ',shiftKey:true,
   target:{closest:s=>targetKind==='input'&&s.startsWith('input')||targetKind==='canvas'&&s==='canvas'||targetKind==='validation'&&s.startsWith('#')},
   preventDefault(){},stopImmediatePropagation(){stopped=true;},...extra};
   for(const fn of handlers.get(event.type)||[]){fn(event);if(stopped)break;}return stopped;}
 return {ctx,messages,emit,native:()=>native};}
test('the document-start guard is inert outside a corrections session',()=>{
 const f=fixture();assert.equal(f.emit(),false);assert.equal(f.native(),1);assert.equal(f.messages.length,0);
});
test('trusted validation is stopped before the ESV listener and relayed once; native replay is allowed',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4InputGate,{active:true,phase:'READY',channel:'session-channel'});
 assert.equal(f.emit(),true);assert.equal(f.native(),0);assert.equal(f.messages.length,1);assert.equal(f.messages[0].input.isTrusted,true);
 assert.equal(f.emit({type:'click',isTrusted:false,targetKind:'validation'}),false);assert.equal(f.native(),1);
 assert.equal(f.emit({type:'keyup',shiftKey:false}),true);assert.equal(f.messages.length,2);
});
test('Shift Backspace is captured as one operator input while plain Backspace remains native',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4InputGate,{active:true,phase:'READY',channel:'session-channel'});
 assert.equal(f.emit({code:'Backspace',key:'Backspace'}),true);assert.equal(f.messages.length,1);assert.equal(f.native(),0);
 assert.equal(f.messages[0].input.code,'Backspace');assert.equal(f.messages[0].input.shiftKey,true);
 assert.equal(f.emit({code:'Backspace',key:'Backspace',shiftKey:false}),false);assert.equal(f.native(),1);
 assert.equal(f.emit({type:'keyup',code:'Backspace',key:'Backspace',shiftKey:false}),true);assert.equal(f.messages.length,2);
});
test('pointing is blocked only during preparation; decision shortcuts remain blocked after a collector error',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4InputGate,{active:true,phase:'PREPARING',channel:'session-channel'});
 assert.equal(f.emit({type:'click'}),true);assert.equal(f.emit({targetKind:'input'}),false);
 f.ctx.__banane4InputGate.phase='READY';assert.equal(f.emit({type:'click'}),false);
 f.ctx.__banane4InputGate.phase='ERROR';assert.equal(f.emit(),true);assert.equal(f.native(),2);
});
test('Enter follows the observed ESV button shortcut while typing inputs stay native',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4InputGate,{active:true,phase:'READY',channel:'session-channel'});
 assert.equal(f.emit({key:'Enter',code:'Enter',shiftKey:false}),true);assert.equal(f.native(),0);
 assert.equal(f.emit({key:'Enter',code:'Enter',shiftKey:false,targetKind:'input'}),false);assert.equal(f.native(),1);
});
test('native observation at document start is passive and does not re-emit or stop ESV input',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4NativeGate,{active:true,channel:'native-channel'});
 assert.equal(f.emit({code:'Backspace',key:'Backspace'}),false);assert.equal(f.native(),1);
 const message=f.messages.find(x=>x.kind==='banane4:native-input');assert.ok(message);assert.equal(message.input.key,'Backspace');assert.equal(message.input.shiftKey,true);
 assert.equal(f.messages.filter(x=>x.kind==='banane4:native-input').length,1);
});
