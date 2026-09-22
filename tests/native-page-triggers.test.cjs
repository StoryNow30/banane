'use strict';
/* 4.7.2 — quand l'observateur Natif relance une lecture.
 *
 * Une lecture n'est relancée que si elle peut apporter des points : rails
 * déplacés, ou nouveaux nœuds chargés tant que la pose courante n'a pas ses
 * deux côtés qualifiés. Un mouvement de caméra seul reste consigné comme
 * changement de vue, sans relire. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Observer}=require('../src/native-page.js'),{K,base}=require('./fixtures.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture({qualify=[]}={}){
  let state={identity:{pageId:'native-page',part:23,cut:100,shape:'U50',frameId:'native-frame',projectId:null},rails:K.clone(base.rails),
    capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],viewObservation:{status:'observed',viewEpochId:'view-1',loadEpochId:'load-1'}};
  let watcher=null;const sent=[],captures=[];
  const api={snapshot:()=>K.clone(state),
    capture:async(expected,active,request)=>{captures.push({cut:expected.identity.cut,load:expected.viewObservation?.loadEpochId,rails:JSON.stringify(expected.rails)});
      for(const side of qualify)await request.onCheckpoint({chunkId:K.uid(),side,qualification:{status:'qualified-candidate'}});
      const cloud=K.clone(base);cloud.identity=K.clone(expected.identity);cloud.captureId=K.uid();return cloud;},
    send:async(type,payload)=>{sent.push({type,payload});return type==='capture-checkpoint'?{saved:true,chunkId:payload.chunk.chunkId,storageConfirmedAt:new Date().toISOString()}:{saved:true};},
    now:()=>0,performanceNow:()=>0,interval:()=>1,clearInterval:()=>{},defer:fn=>queueMicrotask(fn),install:()=>{},uninstall:()=>{},
    watch:fn=>{watcher=fn;return true;},editable:()=>false,targetKind:()=>'other',signalFailure:()=>{}};
  const observer=new Observer(api,{});
  return {observer,sent,captures,watcher:()=>watcher,
    set:mutate=>{const next=K.clone(state);mutate(next);next.capturedAt=new Date().toISOString();state=next;},
    start:()=>observer.start({sessionId:'s',observationPeriodId:'p'}),settle:async()=>{for(let i=0;i<8;i++)await flush();}};
}

test('un mouvement de caméra seul est consigné mais ne relance aucune lecture',async()=>{
  const f=fixture();await f.start();await f.settle();assert.equal(f.captures.length,1);
  f.set(s=>{s.viewObservation.viewEpochId='view-2';});await f.observer.observe('poll');await f.settle();
  assert.equal(f.captures.length,1,'aucune relecture pour la seule caméra');
  const observed=f.sent.filter(x=>x.type==='state-observed');
  assert.equal(observed.length,1);assert.equal(observed[0].payload.effect.kind,'loaded-view-changed');
});

test('de nouveaux nœuds chargés relancent la lecture tant que la pose n’est pas qualifiée',async()=>{
  const f=fixture();await f.start();await f.settle();
  f.set(s=>{s.viewObservation.viewEpochId='view-2';s.viewObservation.loadEpochId='load-2';});await f.observer.observe('poll');await f.settle();
  assert.equal(f.captures.length,2);assert.equal(f.captures[1].load,'load-2');
});

test('une fois les deux côtés qualifiés pour la pose, un nouveau chargement ne relit plus',async()=>{
  const f=fixture({qualify:['left','right']});await f.start();await f.settle();assert.equal(f.captures.length,1);
  f.set(s=>{s.viewObservation.viewEpochId='view-2';s.viewObservation.loadEpochId='load-2';});await f.observer.observe('poll');await f.settle();
  assert.equal(f.captures.length,1,'pose déjà qualifiée des deux côtés');
});

test('un seul côté qualifié laisse la relance ouverte',async()=>{
  const f=fixture({qualify:['left']});await f.start();await f.settle();
  f.set(s=>{s.viewObservation.viewEpochId='view-2';s.viewObservation.loadEpochId='load-2';});await f.observer.observe('poll');await f.settle();
  assert.equal(f.captures.length,2);
});

test('un déplacement de rail relance toujours la lecture, même pose précédente qualifiée',async()=>{
  const f=fixture({qualify:['left','right']});await f.start();await f.settle();
  f.set(s=>{s.rails.left.positionSceneRelative=s.rails.left.positionSceneRelative.map((v,i)=>i===1?v+.01:v);
    s.rails.left.railLocalToSceneRelative=s.rails.left.railLocalToSceneRelative.map((v,i)=>i===13?v+.01:v);});
  await f.observer.observe('after-input');await f.settle();
  assert.equal(f.captures.length,2);assert.notEqual(f.captures[1].rails,f.captures[0].rails);
});

test('le changement d’étiquette du cut déclenche l’observation sans attendre le relevé périodique',async()=>{
  const f=fixture();await f.start();await f.settle();assert.equal(typeof f.watcher(),'function');
  f.set(s=>{s.identity.cut=101;});f.watcher()();await f.settle();
  const starts=f.sent.filter(x=>x.type==='visit-started');assert.equal(starts.length,2);assert.equal(starts[1].payload.identity.cut,101);
  assert.equal(starts[1].payload.trigger,'label-changed');
});

test('un adaptateur sans époque de chargement garde le comportement 4.7.1',async()=>{
  const f=fixture();f.set(s=>{delete s.viewObservation.loadEpochId;});await f.start();await f.settle();
  f.set(s=>{s.viewObservation.viewEpochId='view-2';});await f.observer.observe('poll');await f.settle();
  assert.equal(f.captures.length,2,'sans loadEpochId, la vue fait office d’époque de chargement');
});
