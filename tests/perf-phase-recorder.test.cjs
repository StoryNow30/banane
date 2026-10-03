'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Recorder,install,runtimeFacade}=require('../src/perf-phase.js');const {id}=require('./helpers/perf-phases.cjs');
function fixture({putEvent,maxPending=512}={}){let time=0,n=0;const events=[],engine={s:{mode:'automatic-test',sessionId:'S',current:{identity:id(100)},batch:{id:'B',scope:{part:23,start:100,end:103},state:'RUNNING'}},event:async()=>{}};
 const store={putEvent:putEvent||((e)=>{events.push(e);})},options={now:()=>time,uid:()=>String(++n),origin:1000,maxPending};
 const r=new Recorder(engine,store,options);r.syncBatch(true);r.ensureVisit(id(100));return {r,engine,events,store,options,t:v=>time=v};}
test('enveloppes V4.6 : receiver, arguments, résultat identique, exception identique et un seul appel',()=>{
 const result={},error=Error('original'),args=[{},{}],calls=[],mono={propose(...a){calls.push({receiver:this,args:a});return result;}};
 const runtime={frozen:mono,proposeBoth(...a){calls.push({receiver:this,args:a});return result;}},rows=[];
 const recorder={now:()=>1,context:()=>({}),span:(...a)=>rows.push(a),options:()=>({}),inputKind:'initial'};
 const facade=runtimeFacade(runtime,()=>recorder);assert.equal(facade.proposeBoth(...args),result);assert.equal(calls[0].receiver,runtime);assert.equal(calls[0].args[0],args[0]);assert.equal(calls[0].args[1],args[1]);
 assert.equal(facade.frozen.propose(args[0],'left'),result);assert.equal(calls[1].receiver,mono);assert.equal(calls.length,2);assert.equal(runtime.frozen,mono);assert.notEqual(facade.frozen,mono);
 runtime.proposeBoth=function(){calls.push('throw');throw error;};const f=runtimeFacade(runtime,()=>({...recorder,span(){throw Error('instrument');}}));
 assert.throws(()=>f.proposeBoth(),e=>e===error);assert.equal(calls.length,3);assert.equal(rows.length,2);
});
test('enveloppes moteur : objet Promise original et rejet conservés, aucun appel supplémentaire',async()=>{
 const f=fixture(),result={identity:id(100)},promise=Promise.resolve(result),error=Error('engine'),bad=Promise.reject(error);bad.catch(()=>{});let calls=0;
 f.engine.observe=function(...args){calls++;assert.equal(this,f.engine);assert.equal(args[0],'argument');return promise;};f.engine.pause=()=>bad;
 const r=install(f.engine,f.store,f.options);r.syncBatch(true);r.ensureVisit(id(100));assert.equal(f.engine.observe('argument'),promise);assert.equal(await f.engine.observe('argument'),result);assert.equal(calls,2);
 assert.equal(f.engine.pause(),bad);await assert.rejects(bad,e=>e===error);await r.flush();
});
test('échec de stockage isolé et perte comptée ; file bornée ; événements sans nuages',async()=>{
 const f=fixture({putEvent(){return Promise.reject(Error('disk'));}});const token=f.r.startRequest('capture',[{identity:id(100)}]);
 f.t(100);assert.doesNotThrow(()=>f.r.endRequest(token,{identity:id(100),captureId:'C',pointsSceneRelative:Array(10000).fill([1,2,3])}));
 await f.r.flush();assert.ok(f.r.batch.lost>=1);
 const release=[],g=fixture({maxPending:3,putEvent:e=>new Promise(resolve=>release.push(resolve))});
 for(let i=0;i<20;i++)g.r.point('test');assert.equal(g.r.pending.size,3);assert.ok(g.r.batch.lost>=19);for(const resolve of release)resolve();await Promise.allSettled([...g.r.pending]);
 const h=fixture();const q=h.r.startRequest('capture',[]);h.r.endRequest(q,{identity:id(100),captureId:'C',pointsSceneRelative:Array(10000).fill([1,2,3])});
 await h.r.flush();assert.ok(h.events.every(e=>!JSON.stringify(e).includes('pointsSceneRelative')));assert.ok(h.events.every(e=>Buffer.byteLength(JSON.stringify(e))<4096));
});
test('requête tardive et progrès : session/lot/visite figés, horloge page jamais soustraite',async()=>{
 const f=fixture(),v=f.r.visit,token=f.r.startRequest('capture',[]);f.engine.s.batch={id:'next-batch',scope:{part:23,start:100,end:103},state:'RUNNING'};f.r.syncBatch(true);f.r.ensureVisit(id(100));
 f.t(50);f.r.progress({traceId:token.id,action:'capture',requestId:'page-id',lastStage:'received',elapsedMs:99999999});f.r.endRequest(token,{identity:id(100),captureId:'old'});
 const e=f.events.find(e=>e.kind==='point'&&e.point==='capture-received');assert.equal(e.visitId,v.visitId);assert.equal(e.batchId,'B');assert.equal(e.atMs,50);assert.equal(f.r.visit.captureId,null);
 assert.equal(f.events.find(e=>e.kind==='request').pageRequestId,'page-id');assert.equal(f.events.find(e=>e.kind==='request').elapsedMs,undefined);await f.r.flush();
});
test('reprise/capture : pas de visite fantôme sur l’ancienne cible ; recapture distincte',()=>{
 const f=fixture(),first=f.r.visit.visitId;f.r.visit.captured=true;f.r.beforeCapture=true;
 f.r.targetSeen(id(101));f.r.ensureVisit(id(101));assert.notEqual(f.r.visit.visitId,first);assert.equal(f.r.visit.identity.cut,101);
 const second=f.r.visit.visitId;f.r.ensureVisit(id(101),{recapture:true});assert.notEqual(f.r.visit.visitId,second);
 assert.equal(f.events.filter(e=>e.kind==='visit').length,3);assert.equal(f.events.at(-1).navigationReason,'recapture');
 f.r.ensureVisit(id(200));assert.equal(f.r.visit.identity.cut,101);assert.equal(f.events.at(-1).point,'out-of-scope-target');
});
test('lecture après avec bornes propres et cible stricte ; absence de lecture non comblée',()=>{
 const f=fixture();f.t(20);f.r.finishing={visit:f.r.visit,fromMs:20};f.t(30);const q=f.r.startRequest('state',[]);f.t(80);f.r.endRequest(q,{identity:id(100)});
 const span=f.events.find(e=>e.label==='after-state-read');assert.deepEqual([span.fromMs,span.toMs],[20,80]);
 f.r.finishing={visit:f.r.visit,fromMs:90};const other=f.r.startRequest('state',[]);f.r.endRequest(other,{identity:id(101)});
 assert.equal(f.events.filter(e=>e.label==='after-state-read').length,1);
});
test('prise manuelle après changement de mode et arrêts sans double comptage',()=>{
 const f=fixture();f.engine.s.mode='observation';f.engine.s.batch.state='MANUAL_TAKEOVER';f.r.event('batch-manual-takeover',{identity:id(100)});
 assert.equal(f.events.find(e=>e.kind==='control').name,'manual-takeover');assert.equal(f.events.at(-1).point,'manual-takeover');f.engine.s.mode='automatic-test';f.r.operatorPending='pause';f.r.event('batch-state',{state:'PAUSED',identity:id(100)});
 assert.equal(f.events.filter(e=>e.name==='halt').length,0);f.r.operatorPending=null;f.r.lastHalt=null;f.r.event('batch-state',{state:'PAUSED_ADAPTER_UNRESPONSIVE',identity:id(100)});
 f.r.event('batch-state',{state:'PAUSED_ADAPTER_UNRESPONSIVE',identity:id(100)});assert.equal(f.events.filter(e=>e.name==='halt').length,1);
});
test('science Écho et analyse hors lot ne remplissent pas l’ancien lot fermé',()=>{
 const f=fixture();f.engine.s.mode='observation';const before=f.events.length,result={},runtime={proposeBoth:()=>result};
 assert.equal(runtimeFacade(runtime,()=>f.r).proposeBoth({identity:id(100)}),result);f.r.event('proposed',{identity:id(100)});
 assert.equal(f.events.length,before);f.engine.s.mode='automatic-test';f.r.batch.closed=true;assert.equal(f.r.runtimeContext(),null);
});
test('observe/command enveloppés : même Promise et exception, stockage non isolé déclaré',async()=>{
 const f=fixture(),value={},promise=Promise.resolve(value),error=Error('IO');let n=0;
 assert.equal(f.r.trackTask('observe-lot',()=>{n++;return promise;}),promise);assert.equal(await promise,value);await Promise.resolve();assert.equal(n,1);
 assert.throws(()=>f.r.trackTask('command-lot',()=>{n++;throw error;}),e=>e===error);assert.equal(n,2);assert.equal(f.r.task,undefined);
 assert.equal(f.events.filter(e=>e.label==='command-lot')[0].success,false);
});
test('arrêt répété : intervention conservée, une seule fermeture et un seul arrêt comptable',async()=>{
 const f=fixture();f.engine.stop=async()=>{f.engine.s.batch.state='STOPPED';};
 const r=install(f.engine,f.store,f.options);r.syncBatch(true);r.ensureVisit(id(100));
 await f.engine.stop();await f.engine.stop();await r.flush();
 const stops=f.events.filter(e=>e.name==='stop');assert.equal(stops.length,2);assert.equal(stops.filter(e=>!e.repeated).length,1);
 assert.equal(f.events.filter(e=>e.kind==='batch'&&e.point==='end').length,1);
});
test('reprise après STOPPED : nouvelles visites observées ; arrêt en cours fermé à sa fin réelle',async()=>{
 const f=fixture();f.engine.stop=async()=>{f.engine.s.batch.state='STOPPED';};f.engine.resume=async()=>{f.engine.s.batch.state='RUNNING';};
 const r=install(f.engine,f.store,f.options);r.syncBatch(true);r.ensureVisit(id(100));const before=f.events.filter(e=>e.kind==='visit').length;f.engine.task=Promise.resolve();
 await f.engine.stop();assert.equal(r.batch.closed,false);r.event('batch-state',{state:'STOPPED'});assert.equal(r.batch.closed,true);
 f.engine.task=null;await f.engine.resume();assert.equal(r.batch.closed,false);r.ensureVisit(id(101));assert.equal(r.visit.identity.cut,101);
 assert.equal(f.events.filter(e=>e.point==='reopened').length,1);assert.equal(f.events.filter(e=>e.kind==='visit').length,before+1);
});
test('violation explicite de garde : arrêt garde, même si le message ne dit pas garde',()=>{
 const f=fixture();f.r.event('gauge-contract-violation',{identity:id(100),commandSent:false});
 f.engine.s.batch.error={message:'Écartement de paire hors contrat : aucune commande envoyée.'};
 f.r.event('batch-state',{state:'ERROR',identity:id(100)});
 assert.equal(f.events.find(e=>e.name==='halt').cause,'guard');
});
