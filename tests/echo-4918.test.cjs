'use strict';
/* 4.9.0.18 — corrections de l'audit Écho (fiches/AUDIT_ECHO_5.0.md, étapes 1 à 4 de la 4.9.5) :
 *  AM-01 gestes de validation complets ; AM-02 validations répétées ; AM-03 pose de départ avant le premier geste ;
 *  AM-05 page ESV rechargée : pause dite puis reprise automatique ; AM-07 redémarrage du service worker guéri ;
 *  AM-08 relation des visites par (partie, cut) ; AM-13 seuil de déplacement ; AM-14 écriture ESV jointe ;
 *  AM-19 session finie non téléchargée ; parité d'export : volumes zip Écho avec CONTENU.txt ; KI-068 ; lecture des zip. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Observer}=require('../src/native-page.js'),{Sessions}=require('../src/native-session.js'),{Engine}=require('../src/engine.js');
const {K,base,MemoryStore}=require('./fixtures.cjs'),Settings=require('../src/settings.js');
const {background}=require('./helpers/background-harness.cjs'),{panneau}=require('../tools/audit-qualite-480.cjs');
const Z=require('../src/zip-writer.js'),X=require('../src/native-export.js'),EC=require('../src/export-cache.js'),Volumes=require('../tools/lire-volumes.cjs'),Segments=require('../tools/merge-segments.cjs');
const flush=async(n=6)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ariane-4918-'));

/* ---------- page : intentions ---------- */
function page(){let state={identity:{pageId:'p1',part:23,cut:100,shape:'U50',frameId:'f1',projectId:null},rails:K.clone(base.rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[]};
 let handler=null;const sent=[];
 const api={snapshot:()=>K.clone(state),capture:async()=>{throw Error('passive-lidar-read-cancelled');},send:async(type,payload)=>{sent.push({type,payload});return {saved:true};},
  now:()=>0,performanceNow:()=>0,interval:()=>1,clearInterval(){},defer:fn=>queueMicrotask(fn),install:fn=>{handler=fn;},uninstall(){},editable:t=>t?.kind==='input',targetKind:t=>t?.kind||'other',signalFailure(){}};
 const o=new Observer(api);return {o,sent,key:(init)=>handler({type:'keydown',isTrusted:true,target:{kind:'canvas'},...init}),start:()=>o.start({sessionId:'s',observationPeriodId:'p'})};}
test('AM-01 : Ctrl+Entrée et Entrée valent une validation, la touche est consignée ; AM-02 : une touche répétée n’est pas une intention',async()=>{
 const f=page();await f.start();
 f.key({key:'Enter',code:'Enter',ctrlKey:true});f.key({key:'Enter',code:'Enter'});f.key({key:' ',code:'Space',shiftKey:true});f.key({key:' ',code:'Space',shiftKey:true,repeat:true});
 f.key({key:'Enter',code:'Enter',shiftKey:true});f.key({key:'a',code:'KeyA'});await flush(12);
 const ev=f.sent.filter(x=>x.type==='operator-event').map(x=>x.payload.event);
 assert.deepEqual(ev.map(e=>e.intent),['VALIDATE','VALIDATE','VALIDATE',null,null,null]);
 assert.deepEqual(ev.map(e=>e.decisionKey),['Ctrl+Enter','Enter','Shift+Space','Shift+Space',null,null]);
 assert.equal(ev[3].repeatOfIntent,true);assert.equal(ev[3].repeat,true);
 assert.deepEqual(Settings.echo.validateKeys,['Shift+Space','Ctrl+Enter','Enter','click']);
});

/* ---------- session ---------- */
async function session(records=[]){
 const store=new MemoryStore();for(const r of records)store.records.push(r);store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];store.keys=async()=>[...store.clouds.keys()];
 const calls=[],adapter={state:async()=>st(),nativeStart:async()=>{calls.push('nativeStart');return {active:true};},nativePause:async()=>({metrics:{}}),nativeResume:async()=>{calls.push('nativeResume');return {active:true};},nativeFinish:async()=>({metrics:{}})};
 const engine=new Engine(adapter,store);await engine.init();const sessions=new Sessions(engine,adapter,store);await sessions.init();
 function st(cut=100,pageId='page-a',delta=null){const s={identity:{pageId,part:23,cut,shape:'U50',frameId:'frame-'+pageId,projectId:null},rails:K.clone(base.rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],
   viewObservation:{status:'observed',viewEpochId:'v',observedAt:new Date().toISOString()},geominfo:{status:'not-observed',raw:null,source:null}};
  if(delta)s.rails=K.expectedPoses(s,delta);return s;}
 const ctx=()=>{const n=engine.s.native;return {sessionId:n.id,observationPeriodId:n.currentPeriodId};};
 async function open(visitId,cut=100,pageId='page-a'){const state=st(cut,pageId);await sessions.receive('visit-started',{...ctx(),visitId,identity:state.identity,initialObserved:state});return state;}
 const moved=(state,delta)=>({...K.clone(state),rails:K.expectedPoses(state,delta),capturedAt:new Date().toISOString()});
 async function observe(visitId,state){await sessions.receive('state-observed',{...ctx(),visitId,identity:state.identity,state,trigger:'poll',effect:{kind:'rail-state-changed'}});}
 async function gesture(visitId,state,event){await sessions.receive('operator-event',{...ctx(),visitId,identity:state.identity,stateObservedBeforeInput:state,event:{type:'keydown',observedAt:new Date().toISOString(),...event}});}
 async function close(visitId,state,next=101,reason='target-changed'){await sessions.receive('visit-ended',{...ctx(),visitId,identity:state.identity,finalObserved:state,reason,nextIdentity:next===null?null:{...state.identity,cut:next},endedAt:new Date().toISOString()});}
 const record=id=>store.records.find(r=>r.visitId===id);
 return {store,engine,sessions,adapter,calls,st,open,moved,observe,gesture,close,record};
}
test('AM-02 : deux validations sans autre intention = une décision, la DERNIÈRE pose fait référence',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');
 await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Shift+Space'});
 const b=f.moved(a,{left:{delta:[0,.012,0]},right:{delta:[0,0,0]}});await f.observe('v1',b);
 await f.gesture('v1',b,{key:'d'});const c=f.moved(a,{left:{delta:[0,.02,0]},right:{delta:[0,0,0]}});await f.observe('v1',c);
 await f.gesture('v1',c,{intent:'VALIDATE',decisionKey:'Ctrl+Enter'});await f.close('v1',c);
 const r=f.record('v1');assert.equal(r.multiIntent,true);assert.equal(r.operatorIntent,'VALIDATE');assert.equal(r.intentCollapse.kind,'repeated-validate');assert.equal(r.intentCollapse.count,2);
 assert.equal(r.observedLabelCandidate,'VALIDATE_CORRECTED_LEFT_ONLY');assert.equal(r.humanFinalReferences.length,2);assert.equal(r.humanFinalReference.decisionKey,'Ctrl+Enter');
 assert.equal(r.humanFinalReferenceSource,'last-validate-intent');assert.equal(r.startPose.source,'last-state-before-first-gesture');
 const attendu=K.C.distance(a.rails.left.positionSceneRelative,c.rails.left.positionSceneRelative)*1000;assert.ok(attendu>1&&Math.abs(r.humanDelta.left.distanceMm-attendu)<0.2,`${r.humanDelta.left.distanceMm} ≠ ${attendu}`);
 assert.ok(!r.partialReasons.includes('multiple-operator-intents-observed'));assert.equal(r.trainingExclusionReason,'native-reference-requires-explicit-review');
});
test('intentions de natures différentes (VALIDATE puis SKIP) : toujours ambiguës',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');await f.gesture('v1',a,{intent:'VALIDATE'});await f.gesture('v1',a,{intent:'SKIP'});await f.close('v1',a);
 assert.equal(f.record('v1').observedLabelCandidate,'AMBIGUOUS_MULTIPLE_INTENTS');
});
test('AM-03 : la pose de départ est le dernier état AVANT le premier geste ; un ajustement d’ESV sans geste n’est pas une correction ; l’ancienne règle reste consignée',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');
 const esv=f.moved(a,{left:{delta:[0,.05,0]},right:{delta:[0,.05,0]}});await f.observe('v1',esv);          // ESV recale ses rails de 5 cm au chargement
 await f.gesture('v1',esv,{key:'d'});                                                                     // premier geste de Mic
 const fin=f.moved(esv,{left:{delta:[0,.004,0]},right:{delta:[0,0,0]}});await f.observe('v1',fin);          // il bouge la gauche de 4 mm
 await f.gesture('v1',fin,{intent:'VALIDATE',decisionKey:'Shift+Space'});await f.close('v1',fin);
 const r=f.record('v1');assert.equal(r.startPose.source,'last-state-before-first-gesture');assert.equal(r.startPose.differsFromBeforeEstablished,true);
 assert.equal(r.observedLabelCandidate,'VALIDATE_CORRECTED_LEFT_ONLY');assert.equal(r.labelBasis.legacyLabel,'VALIDATE_CORRECTED_BOTH');
 const attendu=K.C.distance(esv.rails.left.positionSceneRelative,fin.rails.left.positionSceneRelative)*1000;assert.ok(attendu>1&&Math.abs(r.humanDelta.left.distanceMm-attendu)<0.2,`${r.humanDelta.left.distanceMm} ≠ ${attendu}`);assert.ok(Math.abs(r.humanDelta.right.distanceMm)<0.01);assert.equal(r.railPoseHistory.length,2);assert.equal(r.railPoseHistory[0].afterGesture,false);assert.equal(r.railPoseHistory[1].afterGesture,true);
 assert.equal(r.gestureSummary.count,2);assert.equal(r.gestureSummary.byKey['Shift+Space'].n,1);
});
test('AM-13 : un déplacement sous le seuil (1 mm) est « non déplacé », la comparaison exacte reste consignée',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');await f.gesture('v1',a,{key:'d'});
 const fin=f.moved(a,{left:{delta:[0,.0003,0]},right:{delta:[0,0,0]}});await f.observe('v1',fin);await f.gesture('v1',fin,{intent:'VALIDATE'});await f.close('v1',fin);
 const r=f.record('v1');assert.equal(r.observedLabelCandidate,'VALIDATE_NO_MOVEMENT');assert.equal(r.humanDelta.left.identical,false);assert.equal(r.humanDelta.left.changed,false);assert.equal(r.labelBasis.thresholdMm,1);
});
test('AM-08 : une revisite du même cut depuis une AUTRE page (F5) est reconnue ; la revisite inter-session aussi',async()=>{
 const old={format:'banane-native-visit-v2',recordId:'old',id:'old',visitId:'old',nativeSessionId:'ancienne',source:'native-passive-observation',identity:{pageId:'page-z',part:23,cut:300,shape:'U50',frameId:'frame-z',projectId:null}};
 const f=await session([old]);await f.sessions.start();const a=await f.open('v1',100,'page-a');await f.close('v1',a,101);
 await f.open('v2',100,'page-b');assert.equal(f.record('v2').visitRelation.type,'revisit');assert.equal(f.record('v2').visitRelation.relatedVisitId,'v1');
 await f.close('v2',f.st(100,'page-b'),300);await f.open('v3',300,'page-b');assert.equal(f.record('v3').visitRelation.type,'cross-session-revisit');assert.equal(f.record('v3').visitRelation.relatedSessionId,'ancienne');
});
test('AM-14 / AM-18 : une écriture de validation d’ESV jointe à la dernière visite close la confirme ; sans navigation, la référence reste comparable',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Ctrl+Enter'});await f.close('v1',a,null,'finished');
 let r=f.record('v1');assert.ok(r.partialReasons.includes('decision-effect-not-observed'));
 const w=await f.sessions.noteServerWrite({eventId:'w1',timestamp:new Date().toISOString(),status:200,method:'PUT',outcome:'done',attempt:1,rowIndex:100,body:{XLeftEdge:1.5,ExtractionStatus:'valid',TreatedByOperator:true,SeenByOperator:true},durationMs:40});
 assert.equal(w.joinedTo,'closed-visit');assert.equal(w.joinMethod,'row-index');assert.equal(w.kind,'validation');r=f.record('v1');assert.equal(r.serverConfirmed,true);assert.equal(r.serverConfirmationStatus,'observed-validation-write-200');
 assert.equal(r.serverWrites.length,1);assert.ok(!r.partialReasons.includes('decision-effect-not-observed'));assert.ok(!r.geometryEligibility.left.reasons.includes('decision-effect-not-observed'));
});
test('AM-07 : après un redémarrage du service worker, la page qui observe toujours guérit la période et rouvre la visite',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');const n0=f.engine.s.native,period=n0.currentPeriodId;
 const engine2=new Engine(f.adapter,f.store);await engine2.init();const s2=new Sessions(engine2,f.adapter,f.store);await s2.init();
 assert.equal(engine2.s.native.status,'PAUSED');assert.equal(f.record('v1').recoveredClosure.status,'INTERRUPTED_RECOVERED');
 const moved={...K.clone(a),rails:K.expectedPoses(a,{left:{delta:[0,.01,0]},right:{delta:[0,0,0]}}),capturedAt:new Date().toISOString()};
 await s2.receive('state-observed',{sessionId:n0.id,observationPeriodId:period,visitId:'v1',identity:a.identity,state:moved,trigger:'poll',effect:{kind:'rail-state-changed'}});
 const n=engine2.s.native;assert.equal(n.status,'RUNNING');assert.equal(n.currentPeriodId,period);assert.equal(n.observationPeriods[0].status,'RUNNING');assert.equal(n.healed,1);
 const r=f.record('v1');assert.equal(r.recoveredClosure.healed,true);assert.equal(r.endTimeStatus,'open');assert.ok(!r.partialReasons.includes('worker-restarted-before-visit-closure'));assert.equal(n.current?.visitId,'v1');
 await s2.receive('visit-ended',{sessionId:n0.id,observationPeriodId:period,visitId:'v1',identity:a.identity,finalObserved:moved,reason:'target-changed',nextIdentity:{...a.identity,cut:101},endedAt:new Date().toISOString()});
 assert.equal(f.record('v1').endTimeStatus,'observed');assert.ok(!f.record('v1').partialReasons.includes('worker-restarted-before-visit-closure'));
});
test('AM-05 : page perdue = visite close telle quelle, période interrompue, session en pause « page perdue »',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');await f.gesture('v1',a,{key:'d'});
 const lost=await f.sessions.pageLost('page-reloaded');assert.equal(lost.reason,'page-reloaded');const n=f.engine.s.native;
 assert.equal(n.status,'PAUSED_ADAPTER_UNRESPONSIVE');assert.equal(n.current,null);assert.equal(n.observationPeriods[0].status,'INTERRUPTED');
 const r=f.record('v1');assert.equal(r.leaveReason,'page-reloaded');assert.equal(r.endTimeStatus,'observed-page-lost');assert.equal(r.observedLabelCandidate,'PASS_NO_DECISION');assert.match(n.message,/rechargée/);
 await f.sessions.resume();assert.equal(n.status,'RUNNING');assert.equal(n.observationPeriods.length,2);assert.deepEqual(f.calls,['nativeStart','nativeResume']);
});
test('AM-19 : une session finie avec des visites, jamais téléchargée en entier, n’est pas remplacée ; l’acquittement final la libère',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1');await f.close('v1',a);await f.sessions.end({dataset:false});
 await assert.rejects(f.sessions.start(),/n’a pas été téléchargée en entier/);
 const ack=await f.sessions.ackExported([],{confirmes:[],fichiers:2,final:true});assert.equal(ack.final,true);assert.ok(f.engine.s.native.exportState.finalExportAt);
 await f.sessions.start();assert.equal(f.engine.s.native.visits.length,0);
});

test('4.9.0.19 (partie 24) : la validation écrite APRÈS le changement de cut va au cut de sa ligne ; « vu par l’opérateur » ne confirme rien',async()=>{
 const f=await session();await f.sessions.start();const a=await f.open('v1',100);const t0=Date.now();
 await f.sessions.noteServerWrite({eventId:'s1',timestamp:new Date(t0).toISOString(),status:204,rowIndex:100,body:{SeenByOperator:true}});
 await f.gesture('v1',a,{intent:'VALIDATE',decisionKey:'Shift+Space'});await f.close('v1',a,101);
 const b=await f.open('v2',101);                                   // ESV a déjà changé de cut quand la validation du cut 100 est écrite
 const w=await f.sessions.noteServerWrite({eventId:'w1',timestamp:new Date(Date.now()+200).toISOString(),status:204,rowIndex:100,body:{ExtractionStatus:'valid',TreatedByOperator:true,SeenByOperator:true}});
 assert.equal(w.joinMethod,'row-index');assert.equal(f.record('v1').serverConfirmed,true);assert.equal(f.record('v1').serverWrites.length,2);assert.equal(f.record('v1').serverWrites[0].kind,'seen');
 assert.equal(f.record('v2').serverConfirmed,false,'la visite suivante n’est pas confirmée par la validation du cut précédent');assert.equal(f.record('v2').serverWrites.length,0);
 await f.sessions.noteServerWrite({eventId:'s2',timestamp:new Date().toISOString(),status:204,rowIndex:101,body:{SeenByOperator:true}});
 assert.equal(f.record('v2').serverWrites.length,1);assert.equal(f.record('v2').serverConfirmed,false,'une écriture « vu » seule ne confirme pas');
 // numéro de ligne sans visite correspondante : repli sur l’heure, nommé
 const x=await f.sessions.noteServerWrite({eventId:'w9',timestamp:new Date().toISOString(),status:204,rowIndex:9999,body:{ExtractionStatus:'valid',TreatedByOperator:true}});
 assert.equal(x.joinMethod,'time-current-visit');
});

/* ---------- service worker : F5, alerte, reprise, observations ESV taguées ---------- */
const esv={id:'test',url:'https://esv.lidar.altametris.xyz/rails_validation/test',tab:{id:1}};
test('AM-05 (service worker) : F5 sur l’onglet observé → pause dite, bandeau rouge dans ESV, puis reprise automatique (nouvelle période, aucune commande ESV)',async()=>{
 const b=background({globals:{BananeCore3:K,BananeSettings:Settings,BananeExportCache:EC}});await b.api('connect',{tabId:1});await b.api('native-start');
 const id=b.fonction('engine.s.native.id');await b.message({kind:'native-event',type:'visit-started',payload:{sessionId:id,observationPeriodId:b.fonction('engine.s.native.currentPeriodId'),visitId:'v1',identity:b.adapter.identity,initialObserved:await b.adapter.state()}},esv);
 await b.tabUpdated(1,{status:'loading'});
 let n=b.fonction('engine.s.native');assert.equal(n.status,'PAUSED_ADAPTER_UNRESPONSIVE');assert.equal(n.pageLost.reason,'page-reloaded');
 const statut=await b.message({kind:'launcher-status'},esv);assert.equal(statut.bandeau.ton,'rouge');assert.match(statut.bandeau.text,/CAPTURE ARRÊTÉE/);
 await b.tabUpdated(1,{status:'complete'});await flush(30);
 n=b.fonction('engine.s.native');assert.equal(n.status,'RUNNING',n.message);assert.equal(n.pageLost,null);assert.equal(n.observationPeriods.length,2);
 assert.ok(b.adapter.calls.includes('nativeResume'));assert.ok(!b.adapter.calls.some(c=>['apply','validateAndNext','next','skipAndNext'].includes(c)));
 assert.equal((await b.message({kind:'launcher-status'},esv)).bandeau,null);
 await b.tabRemoved(1);n=b.fonction('engine.s.native');assert.equal(n.status,'PAUSED_ADAPTER_UNRESPONSIVE');assert.equal(n.pageLost.reason,'tab-closed');
});
test('AM-14 (service worker) : pendant Écho, les observations ESV portent la session et une écriture 2xx est jointe à la visite ; elles sortent dans l’export Écho',async()=>{
 const b=background({globals:{BananeCore3:K,BananeSettings:Settings,BananeExportCache:EC}});await b.api('connect',{tabId:1});await b.api('native-start');const id=b.fonction('engine.s.native.id'),period=b.fonction('engine.s.native.currentPeriodId');
 const state=await b.adapter.state();
 await b.message({kind:'native-event',type:'visit-started',payload:{sessionId:id,observationPeriodId:period,visitId:'v1',identity:state.identity,initialObserved:state}},esv);
 await b.message({kind:'native-event',type:'operator-event',payload:{sessionId:id,observationPeriodId:period,visitId:'v1',identity:state.identity,stateObservedBeforeInput:state,event:{type:'keydown',intent:'VALIDATE',decisionKey:'Ctrl+Enter',observedAt:new Date().toISOString()}}},esv);
 const t=Date.now();const r=await b.message({kind:'esv-observation',observer:'obs-1',entries:[{seq:1,kind:'write',urlClass:'rail-pair-write',method:'PUT',status:200,outcome:'done',attempt:1,railPairId:'table/row-1',bodyKeys:7,body:{XLeftEdge:1.25,ExtractionStatus:'valid',TreatedByOperator:true,SeenByOperator:true},rowIndex:100,startedEpochMs:t-30,endedEpochMs:t,durationMs:30}]},esv);
 assert.equal(r.accept,true);await flush(20);
 const rec=b.store.records.find(x=>x.visitId==='v1');assert.equal(rec.serverConfirmed,true);assert.equal(rec.serverWrites[0].status,200);assert.equal(rec.serverWrites[0].joinedTo,'current-visit');assert.equal(rec.serverWrites[0].joinMethod,'row-index');assert.equal(rec.serverWrites[0].body.ExtractionStatus,'valid');
 const obs=b.store.events.find(e=>e.type==='esv-observation'&&e.kind==='write');assert.equal(obs.nativeSessionId,id);
 await b.message({kind:'native-event',type:'visit-ended',payload:{sessionId:id,observationPeriodId:period,visitId:'v1',identity:state.identity,finalObserved:state,reason:'finished',nextIdentity:null,endedAt:new Date().toISOString()}},esv);
 await b.api('native-end');const data=await b.api('native-download');assert.ok(data.events.some(e=>e.type==='esv-observation'&&e.kind==='write'),'l’écriture ESV est dans l’export Écho');
 assert.equal(data.records[0].observedLabelCandidate,'VALIDATE_NO_MOVEMENT');assert.ok(!data.records[0].partialReasons.includes('decision-effect-not-observed'));
 const journal=await b.api('journal');assert.ok(!journal.events.some(e=>e.nativeSessionId),'le journal du service worker ne porte pas les événements d’Écho');
});
test('AM-23 (service worker) : libellé de cut illisible = Écho refusé',async()=>{
 const b=background({globals:{BananeCore3:K,BananeSettings:Settings,BananeExportCache:EC}});await b.api('connect',{tabId:1});const identite=b.adapter.identity;b.adapter.identity={...identite,part:null,cut:null};
 await assert.rejects(b.api('native-start'),/libellé du cut n’est pas lisible/);b.adapter.identity=identite;await b.api('native-start');assert.equal(b.fonction('engine.s.native.status'),'RUNNING');
});

/* ---------- panneau : export Écho en volumes zip, CONTENU.txt, acquittement final, KI-068 ---------- */
function nuage(i){const pts=Array.from({length:400},(_,j)=>[i+j*0.123456789,2.5+j/7,j*1.0000001]);
 return {format:'banane-native-lidar-chunk-v1',version:'4.9.0.18',chunkId:'c'+i,captureId:'cap'+i,visitId:'v'+i,side:'left',nativeSessionId:'echo-1',identity:{pageId:'p',part:7,cut:100+i,shape:'U50',frameId:'f',projectId:null},
  rail:K.clone(base.rails.left),coordinateSystem:{name:'scene-relative',matrixLayout:'column-major; column vectors',units:'u',frameId:'f'},pointsSceneRelative:pts,pointsProfileLocal:pts,pointSources:pts.map((_,j)=>[0,j]),visibleByClipBoxes:pts.map(()=>true),storageTrace:{pointsSaved:400,pointsExported:0}};}
async function exportEcho({n=8,zipMaxBytes=60000,etat='complete'}={}){
 const clouds=new Map(Array.from({length:n},(_,i)=>['c'+i,nuage(i)]));
 const records=Array.from({length:n},(_,i)=>({recordId:'v'+i,visitId:'v'+i,visitIndex:i,nativeSessionId:'echo-1',observationPeriodId:'per-1',identity:{pageId:'p',part:7,cut:100+i,shape:'U50',frameId:'f',projectId:null},observedLabelCandidate:'VALIDATE_NO_MOVEMENT',railSnapshots:{left:[],right:[]}}));
 const events=[...Array.from({length:40},(_,i)=>({eventId:'e'+i,eventSeq:i+1,type:'native-state-observed',nativeSessionId:'echo-1',timestamp:'2026-10-15T08:00:00.000Z'})),
  {eventId:'o1',type:'esv-observation',kind:'write',nativeSessionId:'echo-1',timestamp:'2026-10-15T08:00:01.000Z',status:200},
  {eventId:'lot1',type:'proposed',eventSeq:1,timestamp:'2026-10-15T07:00:00.000Z',identity:{part:7,cut:1}}];
 const store={all:async t=>structuredClone(t==='events'?events:t==='records'?records:[]),keys:async t=>t==='clouds'?[...clouds.keys()]:[],getCloud:async id=>structuredClone(clouds.get(id))};
 const session={id:'echo-1',status:'FINISHED',startedAt:'2026-10-15T07:30:00.000Z',finishedAt:'2026-10-15T08:10:00.000Z',visits:records.map(r=>({visitId:r.visitId,identity:r.identity})),incomplete:[],cloudIds:[...clouds.keys()],metrics:{}};
 const manifeste={format:'banane-native-session-v2',version:'4.9.0.18',exportedAt:'2026-10-15T08:11:00.000Z',session,sessionId:'echo-1',cloudIds:[...clouds.keys()],declaredCloudIds:[...clouds.keys()],recordCount:n,eventCount:events.length-1,alreadyExported:0,released:0,closureSummary:{visits:n},exportAdvice:null};
 const globals={BananeStorage3:class{constructor(){return store;}},BananeExportCache:EC,BananeNativeExport:X,BananeZip:Z,BananeCore3:K,
  BananeSettings:{...Settings,export:{...Settings.export,segmentBytes:30000,segmentReserveBytes:500,minObjectsPerSegment:1,zipMaxBytes}}};
 let id=0;const noms=new Map(),acks=[];
 const chromeExtra={downloads:{download:async o=>{id++;noms.set(id,o.filename);return id;},search:async({id:i})=>[{state:etat}],onChanged:{addListener(){},removeListener(){}}}};
 const fiches=[{at:'2026-10-14T12:01:00.000Z',batchId:'lot-a',partie:7,valides:800,invalides:66,total:866},{at:'2026-10-15T07:35:00.000Z',batchId:'lot-b',partie:24,valides:9169,invalides:106,total:9275}];
 const state={current:{identity:{part:7,cut:100}},native:session,batch:null,manual:null,records:[],incomplete:[]};
 const p=await panneau(state,{hash:'#native',globals,chromeExtra,reponses:{'native-export-manifest':manifeste,'fiches-depart':{fiches},'native-export-ack':a=>{acks.push(a);return {acknowledged:0};},'native-health':null,'journal-meta':{format:'banane-test-journal-v4',version:'4.9.0.18',state:{batch:null},v1TimingExport:null}}});
 await p.$('native-download').onclick();await p.attendre();
 return {p,statut:p.$('export-status').textContent,blobs:p.downloads,noms:[...noms.values()],acks,n};
}
test('parité d’export : « Télécharger à nouveau la session » écrit des volumes zip ≤ limite, CONTENU.txt Écho en heure de Paris, départs de la partie relue, acquittement final',async()=>{
 const r=await exportEcho({zipMaxBytes:60000});const N=r.blobs.length;assert.ok(N>=2,'plusieurs volumes : '+N+' — '+r.statut);
 assert.doesNotMatch(r.statut,/incomplet/,r.statut);assert.match(r.statut,new RegExp(`Session Écho : ${N} volumes zip`));
 r.noms.forEach((nom,i)=>assert.match(nom,new RegExp(`^ariane-echo-partie7-[0-9T-]+-volume${String(i+1).padStart(2,'0')}-sur${String(N).padStart(2,'0')}\\.zip$`),nom));
 assert.equal(r.acks.filter(a=>a.final===true).length,1,'l’export final confirmé est acquitté une fois');
 const dossier=tmp();for(const [i,b] of r.blobs.entries())fs.writeFileSync(path.join(dossier,r.noms[i]),Buffer.from(await b.arrayBuffer()));
 const entrees=Volumes.entrees(dossier);const contenus=fs.readdirSync(dossier).map(f=>Volumes.entreesZip(path.join(dossier,f)).find(e=>e.nom==='CONTENU.txt').lire().toString('utf8'));
 for(const [i,c] of contenus.entries()){assert.ok(r.blobs[i].size<=60000,`volume ${i+1} : ${r.blobs[i].size} octets`);
  assert.match(c,/^Export Ariane — mode Écho \(relecture\) — \d\d\/\d\d\/\d{4} \d\d:\d\d:\d\d heure de Paris/);assert.match(c,new RegExp(`^Volume ${i+1} sur ${N} : `,'m'));
  assert.match(c,/Session Écho echo-1 · version 4\.9\.0\.18 · 8 visite\(s\) · partie\(s\) 7 · du 15\/10\/2026 09:30:00 heure de Paris au 15\/10\/2026 10:10:00 heure de Paris/);
  assert.match(c,/Départs des parties \(1\)/);assert.match(c,/partie 7 · validés 800 · invalides 66 · total 866/);assert.doesNotMatch(c,/partie 24/);assert.match(c,/merge-segments/);}
 assert.ok(entrees.every(e=>/^ariane-echo-.*-seg\d\d\.json$/.test(e.nom)),entrees.map(e=>e.nom).join());
 const merged=Segments.mergeFiles(entrees).merged;assert.equal(merged.clouds.length,r.n);assert.equal(merged.records.length,r.n);assert.equal(merged.mergeTrace.allDeclaredPresent,true);
 assert.ok(merged.events.some(e=>e.type==='esv-observation'),'l’écriture ESV taguée est dans l’export Écho');assert.ok(!merged.events.some(e=>e.type==='proposed'),'rien d’Orbite');
 assert.equal(Segments.loadSession(dossier).clouds.length,r.n,'loadSession lit un dossier de volumes zip');
});
test('export Écho : un volume non confirmé par le navigateur = export incomplet, aucun acquittement final',async()=>{
 const r=await exportEcho({zipMaxBytes:60000,etat:'interrupted'});assert.match(r.statut,/Export Écho incomplet/);assert.equal(r.acks.filter(a=>a.final===true).length,0);
});
test('KI-068 : le journal d’Orbite exporté par le panneau ne porte plus les visites ni les événements d’Écho, et le dit',async()=>{
 const events=[{eventId:'a',type:'proposed',eventSeq:1,timestamp:'2026-10-15T07:00:00.000Z'},{eventId:'b',type:'native-state-observed',nativeSessionId:'echo-1',eventSeq:2},{eventId:'c',type:'esv-observation',kind:'write',nativeSessionId:'echo-1'}];
 const records=[{recordId:'lot-r1',identity:{part:7,cut:1}},{recordId:'v1',nativeSessionId:'echo-1',railSnapshots:{left:[],right:[]}}];
 const store={all:async t=>structuredClone(t==='events'?events:t==='records'?records:[]),keys:async()=>[],getCloud:async()=>null};
 const globals={BananeStorage3:class{constructor(){return store;}},BananeExportCache:EC,BananeNativeExport:X,BananeZip:Z,BananeSettings:Settings};
 const state={current:{identity:{part:7,cut:1}},batch:{state:'STOPPED',scope:{part:7,start:1,end:5},processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:null},records:[],incomplete:[]};
 const p=await panneau(state,{globals,reponses:{'journal-meta':{format:'banane-test-journal-v4',version:'4.9.0.18',state:{batch:state.batch}}}});
 await p.$('journal').onclick();await p.attendre();const doc=JSON.parse(await p.downloads.at(-1).text());
 assert.deepEqual(doc.events.map(e=>e.eventId),['a']);assert.deepEqual(doc.records.map(r=>r.recordId),['lot-r1']);assert.equal(doc.exportScope.excludedEchoItems,3);assert.equal(doc.exportScope.rule,'KI-068');
});
test('lire-volumes : un zip écrit par src/zip-writer.js se relit entrée par entrée (stored et deflate), CONTENU.txt ignoré des entrées JSON',async()=>{
 for(const methode of ['stored','deflate']){const z=Z.createZip({date:new Date(Date.UTC(2026,9,15)),methode});const texte='{"p":['+Array.from({length:3000},(_,i)=>i/3).join(',')+']}';
  await z.ajouter('a-seg01.json',new Blob([texte]));await z.ajouter('CONTENU.txt',new Blob(['x']));const f=path.join(tmp(),'v.zip');fs.writeFileSync(f,Buffer.from(await z.terminer().arrayBuffer()));
  const e=Volumes.entrees(f);assert.deepEqual(e.map(x=>x.nom),['a-seg01.json']);assert.equal(e[0].lire().toString('utf8'),texte);assert.equal(e[0].chemin,f+'#a-seg01.json');}
});
