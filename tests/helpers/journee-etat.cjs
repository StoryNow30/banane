'use strict';
/* CH-059 — une longue journée simulée, pour mesurer l'état écrit : vraie session Écho (`src/native-session.js`), vrai moteur,
 * vrai `BananeStorage3` (`src/storage.js`) sur un faux `chrome.storage.local` qui compte les octets de chaque `set`.
 * IndexedDB (visites, événements, nuages) est en mémoire. Aucune donnée terrain : identités et rails synthétiques. */
/* Rails de la fixture sans leurs contours de profil (80 Ko) : l'état courant (`s.current`) est borné, il n'est pas l'objet de la mesure. */
const rails=()=>{const r=K.clone(base.rails);for(const c of ['left','right'])delete r[c].profileContours;return r;};
const {Sessions}=require('../../src/native-session.js'),{Engine}=require('../../src/engine.js'),{K,base}=require('../fixtures.cjs');

function fauxChrome(){const disque=new Map(),journal=[];
 const copie=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const local={async get(k){const cles=k===null?[...disque.keys()]:Array.isArray(k)?k:[k];const o={};for(const c of cles)if(disque.has(c))o[c]=copie(disque.get(c));return o;},
  async set(o){let octets=0;for(const [c,v] of Object.entries(o)){const t=JSON.stringify(v);octets+=Buffer.byteLength(t);disque.set(c,JSON.parse(t));}journal.push({cles:Object.keys(o),octets});},
  async remove(k){for(const c of Array.isArray(k)?k:[k])disque.delete(c);},async getKeys(){return [...disque.keys()];}};
 return {chrome:{storage:{local}},disque,journal};}

/* Le vrai stockage, IndexedDB remplacée par des tables en mémoire. */
function magasin(fc,{clouds=new Map(),records=new Map(),events=new Map()}={}){
 globalThis.chrome=fc.chrome;delete require.cache[require.resolve('../../src/storage.js')];
 require('../../src/storage.js');const s=new globalThis.BananeStorage3();
 const t={clouds,records,events};
 Object.assign(s,{async putCloud(id,d){clouds.set(id,K.clone(d));},async getCloud(id){return clouds.has(id)?K.clone(clouds.get(id)):undefined;},async deleteCloud(id){clouds.delete(id);},
  async putEvent(e){events.set(e.eventId,K.clone(e));},async deleteEvent(id){events.delete(id);},async putRecord(r){records.set(r.recordId||r.id,K.clone(r));},
  async deleteRecord(id){records.delete(id);},async getRecord(id){return records.has(id)?K.clone(records.get(id)):undefined;},
  async all(n){return [...t[n].values()].map(K.clone);},async keys(n){return [...t[n].keys()];},async archiverVisites(){},
  async clearAll(){for(const m of Object.values(t))m.clear();}});
 s.tables=t;return s;}

const adaptateur=()=>({state:async()=>({identity:{pageId:'p',part:8,cut:100,shape:'U50',frameId:'f',projectId:null},rails:rails(),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[]}),
 nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})});

async function ouvrir(fc,tables){const store=magasin(fc,tables),adapter=adaptateur(),engine=new Engine(adapter,store);await engine.init();
 const sessions=new Sessions(engine,adapter,store);await sessions.init();return {store,engine,sessions,adapter};}

function etat(part,cut){return {identity:{pageId:'p',part,cut,shape:'U50',frameId:'f',projectId:null},rails:rails(),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],
 viewObservation:{status:'observed',viewEpochId:'v',observedAt:new Date().toISOString()},geominfo:{status:'not-observed',raw:null,source:null}};}
function morceauNuage(st,visitId,id,side){const local=[[-.4,.03,.02],[0,.03,.02],[.4,.03,.02]];
 return {format:'banane-native-lidar-chunk-v1',version:K.VERSION,chunkId:`${id}:${side}:0`,captureId:id,visitId,side,identity:K.clone(st.identity),capturedAt:st.capturedAt,
  viewObservation:K.clone(st.viewObservation),rail:K.clone(st.rails[side]),coordinateSystem:{name:'scene-relative',units:'m',frameId:'f'},
  acquisition:{startedAt:st.capturedAt,endedAt:st.capturedAt,emittedAt:st.capturedAt},pointsSceneRelative:local.map(p=>K.C.point(st.rails[side].profileLocalToSceneRelative,p)),pointsProfileLocal:local};}

/* Une visite Écho : ouverture, deux captures (deux côtés chacune), geste de validation, fermeture. */
async function visite(a,i,part=8){const n=a.engine.s.native,ctx={sessionId:n.id,observationPeriodId:n.currentPeriodId},visitId=`v-${part}-${i}`,st=etat(part,100+i);
 await a.sessions.receive('visit-started',{...ctx,visitId,identity:st.identity,initialObserved:st});
 for(const c of [0,1]){const id=`cap-${part}-${i}-${c}`;
  for(const side of ['left','right'])await a.sessions.receive('capture-checkpoint',{...ctx,visitId,identity:st.identity,chunk:morceauNuage(st,visitId,id,side)});
  await a.sessions.receive('capture-ready',{...ctx,visitId,identity:st.identity,cloud:{format:'banane-native-lidar-capture-v2',version:K.VERSION,captureId:id,visitId,identity:K.clone(st.identity),
   startedAt:st.capturedAt,capturedAt:st.capturedAt,completedAt:st.capturedAt,status:'complete-loaded-buffers',viewObservation:K.clone(st.viewObservation),railObservations:{},trace:{},termination:null}});}
 await a.sessions.receive('operator-event',{...ctx,visitId,identity:st.identity,stateObservedBeforeInput:st,event:{type:'keydown',intent:'VALIDATE',decisionKey:'Shift+Space',observedAt:new Date().toISOString()}});
 await a.sessions.receive('visit-ended',{...ctx,visitId,identity:st.identity,finalObserved:st,reason:'target-changed',nextIdentity:{...st.identity,cut:101+i},endedAt:new Date().toISOString()});}

/* Vidage automatique d'un segment, comme le panneau : tout ce qui est en attente est écrit, confirmé et libéré. */
async function vidage(a){const plan=await a.sessions.exportPlan();return a.sessions.ackExported(plan.cloudIds,{confirmes:plan.cloudIds,fichiers:1});}

/* Octets du dernier `set` de l'état (état + morceaux changés), après une sauvegarde forcée. */
async function octetsSauvegarde(a,fc){const avant=fc.journal.length;await a.engine.save();const s=fc.journal.slice(avant).filter(j=>j.cles.includes('banane3State'));return s.at(-1)?.octets??null;}
const tailleEtat=fc=>Buffer.byteLength(JSON.stringify(fc.disque.get('banane3State')));

module.exports={fauxChrome,magasin,ouvrir,visite,vidage,octetsSauvegarde,tailleEtat,etat};
