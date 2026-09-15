(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BananeCore3);
 if(typeof module==='object')module.exports=api;else root.BananeManualSession4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(K){
 'use strict';
 const RUNNING=['STARTING','RUNNING'];
 const OPEN=['STARTING','RUNNING','PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'];
 class Sessions{
  constructor(engine,adapter,store){this.e=engine;this.adapter=adapter;this.store=store;this.queue=Promise.resolve();}
  active(){return OPEN.includes(this.e.s.manual?.status);}
  running(){return RUNNING.includes(this.e.s.manual?.status);}
  async init(){if(this.running()){this.e.s.manual.status='PAUSED';this.e.s.manual.message='Enregistrement interrompu. Les données conservées peuvent être téléchargées ; reprends la session sur le même cut.';await this.e.save();}}
  async start(){
   if(this.starting||this.ending)throw Error('La session est déjà en cours de démarrage ou de fermeture.');this.starting=true;
   try{
   if(['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(this.e.s.manual?.status))return this.resume();
   if(this.active()||this.e.busy||this.e.task||['RUNNING','PAUSED','PAUSED_UNRESOLVED_RAIL','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(this.e.s.batch?.state))throw Error('Termine ou arrête l’activité en cours avant de démarrer les corrections.');
   if(this.e.s.before)await this.e.archivePending('manual-session-start');
   const now=await this.adapter.state(),m={id:K.uid(),startedAt:new Date().toISOString(),
     identity:K.completeIdentity(now.identity),records:[],cloudIds:[],incomplete:[],sequence:[],current:null,message:'Préparation du premier cut…'};
   Object.assign(m,{status:'STARTING',phase:'PREPARING',message:'Préparation du cut…'});
   delete m.finishedAt;
   this.e.s.manual=m;this.e.s.mode='observation';await this.e.event('manual-session-started',{manualSessionId:m.id,identity:m.identity});
   try{await this.adapter.manualStart({sessionId:m.id});m.status='RUNNING';await this.e.save();return this.e.view();}
   catch(e){m.status='PAUSED';m.message=e.message;await this.e.save();throw e;}
   }finally{this.starting=false;}
  }
  receive(type,data){const next=this.queue.then(()=>this.handle(type,data));this.queue=next.catch(()=>{});return next;}
  async handle(type,data){
   const m=this.e.s.manual;if(!m||m.id!==data.sessionId||!this.active()||!this.running()&&type!=='resumed')throw Error('La session de corrections n’est plus active. Aucune commande ESV transmise par Banane.');
   const event=(name,detail={})=>this.e.event(name,{manualSessionId:m.id,...detail});
   if(type==='phase'){m.phase=data.phase;m.message=data.message;await this.e.save();return {saved:true};}
   if(type==='failure'){m.status='PAUSED';m.phase='ERROR';m.message=data.message;await event('manual-session-error',{identity:m.current?.before?.identity,message:data.message});return {saved:true};}
   if(type==='started-cut'){
     if(data.before.identity.pageId!==m.identity.pageId)throw Error('Cut hors de la page ESV de cette session.');
     const identity=K.completeIdentity(data.before.identity),sequenceIndex=m.sequence.length,previousCutId=m.sequence.at(-1)?.cutId??null;
     m.current={visitId:data.visitId,before:{...K.clone(data.before),identity},lidarId:null,recordId:null,sequenceIndex,previousCutId,nextCutId:null};
     m.sequence.push({sequenceIndex,cutId:K.cutId(identity),identity,previousCutId,nextCutId:null});this.e.s.current=K.clone(m.current.before);
     await event('manual-cut-started',{identity,visitId:data.visitId,sequenceIndex,previousCutId});return {saved:true};
   }
   const current=m.current;if(!current||current.visitId!==data.visitId)throw Error('La visite de cut a changé ; données non associées.');
   if(type==='missing-lidar'){current.missingLidar=data.message;await event('manual-lidar-missing',{identity:current.before.identity,message:data.message});return {saved:true};}
   if(type==='ready-cut'){
     K.assertTarget(current.before.identity,data.before.identity);K.assertTarget(current.before.identity,data.cloud.identity);
     if(!K.equalPoses(current.before.rails,data.before.rails)||!K.equalPoses(current.before.rails,data.cloud.rails))throw Error('Le LiDAR ne correspond pas à l’état avant.');
     const cloud=K.clone(data.cloud);cloud.sessionId=this.e.s.sessionId;cloud.manualSessionId=m.id;
     cloud.visitId=`${cloud.identity.frameId}:${cloud.identity.part}:${cloud.identity.cut}`;cloud.railStateProvenance='explicit-manual-session-before';
     await this.store.putCloud(cloud.captureId,cloud);current.lidarId=cloud.captureId;
     if(!m.cloudIds.includes(cloud.captureId))m.cloudIds.push(cloud.captureId);
     await event('manual-before-saved',{identity:data.before.identity,visitId:current.visitId,lidarId:cloud.captureId});return {saved:true};
   }
   if(type==='after-cut'){
     if(current.recordId)return {saved:true,recordId:current.recordId};
     if(!current.lidarId&&!current.missingLidar)throw Error('Le LiDAR avant n’est pas encore enregistré.');
     const operatorDecision=data.operatorDecision??(data.validationRequested?'VALIDATE':null);
     if(operatorDecision!==null&&!['VALIDATE','SKIP'].includes(operatorDecision))throw Error('Décision opérateur inconnue.');
     const record=K.reference(current.before,data.after,current.lidarId,this.e.s.sessionId);
     record.recordId=current.visitId;record.source='explicit-manual-session';record.manualSessionId=m.id;
     record.operatorDecision=operatorDecision;record.validationRequested=operatorDecision==='VALIDATE';record.skipRequested=operatorDecision==='SKIP';
     record.decision=K.manualDecision(record.rails,operatorDecision);record.sequenceIndex=current.sequenceIndex;
     record.previousCutId=current.previousCutId;record.nextCutId=current.nextCutId;record.geominfo=data.after.geominfo||current.before.geominfo||{status:'not-observed',raw:null,source:null};
     record.commandSent=false;record.afterObserved=false;record.serverConfirmed=false;record.navigationObserved=false;
     record.usableForTraining=!!current.lidarId&&operatorDecision!=='SKIP';
     if(operatorDecision==='SKIP'){record.status='operator-skipped';record.trainingExclusionReason='operator-skip';}
     if(!current.lidarId){record.status='incomplete-no-lidar';record.reason=current.missingLidar;m.incomplete.push(record.recordId);}
     await this.store.putRecord(record);current.recordId=record.recordId;current.record=record;current.operatorDecision=operatorDecision;
     m.records.push(record.recordId);this.e.s.records.push(record);this.e.s.current=K.clone(data.after);
     await event('manual-after-saved',{identity:record.identity,recordId:record.recordId,operatorDecision,usableForTraining:record.usableForTraining});return {saved:true,recordId:record.recordId};
   }
   if(type==='decision-intent'){
     if(!current.recordId)throw Error('Corrections non conservées ; décision non transmise.');
     if(current.decisionIntent)throw Error('Cette décision a déjà été demandée ; aucun second envoi.');
     if(data.operatorDecision!==current.operatorDecision)throw Error('Décision opérateur incohérente.');
     K.assertTarget(current.before.identity,data.identity);current.decisionIntent=true;
     await event('manual-decision-intent',{identity:data.identity,recordId:current.recordId,operatorDecision:data.operatorDecision});return {saved:true};
   }
   if(type==='decision-sent'){
     if(!current.decisionIntent)throw Error('Intention de décision absente.');
     if(data.operatorDecision!==current.operatorDecision)throw Error('Décision transmise incohérente.');current.decisionSent=true;
     Object.assign(current.record,{commandSent:data.commandSent===true,afterObserved:data.afterObserved===true,
       afterStateStatus:data.afterStateStatus||'UNKNOWN',serverConfirmed:data.serverConfirmed===true,navigationObserved:data.navigationObserved===true});
     await this.store.putRecord(current.record);
     await event('manual-decision-sent',{identity:data.identity,recordId:current.recordId,operatorDecision:data.operatorDecision,
       commandSent:current.record.commandSent,afterObserved:current.record.afterObserved,afterStateStatus:current.record.afterStateStatus,
       serverConfirmed:current.record.serverConfirmed,navigationObserved:current.record.navigationObserved});return {saved:true};
   }
   if(type==='navigation-observed'){
     if(!current.decisionSent)throw Error('Navigation reçue sans commande journalisée.');
     const nextIdentity=K.completeIdentity(data.nextIdentity),nextCutId=K.cutId(nextIdentity);current.nextCutId=nextCutId;
     const seq=m.sequence[current.sequenceIndex];if(seq)seq.nextCutId=nextCutId;
     Object.assign(current.record,{navigationObserved:true,navigationAfter:{identity:nextIdentity,observedAt:new Date().toISOString()},nextCutId,
       afterStateStatus:data.afterStateStatus||current.record.afterStateStatus});
     await this.store.putRecord(current.record);await event('manual-navigation-observed',{identity:current.before.identity,recordId:current.recordId,
       nextIdentity,nextCutId,afterStateStatus:current.record.afterStateStatus});return {saved:true};
   }
   if(type==='paused'){
     K.assertTarget(current.before.identity,data.identity);m.status='PAUSED';m.phase='PAUSED';m.pauseIdentity=K.completeIdentity(data.identity);
     m.message=`Cut ${data.identity.cut} conservé. Pause sans validation ni SKIP.`;
     await event('manual-paused',{identity:data.identity,visitId:current.visitId});return {saved:true};
   }
   if(type==='resumed'){
     K.assertTarget(current.before.identity,data.identity);m.status='RUNNING';m.phase=data.phase;m.message=`Cut ${data.identity.cut} repris.`;
     await event('manual-resumed',{identity:data.identity,visitId:current.visitId});return {saved:true};
   }
   if(type==='discard-cut'){
     if(data.incomplete&&!current.recordId){const record={id:current.visitId,before:current.before,lidarCaptureId:current.lidarId,
       manualSessionId:m.id,status:'incomplete-no-after',usableForTraining:false,reason:data.reason};
       await this.store.putRecord(record);m.incomplete.push(record.id);this.e.s.incomplete.push(record);}
     await event('manual-cut-left',{identity:current.before.identity,reason:data.reason,incomplete:!!data.incomplete});m.current=null;await this.e.save();return {saved:true};
   }
   throw Error('Événement de correction inconnu.');
  }
  async pause(){const m=this.e.s.manual;if(!m||m.status!=='RUNNING')throw Error('Aucune session de corrections active à mettre en pause.');
   await this.adapter.manualPause();return this.e.view();}
  async resume(){const m=this.e.s.manual;if(!m||!['PAUSED','PAUSED_ADAPTER_UNRESPONSIVE'].includes(m.status))throw Error('Aucune session de corrections en pause.');
   const now=await this.adapter.state();if(m.current)K.assertTarget(m.current.before.identity,now.identity);
   await this.adapter.manualResume({sessionId:m.id});return this.e.view();}
  end(){if(this.ending)return this.ending;this.ending=this.close().finally(()=>{this.ending=null;});return this.ending;}
  async close(){
   const m=this.e.s.manual;if(!m)throw Error('Aucune session à terminer.');
   let adapterError=null;
   try{const page=await this.adapter.ping?.();if(page&&page.pageId!==m.identity.pageId)throw Error('La page ESV a été rechargée. Les données précédentes sont conservées.');
     await this.adapter.manualFinish();}catch(e){adapterError=e;m.message='Session interrompue : '+e.message;}
   await this.queue;
   if(m.current&&!m.current.recordId){
     const r={id:m.current.visitId,before:m.current.before,lidarCaptureId:m.current.lidarId,manualSessionId:m.id,status:'incomplete-no-after',usableForTraining:false,reason:'session-ended-before-complete-capture'};
     await this.store.putRecord(r);m.incomplete.push(r.id);this.e.s.incomplete.push(r);m.current=null;
   }
   const records=(await this.store.all('records')).filter(r=>r.manualSessionId===m.id),unconfirmed=records.filter(r=>r.commandSent&&!r.serverConfirmed).map(r=>K.cutId(r.identity));
   m.status=adapterError?'PAUSED_ADAPTER_UNRESPONSIVE':unconfirmed.length?'FINISHED_WITH_UNCONFIRMED_ACTIONS':'FINISHED';m.finishedAt=new Date().toISOString();
   m.unconfirmedCuts=unconfirmed;m.adapterError=adapterError?.message||null;
   await this.e.event('manual-session-finished',{identity:m.current?.before?.identity||m.identity,manualSessionId:m.id,status:m.status,
     records:m.records.length,incomplete:m.incomplete.length,unconfirmedCuts:unconfirmed,adapterError:m.adapterError});
   return this.dataset();
  }
  async dataset(){const m=this.e.s.manual;if(!m)throw Error('Aucune session de corrections conservée.');
   const records=(await this.store.all('records')).filter(r=>r.manualSessionId===m.id);
   const closureSummary={status:m.status,completed:records.filter(r=>r.operatorDecision==='VALIDATE').length,paused:m.status?.startsWith('PAUSED')?1:0,
     skipped:records.filter(r=>r.operatorDecision==='SKIP').length,interrupted:m.incomplete.length,
     withoutFinalState:records.filter(r=>r.commandSent&&!r.afterObserved).map(r=>K.cutId(r.identity)),withoutServerConfirmation:records.filter(r=>r.commandSent&&!r.serverConfirmed).map(r=>K.cutId(r.identity))};
   return {format:'banane-corrections-session-v4',version:K.VERSION,exportedAt:new Date().toISOString(),session:K.clone(m),records,
     events:(await this.store.all('events')).filter(e=>e.manualSessionId===m.id),closureSummary,cloudIds:m.cloudIds.slice()};
  }
 }
 return {Sessions};
});
