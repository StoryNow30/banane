(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BananeCore3);
 if(typeof module==='object')module.exports=api;else root.BananeManualPage4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(K){
 'use strict';
 class Collector{
  constructor(api){this.api=api;this.active=false;this.paused=false;this.phase='IDLE';this.visit=null;this.task=null;this.generation=0;this.keyboardHeld=false;}
  async tell(type,data={}){const ack=await this.api.send(type,{sessionId:this.sessionId,...data});
   if(ack?.saved!==true)throw Error('Enregistrement non confirmé. Aucune commande ESV transmise.');return ack;}
  status(phase,message){this.phase=phase;this.api.paint(message);return this.tell('phase',{phase,message});}
  async start({sessionId}){
   if(this.active)throw Error('Une session de corrections est déjà active.');
   const initial=this.api.state();this.sessionId=sessionId;this.part=initial.identity.part;this.pageId=initial.identity.pageId;
   this.active=true;this.generation++;this.visit=null;this.phase='PREPARING';
   this.api.install(e=>this.input(e));this.timer=this.api.interval(()=>{void this.tick();},250);
   this.work(()=>this.prepare());return {active:true};
  }
  work(fn){const generation=this.generation;this.task=Promise.resolve().then(fn).catch(e=>{
    if(this.active&&generation===this.generation)return this.fail(e);
   }).finally(()=>{this.task=null;});return this.task;}
  async fail(error){this.phase='ERROR';this.api.paint('Enregistrement suspendu : '+error.message);
   try{await this.tell('failure',{message:error.message});}catch{}
   this.active=false;this.paused=true;this.api.clearInterval(this.timer);this.timer=null;this.api.uninstall();}
  async prepare(){
   const generation=this.generation,label=this.api.label();
   if(!label||label.pageId!==this.pageId)throw Error('La page ESV a changé. Termine cette session avant de continuer.');
   await this.status('PREPARING',`Cut ${label.cut} · préparation du LiDAR des deux rails…`);
   const before=await this.api.settle(label);if(!this.active||generation!==this.generation)return;
   const visitId=K.uid();this.visit={visitId,before,saved:false};
   await this.tell('started-cut',{visitId,before});
   let cloud;
   try{cloud=await this.api.capture(before);}
   catch(e){
     if(!this.active||generation!==this.generation)return;
     if(!K.transientCaptureError(e))throw e;
     await this.api.left(before);
     await this.tell('missing-lidar',{visitId,message:e.message});
     await this.status('READY_WITHOUT_LIDAR',`Cut ${label.cut} · LiDAR non conservé. Tu peux corriger ; cet exemple sera signalé comme incomplet.`);return;
   }
   if(!this.active||generation!==this.generation)return;
   K.assertTarget(before.identity,cloud.identity);
   await this.api.left(before); // Return to the operator's normal starting rail.
   if(!this.active||generation!==this.generation)return;
   const now=this.api.state();K.assertTarget(before.identity,now.identity);
   if(!K.equalPoses(before.rails,now.rails))throw Error('Les rails ont bougé pendant la préparation.');
   await this.tell('ready-cut',{visitId,before,cloud});
   if(!this.active||generation!==this.generation)return;
   await this.status('READY',`Cut ${label.cut} prêt · Shift + Espace valide · Shift + Retour arrière skippe.`);
  }
  async tick(){
   if(!this.active||this.task||this.phase==='ERROR')return;
   const label=this.api.label();if(!label)return;
   if(this.visit&&K.key(label)!==K.key(this.visit.before.identity)){
     this.work(async()=>{
       if(this.visit.saved&&this.visit.commandSent)await this.tell('navigation-observed',{visitId:this.visit.visitId,identity:this.visit.before.identity,
         nextIdentity:K.completeIdentity(label),afterStateStatus:this.visit.afterStateStatus||'UNKNOWN',navigationObserved:true});
       else if(!this.visit.saved)await this.tell('discard-cut',{visitId:this.visit.visitId,reason:'navigation-without-captured-validation',incomplete:true});
       this.visit=null;await this.prepare();
     });
   }else if(this.phase==='AWAITING_NAV'&&this.api.now()-this.navigationStarted>15000){
     const decision=this.visit?.operatorDecision||'commande';
     this.work(()=>this.fail(Error(`${decision} transmis une fois, mais le cut n’a pas changé. Contrôle le résultat dans ESV ; Banane ne répétera pas la commande.`)));
   }
  }
  input(event){
   if(!this.active||event.isTrusted===false||this.api.editable(event.target))return;
   const space=(event.code==='Space'||event.key===' ')&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
   const backspace=(event.code==='Backspace'||event.key==='Backspace')&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
   const enter=event.key==='Enter'&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
   if(event.type==='keyup'&&(space||backspace||enter||this.keyboardHeld&&(event.code===this.keyboardHeld||event.key===this.keyboardHeld))){
     event.preventDefault();event.stopImmediatePropagation();this.keyboardHeld=null;return;
   }
   if(this.phase==='ERROR')return;
   const operatorDecision=event.type==='keydown'?(backspace?'SKIP':space||enter?'VALIDATE':null):
     event.type==='click'&&this.api.isValidation(event.target)?'VALIDATE':null;
   if(operatorDecision){
     event.preventDefault();event.stopImmediatePropagation();
     if(event.type==='keydown')this.keyboardHeld=event.code||event.key;
     if(event.repeat||!['READY','READY_WITHOUT_LIDAR'].includes(this.phase)||this.task)return;
     // Freeze the after synchronously, before any ESV handler can navigate.
     let after;try{after=this.api.state();K.assertTarget(this.visit.before.identity,after.identity);}catch(e){void this.fail(e);return;}
     this.visit.operatorDecision=operatorDecision;this.phase='SAVING';this.work(()=>this.complete(after,operatorDecision));return;
   }
   // The two-view read changes the camera, so pointing starts only once READY.
   if(['PREPARING','SAVING','AWAITING_NAV'].includes(this.phase)&&
     (event.type==='click'&&this.api.isCanvas(event.target)||event.type==='keydown'&&['d','a','q','s','g'].includes(event.key?.toLowerCase())&&!event.ctrlKey&&!event.metaKey&&!event.altKey)){
     event.preventDefault();event.stopImmediatePropagation();
   }
  }
  async complete(after,operatorDecision=null){
   const visit=this.visit,generation=this.generation;
   await this.status('SAVING',`Cut ${after.identity.cut} · enregistrement avant ${operatorDecision||'fin de session'}…`);
   await this.tell('after-cut',{visitId:visit.visitId,after,operatorDecision,
     validationRequested:operatorDecision==='VALIDATE',skipRequested:operatorDecision==='SKIP'});visit.saved=true;
   if(!operatorDecision)return;
   if(!this.active||generation!==this.generation)return;
   const now=this.api.state();K.assertTarget(after.identity,now.identity);
   if(!K.equalPoses(after.rails,now.rails))throw Error('Les rails ont changé avant la transmission de ta décision.');
   await this.tell('decision-intent',{visitId:visit.visitId,identity:after.identity,operatorDecision});
   if(!this.active||generation!==this.generation)return;
   const latest=this.api.state();K.assertTarget(after.identity,latest.identity);
   if(!K.equalPoses(after.rails,latest.rails))throw Error('Les rails ont changé avant la transmission de ta décision.');
   this.phase='AWAITING_NAV';this.navigationStarted=this.api.now();
   const sent=this.api.nativeDecision(operatorDecision); // One command, only after the durable capture.
   visit.commandSent=sent?.commandSent===true;visit.afterStateStatus='PENDING';let afterObserved=false;
   try{const observed=this.api.state();K.assertTarget(after.identity,observed.identity);
     if(!K.equalPoses(after.rails,observed.rails))throw Error('Les rails ont changé après la commande native.');
     afterObserved=true;visit.afterStateStatus='OBSERVED_SAME_TARGET';visit.afterCommand=observed;
   }catch(e){const label=this.api.label();if(label&&K.key(label)!==K.key(after.identity))visit.afterStateStatus='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED';else throw e;}
   await this.tell('decision-sent',{visitId:visit.visitId,identity:after.identity,operatorDecision,
     commandSent:visit.commandSent,afterObserved,afterStateStatus:visit.afterStateStatus,serverConfirmed:false,navigationObserved:false});
   this.api.paint(`Cut ${after.identity.cut} · ${operatorDecision} enregistré · navigation ESV en observation…`);
  }
  async pause(){
   if(!this.active)throw Error('Aucune session active à mettre en pause.');
   if(this.task||!['READY','READY_WITHOUT_LIDAR'].includes(this.phase))throw Error('Attends que le cut soit prêt avant de mettre la session en pause.');
   const state=this.api.state();K.assertTarget(this.visit.before.identity,state.identity);
   this.pausedState=state;this.pausedPhase=this.phase;
   await this.tell('paused',{visitId:this.visit.visitId,identity:state.identity,phase:this.phase});
   this.active=false;this.paused=true;this.api.clearInterval(this.timer);this.timer=null;this.api.uninstall();
   this.phase='PAUSED';this.api.paint(`Cut ${state.identity.cut} · session en pause, aucune décision envoyée.`);return {active:false,paused:true,identity:state.identity};
  }
  async resume(){
   if(!this.paused)throw Error('Aucune session en pause à reprendre.');
   if(this.visit?.commandSent)throw Error('Une commande a déjà été transmise sur ce cut ; elle ne sera pas répétée.');
   const now=this.api.state(),expected=this.pausedState||this.visit?.before;K.assertTarget(expected.identity,now.identity);
   if(this.pausedState&&!K.equalPoses(this.pausedState.rails,now.rails))throw Error('Les rails ont changé pendant la pause ; reprise automatique refusée.');
   this.active=true;this.paused=false;this.generation++;this.phase=this.pausedPhase==='READY_WITHOUT_LIDAR'?'READY_WITHOUT_LIDAR':'READY';
   this.api.install(e=>this.input(e));this.timer=this.api.interval(()=>{void this.tick();},250);
   await this.tell('resumed',{visitId:this.visit.visitId,identity:now.identity,phase:this.phase});
   this.api.paint(`Cut ${now.identity.cut} · session reprise sur le même cut.`);return {active:true,paused:false,identity:now.identity};
  }
  async finish(){
   if(!this.active&&!this.paused)return {active:false};
   if(this.paused){const now=this.api.state(),expected=this.pausedState||this.visit?.before;K.assertTarget(expected.identity,now.identity);
     if(this.pausedState&&!K.equalPoses(this.pausedState.rails,now.rails))throw Error('Les rails ont changé pendant la pause ; fin de session refusée.');
     this.active=true;this.paused=false;this.phase=this.pausedPhase||'READY';}
   let failure;
   try{
     // Do not cancel a durable after write or a native decision already being sent.
     if(this.phase==='SAVING'&&this.task)await this.task;
     if(['READY','READY_WITHOUT_LIDAR'].includes(this.phase)&&this.visit&&!this.visit.saved){
       const after=this.api.state();K.assertTarget(this.visit.before.identity,after.identity);
       if(!K.equalPoses(this.visit.before.rails,after.rails))await this.complete(after,null);
       else await this.tell('discard-cut',{visitId:this.visit.visitId,reason:'unused-cut-at-session-end',incomplete:false});
     }
   }catch(e){failure=e;}
   finally{
     this.active=false;this.paused=false;this.generation++;this.api.clearInterval(this.timer);this.timer=null;this.api.uninstall();
     if(this.phase==='PREPARING')await this.api.cancel();
     if(this.task)await this.task;
     if(this.visit&&!this.visit.saved&&this.phase==='PREPARING'){
       try{await this.tell('discard-cut',{visitId:this.visit.visitId,reason:'unused-cut-at-session-end',incomplete:false});}catch{}
     }
   }
   if(failure)throw failure;
   this.phase='FINISHED';this.api.paint('Session terminée · données conservées dans Banane.');return {active:false};
  }
 }
 return {Collector};
});
