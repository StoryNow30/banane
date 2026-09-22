(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BananeCore3,
  typeof module==='object'?require('./settings.js'):root.BananeSettings);
 if(typeof module==='object')module.exports=api;else root.BananeNativeSession4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(K,S){
 'use strict';
 const OPEN=['STARTING','RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'];
 const SIDES=['left','right'],unique=a=>[...new Set(a.filter(Boolean))];
 const completeRails=state=>SIDES.every(side=>!!state?.rails?.[side]);
 const anyRail=state=>SIDES.some(side=>!!state?.rails?.[side]);
 const iso=()=>new Date().toISOString();
 const poseEqual=(a,b,tolerance=1e-7)=>['railLocalToSceneRelative','profileLocalToSceneRelative'].every(name=>
  Array.isArray(a?.[name])&&Array.isArray(b?.[name])&&a[name].length===16&&b[name].length===16&&
  a[name].every((value,index)=>Number.isFinite(value)&&Number.isFinite(b[name][index])&&Math.abs(value-b[name][index])<=tolerance));
 const eventTime=event=>Date.parse(event?.observedAt||event?.timestamp||'');
 class Sessions{
  /* Réglages centralisés dans src/settings.js ; ces alias restent exposés pour
   * les tests et les outils qui les lisaient déjà. */
  static EXPORT_WATERMARK_BYTES=S.export.watermarkBytes;
  static BYTES_PER_POINT_ESTIMATE=S.export.bytesPerPointEstimate;
  static BYTES_PER_CLOUD_OVERHEAD=S.export.bytesPerCloudOverhead;
  /* Borne du suivi par repère : la carte est conservée dans la session, donc
   * persistée. Au-delà on cesse d'ajouter des clés et on le signale, plutôt
   * que de laisser la mesure de qualité peser sur la collecte. */
  static QUALITY_RAIL_LIMIT=4000;
  /* Clé d'un repère observé : identité du cut plus le côté. */
  static railKey(identity,side){
   if(!identity||!side)return null;
   const p=identity.part,c=identity.cut;
   if(p===undefined&&c===undefined)return null;
   return `${p??'?'}/${c??'?'}/${side}`;
  }
  constructor(engine,adapter,store){this.e=engine;this.adapter=adapter;this.store=store;this.queue=Promise.resolve();}
  active(){return OPEN.includes(this.e.s.native?.status);}
  running(){return ['STARTING','RUNNING'].includes(this.e.s.native?.status);}
  async init(){const n=this.e.s.native;if(!this.running())return;
   n.metrics=n.metrics||{};n.metrics.pointsSavedByRail=n.metrics.pointsSavedByRail||{left:0,right:0};n.metrics.captureCheckpoints=n.metrics.captureCheckpoints||0;
   const recoveredAt=iso(),events=(await this.store.all('events')).filter(event=>event.nativeSessionId===n.id);
   n.nextEventSeq=Math.max(n.nextEventSeq||0,...events.map(event=>event.eventSeq||event.event_seq||0));
   const period=n.observationPeriods?.find(item=>item.observationPeriodId===n.currentPeriodId);
   if(period&&!period.endedAt){period.status='INTERRUPTED_RECOVERED';period.endTimeStatus='unknown';period.recoveredAt=recoveredAt;
    period.reason='worker-restarted-before-period-closure';}
   if(n.current){const record=n.current;record.leaveReason='worker-restart';record.endTimeStatus='unknown';record.endedAt=null;
    record.recoveredClosure={status:'INTERRUPTED_RECOVERED',recoveredAt,endTimeStatus:'unknown',finalStateInvented:false};
    this.partialReason(record,'worker-restarted-before-visit-closure');this.classify(record);await this.saveRecord(record);n.incomplete=unique([...(n.incomplete||[]),record.recordId]);n.current=null;}
   n.status='PAUSED';n.currentPeriodId=null;n.message='Observation native interrompue. Reprendre créera une nouvelle période sans inventer la continuité pendant l’interruption.';
   n.interruptions=(n.interruptions||0)+1;await this.nativeEvent('recovered-closure',{sessionId:n.id,observationPeriodId:period?.observationPeriodId||null,
    identity:null,recoveredAt,endTimeStatus:'unknown',finalStateInvented:false});await this.e.save();}
  async nativeEvent(type,detail={}){const n=this.e.s.native,copy=K.clone(detail),identity=detail.identity===null?null:K.completeIdentity(detail.identity||{});
   const eventSeq=n?(n.nextEventSeq=(n.nextEventSeq||0)+1):1;
   const event={...copy,eventId:K.uid(),timestamp:iso(),type:'native-'+type,nativeSessionId:n?.id||detail.sessionId,
    observationPeriodId:detail.observationPeriodId||null,identity,eventSeq,event_seq:eventSeq};
   await this.store.putEvent(event);return event;}
  newPeriod(n){const period={observationPeriodId:K.uid(),startedAt:iso(),endedAt:null,endTimeStatus:'open',status:'STARTING'};
   n.observationPeriods.push(period);n.currentPeriodId=period.observationPeriodId;return period;}
  async start(){if(this.starting||this.ending)throw Error('Le mode Natif est déjà en cours de démarrage ou de fermeture.');this.starting=true;
   try{const old=this.e.s.native;if(['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(old?.status))return this.resume();
    if(this.active()||this.e.busy||this.e.task||this.e.s.manual&&OPEN.includes(this.e.s.manual.status)||
      ['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(this.e.s.batch?.state))
      throw Error('Termine ou arrête l’activité en cours avant de démarrer le mode Natif.');
    const n={id:K.uid(),source:'native-passive-observation',status:'STARTING',startedAt:iso(),finishedAt:null,
      observationPeriods:[],currentPeriodId:null,visits:[],cloudIds:[],incomplete:[],current:null,eventCount:0,nextEventSeq:0,interruptions:0,
      metrics:{queueDepthMax:0,dropped:0,sendFailures:0,captureCompleted:0,captureFailed:0,captureCheckpoints:0,
       pointsSavedByRail:{left:0,right:0},inputHandlerMs:{p50:0,p95:0,max:0,samples:0},degradationLevels:[]},
      message:'Démarrage de l’observation passive…'};
    this.e.s.native=n;this.e.s.mode='observation';const period=this.newPeriod(n);await this.e.save();
    await this.nativeEvent('session-started',{sessionId:n.id,observationPeriodId:period.observationPeriodId,identity:null});
    try{await this.adapter.nativeStart({sessionId:n.id,observationPeriodId:period.observationPeriodId});n.status='RUNNING';period.status='RUNNING';
      n.message='Observation native active. Travaille normalement dans ESV : Banane n’envoie aucune commande.';await this.e.save();return this.e.view();}
    catch(error){n.status='PAUSED_ADAPTER_UNRESPONSIVE';period.status='INTERRUPTED';period.endedAt=iso();period.endTimeStatus='observed';n.message=error.message;await this.e.save();throw error;}
   }finally{this.starting=false;}}
  receive(type,data){const next=this.queue.then(()=>this.handle(type,data));this.queue=next.catch(()=>{});return next;}
  /* 4.7.2 — lecture d'UN enregistrement par sa clé. Avant, chaque événement
   * tardif d'une visite close (capture achevée après le changement de cut,
   * fréquent au rythme réel) relisait TOUS les enregistrements de la base,
   * sessions passées comprises. Le coût croissait avec l'historique. */
  async recordById(id){if(typeof this.store.getRecord==='function')return this.store.getRecord(id);
   return (await this.store.all('records')).find(item=>(item.recordId||item.id)===id);}
  async record(data){const n=this.e.s.native,current=n?.current;if(current?.visitId===data.visitId)return current;
   const saved=data.visitId?await this.recordById(data.visitId):null;
   if(!saved||saved.nativeSessionId!==n?.id||saved.visitId!==data.visitId)throw Error('La visite native ne correspond à aucun enregistrement conservé.');return saved;}
  mergeMetrics(metrics){if(!metrics)return;const m=this.e.s.native.metrics;m.queueDepthMax=Math.max(m.queueDepthMax,metrics.queueDepthMax||0);
   m.dropped=Math.max(m.dropped,metrics.dropped||0);m.sendFailures=Math.max(m.sendFailures,metrics.sendFailures||0);
   m.captureCompleted=Math.max(m.captureCompleted,metrics.captureCompleted||0);m.captureFailed=Math.max(m.captureFailed,metrics.captureFailed||0);
   m.captureCheckpoints=Math.max(m.captureCheckpoints||0,metrics.captureCheckpoints||0);
   if(metrics.inputHandlerMs)m.inputHandlerMs={...metrics.inputHandlerMs,max:Math.max(m.inputHandlerMs.max||0,metrics.inputHandlerMs.max||0)};
   if(metrics.degradationLevel&&!m.degradationLevels.includes(metrics.degradationLevel))m.degradationLevels.push(metrics.degradationLevel);
   // V4.5-R : niveau courant, pic, rétablissements et éléments écartés, pour que
   // la santé de la collecte soit lisible en direct et conservée dans l'export.
   if(metrics.degradationLevel)m.degradationLevel=metrics.degradationLevel;
   if(metrics.degradationPeak)m.degradationPeak=metrics.degradationPeak;
   if(Number.isFinite(metrics.queueDepth))m.queueDepth=metrics.queueDepth;
   for(const k of ['degradationEvents','recoveries','setAside','refused','captureBudgeted','captureRefused','captureSkippedAfterOperatorRailChange'])
    if(Number.isFinite(metrics[k]))m[k]=Math.max(m[k]||0,metrics[k]);
   if(Array.isArray(metrics.setAsideItems)&&metrics.setAsideItems.length){
    m.setAsideItems=metrics.setAsideItems.slice(0,32);}}
  async saveRecord(record){record.updatedAt=iso();await this.store.putRecord(record);}
  partialReason(record,reason){record.partialReasons=record.partialReasons||[];if(reason&&!record.partialReasons.includes(reason))record.partialReasons.push(reason);}
  establishBefore(record,state){if(!state||!anyRail(state))return;record.beforeEstablishedByRail=record.beforeEstablishedByRail||{left:null,right:null};
   if(!record.beforeEstablished){record.beforeEstablished=K.clone(state);record.beforeEstablished.rails={left:null,right:null};}
   for(const side of SIDES)if(!record.beforeEstablishedByRail[side]&&state.rails?.[side]){record.beforeEstablishedByRail[side]={side,rail:K.clone(state.rails[side]),
     observedAt:state.capturedAt||iso(),viewObservation:K.clone(state.viewObservation??null),identity:K.completeIdentity(state.identity),immutable:true};
    record.beforeEstablished.rails[side]=K.clone(state.rails[side]);}
   const observed=SIDES.filter(side=>record.beforeEstablishedByRail[side]);record.beforeEstablishment={status:observed.length===2?'complete-by-rail':'partial-by-rail',
    observedRails:observed,simultaneous:observed.length===2&&record.beforeEstablishedByRail.left.observedAt===record.beforeEstablishedByRail.right.observedAt,
    observedAtByRail:Object.fromEntries(SIDES.map(side=>[side,record.beforeEstablishedByRail[side]?.observedAt||null])),immutablePerRail:true};}
  /* Relation d'une visite aux précédentes du même cut — 4.7.2.
   *
   * Dans la session, la liste chronologique `n.visits` suffit : elle retient la
   * DERNIÈRE visite du cut (l'ancienne lecture intégrale prenait la dernière
   * dans l'ordre des clés, c'est-à-dire des UUID). Entre sessions, un index des
   * autres sessions est construit une fois par vie du service worker, au lieu
   * d'une lecture intégrale de la base à chaque début de visite. */
  async crossSessionIndex(n){if(this.crossIndex?.sessionId===n.id)return this.crossIndex.map;const map=new Map();
   for(const record of await this.store.all('records'))
    if(record.source==='native-passive-observation'&&record.visitId&&record.nativeSessionId!==n.id)
     map.set(K.cutId(record.identity),{visitId:record.visitId,nativeSessionId:record.nativeSessionId});
   this.crossIndex={sessionId:n.id,map};return map;}
  visitRelation(n,identity,periodId,cross){const cut=K.cutId(identity);
   const previous=(n.visits||[]).slice().reverse().find(visit=>visit.visitId&&K.cutId(visit.identity)===cut);
   if(previous)return {type:previous.observationPeriodId===periodId?'revisit':'pause-continuation',relatedVisitId:previous.visitId,relatedSessionId:n.id};
   const other=cross?.get(cut);
   if(other)return {type:'cross-session-revisit',relatedVisitId:other.visitId,relatedSessionId:other.nativeSessionId};
   return {type:'first-observation',relatedVisitId:null,relatedSessionId:null};}
  redactedEvent(type,data){if(type==='capture-ready'){const cloud=data.cloud||{},pointsByRail=Object.fromEntries(SIDES.map(side=>[side,cloud.railObservations?.[side]?.pointsRetained||0]));
    return {...data,cloud:{format:cloud.format,captureId:cloud.captureId,identity:cloud.identity,status:cloud.status,termination:cloud.termination,pointsByRail,trace:cloud.trace}};}
   if(type==='capture-checkpoint'){const chunk=data.chunk||{};return {...data,chunk:{format:chunk.format,chunkId:chunk.chunkId,captureId:chunk.captureId,visitId:chunk.visitId,
     side:chunk.side,identity:chunk.identity,capturedAt:chunk.capturedAt,acquisition:chunk.acquisition,
     qualification:chunk.qualification?{status:chunk.qualification.status,criteriaVersion:chunk.qualification.criteriaVersion,
      acquiredThroughAt:chunk.qualification.acquiredThroughAt,coverage:chunk.qualification.coverage}:null,points:chunk.pointsSceneRelative?.length||0}};}
   return data;}
  async handle(type,data){const n=this.e.s.native;if(!n||n.id!==data.sessionId||!this.active())throw Error('La session Natif n’est plus active.');
   this.mergeMetrics(data.collectorMetrics);n.eventCount++;
   // A checkpoint event represents a completed storage write; other events
   // retain their ordinary arrival order. This is not a physical cut order.
   const logged=type==='capture-checkpoint'?null:await this.nativeEvent(type,this.redactedEvent(type,data));
   if(type==='period-started'){const period=n.observationPeriods.find(item=>item.observationPeriodId===data.observationPeriodId);
    if(period){period.status='RUNNING';period.startedAt=data.startedAt||period.startedAt;period.endTimeStatus='open';}await this.e.save();return {saved:true,eventSeq:logged.eventSeq};}
   if(type==='visit-started'){
    if(n.current){this.partialReason(n.current,'new-visit-before-previous-close');n.current.status='partial';n.incomplete=unique([...n.incomplete,n.current.recordId]);await this.saveRecord(n.current);}
    const identity=K.completeIdentity(data.identity||data.initialObserved?.identity||{}),visitIndex=n.visits.length,cross=await this.crossSessionIndex(n);
    const record={format:'banane-native-visit-v2',version:K.VERSION,recordId:data.visitId,id:data.visitId,nativeSessionId:n.id,
      source:'native-passive-observation',observationPeriodId:data.observationPeriodId,visitId:data.visitId,visitIndex,
      previousVisitId:data.previousVisitId||n.visits.at(-1)?.visitId||null,nextVisitId:null,visitRelation:this.visitRelation(n,identity,data.observationPeriodId,cross),identity,
      startedAt:data.initialObserved?.capturedAt||iso(),endedAt:null,endTimeStatus:'open',firstObserved:K.clone(data.initialObserved),beforeEstablished:null,beforeEstablishedByRail:{left:null,right:null},
      beforeEstablishment:{status:'not-established',observedAt:null,immutable:true},lastObserved:K.clone(data.initialObserved),humanFinalReference:null,
      initialObserved:K.clone(data.initialObserved),finalObserved:K.clone(data.initialObserved),stateTransitions:[],operatorEvents:[],operatorIntents:[],multiIntent:false,observedEffects:[],
      operatorIntent:null,commandSentByBanane:false,commandSent:'not-observed',serverConfirmed:false,serverConfirmationStatus:'not-observed',
      navigationObserved:false,nextObservedIdentity:null,lidarCaptureIds:[],lidarChunkIds:[],geometryCaptures:{},geometryObservations:{left:[],right:[]},
      railSnapshots:{left:[],right:[]},
      geometryEligibility:{left:{status:'not-evaluated',reasons:[]},right:{status:'not-evaluated',reasons:[]},pair:{status:'not-evaluated',reasons:[]}},
      geominfo:data.initialObserved?.geominfo||{status:'not-observed',raw:null,source:null},
      esvSequence:{previousCutId:null,nextCutId:null,sequenceIndex:null,chainage:null,status:'not-observed'},
      context:{track:null,switch:null,levelCrossing:null,esvObject:null,status:'not-observed'},partialReasons:[],status:'observing',
      usableAsNativeReference:false,usableForOfflineEvaluationByRail:{left:false,right:false},usableForTraining:false,
      trainingExclusionReason:'native-reference-requires-explicit-review'};
    this.establishBefore(record,data.initialObserved);for(const reason of data.initialObserved?.partialReasons||[])this.partialReason(record,reason);
    const previousId=n.visits.at(-1)?.visitId;if(previousId){const previous=await this.recordById(previousId);
      if(previous&&previous.nativeSessionId===n.id&&previous.visitId===previousId){previous.nextVisitId=record.visitId;await this.saveRecord(previous);}}
    n.current=record;n.visits.push({visitId:record.visitId,visitIndex,identity,observationPeriodId:record.observationPeriodId,relation:record.visitRelation.type});
    this.e.s.current=K.clone(data.initialObserved);await this.saveRecord(record);await this.e.save();return {saved:true,recordId:record.recordId,eventSeq:logged.eventSeq};
   }
   if(type==='observation-failed'){if(n.current){this.partialReason(n.current,data.reason||'observation-failed');await this.saveRecord(n.current);}
    n.incomplete=unique([...n.incomplete,n.current?.recordId]);await this.e.save();return {saved:true,eventSeq:logged.eventSeq};}
   if(type==='operator-event'&&!data.visitId)return {saved:true,eventSeq:logged.eventSeq};
   const record=data.visitId?await this.record(data):null;
   if(type==='operator-event'){
    const observed={...K.clone(data.event),eventSeq:logged.eventSeq,event_seq:logged.eventSeq,collectorSeq:data.collectorSeq??null};record.operatorEvents.push(observed);
    if(record.operatorEvents.length>128){record.operatorEvents.shift();this.partialReason(record,'operator-events-truncated');}
    if(observed.intent){const state=K.clone(data.stateObservedBeforeInput||record.lastObserved||null),intent={intent:observed.intent,observedAt:observed.observedAt||logged.timestamp,
       eventSeq:logged.eventSeq,collectorSeq:data.collectorSeq??null,repeat:!!observed.repeat,stateObservedBeforeInput:state};
      if(state){try{K.assertTarget(record.identity,state.identity);}catch{state.identityAssociation='mismatch';}}
      record.operatorIntents.push(intent);record.multiIntent=record.operatorIntents.length>1;record.operatorIntent=record.multiIntent?'AMBIGUOUS_MULTIPLE':observed.intent;
      record.operatorIntentObservedAt=intent.observedAt;if(observed.intent==='VALIDATE'&&!record.humanFinalReference){
       const freshness=state&&Number.isFinite(eventTime(intent))&&Number.isFinite(Date.parse(state.capturedAt||''))?eventTime(intent)-Date.parse(state.capturedAt):null;
       record.humanFinalReference={status:freshness!==null&&freshness<0?'candidate-timing-uncertain':'candidate-observed',state,
        observedAt:intent.observedAt,eventSeq:intent.eventSeq,
        association:{identityMatched:state?.identityAssociation!=='mismatch',freshnessMs:freshness,
         source:freshness!==null&&freshness<0?'cached-state-arrived-after-operator-input':'last-passively-observed-state-before-intent',
         eventTimeStamp:observed.eventTimeStamp??null,stateCapturedAt:state?.capturedAt||null,reviewed:false}};
       if(freshness!==null&&freshness<0)this.partialReason(record,'cached-state-observed-after-operator-input');}}
    await this.saveRecord(record);return {saved:true,eventSeq:logged.eventSeq};
   }
   if(type==='state-observed'){
    K.assertTarget(record.identity,data.state.identity);record.lastObserved=K.clone(data.state);record.finalObserved=K.clone(data.state);this.establishBefore(record,data.state);
    record.stateTransitions.push({observedAt:data.state.capturedAt,trigger:data.trigger,effect:data.effect,eventSeq:logged.eventSeq});record.observedEffects.push(K.clone(data.effect));
    if(record.stateTransitions.length>64){record.stateTransitions.shift();this.partialReason(record,'state-transitions-truncated');}
    for(const reason of data.state.partialReasons||[])this.partialReason(record,reason);this.e.s.current=K.clone(data.state);await this.saveRecord(record);return {saved:true,eventSeq:logged.eventSeq};
   }
   if(type==='capture-checkpoint'){
    const chunk=K.clone(data.chunk);K.assertTarget(record.identity,chunk.identity);if(!SIDES.includes(chunk.side))throw Error('Côté de capture Natif invalide.');
    if(chunk.visitId&&chunk.visitId!==record.visitId)throw Error('Checkpoint LiDAR associé à une autre visite.');
    if(record.lidarChunkIds.includes(chunk.chunkId)||await this.store.getCloud(chunk.chunkId))throw Error('Identifiant de bloc LiDAR déjà utilisé : copie immuable non remplacée.');
    chunk.nativeSessionId=n.id;chunk.visitId=record.visitId;chunk.source='native-passive-observation';chunk.storageTrace={pointsSaved:chunk.pointsSceneRelative?.length||0,pointsExported:0};
    await this.store.putCloud(chunk.chunkId,chunk);const storedAt=iso();if(!record.lidarChunkIds.includes(chunk.chunkId))record.lidarChunkIds.push(chunk.chunkId);if(!n.cloudIds.includes(chunk.chunkId))n.cloudIds.push(chunk.chunkId);
    this.accountStored(n,chunk);this.accountQuality(n,chunk);
    const capture=record.geometryCaptures[chunk.captureId]||(record.geometryCaptures[chunk.captureId]={captureId:chunk.captureId,visitId:record.visitId,status:'reading',sides:{}});
    const side=capture.sides[chunk.side]||(capture.sides[chunk.side]={side:chunk.side,chunkIds:[],pointsSaved:0,rail:K.clone(chunk.rail),viewObservation:K.clone(chunk.viewObservation),capturedAt:chunk.capturedAt});
    n.metrics.pointsSavedByRail=n.metrics.pointsSavedByRail||{left:0,right:0};
    if(!side.chunkIds.includes(chunk.chunkId)){side.chunkIds.push(chunk.chunkId);side.pointsSaved+=chunk.pointsSceneRelative?.length||0;n.metrics.pointsSavedByRail[chunk.side]+=chunk.pointsSceneRelative?.length||0;}
    const qualification=chunk.qualification;if(qualification?.format==='banane-native-rail-snapshot-v1'){
     record.railSnapshots??={left:[],right:[]};
     const snapshot={format:qualification.format,snapshotId:chunk.chunkId,captureId:chunk.captureId,side:chunk.side,identity:K.clone(chunk.identity),
      chunkIds:K.clone(qualification.chunkIds||[chunk.chunkId]),rail:K.clone(chunk.rail),viewObservation:K.clone(chunk.viewObservation),
      coordinateSystem:K.clone(chunk.coordinateSystem),acquisitionStartedAt:qualification.acquisitionStartedAt,
      acquiredThroughAt:qualification.acquiredThroughAt,emittedAt:chunk.acquisition?.emittedAt||null,storedAt,
      sourceStatus:qualification.sourceStatus,clipStatus:qualification.clipStatus,transform:K.clone(qualification.transform),
      associationStatus:qualification.associationStatus,criteriaVersion:qualification.criteriaVersion,coverage:K.clone(qualification.coverage),
      qualificationStatus:qualification.status,exclusionReasons:K.clone(qualification.exclusionReasons||[]),receiptEventSeq:null,
      captureStatusAtQualification:'reading',independentOfCaptureTermination:true};
     record.railSnapshots[chunk.side].push(snapshot);}
    await this.saveRecord(record);await this.e.save();const stored=await this.nativeEvent(type,{...this.redactedEvent(type,data),storageConfirmedAt:storedAt,
     receiptStatus:'cloud-and-record-stored'});
    if(qualification?.format==='banane-native-rail-snapshot-v1'){record.railSnapshots[chunk.side].at(-1).receiptEventSeq=stored.eventSeq;
     if(record.endedAt!==null||record.endTimeStatus==='unknown')this.classify(record);await this.saveRecord(record);}
    return {saved:true,eventSeq:stored.eventSeq,chunkId:chunk.chunkId,storageConfirmedAt:storedAt};
   }
   if(type==='capture-ready'){
    const cloud=K.clone(data.cloud);K.assertTarget(record.identity,cloud.identity);cloud.nativeSessionId=n.id;cloud.visitId=record.visitId;
    cloud.source='native-passive-observation';cloud.railStateProvenance='native-observed-current-loaded-view';
    const capture=record.geometryCaptures[cloud.captureId]||(record.geometryCaptures[cloud.captureId]={captureId:cloud.captureId,visitId:record.visitId,status:'reading',sides:{}});
    if(cloud.format==='banane-native-lidar-capture-v2'){
      const saved=SIDES.reduce((sum,side)=>sum+(capture.sides[side]?.pointsSaved||0),0);cloud.trace=cloud.trace||{};cloud.trace.pointsSaved=saved;cloud.trace.perRail=cloud.trace.perRail||{};
      for(const side of SIDES)if(cloud.trace.perRail[side])cloud.trace.perRail[side].pointsSaved=capture.sides[side]?.pointsSaved||0;
      cloud.trace.pointsExported=0;capture.status=cloud.status;capture.startedAt=cloud.startedAt;capture.completedAt=cloud.completedAt;capture.termination=K.clone(cloud.termination);
      capture.trace=K.clone(cloud.trace);capture.viewObservation=K.clone(cloud.viewObservation);
      for(const side of SIDES){const observation=cloud.railObservations?.[side];if(!observation)continue;const savedSide=capture.sides[side]?.pointsSaved||0;
       const entry={captureId:cloud.captureId,side,chunkIds:(capture.sides[side]?.chunkIds||[]).slice(),pointsSaved:savedSide,pointsRetained:observation.pointsRetained||0,
        startedAt:cloud.startedAt,capturedAt:observation.capturedAt,completedAt:observation.completedAt,rail:K.clone(observation.rail),viewObservation:K.clone(cloud.viewObservation??null),
        transform:K.clone(observation.transform??null),coverage:K.clone(observation.coverage??null),associationStatus:observation.associationStatus,coordinateSystem:K.clone(cloud.coordinateSystem??null),eventSeq:logged.eventSeq,
        geometryInputStatus:observation.geometryInputStatus,exclusionReasons:K.clone(observation.exclusionReasons||[]),captureStatus:cloud.status,termination:K.clone(cloud.termination),trace:K.clone(cloud.trace)};
       record.geometryObservations[side].push(entry);
       for(const snapshot of record.railSnapshots?.[side]||[])if(snapshot.captureId===cloud.captureId&&
         (!poseEqual(snapshot.rail,observation.rail)||cloud.coordinateSystem&&JSON.stringify(snapshot.coordinateSystem)!==JSON.stringify(cloud.coordinateSystem))){
         snapshot.revocations??=[];snapshot.revocations.push({reason:'capture-report-contradicts-snapshot-frame',observedAt:logged.timestamp,
          evidence:'same-capture-rail-pose-or-coordinate-system-mismatch'});}}}
    else{capture.status=cloud.status;capture.legacy=true;record.lidarQuality={points:cloud.pointsSceneRelative?.length||0,perRail:K.clone(cloud.quality?.perRail||{}),
       completeLoadedRoi:cloud.scope?.completeLoadedRoi===true};}
    this.accountQuality(n,cloud);
    await this.store.putCloud(cloud.captureId,cloud);if(!record.lidarCaptureIds.includes(cloud.captureId))record.lidarCaptureIds.push(cloud.captureId);if(!n.cloudIds.includes(cloud.captureId))n.cloudIds.push(cloud.captureId);
    this.accountStored(n,cloud);
    record.lidarStatus=cloud.status;if(record.endedAt!==null||record.endTimeStatus==='unknown')this.classify(record);await this.saveRecord(record);await this.e.save();
    return {saved:true,eventSeq:logged.eventSeq,captureId:cloud.captureId};
   }
   if(type==='capture-failed'){this.partialReason(record,data.reason||'capture-failed');record.lidarStatus='not-captured';
    if(data.degradationLevel==='METADATA_ONLY')this.partialReason(record,'collector-degraded-to-metadata-only');if(record.endedAt)this.classify(record);await this.saveRecord(record);return {saved:true,eventSeq:logged.eventSeq};}
   if(type==='visit-ended'){
    if(data.finalObserved){K.assertTarget(record.identity,data.finalObserved.identity);record.lastObserved=K.clone(data.finalObserved);record.finalObserved=K.clone(data.finalObserved);this.establishBefore(record,data.finalObserved);}
    record.endedAt=data.endedAt||iso();record.endTimeStatus='observed';record.leaveReason=data.reason;record.nextObservedIdentity=data.nextIdentity?K.completeIdentity(data.nextIdentity):null;
    record.navigationObserved=data.reason==='target-changed'&&!!record.nextObservedIdentity;
    if(record.navigationObserved)record.observedEffects.push({kind:'target-changed',nextIdentity:record.nextObservedIdentity,observedAt:record.endedAt,eventSeq:logged.eventSeq});
    this.classify(record);await this.saveRecord(record);if(record.status!=='complete')n.incomplete=unique([...n.incomplete,record.recordId]);
    if(n.current?.visitId===record.visitId)n.current=null;await this.e.save();return {saved:true,eventSeq:logged.eventSeq};
   }
   if(type==='period-ended'){const period=n.observationPeriods.find(item=>item.observationPeriodId===data.observationPeriodId);
    if(period){period.endedAt=data.endedAt||iso();period.endTimeStatus='observed';period.status=data.reason==='finished'?'FINISHED':'PAUSED';period.reason=data.reason;period.metrics=data.metrics;}
    await this.e.save();return {saved:true,eventSeq:logged.eventSeq};}
   throw Error('Événement Natif inconnu : '+type);
  }
  chooseGeometry(record,side){const before=record.beforeEstablished?.rails?.[side],observations=record.geometryObservations?.[side]||[],failures=[];
   if(!before)return {status:'excluded',captureId:null,chunkIds:[],points:0,reasons:['initial-rail-state-missing']};
   if(record.version!=='4.4.1'){
    const snapshots=record.railSnapshots?.[side]||[],intent=record.operatorIntents?.[0],intentAt=eventTime(intent);
    for(const snapshot of snapshots){const reasons=[...(snapshot.exclusionReasons||[])];
     if(snapshot.revocations?.length)reasons.push(...snapshot.revocations.map(item=>item.reason));
     if(snapshot.qualificationStatus!=='qualified-candidate'||snapshot.coverage?.status!=='qualified-candidate')reasons.push('checkpoint-not-qualified');
     if(snapshot.criteriaVersion!=='native-visible-roi-v1')reasons.push('snapshot-criteria-unknown');
     if(snapshot.sourceStatus!=='reference-version-and-matrix-stable-through-checkpoint')reasons.push('source-stability-not-demonstrated');
     if(snapshot.clipStatus!=='verified-classifiable')reasons.push('clipping-not-verified');
     if(!snapshot.transform?.valid)reasons.push('transform-invalid');
     if(snapshot.associationStatus!=='same-target-and-rail-pose'||!poseEqual(snapshot.rail,before))reasons.push('capture-used-a-different-rail-pose-than-initial-state');
     if(!snapshot.receiptEventSeq||!snapshot.storedAt||!snapshot.chunkIds?.length)reasons.push('storage-receipt-or-chunks-missing');
     if(!snapshot.coordinateSystem?.frameId||snapshot.coordinateSystem.frameId!==record.identity?.frameId||
       snapshot.coordinateSystem.units!=='metres-observed-not-independently-calibrated')reasons.push('coordinate-frame-or-units-unverified');
     try{K.assertTarget(record.identity,snapshot.identity);}catch{reasons.push('snapshot-identity-mismatch');}
     const finished=Date.parse(snapshot.acquiredThroughAt||''),started=Date.parse(snapshot.acquisitionStartedAt||'');
     if(!Number.isFinite(finished)||!Number.isFinite(started)||started>finished)reasons.push('acquisition-time-invalid');
     if(intent&&(!Number.isFinite(intentAt)||finished>intentAt))reasons.push('geometry-acquired-after-operator-intent');
     if(reasons.length){failures.push(...reasons);continue;}
     return {status:'qualified-candidate',snapshotId:snapshot.snapshotId,captureId:snapshot.captureId,chunkIds:snapshot.chunkIds.slice(),
      points:snapshot.coverage.pointsInRoi,acquiredThroughAt:snapshot.acquiredThroughAt,storedAt:snapshot.storedAt,
      receiptEventSeq:snapshot.receiptEventSeq,capturedAt:snapshot.acquisitionStartedAt,viewEpochId:snapshot.viewObservation?.viewEpochId||null,
      coordinateSystem:K.clone(snapshot.coordinateSystem),criteriaVersion:snapshot.criteriaVersion,reasons:[]};}
    return {status:'excluded',snapshotId:null,captureId:null,chunkIds:[],points:0,reasons:unique(failures.length?failures:['qualified-stored-snapshot-missing'])};
   }
   for(const observation of observations){const reasons=[];
    if(observation.geometryInputStatus!=='qualified-candidate'||observation.coverage?.status!=='qualified-candidate')reasons.push(...(observation.exclusionReasons||['coverage-not-qualified']));
    if(!observation.transform?.valid)reasons.push('transform-invalid');if(observation.associationStatus!=='same-target-and-rail-pose')reasons.push('capture-reference-association-unverified');
    if(!poseEqual(observation.rail,before))reasons.push('capture-used-a-different-rail-pose-than-initial-state');if(!observation.chunkIds?.length||!observation.pointsSaved)reasons.push('saved-points-missing');
    if(record.operatorIntents?.[0]?.eventSeq&&observation.eventSeq>=record.operatorIntents[0].eventSeq)reasons.push('geometry-completed-after-operator-intent');
    if(reasons.length){failures.push(...reasons);continue;}
    return {status:'qualified-candidate',captureId:observation.captureId,chunkIds:observation.chunkIds.slice(),points:observation.pointsSaved,
     capturedAt:observation.capturedAt,viewEpochId:observation.viewObservation?.viewEpochId||null,coordinateSystem:K.clone(observation.coordinateSystem??null),reasons:[]};}
   return {status:'excluded',captureId:null,chunkIds:[],points:0,reasons:unique(failures.length?failures:['qualified-capture-missing'])};}
  classify(record){const initial=record.beforeEstablished||record.firstObserved||record.initialObserved,last=record.lastObserved||record.finalObserved;
   record.partialReasons=record.partialReasons||[];record.geometryEligibility=record.geometryEligibility||{left:{},right:{},pair:{}};
   record.usableForOfflineEvaluationByRail=record.usableForOfflineEvaluationByRail||{left:false,right:false};
   if(!initial)this.partialReason(record,'initial-state-not-established');if(!last)this.partialReason(record,'last-state-missing');
   if(initial&&last)try{K.assertTarget(initial.identity,last.identity);}catch{this.partialReason(record,'initial-last-identity-mismatch');}
   if(!completeRails(initial)||!completeRails(last))this.partialReason(record,'one-or-both-rails-missing');
   const intents=record.operatorIntents||[],sole=intents.length===1?intents[0]:null;record.multiIntent=intents.length>1;
   record.operatorIntent=intents.length===0?null:record.multiIntent?'AMBIGUOUS_MULTIPLE':sole.intent;
   if(!intents.length){record.observedLabelCandidate='PASS_NO_DECISION';this.partialReason(record,'operator-decision-not-observed');}
   else if(record.multiIntent){record.observedLabelCandidate='AMBIGUOUS_MULTIPLE_INTENTS';this.partialReason(record,'multiple-operator-intents-observed');}
   else if(sole.intent==='SKIP'){record.observedLabelCandidate='SKIP';record.humanFinalReference=null;}
   else if(sole.intent==='VALIDATE'){
    const reference=record.humanFinalReference?.state;if(!reference){this.partialReason(record,'human-final-reference-missing');record.observedLabelCandidate=null;}
    else{try{K.assertTarget(record.identity,reference.identity);}catch{this.partialReason(record,'human-final-reference-identity-mismatch');}
     const rails={};for(const side of SIDES)if(initial?.rails?.[side]&&reference.rails?.[side])rails[side]={positionChanged:!poseEqual(initial.rails[side],reference.rails[side])};
     record.observedLabelCandidate=K.manualDecision(rails,'VALIDATE');}}
   else{record.observedLabelCandidate='UNKNOWN_INTENT';this.partialReason(record,'unknown-operator-intent');}
   if(intents.length&&!record.navigationObserved)this.partialReason(record,'decision-effect-not-observed');
   for(const side of SIDES)record.geometryEligibility[side]=this.chooseGeometry(record,side);
   const reference=record.humanFinalReference,referenceReasons=[];
   if(!sole||sole.intent!=='VALIDATE')referenceReasons.push(record.multiIntent?'multiple-operator-intents-observed':sole?.intent==='SKIP'?'operator-skip-observed':'validated-reference-not-observed');
   if(!reference?.state)referenceReasons.push('human-final-reference-missing');if(reference?.association?.identityMatched===false)referenceReasons.push('human-final-reference-identity-mismatch');
   if(reference?.association?.freshnessMs===null||reference?.association?.freshnessMs<0||reference?.association?.freshnessMs>1500)referenceReasons.push('human-final-reference-not-freshly-observed');
   if(!record.navigationObserved)referenceReasons.push('decision-effect-not-observed');
   for(const side of SIDES){const eligibility=record.geometryEligibility[side],reasons=[...eligibility.reasons,...referenceReasons];
    if(!reference?.state?.rails?.[side])reasons.push('human-final-rail-state-missing');eligibility.referenceStatus=reference?.status||'not-observed';eligibility.reasons=unique(reasons);
    eligibility.status=eligibility.status==='qualified-candidate'&&!eligibility.reasons.length?'comparable-candidate':'excluded';record.usableForOfflineEvaluationByRail[side]=eligibility.status==='comparable-candidate';}
   const left=record.geometryEligibility.left,right=record.geometryEligibility.right,pairReasons=[];
   if(left.status!=='comparable-candidate')pairReasons.push(...left.reasons.map(reason=>'left:'+reason));if(right.status!=='comparable-candidate')pairReasons.push(...right.reasons.map(reason=>'right:'+reason));
   if(left.captureId&&right.captureId&&(left.coordinateSystem?.name!==right.coordinateSystem?.name||left.coordinateSystem?.units!==right.coordinateSystem?.units))pairReasons.push('left-right-coordinate-systems-differ');
   record.geometryEligibility.pair={status:!pairReasons.length?'comparable-candidate':'excluded',leftCaptureId:left.captureId,rightCaptureId:right.captureId,
    simultaneousRequired:false,sameViewEpoch:left.viewEpochId===right.viewEpochId,compatibilityChecked:true,reasons:unique(pairReasons)};
   record.usableAsNativeReference=record.geometryEligibility.pair.status==='comparable-candidate';record.usableForTraining=false;
   record.trainingExclusionReason=sole?.intent==='SKIP'?'operator-skip-observed':record.multiIntent?'multiple-operator-intents-observed':'native-reference-requires-explicit-review';
   if(!record.lidarCaptureIds?.length&&!record.lidarChunkIds?.length)this.partialReason(record,'lidar-missing');
   const metadataComplete=!!initial&&!!last&&!!record.endedAt&&record.endTimeStatus!=='unknown';record.status=metadataComplete&&!record.partialReasons.length?'complete':'partial';
  }
  async pause(){const n=this.e.s.native;if(!n||n.status!=='RUNNING')throw Error('Aucune observation Natif active à mettre en pause.');
   try{const result=await this.adapter.nativePause();await this.queue;this.mergeMetrics(result?.metrics);n.status='PAUSED';n.currentPeriodId=null;
    n.message='Observation en pause. Reprendre ouvrira une nouvelle période, sans continuité supposée.';await this.e.save();return this.e.view();}
   catch(error){n.status='PAUSED_ADAPTER_UNRESPONSIVE';n.message=error.message;await this.e.save();throw error;}}
  async resume(){const n=this.e.s.native;if(!n||!['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(n.status))throw Error('Aucune observation Natif en pause.');
   const period=this.newPeriod(n);try{await this.adapter.nativeResume({sessionId:n.id,observationPeriodId:period.observationPeriodId});n.status='RUNNING';period.status='RUNNING';
    n.message='Nouvelle période d’observation native active.';await this.e.save();return this.e.view();}catch(error){n.status='PAUSED_ADAPTER_UNRESPONSIVE';period.status='INTERRUPTED';
    period.endedAt=iso();period.endTimeStatus='observed';n.message=error.message;await this.e.save();throw error;}}
  /* `end({dataset:false})` rend un résumé léger au lieu de la session entière.
   * 4.7.2 terrain : la fin de session renvoyait tout le jeu (88 Mo de visites et
   * d'événements pour 105 visites) dans un seul message vers le panneau —
   * « Message exceeded maximum allowed size of 64MiB ». L'export passe de toute
   * façon par le manifeste léger et la lecture directe du stockage. */
  end(options={}){if(this.ending)return this.ending;this.ending=this.close(options).finally(()=>{this.ending=null;});return this.ending;}
  endSummary(){const n=this.e.s.native;if(!n)return null;
   return {format:'banane-native-session-end-v1',version:K.VERSION,sessionId:n.id,status:n.status,finishedAt:n.finishedAt||null,
    visits:(n.visits||[]).length,incomplete:(n.incomplete||[]).length,cloudsStored:(n.cloudIds||[]).length,adapterError:n.adapterError||null};}
  /* V4.5.4 — abandon explicite d'une session.
   *
   * Une session d'essai, une mauvaise cible, un départ raté : il n'existait
   * aucun moyen de jeter ce qui venait d'être collecté. Il fallait terminer la
   * session, télécharger, puis supprimer le fichier — et les nuages restaient
   * dans IndexedDB.
   *
   * L'abandon est IRRÉVERSIBLE et ne produit aucun export : c'est le contraire
   * de `end()`. Il arrête d'abord l'observation dans la page (sinon le
   * collecteur continue d'écrire dans ce qu'on efface), puis supprime nuages,
   * visites et événements de cette session. Le compte de ce qui a été supprimé
   * est retourné : un effacement muet ne serait pas vérifiable. */
  async discard(){
   const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   const sessionId=n.id;
   try{await this.adapter.nativeFinish({sessionId,reason:'session-discarded'});}catch{/* la page peut déjà être partie */}
   let nuages=0,visites=0,evenements=0;
   for(const id of n.cloudIds||[]){try{await this.store.deleteCloud(id);nuages++;}catch{/* déjà absent */}}
   try{
    for(const r of await this.store.all('records'))
     if(r.nativeSessionId===sessionId){await this.store.deleteRecord(r.recordId||r.id);visites++;}
   }catch{/* le comptage ne doit pas empêcher la suite */}
   try{
    for(const ev of await this.store.all('events'))
     if(ev.sessionId===sessionId||ev.nativeSessionId===sessionId){await this.store.deleteEvent(ev.eventId);evenements++;}
   }catch{/* idem */}
   this.e.s.native=null;this.e.s.mode='idle';
   await this.e.save();
   return {discarded:true,sessionId,clouds:nuages,records:visites,events:evenements};
  }
  async close({dataset=true}={}){const n=this.e.s.native;if(!n)throw Error('Aucune session Natif à terminer.');let adapterError=null;
   try{const result=await this.adapter.nativeFinish();this.mergeMetrics(result?.metrics);}catch(error){adapterError=error;n.message='Fin interrompue : '+error.message;}
   await this.queue;if(n.current){this.partialReason(n.current,'session-ended-before-visit-close');this.classify(n.current);await this.saveRecord(n.current);
    n.incomplete=unique([...n.incomplete,n.current.recordId]);n.current=null;}
   n.status=adapterError?'PAUSED_ADAPTER_UNRESPONSIVE':'FINISHED';n.finishedAt=iso();n.adapterError=adapterError?.message||null;n.currentPeriodId=null;
   // Une visite = un enregistrement : le compte vient de la session, sans relire toute la base.
   await this.nativeEvent('session-finished',{sessionId:n.id,identity:null,status:n.status,records:(n.visits||[]).length,incomplete:n.incomplete.length,adapterError:n.adapterError});
   await this.e.save();return dataset?this.dataset():this.endSummary();}
  /* V4.5-R — comptabilité de volume et conseil d'export segmenté.
   * Au-delà d'environ 64 Mo, la préparation du fichier unique échouait dans la
   * fenêtre et la session entière devenait intéléchargeable : toute la collecte
   * était perdue. On mesure donc le volume au fil de l'eau et on signale au
   * panneau qu'il faut vider un segment AVANT d'atteindre ce mur. */
  /* Estimation suffisante et peu coûteuse : on ne sérialise pas deux fois les
   * points. Le même calcul sert à créditer au stockage et à débiter à la purge,
   * donc les deux ne peuvent pas diverger. */
  cloudBytes(cloud){
   const points=cloud?.pointsSceneRelative?.length||0;
   return points?points*Sessions.BYTES_PER_POINT_ESTIMATE+Sessions.BYTES_PER_CLOUD_OVERHEAD
     :JSON.stringify(cloud||{}).length;
  }
  accountStored(n,cloud){
   try{
    n.exportState??={bytesStored:0,bytesPending:0,exportedCloudIds:[],releasedCloudIds:[],segments:0,lastAdviceAt:null};
    const x=n.exportState;
    const bytes=this.cloudBytes(cloud);
    x.bytesStored+=bytes;x.bytesPending+=bytes;
    n.metrics??={};n.metrics.bytesStored=x.bytesStored;n.metrics.bytesPending=x.bytesPending;
   }catch{/* la comptabilité ne doit jamais interrompre la collecte */}
  }
  /* Conseil lu par le panneau à chaque rafraîchissement. Le panneau exécute le
   * téléchargement : un service worker MV3 ne peut pas créer d'URL d'objet, et
   * l'extension ne demande pas la permission "downloads". */
  exportAdvice(){
   const n=this.e.s.native;if(!n)return null;
   const x=n.exportState;if(!x)return null;
   const pending=n.cloudIds.filter(id=>!x.exportedCloudIds.includes(id));
   const due=x.bytesPending>=Sessions.EXPORT_WATERMARK_BYTES&&pending.length>0;
   return {due,reason:due?'watermark-reached':null,bytesStored:x.bytesStored,bytesPending:x.bytesPending,
    watermark:Sessions.EXPORT_WATERMARK_BYTES,pendingClouds:pending.length,segments:x.segments,
    note:'Segment vidé automatiquement pour ne jamais atteindre la limite de téléchargement.'};
  }
  /* V4.5 — qualité de capture agrégée au fil de l'eau.
   *
   * Mesure du 15/09 sur deux sessions réelles : le flanc interne du champignon
   * est le verrou du moteur — médiane 0 à 1 point observé pour un seuil de 6 —
   * et le filtre de visibilité en retire les deux tiers. C'est la cause
   * principale du faible rendement, et elle ne se voyait qu'après une enquête
   * hors ligne. On l'agrège ici pour qu'elle soit lisible pendant la collecte. */
  accountQuality(n,cloud){
   try{
    n.quality??={snapshotsQualified:0,snapshotsTotal:0,interruptedOnly:0,exclusionReasons:{},
      railsObserved:0,railsQualified:0,railsTruncated:false,
      clip:{inRoiKept:0,inRoiDropped:0,nearTopKept:0,nearTopDropped:0,nearFaceKept:0,nearFaceDropped:0}};
    n.qualityRails??={};
    const q=n.quality,vus=n.qualityRails;
    /* Niveau repère : un repère compte comme qualifié dès qu'un instantané
     * qualifié a existé pour lui. C'est ce qui conditionne réellement une
     * proposition du moteur, et c'est la seule lecture actionnable pendant la
     * collecte — bien plus que le taux par instant de capture ci-dessous. */
    if(cloud?.format==='banane-native-lidar-chunk-v1'){
     const cle=Sessions.railKey(cloud.identity,cloud.side);
     if(cle){
      if(vus[cle]===undefined){
       if(q.railsObserved>=Sessions.QUALITY_RAIL_LIMIT)q.railsTruncated=true;
       else{vus[cle]=0;q.railsObserved++;}
      }
      if(vus[cle]===0&&cloud.qualification?.status==='qualified-candidate'){vus[cle]=1;q.railsQualified++;}
     }
     n.metrics??={};n.metrics.quality=q;return;
    }
    if(cloud?.format!=='banane-native-lidar-capture-v2')return;
    for(const side of SIDES){
     const obs=cloud.railObservations?.[side];if(!obs)continue;
     q.snapshotsTotal++;
     const motifs=obs.coverage?.exclusionReasons||[];
     if(obs.coverage?.status==='qualified-candidate')q.snapshotsQualified++;
     else{
      /* « Interrompu avant frontière stable » n'est PAS un défaut de couverture :
       * c'est une réserve de provenance (la capture s'est arrêtée sur un
       * changement de cible, de vue ou de découpe). Le confondre avec un manque
       * de points faisait lire 8 % là où la couverture était suffisante. */
      if(motifs.length===1&&motifs[0]==='capture-interrupted-before-stable-boundary')q.interruptedOnly++;
      for(const r of motifs)q.exclusionReasons[r]=(q.exclusionReasons[r]||0)+1;
     }
     const cl=obs.clipLoss;if(!cl)continue;
     for(const k of Object.keys(q.clip))if(Number.isFinite(cl[k]))q.clip[k]+=cl[k];
    }
    n.metrics??={};n.metrics.quality=q;
   }catch{/* la qualité ne doit jamais interrompre la collecte */}
  }
  /* V4.5-R — santé de la collecte, lisible en direct dans la fenêtre Natif.
   * Avant, une dégradation ou des captures perdues ne se voyaient qu'après
   * analyse hors ligne de l'export, donc trop tard pour réagir. */
  health(){
   const n=this.e.s.native;if(!n)return null;
   const m=n.metrics||{},x=n.exportState||{};
   /* Le taux d'échec ne porte QUE sur les vraies pannes. Terrain du 15/09 :
    * 530 des 616 « échecs » étaient le budget par visite, 86 des refus
    * légitimes de cut — soit 616 sur 616 sans une seule panne réelle, affichés
    * jusqu'ici comme « 53 % d'échec » en rouge. */
   const captures=(m.captureCompleted||0)+(m.captureFailed||0);
   return {status:n.status||null,visits:(n.visits||[]).length,
    bytesStored:x.bytesStored||0,bytesPending:x.bytesPending||0,
    watermark:Sessions.EXPORT_WATERMARK_BYTES,segments:x.segments||0,
    cloudsStored:(n.cloudIds||[]).length,cloudsExported:(x.exportedCloudIds||[]).length,
    captureCompleted:m.captureCompleted||0,captureFailed:m.captureFailed||0,
    captureBudgeted:m.captureBudgeted||0,captureRefused:m.captureRefused||0,
    captureFailureRate:captures?Math.round((m.captureFailed||0)/captures*100):0,
    queueDepth:m.queueDepth??null,queueDepthMax:m.queueDepthMax||0,
    dropped:m.dropped||0,sendFailures:m.sendFailures||0,
    degradationLevel:m.degradationLevel||'FULL',degradationPeak:m.degradationPeak||m.degradationLevel||'FULL',
    recoveries:m.recoveries||0,setAside:m.setAside||0,refused:m.refused||0,
    setAsideItems:(m.setAsideItems||[]).slice(0,8),
    quality:(()=>{const q=n.quality;if(!q)return null;const c=q.clip;
     const roi=c.inRoiKept+c.inRoiDropped,face=c.nearFaceKept+c.nearFaceDropped,top=c.nearTopKept+c.nearTopDropped;
     const ecartes=q.snapshotsTotal-q.snapshotsQualified;
     return {snapshotsQualified:q.snapshotsQualified,snapshotsTotal:q.snapshotsTotal,
      qualifiedRate:q.snapshotsTotal?Math.round(q.snapshotsQualified/q.snapshotsTotal*100):null,
      railsObserved:q.railsObserved||0,railsQualified:q.railsQualified||0,
      railsTruncated:q.railsTruncated===true,
      railQualifiedRate:q.railsObserved?Math.round((q.railsQualified||0)/q.railsObserved*100):null,
      interruptedOnly:q.interruptedOnly||0,
      interruptedShare:ecartes>0?Math.round((q.interruptedOnly||0)/ecartes*100):null,
      coverageShort:Math.max(0,ecartes-(q.interruptedOnly||0)),
      exclusionReasons:{...(q.exclusionReasons||{})},
      clipDropRate:roi?Math.round(c.inRoiDropped/roi*100):null,
      faceKept:c.nearFaceKept,faceDropped:c.nearFaceDropped,
      faceDropRate:face?Math.round(c.nearFaceDropped/face*100):null,
      topDropRate:top?Math.round(c.nearTopDropped/top*100):null};})()};
  }
  /* V4.5.4 — le vidage automatique libère réellement la place.
   *
   * Terrain du 15/09 : le vidage se déclenchait bien vers 30-37 Mo, mais rien
   * n'était libéré ensuite. Session 3dd20460 — segment automatique de 314
   * objets à 09:39, puis export final de 680 objets à 09:41 : les 314 déjà
   * écrits l'étaient une seconde fois. Session 28bfe0a5 en 4.5.3 — 77,3 Mo
   * accumulés pour 646 objets, dont 315 déjà sur disque. La session ne
   * repartait jamais de zéro, d'où le retour du mur malgré le vidage.
   *
   * Désormais, un objet acquitté est PURGÉ d'IndexedDB. Deux garde-fous :
   *   — `n.cloudIds` garde la liste COMPLÈTE de tout ce qui a été produit, donc
   *     l'export final déclare aussi les objets purgés ;
   *   — `tools/merge-segments.cjs` contrôle l'intégrité sur l'UNION des
   *     identifiants déclarés : si un segment automatique manque à la fusion,
   *     il est signalé nommément au lieu de disparaître en silence.
   * La purge ne masque donc jamais une perte : elle la rend détectable. */
  async ackExported(ids){
   const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   n.exportState??={bytesStored:0,bytesPending:0,exportedCloudIds:[],releasedCloudIds:[],segments:0,lastAdviceAt:null};
   const x=n.exportState;x.releasedCloudIds??=[];const added=[];
   for(const id of ids||[])if(!x.exportedCloudIds.includes(id)){x.exportedCloudIds.push(id);added.push(id);}
   x.segments+=1;x.bytesPending=0;x.lastAdviceAt=iso();
   let libere=0,octets=0;
   if(S.export.releaseAfterExport){
    for(const id of added){
     try{
      const cloud=await this.store.getCloud(id);
      if(cloud)octets+=this.cloudBytes(cloud);
      await this.store.deleteCloud(id);
      if(!x.releasedCloudIds.includes(id))x.releasedCloudIds.push(id);
      libere++;
     }catch{/* un objet non purgeable reste lisible : jamais bloquant */}
    }
    x.bytesStored=Math.max(0,(x.bytesStored||0)-octets);
   }
   n.metrics??={};n.metrics.bytesPending=0;n.metrics.exportSegments=x.segments;
   n.metrics.bytesStored=x.bytesStored;n.metrics.cloudsReleased=x.releasedCloudIds.length;
   await this.e.save();
   return {acknowledged:added.length,segments:x.segments,exported:x.exportedCloudIds.length,
    released:libere,releasedTotal:x.releasedCloudIds.length,bytesFreed:octets,total:n.cloudIds.length};
  }
  /* V4.5.3 — manifeste d'export SANS les records ni les événements.
   *
   * Terrain du 15/09 : sur une session de 92 visites, l'export échouait avec
   * « Message exceeded maximum allowed size of 64MiB ». Ce n'est pas la limite
   * de téléchargement mais celle de `chrome.runtime.sendMessage` : `dataset()`
   * renvoyait records et événements en un seul message, qui dépasse 64 MiB dès
   * que la session grossit. Deux segments étaient écrits, puis plus rien —
   * 717 objets sur 977 mis à l'abri.
   *
   * Le panneau lit désormais records, événements et nuages DIRECTEMENT dans
   * IndexedDB : il partage l'origine du service worker, donc la même base. Le
   * message ne transporte plus que l'état de session et la liste des
   * identifiants, quelques dizaines de kilo-octets. */
  async exportManifest(tous=false){
   const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   const full=await this.dataset();
   const done=tous?[]:(n.exportState?.exportedCloudIds||[]);
   /* Un objet purgé n'est plus lisible : il ne doit pas être demandé au
    * panneau, qui le rapporterait comme manquant. Mais il reste déclaré dans
    * `leger.cloudIds` (la session), donc la fusion sait qu'il doit se trouver
    * dans un segment antérieur et le signale s'il est absent. */
   const libere=n.exportState?.releasedCloudIds||[];
   const indisponible=new Set([...done,...libere]);
   const {records,events,...leger}=full;
   return {...leger,sessionId:n.id,
    cloudIds:full.cloudIds.filter(id=>!indisponible.has(id)),
    declaredCloudIds:full.cloudIds,
    recordCount:records.length,eventCount:events.length,
    alreadyExported:done.length,released:libere.length,
    exportAdvice:this.exportAdvice()};
  }
  /* Métadonnées + uniquement les nuages pas encore écrits sur disque. */
  async exportPlan(){
   const data=await this.dataset();const n=this.e.s.native;
   const done=n.exportState?.exportedCloudIds||[];
   return {...data,cloudIds:data.cloudIds.filter(id=>!done.includes(id)),
    alreadyExported:done.length,exportAdvice:this.exportAdvice()};
  }
  async dataset(){const n=this.e.s.native;if(!n)throw Error('Aucune session Natif conservée.');
   const records=(await this.store.all('records')).filter(record=>record.nativeSessionId===n.id).sort((a,b)=>(a.visitIndex??0)-(b.visitIndex??0));
   const counts=new Map();for(const record of records){const key=K.cutId(record.identity);counts.set(key,(counts.get(key)||0)+1);}
   const lossCauses={};for(const record of records)for(const side of SIDES)for(const reason of record.geometryEligibility?.[side]?.reasons||[])lossCauses[reason]=(lossCauses[reason]||0)+1;
   const firstStored=Object.fromEntries(SIDES.map(side=>[side,records.map(record=>{const snapshot=record.railSnapshots?.[side]?.find(item=>
     item.qualificationStatus==='qualified-candidate'&&item.receiptEventSeq&&!item.revocations?.length&&
     item.sourceStatus==='reference-version-and-matrix-stable-through-checkpoint'&&item.clipStatus==='verified-classifiable'&&
     item.coordinateSystem?.frameId===record.identity?.frameId&&poseEqual(item.rail,record.beforeEstablished?.rails?.[side]));
     return snapshot?{record,snapshot}:null;}).filter(Boolean)]));
   const median=a=>a.length?a.slice().sort((x,y)=>x-y)[Math.floor((a.length-1)/2)]:null;
   const latency=Object.fromEntries(SIDES.map(side=>{const values=firstStored[side].map(({record,snapshot})=>Date.parse(snapshot.acquiredThroughAt)-Date.parse(record.startedAt)).filter(v=>Number.isFinite(v)&&v>=0);
     return [side,{count:values.length,medianMs:median(values),maximumMs:values.length?Math.max(...values):null}];}));
   const durationMinutes=n.finishedAt?Math.max(0,(Date.parse(n.finishedAt)-Date.parse(n.startedAt))/60000):null;
   /* Santé de la capture (4.7.2) : ce qu'il faut regarder en premier après une
    * session au rythme réel. Part des visites dont chaque rail a un instantané
    * qualifié et stocké pour sa pose initiale, nombre de lectures par visite,
    * et causes d'arrêt des lectures. */
   const captures=records.flatMap(record=>Object.values(record.geometryCaptures||{}));
   const terminations={};for(const capture of captures){const key=capture.termination?.code||(capture.status==='reading'?'NOT_REPORTED':'NONE');terminations[key]=(terminations[key]||0)+1;}
   const captureHealth={visits:records.length,captures:captures.length,capturesPerVisit:records.length?captures.length/records.length:null,terminations,
     qualifiedInitialSnapshotRateByRail:Object.fromEntries(SIDES.map(side=>[side,records.length?firstStored[side].length/records.length:null]))};
   const closureSummary={captureHealth,status:n.status,visits:records.length,complete:records.filter(record=>record.status==='complete').length,partial:records.filter(record=>record.status!=='complete').length,
     returns:[...counts.values()].filter(count=>count>1).reduce((sum,count)=>sum+count-1,0),observationPeriods:n.observationPeriods.length,lidarCaptures:n.cloudIds.length,
     usableByRail:Object.fromEntries(SIDES.map(side=>[side,records.filter(record=>record.geometryEligibility?.[side]?.status==='comparable-candidate').length])),
     usablePairs:records.filter(record=>record.geometryEligibility?.pair?.status==='comparable-candidate').length,geometryLossCauses:lossCauses,
     firstQualifiedStoredSnapshotByRail:Object.fromEntries(SIDES.map(side=>[side,firstStored[side].length])),
     firstQualifiedAcquisitionLatencyByRail:latency,durationMinutes,
     comparableCandidateRailsPerMinute:durationMinutes?records.reduce((sum,record)=>sum+SIDES.filter(side=>record.geometryEligibility?.[side]?.status==='comparable-candidate').length,0)/durationMinutes:null,
     droppedEvents:n.metrics.dropped,degradationLevels:n.metrics.degradationLevels,serverConfirmationAvailable:false,serverConfirmationStatus:'not-observed',
     serverConfirmationNotAnError:true,passiveContract:{commandsByBanane:0,cameraChangesByBanane:0,railSelectionsByBanane:0,navigationByBanane:0}};
   const events=(await this.store.all('events')).filter(event=>event.nativeSessionId===n.id).sort((a,b)=>(a.eventSeq||a.event_seq||0)-(b.eventSeq||b.event_seq||0));
   return {format:'banane-native-session-v2',version:K.VERSION,exportedAt:iso(),session:K.clone(n),records,events,closureSummary,cloudIds:n.cloudIds.slice()};
  }
 }
 return {Sessions,poseEqual};
});
