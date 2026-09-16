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
    if(this.s.batch){for(const name of ['processed','skipped','paused','interrupted','sequence','manuallyCompleted'])if(!Array.isArray(this.s.batch[name]))this.s.batch[name]=[];
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
  /* La transition attendue après une commande native : même onglet, même part,
   * et le SUCCESSEUR IMMÉDIAT du cut commandé. Une navigation quelconque ne
   * vaut pas preuve — un saut en avant ferait franchir en silence les cuts
   * sautés, un retour en arrière ferait retraiter un cut déjà commandé.
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
   if(next.cut!==identity.cut+1)return{expected:false,reason:next.cut<=identity.cut?'NO_FORWARD_MOVE':'CUTS_SKIPPED',observed:next};
   return{expected:true,reason:'IMMEDIATE_SUCCESSOR_SAME_PAGE_AND_PART',observed:next};
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
   this.s.batch={id:K.uid(),state:'RUNNING',step:'capture',scope:normalizedScope,processed:[],skipped:[],paused:[],interrupted:[],sequence:[],
     activeIdentity:K.completeIdentity(now.identity),lastCompletedIdentity:null,startedAt:new Date().toISOString()};
   await this.event('batch-started',{batch:this.s.batch});
   if(scope.lowConfidence==='skip')await this.event('legacy-automatic-skip-disabled',{identity:now.identity,requestedPolicy:'skip',effectivePolicy:'pause'});
   }catch(e){this.busy=false;throw e;}this.launch();return this.view();}
  launch(){this.task=this.run().finally(()=>{this.task=null;this.busy=false;});}
  async boundary(){if(this.s.batch.state!=='RUNNING')return false;await this.save();return true;}
  /* « COMPLETED » s'affiche « Terminé confirmé » dans le panneau. Un lot qui
   * contient une action sans confirmation serveur — ou un cut repris à la main,
   * que Banane n'a pas validé — ne peut pas porter ce mot. */
  closingState(b){return b.processed.some(x=>!x.evidence?.serverConfirmed)||b.skipped.some(x=>!x.evidence?.serverConfirmed)||b.manuallyCompleted?.length>0
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
     if([...b.processed,...b.skipped,...(b.manuallyCompleted||[])].some(x=>x.key===fullKey||x.key===k))throw Error('Cut déjà traité dans ce lot : boucle arrêtée.');
     if(b.step==='capture'){
       b.cutStartedAt=new Date().toISOString();
       if(this.s.collection==='STALE')await this.archivePending('batch-new-target');
       await this.begin();b.step='analyze';await this.save();}
     if(!await this.boundary())break;
     if(b.step==='analyze'){await this.analyze();b.step='apply';await this.save();}
     if(!await this.boundary())break;
     const fits=Object.values(this.s.proposal.rails),missing=fits.some(p=>!p.delta),low=missing||fits.some(p=>p.confidence<this.s.settings.minConfidence);
     if(b.step==='apply'&&missing){
       const rails=Object.fromEntries(Object.entries(this.s.proposal.rails).map(([side,p])=>[side,{status:p.status,confidence:p.confidence,reasons:p.reasons,proposal:p.delta||null}]));
       const paused={status:'PAUSED_UNRESOLVED_RAIL',identity:K.completeIdentity(now.identity),before:K.clone(this.s.before),lidarCaptureId:this.s.lidarId,
         proposal:K.clone(this.s.proposal),rails,geominfo:this.s.proposal.geominfo,sequenceIndex:b.currentSequence.sequenceIndex,
         actions:['RETRY','MANUAL_TAKEOVER','EXPLICIT_SKIP','STOP'],pausedAt:new Date().toISOString()};
       b.state='PAUSED_UNRESOLVED_RAIL';b.pauseReason='unresolved-rail';b.paused.push(paused);
       this.s.notice='Rail non résolu : cut conservé sans commande. Choisis Réessayer, Reprise manuelle, SKIP explicite ou Arrêter.';
       await this.event('batch-paused-unresolved-rail',{identity:now.identity,paused});break;
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
   return {status:b?.state||null,completed:b?.processed?.length||0,paused:b?.paused?.length||0,skipped:b?.skipped?.length||0,
     manuallyCompleted:b?.manuallyCompleted?.length||0,manuallyCompletedCuts:(b?.manuallyCompleted||[]).map(x=>K.cutId(x.identity)),
     lastManuallyCompletedIdentity:b?.lastManuallyCompletedIdentity||null,
     interrupted:b?.interrupted?.length||0,withoutFinalState:records.filter(r=>r.status==='AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED'||r.status==='incomplete-no-after').map(r=>K.cutId(r.identity||r.before?.identity)),
     withoutServerConfirmation:records.filter(r=>r.commandSent&&!r.serverConfirmed).map(r=>K.cutId(r.identity)),activeIdentity:b?.activeIdentity||null,
     lastCompletedIdentity:b?.lastCompletedIdentity||null};
  }
  async resume(){if(this.task)throw Error('Attends la fin de l’action en cours.');this.gate();
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
