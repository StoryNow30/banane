'use strict';
/* 5.0 — ÉCHO : RELEVÉ DES GLISSERS ET DES CRANS DE MOLETTE DE L'OPÉRATEUR (observation pure, pour copier son geste avant que
 * « déplacer la vue » soit activé). Un événement `operator-gesture` par glisser et par série de crans : longueur, direction,
 * durée, bouton, clic final, crans, caméra avant et après. Il ne compte pas comme un geste de correction (la pose de départ,
 * les lectures, les intentions de la visite sont inchangées), il n'empêche ni ne retarde rien, et il ne garde aucune position. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Observer}=require('../src/native-page.js'),{Sessions}=require('../src/native-session.js'),{Engine}=require('../src/engine.js');
const {K,base,MemoryStore}=require('./fixtures.cjs'),S=require('../src/settings.js'),{page}=require('./helpers/vue-page.cjs');
const flush=async(n=8)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
const GESTE={version:'gestes-vue-v1',type:'glisser',bouton:0,boutons:1,pointeur:'mouse',dxPx:-120,dyPx:4,distancePx:120.1,longueurPx:121,pas:18,dureeMs:310,clic:true,auxclic:false,
 menuContextuel:false,annule:false,finHorsVue:false,camera:{avant:{mmPx:.524,vue:[763,943]},apres:{mmPx:.524,vue:[763,943]},stable:true,deplacementMm:[62.9,-2.1,0],zoom:1},debutMs:1234};

test('le relevé est un réglage de l\'Écho, actif (observation seule), et se coupe',()=>{
 assert.equal(S.echo.gestesVue,true);
});

/* ---------- observateur de page ---------- */
function observateur(){let state={identity:{pageId:'p1',part:23,cut:100,shape:'U50',frameId:'f1',projectId:null},rails:K.clone(base.rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[]};
 let handler=null;const sent=[];let observes=0;
 const api={snapshot:()=>{observes++;return K.clone(state);},capture:async()=>{throw Error('passive-lidar-read-cancelled');},send:async(type,payload)=>{sent.push({type,payload});return {saved:true};},
  now:()=>0,performanceNow:()=>0,interval:()=>1,clearInterval(){},defer:fn=>queueMicrotask(fn),install:fn=>{handler=fn;},uninstall(){},editable:t=>t?.kind==='input',targetKind:t=>t?.kind||'other',signalFailure(){}};
 const o=new Observer(api);return {o,sent,observes:()=>observes,handler:()=>handler,start:()=>o.start({sessionId:'s',observationPeriodId:'p'})};}
test('Observer : un résumé de geste devient UN `operator-gesture`, sans compter comme geste de correction ni relancer l\'observation',async()=>{
 const f=observateur();await f.start();await flush();const avant=f.observes();
 f.handler()({type:'geste-vue',isTrusted:true,target:{kind:'canvas'},geste:GESTE});await flush();
 const g=f.sent.filter(x=>x.type==='operator-gesture');assert.equal(g.length,1);
 assert.deepEqual(g[0].payload.geste,GESTE);assert.ok(g[0].payload.visitId);assert.equal(g[0].payload.identity.cut,100);
 assert.equal(f.sent.filter(x=>x.type==='operator-event').length,0,'pas un operator-event');
 assert.equal(f.o.current.operatorInputs??0,0,'pas un geste de correction');assert.equal(f.observes(),avant,'aucune observation relancée');
 assert.ok(!('stateObservedBeforeInput' in g[0].payload),'poids sobre : pas d\'état cloné');
 /* Un résumé non fiable est ignoré, comme tout événement synthétique. */
 f.handler()({type:'geste-vue',isTrusted:false,geste:GESTE});await flush();assert.equal(f.sent.filter(x=>x.type==='operator-gesture').length,1);
});

/* ---------- session ---------- */
async function session(){
 const store=new MemoryStore();store.all=async name=>name==='clouds'?[...store.clouds.values()]:store[name];store.keys=async()=>[...store.clouds.keys()];
 const adapter={state:async()=>null,nativeStart:async()=>({active:true}),nativePause:async()=>({metrics:{}}),nativeResume:async()=>({active:true}),nativeFinish:async()=>({metrics:{}})};
 const engine=new Engine(adapter,store);await engine.init();const sessions=new Sessions(engine,adapter,store);await sessions.init();await sessions.start();
 const st={identity:{pageId:'a',part:23,cut:100,shape:'U50',frameId:'fa',projectId:null},rails:K.clone(base.rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],
  viewObservation:{status:'observed',viewEpochId:'v'},geominfo:{status:'not-observed',raw:null,source:null}};
 const ctx=()=>({sessionId:engine.s.native.id,observationPeriodId:engine.s.native.currentPeriodId});
 return {store,engine,sessions,st,ctx};
}
test('session : le geste est consigné au journal et rangé dans la visite (au plus 32, avec un compte) ; la visite est classée comme avant',async()=>{
 const temoin=await session(),f=await session();
 for(const x of [temoin,f])await x.sessions.receive('visit-started',{...x.ctx(),visitId:'v1',identity:x.st.identity,initialObserved:x.st});
 for(let i=0;i<40;i++)await f.sessions.receive('operator-gesture',{...f.ctx(),visitId:'v1',identity:f.st.identity,geste:{...GESTE,type:i%2?'molette':'glisser',crans:i%2?2:undefined}});
 for(const x of [temoin,f])await x.sessions.receive('visit-ended',{...x.ctx(),visitId:'v1',identity:x.st.identity,finalObserved:x.st,reason:'target-changed',nextIdentity:{...x.st.identity,cut:101},endedAt:new Date().toISOString()});
 const r=f.store.records.find(x=>x.visitId==='v1'),t=temoin.store.records.find(x=>x.visitId==='v1');
 assert.equal(r.gestesVue.length,32);deq(r.gestesVueResume,{glissers:20,molettes:20,crans:40,gardes:32});
 const sans=x=>{const {gestesVue,gestesVueResume,...reste}=x;return reste;};
 for(const k of ['status','observedLabelCandidate','partialReasons','startPose','operatorEvents','operatorIntents','geometryEligibility'])deq(sans(r)[k],sans(t)[k],k+' inchangé');
 assert.equal(f.store.events.filter(e=>e.type==='native-operator-gesture').length,40,'consigné au journal');
 /* Sans visite : consigné, rien rangé. */
 await f.sessions.receive('operator-gesture',{...f.ctx(),visitId:null,identity:null,geste:GESTE});
 assert.equal(f.store.events.filter(e=>e.type==='native-operator-gesture').length,41);
});
function deq(a,b,m){assert.deepEqual(JSON.parse(JSON.stringify(a??null)),JSON.parse(JSON.stringify(b??null)),m);}

/* ---------- page réelle (adaptateur en VM) ---------- */
test('page : pendant une session Écho, un vrai glisser sur la vue devient un résumé ; écouteurs passifs, rien n\'est empêché ; retirés à la fin',async()=>{
 const f=page({navigation:{}});
 await f.call('nativeStart',{sessionId:'s',observationPeriodId:'p'});await flush();
 const ecoutes=['pointerdown','pointermove','pointerup','wheel'].map(t=>(f.fenetre.get(t)||[]).length);assert.ok(ecoutes.every(n=>n>=1),'écouteurs posés : '+ecoutes);
 let empeche=0;const vrai=(type,o)=>({type,isTrusted:true,pointerId:1,pointerType:'mouse',preventDefault(){empeche++;},stopPropagation(){empeche++;},stopImmediatePropagation(){empeche++;},...o});
 /* La suite d'un vrai glisser (relevée sur Chromium) : pointeur puis souris à chaque étape, click final. */
 const deux=(p,m,o)=>{f.canvas.dispatchEvent(vrai(p,o));f.canvas.dispatchEvent(vrai(m,{...o,button:p==='pointermove'?0:o.button}));};
 deux('pointerdown','mousedown',{button:0,buttons:1,clientX:600,clientY:500});
 for(let i=1;i<=6;i++)deux('pointermove','mousemove',{button:-1,buttons:1,clientX:600-20*i,clientY:500});
 deux('pointerup','mouseup',{button:0,buttons:0,clientX:480,clientY:500});f.canvas.dispatchEvent(vrai('click',{button:0,clientX:480,clientY:500}));
 for(let i=0;i<30;i++)await flush(2);
 const g=f.natifs.filter(m=>m.type==='operator-gesture').map(m=>m.payload.geste);
 assert.equal(g.length,1,JSON.stringify(f.natifs.map(m=>m.type)));assert.equal(g[0].type,'glisser');deq([g[0].dxPx,g[0].pas,g[0].clic],[-120,6,true]);
 assert.ok(Math.abs(g[0].camera.deplacementMm[0]-60)<.5,'le modèle a fait glisser la vue de 120 px × 0,5 mm : '+g[0].camera.deplacementMm);
 assert.equal(empeche,0,'rien n\'est empêché ni arrêté');
 await f.call('nativeFinish');await flush();
 assert.ok(['pointerdown','pointermove','pointerup','wheel'].every(t=>!(f.fenetre.get(t)||[]).length),'écouteurs retirés');
});
test('page : relevé coupé dans les réglages → aucun écouteur de geste',async()=>{
 const f=page({settings:{echo:{...S.echo,gestesVue:false}}});
 await f.call('nativeStart',{sessionId:'s',observationPeriodId:'p'});await flush();
 assert.ok(['pointerdown','wheel'].every(t=>!(f.fenetre.get(t)||[]).length));await f.call('nativeFinish');
});
