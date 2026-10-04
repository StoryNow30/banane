'use strict';
// Données exclusivement synthétiques : aucune géométrie ni aucun export opérateur.
function fixture(mode='idle') {
 const s={current:{identity:{project:'U2-SYNTHETIQUE',part:1,cut:10}},busy:false,
   manual:null,native:null,batch:null,notice:'État synthétique U2',intent:null,reconcileRequired:false};
 if(['running','paused','error','unresolved','completed'].includes(mode)) s.batch={
   id:'U2-LOT-SYNTHETIQUE',state:{running:'RUNNING',paused:'PAUSED',error:'ERROR',unresolved:'PAUSED_UNRESOLVED_RAIL',completed:'COMPLETED'}[mode],
   step:mode==='unresolved'?'apply':'capture',pauseReason:mode==='unresolved'?'unresolved-rail':null,
   scope:{part:1,start:10,end:20,unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1',lowConfidence:'attempt'},
   activeIdentity:{project:'U2-SYNTHETIQUE',part:1,cut:10},processed:[],skipped:[],deferred:[],paused:[],interrupted:[],manuallyCompleted:[],sequence:[],lotCommands:{}};
 if(mode==='busy')s.busy=true;
 if(mode==='native-running')s.native={id:'U2-ECHO-SYNTHETIQUE',status:'RUNNING',visits:[],incomplete:[],message:'Observation synthétique U2'};
 if(mode==='native-paused')s.native={id:'U2-ECHO-SYNTHETIQUE',status:'PAUSED',visits:[],incomplete:[],message:'Pause synthétique U2'};
 return s;
}
// Installé AVANT panel.js, dans la vraie page chrome-extension://.../panel.html.
// Seule sendMessage est remplacée. connect, DOM, CSS et moteur JS sont réels.
function installer(initial) {
 const copie=x=>JSON.parse(JSON.stringify(x));
 const backend=globalThis.__u2={synthetic:true,state:copie(initial),calls:[],errors:{},views:0,
   replace(s){this.state=copie(s);},fail(action,message){this.errors[action]=message;}};
 if(!globalThis.chrome?.runtime?.id)throw Error('U2 : origine extension absente');
 const send=async message=>{
   if(message?.kind!=='panel')throw Error('U2 : aucun message hors double autorisé');
   const {action,args}=message;backend.calls.push({action,args:copie(args||{})});
   if(backend.errors[action])return {error:backend.errors[action]};
   const s=backend.state;let result={};
   switch(action){
    case 'view':backend.views++;result=copie(s);break;
    case 'list-tabs':result=[];break; // aucun onglet ESV, réel ou simulé
    case 'bandeau-etat':result={on:false};break;
    case 'bornes-partie':result={last:null,source:null};break;
    case 'native-health':case 'native-quality':result=null;break;
    case 'native-export-advice':result={advised:false};break;
    case 'settings':case 'bandeau':break;
    case 'start':s.batch=copie(initial.__running);break;
    case 'pause':s.batch.state='PAUSED';s.notice='Pause synthétique U2';break;
    case 'resume':s.batch.state='RUNNING';break;
    case 'stop':s.batch.state='STOPPED';break;
    case 'retry':s.batch.state='RUNNING';break;
    case 'native-start':s.native={id:'U2-ECHO-SYNTHETIQUE',status:'RUNNING',visits:[],incomplete:[]};break;
    case 'native-pause':s.native.status='PAUSED';break;
    case 'native-resume':s.native.status='RUNNING';break;
    default:return {error:'U2 : action non simulée '+action};
   }
   return {result};
 };
 chrome.runtime.sendMessage=send;
 if(chrome.runtime.sendMessage!==send)throw Error('U2 : double non installé');
}
module.exports={fixture,installer};
