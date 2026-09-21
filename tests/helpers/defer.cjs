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
/* Écartement du double ESV : 1500,0 mm avant correction. Les deux deltas
 * referment la paire à 1440,0 mm, donc dans le contrat [1405, 1470] — sans
 * quoi le garde d'écartement refuserait de commander, ce que ces essais ne
 * cherchent pas à éprouver. */
function candidate(confidence=80,confidenceStatus='candidate-v1'){
 return Object.fromEntries(['left','right'].map((side,i)=>[side,{side,status:'candidate',delta:[0,i?0.03:-0.03,0.001],confidence,reasons:[],
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
/* ANCIEN HELPER DE REPRISE — relu par la revue Astra.
 *
 * Il combine un ÉTAT ancien avec le journal, les enregistrements et les nuages
 * tels qu'ils sont À LA FIN du scénario. Ce n'est donc pas la photographie d'un
 * crash : des faits postérieurs à la frontière simulée y sont présents. Il
 * reste utilisable pour les essais qui ne vérifient qu'une relecture d'état,
 * mais aucun nouvel essai de crash ne doit s'en servir — voir `crashImage`. */
function restartFrom(snapshot,store,Engine,adapter){
 const fresh=new MemoryStore();fresh.state=K.clone(snapshot);
 fresh.events=store.events.map(e=>K.clone(e));fresh.records=store.records.map(r=>K.clone(r));
 fresh.clouds=new Map([...store.clouds].map(([id,cloud])=>[id,K.clone(cloud)]));
 return {engine:new Engine(adapter,fresh),store:fresh};
}

/* PHOTOGRAPHIE FIDÈLE D'UNE FRONTIÈRE DE CRASH.
 *
 * `CrashStore` capture, au moment exact où un état est écrit, une image
 * SIMULTANÉE de tout ce qui est persistant : état, journal, enregistrements et
 * nuages. Aucun événement ni enregistrement postérieur à cette frontière n'y
 * figure, puisqu'ils n'existaient pas encore.
 *
 * `restartFromImage` reconstruit ensuite un moteur, un stockage et un
 * adaptateur NEUFS à partir de cette seule image : aucune variable, promesse,
 * autorisation ou callback du runtime interrompu ne survit. L'état ESV du
 * nouvel adaptateur est déclaré par l'essai, pour correspondre à ce que l'effet
 * avait réellement pu produire à la frontière testée. */
class CrashStore extends MemoryStore{
 image(){return {state:K.clone(this.state),events:this.events.map(e=>K.clone(e)),
  records:this.records.map(r=>K.clone(r)),clouds:[...this.clouds].map(([id,cloud])=>[id,K.clone(cloud)])};}
}
function restartFromImage(image,{esvCut=null,esvIdentity=null}={}){
 const store=new CrashStore();
 store.state=K.clone(image.state);
 store.events=image.events.map(e=>K.clone(e));
 store.records=image.records.map(r=>K.clone(r));
 store.clouds=new Map(image.clouds.map(([id,cloud])=>[id,K.clone(cloud)]));
 const adapter=new SimulatedESV();
 if(esvIdentity)adapter.identity=K.clone(esvIdentity);
 else if(Number.isInteger(esvCut))adapter.identity.cut=esvCut;
 return {engine:new Engine(adapter,store),store,adapter,image};
}
/* Lance un lot en capturant l'image à la PREMIÈRE écriture qui satisfait
 * `frontier(state)`. L'image n'est prise qu'une fois : les écritures suivantes
 * appartiennent déjà à l'après-crash. */
async function runCapturingCrash(propose,overrides={},frontier=()=>false,prepare=()=>{}){
 const Engine=EngineWith(propose),adapter=new SimulatedESV(),store=new CrashStore();
 if(Number.isInteger(overrides.start))adapter.identity.cut=overrides.start;
 let image=null;
 const engine=new Engine(adapter,store);
 /* `onSetState` reçoit l'état EN COURS d'écriture et s'exécute avant qu'il ne
  * remplace l'ancien : l'image prend donc cet état-là, accompagné du journal,
  * des enregistrements et des nuages déjà durables au même instant. */
 store.onSetState=state=>{if(image||!frontier(state,engine,adapter))return;
  image=store.image();image.state=K.clone(state);};
 await engine.init();engine.s.mode='automatic-test';
 await prepare({engine,adapter,store});
 await engine.startBatch(scope(overrides));await engine.task;
 return {engine,adapter,store,image,Engine};
}
/* L'export GCV1 part des observations shadow journalisées par background.js.
 * On la reproduit telle quelle pour que l'association passe par les règles de
 * provenance existantes — `proposalId` exact — sans en inventer une. */
const Export=require('../../src/gcv1-export.js');
async function ajouterShadow({engine,store}){
 const intent=store.events.find(e=>e.type==='defer-intent');
 if(!intent)throw Error('Aucune intention différée dans le journal : rien à relier.');
 await engine.event('gcv1-shadow-observed',{identity:K.clone(intent.identity),
  sessionId:engine.s.sessionId,batchId:engine.s.batch.id,proposalId:intent.proposalId,
  lidarCaptureId:intent.lidarCaptureId??null,
  shadow:{format:'banane-gcv1-shadow-v1',contract:{id:'GEOMETRY_CANDIDATE_V1'},
   selection:{selector:'active-pilot-test',requestedEngine:GCV1,selectedEngine:GCV1,fallback:false},
   rails:{left:{next:{status:'unresolved',motif:'ambiguity'}},right:{next:{status:'unresolved',motif:'ambiguity'}}}}});
 return intent.proposalId;
}
function deferralDe({engine,store},{events=null,state=null}={}){
 const diagnostic=Export.buildDiagnostic({version:'4.6.0',sessionId:engine.s.sessionId,
  state:state??engine.view(),events:events??store.events});
 if(!diagnostic.observations.length)throw Error('Une observation shadow est nécessaire à l’export.');
 return diagnostic.observations.at(-1).runtime.deferral;
}
module.exports={G,K,GCV1,MemoryStore,SimulatedESV,Engine,EngineWith,candidate,unresolved,scope,byCut,pilot,counts,
 restartFrom,CrashStore,restartFromImage,runCapturingCrash,Export,ajouterShadow,deferralDe};
