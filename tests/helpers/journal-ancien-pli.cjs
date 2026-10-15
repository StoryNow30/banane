'use strict';
/* Journal « ancien format » fabriqué pour les essais du repli des jalons `phase-timing` (S7, 4.9.5.3) : un jalon par événement, contexte
 * recopié à chaque fois, identifiants tirés au hasard, ordre mélangé (celui de la base). Mêmes formes que le journal d'un vrai lot
 * (sorte `visit`, `point`, `span`, `request`, `batch`, `health`), sans aucune donnée réelle. Déterministe (graine fixe). */
const {id}=require('./perf-phases.cjs');
function graine(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function uuid(r){const h=n=>Array.from({length:n},()=>Math.floor(r()*16).toString(16)).join('');return `${h(8)}-${h(4)}-4${h(3)}-8${h(3)}-${h(12)}`;}
function journalAncien({visites=12,seed=7}={}){
 const r=graine(seed),events=[],batchId='lot-1',sessionId='session-1',clockId='horloge-1',timeOrigin=1792057644728.1;
 let seq=0,bseq=0,t=100000;
 const make=(ctx,kind,ms,detail={})=>({eventId:uuid(r),timestamp:new Date(timeOrigin+ms+Math.floor(r()*3)).toISOString(),type:'phase-timing',schema:1,clockId,timeOrigin,
  seq:++seq,batchSeq:++bseq,ms,kind,...ctx,...detail});
 const lot={sessionId,batchId,visitId:null,identity:null};
 events.push(make(lot,'batch',t-5,{point:'start',knownBoundary:true,segment:1}));
 const sequence=[];
 for(let v=0;v<visites;v++){
  const cut=1000+v,visitId=uuid(r),ident=id(cut),sequenceId={identity:ident};sequence.push(sequenceId);
  const base={sessionId,batchId,visitId,identity:ident,captureId:null,analysisId:null,proposalId:null,selector:'active-pilot-test'};
  const cap=uuid(r),ana=uuid(r),prop=uuid(r),avecCapture={...base,captureId:cap},avecAnalyse={...avecCapture,analysisId:ana},avecProp={...avecAnalyse,proposalId:prop};
  const dernier=v===visites-1,diff=v%5===4;   // un cut sur cinq est différé : pas de pose
  const t0=t;
  events.push(make(base,'visit',t0,{point:'open',navigationMs:t0,navigationReason:'observed-target'}));
  const req=(ctx,at,stage)=>events.push(make(ctx,'request',at,{point:'progress',commandId:uuid(r),pageRequestId:uuid(r),stage}));
  req(base,t0+5,'capture-wait');req(base,t0+900,'capture-read');
  events.push(make(base,'span',t0+1000,{label:'command:capture',fromMs:t0+3,toMs:t0+1000,commandId:uuid(r),pageRequestId:uuid(r),success:true}));
  events.push(make(avecCapture,'point',t0+1001,{point:'capture-received',atMs:t0+1000,commandId:uuid(r)}));
  events.push(make(avecCapture,'point',t0+1030,{point:'capture-stored'}));
  events.push(make(avecAnalyse,'span',t0+1100,{label:'v46-pair-complete',fromMs:t0+1040,toMs:t0+1100,success:true,side:null,inputKind:'initial',inputId:uuid(r),inputIdentity:ident,options:{minConfidence:50,searchY:0.08}}));
  events.push(make(avecAnalyse,'span',t0+1101,{label:'v46-scientific',fromMs:t0+1060,toMs:t0+1101,success:true,side:'left',inputKind:'initial',inputId:uuid(r),inputIdentity:ident,options:null}));
  events.push(make(avecProp,'point',t0+1150,{point:'proposed'}));
  /* Le jalon `decision` porte son propre `selector` (différent du contexte) : le repli doit le restituer sans le garder pour la suite. */
  events.push(make(avecProp,'point',t0+1160,{point:'decision',selector:'moteur',selectedEngine:'geometry-candidate-v1'}));
  events.push(make(avecProp,'span',t0+1165,{label:'observe-lot',fromMs:t0+1160,toMs:t0+1165,success:true}));
  if(!diff){
   events.push(make(avecProp,'point',t0+1300,{point:'pose-readback'}));
   events.push(make(avecProp,'span',t0+1350,{label:'after-state-read',fromMs:t0+1320,toMs:t0+1350,commandId:uuid(r)}));
   events.push(make(avecProp,'point',t0+1351,{point:'after-read',atMs:t0+1350,commandId:uuid(r)}));
   events.push(make(avecProp,'point',t0+1500,{point:'accepted',validationAttemptId:uuid(r),validationProof:'navigation-only'}));
  }else events.push(make(avecProp,'point',t0+1500,{point:'deferred',reason:'defer-finalized'}));
  req(avecProp,t0+1510,'navigation-observed');
  events.push(make(avecProp,'point',t0+1600,{point:'next-observed',atMs:t0+1600,nextIdentity:dernier?null:id(cut+1)}));
  t=t0+1700+Math.floor(r()*200);
 }
 events.push(make(lot,'batch',t+5,{point:'end',knownBoundary:true,state:'COMPLETED',segment:1}));
 events.push(make(lot,'health',t+6,{emitted:events.length,lost:0,visits:visites,bytes:1,maxEventBytes:1,pendingPeak:1,instrumentationMs:1,finalSnapshot:true,requestsPending:0}));
 /* Autres événements du journal, laissés tels quels par le repli. */
 events.push({eventId:uuid(r),timestamp:new Date(timeOrigin+t).toISOString(),type:'batch-started',batch:{id:batchId}});
 events.push({eventId:uuid(r),timestamp:new Date(timeOrigin+t+1).toISOString(),type:'esv-observation',schema:1,kind:'write',status:204});
 for(let i=events.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[events[i],events[j]]=[events[j],events[i]];}   // ordre de la base : aléatoire
 return {format:'banane-test-journal-v4',version:'4.9.5.2',state:{sessionId,batch:{id:batchId,sequence}},events,records:[]};
}
module.exports={journalAncien};
