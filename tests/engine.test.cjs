const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js');const {MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
async function app(){const adapter=new SimulatedESV(),store=new MemoryStore(),engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}
const scope=(extra={})=>({part:23,start:100,end:102,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true,...extra});
test('capture workflow persists before, both corrections, after and export across UI reopen',async()=>{
 const {adapter,store,engine:e}=await app();await e.locked(()=>e.begin());
 assert.equal(e.s.collection,'READY_FOR_AFTER');const reloaded=new Engine(adapter,store);await reloaded.init();
 adapter.rails=K.expectedPoses(reloaded.s.before,{left:{delta:[0,.01,0]},right:{delta:[0,0,.02]}});
 await reloaded.locked(()=>reloaded.finish());assert.equal(reloaded.s.records.length,1);assert.equal(reloaded.s.collection,'AFTER_CAPTURED');
 assert.equal((await reloaded.exportReferences()).records.length,1);assert.equal(reloaded.s.collection,'EXPORTED');
 adapter.identity.cut++;await reloaded.locked(()=>reloaded.begin());assert.equal(reloaded.s.collection,'READY_FOR_AFTER');
});
test('changed target retains a stale before until next begin archives it; no cross-cut pair',async()=>{
 const {adapter,engine:e}=await app();await e.begin();adapter.identity.cut++;await e.observe();
 assert.equal(e.s.collection,'STALE');assert.ok(e.s.before);await assert.rejects(()=>e.finish(),/avant exploitable/);
 await e.begin();assert.equal(e.s.incomplete.length,1);assert.equal(e.s.records.length,0);assert.equal(e.s.before.identity.cut,101);
});
test('observation is read-only; assisted requires explicit apply and rejects a second application',async()=>{
 const {adapter,engine:e}=await app();await e.analyze();assert.deepEqual(adapter.calls,['capture']);
 await assert.rejects(()=>e.apply(),/observation/);e.s.mode='assisted';await e.apply();
 assert.equal(adapter.calls.filter(c=>c==='apply').length,1);await assert.rejects(()=>e.apply(),/déjà appliquée/);
 await e.restore();assert.equal(e.s.applied,null);assert.equal(e.s.reconcileRequired,false);
});
test('double button calls cannot overlap a capture',async()=>{
 const {adapter,engine:e}=await app();const original=adapter.capture.bind(adapter);let release;
 adapter.capture=async b=>{await new Promise(r=>release=r);return original(b);};const first=e.locked(()=>e.begin());
 await new Promise(r=>setImmediate(r));await assert.rejects(()=>e.locked(()=>e.begin()),/déjà en cours/);release();await first;
 assert.equal(adapter.calls.filter(c=>c==='capture').length,1);
});
test('automatic TEST processes three cuts without individual approval and archives before validation',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';
 adapter.validateAndNext=async function(){assert.ok(store.events.some(e=>e.type==='after-captured'));assert.equal(store.state.intent.kind,'validate');
   this.calls.push('validate');const after=await this.state();await this.next();return {commandSent:true,afterObserved:true,afterStateStatus:'OBSERVED_SAME_TARGET',afterState:after,
     navigationObserved:true,serverConfirmed:false,nextIdentity:this.identity,navigationAfter:{identity:this.identity}};};
 await e.startBatch(scope());await e.task;
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(e.s.batch.processed.length,3);assert.equal(e.s.records.length,3);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,3);
 assert.ok(e.s.batch.processed.every(p=>p.evidence.serverConfirmed===false));
});
test('low confidence policies pause, skip without validation, or attempt a candidate',async()=>{
 for(const policy of ['pause','skip','attempt']){
  const {adapter,engine:e}=await app();e.s.mode='automatic-test';e.s.settings.minConfidence=100;
  await e.startBatch(scope({end:100,lowConfidence:policy}));await e.task;
  if(policy==='pause'){assert.equal(e.s.batch.state,'PAUSED');assert.equal(adapter.calls.includes('apply'),false);}
  if(policy==='skip'){assert.equal(e.s.batch.state,'PAUSED');assert.equal(e.s.batch.skipped.length,0);assert.equal(adapter.calls.includes('validate'),false);}
  if(policy==='attempt'){assert.equal(e.s.batch.processed.length,1);assert.ok(adapter.calls.includes('apply'));}
 }
});
test('missing cloud cannot be called a measured extrapolation even when attempt is chosen',async()=>{
 const {adapter,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';await e.startBatch(scope({end:100}));await e.task;
 assert.equal(e.s.batch.state,'PAUSED_UNRESOLVED_RAIL');assert.equal(adapter.calls.includes('apply'),false);
});
test('pause then resume does not reapply or recapture the current cut',async()=>{
 const {adapter,engine:e}=await app();e.s.mode='automatic-test';const original=adapter.apply.bind(adapter);let first=true;
 adapter.apply=async(...args)=>{const out=await original(...args);if(first){first=false;await e.pause();}return out;};
 await e.startBatch(scope({end:100}));await e.task;assert.equal(e.s.batch.state,'PAUSED');assert.equal(e.s.batch.step,'validate');
 await e.resume();await e.task;assert.equal(adapter.calls.filter(c=>c==='apply').length,1);assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
});
test('stop during analyze prevents new writes; resume on another target is refused',async()=>{
 const {adapter,engine:e}=await app();e.s.mode='automatic-test';const original=e.analyze.bind(e);
 e.analyze=async()=>{const p=await original();await e.stop();return p;};await e.startBatch(scope());await e.task;
 assert.equal(adapter.calls.includes('apply'),false);assert.equal(e.s.batch.state,'STOPPED');adapter.identity.cut++;
 await assert.rejects(()=>e.resume(),/Cible différente/);
});
test('uncertain validation blocks repeats and restoration after a validation attempt',async()=>{
 const {adapter,engine:e}=await app();adapter.noNavigation=true;e.s.mode='automatic-test';await e.startBatch(scope());await e.task;
 assert.equal(e.s.batch.state,'ERROR');assert.equal(e.s.reconcileRequired,true);
 await assert.rejects(()=>e.restore(),/Validation déjà tentée/);await assert.rejects(()=>e.resume(),/Réconciliation/);
 assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
});
test('an application mismatch is not success; restore resolves partial uncertain state',async()=>{
 const {adapter,engine:e}=await app();e.s.mode='assisted';await e.analyze();adapter.offset=true;
 await assert.rejects(()=>e.apply(),/non conforme/);assert.equal(e.s.reconcileRequired,true);await e.restore();assert.equal(e.s.reconcileRequired,false);
});
test('background restart with an apply intent pauses and reconciles without a duplicate write',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='assisted';await e.analyze();await e.apply();
 e.s.intent={kind:'apply',proposalId:e.s.proposal.id};e.s.batch={state:'RUNNING',scope:{pageId:adapter.identity.pageId,part:23}};await e.save();
 const newEngine=new Engine(adapter,store);await newEngine.init();assert.equal(newEngine.s.batch.state,'PAUSED');assert.equal(newEngine.s.reconcileRequired,true);
 await newEngine.reconcile();assert.equal(newEngine.s.reconcileRequired,false);assert.equal(adapter.calls.filter(c=>c==='apply').length,1);
});
test('scope and repeated target protections prevent out-of-scope application',async()=>{
 const {adapter,engine:e}=await app();e.s.mode='automatic-test';await assert.rejects(()=>e.startBatch(scope({part:24})),/premier cut/);
 adapter.validateAndNext=async()=>{adapter.calls.push('validate');return {commandSent:true,afterObserved:true,afterStateStatus:'OBSERVED_SAME_TARGET',navigationObserved:true,serverConfirmed:false};};
 await e.startBatch(scope());await e.task;assert.equal(e.s.batch.state,'ERROR');assert.match(e.s.notice,/déjà traité/);assert.equal(adapter.calls.filter(c=>c==='apply').length,1);
});
test('target navigation before after-state read pauses without silently processing the next cut',async()=>{
 const {adapter,store,engine:e}=await app();e.s.mode='automatic-test';adapter.validateAndNext=async()=>{
   adapter.calls.push('validate');await adapter.next();return {commandSent:true,afterObserved:false,afterStateStatus:'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',
     serverConfirmed:false,navigationObserved:true,nextIdentity:K.clone(adapter.identity),navigationAfter:{identity:K.clone(adapter.identity)}};};
 await e.startBatch(scope());await e.task;
 assert.equal(e.s.batch.state,'PAUSED_AFTER_STATE_MISSING');assert.equal(e.s.batch.processed.length,0);
 assert.equal(adapter.calls.filter(c=>c==='capture').length,1);assert.equal(store.records[0].status,'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');
 assert.deepEqual({commandSent:store.records[0].commandSent,afterObserved:store.records[0].afterObserved,serverConfirmed:store.records[0].serverConfirmed,navigationObserved:store.records[0].navigationObserved},
   {commandSent:true,afterObserved:false,serverConfirmed:false,navigationObserved:true});
});
test('an unresolved cut offers bounded actions and retry restarts the same cut without a native decision',async()=>{
 const {adapter,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';await e.startBatch(scope({end:100}));await e.task;
 assert.equal(e.s.batch.state,'PAUSED_UNRESOLVED_RAIL');assert.deepEqual(e.s.batch.paused[0].actions,['RETRY','MANUAL_TAKEOVER','EXPLICIT_SKIP','STOP']);
 assert.equal(e.s.batch.paused[0].identity.cut,100);assert.ok(e.s.batch.paused[0].before&&e.s.batch.paused[0].lidarCaptureId&&e.s.batch.paused[0].proposal);
 adapter.noPoints=false;await e.retryPaused();await e.task;
 assert.equal(adapter.calls.filter(c=>c==='capture').length,2);assert.equal(adapter.calls.includes('skip'),false);
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');
});
test('manual takeover preserves the unresolved attempt without validation, SKIP or navigation',async()=>{
 const {adapter,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';await e.startBatch(scope({end:100}));await e.task;
 await e.manualTakeover();assert.equal(e.s.batch.state,'MANUAL_TAKEOVER');assert.equal(e.s.mode,'observation');
 assert.equal(adapter.calls.includes('validate'),false);assert.equal(adapter.calls.includes('skip'),false);assert.equal(adapter.calls.includes('next'),false);
 assert.equal(e.s.batch.interrupted.at(-1).status,'MANUAL_TAKEOVER');
});
test('explicit SKIP from an unresolved pause is operator-driven, excluded from training and fully traced',async()=>{
 const {adapter,store,engine:e}=await app();adapter.noPoints=true;e.s.mode='automatic-test';await e.startBatch(scope({end:100}));await e.task;
 await e.skipPaused();assert.equal(adapter.calls.filter(c=>c==='skip').length,1);assert.equal(e.s.batch.skipped.length,1);
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');const r=store.records.find(x=>x.operatorDecision==='SKIP');
 assert.ok(r);assert.equal(r.usableForTraining,false);assert.equal(r.trainingExclusionReason,'operator-skip');
 assert.deepEqual({commandSent:r.commandSent,afterObserved:r.afterObserved,serverConfirmed:r.serverConfirmed,navigationObserved:r.navigationObserved},
   {commandSent:true,afterObserved:true,serverConfirmed:false,navigationObserved:true});
 assert.ok(r.identity.pageId&&r.identity.frameId);assert.equal(r.identity.projectId,null);assert.equal(r.geominfo.status,'not-observed');
});
