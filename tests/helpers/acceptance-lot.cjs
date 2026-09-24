'use strict';
/* Lot Pilote et relecture Natif SYNTHÉTIQUES pour `tools/acceptance-report.cjs`.
 * Aucune donnée terrain : rails droits, rotation identité (x le long de la
 * voie, y latéral, z vertical), écartement 1 435 mm. Seuls les champs que
 * l'outil lit sont construits, avec les règles strictes de `referenceFor`. */
const C=require('../../vendor/capture-core.js');
const SIDES=['left','right'],PAGE='page-synthetique',T0=Date.parse('2026-10-01T08:00:00.000Z');
const at=ms=>new Date(T0+ms).toISOString();
const identity=(part,cut,frameId)=>({pageId:PAGE,part,cut,shape:'U50',frameId,projectId:null});
function rail(p){const M=C.translation(p);return {positionSceneRelative:p.slice(),profileOriginSceneRelative:p.slice(),
  railLocalToSceneRelative:M,profileLocalToSceneRelative:M,sceneRelativeToProfileLocal:C.inverse(M)};}
/* Paire de rails au cut `cut` ; `d` : décalages en mm, {left:[lat,vert],right:[lat,vert]} ; `T` : translation du repère (m). */
function pair(cut,d={},T=[0,0,0],gaugeMm=1435){
  const at=(side,y)=>{const [lat,vert]=d[side]||[0,0];return rail([cut+T[0],y+lat/1000+T[1],vert/1000+T[2]]);};
  return {left:at('left',0),right:at('right',gaugeMm/1000)};
}
const positions=rails=>Object.fromEntries(SIDES.map(s=>[s,rails[s].positionSceneRelative.slice()]));
const cutId=(part,cut,frameId)=>[PAGE,part,cut,'U50',frameId,'not-observed'].join('|');
/* Un cut du lot. outcome : applied | deferred | gauge | noinput | none (atteint sans observation). */
function pilotCut(part,cut,{outcome='applied',frameId='cadre-pilote',applied=null,start=null,visits=1,gaugeMm=1300,lotObservation,motif='ambiguity'}={}){
  const id=identity(part,cut,frameId),before=start||pair(cut,{},[0,0,0],1500),out={id,before,visits};
  if(outcome==='none')return out;
  const next=ok=>({status:ok?'candidate':'unresolved',motif:ok?'candidate':motif});
  const refused=outcome==='gauge';
  out.observation={observationEventId:`obs-${part}-${cut}`,identity:id,timestamp:at(cut*1000),batchId:'lot-synthetique',
    lidar:{captureId:`capture-${cut}`},error:null,
    rails:Object.fromEntries(SIDES.map(s=>[s,{scientificRail:outcome==='noinput'?{ok:false,reason:'Aucun point LiDAR disponible.'}:{ok:true,next:next(outcome==='applied')}}])),
    summary:{pairGaugeRejected:refused,pairGaugeMm:refused?gaugeMm:null,pairGaugeClass:refused?(gaugeMm<1405?'LOW_INVALID':'HIGH_INVALID'):null},
    runtime:outcome==='applied'?{apply:{observed:{identity:id,rails:applied||pair(cut)}},validationAccepted:{type:'validation-accepted'},deferral:null}
      :{apply:null,validationAccepted:null,deferral:{status:'DEFERRED_UNRESOLVED',confirmed:true,
        railsAtDeferral:Object.fromEntries(SIDES.map(s=>[s,{gcv1:{motif:outcome==='noinput'?'input':refused?'gauge-out-of-contract':motif}}]))}}};
  if(lotObservation!==undefined)out.observation.lotObservation=lotObservation;
  return out;
}
/* Le lot : diagnostic GCV1 et journal du Pilote. `stoppedOn` : cut actif d'un lot arrêté. */
function pilotLot(part,cuts,{stoppedOn=null}={}){
  const batch={id:'lot-synthetique',state:stoppedOn?'STOPPED':'COMPLETED',scope:{part,start:cuts[0].id.cut,end:cuts.at(-1).id.cut,unresolvedPolicy:'defer'},
    startedAt:at(0),processed:[],activeIdentity:stoppedOn?identity(part,stoppedOn,cuts[0].id.frameId):null};
  const events=[],records=[],deferredCuts=[];
  for(const c of cuts){
    for(let v=0;v<c.visits;v++)events.push({type:'before-captured',identity:c.id,timestamp:at(c.id.cut*1000+v)});
    if(c.observation){records.push({identity:c.id,before:{identity:c.id,rails:c.before,capturedAt:at(c.id.cut*1000)}});
      if(c.observation.runtime.apply)batch.processed.push({identity:c.id});else deferredCuts.push(cutId(part,c.id.cut,c.id.frameId));}
  }
  return {diagnostic:{format:'banane-gcv1-diagnostic-v1',version:'4.7.8',observationCount:cuts.filter(c=>c.observation).length,
      observations:cuts.filter(c=>c.observation).map(c=>c.observation)},
    journal:{format:'banane-test-journal-v4',version:'4.7.8',state:{batch},events,records,
      closureSummary:{completed:batch.processed.length,deferred:deferredCuts.length,deferredCuts}}};
}
/* Une visite de relecture. `final` : pose humaine ; `intents` : ['VALIDATE'] par défaut. */
let seq=1000;
function visit(part,cut,{frameId='cadre-relecture',before,final=null,intents=['VALIDATE'],index=0}={}){
  const id=identity(part,cut,frameId),t=cut*1000+100000+index*20000,eventSeq=++seq;
  const record={recordId:`visite-${part}-${cut}-${index}`,visitId:`v-${cut}-${index}`,visitIndex:index,identity:id,
    beforeEstablished:{identity:id,rails:before,capturedAt:at(t)},endedAt:at(t+9000),operatorIntents:[],multiIntent:intents.length>1};
  const state={identity:id,rails:final||before,capturedAt:at(t+2000)};
  record.finalObserved=state;
  record.operatorIntents=intents.map((intent,i)=>({intent,observedAt:at(t+2500+i),eventSeq:eventSeq+i,stateObservedBeforeInput:state}));
  if(intents.includes('VALIDATE'))record.humanFinalReference={status:'candidate-observed',state,observedAt:at(t+2500),eventSeq,
    association:{identityMatched:true,stateCapturedAt:state.capturedAt,freshnessMs:500}};
  return record;
}
const relecture=records=>({format:'banane-native-session-v2',session:{id:'relecture-synthetique'},records,events:[],clouds:[]});
module.exports={SIDES,identity,rail,pair,positions,pilotCut,pilotLot,visit,relecture};
