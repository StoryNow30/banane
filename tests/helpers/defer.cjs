/* Harnais commun des essais « différer un unresolved GCV1 » (Banane 4.7). */
const fs=require('node:fs'),path=require('node:path');
const G=require('../../src/geometry.js'),{K,MemoryStore,SimulatedESV}=require('../fixtures.cjs');

const GCV1='geometry-candidate-v1';
/* Le moteur lit `G.proposeBoth` au moment de l'appel : on substitue la
 * publication géométrique sur le module partagé plutôt que de recharger le
 * moteur dans un autre realm — sans quoi les tableaux comparés n'auraient pas
 * le même prototype que ceux des essais. La géométrie n'est pas modifiée sur
 * disque ; seul ce processus de test voit la substitution. */
let PROPOSE=null;const proposeBothReel=G.proposeBoth;
G.proposeBoth=(capture,options)=>PROPOSE?PROPOSE(capture,options):proposeBothReel(capture,options);
const {Engine}=require('../../src/engine.js');
const EngineWith=propose=>{PROPOSE=propose;return Engine;};
function candidate(confidence=80,confidenceStatus='candidate-v1'){
 return Object.fromEntries(['left','right'].map((side,i)=>[side,{side,status:'candidate',delta:[0,i?0.001:-0.001,0.001],confidence,reasons:[],
  method:G.DEFAULTS.method,source:confidenceStatus==='candidate-v1'?GCV1+'-astar':GCV1+'-s1',
  geometryEngine:GCV1,gcv1:{confidenceStatus,motif:'candidate'}}]));
}
/* Abstention GCV1 telle que `toRuntimeRails` la publie : statut, source et
 * moteur portés par le rail lui-même. */
function unresolved(sides=['left','right'],motif='ambiguity'){
 const base=candidate();
 for(const side of sides)base[side]={side,status:'unresolved',delta:null,confidence:0,
  reasons:['Plusieurs placements STRONG compétitifs spatialement distincts.'],method:G.DEFAULTS.method,
  source:GCV1+'-abstention',geometryEngine:GCV1,gcv1:{motif,activated:true,changed:false,confidenceStatus:'not-applicable'}};
 return base;
}
const scope=o=>({part:23,start:100,end:100,testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',
 geometryEngine:GCV1,geometryContract:{id:'GEOMETRY_CANDIDATE_V1',geometrySha256:'candidate-hash'},unresolvedPolicy:'defer',...o});
const byCut=table=>capture=>K.clone(table[capture.cut]??table.default??unresolved());
async function pilot(propose,overrides={},prepare=()=>{}){
 const Engine=EngineWith(propose),adapter=new SimulatedESV(),store=new MemoryStore();
 if(Number.isInteger(overrides.start))adapter.identity.cut=overrides.start;
 const engine=new Engine(adapter,store);await engine.init();engine.s.mode='automatic-test';
 await prepare({engine,adapter,store});
 await engine.startBatch(scope(overrides));await engine.task;
 return {engine,adapter,store,Engine};
}
const counts=adapter=>Object.fromEntries(['apply','validate','skip','nextWithoutDecision','capture']
 .map(name=>[name,adapter.calls.filter(x=>x===name).length]));
/* Reconstruction du runtime depuis les SEULES données persistées : nouvel objet
 * moteur, nouveau stockage, aucune variable du processus interrompu. */
function restartFrom(snapshot,store,Engine,adapter){
 const fresh=new MemoryStore();fresh.state=K.clone(snapshot);
 fresh.events=store.events.map(e=>K.clone(e));fresh.records=store.records.map(r=>K.clone(r));
 fresh.clouds=new Map([...store.clouds].map(([id,cloud])=>[id,K.clone(cloud)]));
 return {engine:new Engine(adapter,fresh),store:fresh};
}
module.exports={G,K,GCV1,MemoryStore,SimulatedESV,Engine,EngineWith,candidate,unresolved,scope,byCut,pilot,counts,restartFrom};
