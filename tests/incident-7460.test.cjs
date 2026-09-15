const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Engine}=require('../src/engine.js'),{MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');
const journal=JSON.parse(fs.readFileSync(path.join(__dirname,'incidents/journal-part-24-cut-7460-v3.0.0.json')));
const scope={part:24,start:8244,end:8244,testConfirmed:true,lowConfidence:'attempt',allowNavigationEvidence:true};
async function incident(){const adapter=new SimulatedESV(),store=new MemoryStore();store.state=K.clone(journal.state);store.events=K.clone(journal.events);store.records=K.clone(journal.records);
 adapter.identity=K.clone(journal.state.current.identity);const engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}
test('actual 7460 journal resumes a new cut while archiving the former validation and keeping all old records',async()=>{
 const {adapter,store,engine:e}=await incident();assert.match(e.s.batch.error.message,/Navigation observée, confirmation serveur absente/);await e.startBatch(scope);await e.task;
 assert.equal(e.s.batch.state,'FINISHED_WITH_UNCONFIRMED_ACTIONS');assert.equal(e.s.batch.processed[0].cut,8244);assert.equal(adapter.calls.filter(x=>x==='validate').length,1);
 assert.ok(store.events.some(e=>e.type==='uncertain-result-closed'&&e.identity.cut===7460&&e.batch.scope.allowNavigationEvidence===false));
 for(const old of journal.records)assert.ok(store.records.some(r=>(r.recordId||r.id)===(old.recordId||old.id)));
 assert.equal(e.s.version,require('../src/core.js').VERSION);
});
test('server-proof policy is rejected before any capture, application or validation',async()=>{
 const adapter=new SimulatedESV(),store=new MemoryStore(),e=new Engine(adapter,store);await e.init();e.s.mode='automatic-test';
 await assert.rejects(()=>e.startBatch({...scope,part:23,start:100,end:100,allowNavigationEvidence:false}),/Avant de lancer : coche/);
 assert.deepEqual(adapter.calls,[]);assert.equal(e.s.before,null);assert.equal(e.s.batch,null);assert.equal(e.s.intent,undefined);assert.equal(e.busy,false);
});
test('the uncertain 7460 validation cannot be retried even after the ESV page changes',async()=>{
 const {adapter,engine:e}=await incident();adapter.identity.cut=7460;
 await assert.rejects(()=>e.startBatch({...scope,start:7460,end:7460}),/7460 reste à contrôler/);assert.deepEqual(adapter.calls,[]);
});
test('closing a former validation does not erase a separate manual capture on the current cut',async()=>{
 const {engine:e}=await incident();const before=K.clone(e.s.before),proposal=K.clone(e.s.proposal);e.s.collection='READY_FOR_AFTER';
 await e.closeUncertain();assert.deepEqual(e.s.before,before);assert.deepEqual(e.s.proposal,proposal);assert.equal(e.s.collection,'READY_FOR_AFTER');
 await e.closeUncertain();assert.match(e.s.notice,/Vérifie les bornes/);assert.deepEqual(e.s.before,before);
});
test('navigation evidence is saved even if a server-capable adapter unexpectedly returns no server receipt',async()=>{
 const adapter=new SimulatedESV(),store=new MemoryStore(),e=new Engine(adapter,store);adapter.capabilities={serverConfirmation:true};await e.init();e.s.mode='automatic-test';
 await e.startBatch({...scope,part:23,start:100,end:100,allowNavigationEvidence:false});await e.task;
 assert.equal(e.s.batch.state,'ERROR');assert.equal(e.s.intent,null);assert.equal(e.s.reconcileRequired,false);
 assert.ok(store.events.some(x=>x.type==='validation-observation'&&x.evidence.navigationObserved&&!x.evidence.serverConfirmed));
});
test('an operator stop during next-cut loading stays stopped after navigation evidence arrives',async()=>{
 const adapter=new SimulatedESV(),store=new MemoryStore(),e=new Engine(adapter,store);await e.init();e.s.mode='automatic-test';
 adapter.validateAndNext=async()=>{const after=await adapter.state();await adapter.next();await e.stop();return {commandSent:true,afterObserved:true,
   afterStateStatus:'OBSERVED_SAME_TARGET',afterState:after,navigationObserved:true,serverConfirmed:false,nextReady:false,nextIdentity:adapter.identity};};
 await e.startBatch({...scope,part:23,start:100,end:102});await e.task;
 assert.equal(e.s.batch.state,'STOPPED');assert.equal(e.s.batch.processed.length,1);
});
