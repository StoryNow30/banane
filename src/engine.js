(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BananeCore3,
 typeof module==='object'?require('./geometry.js'):root.BananeGeometry3);
 if(typeof module==='object')module.exports=api;else root.BananeEngine3=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(K,G){
 'use strict';
 class Engine{
  constructor(adapter,store){this.adapter=adapter;this.store=store;this.busy=false;this.task=null;
   this.s={schemaVersion:4,version:K.VERSION,sessionId:K.uid(),mode:'observation',collection:'IDLE',
     before:null,after:null,lidarId:null,records:[],incomplete:[],proposal:null,snapshot:null,applied:null,
     validationStarted:false,batch:null,notice:'Prêt. Sélectionne un onglet ESV.',events:[],settings:{...G.DEFAULTS}};}
  async init(){const old=await this.store.getState();if(old){this.s=old;this.s.version=K.VERSION;this.s.schemaVersion=4;
    this.s.settings={...G.DEFAULTS,...this.s.settings,method:G.DEFAULTS.method};
    /* `deferred` rejoint les collections du lot. Un lot ancien se relit donc
     * avec une liste vide — et, faute de `scope.unresolvedPolicy`, conserve la
     * politique historique `pause` (voir `unresolvedPolicy()`). */
    if(this.s.batch){for(const name of ['processed','skipped','paused','interrupted','sequence','manuallyCompleted','deferred'])if(!Array.isArray(this.s.batch[name]))this.s.batch[name]=[];
      this.s.batch.activeIdentity=this.s.batch.activeIdentity||this.s.before?.identity||null;this.s.batch.lastCompletedIdentity=this.s.batch.lastCompletedIdentity||null;}
    // A pending, unapplied old proposal must pass the new support check. Never
    // recalculate an already applied proposal before validation or recovery.
    if(this.s.proposal&&!this.s.applied&&!this.s.intent&&Object.values(this.s.proposal.rails).some(p=>p.method!==G.DEFAULTS.method)){
      this.s.proposal=null;if(this.s.batch?.step==='apply')this.s.batch.step='analyze';
    }
    if(this.s.batch&&!this.s.batch.error){const failure=this.s.events.slice().reverse().find(e=>e.type==='batch-error'&&e.timestamp>=this.s.batch.startedAt);
      if(failure)this.s.batch.error={message:failure.message,step:failure.step,timestamp:failure.timestamp};}
    if(this.s.batch?.state==='ERROR'&&this.s.batch.step==='capture'&&this.s.before&&!this.s.lidarId&&!this.s.intent&&!this.s.applied&&
      K.transientCaptureError(this.s.batch.error?.message)){
      this.s.batch.state='PAUSED';this.s.batch.error.retryableCapture=true;
      this.s.notice='Lecture LiDAR interrompue conservée. Sur le même cut, clique sur Reprendre ; aucune capture à annuler.';
    }
    /* `interrupted` est la LISTE des interruptions du lot. Elle était écrasée
     * par un booléen à chaque redémarrage, ce qui perdait le journal et faisait
     * lire 0 à `closureSummary`. Le drapeau a désormais son propre champ. */
    if(this.s.batch&&['RUNNING','PAUSED'].includes(this.s.batch.state)){this.s.batch.state='PAUSED';this.s.batch.interruptedByRestart=true;}
    /* APRÈS la remise en pause générale : une navigation différée incertaine
     * doit pouvoir imposer son propre état, pas le subir. */
    await this.recoverDefer();
    if(this.s.intent){this.s.reconcileRequired=true;this.s.notice='Action interrompue : état ESV à réconcilier avant toute nouvelle écriture.';}
    else if(this.s.batch&&this.s.applied){
      /* V4.6.0, revue Astra. `validation-observation` est journalisé AVANT les
       * contrôles d'acceptation : s'en servir pour créditer `processed` au
       * redémarrage revenait à créditer une navigation inattendue que le moteur
       * venait justement de refuser. Seul `validation-accepted`, émis une fois
       * TOUS les contrôles passés, vaut acceptation durable pour le lot.
       *
       * Et quand la commande est partie sans être acceptée, il n'y a pas deux
       * issues mais une seule : ni crédit, ni renvoi. La commande native est
       * irréversible ; le lot s'arrête pour contrôle, comme il l'aurait fait
       * sans l'interruption. */
      /* Revue Astra complémentaire : une TENTATIVE, pas un cut. Chercher par
       * pageId/part/cut ne suffisait pas — les événements restent dans
       * `s.events` d'un lot à l'autre, si bien qu'une acceptation ancienne du
       * même cut, venue d'un lot antérieur, pouvait être prise pour celle de la
       * tentative courante. L'identifiant de tentative est vérifié avec le lot
       * et la proposition auxquels il appartient : rien d'autre ne crédite. */
      const passees=this.s.events.slice().reverse(),cible=K.key(this.s.applied.identity);
      const tentative=this.s.applied.validationAttempt;
      const attempt=(tentative?.batchId??null)===(this.s.batch.id??null)?tentative:null;
      const memeTentative=e=>!!attempt?.validationAttemptId&&e.validationAttemptId===attempt.validationAttemptId
        &&(e.batchId??null)===(this.s.batch.id??null)&&(e.proposalId??null)===(attempt.proposalId??null);
      const acceptee=passees.find(e=>e.type==='validation-accepted'&&memeTentative(e));
      const commandee=passees.find(e=>e.type==='validation-intent'&&memeTentative(e));
      /* État écrit par une version antérieure à V4.6.0 : aucune tentative n'y
       * est identifiée. LE JOURNAL NE PEUT PAS EN TENIR LIEU — ses événements
       * survivent aux lots, si bien qu'un `validation-intent` V4.5.7 traînant
       * sur le même cut bloquerait à tort un lot neuf qui n'a rien envoyé.
       *
       * Seul un marqueur appartenant à l'ÉTAT COURANT fait foi : `s.validationStarted`,
       * que `apply()` remet à faux avant CHAQUE application. Ici il n'est vrai
       * que si la commande est partie ET revenue — si elle était encore en vol,
       * `s.intent` serait posé et la branche de réconciliation, plus haut,
       * aurait déjà pris la main. Il vaut seul, sans confirmation du journal :
       * celui-ci est plafonné à 150 événements et l'intent peut en avoir été
       * chassé. */
      const heritee=!attempt&&this.s.validationStarted===true;
      /* Retrouvé pour la trace seulement, jamais comme condition, et jamais
       * antérieur au lot courant. */
      const intentHerite=heritee&&passees.find(e=>e.type==='validation-intent'&&!e.validationAttemptId&&K.key(e.identity)===cible
        &&(!this.s.batch.startedAt||e.timestamp>=this.s.batch.startedAt))||null;
      if(this.s.batch.step==='validate'&&acceptee){
        const k=acceptee.cutId||K.key(acceptee.identity);
        if(!this.s.batch.processed.some(p=>p.key===k||p.key===K.key(acceptee.identity)))
          this.s.batch.processed.push({key:k,identity:K.completeIdentity(acceptee.identity),cut:acceptee.identity.cut,
            evidence:acceptee.evidence,recovered:true,validationAttemptId:acceptee.validationAttemptId});
        this.s.batch.lastCompletedIdentity=K.completeIdentity(acceptee.identity);
        this.s.batch.step='capture';this.s.applied=null;this.s.proposal=null;
      }else if(this.s.batch.step==='validate'&&(commandee||heritee)){
        this.s.batch.state='PAUSED_AFTER_STATE_MISSING';
        this.s.batch.error={code:'VALIDATION_NOT_ACCEPTED_BEFORE_RESTART',step:'validate',timestamp:new Date().toISOString(),
          message:'Commande de validation transmise, résultat non accepté avant le redémarrage.'};
        if(!Array.isArray(this.s.batch.interrupted))this.s.batch.interrupted=[];
        this.s.batch.interrupted.push({identity:K.completeIdentity(this.s.applied.identity),
          status:'VALIDATION_NOT_ACCEPTED_BEFORE_RESTART',evidence:this.s.lastActionEvidence||null,
          validationAttemptId:attempt?.validationAttemptId??null,legacyStateWithoutAttemptId:!attempt,
          legacyMarker:attempt?null:'validationStarted',legacyIntentEventId:intentHerite?.eventId??null});
        this.s.notice='Commande de validation transmise avant l’interruption, sans résultat accepté. Ce cut n’est ni compté ni retraité, et la commande ne sera pas renvoyée : contrôle-le dans ESV.';
        await this.event('batch-validation-not-accepted-on-restart',{identity:this.s.applied.identity,
          validationAttemptId:attempt?.validationAttemptId??null,batchId:this.s.batch.id??null,
          commandSent:true,accepted:false,counted:false,resent:false});
      }else if(this.s.batch.step==='apply')this.s.batch.step='validate';
    }
    await this.save();}return this.s;}
  view(){return {...K.clone(this.s),busy:this.busy};}
  async save(){await this.store.setState(K.clone(this.s));}
  async event(type,detail={}){const identity=detail.identity===null?null:K.completeIdentity(detail.identity||this.s.current?.identity||this.s.before?.identity||{});
   const e={eventId:K.uid(),timestamp:new Date().toISOString(),type,identity,...detail};
   await this.store.putEvent(e);this.s.events.push(e);if(this.s.events.length>150)this.s.events.shift();await this.save();}
  async locked(fn){if(this.busy)throw Error('Une opération est déjà en cours.');this.busy=true;
   try{return await fn();}catch(e){this.s.notice=e.message;await this.event('error',{message:e.message});throw e;}finally{this.busy=false;await this.save();}}
  async observe(){const previous=this.s.current?.identity,now=await this.adapter.state();now.identity=K.completeIdentity(now.identity);
   if(this.s.before&&['BEFORE_CAPTURED','READY_FOR_AFTER'].includes(this.s.collection)){
    const changed=K.differences(this.s.before.identity,now.identity);
    if(changed.length){this.s.collection='STALE';this.s.notice='Capture avant conservée, cible différente : '+changed.join(', ');await this.event('capture-stale',{changed});}}
   this.s.current=now;
   if(previous&&K.key(previous)!==K.key(now.identity))await this.event('cut-target-changed',{identity:previous,nextIdentity:now.identity,
     fromCutId:K.cutId(previous),toCutId:K.cutId(now.identity)});
   return now;}
  async archivePending(reason){if(!this.s.before)return;
   const item={id:K.uid(),identity:K.completeIdentity(this.s.before.identity),before:this.s.before,lidarCaptureId:this.s.lidarId,reason,
     proposal:this.s.proposal?K.clone(this.s.proposal):null,geominfo:this.s.before.geominfo||{status:'not-observed',raw:null,source:null},
     commandSent:false,afterObserved:false,serverConfirmed:false,navigationObserved:false,status:'incomplete-no-after',usableForTraining:false};
   this.s.incomplete.push(item);await this.store.putRecord(item);this.s.before=null;this.s.collection='IDLE';await this.event('capture-abandoned',{id:item.id,reason});}
  async begin(){this.assertBatchContextFree('une nouvelle capture');await this.observe();
   if(this.s.collection==='STALE')await this.archivePending('target-changed');
   if(this.s.collection==='READY_FOR_AFTER')throw Error('Capture avant déjà ouverte : termine l’après ou annule.');
   if(this.s.collection==='BEFORE_CAPTURED'&&this.s.before){
     if(this.s.lidarId||this.s.intent||this.s.applied)throw Error('Capture avant déjà ouverte : termine l’après ou annule.');
     const now=await this.adapter.state();K.assertTarget(this.s.before.identity,now.identity);
     if(!K.equalPoses(this.s.before.rails,now.rails))throw Error('Rails modifiés depuis la lecture interrompue : capture initiale conservée.');
     await this.event('capture-restarted',{identity:now.identity});
   }else{
     this.s.before=await this.adapter.state();this.s.after=null;this.s.proposal=null;this.s.applied=null;this.s.lidarId=null;this.s.collection='BEFORE_CAPTURED';
   }
   this.s.captureFailure=null;await this.save();
   let data;try{data=await this.adapter.capture(this.s.before);K.assertTarget(this.s.before.identity,data.identity);}
   catch(e){this.s.captureFailure={identity:this.s.before.identity,message:e.message,retryable:K.transientCaptureError(e)};
     await this.event('capture-failed',this.s.captureFailure);throw e;}
   data.sessionId=this.s.sessionId;data.visitId=`${data.identity.frameId}:${data.identity.part}:${data.identity.cut}`;
   data.railStateProvenance='explicit-before';
   data.coordinateBridge={sceneFrameId:data.identity.frameId,captureSceneRelativeToSessionSceneRelative:K.C.identity()};
   this.s.lidarId=data.captureId;await this.store.putCloud(data.captureId,data);this.s.collection='READY_FOR_AFTER';
   this.s.notice='Avant + LiDAR enregistrés. Corrige les deux rails, puis enregistre l’après.';await this.event('before-captured',{identity:this.s.before.identity,lidarId:data.captureId});return data;}
  async finish(source='explicit-before-after',sequence=null){
   if(this.s.collection!=='READY_FOR_AFTER')throw Error('Aucun avant exploitable : '+this.s.collection);
   const after=await this.adapter.state();K.assertTarget(this.s.before.identity,after.identity);
   const record=K.reference(this.s.before,after,this.s.lidarId,this.s.sessionId);record.source=source;record.identity=K.completeIdentity(record.identity);
   record.commandSent=false;record.afterObserved=true;record.serverConfirmed=false;record.navigationObserved=false;record.afterStateStatus='OBSERVED_SAME_TARGET';
   record.geominfo=after.geominfo||this.s.before.geominfo||{status:'not-observed',raw:null,source:null};
   if(sequence)Object.assign(record,{sequenceIndex:sequence.sequenceIndex,previousCutId:sequence.previousCutId,nextCutId:sequence.nextCutId??null});
   this.s.lastObserved={identity:record.identity,rails:record.rails};
   this.s.records.push(record);await this.store.putRecord(record);this.s.after=after;this.s.before=null;this.s.collection='AFTER_CAPTURED';
   this.s.notice=`Opération ${this.s.records.length} enregistrée pour les deux rails.`;
   await this.event('after-captured',{recordId:record.recordId,identity:record.identity});return record;}
  async standalone(){const now=await this.adapter.state(),data=await this.adapter.capture(now);await this.store.putCloud(data.captureId,data);
   this.s.lastLidarId=data.captureId;await this.event('lidar-exported',{identity:now.identity,lidarId:data.captureId});return data;}
  async analyze(){
   this.assertBatchContextFree('une analyse assistée');
   if(this.s.collection!=='READY_FOR_AFTER')await this.begin();
   const now=await this.adapter.state();K.assertTarget(this.s.before.identity,now.identity);
   if(!K.equalPoses(this.s.before.rails,now.rails))throw Error('Les rails ont été modifiés après l’avant : enregistrer l’après ou annuler avant une nouvelle analyse.');
   const data=await this.store.getCloud(this.s.lidarId);if(!data)throw Error('LiDAR absent du stockage.');
   this.s.proposal={id:K.uid(),identity:K.completeIdentity(now.identity),rails:G.proposeBoth(data,this.s.settings),
     geominfo:data.geominfo||now.geominfo||{status:'not-observed',raw:null,source:null},createdAt:new Date().toISOString()};
   this.s.notice='Propositions calculées. Confiance heuristique, non calibrée.';await this.event('proposed',{proposal:this.s.proposal});return this.s.proposal;}
  gate(){if(this.s.reconcileRequired||this.s.intent)throw Error('Réconciliation requise : aucune nouvelle écriture autorisée sur un état incertain.');}
  /* V4.6.0, revue Astra. MANUAL_TAKEOVER est un LOT ACTIF : le cut est rendu à
   * l'opérateur, mais le lot garde son contexte — cible, bornes, séquence — et
   * reprendra au cut suivant. Rien ne doit le remplacer : ni un nouveau lot, ni
   * le mode Natif, ni une analyse assistée. La garantie est ici, dans le
   * moteur, pas dans l'interface : masquer un bouton n'empêche rien.
   * Seuls « Repris manuellement » et « Arrêter » en sortent. */
  batchHoldsContext(){return this.s.batch?.state==='MANUAL_TAKEOVER';}
  assertBatchContextFree(what='cette action'){
   if(!this.batchHoldsContext())return;
   const cut=this.s.batch.manualTakeover?.identity?.cut??this.s.batch.activeIdentity?.cut;
   throw Error(`Reprise manuelle en cours sur le cut ${cut} : ${what} remplacerait le contexte du lot. Déclare « Repris manuellement » pour reprendre, ou arrête le lot.`);}
  writable(identity){if((this.s.blockedTargets||[]).includes(K.key(identity)))throw Error('Ce cut a un résultat incertain archivé : aucune nouvelle écriture automatique dans cette page.');}
  async closeUncertain(){
   /* Une navigation différée non résolue se clôture ici aussi : sans cette
    * sortie l'opérateur resterait enfermé. Rien n'est recommandé à ESV, et le
    * cut est bloqué en écriture automatique comme tout résultat incertain. */
   const defer=this.deferPending();
   if(defer){
    const identity=K.completeIdentity(defer.identity);
    this.s.blockedTargets=[...new Set([...(this.s.blockedTargets||[]),K.key(identity)])];
    if(this.s.batch){this.s.batch.interrupted=Array.isArray(this.s.batch.interrupted)?this.s.batch.interrupted:[];
      this.s.batch.interrupted.push({identity,status:'DEFER_NAVIGATION_CLOSED_BY_OPERATOR',operationId:defer.operationId,
        phase:defer.phase,commandInvoked:defer.commandInvoked??'unknown',evidence:defer.evidence??null});}
    await this.event('defer-intent-closed',{identity,operationId:defer.operationId,batchId:defer.batchId??null,
      phase:defer.phase,commandInvoked:defer.commandInvoked??'unknown',deferredConfirmed:false,counted:false,resent:false});
    this.s.deferIntent=null;
    if(this.s.before&&K.cutId(this.s.before.identity)===K.cutId(identity))await this.archivePending('defer-uncertain-closed');
    this.s.proposal=null;this.s.lidarId=null;this.s.applied=null;this.s.collection='IDLE';
    if(this.s.batch)this.s.batch.state='STOPPED';
    this.s.notice='Navigation différée incertaine archivée. Contrôle ce cut dans ESV ; ouvre un autre cut pour un nouvel essai.';
    if(!this.s.reconcileRequired){await this.save();return;}
   }
   if(!this.s.reconcileRequired){this.s.notice='Aucun résultat incertain à clôturer. Vérifie les bornes et les paramètres du nouveau lot.';await this.save();return;}
   const identity=this.s.intent?.identity||this.s.snapshot?.identity;
   if(identity)this.s.blockedTargets=[...new Set([...(this.s.blockedTargets||[]),K.key(identity)])];
   await this.event('uncertain-result-closed',{identity,intent:this.s.intent,snapshot:this.s.snapshot,batch:this.s.batch,serverConfirmed:false});
   if(this.s.before&&identity&&K.key(this.s.before.identity)===K.key(identity))await this.archivePending('uncertain-result-closed');
   if(!identity||this.s.proposal&&K.key(this.s.proposal.identity)===K.key(identity))this.s.proposal=null;
   this.s.intent=null;this.s.reconcileRequired=false;this.s.snapshot=null;this.s.expected=null;this.s.applied=null;this.s.validationStarted=false;
   if(this.s.batch)this.s.batch.state='STOPPED';
   this.s.notice='Résultat incertain archivé. Contrôle ce cut dans ESV ; ouvre un autre cut pour un nouvel essai.';await this.save();
  }
  async apply(auto=false){
   this.gate();if(this.s.mode==='observation')throw Error('Mode observation : aucune correction.');
   if(!this.s.proposal||!this.s.before)throw Error('Analyse nécessaire.');
   if(this.s.applied?.proposalId===this.s.proposal.id)throw Error('Cette proposition est déjà appliquée.');
   const now=await this.adapter.state();K.assertTarget(this.s.proposal.identity,now.identity);this.writable(now.identity);
   if(!K.equalPoses(this.s.before.rails,now.rails))throw Error('État modifié depuis la proposition.');
   const proposals=this.s.proposal.rails;if(Object.values(proposals).some(p=>!p.delta))throw Error('Une proposition est absente.');
   this.s.snapshot=K.clone(now);this.s.validationStarted=false;
   this.s.expected=K.expectedPoses(now,proposals);this.s.intent={kind:'apply',proposalId:this.s.proposal.id,identity:now.identity};await this.save();
   try{const result=await this.adapter.apply(now,proposals);K.assertTarget(now.identity,result.identity);
    if(!K.equalPoses(this.s.expected,result.rails,.001))throw Error('Application non conforme à la proposition (tolérance de relecture 1 mm).');
    const observedRecord=K.reference(now,result,this.s.lidarId,this.s.sessionId);
    this.s.lastObserved={identity:now.identity,rails:observedRecord.rails};
    this.s.applied={proposalId:this.s.proposal.id,identity:K.completeIdentity(now.identity),observed:result,automatic:auto,
      commandSent:true,afterObserved:true,serverConfirmed:false,navigationObserved:false};this.s.intent=null;
    this.s.notice='Correction appliquée et relue dans la scène.';await this.event('applied-verified',{identity:now.identity,proposalId:this.s.proposal.id,
      commandSent:true,afterObserved:true,serverConfirmed:false,navigationObserved:false,observed:result});return result;
   }catch(e){this.s.reconcileRequired=true;await this.save();throw e;}}
  async restore(){
   if(this.s.mode==='observation')throw Error('Passe en mode assisté pour restaurer.');
   if(!this.s.snapshot)throw Error('Aucun snapshot à restaurer.');
   if(this.s.validationStarted)throw Error('Validation déjà tentée : restauration serveur non démontrée.');
   const now=await this.adapter.state();K.assertTarget(this.s.snapshot.identity,now.identity);
   this.s.intent={kind:'restore',identity:now.identity};await this.save();
   try{const restored=await this.adapter.restore(this.s.snapshot);K.assertTarget(now.identity,restored.identity);
    if(!K.equalPoses(this.s.snapshot.rails,restored.rails,.001))throw Error('Restauration non confirmée.');
    this.s.lastObserved=K.reference(this.s.snapshot,restored,this.s.lidarId,this.s.sessionId);
    this.s.applied=null;this.s.intent=null;this.s.reconcileRequired=false;await this.event('restored',{identity:now.identity});
    this.s.notice='Positions initiales restaurées dans la scène, avant validation.';return restored;
   }catch(e){this.s.reconcileRequired=true;throw e;}}
  async reconcile(){
   const now=await this.adapter.state();if(!this.s.snapshot)throw Error('Aucun snapshot à réconcilier.');
   K.assertTarget(this.s.snapshot.identity,now.identity);
   if(this.s.validationStarted)throw Error('Validation incertaine : vérifier dans ESV, puis clôturer ce lot. Ne pas la relancer automatiquement.');
   if(K.equalPoses(now.rails,this.s.expected||{},.001)){
    this.s.applied={proposalId:this.s.proposal.id,identity:now.identity,observed:now,recovered:true};
   }else if(K.equalPoses(now.rails,this.s.snapshot.rails,.001))this.s.applied=null;
   else throw Error('État intermédiaire : utilise Restaurer sur le même cut avant validation.');
   this.s.intent=null;this.s.reconcileRequired=false;await this.event('reconciled',{identity:now.identity});return now;}
  /* La transition attendue après une commande native : même onglet, même part
   * et mouvement strictement vers l'avant. Le successeur immédiat est admis ;
   * un saut ne l'est que si l'adaptateur atteste le bouton VALIDATE observé,
   * dont le contrat ESV est « Load next non validated cut ». Les cuts compris
   * entre les deux ne sont jamais crédités ni déclarés traités.
   * Le contrôle ne sert qu'à décider si la navigation peut TENIR LIEU de
   * relecture manquée : quand l'état après a été relu, la preuve ne repose pas
   * sur elle et le verdict n'est que consigné. En cas de doute le lot s'arrête,
   * ce qui est le comportement d'avant V4.6.0. */
  expectedTransition(identity,evidence,scope){
   if(evidence.navigationObserved!==true)return{expected:false,reason:'NAVIGATION_NOT_OBSERVED',observed:null};
   const seen=evidence.nextIdentity||evidence.navigationAfter?.identity||evidence.navigationAfter?.label;
   if(!seen)return{expected:false,reason:'NEXT_IDENTITY_UNKNOWN',observed:null};
   const next=K.completeIdentity(seen);
   if(next.pageId!==identity.pageId)return{expected:false,reason:'PAGE_CHANGED',observed:next};
   if(next.part!==identity.part||scope?.part!=null&&next.part!==scope.part)return{expected:false,reason:'PART_CHANGED',observed:next};
   if(!Number.isInteger(next.cut)||!Number.isInteger(identity.cut))return{expected:false,reason:'CUT_NOT_COMPARABLE',observed:next};
   if(next.cut<=identity.cut)return{expected:false,reason:'NO_FORWARD_MOVE',observed:next};
   if(next.cut>identity.cut+1){
     const nextNonValidated=evidence.operatorDecision==='VALIDATE'&&
       evidence.navigationSemantics==='VALIDATE_NEXT_NON_VALIDATED_CUT'&&
       evidence.decisionCommand?.id==='O2N3DCutValidate3DRail';
     if(!nextNonValidated)return{expected:false,reason:'CUTS_SKIPPED',observed:next};
     return{expected:true,reason:'NEXT_NON_VALIDATED_CUT_SAME_PAGE_AND_PART',observed:next};
   }
   return{expected:true,reason:'IMMEDIATE_SUCCESSOR_SAME_PAGE_AND_PART',observed:next};
  }
  /* ------------------------------------------------------------------------
   * BANANE 4.7 — DIFFÉRER UN UNRESOLVED GCV1 (Pilote TEST).
   *
   * Un cut réellement non résolu par GCV1 peut être quitté par une NAVIGATION
   * SANS DÉCISION : aucune application de rail, aucun VALIDATE, aucun SKIP. Le
   * cut source est enregistré une fois comme `DEFERRED_UNRESOLVED` et le lot
   * continue sur la cible réellement affichée.
   *
   * Ce n'est PAS une résolution GCV1, ni une validation humaine, ni un nouveau
   * label scientifique : un rail unresolved reste unresolved. Le gain du lot est
   * la continuité du traitement et l'identification fiable des cas à revoir.
   * ---------------------------------------------------------------------- */
  /* Politique effective du lot. Un lot ANCIEN n'a pas le champ : il garde la
   * pause historique. Le champ est figé à la création et rien — ni redémarrage,
   * ni changement du réglage d'interface — ne le convertit en cours de route. */
  unresolvedPolicy(b){return b?.scope?.unresolvedPolicy==='defer'?'defer':'pause';}
  deferRailView(proposal){return Object.fromEntries(Object.entries(proposal?.rails||{}).map(([side,p])=>[side,
    {status:p.status,confidence:p.confidence,reasons:p.reasons||[],source:p.source||null,
     geometryEngine:p.geometryEngine||null,gcv1:p.gcv1?K.clone(p.gcv1):null,proposal:p.delta||null}]));}
  /* `missing === true` ne prouve rien à lui seul : il dit qu'un delta manque,
   * pas POURQUOI. La branche defer exige une proposition GCV1 attribuée sans
   * ambiguïté au cut courant, avec au moins un rail explicitement abstenu par
   * GCV1. Tout le reste — proposition absente, périmée, d'une autre identité,
   * LiDAR non démontré, repli hors GCV1, delta manquant sans abstention —
   * conserve son diagnostic et sa pause. */
  deferEligibility(identity,b){
   const refuse=(reason,unresolvedRails=[])=>({eligible:false,reason,unresolvedRails});
   if(this.unresolvedPolicy(b)!=='defer')return refuse('POLICY_PAUSE');
   if(b?.scope?.geometryEngine!=='geometry-candidate-v1')return refuse('BATCH_NOT_GCV1_PILOT');
   const proposal=this.s.proposal,target=K.cutId(identity);
   if(!proposal)return refuse('PROPOSAL_MISSING');
   if(K.cutId(proposal.identity)!==target)return refuse('PROPOSAL_IDENTITY_MISMATCH');
   if(!this.s.before||K.cutId(this.s.before.identity)!==target)return refuse('CAPTURE_IDENTITY_MISMATCH');
   if(!this.s.lidarId)return refuse('LIDAR_CAPTURE_NOT_DEMONSTRATED');
   if(b.currentSequence&&b.currentSequence.cutId!==target)return refuse('SEQUENCE_IDENTITY_MISMATCH');
   const selection=proposal.geometrySelection;
   if(selection&&(selection.selectedEngine!=='geometry-candidate-v1'||selection.fallback===true))return refuse('GCV1_NOT_SELECTED');
   const sides=['left','right'],rails=proposal.rails||{};
   if(sides.some(side=>!rails[side]))return refuse('RAIL_PROPOSAL_MISSING');
   if(sides.some(side=>rails[side].geometryEngine!=='geometry-candidate-v1'))return refuse('RAIL_NOT_ATTRIBUTED_TO_GCV1');
   const unresolvedRails=sides.filter(side=>rails[side].status==='unresolved'&&rails[side].source==='geometry-candidate-v1-abstention');
   if(!unresolvedRails.length)return refuse('NO_GCV1_UNRESOLVED_RAIL');
   // Un rail sans delta qui n'est PAS une abstention GCV1 n'est pas un unresolved GCV1.
   if(sides.some(side=>!rails[side].delta&&!unresolvedRails.includes(side)))return refuse('MISSING_DELTA_WITHOUT_GCV1_ABSTENTION',unresolvedRails);
   return {eligible:true,reason:'GCV1_UNRESOLVED_CONFIRMED',unresolvedRails};
  }
  /* Contrat d'acceptation propre à la navigation sans décision. Il ne réutilise
   * PAS `expectedTransition()` : celui-ci refuse tout saut qui n'est pas attesté
   * par le bouton VALIDATE d'ESV, et ses deux verdicts doivent rester
   * inchangés. Ici aucun delta de +1 n'est exigé — 549 → 552 est accepté, et
   * 550/551 n'entrent dans aucune collection. */
  deferTransition(identity,evidence,scope){
   if(identity?.pageId==null||identity?.part==null||!Number.isInteger(identity?.cut))
     return {expected:false,reason:'SOURCE_IDENTITY_INCOMPLETE',observed:null};
   if(evidence?.navigationObserved!==true)return {expected:false,reason:'NAVIGATION_NOT_OBSERVED',observed:null};
   const seen=evidence.nextIdentity||evidence.navigationAfter?.identity||evidence.navigationAfter?.label;
   if(!seen)return {expected:false,reason:'NEXT_IDENTITY_UNKNOWN',observed:null};
   const next=K.completeIdentity(seen);
   if(next.pageId==null||next.part==null)return {expected:false,reason:'NEXT_IDENTITY_INCOMPLETE',observed:next};
   if(next.pageId!==identity.pageId)return {expected:false,reason:'PAGE_CHANGED',observed:next};
   if(next.part!==identity.part||scope?.part!=null&&next.part!==scope.part)return {expected:false,reason:'PART_CHANGED',observed:next};
   if(!Number.isInteger(next.cut))return {expected:false,reason:'CUT_NOT_COMPARABLE',observed:next};
   if(next.cut===identity.cut)return {expected:false,reason:'NO_FORWARD_MOVE',observed:next};
   if(next.cut<identity.cut)return {expected:false,reason:'BACKWARD_MOVE',observed:next};
   return {expected:true,reason:'NEXT_CUT_WITHOUT_DECISION_SAME_PAGE_AND_PART',observed:next};
  }
  deferPending(){return this.s.deferIntent&&this.s.deferIntent.phase!=='FINALIZED'?this.s.deferIntent:null;}
  /* PROTOCOLE DURABLE.
   *
   * Il n'existe aucune transaction commune entre le stockage Banane et l'effet
   * ESV : on ne peut donc pas garantir leur atomicité, seulement conserver
   * explicitement la fenêtre où une commande a pu partir.
   *
   *  1. PRÉPARÉ — intention persistée et confirmée avant toute couche capable
   *     d'agir. Invariant : l'appel adaptateur n'a lieu qu'APRÈS le marqueur 2.
   *  2. ÉMISSION POSSIBLE — marqueur persisté et confirmé. Il n'affirme pas que
   *     la commande est partie ; il interdit d'affirmer le contraire.
   *  3. ACTION — au plus une fois, contrôles de cible et de contexte au plus
   *     près du point d'effet, dans la page.
   *  4. OBSERVATION — preuves recueillies, refus compris ; acceptation selon
   *     `deferTransition()` seulement.
   *  5. FINALISATION — entrée deferred unique, enregistrement, checkpoint de
   *     reprise ; l'intention active n'est effacée qu'ensuite.
   */
  async deferUnresolved(now,b,eligibility){
   const scope=b.scope,identity=K.completeIdentity(now.identity),cutId=K.cutId(identity);
   if(this.deferPending())throw Error('Une navigation différée est déjà en cours : aucune seconde commande.');
   if((b.deferred||[]).some(d=>d.key===cutId))throw Error('Ce cut est déjà différé dans ce lot.');
   const operationId=K.uid();
   const intent={format:'banane-defer-intent-v1',operationId,batchId:b.id??null,phase:'PREPARED',policy:'defer',
     identity,cutId,sequenceIndex:b.currentSequence?.sequenceIndex??null,previousCutId:b.currentSequence?.previousCutId??null,
     proposalId:this.s.proposal?.id??null,lidarCaptureId:this.s.lidarId??null,
     rails:this.deferRailView(this.s.proposal),unresolvedRails:eligibility.unresolvedRails,eligibility:eligibility.reason,
     geominfo:K.clone(this.s.proposal?.geominfo??null),
     scope:{pageId:scope.pageId??null,part:scope.part??null,start:scope.start??null,end:scope.end??null},
     geometryEngine:scope.geometryEngine??null,geometryContract:K.clone(scope.geometryContract??null),
     commandScope:'banane-operation-only',bananeValidated:false,applyCommandSent:false,
     validationCommandSent:false,skipCommandSent:false,commandInvoked:null,
     preparedAt:new Date().toISOString(),emissionPossibleAt:null,observedAt:null,finalizedAt:null,
     startedAtMs:Date.now(),evidence:null,nextIdentity:null,transition:null,refusal:null,nonEmissionProof:null};
   this.s.deferIntent=intent;await this.save(); // 1. Préparé : écriture confirmée avant toute émission possible.
   await this.event('defer-intent',{identity,operationId,batchId:intent.batchId,proposalId:intent.proposalId,
     lidarCaptureId:intent.lidarCaptureId,sequenceIndex:intent.sequenceIndex,previousCutId:intent.previousCutId,
     rails:intent.rails,unresolvedRails:intent.unresolvedRails,policy:'defer',eligibility:intent.eligibility,
     commandRequested:false,commandInvoked:null,bananeValidated:false,validationCommandSent:false,skipCommandSent:false});
   /* Dernière frontière encore révocable : pause, arrêt ou reprise manuelle
    * demandés pendant la préparation empêchent l'émission. */
   if(b.state!=='RUNNING'){this.s.deferIntent=null;
     await this.event('defer-intent-abandoned-before-emission',{identity,operationId,batchId:intent.batchId,
       state:b.state,commandInvoked:false,deferredConfirmed:false});
     await this.save();return {status:'ABANDONED_BEFORE_EMISSION'};}
   intent.phase='COMMAND_MAY_HAVE_BEEN_SENT';intent.emissionPossibleAt=new Date().toISOString();
   await this.save(); // 2. Émission possible : écriture confirmée AVANT l'appel.
   await this.event('defer-command-possible',{identity,operationId,batchId:intent.batchId,proposalId:intent.proposalId,
     commandRequested:true,commandInvoked:null,
     note:'La commande de navigation sans décision peut désormais avoir été émise.'});
   let evidence=null,transportError=null;
   try{evidence=await this.adapter.nextWithoutDecision(identity,scope,operationId);} // 3. Action : au plus une fois.
   catch(e){transportError=e;}
   intent.evidence=K.clone(evidence??null);
   intent.commandInvoked=transportError?'unknown':(evidence?.commandInvoked??'unknown');
   intent.refusal=K.clone(evidence?.refusal??(transportError?{code:'ADAPTER_ERROR',message:transportError.message}:null));
   const transition=this.deferTransition(identity,evidence||{},scope); // 4. Observation.
   intent.transition=transition.reason;
   await this.save();
   await this.event('defer-navigation-observation',{identity,operationId,batchId:intent.batchId,proposalId:intent.proposalId,
     commandInvoked:intent.commandInvoked,navigationObserved:evidence?.navigationObserved===true,
     refusal:intent.refusal,transition:transition.reason,accepted:transition.expected,
     nextIdentity:transition.observed,nextReady:evidence?.nextReady??null,evidence:intent.evidence});
   if(!transition.expected)return await this.deferNotAccepted(b,intent,transition);
   intent.phase='OBSERVED';intent.observedAt=new Date().toISOString();
   intent.nextIdentity=K.completeIdentity(transition.observed);
   await this.save(); // Observation acceptée, durable, avant toute finalisation.
   await this.event('defer-navigation-accepted',{identity,operationId,batchId:intent.batchId,proposalId:intent.proposalId,
     transition:transition.reason,nextIdentity:intent.nextIdentity,commandInvoked:intent.commandInvoked,
     bananeValidated:false,validationCommandSent:false,skipCommandSent:false,applyCommandSent:false,evidence:intent.evidence});
   return await this.finalizeDefer(b); // 5. Finalisation durable.
  }
  /* Aucune progression acceptée. Deux situations, jamais confondues :
   * — la NON-ÉMISSION est PROUVÉE (refus rendu par l'adaptateur avant le clic) :
   *   le cut retombe sur la pause historique, avec ses quatre actions ;
   * — sinon l'émission reste INCERTAINE : état explicite, intention et preuves
   *   conservées, aucun renvoi automatique. Un timeout ou un accusé absent ne
   *   prouve pas la non-émission. */
  async deferNotAccepted(b,intent,transition){
   const proven=intent.commandInvoked===false&&!!intent.refusal;
   const code=proven?'DEFER_NAVIGATION_NOT_EMITTED'
     :transition.reason==='NAVIGATION_NOT_OBSERVED'?'DEFER_NO_PROGRESS':'DEFER_TRANSITION_REFUSED';
   const message=proven
     ?`Navigation sans décision impossible sur le cut ${intent.identity.cut} (${intent.refusal.code}) : aucune commande n’a été émise.`
     :`Navigation sans décision transmise sur le cut ${intent.identity.cut}, sans progression acceptée (${transition.reason}). Elle ne sera pas renvoyée.`;
   if(proven){
     intent.phase='NOT_EMITTED';intent.nonEmissionProof=intent.refusal.code;await this.save();
     await this.event('defer-navigation-not-emitted',{identity:intent.identity,operationId:intent.operationId,
       batchId:intent.batchId,code,refusal:intent.refusal,commandInvoked:false,resent:false,deferredConfirmed:false});
     this.s.deferIntent=null;
     /* Un arrêt demandé pendant l'attente n'est jamais annulé par le retour de
      * l'action : rendre les quatre actions de la pause rouvrirait des écritures
      * ESV que l'opérateur vient d'interdire. */
     if(b.state==='STOPPED'){
       b.interrupted=Array.isArray(b.interrupted)?b.interrupted:[];
       b.interrupted.push({identity:K.completeIdentity(intent.identity),status:code,operationId:intent.operationId,
         commandInvoked:false,refusal:intent.refusal,transition:transition.reason});
       this.s.notice=message+' Le lot est arrêté.';
     }else{
       // Retour au comportement historique : le cut reste en main, sans commande.
       this.pauseUnresolvedRail(b,intent.identity,{deferAttempt:{operationId:intent.operationId,outcome:code,
         refusal:intent.refusal,commandInvoked:false,transition:transition.reason}});
       this.s.notice=message+' Choisis Réessayer, Reprise manuelle, SKIP explicite ou Arrêter.';
     }
     b.error={code,step:b.step,timestamp:new Date().toISOString(),message};
     await this.save();return {status:code};
   }
   b.interrupted=Array.isArray(b.interrupted)?b.interrupted:[];
   b.interrupted.push({identity:K.completeIdentity(intent.identity),status:code,operationId:intent.operationId,
     commandInvoked:intent.commandInvoked,transition:transition.reason,observedIdentity:transition.observed||null,
     refusal:intent.refusal,evidence:intent.evidence});
   /* Un arrêt explicite de l'opérateur n'est pas écrasé : il reste la décision
    * la plus forte. L'intention non résolue bloque de toute façon la reprise. */
   if(b.state!=='STOPPED')b.state='PAUSED_DEFER_NAVIGATION_UNCERTAIN';
   b.error={code,step:b.step,timestamp:new Date().toISOString(),message};
   this.s.notice=message+' Contrôle ce cut dans ESV, puis clôture ce résultat incertain.';
   await this.save();
   await this.event('defer-navigation-uncertain',{identity:intent.identity,operationId:intent.operationId,
     batchId:intent.batchId,code,transition:transition.reason,observedIdentity:transition.observed||null,
     commandInvoked:intent.commandInvoked,refusal:intent.refusal,resent:false,deferredConfirmed:false,counted:false});
   return {status:code};
  }
  /* Pause historique d'un rail non résolu, extraite pour être partagée par le
   * chemin `pause` et par l'échec PROUVÉ de la navigation sans décision. */
  pauseUnresolvedRail(b,identity,extra={}){
   const paused={status:'PAUSED_UNRESOLVED_RAIL',identity:K.completeIdentity(identity),before:K.clone(this.s.before),
     lidarCaptureId:this.s.lidarId,proposal:K.clone(this.s.proposal),
     rails:Object.fromEntries(Object.entries(this.s.proposal?.rails||{}).map(([side,p])=>[side,{status:p.status,confidence:p.confidence,reasons:p.reasons,proposal:p.delta||null}])),
     geominfo:this.s.proposal?.geominfo,sequenceIndex:b.currentSequence?.sequenceIndex??null,
     unresolvedPolicy:this.unresolvedPolicy(b),...extra,
     actions:['RETRY','MANUAL_TAKEOVER','EXPLICIT_SKIP','STOP'],pausedAt:new Date().toISOString()};
   b.state='PAUSED_UNRESOLVED_RAIL';b.pauseReason='unresolved-rail';b.step='apply';b.paused.push(paused);
   return paused;
  }
  /* Finalisation durable, idempotente : UNE entrée deferred par identité
   * complète de cut dans un lot, l'opération servant de clé de déduplication.
   * Rejouée après une interruption, elle ne commande rien à ESV et ne
   * multiplie ni l'entrée, ni l'enregistrement. */
  async finalizeDefer(b,{recovered=false}={}){
   const intent=this.s.deferIntent;
   if(!intent||intent.phase!=='OBSERVED')throw Error('Aucune navigation différée observée à finaliser.');
   const identity=K.completeIdentity(intent.identity),key=K.cutId(identity);
   const nextIdentity=K.completeIdentity(intent.nextIdentity),nextCutId=K.cutId(nextIdentity);
   b.deferred=Array.isArray(b.deferred)?b.deferred:[];
   const recordId='defer-'+intent.operationId;
   if(!b.deferred.some(d=>d.operationId===intent.operationId||d.key===key)){
    const record={id:recordId,recordId,format:'banane-deferred-unresolved-v1',version:K.VERSION,
      source:'pilot-gcv1-unresolved-deferred',batchId:intent.batchId,operationId:intent.operationId,
      identity,before:K.clone(this.s.before),lidarCaptureId:intent.lidarCaptureId??null,
      lidarCaptureStatus:intent.lidarCaptureId?'persisted-on-intent':'not-available',
      proposalId:intent.proposalId,proposal:K.clone(this.s.proposal),rails:intent.rails,
      unresolvedRails:intent.unresolvedRails,geominfo:intent.geominfo,
      geometryEngine:intent.geometryEngine,geometryContract:intent.geometryContract,
      decision:'DEFERRED_UNRESOLVED',operatorDecision:null,
      decisionRule:'pilot-defer-gcv1-unresolved-by-navigation-without-decision',
      scientificDecisionPreserved:'gcv1-unresolved-rails-remain-unresolved',
      /* Ce que ces champs disent : les commandes Banane de CETTE opération. Ce
       * n'est pas un audit rétroactif de tout ce qu'ESV a pu connaître sur ce
       * cut, ni la preuve qu'aucun humain ne l'a jamais modifié. */
      commandScope:'banane-operation-only',bananeValidated:false,applyCommandSent:false,
      validationCommandSent:false,skipCommandSent:false,commandSent:false,
      navigationWithoutDecisionSent:intent.commandInvoked===true,commandInvoked:intent.commandInvoked,
      afterObserved:false,serverConfirmed:false,navigationObserved:true,
      afterStateStatus:'NOT_OBSERVED_NO_DECISION_SENT',status:'deferred-unresolved',validationProof:'none',
      nextIdentity,navigationAfter:K.clone(intent.evidence?.navigationAfter??null),
      transition:intent.transition,evidence:intent.evidence,
      sequenceIndex:intent.sequenceIndex,previousCutId:intent.previousCutId,nextCutId,
      usableForTraining:false,trainingExclusionReason:'gcv1-unresolved-deferred',
      preparedAt:intent.preparedAt,emissionPossibleAt:intent.emissionPossibleAt,observedAt:intent.observedAt,
      recoveredFinalization:recovered,deferredAt:new Date().toISOString()};
    await this.store.putRecord(record);
    if(!this.s.records.some(r=>(r.recordId||r.id)===recordId))this.s.records.push(record);
    b.deferred.push({key,operationId:intent.operationId,identity,cut:identity.cut,recordId,
      sequenceIndex:intent.sequenceIndex,previousCutId:intent.previousCutId,nextCutId,nextIdentity,
      proposalId:intent.proposalId,lidarCaptureId:intent.lidarCaptureId??null,rails:intent.rails,
      unresolvedRails:intent.unresolvedRails,transition:intent.transition,policy:'defer',
      bananeValidated:false,commandInvoked:intent.commandInvoked,evidence:intent.evidence,
      recovered,durationMs:Number.isFinite(intent.startedAtMs)?Date.now()-intent.startedAtMs:null,
      deferredAt:record.deferredAt});
   }
   b.lastDeferredIdentity=identity;
   if(b.currentSequence&&b.currentSequence.cutId===key)b.currentSequence.nextCutId=nextCutId;
   // Données transitoires du cut source nettoyées, provenance conservée par l'archive.
   if(this.s.before&&K.cutId(this.s.before.identity)===key)await this.archivePending('deferred-unresolved');
   this.s.lidarId=null;this.s.proposal=null;this.s.applied=null;this.s.snapshot=null;this.s.expected=null;
   this.s.collection='IDLE';b.currentSequence=null;b.step='capture';b.pauseReason=null;b.error=null;
   b.activeIdentity=nextIdentity; // Checkpoint de reprise : la cible acceptée.
   intent.phase='FINALIZED';intent.finalizedAt=new Date().toISOString();
   await this.save();
   await this.event('defer-finalized',{identity,operationId:intent.operationId,batchId:intent.batchId,
     proposalId:intent.proposalId,lidarCaptureId:intent.lidarCaptureId??null,recordId,
     rails:intent.rails,unresolvedRails:intent.unresolvedRails,nextIdentity,transition:intent.transition,
     sequenceIndex:intent.sequenceIndex,previousCutId:intent.previousCutId,nextCutId,
     status:'DEFERRED_UNRESOLVED',deferredConfirmed:true,recovered,commandInvoked:intent.commandInvoked,
     commandScope:'banane-operation-only',bananeValidated:false,applyCommandSent:false,
     validationCommandSent:false,skipCommandSent:false,evidence:intent.evidence});
   this.s.notice=`Cut ${identity.cut} non résolu par GCV1 : différé sans décision. Lot poursuivi sur le cut ${nextIdentity.cut}.`;
   // L'intention active ne s'efface qu'une fois preuves ET checkpoint durables.
   this.s.deferIntent=null;await this.save();
   return {status:'DEFERRED_UNRESOLVED',nextIdentity,nextReady:intent.evidence?.nextReady??null,operationId:intent.operationId};
  }
  /* TABLE DE REPRISE. Elle est lue depuis les SEULES données persistées : un
   * redémarrage ne conserve aucune variable du processus interrompu. */
  async recoverDefer(){
   const intent=this.s.deferIntent;if(!intent)return;
   const b=this.s.batch;
   if(intent.phase==='FINALIZED'){this.s.deferIntent=null;return;}
   if(!b||(intent.batchId??null)!==(b.id??null)){
    /* Intention orpheline : conservée, jamais rejouée. Elle bloque toute
     * reprise jusqu'à sa clôture. Signalée UNE fois : `init()` s'exécute à
     * chaque démarrage du service worker, et le journal est plafonné. */
    if(!intent.orphanReported){intent.orphanReported=true;
      await this.event('defer-intent-orphaned',{identity:intent.identity,operationId:intent.operationId,
        batchId:intent.batchId??null,phase:intent.phase,commandInvoked:intent.commandInvoked??'unknown',
        resent:false,deferredConfirmed:false});}
    this.s.notice='Intention de navigation différée sans lot correspondant : clôture-la avant toute nouvelle action.';
    return;
   }
   b.interrupted=Array.isArray(b.interrupted)?b.interrupted:[];
   /* Préparé : l'invariant du protocole interdit toute émission avant le
    * marqueur suivant, qui n'a pas été écrit. Rien n'est parti ; le cut sera
    * réévalué à la reprise, après revérification de l'identité et du contexte
    * par la boucle du lot. */
   if(intent.phase==='PREPARED'||intent.phase==='NOT_EMITTED'&&intent.nonEmissionProof){
    b.interrupted.push({identity:K.completeIdentity(intent.identity),status:'DEFER_INTENT_NOT_EMITTED',
      operationId:intent.operationId,commandInvoked:false,
      nonEmissionProof:intent.nonEmissionProof||'no-emission-marker-persisted-before-restart'});
    this.s.deferIntent=null;
    this.s.notice='Navigation différée préparée sans qu’aucune commande ait pu partir. Le cut sera réévalué à la reprise.';
    await this.event('defer-intent-not-emitted-on-restart',{identity:intent.identity,operationId:intent.operationId,
      batchId:intent.batchId,commandInvoked:false,resent:false,deferredConfirmed:false,counted:false});
    return;
   }
   /* Observation acceptée durable, finalisation incomplète : SEULES les
    * écritures locales sont complétées, de façon idempotente. Aucune commande
    * ESV n'est envoyée. */
   if(intent.phase==='OBSERVED'){
    await this.finalizeDefer(b,{recovered:true});
    this.s.notice='Navigation différée observée avant l’interruption : écritures locales complétées, aucune commande ESV renvoyée.';
    return;
   }
   /* Émission possible sans observation acceptée durable. Un redémarrage juste
    * après le marqueur — même avant l'appel réel — reste incertain : ni le
    * timeout ni l'absence d'accusé ne prouvent la non-émission. */
   // Comme ci-dessus : un arrêt explicite antérieur reste la décision la plus forte.
   if(b.state!=='STOPPED')b.state='PAUSED_DEFER_NAVIGATION_UNCERTAIN';
   b.error={code:'DEFER_NAVIGATION_UNCERTAIN_BEFORE_RESTART',step:b.step,timestamp:new Date().toISOString(),
     message:'Navigation sans décision peut-être émise, sans progression acceptée avant le redémarrage.'};
   b.interrupted.push({identity:K.completeIdentity(intent.identity),status:'DEFER_NAVIGATION_UNCERTAIN',
     operationId:intent.operationId,commandInvoked:intent.commandInvoked??'unknown',
     transition:intent.transition??null,refusal:intent.refusal??null,evidence:intent.evidence??null});
   this.s.notice='Navigation sans décision peut-être partie avant l’interruption, sans progression acceptée. Elle ne sera pas renvoyée : contrôle le cut dans ESV, puis clôture ce résultat.';
   await this.event('defer-navigation-uncertain-on-restart',{identity:intent.identity,operationId:intent.operationId,
     batchId:intent.batchId,commandInvoked:intent.commandInvoked??'unknown',phase:intent.phase,
     resent:false,deferredConfirmed:false,counted:false});
  }
  async validateAndNext(scope){
   this.gate();const now=await this.adapter.state();
   if(!this.s.applied)throw Error('Aucune application vérifiée.');K.assertTarget(this.s.applied.identity,now.identity);
   this.writable(now.identity);
   if(!K.equalPoses(this.s.applied.observed.rails,now.rails,.001))throw Error('Rails modifiés depuis la vérification.');
   if(this.s.collection==='READY_FOR_AFTER')await this.finish('automatic-test-before-after',this.s.batch?.currentSequence);
   /* V4.6.0, revue Astra complémentaire. `s.events` survit d'un lot à l'autre :
    * une identité de cut ne désigne donc PAS une tentative. Le même cut 100
    * peut avoir été accepté par un lot antérieur, et cette acceptation traîne
    * encore dans le journal. Chaque validation reçoit ici son identifiant
    * propre, créé AVANT la requête irréversible et persisté avec `applied` et
    * l'intent, avec le lot et la proposition auxquels il appartient.
    * `init()` ne recrédite que sur cet identifiant. */
   const attempt={validationAttemptId:K.uid(),batchId:this.s.batch?.id??null,
     proposalId:this.s.applied.proposalId??null,cutId:K.cutId(now.identity)};
   this.s.validationStarted=true;this.s.applied.validationAttempt=attempt;
   this.s.intent={kind:'validate',identity:now.identity,...attempt};
   await this.event('validation-intent',{identity:now.identity,...attempt,commandSent:false,afterObserved:false,serverConfirmed:false,navigationObserved:false}); // Persist before the irreversible request.
   let outcomeObserved=false;
   try{const evidence=await this.adapter.validateAndNext(now.identity,scope);
    if(evidence.commandSent!==true)throw Error('La commande native n’est pas journalisée comme transmise.');
    if(!evidence.navigationObserved&&!evidence.serverConfirmed)throw Error('Résultat de validation/navigation ambigu.');
    outcomeObserved=true;this.s.intent=null;
    /* V4.6.0, défaut 4 d'AUDIT_PILOTE.md. `startBatch` EXIGE déjà
     * `allowNavigationEvidence` pour seulement démarrer, faute de confirmation
     * serveur sur cet ESV. Mais sur le chemin où la navigation EST observée et
     * la relecture manquée, l'ancien ordre levait AFTER_STATE_MISSING avant
     * d'atteindre la ligne qui lisait cette déclaration : la politique était
     * obligatoire et inatteignable exactement là où elle servait. Elle est
     * consultée ici. 12 lots sur 12 s'arrêtaient là le 15/09.
     *
     * Ce que cela n'autorise PAS : compter une validation. L'enregistrement
     * garde `AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED` et
     * `usableForTraining:false` ; il n'existe aucune confirmation serveur, et
     * `validationProof:'navigation-only'` dit sur quoi l'avancement repose. */
    const transition=this.expectedTransition(now.identity,evidence,scope);
    const acceptedOnNavigation=evidence.afterObserved!==true&&scope?.allowNavigationEvidence===true&&transition.expected;
    evidence.expectedTransition=transition.reason;evidence.navigationMatchedExpectedTransition=transition.expected;
    evidence.acceptedOnNavigationEvidence=acceptedOnNavigation;
    evidence.validationProof=evidence.serverConfirmed===true?'server-confirmed':evidence.afterObserved===true?'after-state-observed':acceptedOnNavigation?'navigation-only':'none';
    this.s.lastActionEvidence=K.clone(evidence);
    const record=this.s.records.slice().reverse().find(r=>K.cutId(r.identity)===K.cutId(now.identity));
    if(record){Object.assign(record,{commandSent:true,afterObserved:evidence.afterObserved===true,afterStateStatus:evidence.afterStateStatus,
      serverConfirmed:evidence.serverConfirmed===true,navigationObserved:evidence.navigationObserved===true,navigationAfter:evidence.navigationAfter||null,
      nextCutId:evidence.nextIdentity?K.cutId(evidence.nextIdentity):null,navigationMatchedExpectedTransition:transition.expected,
      expectedTransition:transition.reason,acceptedOnNavigationEvidence:acceptedOnNavigation,validationProof:evidence.validationProof});
      if(!record.afterObserved){record.status='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED';record.usableForTraining=false;}
      await this.store.putRecord(record);}
    await this.event('validation-observation',{identity:now.identity,...attempt,commandSent:true,afterObserved:evidence.afterObserved===true,
      afterStateStatus:evidence.afterStateStatus,serverConfirmed:evidence.serverConfirmed===true,navigationObserved:evidence.navigationObserved===true,
      navigationMatchedExpectedTransition:transition.expected,expectedTransition:transition.reason,validationProof:evidence.validationProof,evidence});
    if(evidence.afterObserved!==true&&!acceptedOnNavigation){const error=Error('AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');
      error.code='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED';error.transition=transition;throw error;}
    if(!evidence.serverConfirmed&&!scope.allowNavigationEvidence)throw Error('Navigation observée, confirmation serveur absente selon la politique choisie.');
    if(acceptedOnNavigation)
      this.s.notice=`Cut ${now.identity.cut} : commande envoyée, navigation attendue vers ${transition.observed.cut} observée, état final non relu. Le lot avance sur la navigation ; ce cut n’est pas déclaré validé.`;
    /* Le SEUL marqueur durable d'une action acceptée pour le lot, émis une fois
     * tous les contrôles passés — jamais avant. `init()` ne crédite `processed`
     * que sur lui : un `validation-observation`, journalisé plus haut quel que
     * soit le verdict, ne vaut pas acceptation. */
    await this.event('validation-accepted',{identity:now.identity,...attempt,action:'VALIDATE',
      acceptedOnNavigationEvidence:acceptedOnNavigation,validationProof:evidence.validationProof,
      transition:transition.reason,nextIdentity:transition.observed,evidence});
    return evidence;
   }catch(e){this.s.reconcileRequired=!outcomeObserved;await this.save();throw e;}}
  async exportReferences(){const data={format:'banane-manual-references-v3',version:K.VERSION,sessionId:this.s.sessionId,
    exportedAt:new Date().toISOString(),records:this.s.records,incompleteCaptures:this.s.incomplete};
   if(this.s.collection==='AFTER_CAPTURED')this.s.collection='EXPORTED';await this.save();return data;}
  async startBatch(scope){
   if(this.task||this.busy)throw Error('Une opération est déjà en cours.');
   this.assertBatchContextFree('un nouveau lot');
   this.busy=true;try{
   if(this.s.mode!=='automatic-test')throw Error('Choisis Automatique TEST.');
   if(!scope.testConfirmed)throw Error('Le périmètre doit être déclaré TEST au lancement du lot.');
   if(!Number.isInteger(scope.part)||!Number.isInteger(scope.start)||!Number.isInteger(scope.end)||scope.start<0||scope.end<scope.start)throw Error('Bornes du lot invalides.');
   if(!['pause','skip','attempt'].includes(scope.lowConfidence))throw Error('Politique de faible confiance invalide.');
   if(scope.unresolvedPolicy!==undefined&&scope.unresolvedPolicy!==null&&!['pause','defer'].includes(scope.unresolvedPolicy))throw Error('Politique de rail non résolu invalide.');
   if(this.deferPending())throw Error('Navigation différée non résolue : clôture ce résultat avant de lancer un nouveau lot.');
   if(!scope.allowNavigationEvidence&&this.adapter.capabilities?.serverConfirmation!==true)throw Error('Avant de lancer : coche « Continuer sur navigation observée, sans preuve serveur ». La V3 ne dispose pas de confirmation serveur ; aucun rail n’a été déplacé par ce lancement.');
   const now=await this.observe();if(now.identity.part!==scope.part||now.identity.cut!==scope.start)throw Error('Ouvre le premier cut du lot dans ESV.');
   if(this.s.before&&(this.s.collection==='READY_FOR_AFTER'||this.s.collection==='BEFORE_CAPTURED'&&(this.s.lidarId||this.s.intent||this.s.applied)))throw Error('Termine ou annule la capture manuelle avant de lancer un lot.');
   if(this.s.before&&this.s.collection==='BEFORE_CAPTURED'&&!K.equalPoses(this.s.before.rails,now.rails))throw Error('Rails modifiés depuis la lecture interrompue : capture initiale conservée.');
   const uncertain=this.s.intent?.identity||this.s.snapshot?.identity;
   if(this.s.reconcileRequired&&this.s.intent?.kind==='validate'&&uncertain&&
     (uncertain.part!==now.identity.part||uncertain.cut!==now.identity.cut)){
     await this.closeUncertain();
     await this.event('new-test-after-uncertain-validation',{previousIdentity:uncertain,nextIdentity:now.identity});
   }
   if(this.s.reconcileRequired&&this.s.intent?.kind==='validate')throw Error(`La validation du cut ${uncertain?.cut} reste à contrôler dans ESV. Ouvre un autre cut pour un nouvel essai ; cette validation ne sera pas renvoyée.`);
   this.gate();this.writable(now.identity);
   const normalizedScope={...scope,pageId:now.identity.pageId};
   if(normalizedScope.lowConfidence==='skip')normalizedScope.lowConfidence='pause';
   /* Politique figée dans le scope persistant à la CRÉATION du lot. Défaut des
    * nouveaux lots Pilote TEST : différer. Un choix explicite est respecté, et
    * hors Pilote GCV1 rien ne change — la pause reste le défaut. */
   normalizedScope.unresolvedPolicy=scope.unresolvedPolicy??(scope.geometryEngine==='geometry-candidate-v1'?'defer':'pause');
   this.s.batch={id:K.uid(),state:'RUNNING',step:'capture',scope:normalizedScope,processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[],
     activeIdentity:K.completeIdentity(now.identity),lastCompletedIdentity:null,startedAt:new Date().toISOString()};
   await this.event('batch-started',{batch:this.s.batch});
   if(scope.lowConfidence==='skip')await this.event('legacy-automatic-skip-disabled',{identity:now.identity,requestedPolicy:'skip',effectivePolicy:'pause'});
   }catch(e){this.busy=false;throw e;}this.launch();return this.view();}
  launch(){this.task=this.run().finally(()=>{this.task=null;this.busy=false;});}
  async boundary(){if(this.s.batch.state!=='RUNNING')return false;await this.save();return true;}
  /* « COMPLETED » s'affiche « Terminé confirmé » dans le panneau. Un lot qui
   * contient une action sans confirmation serveur — ou un cut repris à la main,
   * que Banane n'a pas validé — ne peut pas porter ce mot. */
  /* Un cut différé est une action native sans confirmation serveur : il retire
   * lui aussi le droit au mot « Terminé confirmé ». */
  closingState(b){return b.processed.some(x=>!x.evidence?.serverConfirmed)||b.skipped.some(x=>!x.evidence?.serverConfirmed)||b.manuallyCompleted?.length>0||b.deferred?.length>0
    ?'FINISHED_WITH_UNCONFIRMED_ACTIONS':'COMPLETED';}
  async run(){this.busy=true;const b=this.s.batch;
   try{while(await this.boundary()){
     const now=await this.adapter.state(),scope=b.scope,k=K.key(now.identity);
     if(now.identity.pageId!==scope.pageId||now.identity.part!==scope.part)throw Error('Sortie inattendue de l’onglet ou de la part du lot.');
     if(now.identity.cut>scope.end){b.state=this.closingState(b);break;}
     if(now.identity.cut<scope.start)throw Error('Cut hors périmètre.');
     const fullKey=K.cutId(now.identity);b.activeIdentity=K.completeIdentity(now.identity);b.sequence=b.sequence||[];
     if(!b.currentSequence||b.currentSequence.cutId!==fullKey){const sequenceIndex=b.sequence.length,previousCutId=b.sequence.at(-1)?.cutId??null;
       b.currentSequence={sequenceIndex,cutId:fullKey,identity:K.completeIdentity(now.identity),previousCutId,nextCutId:null};b.sequence.push(b.currentSequence);}
     // Un cut repris à la main compte comme traité : le lot ne doit jamais le redémarrer.
     // Un cut différé non plus : y revenir signalerait une navigation inattendue.
     if([...b.processed,...b.skipped,...(b.manuallyCompleted||[]),...(b.deferred||[])].some(x=>x.key===fullKey||x.key===k))throw Error('Cut déjà traité dans ce lot : boucle arrêtée.');
     if(b.step==='capture'){
       b.cutStartedAt=new Date().toISOString();
       if(this.s.collection==='STALE')await this.archivePending('batch-new-target');
       await this.begin();b.step='analyze';await this.save();}
     if(!await this.boundary())break;
     if(b.step==='analyze'){await this.analyze();b.step='apply';await this.save();}
     if(!await this.boundary())break;
     const fits=Object.values(this.s.proposal.rails),missing=fits.some(p=>!p.delta),low=missing||fits.some(p=>p.confidence<this.s.settings.minConfidence);
     if(b.step==='apply'&&missing){
       /* Si UN SEUL rail est non résolu, le cut entier est différé : le rail
        * candidat n'est pas appliqué d'abord. La branche defer passe avant la
        * question de confiance, qui ne change pas. */
       const eligibility=this.deferEligibility(now.identity,b);
       if(eligibility.eligible){
         const outcome=await this.deferUnresolved(now,b,eligibility);
         if(outcome.status!=='DEFERRED_UNRESOLVED')break;
         const target=outcome.nextIdentity;
         // Bornes appliquées APRÈS validation de l'identité et de la transition.
         if(now.identity.cut>=scope.end||Number.isInteger(target?.cut)&&target.cut>scope.end){b.state=this.closingState(b);break;}
         if(outcome.nextReady===false){if(b.state==='RUNNING'){b.state='PAUSED';
           this.s.notice=`Cut ${now.identity.cut} différé. Attends le chargement des rails du cut ${target.cut}, puis clique sur Reprendre.`;}break;}
         continue;
       }
       const paused=this.pauseUnresolvedRail(b,now.identity,
         this.unresolvedPolicy(b)==='defer'?{deferRefused:{reason:eligibility.reason}}:{});
       this.s.notice='Rail non résolu : cut conservé sans commande. Choisis Réessayer, Reprise manuelle, SKIP explicite ou Arrêter.';
       await this.event('batch-paused-unresolved-rail',{identity:now.identity,paused,
         unresolvedPolicy:this.unresolvedPolicy(b),deferEligibility:eligibility.reason});break;
     }
     if(b.step==='apply'&&low&&scope.lowConfidence!=='attempt'){
       b.state='PAUSED';b.pauseReason='low-confidence';b.paused.push({status:'PAUSED_LOW_CONFIDENCE',identity:K.completeIdentity(now.identity),
         before:K.clone(this.s.before),lidarCaptureId:this.s.lidarId,proposal:K.clone(this.s.proposal),sequenceIndex:b.currentSequence.sequenceIndex,
         actions:['RETRY','MANUAL_TAKEOVER','EXPLICIT_SKIP','STOP'],pausedAt:new Date().toISOString()});
       this.s.notice='Faible confiance : lot en pause, aucune commande native envoyée.';break;
     }
     if(b.step==='apply'){await this.apply(true);b.step='validate';await this.save();}
     if(!await this.boundary())break;
     if(b.step==='validate'){
       const evidence=await this.validateAndNext(scope);if(evidence.nextIdentity)b.currentSequence.nextCutId=K.cutId(evidence.nextIdentity);
       b.processed.push({key:fullKey,identity:K.completeIdentity(now.identity),cut:now.identity.cut,sequenceIndex:b.currentSequence.sequenceIndex,
         previousCutId:b.currentSequence.previousCutId,nextCutId:b.currentSequence.nextCutId,evidence,durationMs:Date.now()-Date.parse(b.cutStartedAt)});
       b.lastCompletedIdentity=K.completeIdentity(now.identity);b.step='capture';
       this.s.proposal=null;this.s.applied=null;await this.save();
       if(now.identity.cut===scope.end){b.state=this.closingState(b);break;}
       if(evidence.nextReady===false){if(b.state==='RUNNING'){b.state='PAUSED';this.s.notice='Navigation observée. Attends le chargement des rails du cut suivant, puis clique sur Reprendre.';}break;}
     }
   }}catch(e){
     if(b.state==='STOPPED')await this.event('batch-action-interrupted',{message:e.message,step:b.step});
     else if(b.step==='capture'&&K.transientCaptureError(e)){
       b.state='PAUSED';b.error={message:e.message,step:b.step,timestamp:new Date().toISOString(),retryableCapture:true};
       this.s.notice=e.message+' Lot en pause. Attends le chargement puis clique sur Reprendre ; aucune capture à annuler.';
       await this.event('batch-capture-wait',{identity:this.s.before?.identity,message:e.message});
     }else if(e.code==='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED'){
       b.state='PAUSED_AFTER_STATE_MISSING';b.error={code:e.code,message:e.message,step:b.step,timestamp:new Date().toISOString()};
       b.interrupted.push({identity:K.completeIdentity(this.s.applied?.identity||b.activeIdentity),status:e.code,evidence:this.s.lastActionEvidence});
       this.s.notice='Commande envoyée, mais le cut a changé avant la relecture de l’état final. Avancement automatique suspendu.';
       await this.event('batch-after-state-missing',{identity:this.s.applied?.identity||b.activeIdentity,evidence:this.s.lastActionEvidence});
     }else{b.state=e.message.includes('Adaptateur ESV sans réponse')?'PAUSED_ADAPTER_UNRESPONSIVE':'ERROR';
       b.error={message:e.message,step:b.step,timestamp:new Date().toISOString()};this.s.notice=e.message;await this.event('batch-error',{message:e.message,step:b.step});}
   }
   finally{await this.event('batch-state',{identity:b.activeIdentity,state:b.state,step:b.step,processed:b.processed.length,skipped:b.skipped.length});}}
  async pause(){if(this.s.batch?.state==='RUNNING'){this.s.batch.state='PAUSED';this.s.notice='Pause demandée, après l’action en cours.';await this.save();}}
  async stop(){if(this.s.batch){this.s.batch.state='STOPPED';this.s.notice='Arrêt demandé, aucune nouvelle action après celle en cours.';await this.adapter.cancel?.();await this.save();}}
  pausedProposalAction(b){return !!b&&b.step==='apply'&&['unresolved-rail','low-confidence'].includes(b.pauseReason);}
  async retryPaused(){const b=this.s.batch;if(!this.pausedProposalAction(b))throw Error('Ce cut pausé ne peut pas être réessayé automatiquement.');
   const now=await this.adapter.state();K.assertTarget(b.activeIdentity,now.identity);
   b.interrupted.push({identity:K.completeIdentity(b.activeIdentity),status:'RETRY_REQUESTED',proposal:K.clone(this.s.proposal),lidarCaptureId:this.s.lidarId});
   await this.archivePending('retry-unresolved-rail');this.s.proposal=null;this.s.lidarId=null;this.s.collection='IDLE';
   b.state='RUNNING';b.step='capture';b.pauseReason=null;b.error=null;await this.event('batch-retry-requested',{identity:now.identity});this.launch();
  }
  async manualTakeover(){const b=this.s.batch;if(!this.pausedProposalAction(b))throw Error('Ce cut pausé ne peut pas passer en reprise manuelle.');
   const now=await this.adapter.state();K.assertTarget(b.activeIdentity,now.identity);
   b.interrupted.push({identity:K.completeIdentity(now.identity),status:'MANUAL_TAKEOVER',proposal:K.clone(this.s.proposal),lidarCaptureId:this.s.lidarId});
   /* Ce qui est mis de côté pour que `manualCompletion()` puisse tracer la
    * provenance du cut rendu, et pour rendre son mode au lot à la reprise. */
   b.manualTakeover={identity:K.completeIdentity(now.identity),startedAt:new Date().toISOString(),modeBeforeTakeover:this.s.mode,
     before:K.clone(this.s.before),lidarCaptureId:this.s.lidarId,proposal:K.clone(this.s.proposal),sequence:K.clone(b.currentSequence||null)};
   await this.archivePending('manual-takeover-unresolved-rail');
   b.manualTakeover.archivedCaptureId=this.s.incomplete.at(-1)?.id||null;
   b.state='MANUAL_TAKEOVER';b.step='manual';this.s.mode='observation';
   /* Le mode Correction a été retiré en 4.5.4 : ce message ne renvoie plus vers
    * un flux qui n'existe pas. Le cut se corrige dans ESV, puis se déclare. */
   this.s.notice=`Cut ${now.identity.cut} rendu : corrige-le dans ESV et ouvre le cut suivant, puis déclare « Repris manuellement » pour que le lot reprenne.`;
   await this.event('batch-manual-takeover',{identity:now.identity});
  }
  /* V4.6.0, défaut 9 d'AUDIT_PILOTE.md. `manualTakeover()` était une impasse :
   * aucun chemin ne ramenait le lot en RUNNING, si bien qu'un seul cut ambigu
   * coupait les 22 autres d'un lot de 23. L'opérateur corrige le cut dans ESV,
   * y navigue lui-même, puis le déclare ici.
   *
   * CE QUE BANANE NE PRÉTEND PAS. Elle n'a envoyé aucune commande sur ce cut,
   * n'a pas relu son état final et n'a aucune confirmation serveur : le cut
   * n'entre pas dans `processed`, qui ne compte que les validations conduites
   * par Banane, et son enregistrement porte `bananeValidated:false`,
   * `commandSent:false`, `usableForTraining:false`. Ce qu'elle sait se limite à
   * ceci : l'opérateur a déclaré la reprise, et le cut affiché est bien le
   * suivant attendu. */
  async manualCompletion(){const b=this.s.batch;
   if(this.task)throw Error('Attends la fin de l’action en cours.');
   if(!b||b.state!=='MANUAL_TAKEOVER')throw Error('Aucune reprise manuelle en cours à déclarer.');
   this.gate();
   const taken=K.completeIdentity(b.manualTakeover?.identity||b.activeIdentity);
   const now=await this.adapter.state();now.identity=K.completeIdentity(now.identity);
   if(now.identity.pageId!==b.scope.pageId||now.identity.part!==b.scope.part)throw Error('Contexte de lot changé : reprise manuelle non déclarable ici.');
   if(K.key(now.identity)===K.key(taken))throw Error(`Cut ${taken.cut} toujours affiché : termine-le dans ESV et ouvre le cut suivant avant de déclarer la reprise.`);
   // Même exigence que pour la navigation après commande : le successeur immédiat, pas un cut quelconque.
   const transition=this.expectedTransition(taken,{navigationObserved:true,nextIdentity:now.identity},b.scope);
   if(!transition.expected)throw Error(`Cut ${now.identity.cut} affiché : ce n’est pas le suivant attendu après ${taken.cut} (${transition.reason}). Ouvre le cut ${taken.cut+1} ou arrête le lot.`);
   const origin=b.manualTakeover||{},sequence=origin.sequence||b.currentSequence||{};
   const record={id:K.uid(),recordId:K.uid(),format:'banane-manual-completion-v1',version:K.VERSION,
     source:'operator-manual-completion-from-automatic-pause',identity:taken,before:origin.before||null,
     lidarCaptureId:origin.lidarCaptureId||null,proposal:origin.proposal||null,archivedCaptureId:origin.archivedCaptureId||null,
     geominfo:origin.proposal?.geominfo||origin.before?.geominfo||{status:'not-observed',raw:null,source:null},
     decision:'MANUAL_COMPLETION',operatorDecision:'MANUAL_COMPLETION',decisionRule:'operator-declared-manual-completion-from-manual-takeover',
     provenance:'operator-in-esv',bananeValidated:false,commandSent:false,afterObserved:false,serverConfirmed:false,navigationObserved:false,
     afterStateStatus:'NOT_OBSERVED_BANANE_DID_NOT_ACT',status:'operator-manual-completion',validationProof:'none',
     /* Ce qui est observé à la déclaration, et rien de plus : UNE lecture de
      * l'identité affichée, faite à ce moment-là. Banane n'a pas vu l'opérateur
      * naviguer — elle n'observait pas — et ne peut donc rien dire d'une
      * navigation. Elle constate que l'identité lue diffère du cut rendu et
      * qu'elle en est le successeur immédiat. `operatorNavigationObserved` a
      * été retiré : il affirmait une observation qui n'a pas eu lieu. */
     identityReadAtDeclaration:K.completeIdentity(now.identity),identityDifferedFromTakenCut:true,
     identityIsExpectedSuccessor:true,transitionAtDeclaration:transition.reason,navigationObservedByBanane:false,
     usableForTraining:false,trainingExclusionReason:'operator-manual-completion',
     sequenceIndex:sequence.sequenceIndex??null,previousCutId:sequence.previousCutId??null,nextCutId:K.cutId(now.identity),
     takeoverStartedAt:origin.startedAt||null,declaredAt:new Date().toISOString()};
   await this.store.putRecord(record);this.s.records.push(record);
   b.manuallyCompleted=b.manuallyCompleted||[];
   b.manuallyCompleted.push({key:K.cutId(taken),identity:taken,cut:taken.cut,recordId:record.recordId,sequenceIndex:record.sequenceIndex,
     previousCutId:record.previousCutId,nextCutId:record.nextCutId,bananeValidated:false,declaredAt:record.declaredAt});
   b.interrupted.push({identity:taken,status:'MANUAL_COMPLETION',recordId:record.recordId});
   await this.event('batch-manual-completion',{identity:taken,recordId:record.recordId,nextIdentity:now.identity,bananeValidated:false,
     commandSent:false,serverConfirmed:false,afterObserved:false,usableForTraining:false,status:record.status});
   /* `lastCompletedIdentity` reste la dernière validation conduite par Banane :
    * un cut rendu à l'opérateur ne s'y inscrit pas. */
   b.lastManuallyCompletedIdentity=taken;this.s.mode=origin.modeBeforeTakeover||'automatic-test';
   this.s.proposal=null;this.s.applied=null;this.s.before=null;this.s.lidarId=null;this.s.collection='IDLE';
   b.manualTakeover=null;b.currentSequence=null;b.pauseReason=null;b.error=null;b.step='capture';
   b.activeIdentity=K.completeIdentity(now.identity);b.state='RUNNING';
   this.s.notice=`Cut ${taken.cut} repris à la main et journalisé sans validation Banane. Lot repris au cut ${now.identity.cut}.`;
   await this.save();this.launch();return this.view();
  }
  async skipPaused(){const b=this.s.batch;if(!this.pausedProposalAction(b))throw Error('Ce cut pausé ne peut pas être skippé explicitement.');
   this.gate();const now=await this.adapter.state();K.assertTarget(b.activeIdentity,now.identity);this.writable(now.identity);
   const proposal=K.clone(this.s.proposal),before=K.clone(this.s.before),lidarCaptureId=this.s.lidarId,sequence=K.clone(b.currentSequence);
   const rails=Object.fromEntries(Object.entries(proposal?.rails||{}).map(([side,p])=>[side,{status:p.status,confidence:p.confidence,reasons:p.reasons,proposal:p.delta||null}]));
   this.s.intent={kind:'skip',identity:K.completeIdentity(now.identity)};
   await this.event('explicit-skip-intent',{identity:now.identity,commandSent:false,afterObserved:false,serverConfirmed:false,navigationObserved:false,
     decisionRule:'operator-explicit-from-paused-cut',rails,proposal});
   try{
     const evidence=await this.adapter.skipAndNext(now.identity,b.scope);if(evidence.commandSent!==true)throw Error('La commande SKIP native n’est pas journalisée comme transmise.');
     this.s.intent=null;this.s.lastActionEvidence=K.clone(evidence);if(evidence.nextIdentity)sequence.nextCutId=K.cutId(evidence.nextIdentity);
     const record={id:K.uid(),recordId:K.uid(),format:'banane-automatic-skip-v1',version:K.VERSION,source:'explicit-operator-skip-from-automatic-pause',
       identity:K.completeIdentity(now.identity),before,lidarCaptureId,proposal,rails,geominfo:proposal?.geominfo||before?.geominfo||{status:'not-observed',raw:null,source:null},
       decision:'SKIP',operatorDecision:'SKIP',decisionRule:'operator-explicit-from-paused-cut',usableForTraining:false,trainingExclusionReason:'operator-skip',
       sequenceIndex:sequence.sequenceIndex,previousCutId:sequence.previousCutId,nextCutId:sequence.nextCutId,
       commandSent:true,afterObserved:evidence.afterObserved===true,afterStateStatus:evidence.afterStateStatus,serverConfirmed:evidence.serverConfirmed===true,
       navigationObserved:evidence.navigationObserved===true,navigationBefore:{identity:K.completeIdentity(now.identity)},navigationAfter:evidence.navigationAfter||null,evidence};
     record.id=record.recordId;record.status=record.afterObserved?'operator-skipped':'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED';
     await this.store.putRecord(record);this.s.records.push(record);b.skipped.push({key:K.cutId(now.identity),identity:record.identity,cut:now.identity.cut,
       sequenceIndex:sequence.sequenceIndex,previousCutId:sequence.previousCutId,nextCutId:sequence.nextCutId,decisionRule:record.decisionRule,rails,evidence});
     b.lastCompletedIdentity=K.completeIdentity(now.identity);this.s.before=null;this.s.lidarId=null;this.s.proposal=null;this.s.applied=null;this.s.collection='IDLE';
     await this.event('explicit-skip-observation',{identity:now.identity,recordId:record.recordId,commandSent:true,afterObserved:record.afterObserved,
       afterStateStatus:record.afterStateStatus,serverConfirmed:record.serverConfirmed,navigationObserved:record.navigationObserved,evidence});
     if(!record.afterObserved){b.state='PAUSED_AFTER_STATE_MISSING';b.step='capture';b.interrupted.push({identity:record.identity,status:record.status,evidence});
       this.s.notice='SKIP transmis, mais le cut a changé avant la relecture finale. Reprise automatique suspendue.';await this.save();return;}
     if(now.identity.cut===b.scope.end){b.state=this.closingState(b);await this.save();return;}
     if(!evidence.navigationObserved||!evidence.nextIdentity){b.state='PAUSED_ADAPTER_UNRESPONSIVE';this.s.notice='SKIP transmis sans identité suivante confirmée. La commande ne sera pas répétée.';await this.save();return;}
     b.state='RUNNING';b.step='capture';b.activeIdentity=K.completeIdentity(evidence.nextIdentity);await this.save();this.launch();
   }catch(e){b.state='PAUSED_ADAPTER_UNRESPONSIVE';b.error={message:e.message,step:'explicit-skip',timestamp:new Date().toISOString()};
     this.s.reconcileRequired=true;this.s.notice=e.message+' La commande SKIP ne sera pas répétée.';await this.event('explicit-skip-unconfirmed',{identity:now.identity,message:e.message});throw e;}
  }
  closureSummary(){const b=this.s.batch,records=this.s.records;
   const defer=this.deferPending();
   return {status:b?.state||null,completed:b?.processed?.length||0,paused:b?.paused?.length||0,skipped:b?.skipped?.length||0,
     /* Issus des seuls résultats CONFIRMÉS : une intention en attente ou une
      * commande incertaine n'est jamais comptée comme différée. */
     deferred:b?.deferred?.length||0,deferredCuts:(b?.deferred||[]).map(x=>K.cutId(x.identity)),
     unresolvedPolicy:b?this.unresolvedPolicy(b):null,lastDeferredIdentity:b?.lastDeferredIdentity||null,
     deferPending:defer?{operationId:defer.operationId,phase:defer.phase,identity:K.completeIdentity(defer.identity),
       commandInvoked:defer.commandInvoked??'unknown',transition:defer.transition??null}:null,
     manuallyCompleted:b?.manuallyCompleted?.length||0,manuallyCompletedCuts:(b?.manuallyCompleted||[]).map(x=>K.cutId(x.identity)),
     lastManuallyCompletedIdentity:b?.lastManuallyCompletedIdentity||null,
     interrupted:b?.interrupted?.length||0,withoutFinalState:records.filter(r=>r.status==='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED'||r.status==='incomplete-no-after').map(r=>K.cutId(r.identity||r.before?.identity)),
     withoutServerConfirmation:records.filter(r=>r.commandSent&&!r.serverConfirmed).map(r=>K.cutId(r.identity)),activeIdentity:b?.activeIdentity||null,
     lastCompletedIdentity:b?.lastCompletedIdentity||null};
  }
  async resume(){if(this.task)throw Error('Attends la fin de l’action en cours.');this.gate();
   if(this.s.batch?.state==='PAUSED_DEFER_NAVIGATION_UNCERTAIN')throw Error('Navigation différée incertaine : contrôle le cut dans ESV puis clôture ce résultat. Aucune commande ne sera renvoyée.');
   if(this.deferPending())throw Error('Navigation différée non résolue : clôture ce résultat avant toute reprise.');
   if(!this.s.batch||!['PAUSED','STOPPED','PAUSED_AFTER_STATE_MISSING','PAUSED_ADAPTER_UNRESPONSIVE'].includes(this.s.batch.state))throw Error('Aucun lot à reprendre.');
   if(this.s.batch.state==='PAUSED_AFTER_STATE_MISSING')throw Error('État final manquant : contrôle le cut dans ESV avant toute reprise.');
   if(this.s.batch.state==='PAUSED_ADAPTER_UNRESPONSIVE')throw Error('Adaptateur sans réponse : reconnecte ESV avant toute reprise.');
   const now=await this.adapter.state();if(now.identity.pageId!==this.s.batch.scope.pageId||now.identity.part!==this.s.batch.scope.part)throw Error('Contexte de lot changé : reprise refusée.');
   if(this.s.before)K.assertTarget(this.s.before.identity,now.identity);
   if(this.s.batch.step==='capture'&&this.s.before&&!K.equalPoses(this.s.before.rails,now.rails))throw Error('Rails modifiés depuis la lecture interrompue : capture initiale conservée.');
   this.s.batch.state='RUNNING';this.s.batch.interruptedByRestart=false;this.s.batch.error=null;await this.save();this.launch();}
 }
 return {Engine};
});
