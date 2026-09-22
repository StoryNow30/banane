'use strict';
/* 4.7.2 — le service worker Natif ne relit plus toute la base à chaque visite.
 *
 * Avant : chaque début de visite et chaque événement tardif d'une visite close
 * chargeaient TOUS les enregistrements, sessions passées comprises. Désormais :
 * lecture par clé, et un index des autres sessions construit une seule fois.
 * Les relations de visite restent les mêmes. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Sessions}=require('../src/native-session.js'),{Engine}=require('../src/engine.js'),{K,base,MemoryStore}=require('./fixtures.cjs');

async function fixture(previousRecords=[]){
  const store=new MemoryStore();let fullScans=0,keyReads=0;
  store.records.push(...previousRecords.map(r=>K.clone(r)));
  store.all=async name=>{if(name==='records')fullScans++;return name==='clouds'?[...store.clouds.values()]:store[name];};
  store.getRecord=async id=>{keyReads++;const r=store.records.find(x=>(x.recordId||x.id)===id);return r?K.clone(r):undefined;};
  store.keys=async()=>[...store.clouds.keys()];
  const adapter={state:async()=>state(),nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})};
  const engine=new Engine(adapter,store);await engine.init();const sessions=new Sessions(engine,adapter,store);await sessions.init();
  function state(cut=100){return {identity:{pageId:'native-page',part:23,cut,shape:'U50',frameId:'native-frame',projectId:null},rails:K.clone(base.rails),
    capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],viewObservation:{status:'observed',viewEpochId:'view-1',observedAt:new Date().toISOString()},
    geominfo:{status:'not-observed',raw:null,source:null}};}
  async function open(visitId,cut){const n=engine.s.native,p=n.observationPeriods.at(-1),s=state(cut);
    await sessions.receive('visit-started',{sessionId:n.id,observationPeriodId:p.observationPeriodId,visitId,identity:s.identity,initialObserved:s});return {n,p,s,visitId};}
  async function close(info,next){await sessions.receive('visit-ended',{sessionId:info.n.id,observationPeriodId:info.p.observationPeriodId,visitId:info.visitId,
    identity:info.s.identity,finalObserved:info.s,reason:'target-changed',nextIdentity:{...info.s.identity,cut:next},endedAt:new Date().toISOString()});}
  return {store,engine,sessions,open,close,counts:()=>({fullScans,keyReads})};
}
const relation=(f,visitId)=>f.store.records.find(r=>r.visitId===visitId).visitRelation;

test('une série de visites ne relit la base entière qu’une fois',async()=>{
  const f=await fixture();await f.sessions.start();
  const before=f.counts().fullScans;
  for(let i=0;i<12;i++){const v=await f.open('visit-'+i,100+i);await f.close(v,101+i);}
  assert.equal(f.counts().fullScans-before,1,'un seul balayage : l’index des autres sessions');
  assert.equal(f.store.records.find(r=>r.visitId==='visit-3').nextVisitId,'visit-4','le chaînage suivant reste écrit');
});

test('un événement tardif d’une visite close est rattaché par clé, sans balayage',async()=>{
  const f=await fixture();await f.sessions.start();
  const first=await f.open('visit-1',100);await f.close(first,101);const second=await f.open('visit-2',101);
  const before=f.counts();
  await f.sessions.receive('capture-failed',{sessionId:first.n.id,observationPeriodId:first.p.observationPeriodId,visitId:'visit-1',identity:first.s.identity,reason:'Cible différente : cut'});
  const after=f.counts();assert.equal(after.fullScans,before.fullScans);assert.ok(after.keyReads>before.keyReads);
  assert.ok(f.store.records.find(r=>r.visitId==='visit-1').partialReasons.includes('Cible différente : cut'));
  await assert.rejects(f.sessions.receive('capture-failed',{sessionId:second.n.id,observationPeriodId:second.p.observationPeriodId,visitId:'inconnue',identity:second.s.identity,reason:'x'}),
    /ne correspond à aucun enregistrement conservé/,'un identifiant inconnu reste un refus définitif, reconnu comme tel par la page');
});

test('les relations de visite sont inchangées : première, retour, reprise, autre session',async()=>{
  const old={format:'banane-native-visit-v2',recordId:'old-visit',id:'old-visit',visitId:'old-visit',nativeSessionId:'ancienne-session',source:'native-passive-observation',
    identity:{pageId:'native-page',part:23,cut:300,shape:'U50',frameId:'native-frame',projectId:null}};
  const f=await fixture([old]);await f.sessions.start();
  const a=await f.open('a',100);await f.close(a,101);
  const b=await f.open('b',101);await f.close(b,100);
  const c=await f.open('c',100);await f.close(c,300);
  const d=await f.open('d',300);
  assert.equal(relation(f,'a').type,'first-observation');
  assert.equal(relation(f,'c').type,'revisit');assert.equal(relation(f,'c').relatedVisitId,'a');
  assert.equal(relation(f,'d').type,'cross-session-revisit');assert.equal(relation(f,'d').relatedVisitId,'old-visit');
  assert.equal(relation(f,'d').relatedSessionId,'ancienne-session');
  await f.close(d,100);await f.sessions.pause();await f.sessions.resume();
  const e=await f.open('e',100);assert.equal(relation(f,'e').type,'pause-continuation');assert.equal(relation(f,'e').relatedVisitId,'c','la DERNIÈRE visite du cut');
});

test('le bilan de clôture expose la santé de la capture',async()=>{
  const f=await fixture();await f.sessions.start();
  const a=await f.open('a',100);
  await f.sessions.receive('capture-ready',{sessionId:a.n.id,observationPeriodId:a.p.observationPeriodId,visitId:'a',identity:a.s.identity,
    cloud:{format:'banane-native-lidar-capture-v2',captureId:'cap-a',identity:K.clone(a.s.identity),status:'partial-interrupted',
      termination:{code:'TARGET_CHANGED',reason:'Cible différente : cut'},railObservations:{},trace:{},viewObservation:{status:'observed',viewEpochId:'view-1'},
      startedAt:new Date().toISOString(),completedAt:new Date().toISOString()}});
  await f.close(a,101);const b=await f.open('b',101);await f.close(b,102);
  const health=(await f.sessions.end()).closureSummary.captureHealth;
  assert.equal(health.visits,2);assert.equal(health.captures,1);assert.equal(health.capturesPerVisit,.5);
  assert.deepEqual(health.terminations,{TARGET_CHANGED:1});
  assert.deepEqual(health.qualifiedInitialSnapshotRateByRail,{left:0,right:0});
});
