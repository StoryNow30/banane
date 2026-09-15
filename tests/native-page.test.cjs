const {test}=require('node:test'),assert=require('node:assert/strict');
const {Observer}=require('../src/native-page.js'),{K,base}=require('./fixtures.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){let state={identity:{pageId:'native-page',part:23,cut:100,shape:'U50',frameId:'native-frame',projectId:null},rails:K.clone(base.rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[]};
 let handler=null,timer=null,clock=0;const sent=[],failures=[],captures=[];
 const api={snapshot:()=>K.clone(state),capture:async(expected,active)=>{captures.push(K.cutId(expected.identity));if(!active())throw Error('passive-lidar-read-cancelled');
    const cloud=K.clone(base);cloud.identity=K.clone(expected.identity);cloud.captureId=K.uid();cloud.rails=K.clone(expected.rails);return cloud;},
   send:async(type,payload)=>{sent.push({type,payload});return {saved:true};},now:()=>clock,performanceNow:()=>clock,
   interval:fn=>{timer=fn;return 1;},clearInterval:()=>{timer=null;},defer:fn=>queueMicrotask(fn),
   install:fn=>{handler=fn;},uninstall:()=>{handler=null;},editable:t=>t?.kind==='input',targetKind:t=>t?.kind||'other',signalFailure:m=>failures.push(m)};
 Object.assign(api,options.api||{});const observer=new Observer(api,options.observer||{});
 const start=()=>observer.start({sessionId:'native-session',observationPeriodId:'period-1'});
 return {api,observer,sent,failures,captures,start,setState:value=>{state=K.clone(value);},state:()=>K.clone(state),handler:()=>handler,timer:()=>timer,
   advance:ms=>{clock+=ms;},settle:async()=>{for(let i=0;i<5;i++)await flush();}};
}
test('native input observation never blocks, delays, or re-emits the operator event',async()=>{
 const f=fixture();await f.start();await f.settle();let prevented=0,stopped=0,reemitted=0;
 const event={type:'keydown',isTrusted:true,key:' ',code:'Space',shiftKey:true,target:{kind:'canvas'},preventDefault(){prevented++;},stopPropagation(){stopped++;},stopImmediatePropagation(){stopped++;}};
 f.handler()(event);await f.settle();assert.equal(prevented,0);assert.equal(stopped,0);assert.equal(reemitted,0);
 const observed=f.sent.find(x=>x.type==='operator-event'&&x.payload.event.intent==='VALIDATE');assert.ok(observed);assert.equal(observed.payload.event.targetKind,'canvas');
 assert.equal(f.api.apply,undefined);assert.equal(f.api.next,undefined);assert.equal(f.api.validateAndNext,undefined);assert.equal(f.api.skipAndNext,undefined);
});
test('rapid navigation and a return create three distinct visits without spatial sequence inference',async()=>{
 const f=fixture();await f.start();await f.settle();
 for(const cut of [101,100]){const s=f.state();s.identity.cut=cut;s.capturedAt=new Date().toISOString();f.setState(s);await f.observer.observe('rapid-navigation');await f.settle();}
 const starts=f.sent.filter(x=>x.type==='visit-started');assert.equal(starts.length,3);assert.equal(new Set(starts.map(x=>x.payload.visitId)).size,3);
 assert.deepEqual(starts.map(x=>x.payload.identity.cut),[100,101,100]);assert.ok(f.sent.filter(x=>x.type==='visit-ended').every(x=>x.payload.reason==='target-changed'));
});
test('one missing rail is preserved and the available rail can still be offered to the passive reader',async()=>{
 const f=fixture();const s=f.state();s.rails.right=null;s.status='partial';s.partialReasons=['rail-right-not-observed'];f.setState(s);await f.start();await f.settle();
 assert.equal(f.sent.find(x=>x.type==='visit-started').payload.initialObserved.rails.right,null);
 assert.equal(f.captures.length,1);assert.equal(f.sent.some(x=>x.type==='capture-failed'),false);
});
test('Pause then Resume opens a new period and a new visit without continuity across the pause',async()=>{
 const f=fixture();await f.start();await f.settle();const first=f.sent.find(x=>x.type==='visit-started').payload.visitId;
 await f.observer.pause();await f.observer.resume({sessionId:'native-session',observationPeriodId:'period-2'});await f.settle();
 const starts=f.sent.filter(x=>x.type==='visit-started');assert.equal(starts.length,2);assert.notEqual(starts[1].payload.visitId,first);
 assert.deepEqual(f.sent.filter(x=>x.type==='period-started').map(x=>x.payload.observationPeriodId),['period-1','period-2']);
 assert.equal(f.sent.find(x=>x.type==='period-ended').payload.reason,'pause');
});
test('a bounded queue degrades to metadata-only without blocking the event handler',async()=>{
 let release,first=true;const blocked=new Promise(resolve=>release=resolve),f=fixture({observer:{maxQueue:4,highWater:2},api:{send:async(type,payload)=>{f.sent.push({type,payload});if(first){first=false;await blocked;}return {saved:true};}}});
 await f.start();for(let i=0;i<20;i++)f.handler()({type:'click',isTrusted:true,target:{kind:'canvas'}});
 assert.equal(f.observer.metricSnapshot().degradationLevel,'METADATA_ONLY');assert.ok(f.observer.metricSnapshot().dropped>0);release();await f.settle();
});
test('a state change during a passive read is retained as an explicit capture failure',async()=>{
 let rejectCapture;const f=fixture({api:{capture:()=>new Promise((resolve,reject)=>{rejectCapture=reject;})}});await f.start();await flush();
 rejectCapture(Error('state-changed-during-passive-lidar-read'));await f.settle();
 assert.match(f.sent.find(x=>x.type==='capture-failed').payload.reason,/state-changed/);
});
