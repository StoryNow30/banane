(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BananeCore3,
  typeof module==='object'?require('./settings.js'):root.BananeSettings);
 if(typeof module==='object')module.exports=api;else root.BananeNativePage4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(K,S){
 'use strict';
 const quantile=(values,p)=>{if(!values.length)return 0;const a=values.slice().sort((x,y)=>x-y),i=Math.min(a.length-1,Math.floor(p*a.length));return a[i];};
 /* V4.5-R — refus définitifs par conception.
  *
  * La session refuse volontairement certains envois : un checkpoint dont le cut
  * a changé entre le début de la capture et son arrivée, un identifiant de bloc
  * déjà utilisé (copie immuable non remplacée), une visite inconnue. Aucun de
  * ces refus ne réussira jamais au réessai.
  *
  * Avant, ils étaient traités comme des pannes de transport : réessais répétés
  * en tête de file, puis bascule en METADATA_ONLY. Sur la session
  * 1789370906681, `Cible différente : cut` apparaît 18 fois et deux échecs
  * d'envoi ont suffi à couper le LiDAR pour toute la session, saturer la file à
  * 128 et perdre 196 événements.
  *
  * Désormais ils sont écartés immédiatement avec leur cause, et surtout ils ne
  * comptent pas comme une panne de collecteur : un rejet légitime ne doit pas
  * dégrader la collecte. Le repli reste le réessai borné si le motif n'est pas
  * reconnu, donc aucun cas n'est perdu de vue. */
 const PERMANENT_REFUSALS=[
  /^Cible différente/,
  /déjà utilisé/,
  /associé à une autre visite/,
  /Côté de capture Natif invalide/,
  /ne correspond à aucun enregistrement conservé/,
  /Événement Natif inconnu/,
  /n’est plus active|n'est plus active/,
 ];
 const permanentRefusal=message=>PERMANENT_REFUSALS.some(re=>re.test(String(message||'')));
 class Observer{
  /* Réglages : src/settings.js fait foi ; `options` reste prioritaire pour les
   * tests et pour un ajustement ponctuel. */
  constructor(api,options={}){this.api=api;const C=S.collector,D=S.derived;
   this.maxQueue=options.maxQueue||C.maxQueue;
   this.highWater=options.highWater||(options.maxQueue?Math.max(8,Math.floor(this.maxQueue*C.highWaterRatio)):D.highWater);
   this.lowWater=options.lowWater||(options.maxQueue?Math.max(4,Math.floor(this.maxQueue*C.lowWaterRatio)):D.lowWater);
   this.recoveryMs=options.recoveryMs||C.recoveryMs;
   this.maxItemAttempts=options.maxItemAttempts||C.maxItemAttempts;
   this.retryBackoffMs=options.retryBackoffMs||C.retryBackoffMs;
   this.retryBackoffMaxMs=options.retryBackoffMaxMs||C.retryBackoffMaxMs;
   this.failuresBeforeMetadataOnly=options.failuresBeforeMetadataOnly||C.failuresBeforeMetadataOnly;
   this.consecutiveFailures=0;this.lastFailureAt=0;
   this.maxCapturesPerVisit=options.maxCapturesPerVisit||C.maxCapturesPerVisit;
   this.maxCapturesPerVisitUnqualified=options.maxCapturesPerVisitUnqualified||C.maxCapturesPerVisitUnqualified;
   this.pollMs=options.pollMs||C.pollMs;this.queue=[];this.active=false;this.paused=false;this.flushing=false;this.retryAt=0;this.current=null;
   this.captureTask=null;this.generation=0;this.failureShown=false;this.collectorSeq=0;this.checkpointReceipts=new Map();this.metrics={enqueued:0,sent:0,dropped:0,sendFailures:0,
     queueDepthMax:0,handlerDurationsMs:[],captureCompleted:0,captureFailed:0,captureBudgeted:0,captureRefused:0,captureCheckpoints:0,degradationLevel:'FULL'};}
  now(){return this.api.now?this.api.now():Date.now();}
  metricSnapshot(){const d=this.metrics.handlerDurationsMs;return {enqueued:this.metrics.enqueued,sent:this.metrics.sent,dropped:this.metrics.dropped,
    sendFailures:this.metrics.sendFailures,queueDepth:this.queue.length,queueDepthMax:this.metrics.queueDepthMax,
    inputHandlerMs:{p50:quantile(d,.5),p95:quantile(d,.95),max:d.length?Math.max(...d):0,samples:d.length},
    captureCompleted:this.metrics.captureCompleted,captureFailed:this.metrics.captureFailed,captureBudgeted:this.metrics.captureBudgeted||0,captureRefused:this.metrics.captureRefused||0,captureCheckpoints:this.metrics.captureCheckpoints,degradationLevel:this.metrics.degradationLevel,
    degradationPeak:this.metrics.degradationPeak||this.metrics.degradationLevel,degradationEvents:this.metrics.degradationEvents||0,
    recoveries:this.metrics.recoveries||0,setAside:this.metrics.setAside||0,refused:this.metrics.refused||0,setAsideItems:(this.metrics.setAsideItems||[]).slice(0,32)};}
  setLevel(level){const order={FULL:0,DEGRADED:1,METADATA_ONLY:2};
   if(order[level]>order[this.metrics.degradationLevel]){this.metrics.degradationLevel=level;this.metrics.degradationEnteredAt=this.now();
    this.metrics.degradationEvents=(this.metrics.degradationEvents||0)+1;}
   if(order[level]>order[this.metrics.degradationPeak||'FULL'])this.metrics.degradationPeak=level;}
  /* V4.5-R — la dégradation redevient réversible.
   *
   * Avant : le niveau ne pouvait que monter. Un seul pic de file ou un seul
   * échec d'envoi faisait basculer définitivement en METADATA_ONLY, où toute
   * capture LiDAR est refusée. Le reste de la session perdait sa géométrie —
   * d'où les 88 `lidar-missing` et 18 `metadata-only-because-collector-overloaded`
   * mesurés sur la session de quarantaine 1789379943257.
   *
   * Maintenant : on redescend d'un cran quand la file est réellement retombée
   * ET qu'aucun échec récent n'a eu lieu. L'hystérésis (lowWater + recoveryMs)
   * évite le battement. Le pic atteint reste conservé pour le diagnostic :
   * la dégradation est expliquée, pas effacée. */
  relax(){
   if(this.metrics.degradationLevel==='FULL')return;
   if(this.queue.length>this.lowWater)return;
   const t=this.now();
   if(t-(this.lastFailureAt||0)<this.recoveryMs)return;
   if(t-(this.metrics.degradationEnteredAt||0)<this.recoveryMs)return;
   this.metrics.degradationLevel=this.metrics.degradationLevel==='METADATA_ONLY'?'DEGRADED':'FULL';
   this.metrics.degradationEnteredAt=t;this.metrics.recoveries=(this.metrics.recoveries||0)+1;}
  enqueue(type,payload={},essential=false){const item={type,payload:{sessionId:this.sessionId,observationPeriodId:this.periodId,collectorSeq:++this.collectorSeq,...payload},essential};
   this.metrics.enqueued++;
   if(this.queue.length>=this.maxQueue){this.setLevel('METADATA_ONLY');const replace=this.queue.findIndex(x=>!x.essential);
    if(essential&&replace>=0)this.queue.splice(replace,1);else{this.metrics.dropped++;return false;}this.metrics.dropped++;}
   else if(this.queue.length>=this.highWater)this.setLevel('DEGRADED');
   this.queue.push(item);this.metrics.queueDepthMax=Math.max(this.metrics.queueDepthMax,this.queue.length);void this.flush();return true;}
  /* V4.5-R — la file ne se fige plus sur un élément fautif.
   *
   * Avant : un seul envoi refusé bloquait la tête de file indéfiniment (retry
   * toutes les 2 s sur le même élément) et faisait basculer définitivement en
   * METADATA_ONLY. Un `chunkId` en doublon, que la session rejette par
   * conception, suffisait à perdre toute la suite de la collecte.
   *
   * Maintenant : réessais bornés par élément avec temporisation croissante,
   * puis mise à l'écart de l'élément fautif AVEC sa cause. La perte est
   * expliquée et comptée, jamais masquée, et la file repart. */
  async flush(){if(this.flushing)return this.flushPromise;
   // File vide : c'est justement le moment où le collecteur peut se rétablir.
   if(!this.queue.length){this.relax();return;}
   if(this.now()<this.retryAt)return;this.flushing=true;
   this.flushPromise=(async()=>{try{
     while(this.queue.length){
      const item=this.queue[0];
      try{
       const ack=await this.api.send(item.type,{...item.payload,collectorMetrics:this.metricSnapshot()});
       if(ack?.saved!==true)throw Error('Accusé de sauvegarde absent.');
       if(item.type==='capture-checkpoint'&&ack.chunkId===item.payload.chunk?.chunkId)this.checkpointReceipts.set(ack.chunkId,ack);
       this.queue.shift();this.metrics.sent++;this.consecutiveFailures=0;this.relax();
      }catch(e){
       // Un refus définitif n'est pas une panne : il sort tout de suite, sans
       // compter comme un échec de transport et sans dégrader le collecteur.
       if(permanentRefusal(e.message)){
        this.queue.shift();
        this.metrics.refused=(this.metrics.refused||0)+1;
        (this.metrics.setAsideItems??=[]).push({type:item.type,collectorSeq:item.payload?.collectorSeq??null,
          reason:e.message,attempts:(item.attempts||0)+1,permanent:true,observedAt:new Date().toISOString()});
        continue;
       }
       item.attempts=(item.attempts||0)+1;
       this.metrics.sendFailures++;this.lastFailureAt=this.now();
       this.consecutiveFailures=(this.consecutiveFailures||0)+1;
       if(item.attempts>=this.maxItemAttempts){
        this.queue.shift();
        this.metrics.setAside=(this.metrics.setAside||0)+1;
        (this.metrics.setAsideItems??=[]).push({type:item.type,collectorSeq:item.payload?.collectorSeq??null,
          reason:e.message,attempts:item.attempts,observedAt:new Date().toISOString()});
        continue;
       }
       this.setLevel(this.consecutiveFailures>=this.failuresBeforeMetadataOnly?'METADATA_ONLY':'DEGRADED');
       this.retryAt=this.now()+Math.min(this.retryBackoffMaxMs,this.retryBackoffMs*item.attempts);
       if(!this.failureShown){this.failureShown=true;this.api.signalFailure?.('Mode Natif : enregistrement interrompu. Les événements en attente sont conservés dans la limite de la file.');}
       break;
      }
     }}
    finally{this.flushing=false;this.flushPromise=null;}})();return this.flushPromise;}
  stateKey(state){const id=state?.identity||{};return K.identityFields.map(k=>id[k]??'not-observed').join('|');}
  railKey(state){return JSON.stringify(['left','right'].map(side=>{const r=state?.rails?.[side];return r?[r.railLocalToSceneRelative,r.profileLocalToSceneRelative]:null;}));}
  async start({sessionId,observationPeriodId}){if(this.active)throw Error('Le mode Natif est déjà actif dans ESV.');
   if(this.sessionId&&this.sessionId!==sessionId){this.queue=[];this.checkpointReceipts.clear();this.retryAt=0;this.failureShown=false;this.metrics={enqueued:0,sent:0,dropped:0,sendFailures:0,
     queueDepthMax:0,handlerDurationsMs:[],captureCompleted:0,captureFailed:0,captureBudgeted:0,captureRefused:0,captureCheckpoints:0,degradationLevel:'FULL'};this.collectorSeq=0;}
   this.sessionId=sessionId;this.periodId=observationPeriodId;this.active=true;this.paused=false;this.generation++;this.current=null;
   this.api.install(e=>this.input(e));this.timer=this.api.interval(()=>{void this.observe('poll');void this.flush();},this.pollMs);
   this.enqueue('period-started',{startedAt:new Date().toISOString()},true);await this.observe('period-start');
   return {active:true,observationPeriodId:this.periodId,metrics:this.metricSnapshot()};}
  input(event){if(!this.active||event.isTrusted===false)return;const began=this.api.performanceNow?this.api.performanceNow():this.now();
   const editable=this.api.editable?.(event.target)===true,targetKind=this.api.targetKind?.(event.target)||'other';
   const shiftOnly=!!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
   const validate=event.type==='keydown'&&shiftOnly&&(event.code==='Space'||event.key===' ')||event.type==='click'&&targetKind==='validation';
   const skip=event.type==='keydown'&&shiftOnly&&(event.code==='Backspace'||event.key==='Backspace');
   const intent=editable?null:skip?'SKIP':validate?'VALIDATE':null;
   const key=editable?null:(event.key?.length===1?'character':event.key||null);
   this.enqueue('operator-event',{visitId:this.current?.visitId||null,identity:this.current?.state?.identity||null,stateObservedBeforeInput:this.current?.state?K.clone(this.current.state):null,event:{type:event.type,
     code:editable?null:event.code||null,key,shiftKey:!!event.shiftKey,ctrlKey:!!event.ctrlKey,metaKey:!!event.metaKey,altKey:!!event.altKey,
     repeat:!!event.repeat,targetKind,editable,intent,observedAt:event.observedAt||new Date().toISOString(),
     eventTimeStamp:Number.isFinite(event.eventTimeStamp)?event.eventTimeStamp:null,
     stateCapturedAt:this.current?.state?.capturedAt||null}},!!intent);
   const elapsed=Math.max(0,(this.api.performanceNow?this.api.performanceNow():this.now())-began);this.metrics.handlerDurationsMs.push(elapsed);
   if(this.metrics.handlerDurationsMs.length>512)this.metrics.handlerDurationsMs.shift();
   this.api.defer?.(()=>{void this.observe(intent?'after-decision-input':'after-input');});
  }
  viewKey(state){return state?.viewObservation?.viewEpochId||'view-not-observed';}
  captureKey(state){return `${this.viewKey(state)}|${this.railKey(state)}`;}
  async observe(reason){if(!this.active)return;let state;
   try{state=this.api.snapshot();}catch(e){this.enqueue('observation-failed',{visitId:this.current?.visitId||null,reason:e.message,trigger:reason},true);return;}
   const identityKey=this.stateKey(state),railKey=this.railKey(state);
   if(!this.current){this.openVisit(state,identityKey,railKey,reason);return;}
   if(identityKey!==this.current.identityKey){const previous=this.current;this.closeVisit('target-changed',state.identity);
    this.openVisit(state,identityKey,railKey,reason,previous.visitId);return;}
   const before=this.current.state,viewKey=this.viewKey(state),viewChanged=viewKey!==this.current.viewKey,railChanged=railKey!==this.current.railKey;
   this.current.state=state;this.current.railKey=railKey;this.current.viewKey=viewKey;
   if(railChanged||viewChanged)this.enqueue('state-observed',{visitId:this.current.visitId,identity:state.identity,state,trigger:reason,
     effect:{kind:railChanged&&viewChanged?'rail-and-loaded-view-changed':railChanged?'rail-state-changed':'loaded-view-changed',
      fromCapturedAt:before?.capturedAt||null,toCapturedAt:state.capturedAt,fromViewEpochId:before?.viewObservation?.viewEpochId||null,toViewEpochId:viewKey}},true);
   if(railChanged||viewChanged)this.startCapture(this.current,state);
  }
  openVisit(state,identityKey,railKey,trigger,previousVisitId=null){const visit={visitId:K.uid(),identityKey,railKey,viewKey:this.viewKey(state),state,
    attemptedCaptureKeys:new Set(),pendingCaptureState:null,captureCount:0,qualifiedSides:new Set()};this.current=visit;
   this.enqueue('visit-started',{visitId:visit.visitId,previousVisitId,identity:state.identity,initialObserved:state,trigger},true);
   this.startCapture(visit,state);}
  closeVisit(reason,nextIdentity=null){const visit=this.current;if(!visit)return;
   this.enqueue('visit-ended',{visitId:visit.visitId,identity:visit.state?.identity||null,finalObserved:visit.state,
     reason,nextIdentity:nextIdentity?K.completeIdentity(nextIdentity):null,endedAt:new Date().toISOString()},true);this.current=null;}
  /* Le budget par visite cède tant que la géométrie manque.
   *
   * Terrain du 15/09, 11 sessions : 530 des 616 « échecs de capture » (86 %)
   * étaient ce budget. Sur les 48 visites où il a coupé, 26 (54 %) n'avaient
   * PAS les deux côtés qualifiés — il refusait donc exactement les captures qui
   * auraient complété la géométrie. Une fois les deux côtés qualifiés, la
   * géométrie est acquise et continuer ne fait que grossir l'export. */
  captureBudget(visit){
   const deuxQualifies=visit.qualifiedSides?.size>=2;
   return deuxQualifies?this.maxCapturesPerVisit:this.maxCapturesPerVisitUnqualified;
  }
  startCapture(visit,state=visit.state){const key=this.captureKey(state);if(visit.attemptedCaptureKeys.has(key))return;
   const budget=this.captureBudget(visit);
   if(visit.captureCount>=budget){
    /* Un budget respecté n'est PAS une panne : il est compté à part, sinon il
     * gonfle le taux d'échec affiché — 53 % sur une session où aucune capture
     * n'avait réellement échoué. */
    this.metrics.captureBudgeted=(this.metrics.captureBudgeted||0)+1;
    this.enqueue('capture-failed',{visitId:visit.visitId,identity:state.identity,
     reason:visit.qualifiedSides?.size>=2?'capture-limit-per-visit-reached'
       :'capture-limit-per-visit-reached-still-unqualified',
     qualifiedSides:[...(visit.qualifiedSides||[])],budget,
     degradationLevel:this.metrics.degradationLevel},true);return;}
   if(this.captureTask){visit.pendingCaptureState=K.clone(state);return;}
   visit.attemptedCaptureKeys.add(key);visit.captureCount++;
   if(this.metrics.degradationLevel==='METADATA_ONLY'){
    this.metrics.captureFailed++;this.enqueue('capture-failed',{visitId:visit.visitId,identity:state.identity,
      reason:'metadata-only-because-collector-overloaded',degradationLevel:this.metrics.degradationLevel},true);return;}
   const generation=this.generation,periodId=this.periodId;
   const request={visitId:visit.visitId,captureId:K.uid(),onCheckpoint:async chunk=>{this.metrics.captureCheckpoints++;
     /* La qualification est connue ici, au checkpoint : c'est ce qui permet au
      * budget de savoir si la géométrie est acquise avant de couper. */
     if(chunk?.qualification?.status==='qualified-candidate'&&chunk.side)visit.qualifiedSides.add(chunk.side);
     if(!this.enqueue('capture-checkpoint',{visitId:visit.visitId,identity:state.identity,chunk},true))throw Error('progressive-checkpoint-queue-full');
     await this.flush();const receipt=this.checkpointReceipts.get(chunk.chunkId);this.checkpointReceipts.delete(chunk.chunkId);
     if(!receipt?.storageConfirmedAt||this.queue.some(item=>item.type==='capture-checkpoint'&&item.payload.chunk?.chunkId===chunk.chunkId))
      throw Error('progressive-checkpoint-not-confirmed-stored');return receipt;}};
   this.captureTask=Promise.resolve().then(()=>this.api.capture(K.clone(state),()=>this.active&&generation===this.generation&&periodId===this.periodId,request))
    .then(cloud=>{this.metrics.captureCompleted++;this.enqueue('capture-ready',{visitId:visit.visitId,identity:state.identity,cloud},true);})
    .catch(e=>{
      /* Un refus légitime — l'opérateur a changé de cut pendant la lecture —
       * n'est pas une panne de capture. Terrain : 86 cas sur 616, comptés en
       * échec et affichés en rouge. */
      const refus=permanentRefusal(e.message);
      if(refus)this.metrics.captureRefused=(this.metrics.captureRefused||0)+1;
      else this.metrics.captureFailed++;
      this.enqueue('capture-failed',{visitId:visit.visitId,identity:state.identity,
      reason:e.message,refusal:refus,degradationLevel:this.metrics.degradationLevel},true);})
    .finally(()=>{this.captureTask=null;if(this.active&&this.current?.pendingCaptureState){const pending=this.current.pendingCaptureState;this.current.pendingCaptureState=null;this.startCapture(this.current,pending);}});
  }
  async stop(reason){if(!this.active&&!this.paused)return {active:false,metrics:this.metricSnapshot()};
   this.active=false;this.paused=reason==='pause';this.generation++;this.api.clearInterval(this.timer);this.timer=null;this.api.uninstall();
   this.closeVisit(reason,null);if(this.captureTask)await this.captureTask;
   this.enqueue('period-ended',{reason,endedAt:new Date().toISOString(),metrics:this.metricSnapshot()},true);
   this.retryAt=0;await this.flush();if(this.queue.length)throw Error(`Mode Natif : ${this.queue.length} événement(s) restent en attente de sauvegarde.`);
   return {active:false,paused:this.paused,observationPeriodId:this.periodId,metrics:this.metricSnapshot()};}
  pause(){return this.stop('pause');}
  async resume(options){if(this.active)await this.stop('resume-boundary');return this.start(options);}
  finish(){return this.stop('finished');}
 }
 return {Observer};
});
