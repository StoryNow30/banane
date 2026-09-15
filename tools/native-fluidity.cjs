const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const {Observer}=require('../src/native-page.js'),K=require('../src/core.js');
const root=path.resolve(__dirname,'..'),base=JSON.parse(fs.readFileSync(path.join(root,'tests/corpus/banane-lidar-part-23-cut-2855-1788941885642.json')));
const wait=()=>new Promise(resolve=>setImmediate(resolve));
async function scenario(name,count,batchSize){let handler,timer,prevented=0,stopped=0,eventsSaved=0;
 const state={identity:{pageId:'fluidity-page',part:23,cut:100,shape:'U50',frameId:'fluidity-frame',projectId:null},rails:K.clone(base.rails),
  capturedAt:new Date().toISOString(),status:'complete',partialReasons:[],viewObservation:{status:'observed',viewEpochId:'fluidity-view'},geominfo:{status:'not-observed',raw:null,source:null}};
 const api={snapshot:()=>K.clone(state),capture:async(expected,active,request)=>{for(const side of ['left','right'])await request.onCheckpoint({format:'banane-native-lidar-chunk-v1',
    chunkId:`${request.captureId}:${side}:0`,captureId:request.captureId,visitId:request.visitId,side,identity:K.clone(expected.identity),rail:K.clone(expected.rails[side]),
    pointsSceneRelative:Array.from({length:128},(_,i)=>[i/1000,0,0]),pointsProfileLocal:Array.from({length:128},(_,i)=>[i/1000,0,0])});
   return {format:'banane-native-lidar-capture-v2',captureId:request.captureId,identity:K.clone(expected.identity),railObservations:Object.fromEntries(['left','right'].map(side=>[side,
    {side,rail:K.clone(expected.rails[side]),pointsRetained:128,coverage:{status:'qualified-candidate'},transform:{valid:true},associationStatus:'same-target-and-rail-pose'}])),
    trace:{pointsCheckpointed:256,pointsSaved:0,pointsExported:0},status:'complete-loaded-buffers'};},
  send:async(type,payload)=>{eventsSaved++;return {saved:true,...(type==='capture-checkpoint'?{chunkId:payload.chunk.chunkId,storageConfirmedAt:new Date().toISOString()}: {})};},
  now:()=>Date.now(),performanceNow:()=>performance.now(),interval:fn=>{timer=fn;return 1;},clearInterval:()=>{timer=null;},
  defer:()=>{},install:fn=>{handler=fn;},uninstall:()=>{handler=null;},editable:()=>false,targetKind:()=> 'canvas',signalFailure:()=>{}};
 const observer=new Observer(api,{maxQueue:256,highWater:180,pollMs:125}),heapBefore=process.memoryUsage().heapUsed;
 await observer.start({sessionId:'fluidity-session-'+name,observationPeriodId:'period-1'});await wait();const began=performance.now();
 const event={type:'pointerdown',isTrusted:true,target:{},preventDefault(){prevented++;},stopPropagation(){stopped++;},stopImmediatePropagation(){stopped++;}};
 for(let i=0;i<count;i++){handler(event);if((i+1)%batchSize===0)await wait();}
 const dispatchDurationMs=performance.now()-began;await observer.finish();const heapAfter=process.memoryUsage().heapUsed;
 return {name,inputEvents:count,batchSize,dispatchDurationMs,eventsPerSecond:count/Math.max(.001,dispatchDurationMs/1000),
  prevented,stopped,syntheticEventsDispatched:0,nativeCommandsSentByBanane:0,eventsSaved,heapDeltaBytes:heapAfter-heapBefore,collector:observer.metricSnapshot(),timerReleased:timer===null};
}
async function run(){const report={format:'banane-native-fluidity-v1',version:K.VERSION,generatedAt:new Date().toISOString(),environment:{runtime:process.version,platform:process.platform,
   scope:'Simulation Node hors ESV ; mesure du coût synchrone de l’observateur et de sa contre-pression, pas du rendu Edge/Potree.'},
  scenarios:[await scenario('paced',1000,10),await scenario('burst',5000,5000)],limits:[
   'Aucune page ESV réelle, aucun rendu WebGL et aucun IndexedDB réel ne sont présents dans cette mesure.',
   'La mémoire Node est une approximation de contrôle de borne, pas une mesure de la mémoire de l’extension dans Edge.',
   'La validation terrain doit comparer la fluidité ESV avec Natif inactif puis actif sur le même parcours.'
  ]};
 const out=path.join(root,`audit/native-fluidity-v${K.VERSION}.json`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));return report;}
if(require.main===module)run().then(report=>console.log(JSON.stringify(report,null,2)),e=>{console.error(e);process.exitCode=1;});
module.exports={run};
