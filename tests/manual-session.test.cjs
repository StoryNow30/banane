const {test}=require('node:test'),assert=require('node:assert/strict');
const {Collector}=require('../src/manual-page.js'),{Sessions}=require('../src/manual-session.js'),{Engine}=require('../src/engine.js');
const {K,base,MemoryStore,SimulatedESV}=require('./fixtures.cjs');
const flush=()=>new Promise(r=>setImmediate(r));
async function fixture(){
 const adapter=new SimulatedESV(),store=new MemoryStore(),e=new Engine(adapter,store);await e.init();
 store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];
 let installed=false,timer=null,clock=0,sessions,validated=0,skipped=0;const commands=[];
 const state=()=>({identity:K.clone(adapter.identity),rails:K.clone(adapter.rails),capturedAt:new Date().toISOString()});
 const api={state,label:()=>K.clone(adapter.identity),settle:async()=>state(),
   capture:async b=>{const c=await adapter.capture(b);c.coordinateBridge={sceneFrameId:c.identity.frameId,captureSceneRelativeToSessionSceneRelative:K.C.identity()};return c;},
   left:async()=>{},nativeDecision:decision=>{assert.ok(store.records.some(r=>r.identity?.cut===adapter.identity.cut));
   assert.ok(store.events.some(x=>x.type==='manual-decision-intent'&&x.identity.cut===adapter.identity.cut&&x.operatorDecision===decision));
    commands.push({decision,cut:adapter.identity.cut});if(decision==='VALIDATE')validated++;else skipped++;
     adapter.identity.cut+=5;adapter.rails=K.clone(base.rails);return {commandSent:true,command:decision};},
   cancel:async()=>adapter.cancel(),send:(type,payload)=>sessions.receive(type,payload),now:()=>clock,
   interval:fn=>{timer=fn;return 1;},clearInterval:()=>{timer=null;},install:()=>{installed=true;},uninstall:()=>{installed=false;},
   editable:target=>target?.kind==='input',isCanvas:t=>t?.kind==='canvas',isValidation:t=>t?.kind==='validation',paint:()=>{}};
 const collector=new Collector(api);adapter.manualStart=o=>collector.start(o);adapter.manualPause=()=>collector.pause();adapter.manualResume=()=>collector.resume();adapter.manualFinish=()=>collector.finish();
 sessions=new Sessions(e,adapter,store);
 function input(extra={}){let blocked=false;const event={type:'keydown',isTrusted:true,code:'Space',key:' ',shiftKey:true,target:{kind:'canvas'},
   preventDefault(){blocked=true;},stopImmediatePropagation(){},...extra};collector.input(event);return blocked;}
 const done=async()=>{await collector.task;await sessions.queue;await flush();};
 const correct=()=>{adapter.rails=K.expectedPoses(state(),{left:{delta:[0,.007,.003]},right:{delta:[0,-.009,.002]}});};
 return {adapter,store,e,collector,api,sessions,input,done,correct,validated:()=>validated,skipped:()=>skipped,commands,
   installed:()=>installed,timer:()=>timer,advance:ms=>{clock+=ms;}};
}

test('one session start and one end collect three sparse cuts, including the last without extra validation',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();assert.equal(f.collector.phase,'READY');
 for(let i=0;i<2;i++){f.correct();assert.equal(f.input(),true);await f.done();await f.collector.tick();await f.done();}
 f.correct();const data=await f.sessions.end();
 assert.equal(data.records.length,3);assert.deepEqual(data.records.map(r=>r.cut),[100,105,110]);
 assert.equal(f.validated(),2);assert.equal(f.installed(),false);assert.equal(f.timer(),null);assert.equal(data.cloudIds.length,3);
 assert.ok(data.records.every(r=>r.source==='explicit-manual-session'&&r.usableForTraining));
 for(const r of data.records){assert.ok(r.rails.left.positionChanged);assert.ok(r.rails.right.positionChanged);}
 const linked=K.pairCorpus([{name:'session.json',text:JSON.stringify({...data,clouds:[...f.store.clouds.values()]})}]);
 assert.equal(linked.paired.length,3);assert.deepEqual(linked.errors,[]);
});
test('the manual after is durable before validation; repeated keys and keyup do not duplicate it',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();
 const put=f.store.putRecord.bind(f.store);let release,held=true;f.store.putRecord=async r=>{if(held){held=false;await new Promise(resolve=>release=resolve);}return put(r);};
 f.input();f.input();f.input({repeat:true});f.input({type:'keyup'});await flush();assert.equal(f.validated(),0);
 release();await f.done();assert.equal(f.validated(),1);assert.equal(f.store.records.length,1);
});
test('validation, SKIP, validation preserve three captures and three distinct operator decisions',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();
 const actions=[{}, {code:'Backspace',key:'Backspace',shiftKey:true}, {}];
 for(let i=0;i<actions.length;i++){
   f.correct();assert.equal(f.input(actions[i]),true);await f.done();if(i<actions.length-1){await f.collector.tick();await f.done();}
 }
 const data=await f.sessions.end();
 assert.deepEqual(data.records.map(r=>r.operatorDecision),['VALIDATE','SKIP','VALIDATE']);
 assert.deepEqual(data.records.map(r=>r.decision),['VALIDATE_CORRECTED_BOTH','SKIP','VALIDATE_CORRECTED_BOTH']);
 assert.deepEqual(data.records.map(r=>r.usableForTraining),[true,false,true]);
 assert.equal(data.records[1].trainingExclusionReason,'operator-skip');assert.equal(data.records[1].status,'operator-skipped');
 assert.equal(data.cloudIds.length,3);assert.equal(f.store.clouds.size,3);
 assert.deepEqual(f.commands.map(c=>c.decision),['VALIDATE','SKIP','VALIDATE']);
 assert.equal(f.validated(),2);assert.equal(f.skipped(),1);
 for(const r of data.records){assert.ok(r.rails.left.initial&&r.rails.left.corrected);assert.ok(r.rails.right.initial&&r.rails.right.corrected);}
 assert.deepEqual(data.records.map(r=>r.sequenceIndex),[0,1,2]);
 assert.equal(data.records[0].nextCutId,K.cutId(data.records[1].identity));assert.equal(data.records[1].previousCutId,K.cutId(data.records[0].identity));
 assert.ok(data.records.every(r=>r.geominfo.status==='not-observed'));
});
test('a repeated Shift Backspace sends only one SKIP command',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();
 const skip={code:'Backspace',key:'Backspace'};f.input(skip);f.input(skip);f.input({...skip,repeat:true});f.input({...skip,type:'keyup'});
 await f.done();assert.equal(f.skipped(),1);assert.equal(f.commands.length,1);assert.equal(f.store.records.length,1);
});
test('a failing after write sends no validation and leaves the existing before recoverable',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();
 f.store.putRecord=async()=>{throw Error('Disque indisponible');};f.input();await f.done();
 assert.equal(f.validated(),0);assert.equal(f.collector.phase,'ERROR');assert.equal(f.e.s.manual.status,'PAUSED');assert.equal(f.e.s.manual.records.length,0);
 assert.equal(f.store.clouds.size,1);assert.ok(f.e.s.manual.current.before);
});
test('changing cuts without captured validation never pairs the former before with the new after',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();const old=f.collector.visit;
 f.correct();f.adapter.identity.cut=121;f.adapter.rails=K.clone(base.rails);await f.collector.tick();await f.done();
 assert.equal(f.e.s.manual.incomplete.length,1);assert.equal(f.e.s.manual.records.length,0);
 await assert.rejects(()=>f.sessions.receive('after-cut',{sessionId:f.e.s.manual.id,visitId:old.visitId,after:f.api.state()}),/visite de cut a changé/);
});
test('a failed LiDAR read does not require per-cut buttons and is excluded from training',async()=>{
 const f=await fixture();f.api.capture=async()=>{throw Error('Lecture LiDAR instable : rail droit après 3 tentatives.');};
 await f.sessions.start();await f.done();assert.equal(f.collector.phase,'READY_WITHOUT_LIDAR');f.correct();f.input();await f.done();
 const data=await f.sessions.end();assert.equal(f.validated(),1);assert.equal(data.records.length,1);assert.equal(data.cloudIds.length,0);
 assert.equal(data.records[0].usableForTraining,false);assert.equal(data.records[0].status,'incomplete-no-lidar');assert.equal(data.session.incomplete.length,1);
});
test('ending on an unused prepared cut creates no false manual reference or incomplete after',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();const data=await f.sessions.end();
 assert.equal(data.records.length,0);assert.equal(data.session.incomplete.length,0);assert.equal(f.validated(),0);
});
test('ending during preparation cancels the read, detaches input and does not create a false reference',async()=>{
 const f=await fixture();let reject;f.api.capture=()=>new Promise((resolve,r)=>reject=r);f.api.cancel=async()=>reject(Error('Export interrompu.'));
 await f.sessions.start();await flush();const data=await f.sessions.end();
 assert.equal(f.installed(),false);assert.equal(f.timer(),null);assert.equal(f.collector.active,false);assert.equal(data.records.length,0);assert.equal(data.session.incomplete.length,0);
});
test('a validation not followed by navigation is never replayed automatically',async()=>{
 const f=await fixture();let clicks=0;f.api.nativeDecision=()=>clicks++;
 await f.sessions.start();await f.done();f.correct();f.input();await f.done();f.advance(16000);await f.collector.tick();await f.done();
 assert.equal(clicks,1);assert.equal(f.collector.phase,'ERROR');f.advance(16000);await f.collector.tick();assert.equal(clicks,1);
});
test('after an uncertain SKIP, recovery never repeats the native command',async()=>{
 const f=await fixture();let commands=0;f.api.nativeDecision=()=>{commands++;};
 await f.sessions.start();await f.done();f.correct();f.input({code:'Backspace',key:'Backspace'});await f.done();
 f.advance(16000);await f.collector.tick();await f.done();assert.equal(f.collector.phase,'ERROR');assert.equal(commands,1);
 assert.equal(f.input({code:'Backspace',key:'Backspace'}),false);assert.equal(commands,1);
 await f.sessions.start();await f.done();assert.equal(commands,1);assert.equal(f.e.s.manual.records.length,1);
});
test('a rail move after the saved after prevents forwarding validation on a different state',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();
 const send=f.api.send;f.api.send=async(type,p)=>{const result=await send(type,p);if(type==='after-cut')f.correct();return result;};
 f.input();await f.done();assert.equal(f.validated(),0);assert.equal(f.collector.phase,'ERROR');assert.equal(f.e.s.manual.records.length,1);
});
test('ending after an acknowledgement failure still releases all operator input',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();f.api.send=async()=>{throw Error('Accusé absent');};
 await assert.rejects(()=>f.collector.finish(),/Accusé absent/);assert.equal(f.collector.active,false);assert.equal(f.installed(),false);
});
test('a restarted worker pauses the manual session and refuses a stale decision intent',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();const old=f.e.s.manual;
 const nextEngine=new Engine(f.adapter,f.store);await nextEngine.init();const sessions=new Sessions(nextEngine,f.adapter,f.store);await sessions.init();
 assert.equal(nextEngine.s.manual.status,'PAUSED');await assert.rejects(()=>sessions.receive('decision-intent',{sessionId:old.id,visitId:old.current.visitId,identity:old.identity,operatorDecision:'SKIP'}),/n’est plus active/);
 assert.equal(f.validated(),0);
});
test('normal typing, synthetic clicks and pointing in READY do not trigger collection commands',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();
 assert.equal(f.input({target:{kind:'input'}}),false);assert.equal(f.input({type:'click',isTrusted:false,target:{kind:'validation'}}),false);
 assert.equal(f.input({type:'click',target:{kind:'canvas'}}),false);assert.equal(f.validated(),0);
});
test('an empty acknowledgement cannot authorize a validation',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();const send=f.api.send;
 f.api.send=async(type,p)=>type==='after-cut'?undefined:send(type,p);f.input();await f.done();
 assert.equal(f.validated(),0);assert.equal(f.collector.phase,'ERROR');assert.equal(f.e.s.manual.records.length,0);
});
test('two concurrent starts create only one session and one LiDAR capture',async()=>{
 const f=await fixture();const outcomes=await Promise.allSettled([f.sessions.start(),f.sessions.start()]);await f.done();
 assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);assert.equal(f.store.clouds.size,1);
});
test('operator-selected parts can change inside one session without crossing before/after identities',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();f.input();await f.done();
 f.adapter.identity.part=24;f.adapter.identity.cut=1;await f.collector.tick();await f.done();f.correct();const data=await f.sessions.end();
 assert.deepEqual(data.records.map(r=>[r.part,r.cut]),[[23,100],[24,1]]);assert.ok(data.records.every(r=>r.usableForTraining));
});
test('resuming a paused recording preserves the same session and its earlier manual records',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.correct();f.input();await f.done();await f.collector.tick();await f.done();const id=f.e.s.manual.id;
 await f.collector.fail(Error('Interruption simulée'));await f.sessions.start();await f.done();f.correct();const data=await f.sessions.end();
 assert.equal(data.session.id,id);assert.equal(data.records.length,2);assert.equal(data.cloudIds.length,2);
});
test('Enter and the native validation button also save the after before forwarding a single click',async()=>{
 for(const event of [{key:'Enter',code:'Enter',shiftKey:false},{type:'click',target:{kind:'validation'}}]){
   const f=await fixture();await f.sessions.start();await f.done();f.correct();f.input(event);await f.done();
   assert.equal(f.validated(),1);assert.equal(f.e.s.manual.records.length,1);
 }
});
test('ending after page reload exports the saved data without sending a finish or validation to the new document',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.adapter.identity.pageId='reloaded-page';let finishes=0;
 f.adapter.manualFinish=async()=>{finishes++;};const data=await f.sessions.end();
 assert.equal(finishes,0);assert.equal(f.validated(),0);assert.equal(data.session.status,'PAUSED_ADAPTER_UNRESPONSIVE');assert.equal(data.session.incomplete.length,1);
 assert.equal(data.records[0].usableForTraining,false);assert.equal(data.cloudIds.length,1);
});
test('Pause in Mes corrections sends no decision and resumes on the exact same cut',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();const cut=f.adapter.identity.cut;
 await f.sessions.pause();assert.equal(f.e.s.manual.status,'PAUSED');assert.equal(f.collector.phase,'PAUSED');
 assert.equal(f.validated(),0);assert.equal(f.skipped(),0);assert.equal(f.input(),false);
 await f.sessions.start();assert.equal(f.e.s.manual.status,'RUNNING');assert.equal(f.adapter.identity.cut,cut);assert.equal(f.collector.phase,'READY');
 f.correct();f.input();await f.done();const data=await f.sessions.end();assert.equal(data.records.length,1);
 assert.ok(data.events.some(e=>e.type==='manual-paused'));assert.ok(data.events.some(e=>e.type==='manual-resumed'));
});
test('a human validation without rail movement is exported as a positive VALIDATE_NO_MOVEMENT label',async()=>{
 const f=await fixture();await f.sessions.start();await f.done();f.input();await f.done();await f.collector.tick();await f.done();const data=await f.sessions.end();
 assert.equal(data.records.length,1);const r=data.records[0];assert.equal(r.operatorDecision,'VALIDATE');assert.equal(r.decision,'VALIDATE_NO_MOVEMENT');
 assert.equal(r.rails.left.positionChanged,false);assert.equal(r.rails.right.positionChanged,false);assert.equal(r.usableForTraining,true);
 assert.ok(r.rails.left.initial&&r.rails.left.corrected&&r.rails.right.initial&&r.rails.right.corrected);
});
test('the four positive human validation labels are mutually exclusive',()=>{
 const rails=(left,right)=>({left:{positionChanged:left},right:{positionChanged:right}});
 assert.equal(K.manualDecision(rails(true,true),'VALIDATE'),'VALIDATE_CORRECTED_BOTH');
 assert.equal(K.manualDecision(rails(true,false),'VALIDATE'),'VALIDATE_CORRECTED_LEFT_ONLY');
 assert.equal(K.manualDecision(rails(false,true),'VALIDATE'),'VALIDATE_CORRECTED_RIGHT_ONLY');
 assert.equal(K.manualDecision(rails(false,false),'VALIDATE'),'VALIDATE_NO_MOVEMENT');
});
